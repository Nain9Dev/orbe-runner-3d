/**
 * Voices.
 *
 * Every sound in the game is built here from oscillators and one shared noise
 * buffer. Each voice is a fire-and-forget graph that stops itself, so nothing
 * needs pooling and nothing leaks: the live node count is bounded by how many
 * sounds are currently ringing.
 *
 * Two conventions worth knowing before adding one:
 *
 *  - **Every voice takes an explicit `time`.** Music is scheduled ahead of the
 *    audible clock; passing `ctx.currentTime` from the caller would put every
 *    note wherever the frame happened to land, which is the difference between
 *    a groove and a stumble.
 *  - **Every voice takes a destination.** The caller decides whether the sound
 *    is music, SFX or UI, and whether it comes from a place in the world. That
 *    is what makes spatialisation a property of the *call*, not of the voice.
 */

import type { AudioEngine } from './engine.js';

interface VoiceCtx {
  engine: AudioEngine;
  ctx: AudioContext;
}

function ramp(gain: GainNode, time: number, peak: number, attack: number, decay: number) {
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
}

/** Sends a fraction of a voice into the shared reverb and delay buses. */
function send(v: VoiceCtx, source: AudioNode, reverb: number, delay: number) {
  const s = v.engine.sends();
  if (reverb > 0 && s.reverb) {
    const g = v.ctx.createGain();
    g.gain.value = reverb;
    source.connect(g);
    g.connect(s.reverb);
  }
  if (delay > 0 && s.delay) {
    const g = v.ctx.createGain();
    g.gain.value = delay;
    source.connect(g);
    g.connect(s.delay);
  }
}

