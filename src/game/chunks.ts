/**
 * Chunk library — the authored vocabulary the Ciclo composer speaks.
 *
 * The previous generator drifted a cursor by `range(8, 12)` and hoped the result
 * was jumpable. It produced noise: no rhythm, no readable idea per stretch, and
 * gaps that were sometimes impossible. A chunk is the opposite — a small,
 * deliberate idea ("cross a collapsing walkway", "ride a ferry", "clear one long
 * gap for a prize") with a declared intensity, so the composer can shape a
 * curve out of them instead of a random walk. (REQ-024.16, REQ-024.18)
 *
 * This module is **pure data**. It builds descriptors, never entities, and it
 * imports nothing from Three.js or from the ECS. That is what makes the whole
 * level generator testable in milliseconds with no renderer
 * (`tests/level.test.ts`), and it is why the reachability guarantee can be
 * enforced *before* anything is spawned.
 *
 * Forward is -Z, matching the rest of the game. Positions are box centres.
 */

import { clampGap, maxJumpDistance, maxStepUp } from '../domain/jump-arc.js';
import type { ArcParams } from '../domain/jump-arc.js';

export interface Vec3 { x: number; y: number; z: number; }

export type PlatformKind =
  | 'platform'
  | 'crumbling'
  | 'moving'
  | 'bounce_pad'
  | 'lava'
  | 'beacon';

export interface PlatformDesc {
  kind: PlatformKind;
  position: Vec3;
  size: Vec3;
  /** Moving platforms only: travel amplitude and axis. */
  sway?: number;
  axis?: 'x' | 'z';
  speed?: number;
}

/** A node on the critical route, i.e. a surface the player is expected to land on. */
export interface PathNode extends Vec3 {
  /** Extra horizontal uncertainty introduced by a moving platform. */
  sway?: number;
  /**
   * True when this node is reached on foot across a continuous surface rather
   * than by jumping. The reachability guard skips those hops — measuring the
   * width of a plaza as if it were a gap would reject every wide platform.
   */
  walk?: boolean;
}

export type FragmentTier = 'path' | 'risk';

export interface FragmentDesc {
  position: Vec3;
  tier: FragmentTier;
}

export interface ChunkResult {
  platforms: PlatformDesc[];
  path: PathNode[];
  fragments: FragmentDesc[];
  /** Positions where the composer may place Sombras without blocking the route. */
  enemySlots: Vec3[];
  /** Whether this chunk carries a Baliza (checkpoint). */
  beacon?: Vec3;
  exit: Vec3;
}

export interface ChunkContext {
  /** Surface the player arrives from: the exit of the previous chunk. */
  entry: Vec3;
  level: number;
  rand: () => number;
  arc: ArcParams;
  safety: number;
}

export interface Chunk {
  id: string;
  /** Name used by the HUD toast and by the lore bible. */
  name: string;
  /** 0 = rest, 1 = steady, 2 = tension. Drives the composer's rhythm. */
  intensity: 0 | 1 | 2;
  minLevel: number;
  build(ctx: ChunkContext): ChunkResult;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/**
 * Largest forward step this chunk may take for a given rise, already reduced by
 * the safety fraction. Every chunk sizes its gaps through this function, which
 * is why the composer's reachability guard almost never has to correct anything.
 */
function step(ctx: ChunkContext, dh: number, want: number): number {
  return clampGap(ctx.arc, want, dh, ctx.safety);
}

/** A rise the player can definitely clear, capped below the jump apex. */
function rise(ctx: ChunkContext, want: number): number {
  return Math.min(want, maxStepUp(ctx.arc) * 0.7);
}

const between = (rand: () => number, a: number, b: number) => a + rand() * (b - a);

/** A fragment hovering above a surface, at the height Lúmen naturally passes through. */
function overNode(n: Vec3, dx = 0, dz = 0, dy = 1.4): Vec3 {
  return v(n.x + dx, n.y + dy, n.z + dz);
}

/**
 * Where the player actually lands on a wide platform: just inside its leading
 * edge, not at its centre. Measuring a jump to the centre of a 16-unit plaza
 * would make every plaza look unreachable to the guard.
 */
function landingOn(centre: Vec3, size: Vec3, offsetX = 0, inset = 1): Vec3 {
  return v(centre.x + offsetX, centre.y, centre.z + size.z / 2 - inset);
}

/** Where the player leaves a wide platform: just inside its far edge. */
function departFrom(centre: Vec3, size: Vec3, offsetX = 0, inset = 1): Vec3 {
  return v(centre.x + offsetX, centre.y, centre.z - size.z / 2 + inset);
}

/* -------------------------------------------------------------------------- */
/* The library                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * ANCHOR BRIDGE — «Puente de Anclaje».
 *
 * The safety net of the library: a straight, gently rising walkway that is
 * reachable by construction. The composer falls back to it whenever a candidate
 * chunk cannot satisfy the reach constraint (edge case E-09).
 */
const anchorBridge: Chunk = {
  id: 'anchor_bridge',
  name: 'Puente de Anclaje',
  intensity: 0,
  minLevel: 1,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const path: PathNode[] = [];
    const fragments: FragmentDesc[] = [];
    let cursor = { ...ctx.entry };

    for (let i = 0; i < 4; i++) {
      const dh = 0.4;
      const dz = step(ctx, dh, 7);
      cursor = v(cursor.x, cursor.y + dh, cursor.z - dz);
      platforms.push({ kind: 'platform', position: cursor, size: v(6, 1, 6) });
      path.push({ ...cursor });
      if (i % 2 === 1) fragments.push({ position: overNode(cursor), tier: 'path' });
    }

    return { platforms, path, fragments, enemySlots: [], exit: cursor };
  },
};

