import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/core/world.js';
import { gameSystem } from '../src/systems/game.js';
import { CONFIG } from '../src/config.js';

// jsdom has no 2D canvas; the model factories reach for one to build their
// procedural textures.
HTMLCanvasElement.prototype.getContext = () => ({
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: () => {},
  fillStyle: '',
  fillRect: () => {},
}) as any;

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function spawnPlayer(world: World, over: Record<string, any> = {}) {
  return world.spawn({
    tag: 'player',
    transform: { position: v(0, 2, -30), yaw: 0 },
    body: { velocity: v(), radius: 0.6, grounded: true, mass: 1, friction: 12, drag: 1 },
    player: {
      lives: 3, maxLives: 3, invulnerable: 0,
      spawn: v(0, 2, 0), checkpoint: v(0, 2, -20),
      dash: { time: 0, cooldown: 0, airLeft: 1, dir: v(), held: false },
      ...over,
    },
  });
}

describe('Game System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    Object.assign(world.state, { collected: 0, totalOrbs: 5, level: 1, score: 0 });
    world.addSystem(gameSystem());
  });

  it('should initialize combo to 0 on game start', () => {
    world.events.emit('game:start', { level: 1 });
    expect(world.state.combo).toBe(0);
    expect(world.state.comboTimer).toBe(0);
  });

  it('should increment combo and reset timer on orb collection', () => {
    world.events.emit('game:start', { level: 1 });
    world.state.status = 'playing';

    world.events.emit('orb:collected', { value: 1 });
    expect(world.state.combo).toBe(1);
    expect(world.state.comboTimer).toBe(3.0);

    world.events.emit('orb:collected', { value: 1 });
    expect(world.state.combo).toBe(2);
    expect(world.state.comboTimer).toBe(3.0);
  });

  it('should reset combo when timer expires', () => {
    world.events.emit('game:start', { level: 1 });
    world.state.status = 'playing';

    world.events.emit('orb:collected', { value: 1 });
    expect(world.state.combo).toBe(1);

    world.update(3.1);
    expect(world.state.combo).toBe(0);
  });

  it('should trigger level up when all orbs are collected', () => {
    world.events.emit('game:start', { level: 1 });
    world.state.status = 'playing';
    world.state.totalOrbs = 5;
    world.state.collected = 4;

    world.events.emit('orb:collected', { value: 1 });
    expect(world.state.status).toBe('levelup');
  });

  /* ------------------------------ Spec 024 -------------------------------- */

  it('counts Fragmentos by piece and light by value — REQ-024.20', () => {
    world.state.status = 'playing';
    world.state.totalOrbs = 10;

    world.events.emit('orb:collected', { value: 1, tier: 'path' });
    world.events.emit('orb:collected', { value: 3, tier: 'risk' });

    expect(world.state.collected).toBe(2);   // two pieces
    expect(world.state.score).toBe(4);       // one plus three
  });

  it('gives a risk Fragmento twice the Resonancia of a path one', () => {
    world.state.status = 'playing';
    world.state.totalOrbs = 10;

    world.events.emit('orb:collected', { value: 1, tier: 'path' });
    expect(world.state.combo).toBe(1);

    world.events.emit('orb:collected', { value: 3, tier: 'risk' });
    expect(world.state.combo).toBe(3);
  });

  it('feeds Resonancia from a shattered Sombra as well — REQ-024.14', () => {
    world.state.status = 'playing';
    world.state.totalOrbs = 10;

    world.events.emit('enemy:shattered', { at: v(1, 1, 1) });

    expect(world.state.combo).toBe(1);
    expect(world.state.score).toBe(5);
  });

  it('takes a layer of Núcleo from a Sombra contact', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);

    world.events.emit('player:hit', { player, source: { hazard: { damage: 1 } } });

    expect(player.player.lives).toBe(2);
    expect(world.state.integrity).toBe(2);
  });

  it('honours the damage figure of the source', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);

    world.events.emit('player:hit', { player, source: { hazard: { damage: 2 } } });

    expect(player.player.lives).toBe(1);
    expect(world.state.critical).toBe(true);
  });

  it('lets the Escudo absorb a lethal hit without losing a layer — E-05', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world, { buff: { type: 'shield', timeleft: 10 } });
    world.state.shield = true;

    world.events.emit('player:hit', { player, source: { hazard: { damage: 10 } } });

    expect(player.player.lives).toBe(3);
    expect(player.player.buff).toBeNull();
    expect(world.state.shield).toBe(false);
    expect(world.state.status).toBe('playing');
  });

  it('ignores a second hit inside the invulnerability window', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);

    world.events.emit('player:hit', { player, source: { hazard: { damage: 1 } } });
    world.events.emit('player:hit', { player, source: { hazard: { damage: 1 } } });

    expect(player.player.lives).toBe(2);
  });

  it('ends the run when the Núcleo collapses', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);

    world.events.emit('player:hit', { player, source: { hazard: { damage: 3 } } });

    expect(world.state.status).toBe('gameover');
    expect(world.state.gameOverIn).toBeGreaterThan(0);
  });

  it('measures the death pause in simulated time, not wall clock', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);
    let menuShown = 0;
    world.events.on('ui:message', () => { menuShown++; });

    world.events.emit('player:hit', { player, source: { hazard: { damage: 3 } } });
    expect(menuShown).toBe(0);

    // `dt` arrives pre-scaled by `timeScale`, which is 0.05 during the pause.
    for (let i = 0; i < 120; i++) world.update((1 / 60) * 0.05);

    expect(menuShown).toBe(1);
    expect(world.state.timeScale).toBe(1);
  });

  /* ------------------------------ The void -------------------------------- */

  it('does not take a layer of Núcleo for falling into the void — REQ-024.19', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);

    world.events.emit('body:fell', player);

    expect(player.player.lives).toBe(3);
    expect(world.state.status).toBe('playing');
  });

  it('takes the Resonancia instead, and says so — REQ-024.19', () => {
    world.state.status = 'playing';
    world.state.totalOrbs = 20;
    const player = spawnPlayer(world);
    const toasts: any[] = [];
    world.events.on('ui:toast', (t: any) => toasts.push(t));

    for (let i = 0; i < 4; i++) world.events.emit('orb:collected', { value: 1 });
    expect(world.state.combo).toBe(4);

    world.events.emit('body:fell', player);

    expect(world.state.combo).toBe(0);
    expect(world.state.comboTimer).toBe(0);
    expect(toasts.some((t) => t.text.includes('VACÍO'))).toBe(true);
  });

  it('returns Lúmen to the last Baliza, not to the start of the Ciclo', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);
    player.player.checkpoint = v(4, 3, -55);

    world.events.emit('body:fell', player);

    expect(player.transform.position.toArray()).toEqual([4, 3, -55]);
    expect(player.body.velocity.lengthSq()).toBe(0);
  });

  it('grants a moment of grace on reappearing', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);

    world.events.emit('body:fell', player);

    expect(player.player.invulnerable).toBeGreaterThanOrEqual(1);
  });

  it('clears an in-flight Impulso when Lúmen reappears', () => {
    world.state.status = 'playing';
    const player = spawnPlayer(world);
    player.player.dash.time = 0.15;
    player.body.noGravity = true;

    world.events.emit('body:fell', player);

    expect(player.player.dash.time).toBe(0);
    expect(player.body.noGravity).toBe(false);
    expect(player.player.dash.airLeft).toBe(CONFIG.player.dash.airDashes);
  });

  it('destroys anything else that falls out of the Ciclo', () => {
    world.state.status = 'playing';
    const sombra = world.spawn({ tag: 'enemy', transform: { position: v(0, -30, 0), yaw: 0 } });

    world.events.emit('body:fell', sombra);
    world.update(1 / 60);

    expect(world.entities.has(sombra.id)).toBe(false);
  });
});
