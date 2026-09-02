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
  const size = CONFIG.world.arenaSize;
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

  // Plataformas: dan verticalidad y sitios donde esconder orbes.
  const platforms = [];
  let lastPos = new THREE.Vector3(range(-half + 6, half - 6), range(1.2, 4.5), range(-half + 6, half - 6));
  
  for (let i = 0; i < spec.platforms; i++) {
    const w = range(5, 9);
    const d = range(5, 9);
    
    let position;
    // 70% de probabilidad de crear un "puente" accesible desde la plataforma anterior
    if (i > 0 && random() < 0.7) {
      position = new THREE.Vector3(
        clamp(lastPos.x + range(-8, 8), -half + 6, half - 6),
        clamp(lastPos.y + range(-1.5, 2), 1.2, 6.0),
        clamp(lastPos.z + range(-8, 8), -half + 6, half - 6)
      );
    } else {
      position = new THREE.Vector3(
        range(-half + 6, half - 6),
        range(1.2, 4.5),
        range(-half + 6, half - 6)
      );
    }
    
    const size = new THREE.Vector3(w, 0.8, d);
    spawn(world, 'platform', { position, size });
    platforms.push({ position, size });
    lastPos = position;
  }

  // Orbes: unos sobre plataformas, otros a ras de suelo.
  for (let i = 0; i < spec.orbs; i++) {
    const onPlatform = platforms.length > 0 && random() < 0.55;
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
    spawn(world, 'enemy', { position, speed: spec.enemySpeed });
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
