import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/core/world.js';
import { playerSystem } from '../src/systems/player.js';
import { CONFIG } from '../src/config.js';

describe('Player System - Movement & Air Control', () => {
  let world: World;
  let mockInput: any;

  beforeEach(() => {
    world = new World();
    world.state.status = 'playing';
    world.state.cameraYaw = 0; // Forward is -Z

    mockInput = {
      keys: new Set<string>(),
      virtualKeys: new Set<string>(),
      joystick: { x: 0, y: 0 },
      down(...codes: string[]) {
        return codes.some(code => this.keys.has(code) || this.virtualKeys.has(code));
      }
    };

    world.addSystem(playerSystem(mockInput));
  });

  it('should accelerate forward in the air when pressing W', () => {
    const player = world.spawn({
      tag: 'player',
      transform: { position: new THREE.Vector3(0, 5, 0), yaw: 0 },
      body: { velocity: new THREE.Vector3(0, 0, 0), radius: 0.6, grounded: false, mass: 1, friction: 12, drag: 1 },
      player: { lives: 3, invulnerable: 0, dashCooldown: 0, coyote: 0 }
    });

    mockInput.keys.add('KeyW');

    // Simulate 0.3s of airborne flight (18 frames at 60fps)
    for (let i = 0; i < 18; i++) {
      world.update(1 / 60);
    }

    // With proper air control (airControl: 0.75), in 0.3s velocity.z should reach at least -8 m/s
    // (Previously with 0.375 rate, in 0.3s it only reached ~ -1.5 m/s)
    expect(player.body.velocity.z).toBeLessThan(-7);
  });

  it('should allow jumping while pressing W and preserve forward momentum', () => {
    const player = world.spawn({
      tag: 'player',
      transform: { position: new THREE.Vector3(0, 2, 0), yaw: 0 },
      body: { velocity: new THREE.Vector3(0, 0, -10), radius: 0.6, grounded: true, mass: 1, friction: 12, drag: 1 },
      player: { lives: 3, invulnerable: 0, dashCooldown: 0, coyote: 0 }
    });

    mockInput.keys.add('KeyW');
    mockInput.keys.add('Space');

    world.update(1 / 60);

    expect(player.body.velocity.y).toBe(CONFIG.player.jump);
    expect(player.body.velocity.z).toBeLessThanOrEqual(-10);
  });
});
