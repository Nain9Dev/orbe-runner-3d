import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { spawn } from './prefabs.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** PRNG determinista: el mismo nivel se genera igual en cualquier máquina. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Construye el nivel `n` a partir de la fórmula de CONFIG.level.
 *
 * Un nivel es solo datos: si mañana quieres cargar niveles hechos a mano desde
 * un JSON, sustituyes esta función y el resto del juego no cambia.
 */
export function buildLevel(world, n, { lives = CONFIG.player.lives } = {}) {
  const spec = CONFIG.level(n);
  // La arena crece con el nivel para dar más espacio de maniobra
  const size = CONFIG.world.arenaSize * (spec.arenaScale || 1.0);
  const half = size / 2;
  const random = rng(1000 + n * 7919);
  const range = (min, max) => min + random() * (max - min);

  world.clearEntities();

  // Suelo y muros perimetrales (evitan que el jugador se caiga al vacío).
  spawn(world, 'ground', { size });
  const h = CONFIG.world.wallHeight;
  const t = 1;
  const walls = [
    { pos: [0, h / 2, -half], size: [size + t, h, t] },
    { pos: [0, h / 2, half], size: [size + t, h, t] },
    { pos: [-half, h / 2, 0], size: [t, h, size + t] },
    { pos: [half, h / 2, 0], size: [t, h, size + t] },
  ];
  for (const w of walls) {
    spawn(world, 'wall', {
      position: new THREE.Vector3(...w.pos),
      size: new THREE.Vector3(...w.size),
    });
  }

  // Fondo Monumental Procedural (Monolitos gigantes fuera de la arena)
  const numMonoliths = 12 + n * 2;
  for (let i = 0; i < numMonoliths; i++) {
    const angle = random() * Math.PI * 2;
    const dist = range(half + 20, half + 80);
    const width = range(5, 20);
    const depth = range(5, 20);
    const mHeight = range(20, 100);
    spawn(world, 'monolith', {
      position: new THREE.Vector3(Math.cos(angle) * dist, mHeight / 2 - 10, Math.sin(angle) * dist),
      width, height: mHeight, depth
    });
  }

  // Plataformas: crear "caminos" y parkour.
  const platforms = [];
  let lastPos = new THREE.Vector3(range(-half + 8, half - 8), range(1.2, 3.0), range(-half + 8, half - 8));
  
  for (let i = 0; i < spec.platforms; i++) {
    const w = range(6, 10);
    const d = range(6, 10);
    
    let position;
    // 85% probabilidad de continuar el camino (Parkour)
    if (i > 0 && random() < 0.85) {
      // Elegir una dirección dominante (X o Z) para hacer escaleras
      const dirX = random() < 0.5 ? 1 : -1;
      const dirZ = random() < 0.5 ? 1 : -1;
      const isX = random() < 0.5;
      
      position = new THREE.Vector3(
        clamp(lastPos.x + (isX ? range(6, 10) * dirX : range(-3, 3)), -half + 6, half - 6),
        clamp(lastPos.y + range(1.0, 3.0), 1.2, 8.0), // Pueden subir más alto ahora
        clamp(lastPos.z + (isX ? range(-3, 3) : range(6, 10) * dirZ), -half + 6, half - 6)
      );
    } else {
      position = new THREE.Vector3(
        range(-half + 6, half - 6),
        range(1.2, 3.2),
        range(-half + 6, half - 6)
      );
    }
    
    const size = new THREE.Vector3(w, 0.8, d);
    // 30% de las plataformas a partir del nivel 3 son inestables (excepto la primera)
    const isCrumbling = i > 0 && n >= 3 && random() < 0.3;
    const prefabName = isCrumbling ? 'crumbling_platform' : 'platform';
    
    spawn(world, prefabName, { position, size });
    platforms.push({ position, size, isCrumbling });
    
    // Si la plataforma es muy alta o por azar, poner un Bounce Pad para ayudar
    // Las plataformas inestables no llevan bounce pad para aumentar la tensión
    if (!isCrumbling && i > 0 && (position.y > 4.5 || random() < 0.5)) {
      spawn(world, 'bounce_pad', {
        position: new THREE.Vector3(position.x, position.y + 0.4, position.z)
      });
    }
    
    lastPos = position;
  }
  
  // Zonas de Lava (Muerte instantánea a nivel de suelo)
  if (n >= 3) {
    const lavaCount = Math.floor(n / 2);
    for (let i = 0; i < lavaCount; i++) {
      spawn(world, 'lava', {
        position: new THREE.Vector3(range(-half + 10, half - 10), 0.6, range(-half + 10, half - 10)),
        size: new THREE.Vector3(range(6, 12), 0.2, range(6, 12))
      });
    }
  }

  // Orbes: forzamos que el 85% estén sobre las plataformas para incentivar saltar
  for (let i = 0; i < spec.orbs; i++) {
    const onPlatform = platforms.length > 0 && random() < 0.85;
    let position;
    if (onPlatform) {
      const p = platforms[Math.floor(random() * platforms.length)];
      position = new THREE.Vector3(
        p.position.x + range(-p.size.x / 3, p.size.x / 3),
        p.position.y + 1.4,
        p.position.z + range(-p.size.z / 3, p.size.z / 3),
      );
    } else {
      position = new THREE.Vector3(range(-half + 3, half - 3), 1.2, range(-half + 3, half - 3));
    }
    spawn(world, 'orb', { position });
  }

  // Cazadores: nunca junto al punto de aparición del jugador.
  for (let i = 0; i < spec.enemies; i++) {
    let position;
    do {
      position = new THREE.Vector3(range(-half + 3, half - 3), 1.5, range(-half + 3, half - 3));
    } while (position.length() < 14);

    let type = 'tracker';
    if (n >= 5) {
      const rand = random();
      // Tanques y torretas son molestos, reducir su probabilidad
      type = rand < 0.05 ? 'tank' : rand < 0.25 ? 'stalker' : rand < 0.35 ? 'turret' : 'tracker';
    } else if (n >= 3) {
      type = random() < 0.3 ? 'stalker' : 'tracker';
    }

    spawn(world, 'enemy', { position, speed: spec.enemySpeed, type });
  }

  // Jefe (Centinela) cada 5 niveles
  if (n > 0 && n % 5 === 0) {
    spawn(world, 'enemy', {
      position: new THREE.Vector3(0, 5, -half + 10), // Aparece al fondo
      speed: spec.enemySpeed * 0.8,
      type: 'boss'
    });
  }

  // Powerups (a partir del nivel 2)
  if (n >= 2) {
    const powerupCount = n >= 4 && random() < 0.5 ? 2 : 1;
    for (let i = 0; i < powerupCount; i++) {
      const types = ['shield', 'magnet', 'jump'];
      const type = types[Math.floor(random() * types.length)];
      
      // Pueden aparecer en el suelo o en una plataforma
      let position;
      if (platforms.length > 0 && random() < 0.7) {
        const p = platforms[Math.floor(random() * platforms.length)];
        position = new THREE.Vector3(
          p.position.x + range(-p.size.x / 3, p.size.x / 3),
          p.position.y + p.size.y / 2 + 1,
          p.position.z + range(-p.size.z / 3, p.size.z / 3),
        );
      } else {
        position = new THREE.Vector3(range(-half + 3, half - 3), 1.2, range(-half + 3, half - 3));
      }
      
      spawn(world, 'powerup', { position, type });
    }
  }
  const player = spawn(world, 'player', { position: new THREE.Vector3(0, 2, 0) });
  player.player.lives = lives;

  world.state.level = n;
  world.state.collected = 0;
  world.state.totalOrbs = spec.orbs;
  world.state.lives = player.player.lives;
  world.state.status = 'playing';
  world.events.emit('level:built', { level: n, spec });

  return player;
}
