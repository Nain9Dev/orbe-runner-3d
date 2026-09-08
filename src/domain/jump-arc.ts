/**
 * Jump arc mathematics.
 *
 * The level composer must never place a gap that Lúmen physically cannot clear.
 * Hard-coding "max gap = 10" would silently break the moment anyone tunes gravity
 * or the jump impulse, so the reachable distance is derived from the same numbers
 * the physics system uses.
 *
 * Domain layer: this module imports nothing and knows nothing about the engine.
 */

export interface ArcParams {
  /** Downward acceleration magnitude, in units per second squared. Always positive. */
  gravity: number;
  /** Upward velocity applied on jump, in units per second. */
  jump: number;
  /** Horizontal movement speed, in units per second. */
  speed: number;
  /**
   * Gravity multiplier applied while descending. Values above 1 make the fall
   * snappier, which shortens the arc — the composer must account for it.
   */
  fallMultiplier?: number;
}

/** Peak height above the launch point, in units. */
export function apexHeight(p: ArcParams): number {
  if (p.gravity <= 0) return Infinity;
  return (p.jump * p.jump) / (2 * p.gravity);
}

/** Time from launch to apex, in seconds. */
export function riseTime(p: ArcParams): number {
  if (p.gravity <= 0) return Infinity;
  return p.jump / p.gravity;
}

/**
 * Time spent descending from the apex to a landing point `dh` units above the
 * launch height. Returns `Infinity` when the apex never reaches that height.
 */
export function fallTime(p: ArcParams, dh: number): number {
  const apex = apexHeight(p);
  const drop = apex - dh;
  if (drop < 0) return Infinity;
  const g = p.gravity * (p.fallMultiplier ?? 1);
  if (g <= 0) return Infinity;
  return Math.sqrt((2 * drop) / g);
}

/** Total time in the air for a jump that lands `dh` units above the launch height. */
export function airTime(p: ArcParams, dh = 0): number {
  return riseTime(p) + fallTime(p, dh);
}

/**
 * Longest horizontal distance a jump can cover while gaining `dh` units of
 * height. Returns 0 when the height difference exceeds the apex, i.e. when the
 * ledge simply cannot be reached by jumping.
 *
 * The model deliberately ignores the apex hang-time bonus and any air
 * acceleration, so the number it returns is a lower bound on the true reach.
 * A composer that trusts it is conservative, never optimistic.
 */
export function maxJumpDistance(p: ArcParams, dh = 0): number {
  const apex = apexHeight(p);
  // A small margin below the apex: landing exactly at the peak means arriving
  // with zero vertical clearance, which in practice clips the ledge.
  if (dh >= apex * 0.92) return 0;
  const t = airTime(p, dh);
  if (!Number.isFinite(t)) return 0;
  return p.speed * t;
}

/**
 * Whether a gap is jumpable with a safety margin.
 *
 * `safety` is the fraction of the theoretical reach the composer is allowed to
 * use (0.62 by default): a level built at 100 % of the maximum would demand a
 * frame-perfect jump from a full run-up on every single gap.
 */
export function isReachable(
  p: ArcParams,
  horizontal: number,
  dh: number,
  safety = 0.62,
): boolean {
  if (horizontal <= 0) return true;
  return horizontal <= maxJumpDistance(p, dh) * safety;
}

/**
 * Clamp a proposed gap to the largest reachable one, preserving direction.
 * Used by the composer as a last-resort corrector when a chunk's natural
 * spacing would produce an impossible jump.
 */
export function clampGap(
  p: ArcParams,
  horizontal: number,
  dh: number,
  safety = 0.62,
): number {
  const limit = maxJumpDistance(p, dh) * safety;
  if (limit <= 0) return 0;
  return Math.min(horizontal, limit);
}

/**
 * Largest height gain that is worth attempting at all, i.e. the apex minus the
 * clearance margin. The composer uses it to cap vertical steps between chunks.
 */
export function maxStepUp(p: ArcParams): number {
  return apexHeight(p) * 0.92;
}
