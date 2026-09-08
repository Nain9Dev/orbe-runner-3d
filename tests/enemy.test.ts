import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/core/world.js';
import { enemySystem, interceptorSystem, droneSystem } from '../src/systems/enemy.js';
import { projectileSystem } from '../src/systems/projectile.js';
import { shockwaveSystem } from '../src/systems/triggers.js';
import { CONFIG } from '../src/config.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function body(over: Record<string, unknown> = {}) {
  return {
    velocity: v(), radius: 0.7, grounded: true, mass: 1.2,
    bounciness: 0.1, friction: 10, drag: 2, ...over,
  };
}

function makeWorld() {
  const world = new World();
  world.state.status = 'playing';
  // The enemy systems reach for the prefab registry through this seam, so a
  // fake spawn keeps the whole suite free of Three.js model construction.
  const fired: any[] = [];
  world.state.spawn = (_w: any, name: string, opts: any) => {
    fired.push({ name, ...opts });
    return _w.spawn({
      tag: name,
      transform: { position: opts.position.clone(), yaw: 0 },
      projectile: { ttl: 3.4, damage: 1, speed: opts.speed ?? 17, dir: opts.direction.clone().normalize() },
      hazard: { radius: 0.42, damage: 1 },
    });
  };
  return { world, fired };
}

function spawnEnemy(world: World, type: string, position = v(0, 1, 0), over: Record<string, any> = {}) {
  return world.spawn({
    tag: 'enemy',
    transform: { position: position.clone(), yaw: 0 },
    body: body(over.body),
    enemy: {
      type, speed: 5, aggroRange: 24, home: position.clone(), hover: 0,
      leash: 34, fragile: true, integrity: 1, stun: 0,
      ...(over.enemy ?? {}),
    },
    fsm: { state: 'idle', timer: 0, phase: 1, aim: v() },
    hazard: { radius: 0.9, damage: 1 },
  });
}

function spawnPlayer(world: World, position = v(0, 1, -3)) {
  return world.spawn({
    tag: 'player',
    transform: { position: position.clone(), yaw: 0 },
    body: { velocity: v(), radius: 0.6, grounded: true, mass: 1, friction: 12, drag: 1 },
    player: { lives: 3, maxLives: 3, invulnerable: 0 },
  });
}

