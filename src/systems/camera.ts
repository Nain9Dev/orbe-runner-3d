import * as THREE from 'three';
import { CONFIG } from '../config.js';

const target = new THREE.Vector3();
const desired = new THREE.Vector3();

/**
 * Cámara en tercera persona orbitando al jugador.
 *
 * Publica `world.state.cameraYaw`, que es lo que usa el jugador para moverse
 * "hacia donde mira la cámara". Es el único acoplamiento entre ambos.
 */
export function cameraSystem(input) {
  let yaw = 0;
  let pitch = 0.25;

  return {
    name: 'camera',

    update(world, dt) {
      const { dx, dy } = input.consumeMouse();
      const sens = CONFIG.camera.sensitivity;
      yaw -= dx * sens;
      pitch = THREE.MathUtils.clamp(pitch + dy * sens, CONFIG.camera.pitchMin, CONFIG.camera.pitchMax);
      world.state.cameraYaw = yaw;

      const player = world.first('player');
      const camera = world.state.three?.camera;
      if (!player || !camera) return;

      target.copy(player.transform.position);
      target.y += 1.1;

      const d = CONFIG.camera.distance * Math.cos(pitch);
      desired.set(
        target.x + Math.sin(yaw) * d,
        target.y + CONFIG.camera.height + Math.sin(pitch) * CONFIG.camera.distance,
        target.z + Math.cos(yaw) * d,
      );

      // La cámara no sale de la arena: evita atravesar los muros.
      const limit = CONFIG.world.arenaSize / 2 - 1.5;
      desired.x = THREE.MathUtils.clamp(desired.x, -limit, limit);
      desired.z = THREE.MathUtils.clamp(desired.z, -limit, limit);
      desired.y = Math.max(desired.y, 1.2);

      // Suavizado independiente del framerate.
      const t = 1 - Math.exp(-CONFIG.camera.smooth * dt);
      camera.position.lerp(desired, t);
      camera.lookAt(target);
    },
  };
}
