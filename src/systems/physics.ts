import * as THREE from 'three';
import { CONFIG } from '../config.js';

const closest = new THREE.Vector3();
const normal = new THREE.Vector3();
const relVel = new THREE.Vector3();
const deltaPos = new THREE.Vector3();

/**
 * Motor de Físicas 2.0 (Spec 017)
 * - Múltiples iteraciones para estabilidad
 * - Colisiones Esfera-Caja con rebote (restitución)
 * - Colisiones Esfera-Esfera con intercambio de masas
 * - Fricción estandarizada
 */
export function physicsSystem() {
  return {
    name: 'physics',

    update(world, dt) {
      const solids = world.find('solid', 'transform');
      const bodies = world.find('transform', 'body');

      // 1. Gravedad, Fricción e Integración.
      for (const e of bodies) {
        const { body, transform } = e;

        // Fricción y Arrastre (si no las define el cuerpo, valores por defecto ágiles)
        if (body.grounded) {
          const friction = body.friction ?? 12; 
          body.velocity.x -= body.velocity.x * Math.min(1, friction * dt);
          body.velocity.z -= body.velocity.z * Math.min(1, friction * dt);
        } else {
          const drag = body.drag ?? 1;
          body.velocity.x -= body.velocity.x * Math.min(1, drag * dt);
          body.velocity.z -= body.velocity.z * Math.min(1, drag * dt);
        }

        // Gravedad
        body.velocity.y += CONFIG.world.gravity * dt;

        // Integrar velocidad
        transform.position.addScaledVector(body.velocity, dt);
        
        // Clamp al escenario para evitar salidas por colisión/velocidad extrema (Bug de Dash Out of Bounds)
        if (e.tag === 'player') {
           const limit = (CONFIG.world.arenaSize / 2) - body.radius;
           if (transform.position.x > limit) transform.position.x = limit;
           if (transform.position.x < -limit) transform.position.x = -limit;
           if (transform.position.z > limit) transform.position.z = limit;
           if (transform.position.z < -limit) transform.position.z = -limit;
        }

        // Reset state for this frame
        body.grounded = false;
        
        // Red de seguridad
        if (transform.position.y < -25) world.events.emit('body:fell', e);
      }

      // 2. Resolución iterativa de colisiones (3 pasadas para estabilizar esquinas y apilamientos)
      const ITERATIONS = 3;
      for (let i = 0; i < ITERATIONS; i++) {
        
        // Colisiones dinámicas (Cuerpo vs Cuerpo)
        const bodyArray = Array.from(bodies);
        for (let j = 0; j < bodyArray.length; j++) {
          for (let k = j + 1; k < bodyArray.length; k++) {
            resolveSphereSphere(bodyArray[j], bodyArray[k]);
          }
        }

        // Colisiones estáticas (Cuerpo vs Cajas)
        for (const e of bodies) {
          for (const s of solids) {
            resolveSphereBox(e, s);
          }
        }
      }

      // 3. Actualizar Plataformas Inestables
      for (const s of solids) {
        if (s.crumbling && s.crumbling.state === 'crumbling') {
          s.crumbling.timer -= dt;
          
          // Efecto visual: parpadeo o hundimiento ligero
          if (s.render && s.render.mesh) {
            // Vibra ligeramente o cambia el emisivo
            const m = s.render.mesh;
            m.position.y += (Math.random() - 0.5) * 0.05;
          }

          if (s.crumbling.timer <= 0) {
            world.destroy(s);
          }
        }
      }
    },
  };
}

function resolveSphereSphere(eA, eB) {
  const pA = eA.transform.position;
  const pB = eB.transform.position;
  const bA = eA.body;
  const bB = eB.body;

  deltaPos.subVectors(pA, pB);
  const dist = deltaPos.length();
  const minDist = bA.radius + bB.radius;

  if (dist > minDist || dist === 0) return; // No hay colisión

  const depth = minDist - dist;
  normal.copy(deltaPos).divideScalar(dist); // Dirección de B a A

  const mA = bA.mass ?? 1;
  const mB = bB.mass ?? 1;
  const totalMass = mA + mB;
  const invMassA = 1 / mA;
  const invMassB = 1 / mB;
  const invTotalMass = invMassA + invMassB;

  // Separar cuerpos proporcional a sus masas
  const ratioA = invMassA / invTotalMass;
  const ratioB = invMassB / invTotalMass;
  
  pA.addScaledVector(normal, depth * ratioA);
  pB.addScaledVector(normal, -depth * ratioB);

  // Intercambio de impulsos (rebote elástico)
  relVel.subVectors(bA.velocity, bB.velocity);
  const velAlongNormal = relVel.dot(normal);

  // Si ya se están separando, no aplicamos impulso
  if (velAlongNormal > 0) return;

  const bounciness = Math.min(bA.bounciness ?? 0.1, bB.bounciness ?? 0.1);
  const j = -(1 + bounciness) * velAlongNormal / invTotalMass;

  bA.velocity.addScaledVector(normal, j * invMassA);
  bB.velocity.addScaledVector(normal, -j * invMassB);
}

function resolveSphereBox(bodyEntity, solidEntity) {
  const position = bodyEntity.transform.position;
  const body = bodyEntity.body;
  const boxCenter = solidEntity.transform.position;
  const boxSize = solidEntity.solid.size;

  const hx = boxSize.x / 2;
  const hy = boxSize.y / 2;
  const hz = boxSize.z / 2;

  closest.set(
    THREE.MathUtils.clamp(position.x, boxCenter.x - hx, boxCenter.x + hx),
    THREE.MathUtils.clamp(position.y, boxCenter.y - hy, boxCenter.y + hy),
    THREE.MathUtils.clamp(position.z, boxCenter.z - hz, boxCenter.z + hz),
  );

  normal.subVectors(position, closest);
  const distance = normal.length();

  if (distance > body.radius) return;

  let depth;
  if (distance > 1e-6) {
    normal.divideScalar(distance);
    depth = body.radius - distance;
  } else {
    // Centro atrapado dentro de la caja: salimos por la cara más próxima.
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

  // Separación
  position.addScaledVector(normal, depth);

  // Restitución contra muros estáticos (asumimos masa infinita para la pared)
  const into = body.velocity.dot(normal);
  if (into < 0) {
    const bounciness = body.bounciness ?? 0;
    body.velocity.addScaledVector(normal, -into * (1 + bounciness));
  }

  // Si nos expulsa hacia arriba, consideramos que estamos en el suelo
  if (normal.y > 0.5) {
    body.grounded = true;
    
    // Si pisamos un Bounce Pad, salimos volando
    if (solidEntity.bounce) {
      body.velocity.y = solidEntity.bounce.force;
      body.grounded = false; // Dejamos de estar en el suelo inmediatamente
    }
    
    // Si pisamos una plataforma inestable, activar contador
    if (solidEntity.crumbling && solidEntity.crumbling.state === 'idle') {
      solidEntity.crumbling.state = 'crumbling';
    }
  }
}
