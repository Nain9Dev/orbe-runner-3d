import * as THREE from 'three';
import { glowTexture } from '../game/models.js';

/**
 * Partículas: un único objeto `Points` con un fondo de reserva.
 *
 * Ni se crean ni se destruyen mallas durante la partida: se reutilizan las
 * mismas N partículas, apagándolas a negro (con mezcla aditiva, negro = nada).
 * Es lo que permite tener chispas en todos lados sin que el recolector de
 * basura hipe cada dos por tres.
 */
export function particleSystem({ max = 260 } = {}) {
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  const velocities = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  const tint = new Float32Array(max * 3);
  let cursor = 0;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.55,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  points.frustumCulled = false;

  const color = new THREE.Color();

  /** Lanza `count` chispas desde `origin`. */
  function burst(origin, hex, count, { speed = 3.5, spread = 1, up = 1, ttl = 0.7 } = {}) {
    if (!origin) return;   // see the note in render.ts::spawnVFX
    color.set(hex);
    for (let n = 0; n < count; n++) {
      const i = cursor;
      cursor = (cursor + 1) % max;

      positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.2;

      // Dirección aleatoria en la esfera, aplastada o estirada según el efecto.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const v = speed * (0.5 + Math.random() * 0.8);
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * v * spread;
      velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * v * up;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * v * spread;

      tint[i * 3] = color.r;
      tint[i * 3 + 1] = color.g;
      tint[i * 3 + 2] = color.b;
      maxLife[i] = ttl * (0.7 + Math.random() * 0.6);
      life[i] = maxLife[i];
    }
  }

  return {
    name: 'particles',

    init(world) {
      world.state.three.scene.add(points);
      world.state.burst = burst; // por si otro sistema quiere lanzar chispas

      world.events.on('orb:collected', ({ orb }) => {
        burst(orb.transform.position, 0xffc861, 22, { speed: 4, ttl: 0.75 });
      });
      world.events.on('player:damaged', ({ at }) => {
        burst(at, 0xff3b5c, 26, { speed: 5, ttl: 0.6 });
      });
      world.events.on('player:landed', (player) => {
        burst(player.transform.position, 0x9fd8ff, 10, { speed: 1.8, spread: 1.6, up: 0.25, ttl: 0.45 });
      });
      world.events.on('player:jump', (player) => {
        burst(player.transform.position, 0x8ff2ff, 8, { speed: 1.4, spread: 1.3, up: 0.2, ttl: 0.35 });
      });
      world.events.on('player:dash', (player) => {
        // Estela horizontal brillante hacia atrás del movimiento.
        burst(player.transform.position, 0xffaa00, 25, { speed: 2.5, spread: 0.5, up: 0.1, ttl: 0.6 });
      });

      // Vocabulario nuevo de la spec 024.
      world.events.on('enemy:shattered', ({ at }) => {
        burst(at, 0xff2a6d, 30, { speed: 6, spread: 1.2, ttl: 0.8 });
      });
      world.events.on('enemy:telegraph', ({ at }) => {
        burst(at, 0xffdd55, 8, { speed: 1.2, spread: 1.4, up: 0.6, ttl: 0.5 });
      });
      world.events.on('player:anchored', ({ at }) => {
        burst(at, 0x6ee7ff, 26, { speed: 3, spread: 1.5, up: 1.4, ttl: 1.0 });
      });
      world.events.on('platform:collapsed', (platform) => {
        burst(platform.transform.position, 0xff2a6d, 18, { speed: 2, spread: 1.6, up: 0.3, ttl: 0.9 });
      });
      world.events.on('particles:burst', ({ pos, color, count }) => {
        burst(pos, color ?? 0xffffff, count ?? 10, { speed: 3, ttl: 0.6 });
      });
      world.events.on('particles:shockwave', ({ at, radius }) => {
        // Anillo plano: la onda expansiva tiene que leerse como un radio, no
        // como una explosión esférica, porque su alcance es exactamente eso.
        burst(at, 0xffaa33, 42, { speed: (radius ?? 6) * 1.6, spread: 2.4, up: 0.12, ttl: 0.75 });
      });
    },

    update(world, dt) {
      let anyAlive = false;

      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        anyAlive = true;

        life[i] -= dt;
        const k = Math.max(0, life[i] / maxLife[i]);

        velocities[i * 3 + 1] -= 9 * dt;              // gravedad
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

        // Se apagan desvaneciéndose: con mezcla aditiva, negro es invisible.
        const fade = Math.min(1, k * 1.6); // se mantienen brillantes y se apagan al final
        colors[i * 3] = tint[i * 3] * fade;
        colors[i * 3 + 1] = tint[i * 3 + 1] * fade;
        colors[i * 3 + 2] = tint[i * 3 + 2] * fade;

        if (life[i] <= 0) colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
      }

      if (anyAlive) {
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
      }
    },

    dispose(world) {
      world.state.three.scene.remove(points);
      geometry.dispose();
      points.material.dispose();
    },
  };
}
