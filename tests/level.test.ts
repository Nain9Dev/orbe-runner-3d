import { describe, it, expect } from 'vitest';
import { composeLevel, arcFor } from '../src/game/composer.js';
import { CHUNKS, findUnreachable, chunksFor, chunkById } from '../src/game/chunks.js';
import { CONFIG } from '../src/config.js';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

describe('Chunk library — REQ-024.16', () => {
  it('exposes at least eight authored chunks', () => {
    expect(CHUNKS.length).toBeGreaterThanOrEqual(8);
  });

  it('declares a complete descriptor for every chunk', () => {
    for (const c of CHUNKS) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.name).toBe('string');
      expect([0, 1, 2]).toContain(c.intensity);
      expect(c.minLevel).toBeGreaterThanOrEqual(1);
      expect(typeof c.build).toBe('function');
    }
  });

  it('uses unique ids', () => {
    const ids = CHUNKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('always offers a rest chunk, at every level band', () => {
    for (const level of [1, 3, 5, 10, 20]) {
      expect(chunksFor(level).some((c) => c.intensity === 0)).toBe(true);
    }
  });

  it('gates the harder chunks behind a level', () => {
    expect(chunksFor(1).some((c) => c.id === 'pillar_field')).toBe(false);
    expect(chunksFor(9).some((c) => c.id === 'pillar_field')).toBe(true);
    expect(chunkById('anchor_bridge')?.minLevel).toBe(1);
  });
});

describe('Ciclo composer', () => {
  it('is deterministic for a given Ciclo — REQ-024.21', () => {
    const a = composeLevel(7);
    const b = composeLevel(7);
    expect(a.sequence).toEqual(b.sequence);
    expect(a.platforms.length).toBe(b.platforms.length);
    expect(a.platforms[3].position).toEqual(b.platforms[3].position);
    expect(a.fragments.map((f) => f.position)).toEqual(b.fragments.map((f) => f.position));
  });

  it('produces different Ciclos for different numbers', () => {
    expect(composeLevel(2).sequence).not.toEqual(composeLevel(9).sequence);
  });

  it('never places an unreachable jump on the critical path — REQ-024.17', () => {
    const arc = arcFor();
    for (const seed of SEEDS) {
      const bp = composeLevel(seed);
      const bad = findUnreachable(bp.path, arc, CONFIG.level.reachSafety);
      expect(
        bad,
        `Ciclo ${seed} has ${bad.length} unreachable gap(s): ` +
          bad.map((b) => `${b.horizontal.toFixed(1)}u > ${b.limit.toFixed(1)}u`).join(', '),
      ).toEqual([]);
    }
  });

  it('never runs more tension chunks back to back than the rhythm allows — REQ-024.18', () => {
    for (const seed of SEEDS) {
      const bp = composeLevel(seed);
      let run = 0;
      for (const id of bp.sequence) {
        const chunk = chunkById(id);
        run = chunk?.intensity === 2 ? run + 1 : 0;
        expect(run, `Ciclo ${seed} sequence ${bp.sequence.join(' > ')}`)
          .toBeLessThanOrEqual(CONFIG.level.maxTensionRun);
      }
    }
  });

  it('never repeats a chunk immediately', () => {
    for (const seed of SEEDS) {
      const seq = composeLevel(seed).sequence;
      for (let i = 1; i < seq.length - 1; i++) {
        expect(seq[i], `Ciclo ${seed}`).not.toBe(seq[i - 1]);
      }
    }
  });

  it('places at least one Baliza in every Ciclo — REQ-024.19', () => {
    for (const seed of SEEDS) {
      expect(composeLevel(seed).beacons.length, `Ciclo ${seed}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('offers risk Fragmentos from Ciclo 2 onwards — REQ-024.20', () => {
    for (const seed of SEEDS.filter((s) => s >= 2)) {
      const bp = composeLevel(seed);
      const risky = bp.fragments.filter((f) => f.tier === 'risk');
      expect(risky.length, `Ciclo ${seed}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('always offers more path Fragmentos than risk ones', () => {
    for (const seed of SEEDS) {
      const bp = composeLevel(seed);
      const path = bp.fragments.filter((f) => f.tier === 'path').length;
      const risk = bp.fragments.filter((f) => f.tier === 'risk').length;
      expect(path, `Ciclo ${seed}`).toBeGreaterThan(risk);
    }
  });

  it('grows the Ciclo with its number but caps the length', () => {
    expect(composeLevel(1).sequence.length).toBeLessThan(composeLevel(12).sequence.length);
    expect(composeLevel(40).sequence.length).toBeLessThanOrEqual(CONFIG.level.maxChunks + 1);
  });

  it('starts every Ciclo on solid ground at the origin', () => {
    const bp = composeLevel(5);
    expect(bp.origin).toEqual({ x: 0, y: 1.2, z: 0 });
    const start = bp.platforms[0];
    expect(start.kind).toBe('platform');
    expect(start.size.x).toBeGreaterThanOrEqual(10);
  });

  it('ends every Ciclo on the safe fallback chunk', () => {
    for (const seed of SEEDS) {
      const seq = composeLevel(seed).sequence;
      expect(seq[seq.length - 1], `Ciclo ${seed}`).toBe('anchor_bridge');
    }
  });

  it('runs the route away from the origin so the Ciclo reads as a journey', () => {
    const bp = composeLevel(6);
    expect(bp.exit.z).toBeLessThan(-40);
  });

  it('reserves enemy slots without putting one on the starting platform', () => {
    for (const seed of SEEDS) {
      const bp = composeLevel(seed);
      for (const slot of bp.enemySlots) {
        expect(Math.hypot(slot.x, slot.z), `Ciclo ${seed}`).toBeGreaterThan(8);
      }
    }
  });

  it('produces enough Fragmentos to be worth collecting at every Ciclo', () => {
    for (const seed of SEEDS) {
      expect(composeLevel(seed).fragments.length, `Ciclo ${seed}`).toBeGreaterThanOrEqual(5);
    }
  });
});
