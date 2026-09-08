import * as THREE from 'three';
import { CONFIG } from '../config.js';

const dir = new THREE.Vector3();
const tmp = new THREE.Vector3();

/**
 * Sombra behaviour.
 *
 * The design rule this file exists to enforce: **nothing hostile ever acts
 * without warning.** Every archetype runs the same shape of state machine —
 * approach, telegraph, commit, recover — and the telegraph state is clamped to
 * `CONFIG.enemy.telegraphFloor` (REQ-024.22). That single constraint is the
 * difference between a game that is hard and one that is unfair: a player who
 * loses a layer of Núcleo can always point at the moment they should have moved.
 *
 * Each telegraph raises `enemy:telegraph` so the avatar and audio layers can
 * render the tell without knowing anything about the state machine itself
 * (REQ-024.23).
 *
 * Two smaller things live here because they are behaviour, not physics:
 *  - **Stun.** An Impulso that connects with a Sombra too solid to shatter
 *    suppresses it for `stunTime` (REQ-024.28), which is what makes charging a
 *    Coloso a real option instead of a mistake.
 *  - **Leash and hover.** Sombras that walk chase Lúmen off the route and delete
 *    themselves in the void; the leash pulls them home, and the hovering
 *    archetypes ignore gravity entirely.
 */
