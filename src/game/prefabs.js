import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Registro de prefabs: nombre -> función que devuelve componentes.
 *
 * Añadir un tipo nuevo de objeto al juego = `definePrefab('loquesea', ...)`.
 * Ni el motor ni los sistemas necesitan enterarse.
 */
const registry = new Map();

export function definePrefab(name, factory) {
  registry.set(name, factory);
}

export function spawn(world, name, options = {}) {
  const factory = registry.get(name);
  if (!factory) throw new Error(`Prefab desconocido: "${name}"`);
  return world.spawn(factory(options, world));
}

export function prefabNames() {
  return [...registry.keys()];
}

/* --------------------------------------------------------------------------
 * Recursos compartidos: una geometría y un material por tipo, reutilizados por
 * todas las instancias. Es lo que permite tener cientos de entidades sin que
 * la memoria (ni el driver) se resientan.
 * ------------------------------------------------------------------------ */
const GEO = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  orb: new THREE.IcosahedronGeometry(1, 0),
};

const MAT = {
  player: new THREE.MeshStandardMaterial({ color: 0x6ee7ff, roughness: 0.35, metalness: 0.1 }),
  enemy: new THREE.MeshStandardMaterial({ color: 0xff5470, roughness: 0.5 }),
  orb: new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x6b4b00, roughness: 0.25 }),
  ground: new THREE.MeshStandardMaterial({ color: 0x27325c, roughness: 0.95 }),
  platform: new THREE.MeshStandardMaterial({ color: 0x3d4f8f, roughness: 0.8 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x1b2445, roughness: 1 }),
};

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Malla con sombras ya configuradas. */
function mesh(geometry, material, scale) {
  const m = new THREE.Mesh(geometry, material);
  m.scale.copy(scale);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------- Prefabs ---------------------------------- */

definePrefab('player', ({ position = v3(0, 2, 0) } = {}) => {
  const r = CONFIG.player.radius;
  return {
    tag: 'player',
    transform: { position: position.clone(), yaw: 0 },
    body: { velocity: v3(), radius: r, grounded: false },
    player: {
      spawn: position.clone(),
      lives: CONFIG.player.lives,
      invulnerable: CONFIG.player.startGrace, // margen de cortesía al empezar
    },
    render: { mesh: mesh(GEO.sphere, MAT.player, v3(r, r, r)) },
  };
});

definePrefab('enemy', ({ position = v3(), speed = CONFIG.enemy.speed } = {}) => {
  const r = CONFIG.enemy.radius;
  return {
    tag: 'enemy',
    transform: { position: position.clone(), yaw: 0 },
    body: { velocity: v3(), radius: r, grounded: false },
    enemy: { speed, home: position.clone(), wander: v3() },
    hazard: { radius: r + 0.2 },
    render: { mesh: mesh(GEO.sphere, MAT.enemy, v3(r, r * 0.85, r)) },
  };
});

definePrefab('orb', ({ position = v3(), value = 1 } = {}) => {
  const r = CONFIG.pickup.radius;
  return {
    tag: 'orb',
    transform: { position: position.clone(), yaw: 0 },
    pickup: { value, spin: CONFIG.pickup.spin, base: position.y },
    render: { mesh: mesh(GEO.orb, MAT.orb, v3(r, r, r)) },
  };
});

definePrefab('platform', ({ position = v3(), size = v3(6, 1, 6) } = {}) => ({
  tag: 'platform',
  transform: { position: position.clone(), yaw: 0 },
  solid: { size: size.clone() },
  render: { mesh: mesh(GEO.box, MAT.platform, size) },
}));

definePrefab('ground', ({ size = CONFIG.world.arenaSize } = {}) => {
  const box = v3(size, 1, size);
  const m = mesh(GEO.box, MAT.ground, box);
  m.castShadow = false;
  return {
    tag: 'ground',
    transform: { position: v3(0, -0.5, 0), yaw: 0 },
    solid: { size: box },
    render: { mesh: m },
  };
});

definePrefab('wall', ({ position = v3(), size = v3(1, 1, 1) } = {}) => ({
  tag: 'wall',
  transform: { position: position.clone(), yaw: 0 },
  solid: { size: size.clone() },
  render: { mesh: mesh(GEO.box, MAT.wall, size) },
}));
