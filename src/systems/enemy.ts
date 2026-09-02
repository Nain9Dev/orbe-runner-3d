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

        if (player && pos.distanceTo(player.transform.position) < (e.enemy.aggroRange || 16)) {
          dir.subVectors(player.transform.position, pos);
        } else {
          // Patrulla: vuelve a su zona y da vueltas alrededor.
          dir.subVectors(e.enemy.home, pos);
          if (dir.lengthSq() < 4) dir.set(Math.sin(pos.x + pos.z), 0, Math.cos(pos.x - pos.z));
          speed *= 0.55;
        }

        dir.y = 0;
        if (dir.lengthSq() > 0) dir.normalize();

        // La física ahora resuelve los choques entre enemigos,
        // no hace falta código manual de separación.
        const accelFactor = e.body.grounded ? (e.body.friction ?? 10) : (e.body.drag ?? 2);
        
        e.body.velocity.x += dir.x * speed * accelFactor * dt;
        e.body.velocity.z += dir.z * speed * accelFactor * dt;
        e.transform.yaw = Math.atan2(dir.x, dir.z);

        // Saltito cuando chocan con un obstáculo pero siguen empujando.
        if (e.body.grounded && Math.hypot(e.body.velocity.x, e.body.velocity.z) < speed * 0.25) {
          e.body.velocity.y = 7;
        }
      }
    },
  };
}
