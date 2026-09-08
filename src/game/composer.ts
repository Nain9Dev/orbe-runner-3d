/**
 * Ciclo composer — turns a Ciclo number into a layout.
 *
 * Pure data in, pure data out: no Three.js, no ECS, no side effects. `level.ts`
 * takes the blueprint this produces and spawns entities from it. Keeping the two
 * apart is what lets `tests/level.test.ts` verify thirty Ciclos of level design
 * in a few milliseconds, with no renderer and no canvas.
 *
 * Two properties are guaranteed by construction and asserted by that test:
 *
 *  1. **Reachability** (REQ-024.17) — every jump on the critical path fits inside
 *     the arc derived in `src/domain/jump-arc.ts`. Chunks size themselves through
 *     that arc, and anything that still slips through is corrected here before a
 *     single entity exists.
 *  2. **Rhythm** (REQ-024.18) — no more than `maxTensionRun` high-intensity chunks
 *     in a row. Tension only reads as tension against a rest.
 */

import { CONFIG } from '../config.js';
import type { ArcParams } from '../domain/jump-arc.js';
import { maxJumpDistance } from '../domain/jump-arc.js';
import {
  CHUNKS,
  FALLBACK_CHUNK,
  chunksFor,
  findUnreachable,
} from './chunks.js';
import type {
  Chunk,
  ChunkResult,
  FragmentDesc,
  PathNode,
  PlatformDesc,
  Vec3,
} from './chunks.js';

export interface Blueprint {
  level: number;
  platforms: PlatformDesc[];
  path: PathNode[];
  fragments: FragmentDesc[];
  beacons: Vec3[];
  enemySlots: Vec3[];
  /** Chunk ids in the order they were laid down — used by tests and by the HUD. */
  sequence: string[];
  /** Where the Ciclo starts and where its route ends. */
  origin: Vec3;
  exit: Vec3;
}

/** Deterministic PRNG: the same Ciclo generates the same layout on any machine. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function arcFor(): ArcParams {
  return {
    gravity: Math.abs(CONFIG.world.gravity),
    jump: CONFIG.player.jump,
    speed: CONFIG.player.speed,
    fallMultiplier: CONFIG.world.fallGravityMultiplier,
  };
}

/**
 * Chooses the next chunk.
 *
 * Three rules, in order of priority:
 *  - After `maxTensionRun` tense chunks the next one must be a rest. This is the
 *    rhythm rule, and it is not negotiable.
 *  - A chunk never repeats immediately; back-to-back identical ideas read as a
 *    generator failure even when they are legal.
 *  - Otherwise the pick is weighted so that higher Ciclos lean towards tension.
 */
function chooseChunk(
  rand: () => number,
  level: number,
  tensionRun: number,
  previousId: string | null,
): Chunk {
  const eligible = chunksFor(level).filter((c) => c.id !== previousId);
  if (eligible.length === 0) return FALLBACK_CHUNK;

  if (tensionRun >= CONFIG.level.maxTensionRun) {
    const rests = eligible.filter((c) => c.intensity === 0);
    if (rests.length > 0) return rests[Math.floor(rand() * rests.length)];
  }

  // Tension appetite: 0.25 at Ciclo 1, approaching 0.7 late.
  const appetite = Math.min(0.7, 0.25 + level * 0.045);
  const weighted = eligible.map((c) => {
    const base = c.intensity === 2 ? appetite : c.intensity === 1 ? 0.5 : 1 - appetite;
    return { chunk: c, weight: Math.max(0.05, base) };
  });

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = rand() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.chunk;
  }
  return weighted[weighted.length - 1].chunk;
}

/**
 * Chunk-level reach correction.
 *
 * The first attempt at this ran once over the finished path and pulled offending
 * nodes back towards their predecessor. That does not converge: shortening a hop
 * moves its landing node backwards, which *lengthens* the following hop, and the
 * violation walks down the route ahead of the corrector.
 *
 * Correcting per chunk removes the cascade entirely. A chunk is a rigid body —
 * its internal geometry is already safe because every chunk sizes its own gaps
 * through the arc — so the only thing that can be wrong is the junction between
 * the previous exit and the chunk's first landing node. Sliding the *whole* chunk
 * along that junction fixes it without touching a single internal relationship,
 * and the next chunk simply starts from the corrected exit.
 */