/**
 * REST BEACON — «Baliza de Reanclaje».
 *
 * The exhale. A wide, hazard-free plateau carrying the checkpoint Lúmen respawns
 * at. Without these the chunk curve is a flat wall of tension and the player
 * stops reading the difficulty at all. (REQ-024.19)
 */
const restBeacon: Chunk = {
  id: 'rest_beacon',
  name: 'Baliza de Reanclaje',
  intensity: 0,
  minLevel: 1,
  build(ctx) {
    const dh = 0.2;
    const size = v(14, 1, 14);
    const dz = step(ctx, dh, 8);
    const centre = v(ctx.entry.x, ctx.entry.y + dh, ctx.entry.z - dz - size.z / 2 + 1);

    return {
      platforms: [{ kind: 'platform', position: centre, size }],
      path: [landingOn(centre, size)],
      fragments: [
        { position: overNode(centre, -3, 0), tier: 'path' },
        { position: overNode(centre, 3, 0), tier: 'path' },
      ],
      enemySlots: [],
      beacon: v(centre.x, centre.y + 0.9, centre.z),
      exit: departFrom(centre, size),
    };
  },
};

/**
 * SPIRAL ASCENT — «Ascenso Espiral».
 *
 * Gains height while turning, which forces the camera to move and breaks the
 * tunnel-vision of a straight corridor.
 */
const spiralAscent: Chunk = {
  id: 'spiral_ascent',
  name: 'Ascenso Espiral',
  intensity: 1,
  minLevel: 1,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const path: PathNode[] = [];
    const fragments: FragmentDesc[] = [];
    const turn = ctx.rand() < 0.5 ? 1 : -1;
    let cursor = { ...ctx.entry };

    for (let i = 0; i < 4; i++) {
      const dh = rise(ctx, 1.6);
      const reach = step(ctx, dh, 8);
      const angle = (i + 1) * (Math.PI / 5) * turn;
      cursor = v(
        cursor.x + Math.sin(angle) * reach * 0.55,
        cursor.y + dh,
        cursor.z - Math.cos(angle) * reach * 0.85,
      );
      platforms.push({ kind: 'platform', position: cursor, size: v(5.5, 1, 5.5) });
      path.push({ ...cursor });
      fragments.push({ position: overNode(cursor), tier: 'path' });
    }

    return { platforms, path, fragments, enemySlots: [{ ...cursor }], exit: cursor };
  },
};

/**
 * CRUMBLE GAUNTLET — «Sendero Efímero».
 *
 * Every tile collapses shortly after being touched, so the chunk is a commitment:
 * once you step on the first tile you are running the whole thing. The prize sits
 * at the far end, off the safe line, so stopping to grab it costs a tile's worth
 * of collapse timer.
 */
