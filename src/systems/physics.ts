import * as THREE from 'three';
import { CONFIG } from '../config.js';

const closest = new THREE.Vector3();
const normal = new THREE.Vector3();
const relVel = new THREE.Vector3();
const deltaPos = new THREE.Vector3();

/**
 * Physics engine 3.0 (Spec 024).
 *
 * What changed from 2.0, and why:
 *
 *  - **Sub-stepped integration.** A dashing Lúmen travels 0.57 u per 60 Hz frame
 *    while the perimeter walls are 1 u thick and its own radius is 0.6 u. That is
 *    close enough to the tunnelling threshold that it happened in practice. The
 *    integrator now splits the frame so that no body advances more than half its
 *    radius per sub-step (REQ-024.01).
 *
 *  - **Carry applied once.** Standing on a moving platform used to displace the
 *    body once per solver iteration, i.e. three times per frame, so platforms
 *    flung the player. The delta is now accumulated in `body.carry` and applied
 *    after the solver, exactly once (REQ-024.02).
 *
 *  - **Grounding is a state, not an instant.** `body.grounded` is held for
 *    `groundStickTime` after contact is lost while not moving upwards, which kills
 *    the flicker that made stairs feel like a stutter (REQ-024.06). The contact
 *    normal is published so the movement code can align to slopes (REQ-024.03).
 *
 *  - **No bounce on floors, full slide on walls.** Restitution along a ground
 *    normal is suppressed, so Lúmen settles instead of jittering; against a wall
 *    only the normal component is removed, so the tangential speed survives and
 *    the player slides along geometry instead of sticking to it
 *    (REQ-024.04, REQ-024.05).
 *
 *  - **Asymmetric gravity.** Rising, hanging and falling use different gravity
 *    scales (REQ-024.07). This is the single biggest contributor to how the jump
 *    reads, and it is why `src/domain/jump-arc.ts` needs the fall multiplier to
 *    predict reach correctly.
 */
