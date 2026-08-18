import * as THREE from 'three';
import { CONFIG } from '../config.js';

const move = new THREE.Vector3();

/**
 * Control del jugador: movimiento relativo a la cámara + salto.
 *
 * Cambiar el control (mando, móvil, IA) es cambiar de dónde salen `x` e `y`
 * aquí; el resto del juego no se entera.
 */
export function playerSystem(input) {
  return {
    name: 'player',

    update(world, dt) {
      const e = world.first('player');
      if (!e || world.state.status !== 'playing') return;

      const { body, transform } = e;
      if (e.player.invulnerable > 0) e.player.invulnerable -= dt;

      // Ejes de entrada en el espacio de la cámara.
      const x = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      const z = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);

      const yaw = world.state.cameraYaw ?? 0;
      const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };

      move.set(forward.x * z + right.x * x, 0, forward.z * z + right.z * x);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(CONFIG.player.speed);
        transform.yaw = Math.atan2(move.x, move.z);
      }

      // En el aire el control es parcial: se conserva algo de inercia.
      const control = body.grounded ? 1 : CONFIG.player.airControl;
      body.velocity.x += (move.x - body.velocity.x) * Math.min(1, control * 14 * dt);
      body.velocity.z += (move.z - body.velocity.z) * Math.min(1, control * 14 * dt);

      if (body.grounded && input.down('Space')) {
        body.velocity.y = CONFIG.player.jump;
        body.grounded = false;
        world.events.emit('player:jump', e);
      }
    },
  };
}
