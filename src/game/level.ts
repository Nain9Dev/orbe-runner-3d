import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { spawn } from './prefabs.js';
import { composeLevel, rng } from './composer.js';
import type { Blueprint } from './composer.js';

/**
 * Builds Ciclo `n` from the blueprint produced by `composer.ts`.
 *
 * The split is deliberate. The composer decides *what* a Ciclo is — pure data,
 * verifiable without a renderer. This module only turns that data into entities.
 * Anything you want to reason about (is the route jumpable, is the rhythm right,
 * are there enough Fragmentos) is decided upstream, where it can be tested.
 *
 * Note the absence of a floor. Earlier Ciclos rested on an infinite ground plane,
 * which quietly cancelled the platforming: nothing you could do had a cost, so
 * nothing you did had weight. The void is now real, and the Balizas placed by the
 * composer are what keep that fair — a fall costs a layer of Núcleo, never your
 * progress through the Ciclo. (REQ-024.19)
 */
export function buildLevel(world, n, { lives = CONFIG.player.lives } = {}) {
  const spec = CONFIG.levelSpec(n);
  const blueprint = composeLevel(n);
  const random = rng(50021 + n * 104729);
  const range = (min, max) => min + random() * (max - min);

  world.clearEntities();

  spawnScenery(world, blueprint, n, random, range);
  spawnPlatforms(world, blueprint);
  const beacons = spawnBeacons(world, blueprint);
  spawnFragments(world, blueprint);
  spawnPowerups(world, blueprint, n, random);
  spawnEnemies(world, blueprint, spec, n, random, range);

  const player = spawn(world, 'player', {
    position: new THREE.Vector3(blueprint.origin.x, blueprint.origin.y + 1.4, blueprint.origin.z),
  });
  player.player.lives = lives;
  player.player.maxLives = CONFIG.player.lives;
  player.player.checkpoint = player.transform.position.clone();

  Object.assign(world.state, {
    level: n,
    collected: 0,
    totalOrbs: blueprint.fragments.length,
    totalValue: blueprint.fragments.reduce(
      (sum, f) => sum + (f.tier === 'risk' ? CONFIG.pickup.riskValue : CONFIG.pickup.pathValue),
      0,
    ),
    integrity: player.player.lives,
    maxIntegrity: player.player.maxLives,
    lives: player.player.lives,          // deprecated mirror, see docs/21-data-model.md
    critical: player.player.lives <= 1,
    shield: false,
    buff: null,
    dashRatio: 1,
    dashing: false,
    beacons: beacons.length,
    sequence: blueprint.sequence,
    status: 'playing',
  });

  world.events.emit('level:built', { level: n, spec, blueprint });

  return player;
}

/* -------------------------------------------------------------------------- */

function spawnScenery(world, blueprint: Blueprint, n, random, range) {
  const bounds = pathBounds(blueprint);
  const spread = Math.max(bounds.width, bounds.depth);

  // The abyss: a decorative grid far below, so the void reads as a place rather
  // than as a rendering bug. Non-solid on purpose.
  spawn(world, 'abyss', {
    position: new THREE.Vector3(bounds.centerX, -16, bounds.centerZ),
    size: spread * 3,
  });

  // Monoliths give the eye something to measure speed against. They sit well
  // clear of the route so they never become accidental platforms.
  const count = 14 + n * 2;
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const dist = range(spread * 0.6 + 30, spread * 0.6 + 110);
    const height = range(24, 120);
    spawn(world, 'monolith', {
      position: new THREE.Vector3(
        bounds.centerX + Math.cos(angle) * dist,
        height / 2 - 26,
        bounds.centerZ + Math.sin(angle) * dist,
      ),
      width: range(6, 22),
      height,
      depth: range(6, 22),
    });
  }
}

function spawnPlatforms(world, blueprint: Blueprint) {
  for (const p of blueprint.platforms) {
    const position = new THREE.Vector3(p.position.x, p.position.y, p.position.z);
    const size = new THREE.Vector3(p.size.x, p.size.y, p.size.z);

    switch (p.kind) {
      case 'crumbling':
        spawn(world, 'crumbling_platform', { position, size });
        break;
      case 'moving':
        spawn(world, 'moving_platform', {
          position,
          size,
          axis: p.axis ?? 'x',
          range: p.sway ?? 4,
          speed: p.speed ?? 1.5,
        });
        break;
      case 'bounce_pad':
        spawn(world, 'bounce_pad', { position, size });
        break;
      case 'lava':
        spawn(world, 'lava', { position, size });
        break;
      default:
        spawn(world, 'platform', { position, size });
    }
  }
}