const crumbleGauntlet: Chunk = {
  id: 'crumble_gauntlet',
  name: 'Sendero Efímero',
  intensity: 2,
  minLevel: 3,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const path: PathNode[] = [];
    const fragments: FragmentDesc[] = [];
    let cursor = { ...ctx.entry };
    const drift = between(ctx.rand, -1.6, 1.6);

    for (let i = 0; i < 5; i++) {
      const dz = step(ctx, 0, 6.5);
      cursor = v(cursor.x + drift, cursor.y, cursor.z - dz);
      platforms.push({ kind: 'crumbling', position: cursor, size: v(5, 1, 5) });
      path.push({ ...cursor });
      if (i === 2) fragments.push({ position: overNode(cursor), tier: 'path' });
    }

    // The prize: a Fragmento off the running line, on a tile of its own.
    const side = ctx.rand() < 0.5 ? -1 : 1;
    const prize = v(cursor.x + side * 6.5, cursor.y, cursor.z + 3);
    platforms.push({ kind: 'crumbling', position: prize, size: v(4, 1, 4) });
    fragments.push({ position: overNode(prize), tier: 'risk' });

    return { platforms, path, fragments, enemySlots: [], exit: cursor };
  },
};

/**
 * MOVING FERRY — «Transporte de Vacío».
 *
 * A platform that sweeps sideways between two static anchors. Timing, not
 * precision. The path node records the sway so the reachability guard measures
 * the worst case rather than the average one.
 */
const movingFerry: Chunk = {
  id: 'moving_ferry',
  name: 'Transporte de Vacío',
  intensity: 1,
  minLevel: 2,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const path: PathNode[] = [];
    // The sway is bounded by the reach budget: the guard measures the ferry at
    // its furthest excursion, so a wide sweep would make its own gap illegal.
    const sway = between(ctx.rand, 3, 4.5);
    const speed = between(ctx.rand, 1.1, 1.9);

    const dockA = v(ctx.entry.x, ctx.entry.y, ctx.entry.z - step(ctx, 0, 7));
    platforms.push({ kind: 'platform', position: dockA, size: v(6, 1, 6) });
    path.push({ ...dockA });

    // The ferry sits closer than a normal gap because its sway adds distance.
    const ferry = v(dockA.x, dockA.y, dockA.z - step(ctx, 0, 7) * 0.4);
    platforms.push({ kind: 'moving', position: ferry, size: v(5, 1, 5), sway, axis: 'x', speed });
    path.push({ ...ferry, sway });

    const dockB = v(dockA.x, dockA.y + 0.5, ferry.z - step(ctx, 0.5, 7) * 0.55);
    platforms.push({ kind: 'platform', position: dockB, size: v(6, 1, 6) });
    path.push({ ...dockB });

    return {
      platforms,
      path,
      fragments: [
        { position: overNode(ferry), tier: 'path' },
        { position: overNode(dockB), tier: 'path' },
      ],
      enemySlots: [{ ...dockB }],
      exit: dockB,
    };
  },
};

/**
 * BOUNCE TOWERS — «Torres de Impulso».
 *
 * Vertical play. Pads throw Lúmen far above the normal apex, so the chunk can
 * legally place a ledge higher than a jump reaches — the reachability guard is
 * told about it through a normal-height landing node plus the pad below it.
 */
const bounceTowers: Chunk = {
  id: 'bounce_towers',
  name: 'Torres de Impulso',
  intensity: 1,
  minLevel: 1,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const path: PathNode[] = [];
    const fragments: FragmentDesc[] = [];

    const padBase = v(ctx.entry.x, ctx.entry.y, ctx.entry.z - step(ctx, 0, 7));
    platforms.push({ kind: 'platform', position: padBase, size: v(6, 1, 6) });
    platforms.push({ kind: 'bounce_pad', position: v(padBase.x, padBase.y + 0.75, padBase.z), size: v(2.4, 0.5, 2.4) });
    path.push({ ...padBase });

    // Reachable only via the pad: high, and rewarded accordingly.
    const perch = v(padBase.x + between(ctx.rand, -3, 3), padBase.y + 6.5, padBase.z - 7);
    platforms.push({ kind: 'platform', position: perch, size: v(5, 1, 5) });
    fragments.push({ position: overNode(perch), tier: 'risk' });

    const landing = v(padBase.x, padBase.y + 1.2, padBase.z - step(ctx, 1.2, 8));
    platforms.push({ kind: 'platform', position: landing, size: v(6, 1, 6) });
    path.push({ ...landing });
    fragments.push({ position: overNode(landing), tier: 'path' });

    return { platforms, path, fragments, enemySlots: [{ ...landing }], exit: landing };
  },
};

