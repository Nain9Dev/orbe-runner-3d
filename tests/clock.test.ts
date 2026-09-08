import { describe, it, expect } from 'vitest';
import { createClock } from '../src/audio/clock.js';

/**
 * The clock is the contract that ties the music to the models and the
 * interface. It must be right with no audio at all, which is exactly why it is
 * a module of arithmetic rather than a couple of variables inside the audio
 * system — none of this needs Web Audio to be asserted.
 */
describe('Musical clock — REQ-025.11, REQ-025.12', () => {
  it('starts at bar zero, beat zero', () => {
    const clock = createClock({ bpm: 120 });
    const b = clock.advance(0);
    expect(b.bar).toBe(0);
    expect(b.beat).toBe(0);
    expect(b.phase).toBeCloseTo(0, 6);
  });

  it('treats the first advance as musical zero, whatever the source reads', () => {
    // An AudioContext that has been alive for a while starts at a large value.
    const clock = createClock({ bpm: 120 });
    const b = clock.advance(1234.5);
    expect(b.bar).toBe(0);
    expect(b.beat).toBe(0);
  });

  it('advances one beat per half second at 120 BPM', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(0);
    expect(clock.advance(0.5).beat).toBe(1);
    expect(clock.advance(1.0).beat).toBe(2);
    expect(clock.advance(1.5).beat).toBe(3);
  });

  it('rolls into the next bar after four beats', () => {
    const clock = createClock({ bpm: 120, beatsPerBar: 4 });
    clock.advance(0);
    expect(clock.advance(1.999).bar).toBe(0);
    const b = clock.advance(2.0);
    expect(b.bar).toBe(1);
    expect(b.beat).toBe(0);
  });

  it('reports the sixteenth within the bar', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(0);
    expect(clock.advance(0).sixteenth).toBe(0);
    expect(clock.advance(0.125).sixteenth).toBe(1);   // one sixteenth at 120 BPM
    expect(clock.advance(0.5).sixteenth).toBe(4);
  });

  it('pulses at the onset and decays before the next beat', () => {
    // At 120 BPM a beat is 0.5 s, so phase = seconds / 0.5.
    const clock = createClock({ bpm: 120, pulseDecay: 0.85 });
    clock.advance(0);
    expect(clock.advance(0).pulse).toBeCloseTo(1, 5);

    const early = clock.advance(0.1).pulse;    // phase 0.2
    const late = clock.advance(0.4).pulse;     // phase 0.8
    expect(early).toBeLessThan(1);
    expect(early).toBeGreaterThan(0.5);
    expect(late).toBeLessThan(early);

    // Fully out before the next onset: phase 0.9 is past the 0.85 decay window.
    expect(clock.advance(0.45).pulse).toBe(0);
    expect(clock.advance(0.499).pulse).toBe(0);
  });

  it('accents the downbeat only', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(0);
    expect(clock.advance(0).downbeat).toBeGreaterThan(0);
    expect(clock.advance(0.5).downbeat).toBe(0);       // beat 1, not the downbeat
    expect(clock.advance(2.0).downbeat).toBeGreaterThan(0);
  });

  it('resynchronises after a long gap instead of replaying the missed beats — E-02', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(0);
    clock.advance(0.5);

    // The tab was hidden for a minute.
    const b = clock.advance(60.5);
    expect(b.bar).toBe(30);          // 121 beats in, i.e. bar 30 beat 1
    expect(b.beat).toBe(1);
    expect(Number.isFinite(b.phase)).toBe(true);
  });

  it('does not skip or repeat a beat when the tempo changes', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(0);
    const before = clock.advance(1.25);       // beat 2, halfway through
    expect(before.beat).toBe(2);
    expect(before.phase).toBeCloseTo(0.5, 5);

    clock.setBpm(150);
    const after = clock.advance(1.25);
    expect(after.beat).toBe(2);
    expect(after.phase).toBeCloseTo(0.5, 3);
  });

  it('ignores a nonsense tempo rather than producing NaN', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(0);
    clock.setBpm(0);
    clock.setBpm(Number.NaN);
    const b = clock.advance(1);
    expect(b.bpm).toBe(120);
    expect(Number.isNaN(b.phase)).toBe(false);
  });

  it('clamps intensity into 0..1', () => {
    const clock = createClock();
    clock.setIntensity(5);
    expect(clock.advance(0).intensity).toBe(1);
    clock.setIntensity(-3);
    expect(clock.advance(0).intensity).toBe(0);
    clock.setIntensity(Number.NaN);
    expect(clock.advance(0).intensity).toBe(0);
  });

  it('reports whether real audio is driving it', () => {
    const clock = createClock();
    expect(clock.advance(0).live).toBe(false);
    clock.setLive(true);
    expect(clock.advance(0).live).toBe(true);
  });

  it('never runs backwards when the source does', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(10);
    const b = clock.advance(5);      // a source that jumped backwards
    expect(b.bar).toBe(0);
    expect(b.phase).toBeGreaterThanOrEqual(0);
  });

  it('exposes the grid the scheduler needs', () => {
    const clock = createClock({ bpm: 120 });
    expect(clock.beatSeconds()).toBeCloseTo(0.5, 6);
    clock.setBpm(150);
    expect(clock.beatSeconds()).toBeCloseTo(0.4, 6);
  });

  it('attenuates the pulse for reduced motion without removing it — E-06', () => {
    const calm = createClock({ bpm: 120, pulseScale: 0.3 });
    calm.advance(0);
    const attenuated = calm.advance(0).pulse;

    const full = createClock({ bpm: 120, pulseScale: 1 });
    full.advance(0);
    const normal = full.advance(0).pulse;

    expect(attenuated).toBeGreaterThan(0);          // never removed: it carries meaning
    expect(attenuated).toBeCloseTo(normal * 0.3, 5);
  });

  it('resets to silence', () => {
    const clock = createClock({ bpm: 120 });
    clock.advance(0);
    clock.advance(4);
    expect(clock.read().bar).toBe(2);

    clock.reset();
    expect(clock.read().bar).toBe(0);
    expect(clock.advance(999).bar).toBe(0);   // the new origin is the new source
  });
});
