import { describe, it, expect } from 'vitest';
import {
  apexHeight,
  riseTime,
  airTime,
  maxJumpDistance,
  isReachable,
  clampGap,
  maxStepUp,
} from '../src/domain/jump-arc.js';
import type { ArcParams } from '../src/domain/jump-arc.js';

const P: ArcParams = { gravity: 20, jump: 12.5, speed: 14, fallMultiplier: 1.55 };

describe('Jump arc — REQ-024.17', () => {
  it('derives apex height as v0 squared over 2g', () => {
    expect(apexHeight(P)).toBeCloseTo((12.5 * 12.5) / (2 * 20), 6);
  });

  it('derives rise time as v0 over g', () => {
    expect(riseTime(P)).toBeCloseTo(12.5 / 20, 6);
  });

  it('falls faster than it rises when the fall multiplier is above 1', () => {
    const rise = riseTime(P);
    const total = airTime(P, 0);
    expect(total - rise).toBeLessThan(rise);
  });

  it('reaches less horizontal distance the higher the target ledge', () => {
    const flat = maxJumpDistance(P, 0);
    const up1 = maxJumpDistance(P, 1);
    const up2 = maxJumpDistance(P, 2);
    expect(flat).toBeGreaterThan(up1);
    expect(up1).toBeGreaterThan(up2);
  });

  it('reaches further when dropping down than when staying level', () => {
    expect(maxJumpDistance(P, -3)).toBeGreaterThan(maxJumpDistance(P, 0));
  });

  it('returns zero reach for a ledge above the apex', () => {
    expect(maxJumpDistance(P, apexHeight(P) + 1)).toBe(0);
    expect(maxJumpDistance(P, 100)).toBe(0);
  });

  it('keeps the flat jump inside the designed feel window of 14 to 16 units', () => {
    const flat = maxJumpDistance(P, 0);
    expect(flat).toBeGreaterThanOrEqual(14);
    expect(flat).toBeLessThanOrEqual(16);
  });

  it('treats a zero or negative gap as trivially reachable', () => {
    expect(isReachable(P, 0, 0)).toBe(true);
    expect(isReachable(P, -5, 0)).toBe(true);
  });

  it('rejects a gap beyond the safety fraction of the theoretical reach', () => {
    const limit = maxJumpDistance(P, 0) * 0.62;
    expect(isReachable(P, limit - 0.01, 0)).toBe(true);
    expect(isReachable(P, limit + 0.01, 0)).toBe(false);
  });

  it('clamps an impossible gap down to the reachable limit', () => {
    const clamped = clampGap(P, 999, 0);
    expect(isReachable(P, clamped, 0)).toBe(true);
    expect(clamped).toBeGreaterThan(0);
  });

  it('clamps to zero when the ledge cannot be reached at any distance', () => {
    expect(clampGap(P, 5, 50)).toBe(0);
  });

  it('never proposes a step up higher than the apex', () => {
    expect(maxStepUp(P)).toBeLessThan(apexHeight(P));
    expect(maxJumpDistance(P, maxStepUp(P))).toBe(0);
    expect(maxJumpDistance(P, maxStepUp(P) - 0.2)).toBeGreaterThan(0);
  });

  it('degrades safely when gravity is zero instead of returning NaN', () => {
    const weightless: ArcParams = { gravity: 0, jump: 12.5, speed: 14 };
    expect(apexHeight(weightless)).toBe(Infinity);
    expect(Number.isNaN(maxJumpDistance(weightless, 0))).toBe(false);
  });
});