/**
 * PILLAR FIELD — «Campo de Pilares».
 *
 * Small tops, short hops, no room to be sloppy. The chunk that rewards learning
 * the exact length of a jump.
 */
const pillarField: Chunk = {
  id: 'pillar_field',
  name: 'Campo de Pilares',
  intensity: 2,
  minLevel: 4,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const path: PathNode[] = [];
    const fragments: FragmentDesc[] = [];
    let cursor = { ...ctx.entry };

    for (let i = 0; i < 5; i++) {
      const dh = between(ctx.rand, -0.8, 1.2);
      const dz = step(ctx, Math.max(0, dh), 6);
      cursor = v(cursor.x + between(ctx.rand, -3, 3), cursor.y + dh, cursor.z - dz);
      platforms.push({ kind: 'platform', position: cursor, size: v(3.2, 3, 3.2) });
      path.push({ ...cursor });
      fragments.push({ position: overNode(cursor, 0, 0, 2.4), tier: i === 4 ? 'risk' : 'path' });
    }

    return { platforms, path, fragments, enemySlots: [], exit: cursor };
  },
};

/**
 * PLASMA FORD — «Vado de Plasma».
 *
 * A wide floor cut by lava. There is always a dry line through it, but the line
 * is narrow and the Sombras know where it is.
 */
const plasmaFord: Chunk = {
  id: 'plasma_ford',
  name: 'Vado de Plasma',
  intensity: 2,
  minLevel: 3,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const size = v(16, 1, 16);
    const lane = ctx.rand() < 0.5 ? -1 : 1;
    const dz = step(ctx, 0, 7);
    const centre = v(ctx.entry.x - lane * 4.5, ctx.entry.y, ctx.entry.z - dz - size.z / 2 + 1);

    platforms.push({ kind: 'platform', position: centre, size });

    // Two pools leaving a safe lane; which side the lane falls on is seeded.
    platforms.push({
      kind: 'lava',
      position: v(centre.x - lane * 4.5, centre.y + 0.6, centre.z + 3),
      size: v(6, 0.2, 7),
    });
    platforms.push({
      kind: 'lava',
      position: v(centre.x - lane * 4.5, centre.y + 0.6, centre.z - 4),
      size: v(6, 0.2, 6),
    });

    const landing = landingOn(centre, size, lane * 4.5);
    const exit = departFrom(centre, size, lane * 4.5);

    return {
      platforms,
      path: [landing, { ...exit, walk: true }],
      fragments: [
        { position: overNode(landing), tier: 'path' },
        // Straight over a pool: only an Impulso gets you there and back.
        { position: overNode(v(centre.x - lane * 4.5, centre.y, centre.z), 0, 0, 2.2), tier: 'risk' },
      ],
      enemySlots: [{ ...centre }],
      exit,
    };
  },
};

/**
 * VOID LEAP — «Salto del Vacío».
 *
 * One gap, deliberately sized at the top of the safe envelope, with the prize
 * hanging over the middle of it. The chunk exists to make the player commit to a
 * full-length jump and feel it land.
 */
const voidLeap: Chunk = {
  id: 'void_leap',
  name: 'Salto del Vacío',
  intensity: 2,
  minLevel: 2,
  build(ctx) {
    const launch = v(ctx.entry.x, ctx.entry.y, ctx.entry.z - step(ctx, 0, 6));
    // 96 % of the safe envelope: demanding, still inside the guarantee.
    const span = step(ctx, 0, maxJumpDistance(ctx.arc, 0)) * 0.96;
    const landing = v(launch.x + between(ctx.rand, -2, 2), launch.y - 0.5, launch.z - span);

    return {
      platforms: [
        { kind: 'platform', position: launch, size: v(7, 1, 7) },
        { kind: 'platform', position: landing, size: v(7, 1, 7) },
      ],
      path: [{ ...launch }, { ...landing }],
      fragments: [
        {
          position: v((launch.x + landing.x) / 2, launch.y + 2.6, (launch.z + landing.z) / 2),
          tier: 'risk',
        },
        { position: overNode(landing), tier: 'path' },
      ],
      enemySlots: [{ ...landing }],
      exit: landing,
    };
  },
};

