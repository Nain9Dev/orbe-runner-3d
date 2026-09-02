import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/core/world.js';
import { physicsSystem } from '../src/systems/physics.js';

// Setup Mock for Three.js / DOM if needed
global.document = {
  createElement: () => ({
    getContext: () => ({ createRadialGradient: () => ({ addColorStop: () => {} }), fillStyle: '', fillRect: () => {} })
  })
} as any;

describe('Physics System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.addSystem(physicsSystem());
  });

  it('should apply gravity to bodies', () => {
    const entity = world.spawn({
      transform: { position: new THREE.Vector3(0, 10, 0), yaw: 0 },
      body: { velocity: new THREE.Vector3(0, 0, 0), radius: 1, mass: 1, grounded: false, bounciness: 0, friction: 0, drag: 1 }
    });

    world.update(1.0); // 1 second

    expect(entity.body.velocity.y).toBeLessThan(0); // Gravity should pull it down
    expect(entity.transform.position.y).toBeLessThan(10);
  });

  it('should resolve sphere-box collisions and set grounded', () => {
    // Ground box
    world.spawn({
      tag: 'ground',
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(40, 1, 40) }
    });

    // Player falling
    const player = world.spawn({
      transform: { position: new THREE.Vector3(0, 2, 0), yaw: 0 },
      body: { velocity: new THREE.Vector3(0, 0, 0), radius: 0.6, mass: 1, grounded: false, bounciness: 0, friction: 12, drag: 1 }
    });

    // Run for 2 seconds (60 fps)
    for (let i = 0; i < 120; i++) {
      world.update(1/60);
    }

    expect(player.transform.position.y).toBeCloseTo(0.6, 1); // 0 (ground top) + 0.6 (radius)
    expect(player.body.grounded).toBe(true);
  });
  
  it('should bounce according to bounciness', () => {
    world.spawn({
      transform: { position: new THREE.Vector3(0, -0.5, 0), yaw: 0 },
      solid: { size: new THREE.Vector3(40, 1, 40) },
      bounce: { force: 15 } // Bounce pad
    });

    const player = world.spawn({
      transform: { position: new THREE.Vector3(0, 5, 0), yaw: 0 },
      body: { velocity: new THREE.Vector3(0, 0, 0), radius: 0.6, mass: 1, grounded: false, bounciness: 0, friction: 12, drag: 1 }
    });

    let maxVelocity = 0;
    for (let i = 0; i < 120; i++) {
      world.update(1/60);
      if (player.body.velocity.y > maxVelocity) maxVelocity = player.body.velocity.y;
    }

    expect(maxVelocity).toBe(15);
  });
});
