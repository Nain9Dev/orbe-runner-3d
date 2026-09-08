import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/core/world.js';
import { playerSystem } from '../src/systems/player.js';
import { CONFIG } from '../src/config.js';

function makeInput() {
  return {
    keys: new Set<string>(),
    virtualKeys: new Set<string>(),
    joystick: { x: 0, y: 0 },
    down(...codes: string[]) {
      return codes.some((code) => this.keys.has(code) || this.virtualKeys.has(code));
    },
  };
}

describe('Player System — Movement & Air Control', () => {
  let world: World;
  let input: ReturnType<typeof makeInput>;

  function spawnPlayer(over: Record<string, any> = {}) {
    return world.spawn({
      tag: 'player',
      transform: { position: new THREE.Vector3(0, 5, 0), yaw: 0 },
      body: {
        velocity: new THREE.Vector3(),
        radius: 0.6,
        grounded: false,
        mass: 1,
        friction: 12,
        drag: 1,
        ...(over.body ?? {}),
      },
      player: { lives: 3, invulnerable: 0, coyote: 0, ...(over.player ?? {}) },
    });
  }

  beforeEach(() => {
    world = new World();
    world.state.status = 'playing';
    world.state.cameraYaw = 0;   // forward is -Z
    input = makeInput();
    world.addSystem(playerSystem(input));
  });

  it('should accelerate forward in the air when pressing W', () => {
    const player = spawnPlayer();
    input.keys.add('KeyW');

    for (let i = 0; i < 18; i++) world.update(1 / 60);

    expect(player.body.velocity.z).toBeLessThan(-7);
  });

  it('should allow jumping while pressing W and preserve forward momentum', () => {
    const player = spawnPlayer({
      body: { velocity: new THREE.Vector3(0, 0, -10), grounded: true },
    });

    input.keys.add('KeyW');
    input.keys.add('Space');
    world.update(1 / 60);

    expect(player.body.velocity.y).toBe(CONFIG.player.jump);
    expect(player.body.velocity.z).toBeLessThanOrEqual(-10);
  });

  /* ------------------------------ Spec 024 -------------------------------- */

  it('buffers a jump pressed before landing and fires it on contact — REQ-024.08', () => {
    const player = spawnPlayer();

    // Airborne, no coyote left: the press must not be swallowed.
    input.keys.add('Space');
    world.update(1 / 60);
    expect(player.body.velocity.y).toBeLessThanOrEqual(0);
    expect(player.player.jumpBuffer).toBeGreaterThan(0);

    // Ground arrives two frames later, still inside the buffer window.
    world.update(1 / 60);
    player.body.grounded = true;
    world.update(1 / 60);

    expect(player.body.velocity.y).toBe(CONFIG.player.jump);
  });

  it('expires the buffer once the window passes — REQ-024.08', () => {
    const player = spawnPlayer();

    input.keys.add('Space');
    world.update(1 / 60);
    input.keys.delete('Space');

    for (let i = 0; i < 30; i++) world.update(1 / 60);   // 0.5 s > jumpBuffer
    player.body.grounded = true;
    world.update(1 / 60);

    expect(player.body.velocity.y).not.toBe(CONFIG.player.jump);
  });

  it('cuts the rise when the jump key is released early — REQ-024.09', () => {
    const player = spawnPlayer({ body: { grounded: true } });

    input.keys.add('Space');
    world.update(1 / 60);
    const full = player.body.velocity.y;
    expect(full).toBe(CONFIG.player.jump);

    input.keys.delete('Space');
    world.update(1 / 60);

    expect(player.body.velocity.y).toBeLessThan(full * 0.6);
  });

  it('does not cut the rise while the key is held — REQ-024.09', () => {
    const player = spawnPlayer({ body: { grounded: true } });

    input.keys.add('Space');
    world.update(1 / 60);
    world.update(1 / 60);

    // Only the player system runs here, so nothing but a cut could reduce it.
    expect(player.body.velocity.y).toBe(CONFIG.player.jump);
  });

  it('measures coyote time in seconds, not frames — REQ-024.10', () => {
    const player = spawnPlayer({ body: { grounded: true } });

    world.update(1 / 60);
    expect(player.player.coyote).toBeCloseTo(CONFIG.player.coyoteTime, 5);

    player.body.grounded = false;
    world.update(0.05);
    expect(player.player.coyote).toBeCloseTo(CONFIG.player.coyoteTime - 0.05, 5);

    // A jump inside the window still works after leaving the ledge.
    input.keys.add('Space');
    world.update(1 / 60);
    expect(player.body.velocity.y).toBe(CONFIG.player.jump);
  });

  it('refuses a jump once coyote time has elapsed — REQ-024.10', () => {
    const player = spawnPlayer({ body: { grounded: true } });
    world.update(1 / 60);
    player.body.grounded = false;

    world.update(CONFIG.player.coyoteTime + 0.05);
    input.keys.add('Space');
    world.update(1 / 60);

    expect(player.body.velocity.y).not.toBe(CONFIG.player.jump);
  });

  it('dashes along the input direction, not the model facing — REQ-024.11', () => {
    const player = spawnPlayer({ body: { grounded: true } });
    // The model is facing +Z; the hand is pushing left.
    player.transform.yaw = 0;

    input.keys.add('KeyA');
    input.keys.add('ShiftLeft');
    world.update(1 / 60);

    expect(player.body.velocity.x).toBeCloseTo(-CONFIG.player.dash.speed, 1);
    expect(Math.abs(player.body.velocity.z)).toBeLessThan(1);
  });

  it('dashes along camera forward when there is no movement input — REQ-024.11', () => {
    const player = spawnPlayer({ body: { grounded: true } });

    input.keys.add('ShiftLeft');
    world.update(1 / 60);

    expect(player.body.velocity.z).toBeCloseTo(-CONFIG.player.dash.speed, 1);
  });

  it('suspends gravity and grants invulnerability while dashing — REQ-024.12', () => {
    const player = spawnPlayer({ body: { grounded: true } });

    input.keys.add('KeyW');
    input.keys.add('ShiftLeft');
    world.update(1 / 60);

    expect(player.body.noGravity).toBe(true);
    expect(player.player.invulnerable).toBeGreaterThan(0);

    for (let i = 0; i < 20; i++) world.update(1 / 60);   // past dash.time

    expect(player.body.noGravity).toBe(false);
    expect(player.player.dash.cooldown).toBeGreaterThan(0);
  });

  it('allows one air dash and refuses the second until landing — REQ-024.13', () => {
    const player = spawnPlayer();   // airborne

    input.keys.add('KeyW');
    input.keys.add('ShiftLeft');
    world.update(1 / 60);
    expect(player.player.dash.time).toBeGreaterThan(0);
    expect(player.player.dash.airLeft).toBe(CONFIG.player.dash.airDashes - 1);

    // Wait out the dash and its cooldown, still airborne.
    input.keys.delete('ShiftLeft');
    for (let i = 0; i < 90; i++) world.update(1 / 60);
    expect(player.player.dash.cooldown).toBeLessThanOrEqual(0);

    input.keys.add('ShiftLeft');
    world.update(1 / 60);
    expect(player.player.dash.time).toBeLessThanOrEqual(0);   // refused

    // Landing restores the budget.
    input.keys.delete('ShiftLeft');
    player.body.grounded = true;
    world.update(1 / 60);
    input.keys.add('ShiftLeft');
    world.update(1 / 60);
    expect(player.player.dash.time).toBeGreaterThan(0);
  });

  it('ignores a held dash key as a repeat input — E-03', () => {
    const player = spawnPlayer({ body: { grounded: true } });

    input.keys.add('KeyW');
    input.keys.add('ShiftLeft');
    world.update(1 / 60);
    const first = player.player.dash.time;

    // Key stays down for the whole dash; no second dash may queue.
    for (let i = 0; i < 60; i++) world.update(1 / 60);

    expect(first).toBeGreaterThan(0);
    expect(player.player.dash.time).toBeLessThanOrEqual(0);
    expect(player.player.dash.cooldown).toBeGreaterThan(0);
  });

  it('caps horizontal speed on the ground as well as in the air — REQ-024.15', () => {
    const player = spawnPlayer({
      body: { grounded: true, velocity: new THREE.Vector3(0, 0, -50), friction: 0 },
    });

    input.keys.add('KeyW');
    world.update(1 / 60);

    const speed = Math.hypot(player.body.velocity.x, player.body.velocity.z);
    expect(speed).toBeLessThanOrEqual(CONFIG.player.speed * 1.15 + 1e-9);
  });

  it('raises the speed cap with the Resonancia multiplier — REQ-024.15', () => {
    world.state.combo = 10;   // beyond the +30 % clamp
    const player = spawnPlayer({ body: { grounded: true } });

    input.keys.add('KeyW');
    for (let i = 0; i < 120; i++) world.update(1 / 60);

    const speed = Math.hypot(player.body.velocity.x, player.body.velocity.z);
    // Converges to the Resonancia-boosted target, not to the bare base speed.
    expect(speed).toBeGreaterThan(CONFIG.player.speed * 1.25);
    expect(speed).toBeLessThanOrEqual(CONFIG.player.speed * 1.3 * 1.15 + 1e-9);
  });

  it('publishes dash readiness for the HUD — REQ-024.36', () => {
    const player = spawnPlayer({ body: { grounded: true } });

    world.update(1 / 60);
    expect(world.state.dashRatio).toBe(1);

    input.keys.add('KeyW');
    input.keys.add('ShiftLeft');
    world.update(1 / 60);
    expect(world.state.dashRatio).toBe(0);
    expect(world.state.dashing).toBe(true);

    input.keys.delete('ShiftLeft');
    for (let i = 0; i < 20; i++) world.update(1 / 60);
    expect(world.state.dashRatio).toBeGreaterThan(0);
    expect(world.state.dashRatio).toBeLessThan(1);
    expect(player.player.dash.time).toBeLessThanOrEqual(0);
  });

  it('does nothing while the game is not playing', () => {
    const player = spawnPlayer({ body: { grounded: true } });
    world.state.status = 'paused';

    input.keys.add('KeyW');
    input.keys.add('Space');
    world.update(1 / 60);

    expect(player.body.velocity.lengthSq()).toBe(0);
  });
});
