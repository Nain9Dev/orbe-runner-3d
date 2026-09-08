import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createOrbi, createHunter, createOrbGem, createPowerupIcon, createDrone, createInterceptor, createProjectile, createBeacon } from './models.js';

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

/** Textura de ruido procedural para dar rugosidad y detalle sin imágenes externas. */
let NOISE_TEXTURE = null;
function getNoiseTexture() {
  if (NOISE_TEXTURE) return NOISE_TEXTURE;
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof (ctx as any).createImageData !== 'function') return null;
  const imgData = ctx.createImageData(size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const val = Math.random() * 255;
    imgData.data[i] = val;
    imgData.data[i+1] = val;
    imgData.data[i+2] = val;
    imgData.data[i+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  NOISE_TEXTURE = new THREE.CanvasTexture(canvas);
  NOISE_TEXTURE.wrapS = THREE.RepeatWrapping;
  NOISE_TEXTURE.wrapT = THREE.RepeatWrapping;
  return NOISE_TEXTURE;
}

const MAT = {
  ground: new THREE.MeshStandardMaterial({
    color: 0x01020a, roughness: 0.1, metalness: 0.8,
    bumpMap: getNoiseTexture(), bumpScale: 0.005,
  }),
  /**
   * Platform surfaces are deliberately dark.
   *
   * They used to sit at `emissive 0x05d9e8` intensity 0.15 under a cyan
   * hemisphere light, which turned every platform into a flat slab of the same
   * bright teal — and a flat slab has no readable edge. In a game where the cost
   * of misjudging where a platform ends is a layer of Núcleo, "where does this
   * surface stop" is not a decorative question. The light now lives in the edge
   * frame below, not in the face.
   */
  platform: new THREE.MeshStandardMaterial({
    color: 0x061a24, emissive: 0x05d9e8, emissiveIntensity: 0.04,
    roughness: 0.55, metalness: 0.6,
    roughnessMap: getNoiseTexture(), bumpMap: getNoiseTexture(), bumpScale: 0.01,
  }),
  crumbling_platform: new THREE.MeshStandardMaterial({
    color: 0x24040f, emissive: 0xff2a6d, emissiveIntensity: 0.12,
    roughness: 0.7, metalness: 0.4,
    roughnessMap: getNoiseTexture(), bumpMap: getNoiseTexture(), bumpScale: 0.015,
  }),
  moving_platform: new THREE.MeshStandardMaterial({
    color: 0x241a04, emissive: 0xffc44d, emissiveIntensity: 0.1,
    roughness: 0.55, metalness: 0.6,
    roughnessMap: getNoiseTexture(), bumpMap: getNoiseTexture(), bumpScale: 0.01,
  }),
  wall: new THREE.MeshStandardMaterial({
    color: 0x010105, roughness: 0.9, metalness: 0.2,
    bumpMap: getNoiseTexture(), bumpScale: 0.02,
  }),
};

/**
 * Edge colours by platform kind. The frame is the only bright thing on a
 * platform, which makes the silhouette — and therefore the landing zone — read
 * instantly against the void, and encodes the platform's behaviour in a colour
 * the player learns once: cyan is solid, carmine collapses, amber moves.
 */
const EDGE = {
  platform: 0x05d9e8,
  crumbling_platform: 0xff2a6d,
  moving_platform: 0xffc44d,
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

/**
 * Adds the glowing wireframe frame that makes a platform's edge readable.
 *
 * The line material is shared per colour and the edge geometry is built once for
 * the unit cube, so a Ciclo with sixty platforms adds one geometry and three
 * materials, not sixty of each.
 */
function withEdges(m, colorHex) {
  const geo = once('unitEdges', () => new THREE.EdgesGeometry(GEO.box));
  const mat = once(`edgeMat_${colorHex}`, () => new THREE.LineBasicMaterial({
    color: colorHex, transparent: true, opacity: 0.85,
  }));
  const lines = new THREE.LineSegments(geo, mat);
  m.add(lines);       // inherits the parent's scale, so it hugs the box exactly
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

/**
 * Sombra archetypes.
 *
 * Every hostile in the game is one row of this table. Keeping the numbers in one
 * place is what makes the roster legible: you can see at a glance that the
 * Acechante trades integrity for speed, that only the Coloso and the Devorador
 * survive an Impulso, and that nothing hits for more than three layers.
 *
 * `fragile` is the important flag — a fragile Sombra shatters when Lúmen dashes
 * through it (REQ-024.14). It is what turns the Impulso from an escape button
 * into an attack, and it is why the early Ciclos are stocked with Rastreadores:
 * they are the archetype that teaches the trick.
 *
 * `hover` above zero means the Sombra ignores gravity and floats at that height
 * over its anchor. Shadow entities that walk fall off the route and thin the
 * Ciclo out; ones that drift do not.
 */
export const ARCHETYPES = {
  tracker:     { radius: 0.7, speed: 1.0, damage: 1, aggro: 24,  mass: 1.2,  fragile: true,  hover: 0,   integrity: 1, name: 'Rastreador' },
  stalker:     { radius: 0.5, speed: 1.7, damage: 1, aggro: 14,  mass: 0.6,  fragile: true,  hover: 1.1, integrity: 1, name: 'Acechante' },
  tank:        { radius: 1.3, speed: 0.5, damage: 2, aggro: 25,  mass: 5.0,  fragile: false, hover: 0,   integrity: 3, name: 'Coloso' },
  turret:      { radius: 0.8, speed: 0.0, damage: 1, aggro: 40,  mass: 50.0, fragile: false, hover: 1.6, integrity: 2, name: 'Centinela' },
  boss:        { radius: 3.0, speed: 0.9, damage: 3, aggro: 200, mass: 1000, fragile: false, hover: 2.4, integrity: 9, name: 'Devorador' },
};

definePrefab('enemy', ({ position = v3(), speed = CONFIG.enemy.speed, type = 'tracker' } = {}, world) => {
  const a = ARCHETYPES[type] ?? ARCHETYPES.tracker;
  const tier = world ? Math.floor((world.state.level - 1) / 3) : 0;
  const hunter = createHunter({ radius: a.radius, type, tier });
  const anchor = position.clone();
  if (a.hover > 0) anchor.y += a.hover;

  return {
    tag: 'enemy',
    transform: { position: anchor.clone(), yaw: 0 },
    body: {
      velocity: v3(),
      radius: a.radius,
      grounded: false,
      mass: a.mass,
      bounciness: 0.1,
      friction: 10,
      drag: 2,
      noGravity: a.hover > 0,
    },
    enemy: {
      type,
      speed: speed * a.speed,
      aggroRange: a.aggro,
      home: anchor.clone(),
      hover: a.hover,
      // A leash keeps a Sombra from chasing Lúmen into the void and deleting
      // itself; without one the Ciclo empties out after a couple of long jumps.
      leash: 34,
      fragile: a.fragile,
      integrity: a.integrity,
      stun: 0,
      wander: v3(),
    },
    // Every archetype runs the same shape of state machine, so the telegraph
    // floor in CONFIG.enemy.telegraphFloor applies uniformly (REQ-024.22).
    fsm: { state: 'idle', timer: 0, phase: 1, aim: v3() },
    hazard: { radius: a.radius + 0.2, damage: a.damage },
    avatar: { api: hunter },
    render: { mesh: hunter.group },
  };
});

definePrefab('orb', ({ position = v3(), value = CONFIG.pickup.pathValue, tier = 'path' } = {}) => {
  const risky = tier === 'risk';
  const r = CONFIG.pickup.radius * (risky ? 1.25 : 1);
  const gem = createOrbGem({ radius: r, tier });
  return {
    tag: 'orb',
    transform: { position: position.clone(), yaw: 0 },
    // A risk Fragmento spins faster and floats wider: it has to be readable as
    // "worth more" from across the Ciclo, before the player commits to the detour.
    pickup: { value, spin: CONFIG.pickup.spin * (risky ? 1.7 : 1), base: position.y, tier },
    avatar: { api: gem },
    render: { mesh: gem.group },
  };
});

definePrefab('platform', ({ position = v3(), size = v3(5, 1, 5) }) => {
  return {
    tag: 'platform',
    transform: { position: position.clone(), yaw: 0 },
    solid: { size: size.clone() },
    render: { mesh: withEdges(mesh(GEO.box, MAT.platform, size), EDGE.platform) },
  };
});

definePrefab('crumbling_platform', ({ position = v3(), size = v3(5, 1, 5) }) => {
  return {
    tag: 'crumbling_platform',
    transform: { position: position.clone(), yaw: 0 },
    solid: { size: size.clone() },
    render: { mesh: withEdges(mesh(GEO.box, MAT.crumbling_platform, size), EDGE.crumbling_platform) },
    // 1.5 s from the first footfall to the collapse, then 2.5 s before it
    // reforms. `duration` is what the physics shake reads to scale its panic;
    // `respawn` is what keeps a Ciclo finishable after a fall (see the note on
    // `updateCrumbling` in systems/physics.ts).
    crumbling: { state: 'idle', timer: 1.5, duration: 1.5, respawn: 2.5 },
  };
});

definePrefab('moving_platform', ({ position = v3(), size = v3(5, 1, 5), axis = 'x', range = 5, speed = 2 } = {}) => ({
  tag: 'platform',
  transform: { position: position.clone(), yaw: 0 },
  solid: { size: size.clone() },
  moving: { axis, range, speed, origin: position.clone(), t: Math.random() * Math.PI * 2, dx: 0, dz: 0 },
  render: { mesh: withEdges(mesh(GEO.box, MAT.moving_platform, size), EDGE.moving_platform) },
}));

/**
 * The abyss. Purely decorative: it has no `solid`, so falling into it is a real
 * fall. Earlier Ciclos rested on a solid infinite floor, which meant no jump
 * could ever be missed and no platform ever mattered.
 */
definePrefab('abyss', ({ position = v3(0, -16, 0), size = 400 } = {}) => {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  const m = new THREE.Mesh(geo, MAT.ground);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = false;
  m.castShadow = false;

  const gridSpan = Math.max(80, size);
  const grid = new THREE.GridHelper(gridSpan, Math.round(gridSpan / 6), 0x05d9e8, 0x1b0a2e);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.28;
  grid.rotation.x = Math.PI / 2;   // undo the plane's own rotation
  grid.position.z = 0.05;
  m.add(grid);

  return {
    tag: 'abyss',
    transform: { position: position.clone(), yaw: 0 },
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
    // A box hazard, not a sphere: a circular kill zone around a rectangular pool
    // either kills you off the edge of the visuals or lets you stand in a corner.
    hazard: { radius: Math.max(size.x, size.z) / 2, damage: 10, box: size.clone() },
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

definePrefab('drone', ({ position = v3() } = {}) => {
  const model = createDrone();
  return {
    tag: 'drone',
    transform: { position: position.clone(), yaw: 0 },
    body: {
      velocity: v3(), radius: 0.35, grounded: false, mass: 0.4,
      bounciness: 0.1, friction: 4, drag: 3, noGravity: true,
    },
    ally: { followDist: 2.6, target: null, fireTimer: 0, hover: 2.2 },
    avatar: { api: model },
    render: { mesh: model.group },
  };
});

/**
 * Interceptor — «Interceptor».
 *
 * Regression fixed here (REQ-024.25): this prefab declared `velocity: { vec }`
 * and no `body`, while `interceptorSystem` queries for `body`. The query never
 * matched, so every Interceptor ever spawned stood perfectly still. The same was
 * true of the Dron below.
 */
definePrefab('interceptor', ({ position = v3() } = {}) => {
  const model = createInterceptor();
  const r = 0.5;
  return {
    tag: 'interceptor',
    transform: { position: position.clone(), yaw: 0 },
    body: {
      velocity: v3(), radius: r, grounded: false, mass: 0.9,
      bounciness: 0.2, friction: 6, drag: 2.5, noGravity: true,
    },
    interceptor: { speed: 21, hover: position.y },
    enemy: { type: 'interceptor', fragile: true, integrity: 1, stun: 0, home: position.clone(), leash: 40 },
    fsm: { state: 'idle', timer: 1.2, phase: 1, aim: v3() },
    hazard: { radius: r + 0.2, damage: 1, push: 12 },
    ai: { state: 'idle', target: null, timer: 0, targetDir: v3() },
    avatar: { api: model },
    render: { mesh: model.group },
  };
});

/** Projectile fired by a Centinela. Short-lived, and lethal only to Lúmen. */
definePrefab('projectile', ({ position = v3(), direction = v3(0, 0, -1), speed = 17, damage = 1, ttl = 3.4 } = {}) => {
  const model = createProjectile();
  return {
    tag: 'projectile',
    transform: { position: position.clone(), yaw: Math.atan2(direction.x, direction.z) },
    projectile: { ttl, damage, speed, dir: direction.clone().normalize() },
    hazard: { radius: 0.42, damage },
    render: { mesh: model.group },
    avatar: { api: model },
  };
});

/**
 * Baliza de Reanclaje — the checkpoint. Touching one moves Lúmen's respawn
 * point, which is what keeps a fall into the void an expense rather than a
 * catastrophe. (REQ-024.19)
 */
definePrefab('beacon', ({ position = v3() } = {}) => {
  const model = createBeacon();
  return {
    tag: 'beacon',
    transform: { position: position.clone(), yaw: 0 },
    checkpoint: { reached: false, radius: 2.6 },
    avatar: { api: model },
    render: { mesh: model.group },
  };
});
