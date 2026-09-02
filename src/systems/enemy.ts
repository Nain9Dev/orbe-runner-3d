import * as THREE from 'three';
import { CONFIG } from '../config.js';

const dir = new THREE.Vector3();
const away = new THREE.Vector3();

/**
 * IA de los cazadores: perseguir si el jugador está cerca, patrullar si no,
 * y separarse un poco entre ellos para no apelotonarse.
 *
 * Comportamientos nuevos (huir, disparar, patrullar rutas) se añaden como
 * sistemas aparte que filtren por su propio componente.
 */
export function enemySystem() {
  return {
    name: 'enemy',

    update(world, dt) {
      if (world.state.status !== 'playing') return;

      const player = world.first('player');
      const enemies = world.find('enemy', 'transform', 'body');

      for (const e of enemies) {
        const pos = e.transform.position;
        let speed = e.enemy.speed;

        if (player && pos.distanceTo(player.transform.position) < CONFIG.enemy.aggroRange) {
          dir.subVectors(player.transform.position, pos);
        } else {
          // Patrulla: vuelve a su zona y da vueltas alrededor.
          dir.subVectors(e.enemy.home, pos);
          if (dir.lengthSq() < 4) dir.set(Math.sin(pos.x + pos.z), 0, Math.cos(pos.x - pos.z));
          speed *= 0.55;
        }

        dir.y = 0;
        if (dir.lengthSq() > 0) dir.normalize();

        // Separación entre cazadores.
        for (const other of enemies) {
          if (other === e) continue;
          away.subVectors(pos, other.transform.position);
          away.y = 0;
          const d = away.length();
          if (d > 0 && d < CONFIG.enemy.radius * 3) dir.addScaledVector(away.divideScalar(d), 0.6);
        }
        if (dir.lengthSq() > 0) dir.normalize();

        e.body.velocity.x += (dir.x * speed - e.body.velocity.x) * Math.min(1, 6 * dt);
        e.body.velocity.z += (dir.z * speed - e.body.velocity.z) * Math.min(1, 6 * dt);
        e.transform.yaw = Math.atan2(dir.x, dir.z);

        // Saltito cuando chocan con un obstáculo pero siguen empujando.
        if (e.body.grounded && Math.hypot(e.body.velocity.x, e.body.velocity.z) < speed * 0.25) {
          e.body.velocity.y = 7;
        }
      }
    },
  };
}
