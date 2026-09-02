import * as THREE from 'three';
import { CONFIG } from '../config.js';

const closest = new THREE.Vector3();
const normal = new THREE.Vector3();

/**
 * Física mínima pero suficiente: gravedad, integración y colisión
 * esfera-contra-caja estática. Sin dependencias externas.
 *
 * Cuerpos dinámicos = entidades con `body` (esferas).
 * Geometría estática = entidades con `solid` (cajas alineadas a los ejes).
 */
export function physicsSystem() {
  return {
    name: 'physics',

    update(world, dt) {
      const solids = world.find('solid', 'transform');

      for (const e of world.query('transform', 'body')) {
        const { body, transform } = e;

        // 1. Gravedad e integración.
        body.velocity.y += CONFIG.world.gravity * dt;
        transform.position.addScaledVector(body.velocity, dt);
        body.grounded = false;

        // 2. Resolución de penetraciones contra cada caja estática.
        for (const s of solids) {
          resolveSphereBox(transform.position, body, s.transform.position, s.solid.size);
        }

        // 3. Red de seguridad: si algo se cae del mundo, avisamos.
        if (transform.position.y < -25) world.events.emit('body:fell', e);
      }
    },
  };
}

function resolveSphereBox(position, body, boxCenter, boxSize) {
  const hx = boxSize.x / 2;
  const hy = boxSize.y / 2;
  const hz = boxSize.z / 2;

  // Punto de la caja más cercano al centro de la esfera.
  closest.set(
    THREE.MathUtils.clamp(position.x, boxCenter.x - hx, boxCenter.x + hx),
    THREE.MathUtils.clamp(position.y, boxCenter.y - hy, boxCenter.y + hy),
    THREE.MathUtils.clamp(position.z, boxCenter.z - hz, boxCenter.z + hz),
  );

  normal.subVectors(position, closest);
  const distance = normal.length();

  if (distance > body.radius) return; // sin contacto

  let depth;
  if (distance > 1e-6) {
    normal.divideScalar(distance);
    depth = body.radius - distance;
  } else {
    // Centro dentro de la caja: salimos por la cara más próxima.
    const dx = hx + body.radius - Math.abs(position.x - boxCenter.x);
    const dy = hy + body.radius - Math.abs(position.y - boxCenter.y);
    const dz = hz + body.radius - Math.abs(position.z - boxCenter.z);
    if (dy <= dx && dy <= dz) {
      normal.set(0, Math.sign(position.y - boxCenter.y) || 1, 0);
      depth = dy;
    } else if (dx <= dz) {
      normal.set(Math.sign(position.x - boxCenter.x) || 1, 0, 0);
      depth = dx;
    } else {
      normal.set(0, 0, Math.sign(position.z - boxCenter.z) || 1);
      depth = dz;
    }
  }

  // Sacamos la esfera y anulamos la velocidad que entraba en la caja.
  position.addScaledVector(normal, depth);
  const into = body.velocity.dot(normal);
  if (into < 0) body.velocity.addScaledVector(normal, -into);

  if (normal.y > 0.5) body.grounded = true;
}
