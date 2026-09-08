import * as THREE from 'three';
import { CONFIG } from '../config.js';

const target = new THREE.Vector3();
const desired = new THREE.Vector3();
const shake = new THREE.Vector3();

/**
 * Third-person orbit camera.
 *
 * It publishes `world.state.cameraYaw`, which is what the player system uses to
 * move "the way the camera is looking". That is the only coupling between them.
 *
 * Two additions from spec 024:
 *
 *  - **Field of view follows the action.** The FOV widens during an Impulso and
 *    widens further under Cámara Lenta. Speed you cannot see is speed you cannot
 *    feel, and the dash is short enough that without it the 34 u/s reads as a
 *    teleport. The base value now comes from `CONFIG.camera.fov` — the previous
 *    implementation hard-coded 75 and silently ignored the configured 62.
 *  - **Shake is decaying and optional.** It is seeded per event, decays smoothly,
 *    and honours `CONFIG.graphics.shake`: camera shake is a common
 *    motion-sickness trigger, and a game nobody can play for ten minutes is not
 *    a game.
 */
export function cameraSystem(input) {
  let yaw = 0;
  let pitch = 0.25;
  let trauma = 0;
  let shakeTime = 0;

  return {
    name: 'camera',

    init(world) {
      const jolt = (amount) => { trauma = Math.min(1, trauma + amount); };

      world.events.on('player:damaged', ({ lost = 1, shielded }) => {
        jolt(shielded ? 0.25 : Math.min(0.85, 0.4 + lost * 0.18));
      });
      world.events.on('player:dash', () => jolt(0.18));
      world.events.on('enemy:shattered', () => jolt(0.14));
      world.events.on('enemy:shockwave', ({ at }) => {
        const player = world.first('player');
        if (!player) return;
        const distance = player.transform.position.distanceTo(at);
        jolt(Math.max(0, 0.7 * (1 - distance / 12)));
      });
      world.events.on('platform:collapsed', () => jolt(0.08));
      world.events.on('game:start', () => { trauma = 0; });
    },

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

      // The camera keeps a floor of its own so it never dives under the route.
      desired.y = Math.max(desired.y, player.transform.position.y - 1.5);

      // Field of view: base, dashing, dilated.
      const wantedFov = world.state.timeScale < 1
        ? CONFIG.camera.fovSlow
        : world.state.dashing
          ? CONFIG.camera.fovDash
          : CONFIG.camera.fov;
      camera.fov += (wantedFov - camera.fov) * Math.min(1, 6 * dt);
      camera.updateProjectionMatrix();

      // Frame-rate independent smoothing.
      const t = 1 - Math.exp(-CONFIG.camera.smooth * dt);
      camera.position.lerp(desired, t);

      if (trauma > 0) {
        trauma = Math.max(0, trauma - dt * 1.6);
        if (CONFIG.graphics.shake) {
          shakeTime += dt;
          // Trauma squared: small knocks stay subtle, big ones still hit hard.
          const amount = trauma * trauma * 0.9;
          shake.set(
            Math.sin(shakeTime * 47.3) * amount,
            Math.sin(shakeTime * 61.7 + 1.7) * amount,
            Math.sin(shakeTime * 53.1 + 3.1) * amount,
          );
          camera.position.add(shake);
        }
      }

      camera.lookAt(target);
    },
  };
}
