import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Sistema de render: lo único que habla con three.js a nivel de escena.
 *
 * Regla: cualquier entidad con `render.mesh` aparece; si se destruye, su malla
 * se va con ella. Ningún otro sistema toca la escena.
 */
/** Cielo en degradado dibujado en un canvas: pesa nada y quita el fondo plano. */
function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#01020a');   // espacio
  grad.addColorStop(0.55, '#170321');
  grad.addColorStop(0.8, '#3d0a42');
  grad.addColorStop(1, '#ff2a6d');   // horizonte neón
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function renderSystem(canvas) {
  const scene = new THREE.Scene();
  const sky = skyTexture();
  scene.background = sky;
  // Niebla densa magenta/púrpura
  scene.fog = new THREE.FogExp2(0x170321, 0.015);

  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 500);
  camera.position.set(0, 6, 12);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Curva de tono cinematográfica: los emisivos dejan de "quemarse" y el
  // contraste general sube sin tocar un solo material.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // Entorno para reflejos: el mismo cielo, preprocesado. Da brillos creíbles
  // al anillo metálico y al cristal sin cargar ningún archivo.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(sky).texture;
  pmrem.dispose();

  // Luces: una direccional con sombras + ambiente de relleno.
  // Luces: una direccional con sombras + ambiente de relleno.
  const sun = new THREE.DirectionalLight(0xff2a6d, 2.6); // Luz rosa
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const extent = CONFIG.world.arenaSize * 0.7;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x05d9e8, 0x01012b, 1.5)); // Cyan a azul muy oscuro

  // Cuadrícula Cyberpunk de Neón
  const grid = new THREE.GridHelper(140, 70, 0x05d9e8, 0xff2a6d);
  grid.position.y = -0.1;
  scene.add(grid);

  // Contraluz frío: recorta las siluetas contra el fondo.
  const rim = new THREE.DirectionalLight(0x7fb0ff, 1.1);
  rim.position.set(-14, 9, -16);
  scene.add(rim);

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
      
      // Aplicar Configuración Gráfica
      import('../config.js').then(m => {
        const isLow = m.CONFIG.graphics.lowQuality;
        renderer.setPixelRatio(isLow ? 1 : Math.min(devicePixelRatio, 2));
        renderer.shadowMap.enabled = !isLow;
      });

      renderer.render(scene, camera);
    },

    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