export function enemySystem() {
  return {
    name: 'enemy',

    init(world) {
      world.events.on('enemy:hit', ({ enemy, amount = 1, from = null }) => {
        if (!enemy?.enemy) return;
        enemy.enemy.integrity = (enemy.enemy.integrity ?? 1) - amount;
        enemy.enemy.stun = CONFIG.enemy.stunTime;
        if (enemy.fsm) { enemy.fsm.state = 'recover'; enemy.fsm.timer = CONFIG.enemy.stunTime; }

        if (from && enemy.body) {
          tmp.subVectors(enemy.transform.position, from).setY(0);
          if (tmp.lengthSq() > 0) enemy.body.velocity.addScaledVector(tmp.normalize(), 14);
          enemy.body.velocity.y = Math.max(enemy.body.velocity.y, 5);
        }

        if (enemy.enemy.integrity <= 0) {
          world.events.emit('enemy:shattered', { enemy, at: enemy.transform.position.clone() });
          world.destroy(enemy);
        } else {
          world.events.emit('enemy:stunned', { enemy });
        }
      });
    },

    update(world, dt) {
      if (world.state.status !== 'playing') return;

      const player = world.first('player');

      for (const e of world.find('enemy', 'transform', 'body', 'fsm')) {
        // Interceptors carry an `enemy` component so they can be stunned and
        // shattered like any Sombra, but their movement is driven by their own
        // system. Without this guard both would fight over the same velocity.
        if (e.interceptor) continue;

        const info = e.enemy;

        if (info.stun > 0) {
          info.stun -= dt;
          e.body.velocity.x *= 0.9;
          e.body.velocity.z *= 0.9;
          keepAfloat(e, dt);
          continue;
        }

        const dist = player ? e.transform.position.distanceTo(player.transform.position) : Infinity;
        const brain = BRAINS[info.type] ?? BRAINS.tracker;
        brain(world, e, player, dist, dt);

        leash(e, dt);
        keepAfloat(e, dt);
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Enters a state, announcing it when it is a telegraph so the tell can render. */
function enter(world, e, state, duration, telegraph = false) {
  e.fsm.state = state;
  e.fsm.timer = telegraph ? Math.max(duration, CONFIG.enemy.telegraphFloor) : duration;
  if (telegraph) {
    world.events.emit('enemy:telegraph', {
      enemy: e,
      kind: state,
      duration: e.fsm.timer,
      at: e.transform.position.clone(),
    });
  }
}

function steer(e, target, speed, accel, dt) {
  dir.subVectors(target, e.transform.position).setY(0);
  if (dir.lengthSq() > 0) dir.normalize();
  e.body.velocity.x += dir.x * speed * accel * dt;
  e.body.velocity.z += dir.z * speed * accel * dt;
  e.transform.yaw = Math.atan2(dir.x, dir.z);
  return dir;
}

function brake(e, factor = 0.88) {
  e.body.velocity.x *= factor;
  e.body.velocity.z *= factor;
}

/** Hovering Sombras hold a constant altitude over the height they were placed at. */
function keepAfloat(e, dt) {
  const hover = e.enemy?.hover ?? 0;
  if (hover <= 0) return;
  const wanted = e.enemy.home.y;
  const delta = wanted - e.transform.position.y;
  e.body.velocity.y += delta * 6 * dt;
  e.body.velocity.y *= 0.9;
}

/**
 * Keeps a Sombra within reach of the slot it was placed in. Without it, a
 * Rastreador chasing Lúmen across a Salto del Vacío simply falls, and the Ciclo
 * quietly empties itself of enemies after two or three long jumps.
 */
function leash(e, dt) {
  const limit = e.enemy.leash ?? 34;
  const home = e.enemy.home;
  const away = Math.hypot(e.transform.position.x - home.x, e.transform.position.z - home.z);
  if (away <= limit) return;
  const pull = Math.min(1, (away - limit) / 10);
  steer(e, home, e.enemy.speed * 1.4 * pull, 8, dt);
}

/* -------------------------------------------------------------------------- */
/* Archetype brains                                                            */
/* -------------------------------------------------------------------------- */

/**
 * RASTREADOR — the baseline. Walks you down, then winds up for a lunge when it
 * gets close. It is the archetype the early Ciclos are built around, because it
 * is also the one that teaches the Impulso: one dash and it shatters.
 */
function tracker(world, e, player, dist, dt) {
  const f = e.fsm;
  const speed = e.enemy.speed;
  const accel = e.body.grounded ? (e.body.friction ?? 10) : (e.body.drag ?? 2);
  f.timer -= dt;

  switch (f.state) {
    case 'lunge_wind':
      brake(e, 0.82);
      if (player) e.transform.yaw = facing(e, player);
      if (f.timer <= 0) {
        f.aim.copy(player ? player.transform.position : e.transform.position);
        enter(world, e, 'lunge', 0.34);
      }
      return;

    case 'lunge': {
      const to = f.aim;
      tmp.subVectors(to, e.transform.position).setY(0);
      if (tmp.lengthSq() > 0) tmp.normalize();
      e.body.velocity.x = tmp.x * speed * 3.1;
      e.body.velocity.z = tmp.z * speed * 3.1;
      if (f.timer <= 0) enter(world, e, 'recover', 0.55);
      return;
    }

    case 'recover':
      brake(e);
      if (f.timer <= 0) enter(world, e, 'chase', 0);
      return;

    default:
      if (player && dist < (e.enemy.aggroRange || 16)) {
        steer(e, player.transform.position, speed, accel, dt);
        if (dist < 5.5 && f.state !== 'lunge_wind') enter(world, e, 'lunge_wind', 0.5, true);
      } else {
        // Patrol: drift back to the slot and circle it.
        const home = e.enemy.home;
        tmp.copy(home);
        if (e.transform.position.distanceToSquared(home) < 4) {
          tmp.set(home.x + Math.sin(f.timer * 0.7) * 4, home.y, home.z + Math.cos(f.timer * 0.7) * 4);
        }
        steer(e, tmp, speed * 0.55, accel, dt);
      }

      // A grounded Sombra pinned against geometry hops instead of grinding.
      if (e.body.grounded && Math.hypot(e.body.velocity.x, e.body.velocity.z) < speed * 0.25) {
        e.body.velocity.y = 7;
      }
  }
}

/**
 * ACECHANTE — circles at a distance, then commits to one fast strike. Fragile,
 * so it never wants to be where you are: the threat is the strike, not the body.
 */
function stalker(world, e, player, dist, dt) {
  const f = e.fsm;
  const speed = e.enemy.speed;
  f.timer -= dt;

  if (!player || dist > (e.enemy.aggroRange || 14) * 1.6) {
    steer(e, e.enemy.home, speed * 0.5, 4, dt);
    return;
  }

  switch (f.state) {
    case 'wind':
      brake(e, 0.8);
      e.transform.yaw = facing(e, player);
      if (f.timer <= 0) {
        f.aim.copy(player.transform.position);
        enter(world, e, 'strike', 0.4);
      }
      return;

    case 'strike': {
      tmp.subVectors(f.aim, e.transform.position).setY(0);
      if (tmp.lengthSq() > 0) tmp.normalize();
      e.body.velocity.x = tmp.x * speed * 3.4;
      e.body.velocity.z = tmp.z * speed * 3.4;
      if (f.timer <= 0) enter(world, e, 'recover', 1.1);
      return;
    }

    case 'recover':
      // Backs off while it recharges: a window the player can use.
      tmp.subVectors(e.transform.position, player.transform.position).setY(0).normalize();
      e.body.velocity.x += tmp.x * speed * 2 * dt;
      e.body.velocity.z += tmp.z * speed * 2 * dt;
      if (f.timer <= 0) enter(world, e, 'circle', 0);
      return;

    default: {
      // Orbit at strike range rather than closing in.
      const orbit = 7;
      tmp.subVectors(e.transform.position, player.transform.position).setY(0);
      const radius = tmp.length() || 1;
      const tangent = new THREE.Vector3(-tmp.z, 0, tmp.x).normalize();
      const pullIn = (radius - orbit) * 0.4;
      tmp.normalize();
      e.body.velocity.x += (tangent.x * speed - tmp.x * pullIn) * 3 * dt;
      e.body.velocity.z += (tangent.z * speed - tmp.z * pullIn) * 3 * dt;
      e.transform.yaw = facing(e, player);
      if (dist < 11) enter(world, e, 'wind', 0.5, true);
    }
  }
}

/**
 * COLOSO — slow, heavy, and the only common Sombra that survives an Impulso.
 * Its leap is the most heavily telegraphed action in the game (0.75 s crouch)
 * because its shockwave is the hardest hit in the game (REQ-024.26).
 */
function tank(world, e, player, dist, dt) {
  const f = e.fsm;
  const speed = e.enemy.speed;
  const accel = e.body.grounded ? (e.body.friction ?? 10) : (e.body.drag ?? 2);
  f.timer -= dt;

  switch (f.state) {
    case 'leap_wind':
      brake(e, 0.7);
      if (player) e.transform.yaw = facing(e, player);
      if (f.timer <= 0 && player) {
        tmp.subVectors(player.transform.position, e.transform.position).setY(0);
        const reach = Math.min(tmp.length(), 16);
        tmp.normalize();
        e.body.velocity.set(tmp.x * reach * 0.9, 13, tmp.z * reach * 0.9);
        enter(world, e, 'leap', 2.0);
      }
      return;

    case 'leap':
      if (e.body.grounded || f.timer <= 0) {
        world.events.emit('enemy:shockwave', {
          enemy: e,
          at: e.transform.position.clone(),
          radius: 6.5,
          damage: 2,
        });
        enter(world, e, 'recover', 1.2);
      }
      return;

    case 'recover':
      brake(e, 0.85);
      if (f.timer <= 0) enter(world, e, 'advance', 0);
      return;

    default:
      if (player && dist < (e.enemy.aggroRange || 25)) {
        steer(e, player.transform.position, speed, accel, dt);
        if (dist > 6 && dist < 16) enter(world, e, 'leap_wind', 0.75, true);
      } else {
        steer(e, e.enemy.home, speed * 0.4, accel, dt);
      }
  }
}

/**
 * CENTINELA — does not move. Sweeps, locks on, fires. The Corredor Vigilado
 * chunk exists to give this archetype a stage: the platforming there is free,
 * and all the pressure comes from reading the aim line and moving off it.
 */
function turret(world, e, player, dist, dt) {
  const f = e.fsm;
  f.timer -= dt;
  brake(e, 0.75);

  switch (f.state) {
    case 'aim':
      if (player) {
        e.transform.yaw = facing(e, player);
        f.aim.copy(player.transform.position);
      }
      if (f.timer <= 0) {
        fire(world, e, f.aim);
        enter(world, e, 'cooldown', 1.5 + Math.random() * 0.6);
      }
      return;

    case 'cooldown':
      if (player) e.transform.yaw = facing(e, player);
      if (f.timer <= 0) enter(world, e, 'scan', 0);
      return;

    default:
      // Idle sweep, so a dormant Centinela still reads as awake.
      e.transform.yaw += dt * 0.8;
      if (player && dist < (e.enemy.aggroRange || 40)) enter(world, e, 'aim', 0.6, true);
  }
}

/**
 * DEVORADOR — the Ciclo boss, every fifth Ciclo.
 *
 * Three phases keyed to its remaining integrity (REQ-024.27), each swapping the
 * move set rather than only the numbers, so the fight has an arc instead of a
 * difficulty slider. Nine layers of integrity means nine connected Impulsos:
 * the fight is a test of the dash, which is the mechanic the whole spec is built
 * around.
 */
function boss(world, e, player, dist, dt) {
  const f = e.fsm;
  const max = 9;
  const left = e.enemy.integrity ?? max;
  const phase = left > max * 0.66 ? 1 : left > max * 0.33 ? 2 : 3;

  if (phase !== f.phase) {
    f.phase = phase;
    world.events.emit('enemy:phase', { enemy: e, phase });
    enter(world, e, 'roar', 1.0, true);
  }

  const speed = e.enemy.speed * (phase === 3 ? 1.6 : phase === 2 ? 1.2 : 1);
  f.timer -= dt;

  switch (f.state) {
    case 'roar':
      brake(e, 0.8);
      if (f.timer <= 0) enter(world, e, 'hunt', 0);
      return;

    case 'slam_wind':
      brake(e, 0.7);
      if (player) e.transform.yaw = facing(e, player);
      if (f.timer <= 0 && player) {
        tmp.subVectors(player.transform.position, e.transform.position).setY(0).normalize();
        e.body.velocity.set(tmp.x * 22, 10, tmp.z * 22);
        enter(world, e, 'slam', 1.4);
      }
      return;

    case 'slam':
      if (f.timer <= 0) {
        world.events.emit('enemy:shockwave', {
          enemy: e,
          at: e.transform.position.clone(),
          radius: 9,
          damage: 3,
        });
        enter(world, e, 'recover', phase === 3 ? 0.7 : 1.4);
      }
      return;

    case 'volley_wind':
      brake(e, 0.8);
      if (f.timer <= 0) {
        // A ring of bolts: the phase-2 idea is space denial, not pursuit.
        const spokes = phase === 3 ? 10 : 7;
        for (let i = 0; i < spokes; i++) {
          const a = (i / spokes) * Math.PI * 2;
          tmp.set(Math.cos(a), 0, Math.sin(a));
          fire(world, e, null, tmp.clone());
        }
        enter(world, e, 'recover', 1.1);
      }
      return;

    case 'recover':
      brake(e, 0.88);
      if (f.timer <= 0) enter(world, e, 'hunt', 0);
      return;

    default:
      if (!player) { brake(e); return; }
      steer(e, player.transform.position, speed, 4, dt);
      if (dist < 18 && Math.random() < 0.02) enter(world, e, 'slam_wind', 0.8, true);
      else if (phase >= 2 && Math.random() < 0.012) enter(world, e, 'volley_wind', 0.6, true);
  }
}

const BRAINS = { tracker, stalker, tank, turret, boss };

function facing(e, player) {
  return Math.atan2(
    player.transform.position.x - e.transform.position.x,
    player.transform.position.z - e.transform.position.z,
  );
}

/** Spawns a bolt. `at` aims at a point; `along` fires down a fixed direction. */
function fire(world, e, at, along = null) {
  const spawnPrefab = world.state.spawn;
  if (!spawnPrefab) return;

  const direction = along ?? new THREE.Vector3()
    .subVectors(at ?? e.transform.position, e.transform.position)
    .setY(0);
  if (direction.lengthSq() === 0) direction.set(0, 0, -1);
  direction.normalize();

  const origin = e.transform.position.clone().addScaledVector(direction, (e.body?.radius ?? 0.8) + 0.5);
  origin.y += 0.2;

  spawnPrefab(world, 'projectile', { position: origin, direction, speed: 17, damage: 1 });
  world.events.emit('enemy:fired', { enemy: e, at: origin.clone() });
}

/* -------------------------------------------------------------------------- */
/* Interceptor                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * INTERCEPTOR — hovers still, locks on, then crosses the arena in a straight
 * line. Trivially dodged once read, lethal when ignored.
 *
 * This system used to query for a `body` component the Interceptor prefab never
 * declared, so it matched nothing and every Interceptor in the game stood
 * motionless. Fixed in the prefab (REQ-024.25); the query is unchanged.
 */
export function interceptorSystem() {
  const heading = new THREE.Vector3();

  return {
    name: 'interceptor',

    update(world, dt) {
      if (world.state.status !== 'playing') return;

      const player = world.first('player');
      for (const e of world.find('interceptor', 'transform', 'body', 'fsm')) {
        if (e.enemy?.stun > 0) {
          e.enemy.stun -= dt;
          brake(e, 0.9);
          continue;
        }

        const f = e.fsm;
        const speed = e.interceptor?.speed ?? 21;
        const dist = player ? e.transform.position.distanceTo(player.transform.position) : Infinity;
        f.timer -= dt;

        if (f.state === 'aiming') {
          brake(e, 0.85);
          if (player) {
            heading.subVectors(player.transform.position, e.transform.position).setY(0).normalize();
            e.transform.yaw = Math.atan2(heading.x, heading.z);
            f.aim.copy(heading);
          }
          if (f.timer <= 0) enter(world, e, 'dashing', 0.55);
        } else if (f.state === 'dashing') {
          e.body.velocity.x = f.aim.x * speed;
          e.body.velocity.z = f.aim.z * speed;
          if (f.timer <= 0) enter(world, e, 'idle', 1.6);
        } else {
          brake(e, 0.9);
          if (player && dist < 20 && f.timer <= 0) enter(world, e, 'aiming', 0.55, true);
        }

        // Interceptors hover; hold the altitude they were placed at.
        const wanted = e.interceptor?.hover ?? e.transform.position.y;
        e.body.velocity.y += (wanted - e.transform.position.y) * 6 * dt;
        e.body.velocity.y *= 0.9;
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Escort drone                                                                */
/* -------------------------------------------------------------------------- */

/**
 * DRON DE ESCOLTA — the one thing on Lúmen's side. Follows, and periodically
 * knocks the nearest Sombra away.
 *
 * Same regression as the Interceptor: the prefab declared no `body`, so this
 * system never matched a single entity (REQ-024.25).
 */
export function droneSystem() {
  const to = new THREE.Vector3();

  return {
    name: 'drone',

    update(world, dt) {
      if (world.state.status !== 'playing') return;

      const player = world.first('player');
      if (!player) return;

      // Query by component, not by tag. `find('drone', …)` looked for a
      // component named `drone` that the prefab never declared — the second half
      // of the same regression as the missing `body` (REQ-024.25).
      for (const d of world.find('ally', 'transform', 'body')) {
        const ally = d.ally;
        to.subVectors(player.transform.position, d.transform.position).setY(0);
        const dist = to.length();

        if (dist > ally.followDist) {
          to.normalize();
          d.body.velocity.x += to.x * 22 * dt;
          d.body.velocity.z += to.z * 22 * dt;
          d.transform.yaw = Math.atan2(to.x, to.z);
        } else {
          brake(d, 0.94);
        }

        const wanted = player.transform.position.y + (ally.hover ?? 2.2);
        d.body.velocity.y += (wanted - d.transform.position.y) * 5 * dt;
        d.body.velocity.y *= 0.9;

        ally.fireTimer = (ally.fireTimer ?? 0) - dt;
        if (ally.fireTimer > 0) continue;

        let nearest = null;
        let best = 15;
        for (const enemy of world.find('enemy', 'transform')) {
          const distance = d.transform.position.distanceTo(enemy.transform.position);
          if (distance < best) { best = distance; nearest = enemy; }
        }
        if (!nearest) continue;

        world.events.emit('particles:burst', {
          pos: nearest.transform.position.clone(),
          color: 0x00ffff,
          count: 10,
        });
        world.events.emit('enemy:hit', {
          enemy: nearest,
          amount: 0,                       // the drone staggers, it does not kill
          from: d.transform.position.clone(),
        });
        ally.fireTimer = 2.2;
      }
    },
  };
}
