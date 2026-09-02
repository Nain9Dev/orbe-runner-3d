import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createOrbi, createHunter, createOrbGem, createPowerupIcon } from './models.js';

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
  box: new THREE.BoxGeometry(1, 1, 1),
};

const MAT = {
  ground: new THREE.MeshStandardMaterial({ color: 0x01020a, roughness: 0.1, metalness: 0.8 }), // Suelo reflectante
  platform: new THREE.MeshStandardMaterial({ color: 0x170321, emissive: 0xff2a6d, emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.8 }), // Plataformas de cristal oscuro con brillo magenta
  crumbling_platform: new THREE.MeshStandardMaterial({ color: 0x2a0505, emissive: 0xff3b00, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.5 }), // Naranja resplandeciente
  wall: new THREE.MeshStandardMaterial({ color: 0x010105, roughness: 0.9, metalness: 0.2 }),
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

const cache = new Map();
function once(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

function createMonolith({ width, height, depth }) {
  const geo = once(`monolith_${width}_${height}_${depth}`, () => new THREE.BoxGeometry(width, height, depth));
  const mat = once('monolithMat', () => new THREE.MeshStandardMaterial({
    color: 0x05050a, roughness: 0.9, metalness: 0.1, flatShading: true
  }));
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.castShadow = true;
  
  // Líneas de neón decorativas
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x05d9e8, transparent: true, opacity: 0.3 })
  );
  m.add(edges);
  return m;
}

/* ------------------------------- Prefabs ---------------------------------- */

definePrefab('player', ({ position = v3(0, 2, 0) } = {}, world) => {
  const r = CONFIG.player.radius;
  const tier = world ? Math.floor((world.state.level - 1) / 3) : 0;
  // El protagonista es único, así que tiene su propio modelo animado (no se
  // comparte con nadie) en lugar de una geometría del catálogo.
  const orbi = createOrbi({ radius: r, color: CONFIG.player.color, tier });
  return {
    tag: 'player',
    transform: { position: position.clone(), yaw: 0 },
    body: { velocity: v3(), radius: r, grounded: false, mass: 1.0, bounciness: 0.3, friction: 12, drag: 1 },
    player: {
      spawn: position.clone(),
      lives: CONFIG.player.lives,
      invulnerable: CONFIG.player.startGrace, // margen de cortesía al empezar
    },
    avatar: { api: orbi },
    render: { mesh: orbi.group },
  };
});

definePrefab('enemy', ({ position = v3(), speed = CONFIG.enemy.speed, type = 'tracker' } = {}, world) => {
  let r = CONFIG.enemy.radius;
  let spd = speed;
  let damage = 1;
  let aggroRange = CONFIG.enemy.aggroRange;

  let mass = 1.2;

  if (type === 'stalker') {
    r = 0.5;
    spd = speed * 1.6;
    damage = 1;
    aggroRange = 10;
    mass = 0.6; // Ligero
  } else if (type === 'tank') {
    r = 1.3;
    spd = speed * 0.5;
    damage = 2;
    aggroRange = 25;
    mass = 5.0; // Pesado
  } else if (type === 'boss') {
    r = 3.0;
    spd = speed * 0.9;
    damage = 3;
    aggroRange = 100; // Todo el mapa
    mass = 1000.0; // Inamovible
  } else if (type === 'turret') {
    r = 0.8;
    spd = 0; // Estática
    damage = 1;
    aggroRange = 40;
    mass = 50.0;
  }

  const tier = world ? Math.floor((world.state.level - 1) / 3) : 0;
  const hunter = createHunter({ radius: r, type, tier });
  return {
    tag: 'enemy',
    transform: { position: position.clone(), yaw: 0 },
    body: { velocity: v3(), radius: r, grounded: false, mass, bounciness: 0.1, friction: 10, drag: 2 },
    enemy: { type, speed: spd, aggroRange, home: position.clone(), wander: v3() },
    hazard: { radius: r + 0.2, damage },
    avatar: { api: hunter },
    render: { mesh: hunter.group },
  };
});

definePrefab('orb', ({ position = v3(), value = 1 } = {}) => {
  const r = CONFIG.pickup.radius;
  const gem = createOrbGem({ radius: r });
  return {
    tag: 'orb',
    transform: { position: position.clone(), yaw: 0 },
    pickup: { value, spin: CONFIG.pickup.spin, base: position.y },
    avatar: { api: gem },
    render: { mesh: gem.group },
  };
});

definePrefab('platform', ({ position = v3(), size = v3(5, 1, 5) }) => {
  return {
    tag: 'platform',
    transform: { position: position.clone(), yaw: 0 },
    solid: { size: size.clone() },
    render: { mesh: mesh(GEO.box, MAT.platform, size) },
  };
});

definePrefab('crumbling_platform', ({ position = v3(), size = v3(5, 1, 5) }) => {
  return {
    tag: 'crumbling_platform',
    transform: { position: position.clone(), yaw: 0 },
    solid: { size: size.clone() },
    render: { mesh: mesh(GEO.box, MAT.crumbling_platform, size) },
    crumbling: { state: 'idle', timer: 1.5 } // 1.5 segundos hasta caer
  };
});

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

definePrefab('bounce_pad', ({ position = v3(), size = v3(2, 0.5, 2) } = {}) => {
  const m = mesh(GEO.box, once('bounceMat', () => new THREE.MeshStandardMaterial({
    color: 0x00ffff, emissive: 0x0088ff, emissiveIntensity: 1.5, roughness: 0.1
  })), size);
  return {
    tag: 'bounce_pad',
    transform: { position: position.clone(), yaw: 0 },
    solid: { size: size.clone() },
    bounce: { force: 25 }, // Componente para ser leído por player/physics
    render: { mesh: m },
  };
});

definePrefab('lava', ({ position = v3(), size = v3(10, 0.2, 10) } = {}) => {
  const m = mesh(GEO.box, once('lavaMat', () => new THREE.MeshStandardMaterial({
    color: 0xff3300, emissive: 0xff1100, emissiveIntensity: 1.2, roughness: 0.9
  })), size);
  m.castShadow = false;
  return {
    tag: 'lava',
    transform: { position: position.clone(), yaw: 0 },
    hazard: { radius: Math.max(size.x, size.z) / 2, damage: 10, box: size.clone() }, // Muerte instantánea (10 dmg)
    render: { mesh: m },
  };
});

definePrefab('powerup', ({ position = v3(), type = 'shield' } = {}) => {
  const r = 0.5;
  const icon = createPowerupIcon({ radius: r, type });
  return {
    tag: 'powerup',
    transform: { position: position.clone(), yaw: 0 },
    pickup: { value: 0, spin: 1.5, base: position.y }, // Usa pickup para girar/flotar
    powerup: { type }, // El tag/componente que define qué hace
    avatar: { api: icon },
    render: { mesh: icon.group },
  };
});

definePrefab('monolith', ({ position = v3(), width = 10, height = 50, depth = 10 } = {}) => {
  const mesh = createMonolith({ width, height, depth });
  return {
    tag: 'monolith',
    transform: { position: position.clone(), yaw: 0 },
    render: { mesh }, // Decorativo puro, sin físicas
  };
});
