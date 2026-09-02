import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/core/world.js';
import { gameSystem } from '../src/systems/game.js';
import { CONFIG } from '../src/config.js';

// Setup Mock for Canvas API in jsdom
HTMLCanvasElement.prototype.getContext = () => ({
  createRadialGradient: () => ({ addColorStop: () => {} }),
  fillStyle: '',
  fillRect: () => {}
}) as any;

describe('Game System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.addSystem(gameSystem());
  });

  it('should initialize combo to 0 on game start', () => {
    world.events.emit('game:start', { level: 1 });
    expect(world.state.combo).toBe(0);
    expect(world.state.comboTimer).toBe(0);
  });

  it('should increment combo and reset timer on orb collection', () => {
    world.events.emit('game:start', { level: 1 });
    world.state.status = 'playing'; // Mock state transition
    
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

    // Simulate 3.1 seconds passing
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
});