export function physicsSystem() {
  return {
    name: 'physics',

    update(world, dt) {
      const solids = world.find('solid', 'transform');
      const bodies = world.find('transform', 'body');

      movePlatforms(solids, dt);

      // How finely must this frame be sliced so nothing tunnels?
      const steps = requiredSubSteps(bodies, dt);
      const h = dt / steps;

      for (let step = 0; step < steps; step++) {
        integrate(world, bodies, h);
        solve(bodies, solids);
        applyCarry(bodies);
      }

      settleGrounding(bodies, dt);
      updateCrumbling(world, solids, dt);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Integration                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Sub-step count for this frame: enough that the fastest body moves at most
 * `maxTravelPerStep` of its own radius per step, capped so a stalled tab cannot
 * turn into thousands of iterations.
 */
function requiredSubSteps(bodies, dt) {
  let worst = 1;
  for (const e of bodies) {
    const b = e.body;
    const speed = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
    const budget = Math.max(0.05, b.radius * CONFIG.physics.maxTravelPerStep);
    const needed = Math.ceil((speed * dt) / budget);
    if (needed > worst) worst = needed;
  }
  return Math.min(Math.max(1, worst), CONFIG.physics.maxSubSteps);
}

function integrate(world, bodies, dt) {
  for (const e of bodies) {
    const { body, transform } = e;

    // `damped` means a controller already resolved this body's horizontal
    // velocity for the frame. Damping it a second time here is what made the
    // player's steady-state speed a quarter lower than the configured one.
    if (!body.damped) {
      const rate = body.grounded ? (body.friction ?? 12) : (body.drag ?? 1);
      const k = Math.min(1, rate * dt);
      body.velocity.x -= body.velocity.x * k;
      body.velocity.z -= body.velocity.z * k;
    }

    // A dash owns its own trajectory: no gravity, no drag on the vertical axis.
    if (!body.noGravity) {
      body.velocity.y += CONFIG.world.gravity * gravityScale(body.velocity.y) * dt;
    }

    transform.position.addScaledVector(body.velocity, dt);

    body.contact = false;               // reset per sub-step
    if (!body.carry) body.carry = new THREE.Vector3();

    if (transform.position.y < CONFIG.world.voidY) world.events.emit('body:fell', e);
  }
}

/**
 * Gravity is scaled by flight phase: light on the rise, lighter still around the
 * apex (hang time to aim), heavy on the way down (a snappy landing).
 */
function gravityScale(vy) {
  const { fallGravityMultiplier, apexGravityMultiplier, apexThreshold } = CONFIG.world;
  if (Math.abs(vy) < apexThreshold) return apexGravityMultiplier;
  return vy < 0 ? fallGravityMultiplier : 1;
}

/* -------------------------------------------------------------------------- */
/* Solver                                                                      */
/* -------------------------------------------------------------------------- */

function solve(bodies, solids) {
  for (let i = 0; i < CONFIG.physics.iterations; i++) {
    for (let j = 0; j < bodies.length; j++) {
      for (let k = j + 1; k < bodies.length; k++) {
        resolveSphereSphere(bodies[j], bodies[k]);
      }
    }
    for (const e of bodies) {
      for (const s of solids) {
        resolveSphereBox(e, s, i === 0);
      }
    }
  }
}

/** Displacement owed by moving platforms, applied exactly once (REQ-024.02). */
function applyCarry(bodies) {
  for (const e of bodies) {
    if (!e.body.carry) continue;
    e.transform.position.add(e.body.carry);
    e.body.carry.set(0, 0, 0);
  }
}

/**
 * Grounding hysteresis. `body.contact` is the raw answer from the solver;
 * `body.grounded` is the answer the gameplay code sees, held briefly so that a
 * one-frame gap between two platforms does not read as falling (REQ-024.06).
 */
function settleGrounding(bodies, dt) {
  for (const e of bodies) {
    const b = e.body;
    if (b.contact) {
      b.groundTimer = 0;
      b.grounded = true;
      continue;
    }
    b.groundTimer = (b.groundTimer ?? Infinity) + dt;
    // Moving upwards means the body left on purpose: drop the grace immediately.
    const leaping = b.velocity.y > 0.5;
    b.grounded = !leaping && b.groundTimer < CONFIG.physics.groundStickTime;
    // Airborne again: forget the last landing, so the next one reports its own.
    if (!b.grounded) b.impactSpeed = 0;
  }
}

function movePlatforms(solids, dt) {
  for (const s of solids) {
    if (!s.moving) continue;
    s.moving.t = (s.moving.t || 0) + dt * s.moving.speed;
    const offset = Math.sin(s.moving.t) * s.moving.range;
    const before = s.moving.axis === 'x' ? s.transform.position.x : s.transform.position.z;

    if (s.moving.axis === 'x') {
      s.transform.position.x = s.moving.origin.x + offset;
      s.moving.dx = s.transform.position.x - before;
      s.moving.dz = 0;
    } else {
      s.transform.position.z = s.moving.origin.z + offset;
      s.moving.dz = s.transform.position.z - before;
      s.moving.dx = 0;
    }
  }
}

/**
 * Collapsing platforms: touch → shake → fall away → **reform**.
 *
 * The first implementation destroyed the entity outright, and that made a whole
 * chunk of the game unwinnable. The Sendero Efímero is five collapsing tiles in
 * a row; the Baliza that covers it sits *before* it. Cross the gauntlet, miss the
 * next jump, respawn at the Baliza — and the route you came through no longer
 * exists. The Ciclo becomes impossible to finish and the only way out is to die
 * on purpose. A scripted route-follower reproduced it as 55 consecutive falls on
 * Ciclo 3.
 *
 * Reforming after `respawn` seconds keeps the tile a real hazard — you still
 * cannot stop on it, and it is still gone when you need it a second later — while
 * making the mistake recoverable, which is the same principle as ADR-008.
 */
function updateCrumbling(world, solids, dt) {
  for (const s of solids) {
    const c = s.crumbling;
    if (!c) continue;

    if (c.state === 'crumbling') {
      c.timer -= dt;

      // Visual tell: the closer to collapse, the harder it shakes.
      if (s.render?.mesh) {
        const panic = 1 - Math.max(0, c.timer) / (c.duration ?? 1.5);
        const amp = 0.02 + panic * 0.06;
        s.render.mesh.position.x += (Math.random() - 0.5) * amp;
        s.render.mesh.position.z += (Math.random() - 0.5) * amp;
      }

      if (c.timer <= 0) {
        c.state = 'gone';
        c.timer = c.respawn ?? 2.5;
        if (s.render?.mesh) s.render.mesh.visible = false;
        world.events.emit('platform:collapsed', s);
      }
      continue;
    }

    if (c.state !== 'gone') continue;

    c.timer -= dt;
    if (c.timer > 0) continue;

    // Never reform underneath something standing in the hole: materialising a
    // box around a body leaves the solver to eject it through the nearest face,
    // which reads as the platform launching the player sideways.
    if (occupied(world, s)) { c.timer = 0.3; continue; }

    c.state = 'idle';
    c.timer = c.duration ?? 1.5;
    if (s.render?.mesh) {
      s.render.mesh.visible = true;
      s.render.mesh.position.copy(s.transform.position);
    }
    world.events.emit('platform:restored', s);
  }
}

/** Is any physics body inside the volume this platform is about to reclaim? */
function occupied(world, solidEntity) {
  const c = solidEntity.transform.position;
  const size = solidEntity.solid.size;
  for (const e of world.query('transform', 'body')) {
    const p = e.transform.position;
    const r = e.body.radius;
    if (Math.abs(p.x - c.x) < size.x / 2 + r &&
        Math.abs(p.y - c.y) < size.y / 2 + r &&
        Math.abs(p.z - c.z) < size.z / 2 + r) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Contacts                                                                    */
/* -------------------------------------------------------------------------- */

function resolveSphereSphere(eA, eB) {
  const pA = eA.transform.position;
  const pB = eB.transform.position;
  const bA = eA.body;
  const bB = eB.body;

  deltaPos.subVectors(pA, pB);
  const dist = deltaPos.length();
  const minDist = bA.radius + bB.radius;
  if (dist > minDist || dist === 0) return;

  const depth = minDist - dist;
  normal.copy(deltaPos).divideScalar(dist);   // points from B towards A

  const invMassA = 1 / (bA.mass ?? 1);
  const invMassB = 1 / (bB.mass ?? 1);
  const invTotal = invMassA + invMassB;

  pA.addScaledVector(normal, depth * (invMassA / invTotal));
  pB.addScaledVector(normal, -depth * (invMassB / invTotal));

  relVel.subVectors(bA.velocity, bB.velocity);
  const along = relVel.dot(normal);
  if (along > 0) return;                       // already separating

  const bounciness = Math.min(bA.bounciness ?? 0.1, bB.bounciness ?? 0.1);
  const j = (-(1 + bounciness) * along) / invTotal;

  bA.velocity.addScaledVector(normal, j * invMassA);
  bB.velocity.addScaledVector(normal, -j * invMassB);
}

/**
 * Sphere against axis-aligned box.
 *
 * `first` marks the opening solver iteration: side effects that must happen once
 * per sub-step (arming a crumbling platform, banking the platform carry, firing
 * a bounce pad) are gated on it, so running three iterations no longer triples
 * the impulse.
 */
function resolveSphereBox(bodyEntity, solidEntity, first) {
  // A collapsed tile is still an entity, but it is not a surface.
  if (solidEntity.crumbling?.state === 'gone') return;

  const position = bodyEntity.transform.position;
  const body = bodyEntity.body;
  const boxCenter = solidEntity.transform.position;
  const boxSize = solidEntity.solid.size;

  const hx = boxSize.x / 2;
  const hy = boxSize.y / 2;
  const hz = boxSize.z / 2;

  closest.set(
    THREE.MathUtils.clamp(position.x, boxCenter.x - hx, boxCenter.x + hx),
    THREE.MathUtils.clamp(position.y, boxCenter.y - hy, boxCenter.y + hy),
    THREE.MathUtils.clamp(position.z, boxCenter.z - hz, boxCenter.z + hz),
  );

  normal.subVectors(position, closest);
  const distance = normal.length();
  if (distance > body.radius) return;

  let depth;
  if (distance > 1e-6) {
    normal.divideScalar(distance);
    depth = body.radius - distance;
  } else {
    // Centre trapped inside the box: leave through the nearest face.
    const dx = hx + body.radius - Math.abs(position.x - boxCenter.x);
    const dy = hy + body.radius - Math.abs(position.y - boxCenter.y);
    const dz = hz + body.radius - Math.abs(position.z - boxCenter.z);
    if (dy <= dx && dy <= dz) {
      normal.set(0, Math.sign(position.y - boxCenter.y) || 1, 0);
      depth = dy;
    } else if (dx <= dz) {
      normal.set(Math.sign(position.x - boxCenter.x) || 1, 0, 0);
      depth = dx;
    } else {
      normal.set(0, 0, Math.sign(position.z - boxCenter.z) || 1);
      depth = dz;
    }
  }

  position.addScaledVector(normal, depth);

  const isFloor = normal.y > 0.5;
  const into = body.velocity.dot(normal);

  if (into < 0) {
    if (isFloor) {
      // Never bounce off the ground: cancel the normal component exactly.
      // The tangential component is untouched, so momentum survives the landing.
      //
      // The cancelled speed is kept on the body, because it is the only moment
      // the information exists: one frame later the velocity is gone and
      // nothing downstream can tell a step off a kerb from a fall down a tower.
      // The audio layer scales the landing sound by it (REQ-025.15).
      body.impactSpeed = Math.max(body.impactSpeed ?? 0, -into);
      body.velocity.addScaledVector(normal, -into);
    } else {
      // Walls: remove the normal component, keep the slide (REQ-024.05).
      const bounciness = body.wallBounce ?? 0;
      body.velocity.addScaledVector(normal, -into * (1 + bounciness));
    }
  }

  if (!isFloor) return;

  body.contact = true;
  if (!body.groundNormal) body.groundNormal = new THREE.Vector3();
  body.groundNormal.copy(normal);

  if (!first) return;   // everything below is a once-per-sub-step effect

  if (solidEntity.bounce) {
    body.velocity.y = solidEntity.bounce.force;
    body.contact = false;
    body.grounded = false;
    body.groundTimer = Infinity;
    solidEntity.bounce.firedAt = solidEntity.bounce.firedAt ?? 0;
    solidEntity.bounce.pulse = 1;
  }

  if (solidEntity.crumbling && solidEntity.crumbling.state === 'idle') {
    solidEntity.crumbling.state = 'crumbling';
  }

  if (solidEntity.moving) {
    if (!body.carry) body.carry = new THREE.Vector3();
    body.carry.x += solidEntity.moving.dx || 0;
    body.carry.z += solidEntity.moving.dz || 0;
  }
}
