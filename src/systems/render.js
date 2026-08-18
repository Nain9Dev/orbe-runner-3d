import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Sistema de render: lo único que habla con three.js a nivel de escena.
 *
 * Regla: cualquier entidad con `render.mesh` aparece; si se destruye, su malla
 * se va con ella. Ningún otro sistema toca la escena.
 */
export function renderSystem(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  scene.fog = new THREE.Fog(0x0b1020, 55, 130);

  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 500);
  camera.position.set(0, 6, 12);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Luces: una direccional con sombras + ambiente de relleno.
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const extent = CONFIG.world.arenaSize * 0.7;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x1a1030, 1.5));

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    name: 'render',

    init(world) {
      world.state.three = { scene, camera, renderer };

      world.events.on('entity:spawned', (entity) => {
        if (entity.render?.mesh) scene.add(entity.render.mesh);
      });
      world.events.on('entity:destroyed', (entity) => {
        if (entity.render?.mesh) scene.remove(entity.render.mesh);
      });

      window.addEventListener('resize', resize);
      resize();
    },

    render(world) {
      // Sincroniza transform (lógica) -> malla (presentación).
      for (const e of world.query('transform', 'render')) {
        e.render.mesh.position.copy(e.transform.position);
        e.render.mesh.rotation.y = e.transform.yaw;
      }
      renderer.render(scene, camera);
    },

    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
