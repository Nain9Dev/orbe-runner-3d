import * as THREE from 'three';
import { CONFIG } from '../config.js';

const move = new THREE.Vector3();

/**
 * Lúmen's control loop: intent in, velocity out.
 *
 * The whole point of this system is that the avatar does what the hand asked,
 * on the frame the hand asked it. Three mechanisms carry that weight:
 *
 *  - **Jump buffering** (REQ-024.08). A jump pressed slightly too early is
 *    remembered for `jumpBuffer` seconds and fired on the landing frame, instead
 *    of being swallowed. Players read a swallowed input as the game ignoring
 *    them; they never read a buffered one as generosity.
 *  - **Variable height** (REQ-024.09). Releasing the key on the way up cuts the
 *    rise, so the same button covers a hop and a full leap.
 *  - **Coyote time in seconds** (REQ-024.10). The previous implementation counted
 *    down in frames, which made the grace window twice as forgiving at 30 FPS as
 *    at 60 — the game was literally easier on a slower machine.
 *
 * The Impulso (dash) is deliberately a small state machine rather than an
 * instantaneous impulse: it owns the velocity while it runs, which is what makes
 * it feel like a decision instead of a nudge (REQ-024.11 … REQ-024.13).
 */
export function playerSystem(input) {
  let wasGrounded = true;
  let wasJumpDown = false;
  const dashDir = new THREE.Vector3();

  return {
    name: 'player',

    update(world, dt) {
      const e = world.first('player');
      if (!e || world.state.status !== 'playing') return;

      const { body, transform } = e;
      const p = e.player;
      const tuning = CONFIG.player.dash;

      ensureState(p);

      if (p.invulnerable > 0) p.invulnerable -= dt;

      /* ------------------------------- input ------------------------------ */

      let ix = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      let iz = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);

      // The analogue stick wins when it is meaningfully deflected, so a player
      // on a phone gets proportional speed instead of digital all-or-nothing.
      if (Math.abs(input.joystick.x) > 0.05 || Math.abs(input.joystick.y) > 0.05) {
        ix = input.joystick.x;
        iz = -input.joystick.y;
      }

      const yaw = world.state.cameraYaw ?? 0;
      const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };

      move.set(forward.x * iz + right.x * ix, 0, forward.z * iz + right.z * ix);
      const moveLenSq = move.lengthSq();

      const combo = world.state.combo || 0;
      const resonance = 1 + Math.min(combo * 0.05, 0.3);   // Resonancia: up to +30 %
      const targetSpeed = CONFIG.player.speed * resonance;

      if (moveLenSq > 0) {
        const intensity = Math.min(Math.sqrt(moveLenSq), 1);
        move.normalize().multiplyScalar(targetSpeed * intensity);
        transform.yaw = Math.atan2(move.x, move.z);
      }

      /* ------------------------------- dash ------------------------------- */

      const jumpDown = input.down('Space');
      const jumpPressed = jumpDown && !wasJumpDown;
      wasJumpDown = jumpDown;

      // The buffer is maintained before the dash branch so a jump pressed during
      // an Impulso still fires the moment the Impulso releases the velocity.
      p.jumpBuffer = jumpPressed ? CONFIG.player.jumpBuffer : Math.max(0, p.jumpBuffer - dt);

      const dashDown = input.down('ShiftLeft', 'ShiftRight');
      const dashPressed = dashDown && !p.dash.held;
      p.dash.held = dashDown;

      if (p.dash.time > 0) {
        // An active Impulso owns the velocity outright. Letting friction and
        // gravity nibble at it is what made the old dash feel like a stumble.
        p.dash.time -= dt;
        body.velocity.x = p.dash.dir.x * tuning.speed;
        body.velocity.z = p.dash.dir.z * tuning.speed;
        body.velocity.y = Math.max(body.velocity.y, 0);
        body.noGravity = true;
        p.invulnerable = Math.max(p.invulnerable, p.dash.time);

        if (p.dash.time <= 0) endDash(p, body, targetSpeed);
        publish(world, p, e);
        wasGrounded = body.grounded;
        return;
      }

      if (p.dash.cooldown > 0) p.dash.cooldown -= dt;

      if (body.grounded) p.dash.airLeft = tuning.airDashes;

      const canDash = p.dash.cooldown <= 0 && (body.grounded || p.dash.airLeft > 0);
      if (dashPressed && canDash) {
        // Direction comes from the *input*, not from the model's facing.
        // `transform.yaw` only moves while there is movement input, so a standing
        // dash used to fire wherever the avatar happened to stop turning.
        if (moveLenSq > 0) {
          dashDir.copy(move).setY(0).normalize();
        } else {
          dashDir.set(forward.x, 0, forward.z).normalize();
        }

        p.dash.dir.copy(dashDir);
        p.dash.time = tuning.time;
        body.damped = true;
        if (!body.grounded) p.dash.airLeft -= 1;

        transform.yaw = Math.atan2(dashDir.x, dashDir.z);
        body.velocity.x = dashDir.x * tuning.speed;
        body.velocity.z = dashDir.z * tuning.speed;
        body.velocity.y = Math.max(body.velocity.y, tuning.lift);
        body.noGravity = true;
        body.grounded = false;
        p.invulnerable = Math.max(p.invulnerable, tuning.time);

        world.events.emit('player:dash', e);
        publish(world, p, e);
        wasGrounded = false;
        return;
      }

      /* ---------------------------- locomotion ---------------------------- */

      const friction = body.friction ?? 12;
      const accel = body.grounded ? friction : friction * CONFIG.player.airControl;

      if (moveLenSq > 0) {
        /*
         * Exponential approach to the target velocity, and the controller takes
         * ownership of horizontal damping for the frame.
         *
         * The previous scheme added a fixed impulse here and let the physics
         * friction pull back afterwards. Those two settle at
         * `speed · (1-k) / k · k` — 11.2 u/s for a configured 14 — so
         * `CONFIG.player.speed` was off by a quarter, and every derived number
         * (the jump reach in `src/domain/jump-arc.ts`, and therefore every gap
         * the composer sizes) inherited the error. A tuning constant that does
         * not mean what it says is worse than no constant at all.
         */
        const k = 1 - Math.exp(-accel * dt);
        body.velocity.x += (move.x - body.velocity.x) * k;
        body.velocity.z += (move.z - body.velocity.z) * k;
        body.damped = true;

        // Under player control the ceiling is the target speed plus the Impulso
        // carry allowance, so a dash still buys a moment of extra ground speed
        // instead of being cut off the frame it ends (REQ-024.15).
        clampHorizontal(body, targetSpeed * DASH_CARRY);
      } else {
        // No input: friction owns the decay, so a shockwave throw and a bounce
        // pad both keep the momentum they were given.
        body.damped = false;
      }

      /* ------------------------------ jumping ----------------------------- */

      if (body.grounded && !wasGrounded) {
        world.events.emit('player:landed', e);
        p.dash.airLeft = tuning.airDashes;
      }
      wasGrounded = body.grounded;

      p.coyote = body.grounded ? CONFIG.player.coyoteTime : Math.max(0, p.coyote - dt);

      if (p.jumpBuffer > 0 && p.coyote > 0) {
        const boosted = p.buff?.type === 'jump';
        body.velocity.y = CONFIG.player.jump * (boosted ? 1.5 : 1);
        body.grounded = false;
        body.contact = false;
        body.groundTimer = Infinity;
        p.coyote = 0;
        p.jumpBuffer = 0;
        p.rising = true;
        world.events.emit('player:jump', e);
      }

      // Variable height: the rise is cut the moment the key comes up, but never
      // on the way down, where a cut would read as a random stall.
      if (p.rising) {
        if (body.velocity.y <= 0) {
          p.rising = false;
        } else if (!jumpDown) {
          body.velocity.y *= CONFIG.player.jumpCutFactor;
          p.rising = false;
        }
      }

      publish(world, p, e);
    },
  };
}