describe('Sombra state machines', () => {
  let world: World;
  let fired: any[];

  beforeEach(() => {
    ({ world, fired } = makeWorld());
    world.addSystem(enemySystem());
  });

  it('never telegraphs for less than the fairness floor — REQ-024.22', () => {
    const seen: any[] = [];
    world.events.on('enemy:telegraph', (e: any) => seen.push(e));

    for (const type of ['tracker', 'stalker', 'tank', 'turret']) {
      const w = makeWorld().world;
      w.addSystem(enemySystem());
      w.events.on('enemy:telegraph', (e: any) => seen.push(e));
      spawnPlayer(w, v(0, 1, -4));
      spawnEnemy(w, type, v(0, 1, 0), { enemy: { type, speed: 5 } });
      for (let i = 0; i < 240; i++) w.update(1 / 60);
    }

    expect(seen.length).toBeGreaterThan(0);
    for (const t of seen) {
      expect(t.duration, `${t.kind} telegraph`).toBeGreaterThanOrEqual(CONFIG.enemy.telegraphFloor);
    }
  });

  it('announces the telegraph so the presentation layer can render a tell — REQ-024.23', () => {
    const seen: any[] = [];
    world.events.on('enemy:telegraph', (e: any) => seen.push(e));

    spawnPlayer(world, v(0, 1, -4));
    spawnEnemy(world, 'tracker');
    for (let i = 0; i < 120; i++) world.update(1 / 60);

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toHaveProperty('enemy');
    expect(seen[0]).toHaveProperty('kind');
    expect(seen[0]).toHaveProperty('at');
  });

  it('chases the player when they are inside aggro range', () => {
    spawnPlayer(world, v(0, 1, -14));
    const e = spawnEnemy(world, 'tracker');

    for (let i = 0; i < 10; i++) world.update(1 / 60);

    expect(e.body.velocity.z).toBeLessThan(0);   // moving towards -Z
  });

  it('stays home when the player is out of range', () => {
    const e = spawnEnemy(world, 'tracker', v(0, 1, 0), { enemy: { type: 'tracker', speed: 5, aggroRange: 5 } });
    spawnPlayer(world, v(0, 1, -80));

    for (let i = 0; i < 60; i++) world.update(1 / 60);

    expect(e.transform.position.distanceTo(v(0, 1, 0))).toBeLessThan(12);
  });

  it('suppresses a stunned Sombra — REQ-024.28', () => {
    spawnPlayer(world, v(0, 1, -4));
    const e = spawnEnemy(world, 'tracker', v(0, 1, 0), { enemy: { type: 'tracker', speed: 5, integrity: 3 } });

    world.events.emit('enemy:hit', { enemy: e, amount: 1, from: v(0, 1, -4) });
    expect(e.enemy.stun).toBeCloseTo(CONFIG.enemy.stunTime, 5);

    e.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 6; i++) world.update(1 / 60);

    expect(Math.hypot(e.body.velocity.x, e.body.velocity.z)).toBeLessThan(0.5);
  });

  it('shatters a Sombra whose integrity reaches zero — REQ-024.14', () => {
    const shattered: any[] = [];
    world.events.on('enemy:shattered', (e: any) => shattered.push(e));

    const e = spawnEnemy(world, 'tracker');
    world.events.emit('enemy:hit', { enemy: e, amount: 1, from: v(0, 1, -2) });
    world.update(1 / 60);

    expect(shattered.length).toBe(1);
    expect(world.find('enemy').length).toBe(0);
  });

  it('survives a hit when it has integrity to spare', () => {
    const e = spawnEnemy(world, 'tank', v(0, 1, 0), { enemy: { type: 'tank', speed: 3, integrity: 3, fragile: false } });
    world.events.emit('enemy:hit', { enemy: e, amount: 1, from: v(0, 1, -2) });
    world.update(1 / 60);

    expect(world.find('enemy').length).toBe(1);
    expect(e.enemy.integrity).toBe(2);
  });

  it('fires a bolt from a Centinela and never moves it — REQ-024.24', () => {
    spawnPlayer(world, v(0, 1, -10));
    const t = spawnEnemy(world, 'turret', v(0, 2, 0), {
      body: { grounded: false, noGravity: true },
      enemy: { type: 'turret', speed: 0, aggroRange: 40, hover: 1.6, integrity: 2, fragile: false },
    });
    const start = t.transform.position.clone();

    for (let i = 0; i < 90; i++) world.update(1 / 60);

    expect(fired.length).toBeGreaterThanOrEqual(1);
    expect(fired[0].name).toBe('projectile');
    expect(t.transform.position.distanceTo(start)).toBeLessThan(0.5);
  });

  it('runs the Devorador through three phases as its integrity falls — REQ-024.27', () => {
    const phases: number[] = [];
    world.events.on('enemy:phase', ({ phase }: any) => phases.push(phase));

    spawnPlayer(world, v(0, 1, -12));
    const b = spawnEnemy(world, 'boss', v(0, 3, 0), {
      body: { grounded: false, noGravity: true, radius: 3, mass: 1000 },
      enemy: { type: 'boss', speed: 4, aggroRange: 200, hover: 2.4, integrity: 9, fragile: false },
    });

    world.update(1 / 60);
    expect(b.fsm.phase).toBe(1);

    b.enemy.integrity = 5;
    world.update(1 / 60);
    expect(b.fsm.phase).toBe(2);

    b.enemy.integrity = 2;
    world.update(1 / 60);
    expect(b.fsm.phase).toBe(3);

    expect(phases).toEqual([2, 3]);
  });
});

describe('Shockwave — REQ-024.26', () => {
  it('pushes and damages the player inside the radius', () => {
    const { world } = makeWorld();
    world.addSystem(shockwaveSystem());

    const hits: any[] = [];
    world.events.on('player:hit', (e: any) => hits.push(e));

    const player = spawnPlayer(world, v(0, 1, 2));
    world.events.emit('enemy:shockwave', { at: v(0, 1, 0), radius: 6.5, damage: 2 });

    expect(hits.length).toBe(1);
    expect(player.body.velocity.z).toBeGreaterThan(0);   // pushed away from the origin
    expect(player.body.velocity.y).toBeGreaterThan(0);
  });

  it('leaves a player outside the radius alone', () => {
    const { world } = makeWorld();
    world.addSystem(shockwaveSystem());

    const hits: any[] = [];
    world.events.on('player:hit', (e: any) => hits.push(e));

    const player = spawnPlayer(world, v(0, 1, 30));
    world.events.emit('enemy:shockwave', { at: v(0, 1, 0), radius: 6.5, damage: 2 });

    expect(hits.length).toBe(0);
    expect(player.body.velocity.lengthSq()).toBe(0);
  });

  it('still throws an invulnerable player without damaging them', () => {
    const { world } = makeWorld();
    world.addSystem(shockwaveSystem());

    const hits: any[] = [];
    world.events.on('player:hit', (e: any) => hits.push(e));

    const player = spawnPlayer(world, v(0, 1, 2));
    player.player.invulnerable = 1;
    world.events.emit('enemy:shockwave', { at: v(0, 1, 0), radius: 6.5, damage: 2 });

    expect(hits.length).toBe(0);
    expect(player.body.velocity.z).toBeGreaterThan(0);
  });
});

