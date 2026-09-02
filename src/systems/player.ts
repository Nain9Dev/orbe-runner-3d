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
  let wasGrounded = true;

  return {
    name: 'player',

    update(world, dt) {
      const e = world.first('player');
      if (!e || world.state.status !== 'playing') return;

      const { body, transform } = e;
      if (e.player.invulnerable > 0) e.player.invulnerable -= dt;

      // Ejes de entrada en el espacio de la cámara.
      let x = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      let z = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);

      // Si el joystick móvil está en uso, reemplazamos con su vector analógico
      if (Math.abs(input.joystick.x) > 0.05 || Math.abs(input.joystick.y) > 0.05) {
        x = input.joystick.x;
        z = -input.joystick.y; // joystick.y negativo = arriba = avanzar (z positivo)
      }

      const yaw = world.state.cameraYaw ?? 0;
      const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };

      move.set(forward.x * z + right.x * x, 0, forward.z * z + right.z * x);
      
      const moveLenSq = move.lengthSq();
      if (moveLenSq > 0) {
        // En lugar de normalizar a 1 siempre, limitamos a la longitud real del joystick (máx 1)
        // Esto permite a Lúmen caminar despacio
        const intensity = Math.min(Math.sqrt(moveLenSq), 1.0);
        move.normalize().multiplyScalar(CONFIG.player.speed * intensity);
        transform.yaw = Math.atan2(move.x, move.z);
      }

      // En el aire el control es parcial.
      // La aceleración se equilibra con la fricción/arrastre de physics.ts
      // Terminal Velocity (V) = Aceleración (A) / Fricción (F)
      const control = body.grounded ? 1 : (CONFIG.player.airControl * 0.5); // Reducir control aéreo
      const accelFactor = body.grounded ? (body.friction ?? 12) : (body.drag ?? 1);
      
      body.velocity.x += move.x * accelFactor * control * dt;
      body.velocity.z += move.z * accelFactor * control * dt;

      // Aviso de aterrizaje: lo usan las partículas de polvo.
      if (body.grounded && !wasGrounded) world.events.emit('player:landed', e);
      wasGrounded = body.grounded;

      // Coyote time: permite saltar unos frames tras perder el suelo
      if (body.grounded) {
        e.player.coyote = 10;
      } else if (e.player.coyote > 0) {
        e.player.coyote--;
      }

      if ((body.grounded || e.player.coyote > 0) && input.down('Space')) {
        const jumpPower = e.player.buff?.type === 'jump' ? CONFIG.player.jump * 1.5 : CONFIG.player.jump;
        body.velocity.y = jumpPower;
        body.grounded = false;
        e.player.coyote = 0; // Consume el salto
        world.events.emit('player:jump', e);
      }
    },
  };
}