export function createSynth(engine: AudioEngine) {
  function ctxOf(): AudioContext | null {
    return engine.context;
  }

  function voice(bus: 'music' | 'sfx' | 'ui', at?: { x: number; y: number; z: number } | null) {
    const ctx = ctxOf();
    if (!ctx) return null;
    const out = engine.dest(bus, at);
    if (!out) return null;
    return { ctx, out, engine } as VoiceCtx & { out: AudioNode };
  }

  /* ----------------------------- percussion ----------------------------- */

  /** Kick: a sine whose pitch collapses, plus a click of noise for the beater. */
  function kick(time: number, level = 1) {
    const v = voice('music');
    if (!v) return;
    const { ctx, out } = v;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    osc.connect(gain);
    gain.connect(out);
    ramp(gain, time, 0.9 * level, 0.004, 0.34);
    osc.start(time);
    osc.stop(time + 0.4);

    const click = noiseVoice(v, out, time, 0.02, 0.12 * level, 'highpass', 1800);
    if (click) send(v, click, 0.04, 0);
  }

  /** Snare: filtered noise plus a short tuned body. */
  function snare(time: number, level = 1) {
    const v = voice('music');
    if (!v) return;
    const { ctx, out } = v;

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, time);
    body.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(out);
    ramp(bodyGain, time, 0.22 * level, 0.003, 0.13);
    body.start(time);
    body.stop(time + 0.2);

    const n = noiseVoice(v, out, time, 0.005, 0.34 * level, 'bandpass', 2100, 0.16);
    if (n) send(v, n, 0.3, 0.08);
  }

  /** Hat: a very short burst of high-passed noise. Closed by default. */
  function hat(time: number, level = 1, open = false) {
    const v = voice('music');
    if (!v) return;
    const n = noiseVoice(v, v.out, time, 0.001, 0.13 * level, 'highpass', 7800, open ? 0.18 : 0.045);
    if (n) send(v, n, open ? 0.18 : 0.05, 0);
  }

  /** Ride: brighter, longer, and only at high intensity. */
  function ride(time: number, level = 1) {
    const v = voice('music');
    if (!v) return;
    const n = noiseVoice(v, v.out, time, 0.002, 0.07 * level, 'highpass', 9500, 0.3);
    if (n) send(v, n, 0.3, 0.12);
  }

  /* -------------------------------- tonal -------------------------------- */

  /** Bass: a detuned saw pair through a low-pass, the spine of the track. */
  function bass(time: number, freq: number, duration: number, level = 1) {
    const v = voice('music');
    if (!v) return;
    const { ctx, out } = v;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280 + level * 900, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + duration);
    filter.Q.value = 6;

    const gain = ctx.createGain();
    filter.connect(gain);
    gain.connect(out);

    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    }

    ramp(gain, time, 0.3 * level, 0.008, duration);
  }

  /** Arpeggio: a plucky square through the delay, two octaves up. */
  function arp(time: number, freq: number, duration: number, level = 1) {
    const v = voice('music');
    if (!v) return;
    const { ctx, out } = v;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq * 4;
    osc.connect(gain);
    gain.connect(out);
    ramp(gain, time, 0.075 * level, 0.004, duration * 0.7);
    send(v, gain, 0.2, 0.35);
    osc.start(time);
    osc.stop(time + duration);
  }

  /** Lead: a wider, softer voice that only shows up when things are tense. */
  function lead(time: number, freq: number, duration: number, level = 1) {
    const v = voice('music');
    if (!v) return;
    const { ctx, out } = v;

    const gain = ctx.createGain();
    gain.connect(out);
    for (const detune of [-11, 0, 11]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * 2;
      osc.detune.value = detune;
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + duration + 0.1);
    }
    ramp(gain, time, 0.06 * level, 0.05, duration);
    send(v, gain, 0.45, 0.3);
  }

  /** Pad: a long, quiet bed that gives the arrangement a floor to stand on. */
  function pad(time: number, freq: number, duration: number, level = 1) {
    const v = voice('music');
    if (!v) return;
    const { ctx, out } = v;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    filter.connect(gain);
    gain.connect(out);

    for (const mult of [1, 1.5, 2]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq * mult;
      osc.detune.value = (Math.random() - 0.5) * 14;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.3);
    }

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.05 * level), time + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    send(v, gain, 0.6, 0.1);
  }

  /* --------------------------------- SFX --------------------------------- */

  /**
   * `at` is a world position; passing one spatialises the sound so the player
   * hears which side it came from. That is the whole reason a telegraph is
   * audible at all when it happens behind the camera.
   */
  type Where = { x: number; y: number; z: number } | null | undefined;

  function sweep(time: number, from: number, to: number, duration: number, level: number,
                 type: OscillatorType, at?: Where, reverb = 0.15) {
    const v = voice('sfx', at ?? null);
    if (!v) return;
    const { ctx, out } = v;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, from), time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), time + duration);
    osc.connect(gain);
    gain.connect(out);
    ramp(gain, time, level, 0.006, duration);
    send(v, gain, reverb, 0);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  return {
    kick, snare, hat, ride, bass, arp, lead, pad,

    /** Fragmento collected: a rising chime, brighter for a risk one. */
    collect(time: number, risky: boolean, at?: Where) {
      sweep(time, risky ? 900 : 1046, risky ? 2600 : 2093, 0.28, risky ? 0.3 : 0.22, 'sine', at, 0.3);
      if (risky) sweep(time + 0.06, 1400, 3200, 0.22, 0.16, 'triangle', at, 0.35);
    },

    /** Impulso: a fast descending whoosh, the signature of the one verb. */
    dash(time: number, at?: Where) {
      sweep(time, 1100, 220, 0.24, 0.22, 'sawtooth', at, 0.1);
      const v = voice('sfx', at ?? null);
      if (v) noiseVoice(v, v.out, time, 0.005, 0.12, 'bandpass', 1600, 0.22);
    },

    /** Landing: level scales with impact speed, so a long fall lands heavier. */
    land(time: number, impact01: number, at?: Where) {
      const level = 0.06 + Math.min(1, Math.max(0, impact01)) * 0.3;
      sweep(time, 150, 48, 0.18, level, 'sine', at, 0.12);
      const v = voice('sfx', at ?? null);
      if (v) noiseVoice(v, v.out, time, 0.003, level * 0.5, 'lowpass', 900, 0.1);
    },

    /** Footstep: tiny, filtered, and never the same twice. */
    step(time: number, level: number, at?: Where) {
      const v = voice('sfx', at ?? null);
      if (!v) return;
      noiseVoice(v, v.out, time, 0.002, 0.05 * level, 'bandpass', 480 + Math.random() * 260, 0.05);
    },

    /** Jump: a short rise, so leaving the ground is audible. */
    jump(time: number, at?: Where) {
      sweep(time, 320, 720, 0.14, 0.12, 'triangle', at, 0.1);
    },

    /** Telegraph: the tell, spatialised. This is a fairness feature, not a flourish. */
    telegraph(time: number, at?: Where) {
      sweep(time, 300, 520, 0.18, 0.14, 'triangle', at, 0.25);
      sweep(time + 0.16, 300, 560, 0.16, 0.1, 'triangle', at, 0.25);
    },

    /** A bolt leaving a Centinela. */
    fire(time: number, at?: Where) {
      sweep(time, 900, 180, 0.16, 0.16, 'square', at, 0.12);
    },

    /** A bolt hitting geometry. */
    impact(time: number, at?: Where) {
      const v = voice('sfx', at ?? null);
      if (!v) return;
      noiseVoice(v, v.out, time, 0.002, 0.14, 'bandpass', 1800, 0.09);
    },

    /** A Sombra coming apart. */
    shatter(time: number, at?: Where) {
      sweep(time, 1900, 420, 0.2, 0.24, 'square', at, 0.3);
      sweep(time + 0.03, 2700, 900, 0.14, 0.14, 'triangle', at, 0.3);
      const v = voice('sfx', at ?? null);
      if (v) noiseVoice(v, v.out, time, 0.002, 0.16, 'highpass', 3400, 0.16);
    },

    /** A Coloso landing. Low, wide, and it should be felt before it is heard. */
    shockwave(time: number, at?: Where) {
      sweep(time, 120, 34, 0.5, 0.42, 'sine', at, 0.4);
      const v = voice('sfx', at ?? null);
      if (v) noiseVoice(v, v.out, time, 0.004, 0.26, 'lowpass', 700, 0.45);
    },

    /** Damage. `lethal` gets the long descent instead of the short bite. */
    hurt(time: number, lethal: boolean) {
      if (lethal) {
        sweep(time, 150, 10, 1.2, 0.4, 'sawtooth', null, 0.5);
        sweep(time + 0.1, 90, 8, 1.4, 0.28, 'triangle', null, 0.5);
      } else {
        sweep(time, 90, 12, 0.34, 0.4, 'sawtooth', null, 0.2);
      }
    },

    /** The Escudo absorbing a hit: bright, not painful. */
    shielded(time: number) {
      sweep(time, 700, 1500, 0.2, 0.2, 'sine', null, 0.35);
    },

    /** Falling into the Vacío: air, then nothing. */
    voided(time: number) {
      sweep(time, 600, 60, 0.7, 0.2, 'sine', null, 0.5);
    },

    /** Anchoring to a Baliza: two rising notes, the only unambiguously good sound. */
    anchor(time: number, at?: Where) {
      sweep(time, 523, 523, 0.3, 0.2, 'sine', at, 0.4);
      sweep(time + 0.12, 784, 784, 0.4, 0.18, 'sine', at, 0.4);
    },

    /** A collapsing tile. */
    collapse(time: number, at?: Where) {
      sweep(time, 170, 40, 0.4, 0.2, 'sawtooth', at, 0.25);
    },

    /** Ciclo cleared. */
    levelUp(time: number, tierRoot: number) {
      [1, 1.25, 1.5, 2].forEach((mult, i) => {
        sweep(time + i * 0.09, tierRoot * mult, tierRoot * mult, 1.3, 0.18, 'sine', null, 0.6);
      });
    },

    /** UI click, on its own bus so it is never ducked or muffled. */
    ui(time: number, up: boolean) {
      const v = voice('ui');
      if (!v) return;
      const { ctx, out } = v;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(up ? 660 : 440, time);
      osc.frequency.exponentialRampToValueAtTime(up ? 990 : 330, time + 0.06);
      osc.connect(gain);
      gain.connect(out);
      ramp(gain, time, 0.1, 0.003, 0.07);
      osc.start(time);
      osc.stop(time + 0.12);
    },
  };

  /* ------------------------------------------------------------------ */

  /** A filtered burst of the shared noise buffer. Returns the gain node for sends. */
  function noiseVoice(
    v: VoiceCtx, out: AudioNode, time: number, attack: number, peak: number,
    filterType: BiquadFilterType, hz: number, decay = 0.05,
  ): GainNode | null {
    const buffer = engine.noiseBuffer();
    if (!buffer) return null;
    const { ctx } = v;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // Start somewhere random in the buffer so repeated hits are not identical.
    const offset = Math.random() * Math.max(0, buffer.duration - decay - 0.05);

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = hz;
    filter.Q.value = filterType === 'bandpass' ? 1.4 : 0.7;

    const gain = ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    ramp(gain, time, peak, attack, decay);

    src.start(time, offset, decay + attack + 0.06);
    src.stop(time + attack + decay + 0.08);
    return gain;
  }
}

export type Synth = ReturnType<typeof createSynth>;