describe('Projectiles — REQ-024.24', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.state.status = 'playing';
    world.addSystem(projectileSystem());
  });

  function bolt(position = v(0, 2, 0), direction = v(0, 0, -1)) {
    return world.spawn({
      tag: 'projectile',
      transform: { position: position.clone(), yaw: 0 },
      projectile: { ttl: 1.0, damage: 1, speed: 17, dir: direction.clone().normalize() },
      hazard: { radius: 0.42, damage: 1 },
    });
  }

  it('travels in a straight line at its declared speed', () => {
    const p = bolt();
    world.update(0.1);
    expect(p.transform.position.z).toBeCloseTo(-1.7, 3);
    expect(p.transform.position.x).toBe(0);
    expect(p.transform.position.y).toBe(2);   // no gravity
  });

  it('expires when its lifetime runs out', () => {
    let expired = 0;
    world.events.on('projectile:expired', () => { expired++; });

    bolt();
    for (let i = 0; i < 90; i++) world.update(1 / 60);

    expect(expired).toBe(1);
    expect(world.find('projectile').length).toBe(0);
  });

  it('is destroyed by a solid instead of passing through it', () => {
    let impacts = 0;
    world.events.on('projectile:impact', () => { impacts++; });

    world.spawn({
      tag: 'wall',
      transform: { position: v(0, 2, -5), yaw: 0 },
      solid: { size: v(10, 4, 1) },
    });
    bolt();

    for (let i = 0; i < 60; i++) world.update(1 / 60);

    expect(impacts).toBe(1);
    expect(world.find('projectile').length).toBe(0);
  });

  it('is destroyed immediately when it spawns inside geometry — E-08', () => {
    world.spawn({
      tag: 'wall',
      transform: { position: v(0, 2, 0), yaw: 0 },
      solid: { size: v(4, 4, 4) },
    });
    bolt(v(0, 2, 0));

    world.update(1 / 60);

    expect(world.find('projectile').length).toBe(0);
  });
});

describe('Interceptor and Dron — REQ-024.25', () => {
  it('moves an Interceptor, which the missing body used to make impossible', () => {
    const { world } = makeWorld();
    world.addSystem(interceptorSystem());

    spawnPlayer(world, v(0, 2, -10));
    const e = world.spawn({
      tag: 'interceptor',
      transform: { position: v(0, 2, 0), yaw: 0 },
      body: { velocity: v(), radius: 0.5, grounded: false, mass: 0.9, friction: 6, drag: 2.5, noGravity: true },
      interceptor: { speed: 21, hover: 2 },
      enemy: { type: 'interceptor', fragile: true, integrity: 1, stun: 0, home: v(0, 2, 0), leash: 40 },
      fsm: { state: 'idle', timer: 0, phase: 1, aim: v() },
      hazard: { radius: 0.7, damage: 1 },
    });

    // Sampled across the whole cycle: the Interceptor idles, aims, then crosses.
    let fastest = 0;
    for (let i = 0; i < 120; i++) {
      world.update(1 / 60);
      fastest = Math.max(fastest, Math.abs(e.body.velocity.z));
    }

    expect(fastest).toBeGreaterThan(15);
    expect(e.fsm.state).not.toBe('idle_forever');
  });

  it('keeps the escort Dron near the player and lets it stagger a Sombra', () => {
    const { world } = makeWorld();
    world.addSystem(droneSystem());

    const staggered: any[] = [];
    world.events.on('enemy:hit', (e: any) => staggered.push(e));

    const player = spawnPlayer(world, v(0, 1, 0));
    const drone = world.spawn({
      tag: 'drone',
      transform: { position: v(14, 4, 8), yaw: 0 },
      body: { velocity: v(), radius: 0.35, grounded: false, mass: 0.4, friction: 4, drag: 3, noGravity: true },
      ally: { followDist: 2.6, target: null, fireTimer: 0, hover: 2.2 },
    });
    spawnEnemy(world, 'tracker', v(2, 1, 2));

    const before = drone.transform.position.distanceTo(player.transform.position);
    for (let i = 0; i < 60; i++) {
      world.update(1 / 60);
      drone.transform.position.addScaledVector(drone.body.velocity, 1 / 60);
    }

    expect(drone.transform.position.distanceTo(player.transform.position)).toBeLessThan(before);
    expect(staggered.length).toBeGreaterThanOrEqual(1);
    expect(staggered[0].amount).toBe(0);   // the drone knocks back, it never kills
  });
});