/**
 * WATCHED CORRIDOR — «Corredor Vigilado».
 *
 * A long, flat, easy run — and two Centinelas with line of sight down it. The
 * platforming is free; the pressure is entirely the projectiles.
 */
const watchedCorridor: Chunk = {
  id: 'watched_corridor',
  name: 'Corredor Vigilado',
  intensity: 2,
  minLevel: 5,
  build(ctx) {
    const platforms: PlatformDesc[] = [];
    const path: PathNode[] = [];
    const fragments: FragmentDesc[] = [];
    let cursor = { ...ctx.entry };

    for (let i = 0; i < 3; i++) {
      const dz = step(ctx, 0, 8);
      cursor = v(cursor.x, cursor.y, cursor.z - dz);
      platforms.push({ kind: 'platform', position: cursor, size: v(7, 1, 9) });
      path.push({ ...cursor });
      fragments.push({ position: overNode(cursor, between(ctx.rand, -2, 2), 0), tier: 'path' });
    }

    return {
      platforms,
      path,
      fragments,
      enemySlots: [
        v(cursor.x - 5, cursor.y + 1.2, cursor.z + 4),
        v(cursor.x + 5, cursor.y + 1.2, cursor.z - 2),
      ],
      exit: cursor,
    };
  },
};

/**
 * SHATTER YARD — «Patio de Fractura».
 *
 * An open plaza seeded with fragile Sombras. It is the chunk that teaches the
 * Impulso is a weapon: dashing through the pack is faster, safer and worth more
 * Resonancia than walking around it. (REQ-024.14)
 */
const shatterYard: Chunk = {
  id: 'shatter_yard',
  name: 'Patio de Fractura',
  intensity: 1,
  minLevel: 3,
  build(ctx) {
    const size = v(15, 1, 15);
    const dz = step(ctx, 0, 7);
    const centre = v(ctx.entry.x, ctx.entry.y, ctx.entry.z - dz - size.z / 2 + 1);
    const slots: Vec3[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + ctx.rand();
      slots.push(v(centre.x + Math.cos(a) * 5, centre.y + 1.4, centre.z + Math.sin(a) * 5));
    }

    return {
      platforms: [{ kind: 'platform', position: centre, size }],
      path: [landingOn(centre, size)],
      fragments: [
        { position: overNode(centre), tier: 'path' },
        { position: overNode(centre, 0, -5), tier: 'path' },
      ],
      enemySlots: slots,
      exit: departFrom(centre, size),
    };
  },
};

export const CHUNKS: Chunk[] = [
  anchorBridge,
  restBeacon,
  spiralAscent,
  crumbleGauntlet,
  movingFerry,
  bounceTowers,
  pillarField,
  plasmaFord,
  voidLeap,
  watchedCorridor,
  shatterYard,
];

export const FALLBACK_CHUNK = anchorBridge;

export function chunksFor(level: number): Chunk[] {
  return CHUNKS.filter((c) => c.minLevel <= level);
}

export function chunkById(id: string): Chunk | undefined {
  return CHUNKS.find((c) => c.id === id);
}

/* -------------------------------------------------------------------------- */
/* Reachability                                                                */
/* -------------------------------------------------------------------------- */

export interface Violation {
  from: PathNode;
  to: PathNode;
  horizontal: number;
  dh: number;
  limit: number;
}

/**
 * Walks a critical route and reports every gap the player could not clear.
 *
 * A moving node contributes its full sway to the measured distance, so a ferry
 * is judged at its worst position rather than its resting one. The composer runs
 * this before spawning anything and pulls offending nodes back into range; the
 * test suite runs it over thirty seeds as the invariant that REQ-024.17 claims.
 */
export function findUnreachable(path: PathNode[], arc: ArcParams, safety: number): Violation[] {
  const out: Violation[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    if (to.walk) continue;              // continuous surface, not a jump
    const dh = to.y - from.y;
    const horizontal =
      Math.hypot(to.x - from.x, to.z - from.z) + (from.sway ?? 0) + (to.sway ?? 0);
    const limit = maxJumpDistance(arc, dh) * safety;
    // A hair of tolerance: the composer's corrector lands nodes exactly on the
    // limit, and float noise on the order of 1e-14 must not read as a defect.
    if (horizontal > limit + 1e-6) out.push({ from, to, horizontal, dh, limit });
  }
  return out;
}
