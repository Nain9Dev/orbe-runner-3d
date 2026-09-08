import * as THREE from 'three';
import { CONFIG } from '../config.js';

const step = new THREE.Vector3();
const closest = new THREE.Vector3();

/**
 * Bolts fired by Centinelas and by the Devorador.
 *
 * A projectile is deliberately *not* a physics body. It has no mass, no
 * gravity and no restitution — it travels in a straight line until its time runs
 * out or it meets something solid. Feeding them to the solver would put a dozen
 * extra entries in an O(n²) pair loop for behaviour nobody wants, and it would
 * let bolts push Sombras around.
 *
 * Damage is not applied here: a bolt owns a `hazard` component like every other
 * dangerous thing in the game, and `triggerSystem` resolves the contact. That
 * keeps the "what hurts Lúmen" question answerable in exactly one place.
 * (REQ-024.24)
 */
export function projectileSystem() {
  return {
    name: 'projectile',

    update(world, dt) {
      if (world.state.status !== 'playing') return;

      const solids = world.find('solid', 'transform');

      for (const p of world.find('projectile', 'transform')) {
        const info = p.projectile;
        info.ttl -= dt;

        if (info.ttl <= 0) {
          world.events.emit('projectile:expired', { at: p.transform.position.clone() });
          world.destroy(p);
          continue;
        }

        step.copy(info.dir).multiplyScalar(info.speed * dt);
        p.transform.position.add(step);

        // Straight down, out of the Ciclo: no reason to keep simulating it.
        if (p.transform.position.y < CONFIG.world.voidY - 6) {
          world.destroy(p);
          continue;
        }

        if (hitsSolid(p, solids)) {
          world.events.emit('projectile:impact', { at: p.transform.position.clone() });
          world.destroy(p);
        }
      }
    },
  };
}

/**
 * Point-in-box against every solid, inflated by the bolt's own radius.
 *
 * A bolt spawned inside geometry — a Centinela pressed against a wall — is
 * destroyed on its first step and never reaches Lúmen (edge case E-08).
 */
function hitsSolid(projectile, solids) {
  const position = projectile.transform.position;
  const radius = projectile.hazard?.radius ?? 0.3;

  for (const s of solids) {
    if (s.crumbling?.state === 'gone') continue;
    const centre = s.transform.position;
    const size = s.solid.size;
    closest.set(
      THREE.MathUtils.clamp(position.x, centre.x - size.x / 2, centre.x + size.x / 2),
      THREE.MathUtils.clamp(position.y, centre.y - size.y / 2, centre.y + size.y / 2),
      THREE.MathUtils.clamp(position.z, centre.z - size.z / 2, centre.z + size.z / 2),
    );
    if (closest.distanceToSquared(position) <= radius * radius) return true;
  }
  return false;
}