function fitChunk(result: ChunkResult, entry: Vec3, arc: ArcParams): ChunkResult {
  const first = result.path[0];
  if (!first) return result;

  const dh = first.y - entry.y;
  const limit = maxJumpDistance(arc, dh) * CONFIG.level.reachSafety;
  const usable = Math.max(0, limit - (first.sway ?? 0));
  const dx = first.x - entry.x;
  const dz = first.z - entry.z;
  const dist = Math.hypot(dx, dz);

  if (dist <= usable + 1e-6) return result;

  // Slide the chunk in along the junction, landing at 98 % of the budget so a
  // corrected gap is never one the player has to clear perfectly.
  const scale = usable > 0 ? Math.min(1, (usable * 0.98) / dist) : 0;
  translate(result, (dx * scale - dx), (dz * scale - dz));
  return result;
}

/** Rigid translation of a whole chunk result. */
function translate(result: ChunkResult, dx: number, dz: number) {
  if (dx === 0 && dz === 0) return;
  const move = (p: Vec3) => { p.x += dx; p.z += dz; };
  for (const p of result.platforms) move(p.position);
  for (const n of result.path) move(n);
  for (const f of result.fragments) move(f.position);
  for (const e of result.enemySlots) move(e);
  if (result.beacon) move(result.beacon);
  move(result.exit);
}

/**
 * Records the point the player actually leaves a chunk from.
 *
 * Most chunks end on the node they exit from, but a wide plateau does not: you
 * land near its leading edge and walk to its far edge before jumping again. If
 * that walk is not in the route, the guard measures the next jump from the
 * landing point and sees a gap that includes the width of the plateau — which is
 * exactly the false positive that made the first two Ciclos look broken.
 *
 * The node is flagged `walk`, so it is recorded as a position without being
 * judged as a jump.
 */
function sealExit(result: ChunkResult) {
  const last = result.path[result.path.length - 1];
  if (!last) {
    result.path.push({ ...result.exit, walk: true });
    return;
  }
  const same =
    Math.hypot(last.x - result.exit.x, last.z - result.exit.z) < 1e-6 &&
    Math.abs(last.y - result.exit.y) < 1e-6;
  if (!same) result.path.push({ ...result.exit, walk: true });
}

/**
 * Whether a chunk's own internal route is legal. A chunk that fails this is a
 * bug in the chunk, not in the composition, so the composer swaps it for the
 * fallback rather than trying to repair someone else's geometry (edge case E-09).
 */
function chunkIsSound(result: ChunkResult, arc: ArcParams): boolean {
  return findUnreachable(result.path, arc, CONFIG.level.reachSafety).length === 0;
}

/**
 * Guarantees the Ciclo has something worth going out of your way for.
 *
 * Most chunks carry their own risk Fragmento, but a Ciclo can legitimately draw
 * a hand of chunks that all happen to be safe ones — and a Ciclo with no reason
 * to leave the critical path is a Ciclo with no decisions in it. When that
 * happens, one is hung over the middle of the longest jump on the route: the
 * risk is not a detour, it is having to actually commit to the gap rather than
 * scrape across it. (REQ-024.20)
 */
function ensureRiskFragment(bp: Blueprint) {
  if (bp.fragments.some((f) => f.tier === 'risk')) return;

  let best: { from: PathNode; to: PathNode; span: number } | null = null;
  for (let i = 1; i < bp.path.length; i++) {
    const to = bp.path[i];
    if (to.walk) continue;
    const from = bp.path[i - 1];
    const span = Math.hypot(to.x - from.x, to.z - from.z);
    if (!best || span > best.span) best = { from, to, span };
  }
  if (!best || best.span < 3) return;

  bp.fragments.push({
    position: {
      x: (best.from.x + best.to.x) / 2,
      y: Math.max(best.from.y, best.to.y) + 2.6,
      z: (best.from.z + best.to.z) / 2,
    },
    tier: 'risk',
  });
}