/* -------------------------------------------------------------------------- */

/** Backfills the fields older saves and older prefabs may not carry. */
function ensureState(p) {
  if (!p.dash) {
    p.dash = { time: 0, cooldown: 0, airLeft: CONFIG.player.dash.airDashes, dir: new THREE.Vector3(), held: false };
  }
  if (!p.dash.dir) p.dash.dir = new THREE.Vector3();
  if (p.coyote === undefined || p.coyote > 1) p.coyote = 0;   // legacy frame counter
  if (p.jumpBuffer === undefined) p.jumpBuffer = 0;
  if (p.invulnerable === undefined) p.invulnerable = 0;
}

/**
 * How much faster than the target speed Lúmen may travel on the tail of an
 * Impulso. It is the same number in both places on purpose: the dash bleeds down
 * to it, and player control is allowed up to it.
 */
const DASH_CARRY = 1.15;

function endDash(p, body, targetSpeed) {
  p.dash.time = 0;
  p.dash.cooldown = CONFIG.player.dash.cooldown;
  body.noGravity = false;
  // Bleed out of the dash rather than stopping dead: keeping a chunk of the
  // speed is what lets a dash chain into a long jump.
  clampHorizontal(body, targetSpeed * DASH_CARRY);
}

function clampHorizontal(body, limit) {
  const sq = body.velocity.x * body.velocity.x + body.velocity.z * body.velocity.z;
  if (sq <= limit * limit) return;
  const speed = Math.sqrt(sq);
  body.velocity.x = (body.velocity.x / speed) * limit;
  body.velocity.z = (body.velocity.z / speed) * limit;
}

/** Publishes what the HUD needs so the presentation layer never inspects entities. */
function publish(world, p, entity) {
  const tuning = CONFIG.player.dash;
  if (p.dash.time > 0) {
    world.state.dashRatio = 0;
  } else if (p.dash.cooldown > 0) {
    world.state.dashRatio = 1 - p.dash.cooldown / tuning.cooldown;
  } else {
    world.state.dashRatio = 1;
  }
  world.state.dashing = p.dash.time > 0;
  world.state.airDashes = p.dash.airLeft;
  world.state.invulnerable = p.invulnerable > 0;
  world.state.playerSpeed = Math.hypot(entity.body.velocity.x, entity.body.velocity.z);
}
