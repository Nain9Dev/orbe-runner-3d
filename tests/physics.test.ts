import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/core/world.js';
import { physicsSystem } from '../src/systems/physics.js';
import { CONFIG } from '../src/config.js';

// Three.js touches the DOM for its canvas textures; the physics system does not,
// but the shared module graph does. A stub keeps the suite headless.
global.document = {
  createElement: () => ({
    getContext: () => ({ createRadialGradient: () => ({ addColorStop: () => {} }), fillStyle: '', fillRect: () => {} })
  })
} as any;

const body = (over: Record<string, unknown> = {}) => ({
  velocity: new THREE.Vector3(),
  radius: 0.6,
  mass: 1,
  grounded: false,
  bounciness: 0,
  friction: 12,
  drag: 1,
  ...over,
});

describe('Physics System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.addSystem(physicsSystem());
  });

  it('should apply gravity to bodies', () => {
    const entity = world.spawn({
      transform: { position: new THREE.Vector3(0, 10, 0), yaw: 0 },
      body: body({ friction: 0 }),
    });

    world.update(1.0);

    expect(entity.body.velocity.y).toBeLessThan(0);
    expect(entity.transform.position.y).toBeLessThan(10);
  });

  it('should resolve sphere-box collisions and set grounded', () => {
    world.spawn({
      tag: 'ground',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(40, 1, 40) },
    });

    const player = world.spawn({
      transform: { position: new THREE.Vector3(0, 2, 0), yaw: 0 },
      body: body(),
    });

    for (let i = 0; i < 120; i++) world.update(1 / 60);

    expect(player.transform.position.y).toBeCloseTo(0.6, 1);
    expect(player.body.grounded).toBe(true);
  });

  it('should bounce according to bounciness', () => {
    world.spawn({
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(40, 1, 40) },
      bounce: { force: 15 },
    });

    const player = world.spawn({
      transform: { position: new THREE.Vector3(0, 5, 0), yaw: 0 },
      body: body(),
    });

    let maxVelocity = 0;
    for (let i = 0; i < 120; i++) {
      world.update(1 / 60);
      if (player.body.velocity.y > maxVelocity) maxVelocity = player.body.velocity.y;
    }

    expect(maxVelocity).toBe(15);
  });

  it('should not clamp player movement at z < -20 when advancing along the runner track', () => {
    const player = world.spawn({
      tag: 'player',
      transform: { position: new THREE.Vector3(0, 2, -18), yaw: 0 },
      body: body({ velocity: new THREE.Vector3(0, 0, -14), drag: 0 }),
    });

    world.update(1.0);

    expect(player.transform.position.z).toBeLessThan(-25);
  });

  /* --------------------------- Spec 024 additions -------------------------- */

  it('sub-steps fast bodies so they cannot tunnel through a thin wall — REQ-024.01', () => {
    // A 1 unit thick wall; at 40 u/s a single 1/60 step would carry the body
    // 0.67 units, enough to end up on the far side with the old integrator.
    world.spawn({
      tag: 'wall',
      transform: { position: new THREE.Vector3(0, 1.5, -10), yaw: 0 },
      solid: { size: new THREE.Vector3(20, 3, 1) },
    });

    const runner = world.spawn({
      transform: { position: new THREE.Vector3(0, 1.5, -8), yaw: 0 },
      body: body({ velocity: new THREE.Vector3(0, 0, -40), drag: 0, friction: 0 }),
    });

    for (let i = 0; i < 20; i++) world.update(1 / 60);

    // Stopped on the near side of the wall (wall face at z = -9.5, plus radius).
    expect(runner.transform.position.z).toBeGreaterThan(-9.5);
  });

  it('applies the moving-platform carry exactly once per frame — REQ-024.02', () => {
    const speed = 1.0;
    const range = 4;
    const platform = world.spawn({
      tag: 'platform',
      transform: { position: new THREE.Vector3(0, 0, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(10, 1, 10) },
      moving: { axis: 'x', range, speed, origin: new THREE.Vector3(0, 0, 0), t: 0, dx: 0, dz: 0 },
    });

    const rider = world.spawn({
      transform: { position: new THREE.Vector3(0, 1.1, 0), yaw: 0 },
      body: body({ friction: 0, drag: 0 }),
    });

    // Settle the rider onto the platform first.
    for (let i = 0; i < 30; i++) world.update(1 / 60);

    const riderBefore = rider.transform.position.x;
    const platformBefore = platform.transform.position.x;
    world.update(1 / 60);
    const platformDelta = platform.transform.position.x - platformBefore;
    const riderDelta = rider.transform.position.x - riderBefore;

    expect(Math.abs(platformDelta)).toBeGreaterThan(0);
    // The solver runs three iterations; before the fix the rider moved 3x.
    expect(riderDelta).toBeCloseTo(platformDelta, 3);
  });

  it('never bounces a resting body off a flat floor — REQ-024.04', () => {
    world.spawn({
      tag: 'ground',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(40, 1, 40) },
    });

    const ball = world.spawn({
      transform: { position: new THREE.Vector3(0, 6, 0), yaw: 0 },
      // A generous bounciness that used to make the player jitter on the floor.
      body: body({ bounciness: 0.6 }),
    });

    for (let i = 0; i < 240; i++) world.update(1 / 60);

    expect(Math.abs(ball.body.velocity.y)).toBeLessThan(0.01);
    expect(ball.transform.position.y).toBeCloseTo(0.6, 1);
  });

  it('preserves tangential velocity when sliding along a wall — REQ-024.05', () => {
    world.spawn({
      tag: 'wall',
      transform: { position: new THREE.Vector3(2, 2, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(1, 4, 40) },
    });

    const slider = world.spawn({
      transform: { position: new THREE.Vector3(1.2, 2, 0), yaw: 0 },
      // Pushing into the wall (+X) while running along it (-Z).
      body: body({ velocity: new THREE.Vector3(6, 0, -10), drag: 0, friction: 0 }),
    });

    world.update(1 / 60);

    expect(slider.body.velocity.x).toBeLessThanOrEqual(0.001);   // normal killed
    expect(slider.body.velocity.z).toBeCloseTo(-10, 3);          // tangent kept
  });

  it('publishes the contact normal of the surface underfoot — REQ-024.03', () => {
    world.spawn({
      tag: 'ground',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(40, 1, 40) },
    });

    const e = world.spawn({
      transform: { position: new THREE.Vector3(0, 1, 0), yaw: 0 },
      body: body(),
    });

    for (let i = 0; i < 60; i++) world.update(1 / 60);

    expect(e.body.groundNormal).toBeDefined();
    expect(e.body.groundNormal.y).toBeGreaterThan(0.9);
  });

  it('holds grounded briefly across a seam instead of flickering — REQ-024.06', () => {
    const e = world.spawn({
      transform: { position: new THREE.Vector3(0, 5, 0), yaw: 0 },
      body: body({ grounded: true, contact: true, groundTimer: 0 }),
    });

    // No solid under it: contact is lost immediately, but the grace window holds.
    world.update(1 / 60);
    expect(e.body.grounded).toBe(true);

    for (let i = 0; i < 12; i++) world.update(1 / 60);
    expect(e.body.grounded).toBe(false);
    expect(CONFIG.physics.groundStickTime).toBeGreaterThan(0);
  });

  it('drops the grounded grace immediately when the body leaps — REQ-024.06', () => {
    const e = world.spawn({
      transform: { position: new THREE.Vector3(0, 5, 0), yaw: 0 },
      body: body({ grounded: true, contact: true, groundTimer: 0, velocity: new THREE.Vector3(0, 12.5, 0) }),
    });

    world.update(1 / 60);

    expect(e.body.grounded).toBe(false);
  });

  it('falls faster than it rises — REQ-024.07', () => {
    const rising = world.spawn({
      transform: { position: new THREE.Vector3(0, 20, 0), yaw: 0 },
      body: body({ velocity: new THREE.Vector3(0, 10, 0) }),
    });
    const falling = world.spawn({
      transform: { position: new THREE.Vector3(5, 20, 0), yaw: 0 },
      body: body({ velocity: new THREE.Vector3(0, -10, 0) }),
    });

    const riseBefore = rising.body.velocity.y;
    const fallBefore = falling.body.velocity.y;
    world.update(1 / 60);

    const riseDelta = Math.abs(rising.body.velocity.y - riseBefore);
    const fallDelta = Math.abs(falling.body.velocity.y - fallBefore);
    expect(fallDelta).toBeGreaterThan(riseDelta);
  });

  it('hangs at the apex with reduced gravity — REQ-024.07', () => {
    const apex = world.spawn({
      transform: { position: new THREE.Vector3(0, 20, 0), yaw: 0 },
      body: body({ velocity: new THREE.Vector3(0, 0.5, 0) }),
    });
    const cruising = world.spawn({
      transform: { position: new THREE.Vector3(5, 20, 0), yaw: 0 },
      body: body({ velocity: new THREE.Vector3(0, 10, 0) }),
    });

    const apexBefore = apex.body.velocity.y;
    const cruiseBefore = cruising.body.velocity.y;
    world.update(1 / 60);

    expect(Math.abs(apex.body.velocity.y - apexBefore))
      .toBeLessThan(Math.abs(cruising.body.velocity.y - cruiseBefore));
  });

  it('suspends gravity while a dash owns the body', () => {
    const dashing = world.spawn({
      transform: { position: new THREE.Vector3(0, 5, 0), yaw: 0 },
      body: body({ noGravity: true }),
    });

    world.update(1 / 60);

    expect(dashing.body.velocity.y).toBe(0);
  });

  it('collapses a crumbling platform after its timer and announces it', () => {
    let collapsed = 0;
    world.events.on('platform:collapsed', () => { collapsed++; });

    const tile = world.spawn({
      tag: 'crumbling_platform',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(10, 1, 10) },
      crumbling: { state: 'idle', timer: 0.5, duration: 0.5, respawn: 2.5 },
    });

    world.spawn({
      transform: { position: new THREE.Vector3(0, 1, 0), yaw: 0 },
      body: body(),
    });

    for (let i = 0; i < 60; i++) world.update(1 / 60);

    expect(collapsed).toBe(1);
    expect(tile.crumbling.state).toBe('gone');
  });

  it('stops being a surface while it is gone, and falls through', () => {
    world.spawn({
      tag: 'crumbling_platform',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(10, 1, 10) },
      crumbling: { state: 'gone', timer: 2.5, duration: 1.5, respawn: 2.5 },
    });

    const faller = world.spawn({
      transform: { position: new THREE.Vector3(0, 1, 0), yaw: 0 },
      body: body(),
    });

    for (let i = 0; i < 30; i++) world.update(1 / 60);

    expect(faller.transform.position.y).toBeLessThan(0);
    expect(faller.body.grounded).toBe(false);
  });

  /**
   * The regression this test exists for: destroying the tile outright made the
   * Sendero Efímero a one-way door. Cross it, miss the next jump, respawn at the
   * Baliza behind it — and the route no longer existed, so the Ciclo could not be
   * finished at all.
   */
  it('reforms after its respawn delay so a Ciclo stays finishable', () => {
    let restored = 0;
    world.events.on('platform:restored', () => { restored++; });

    const tile = world.spawn({
      tag: 'crumbling_platform',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(10, 1, 10) },
      crumbling: { state: 'gone', timer: 0.5, duration: 1.5, respawn: 2.5 },
    });

    for (let i = 0; i < 60; i++) world.update(1 / 60);

    expect(restored).toBe(1);
    expect(tile.crumbling.state).toBe('idle');
    expect(tile.crumbling.timer).toBe(1.5);
  });

  it('waits rather than reforming around a body standing in the hole', () => {
    const tile = world.spawn({
      tag: 'crumbling_platform',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(10, 1, 10) },
      crumbling: { state: 'gone', timer: 0.1, duration: 1.5, respawn: 2.5 },
    });

    // A body sitting exactly where the tile would rematerialise.
    world.spawn({
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      body: body({ noGravity: true }),
    });

    for (let i = 0; i < 120; i++) world.update(1 / 60);

    expect(tile.crumbling.state).toBe('gone');
  });

  /**
   * The impact speed exists for exactly one frame. The audio layer scales the
   * landing sound by it, and without it a step off a kerb and a fall down a
   * Torre de Impulso are indistinguishable.
   */
  it('records the speed a landing cancelled — REQ-025.15', () => {
    world.spawn({
      tag: 'ground',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(40, 1, 40) },
    });

    const faller = world.spawn({
      transform: { position: new THREE.Vector3(0, 18, 0), yaw: 0 },
      body: body(),
    });

    let peak = 0;
    for (let i = 0; i < 180; i++) {
      world.update(1 / 60);
      peak = Math.max(peak, faller.body.impactSpeed ?? 0);
      if (faller.body.grounded) break;
    }

    expect(peak).toBeGreaterThan(10);
    expect(faller.body.grounded).toBe(true);
  });

  it('scales the recorded impact with the height of the fall', () => {
    const drop = (height: number) => {
      const w = new World();
      w.addSystem(physicsSystem());
      w.spawn({
        tag: 'ground',
        transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
        solid: { size: new THREE.Vector3(40, 1, 40) },
      });
      const e = w.spawn({
        transform: { position: new THREE.Vector3(0, height, 0), yaw: 0 },
        body: body(),
      });
      let peak = 0;
      for (let i = 0; i < 300; i++) {
        w.update(1 / 60);
        peak = Math.max(peak, e.body.impactSpeed ?? 0);
        if (e.body.grounded) break;
      }
      return peak;
    };

    expect(drop(20)).toBeGreaterThan(drop(3));
  });

  it('forgets the last landing once the body is airborne again', () => {
    const e = world.spawn({
      transform: { position: new THREE.Vector3(0, 30, 0), yaw: 0 },
      body: body({ impactSpeed: 14, grounded: true, contact: true, groundTimer: 0 }),
    });

    for (let i = 0; i < 20; i++) world.update(1 / 60);

    expect(e.body.grounded).toBe(false);
    expect(e.body.impactSpeed).toBe(0);
  });

  it('lets a projectile pass through a collapsed tile', () => {
    const tile = world.spawn({
      tag: 'crumbling_platform',
      transform: { position: new THREE.Vector3(0, 2, -5), yaw: 0 },
      solid: { size: new THREE.Vector3(10, 4, 1) },
      crumbling: { state: 'gone', timer: 5, duration: 1.5, respawn: 2.5 },
    });
    expect(tile.crumbling.state).toBe('gone');

    const runner = world.spawn({
      transform: { position: new THREE.Vector3(0, 2, -3), yaw: 0 },
      body: body({ velocity: new THREE.Vector3(0, 0, -14), drag: 0, friction: 0, noGravity: true }),
    });

    for (let i = 0; i < 60; i++) world.update(1 / 60);

    expect(runner.transform.position.z).toBeLessThan(-10);   // straight through
  });
});
