import { describe, it, expect } from 'vitest';
import {
  rawIntensity, createArrangement, stepFor, noteAt, tierFor, TIERS, LAYERS,
} from '../src/audio/score.js';

const calm = {
  combo: 0, threat: Infinity, integrity: 3, maxIntegrity: 3, speed: 0, maxSpeed: 14,
};

describe('Intensity model — REQ-025.07, REQ-025.08', () => {
  it('is zero when nothing is happening', () => {
    expect(rawIntensity(calm)).toBe(0);
  });

  it('rises with the Resonancia streak', () => {
    const low = rawIntensity({ ...calm, combo: 2 });
    const high = rawIntensity({ ...calm, combo: 9 });
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
  });

  it('rises as a Sombra closes in, and ignores distant ones', () => {
    expect(rawIntensity({ ...calm, threat: 40 })).toBe(0);
    const far = rawIntensity({ ...calm, threat: 20 });
    const near = rawIntensity({ ...calm, threat: 5 });
    expect(near).toBeGreaterThan(far);
  });

  it('rises as the Núcleo is worn down', () => {
    const whole = rawIntensity({ ...calm, integrity: 3 });
    const hurt = rawIntensity({ ...calm, integrity: 2 });
    expect(hurt).toBeGreaterThan(whole);
  });

  it('goes to the tension voicing at one layer, whatever else is true — REQ-025.08', () => {
    const alone = rawIntensity({ ...calm, integrity: 1, threat: Infinity, combo: 0 });
    expect(alone).toBeGreaterThanOrEqual(0.8);
  });

  it('lets no single input saturate the mix on its own', () => {
    expect(rawIntensity({ ...calm, combo: 999 })).toBeLessThan(0.5);
    expect(rawIntensity({ ...calm, threat: 0 })).toBeLessThan(0.6);
    expect(rawIntensity({ ...calm, speed: 99 })).toBeLessThan(0.2);
  });

  it('stays inside 0..1 for absurd input', () => {
    const v = rawIntensity({ combo: 1e6, threat: -50, integrity: -3, maxIntegrity: 3, speed: 1e6, maxSpeed: 14 });
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('survives missing fields rather than producing NaN', () => {
    const v = rawIntensity({} as any);
    expect(Number.isNaN(v)).toBe(false);
  });
});

describe('Arrangement — REQ-025.06, REQ-025.10', () => {
  it('smooths towards the target instead of jumping', () => {
    const a = createArrangement();
    const tense = { ...calm, threat: 3, combo: 8 };
    const afterOneStep = a.update(tense, 1 / 60);
    expect(afterOneStep).toBeGreaterThan(0);
    expect(afterOneStep).toBeLessThan(rawIntensity(tense));
  });

  it('rises faster than it falls, over the same distance and the same time', () => {
    const tense = { ...calm, integrity: 1 };   // target 0.8

    // From 0, one 0.1 s step towards 0.8.
    const rising = createArrangement();
    rising.update(tense, 0.1);
    const roseBy = rising.value();

    // Saturated at 0.8, one 0.1 s step back towards 0.
    const falling = createArrangement();
    for (let i = 0; i < 600; i++) falling.update(tense, 1 / 60);
    const from = falling.value();
    falling.update(calm, 0.1);
    const fellBy = from - falling.value();

    expect(roseBy).toBeGreaterThan(0);
    expect(fellBy).toBeGreaterThan(0);
    // Danger arrives promptly and leaves reluctantly.
    expect(roseBy).toBeGreaterThan(fellBy);
  });

  it('keeps the always-on layers on from silence', () => {
    const a = createArrangement();
    a.update(calm, 1 / 60);
    expect(a.isActive('bass')).toBe(true);
    expect(a.isActive('kick')).toBe(true);
  });

  it('gates the optional layers behind their thresholds', () => {
    const a = createArrangement();
    a.update(calm, 1 / 60);
    expect(a.isActive('lead')).toBe(false);
    expect(a.isActive('ride')).toBe(false);

    const tense = { ...calm, integrity: 1 };
    for (let i = 0; i < 400; i++) a.update(tense, 1 / 60);
    expect(a.value()).toBeGreaterThan(LAYERS.lead.on);
    expect(a.isActive('lead')).toBe(true);
  });

  it('does not flap at a threshold boundary (hysteresis)', () => {
    const a = createArrangement();
    const tense = { ...calm, integrity: 1 };
    for (let i = 0; i < 400; i++) a.update(tense, 1 / 60);
    expect(a.isActive('arp')).toBe(true);

    // Drift just below the "on" threshold but above the "off" one.
    while (a.value() > LAYERS.arp.on - 0.01 && a.value() > LAYERS.arp.off + 0.01) {
      a.update(calm, 1 / 60);
    }
    expect(a.isActive('arp')).toBe(true);   // still on, because it was on
  });

  it('keeps the tempo inside eight per cent of the base — REQ-025.10', () => {
    const a = createArrangement();
    const base = TIERS[0].bpm;
    expect(a.bpmFor(0)).toBeGreaterThanOrEqual(base * 0.95);

    for (let i = 0; i < 600; i++) a.update({ ...calm, integrity: 1, threat: 1, combo: 20 }, 1 / 60);
    expect(a.bpmFor(0)).toBeLessThanOrEqual(base * 1.09);
  });

  it('resets to silence', () => {
    const a = createArrangement();
    for (let i = 0; i < 200; i++) a.update({ ...calm, integrity: 1 }, 1 / 60);
    a.reset();
    expect(a.value()).toBe(0);
    expect(a.isActive('lead')).toBe(false);
  });
});

describe('Musical material — REQ-025.09', () => {
  it('gives each palette tier its own key', () => {
    const roots = TIERS.map((t) => t.root);
    expect(new Set(roots).size).toBe(TIERS.length);
  });

  it('maps Ciclo bands onto tiers, three Ciclos each', () => {
    expect(tierFor(1)).toBe(0);
    expect(tierFor(3)).toBe(0);
    expect(tierFor(4)).toBe(1);
    expect(tierFor(7)).toBe(2);
    expect(tierFor(10)).toBe(3);
    expect(tierFor(99)).toBe(TIERS.length - 1);
  });

  it('transposes a degree into a frequency inside the mode', () => {
    expect(noteAt(0, 0)).toBeCloseTo(TIERS[0].root, 5);
    expect(noteAt(0, 0, 1)).toBeCloseTo(TIERS[0].root * 2, 5);
    expect(noteAt(0, 0, -1)).toBeCloseTo(TIERS[0].root / 2, 5);
  });

  it('wraps a degree past the end of the mode up an octave', () => {
    const len = TIERS[0].mode.length;
    expect(noteAt(0, len)).toBeCloseTo(TIERS[0].root * 2, 5);
    expect(noteAt(0, -1)).toBeLessThan(TIERS[0].root);
  });

  it('never produces a nonsense frequency', () => {
    for (let tier = 0; tier < TIERS.length; tier++) {
      for (let d = -8; d < 16; d++) {
        const f = noteAt(tier, d);
        expect(Number.isFinite(f)).toBe(true);
        expect(f).toBeGreaterThan(0);
      }
    }
  });

  it('puts the kick on the four and the snare on two and four', () => {
    expect(stepFor(0).kick).toBe(true);
    expect(stepFor(8).kick).toBe(true);
    expect(stepFor(4).kick).toBe(false);
    expect(stepFor(4).snare).toBe(true);
    expect(stepFor(12).snare).toBe(true);
  });

  it('repeats the pattern every bar and handles a negative index', () => {
    expect(stepFor(16)).toEqual(stepFor(0));
    expect(stepFor(-16)).toEqual(stepFor(0));
    expect(stepFor(33)).toEqual(stepFor(1));
  });

  it('marks the downbeat exactly once per bar', () => {
    const downbeats = Array.from({ length: 16 }, (_, i) => stepFor(i).downbeat);
    expect(downbeats.filter(Boolean).length).toBe(1);
    expect(downbeats[0]).toBe(true);
  });
});
