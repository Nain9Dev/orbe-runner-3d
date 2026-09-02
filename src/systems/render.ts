import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Sistema de render: lo único que habla con three.js a nivel de escena.
 *
 * Regla: cualquier entidad con `render.mesh` aparece; si se destruye, su malla
 * se va con ella. Ningún otro sistema toca la escena.
 */
const PALETTES = [
  // Tier 1 (1-3): Neón Rosa
  { fog: 0x170321, sun: 0xff2a6d, hemiSky: 0x05d9e8, hemiGround: 0x01012b, sky: ['#01020a', '#170321', '#3d0a42', '#ff2a6d'] },
  // Tier 2 (4-6): Abismo Cian
  { fog: 0x011a2e, sun: 0x00ffff, hemiSky: 0x0055ff, hemiGround: 0x000511, sky: ['#000005', '#011a2e', '#003366', '#00ffff'] },
  // Tier 3 (7-9): Radiación Tóxica
  { fog: 0x1a2405, sun: 0xbfff00, hemiSky: 0x00ff88, hemiGround: 0x051101, sky: ['#020500', '#1a2405', '#334d00', '#bfff00'] },
  // Tier 4 (10+): Vacío Carmesí
  { fog: 0x000000, sun: 0xff0033, hemiSky: 0xff5555, hemiGround: 0x110000, sky: ['#000000', '#0a0000', '#220000', '#ff0033'] },
];

/** Cielo en degradado dibujado en un canvas: pesa nada y quita el fondo plano. */
function skyTexture(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.55, colors[1]);
  grad.addColorStop(0.8, colors[2]);
  grad.addColorStop(1, colors[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function renderSystem(canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 500);
  camera.position.set(0, 6, 12);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  let currentTier = -1;
  const pmrem = new THREE.PMREMGenerator(renderer);

  // Luces: una direccional con sombras + ambiente de relleno.
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const extent = CONFIG.world.arenaSize * 0.7;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.5);
  scene.add(hemi);

  function applyPalette(tier) {
    if (tier === currentTier) return;
    currentTier = tier;
    const p = PALETTES[Math.min(tier, PALETTES.length - 1)];

    const sky = skyTexture(p.sky);
    scene.background = sky;
    scene.fog = new THREE.FogExp2(p.fog, 0.015);
    scene.environment = pmrem.fromEquirectangular(sky).texture;

    sun.color.setHex(p.sun);
    hemi.color.setHex(p.hemiSky);
    hemi.groundColor.setHex(p.hemiGround);
  }

  applyPalette(0); // Iniciar con Tier 0

  // Cuadrícula Cyberpunk de Neón
  const grid = new THREE.GridHelper(140, 70, 0x05d9e8, 0xff2a6d);
  grid.position.y = -0.1;
  scene.add(grid);

  // Contraluz frío: recorta las siluetas contra el fondo.
  const rim = new THREE.DirectionalLight(0x7fb0ff, 1.1);
  rim.position.set(-14, 9, -16);
  scene.add(rim);
  
  // Atmósfera: Polvo flotante (Spec 018)
  const DUST_COUNT = 400;
  const dustGeo = new THREE.OctahedronGeometry(0.12, 0);
  const dustMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
  const dust = new THREE.InstancedMesh(dustGeo, dustMat, DUST_COUNT);
  const dummy = new THREE.Object3D();
  const dustData = [];
  for (let i = 0; i < DUST_COUNT; i++) {
    const x = (Math.random() - 0.5) * 100;
    const y = Math.random() * 30;
    const z = (Math.random() - 0.5) * 100;
    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    dust.setMatrixAt(i, dummy.matrix);
    dustData.push({ x, y, z, speed: 0.2 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2 });
  }
  scene.add(dust);

  // Sistema de Partículas (Chispas VFX - Spec 018)
  const VFX_COUNT = 300;
  const vfxGeo = new THREE.TetrahedronGeometry(0.15, 0);
  const vfxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending });
  const vfx = new THREE.InstancedMesh(vfxGeo, vfxMat, VFX_COUNT);
  const vfxData = [];
  for (let i = 0; i < VFX_COUNT; i++) {
    vfx.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); // Ocultas iniciales
    vfxData.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 });
  }
  scene.add(vfx);
  let vfxIndex = 0;

  function spawnVFX(position, count, colorHex, speedFactor = 1) {
    vfxMat.color.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const p = vfxData[vfxIndex];
      p.pos.copy(position);
      p.vel.set((Math.random() - 0.5) * 10, (Math.random() * 10), (Math.random() - 0.5) * 10).multiplyScalar(speedFactor);
      p.life = 1.0;
      vfxIndex = (vfxIndex + 1) % VFX_COUNT;
    }
  }

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
      world.events.on('game:start', ({ level }) => {
        const tier = Math.floor((level - 1) / 3);
        applyPalette(tier);
      });
      
      world.events.on('orb:collected', ({ orb }) => spawnVFX(orb.transform.position, 15, 0x05d9e8, 0.8));
      world.events.on('player:damaged', ({ at }) => spawnVFX(at, 40, 0xff0033, 1.5));

      window.addEventListener('resize', resize);
      resize();
    },

    render(world) {
      // Sincroniza transform (lógica) -> malla (presentación).
      for (const e of world.query('transform', 'render')) {
        e.render.mesh.position.copy(e.transform.position);
        e.render.mesh.rotation.y = e.transform.yaw;
      }
      
      // Animar Polvo Atmosférico y VFX
      const dt = 1 / 60; // aprox
      const t = performance.now() * 0.001;
      for (let i = 0; i < DUST_COUNT; i++) {
        const d = dustData[i];
        d.y += Math.sin(t * 0.5 + d.phase) * 0.01;
        d.x += Math.cos(t * 0.3 + d.phase) * 0.01;
        dummy.position.set(d.x, d.y, d.z);
        dummy.rotation.x += 0.01 * d.speed;
        dummy.rotation.y += 0.02 * d.speed;
        dummy.updateMatrix();
        dust.setMatrixAt(i, dummy.matrix);
      }
      dust.instanceMatrix.needsUpdate = true;
      
      // Animar VFX (Chispas)
      for (let i = 0; i < VFX_COUNT; i++) {
        const p = vfxData[i];
        if (p.life > 0) {
          p.life -= dt * 1.5;
          p.pos.addScaledVector(p.vel, dt);
          p.vel.y -= 15 * dt; // Gravedad a las chispas
          const scale = Math.max(0, p.life);
          dummy.position.copy(p.pos);
          dummy.rotation.set(t * 10, t * 15, 0);
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          vfx.setMatrixAt(i, dummy.matrix);
        } else {
          vfx.setMatrixAt(i, new THREE.Matrix4().makeScale(0,0,0));
        }
      }
      vfx.instanceMatrix.needsUpdate = true;
      
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