/**
 * The first Baliza in the blueprint is the origin itself. Lúmen already spawns
 * anchored there, so spawning a ring around it would put a two-metre halo over
 * the player on frame one and fire a "BALIZA ANCLADA" toast for a checkpoint
 * they never travelled to. It stays in the blueprint — it *is* the first
 * checkpoint — it just has no entity.
 */
function spawnBeacons(world, blueprint: Blueprint) {
  return blueprint.beacons.slice(1).map((b) =>
    spawn(world, 'beacon', { position: new THREE.Vector3(b.x, b.y, b.z) }),
  );
}

function spawnFragments(world, blueprint: Blueprint) {
  for (const f of blueprint.fragments) {
    spawn(world, 'orb', {
      position: new THREE.Vector3(f.position.x, f.position.y, f.position.z),
      value: f.tier === 'risk' ? CONFIG.pickup.riskValue : CONFIG.pickup.pathValue,
      tier: f.tier,
    });
  }
}

function spawnPowerups(world, blueprint: Blueprint, n, random) {
  if (n < 2) return;
  const types = ['shield', 'magnet', 'jump', 'time'];
  const howMany = n >= 4 && random() < 0.5 ? 2 : 1;

  for (let i = 0; i < howMany; i++) {
    const anchor = blueprint.path[Math.floor(random() * blueprint.path.length)] ?? blueprint.origin;
    spawn(world, 'powerup', {
      position: new THREE.Vector3(anchor.x, anchor.y + 1.6, anchor.z),
      type: types[Math.floor(random() * types.length)],
    });
  }

  // An escort drone shows up occasionally; it fires at whatever is closest.
  if (random() < 0.35) {
    spawn(world, 'drone', {
      position: new THREE.Vector3(blueprint.origin.x + 2, blueprint.origin.y + 3, blueprint.origin.z),
    });
  }
}

/**
 * Sombras are placed on the slots the chunks reserved, which is what keeps them
 * on solid ground and out of the landing zone of a jump. Slots run out before
 * the Ciclo's enemy budget does at higher numbers, so the remainder is
 * distributed along the route — never within eight units of the start, so the
 * player is never ambushed on spawn.
 */
function spawnEnemies(world, blueprint: Blueprint, spec, n, random, range) {
  const slots = [...blueprint.enemySlots];
  const budget = spec.enemies;

  for (let i = 0; i < budget; i++) {
    let anchor = slots.length > 0
      ? slots.splice(Math.floor(random() * slots.length), 1)[0]
      : blueprint.path[Math.floor(random() * blueprint.path.length)];
    if (!anchor) break;

    const position = new THREE.Vector3(
      anchor.x + range(-3, 3),
      anchor.y + 1.4,
      anchor.z + range(-3, 3),
    );
    if (position.distanceTo(new THREE.Vector3(blueprint.origin.x, blueprint.origin.y, blueprint.origin.z)) < 12) {
      position.z -= 14;
    }

    spawn(world, 'enemy', { position, speed: spec.enemySpeed, type: pickArchetype(random, n) });
  }

  // The Devorador presides over every fifth Ciclo, waiting at the exit.
  if (n > 0 && n % 5 === 0) {
    spawn(world, 'enemy', {
      position: new THREE.Vector3(blueprint.exit.x, blueprint.exit.y + 4, blueprint.exit.z - 6),
      speed: spec.enemySpeed * 0.8,
      type: 'boss',
    });
  }
}

/**
 * Archetype mix by Ciclo. Early Ciclos are all Rastreadores so the player learns
 * one behaviour properly; each band then introduces exactly one new idea.
 */
function pickArchetype(random, n) {
  const r = random();
  if (n >= 6) {
    if (r < 0.06) return 'tank';
    if (r < 0.20) return 'turret';
    if (r < 0.34) return 'interceptor';
    if (r < 0.58) return 'stalker';
    return 'tracker';
  }
  if (n >= 4) {
    if (r < 0.16) return 'turret';
    if (r < 0.38) return 'stalker';
    return 'tracker';
  }
  if (n >= 2) return r < 0.3 ? 'stalker' : 'tracker';
  return 'tracker';
}

function pathBounds(blueprint: Blueprint) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const p of blueprint.platforms) {
    minX = Math.min(minX, p.position.x);
    maxX = Math.max(maxX, p.position.x);
    minZ = Math.min(minZ, p.position.z);
    maxZ = Math.max(maxZ, p.position.z);
  }

  if (!Number.isFinite(minX)) return { centerX: 0, centerZ: 0, width: 40, depth: 40 };

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: Math.max(40, maxX - minX),
    depth: Math.max(40, maxZ - minZ),
  };
}
