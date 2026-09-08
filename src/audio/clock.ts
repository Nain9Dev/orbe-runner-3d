/**
 * The musical clock.
 *
 * This is the contract that makes the game one object instead of a demo with a
 * soundtrack playing over it. The audio layer owns musical time; the models, the
 * environment and the interface read it and move with it.
 *
 * Two properties matter, and both are why this is a module of its own rather
 * than a couple of variables inside the audio system:
 *
 *  1. **It runs without audio.** Muted, blocked by an autoplay policy, or on a
 *     browser with no Web Audio at all — the world still has to pulse
 *     (REQ-025.12). The clock therefore takes its time from whatever source it
 *     is given: `AudioContext.currentTime` when there is one, the engine's own
 *     accumulated time when there is not.
 *  2. **It is testable.** No Web Audio, no DOM, no ECS. Bars, beats, phase and
 *     pulse decay are arithmetic, and arithmetic can be asserted.
 */

export interface Beat {
  /** Bars elapsed since the clock started. */
  bar: number;
  /** Beat within the bar, 0..beatsPerBar-1. */
  beat: number;
  /** Sixteenth within the bar, 0..(beatsPerBar*4)-1. */
  sixteenth: number;
  /** Position inside the current beat, 0..1. */
  phase: number;
  /**
   * 1 at the instant of a beat onset, decaying to 0 before the next one.
   *
   * This is the value visuals actually want. Reading `phase` directly gives a
   * sawtooth, which reads as a stutter; `pulse` reads as a heartbeat.
   */
  pulse: number;
  /** Accented pulse: same shape, but only on the first beat of the bar. */
  downbeat: number;
  bpm: number;
  /** 0..1 adaptive intensity, mirrored here so consumers need one object. */
  intensity: number;
  /** Whether a real audio context is driving this. */
  live: boolean;
}

export interface ClockOptions {
  bpm?: number;
  beatsPerBar?: number;
  /** How fast `pulse` decays, in units of a beat. 1 = gone by the next beat. */
  pulseDecay?: number;
  /**
   * Overrides the reduced-motion attenuation. Tests set it explicitly; the game
   * lets it derive from the viewer's own preference.
   */
  pulseScale?: number;
}

const EMPTY: Beat = {
  bar: 0, beat: 0, sixteenth: 0, phase: 0, pulse: 0, downbeat: 0,
  bpm: 132, intensity: 0, live: false,
};

/**
 * How strongly `pulse` is expressed when the viewer has asked for reduced
 * motion.
 *
 * Attenuated, not removed. The pulse is not decoration: it is how a player sees
 * that the world and the music are one system, and at zero the game looks
 * broken rather than calm. A third is enough to stay perceptible and not enough
 * to be a trigger.
 */
const REDUCED_MOTION_PULSE = 0.3;

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;   // no matchMedia (jsdom, embeds): assume full motion
  }
}

export function createClock(options: ClockOptions = {}) {
  let bpm = options.bpm ?? 132;
  const beatsPerBar = options.beatsPerBar ?? 4;
  const pulseDecay = options.pulseDecay ?? 0.85;
  // Read once: this is a preference, not a per-frame question, and every
  // consumer of the beat inherits it for free by reading the same value.
  const motionScale = options.pulseScale ?? (prefersReducedMotion() ? REDUCED_MOTION_PULSE : 1);

  let origin: number | null = null;   // time source value at musical zero
  let elapsedBeats = 0;               // musical position, in beats
  let intensity = 0;
  let live = false;

  const beat: Beat = { ...EMPTY, bpm, beatsPerBar } as Beat;

  /**
   * Advances the clock to `now`.
   *
   * `now` is seconds from any monotonic source. A jump — the tab was hidden and
   * `AudioContext.currentTime` leapt forward — is absorbed rather than replayed:
   * musical position is recomputed from the source instead of accumulated, so
   * the clock resynchronises to the grid instead of firing a burst of skipped
   * beats (edge case E-02).
   */
  function advance(now: number): Beat {
    if (origin === null) origin = now;

    const seconds = Math.max(0, now - origin);
    elapsedBeats = seconds * (bpm / 60);

    const barFloat = elapsedBeats / beatsPerBar;
    const withinBar = elapsedBeats - Math.floor(barFloat) * beatsPerBar;
    const phase = elapsedBeats - Math.floor(elapsedBeats);

    beat.bar = Math.floor(barFloat);
    beat.beat = Math.floor(withinBar);
    beat.sixteenth = Math.floor(withinBar * 4);
    beat.phase = phase;

    // Decay shaped so the flash is sharp and the tail is short.
    const decayed = Math.max(0, 1 - phase / pulseDecay);
    beat.pulse = decayed * decayed * motionScale;
    beat.downbeat = beat.beat === 0 ? beat.pulse : 0;

    beat.bpm = bpm;
    beat.intensity = intensity;
    beat.live = live;

    return beat;
  }

  return {
    advance,

    /** Current value without advancing. Safe to call before the first advance. */
    read: (): Beat => beat,

    setBpm(next: number) {
      if (!Number.isFinite(next) || next <= 0) return;
      // Rebase the origin so the beat we are currently on does not jump when the
      // tempo changes. Without this, every tempo nudge skips or repeats a beat.
      if (origin !== null) {
        const seconds = elapsedBeats * (60 / next);
        origin = (origin + elapsedBeats * (60 / bpm)) - seconds;
      }
      bpm = next;
    },

    setIntensity(next: number) {
      intensity = Math.min(1, Math.max(0, Number.isFinite(next) ? next : 0));
    },

    setLive(next: boolean) {
      live = next;
    },

    /** Seconds per beat, for anything that needs to schedule against the grid. */
    beatSeconds: () => 60 / bpm,

    /** Musical position in beats, for the scheduler. */
    position: () => elapsedBeats,

    reset() {
      origin = null;
      elapsedBeats = 0;
      Object.assign(beat, EMPTY, { bpm, intensity, live });
    },
  };
}

export type Clock = ReturnType<typeof createClock>;