/**
 * Builds the blueprint for Ciclo `level`.
 *
 * `seed` defaults to a function of the Ciclo, which is what makes progression
 * reproducible (REQ-024.21); tests override it to sweep the space.
 */
export function composeLevel(level: number, seed = 1000 + level * 7919): Blueprint {
  const rand = rng(seed);
  const arc = arcFor();
  const spec = CONFIG.levelSpec(level);

  const bp: Blueprint = {
    level,
    platforms: [],
    path: [],
    fragments: [],
    beacons: [],
    enemySlots: [],
    sequence: [],
    origin: { x: 0, y: 1.2, z: 0 },
    exit: { x: 0, y: 1.2, z: 0 },
  };

  // The Ciclo always opens on solid, generous ground: the player needs one
  // stretch to find the controls before the level asks anything of them.
  const start: PlatformDesc = {
    kind: 'platform',
    position: { x: 0, y: 0.7, z: 0 },
    size: { x: 12, y: 1, z: 12 },
  };
  bp.platforms.push(start);
  bp.path.push({ x: 0, y: 0.7, z: 0 });
  // The walk from the centre of the starting plaza to its leading edge: the
  // first chunk is entered from here, not from the spawn point.
  bp.path.push({ x: 0, y: 0.7, z: -5, walk: true });
  bp.beacons.push({ x: 0, y: 1.6, z: 0 });

  let entry: Vec3 = { x: 0, y: 0.7, z: -5 };
  let tensionRun = 0;
  let previousId: string | null = null;

  const count = Math.max(1, spec.chunks);
  for (let i = 0; i < count; i++) {
    let chunk = chooseChunk(rand, level, tensionRun, previousId);

    // Past the halfway mark with no Baliza yet, the next chunk is one. Falling
    // into the void has to cost a layer of Núcleo, never the whole Ciclo, and
    // the only thing standing between those two outcomes is a checkpoint.
    const needsBeacon = bp.beacons.length <= 1 && i >= Math.floor(count / 2);
    if (needsBeacon && chunk.id !== 'rest_beacon') {
      chunk = CHUNKS.find((c) => c.id === 'rest_beacon') ?? chunk;
    }
    const ctx = { entry, level, rand, arc, safety: CONFIG.level.reachSafety };
    let result = fitChunk(safeBuild(chunk, ctx), entry, arc);
    sealExit(result);

    if (!chunkIsSound(result, arc)) {
      chunk = FALLBACK_CHUNK;
      result = fitChunk(safeBuild(chunk, ctx), entry, arc);
      sealExit(result);
    }

    bp.sequence.push(chunk.id);
    bp.platforms.push(...result.platforms);
    bp.path.push(...result.path);
    bp.fragments.push(...result.fragments);
    bp.enemySlots.push(...result.enemySlots);
    if (result.beacon) bp.beacons.push(result.beacon);

    tensionRun = chunk.intensity === 2 ? tensionRun + 1 : 0;
    previousId = chunk.id;
    entry = result.exit;
  }

  // Always close on a Baliza: finishing a Ciclo on a collapsing walkway with the
  // last Fragmento three metres away is a cheap way to lose a run.
  const closing = fitChunk(
    FALLBACK_CHUNK.build({ entry, level, rand, arc, safety: CONFIG.level.reachSafety }),
    entry,
    arc,
  );
  sealExit(closing);
  bp.platforms.push(...closing.platforms);
  bp.path.push(...closing.path);
  bp.fragments.push(...closing.fragments);
  bp.sequence.push(FALLBACK_CHUNK.id);
  bp.exit = closing.exit;

  if (level >= 2) ensureRiskFragment(bp);

  return bp;
}

/** A chunk that throws must never take the Ciclo with it (edge case E-09). */
function safeBuild(chunk: Chunk, ctx: Parameters<Chunk['build']>[0]): ChunkResult {
  try {
    const result = chunk.build(ctx);
    if (!result?.platforms?.length) throw new Error(`chunk "${chunk.id}" produced nothing`);
    return result;
  } catch {
    return FALLBACK_CHUNK.build(ctx);
  }
}

/** Exposed for the traceability tests. */
export { CHUNKS, findUnreachable };
