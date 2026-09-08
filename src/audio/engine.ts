/**
 * The Web Audio graph, and the only file in the project that touches it.
 *
 * ```
 *   music voices ─┬─► musicBus ──► musicFilter ──┐
 *                 │      ▲                        │
 *                 │   sidechain duck              ├─► master ─► limiter ─► out
 *   sfx voices ───┼─► sfxBus ────────────────────┤
 *                 │                               │
 *   ui voices ────┴─► uiBus ─────────────────────┘
 *                 │
 *                 └─► reverbSend ─► convolver ─► master
 *                 └─► delaySend ──► delay ─────► master
 * ```
 *
 * Design notes worth keeping:
 *
 *  - **Nothing here throws into the game.** Every entry point is guarded, and a
 *    failed `AudioContext` leaves the engine inert rather than breaking the
 *    simulation (REQ-025.05). A browser that will not make noise is not a
 *    reason to stop playing.
 *  - **The reverb impulse is generated, not loaded.** Exponentially decaying
 *    noise through a `ConvolverNode` sounds like a room and costs nothing at
 *    rest, which is what the "no external assets" rule requires.
 *  - **There is no sidechain input in Web Audio.** The duck is scheduled gain
 *    automation on the music bus, fired alongside each kick, which is
 *    sample-accurate and free (REQ-025.03).
 */

export interface EngineOptions {
  musicVolume?: number;
  sfxVolume?: number;
}

export function createAudioEngine(options: EngineOptions = {}) {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let musicDuck: GainNode | null = null;
  let musicFilter: BiquadFilterNode | null = null;
  let sfxBus: GainNode | null = null;
  let uiBus: GainNode | null = null;
  let reverbSend: GainNode | null = null;
  let delaySend: GainNode | null = null;
  let noise: AudioBuffer | null = null;

  let musicVolume = clamp01(options.musicVolume ?? 0.7);
  let sfxVolume = clamp01(options.sfxVolume ?? 0.9);
  let muted = false;
  let failed = false;

  /** Builds the graph on first use. Returns false if audio is unavailable. */
  function ensure(): boolean {
    if (ctx) return true;
    if (failed) return false;

    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctor) { failed = true; return false; }
      ctx = new Ctor();
    } catch {
      failed = true;
      return false;
    }

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;

    // A gentle limiter so stacking a boss volley on a landing on a shatter does
    // not clip. Slow release, high ratio: it should be inaudible until it works.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    master.connect(limiter);
    limiter.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicVolume;
    musicDuck = ctx.createGain();
    musicDuck.gain.value = 1;
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 18000;
    musicFilter.Q.value = 0.7;

    musicBus.connect(musicDuck);
    musicDuck.connect(musicFilter);
    musicFilter.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(master);

    uiBus = ctx.createGain();
    uiBus.gain.value = sfxVolume;
    uiBus.connect(master);

    // Reverb: a generated impulse response, 1.6 s, exponential decay.
    const convolver = ctx.createConvolver();
    convolver.buffer = impulseResponse(ctx, 1.6, 3.2);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.32;
    reverbSend.connect(convolver);
    convolver.connect(master);

    // A dotted-eighth delay, the synthwave staple, with a modest feedback path.
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2600;
    delaySend = ctx.createGain();
    delaySend.gain.value = 0.22;
    delaySend.connect(delay);
    delay.connect(delayTone);
    delayTone.connect(feedback);
    feedback.connect(delay);
    delayTone.connect(master);

    noise = noiseBuffer(ctx, 2);

    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Public surface                                                      */
  /* ------------------------------------------------------------------ */

  return {
    /** Called from a user gesture; without one, browsers keep the context suspended. */
    start(): boolean {
      if (!ensure()) return false;
      if (ctx!.state === 'suspended') ctx!.resume().catch(() => {});
      return true;
    },

    get available() { return !failed; },
    get running() { return !!ctx && ctx.state === 'running'; },
    get context() { return ctx; },

    /** Audio time in seconds, or `null` when there is no context to read. */
    now(): number | null {
      return ctx ? ctx.currentTime : null;
    },

    setMuted(next: boolean) {
      muted = next;
      if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.02);
    },

    setMusicVolume(v: number) {
      musicVolume = clamp01(v);
      if (musicBus && ctx) musicBus.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.05);
    },

    setSfxVolume(v: number) {
      sfxVolume = clamp01(v);
      if (ctx) {
        sfxBus?.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
        uiBus?.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
      }
    },

    /**
     * Opens the music low-pass with the player's speed (REQ-025.17): moving fast
     * literally sounds brighter, and a muffled mix is one of the cues that
     * something has gone wrong.
     */
    setBrightness(ratio01: number) {
      if (!musicFilter || !ctx) return;
      const r = clamp01(ratio01);
      const hz = 900 + r * r * 15000;
      musicFilter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.12);
    },

    /** Muffles everything: used for pause and death, so silence is not abrupt. */
    setMuffled(on: boolean) {
      if (!musicFilter || !ctx) return;
      musicFilter.frequency.setTargetAtTime(on ? 320 : 16000, ctx.currentTime, 0.08);
    },

    /** Schedules the sidechain duck for a kick landing at `time`. */
    duck(time: number, amount = 0.42, beatSeconds = 0.45) {
      if (!musicDuck || !ctx) return;
      const g = musicDuck.gain;
      g.cancelScheduledValues(time);
      g.setValueAtTime(1, time);
      g.linearRampToValueAtTime(1 - clamp01(amount), time + 0.012);
      g.linearRampToValueAtTime(1, time + Math.max(0.08, beatSeconds * 0.85));
    },

    /**
     * Moves the listener to the camera (REQ-025.18), so a Centinela on the left
     * is heard on the left. Uses the deprecated scalar setters when the modern
     * `positionX` AudioParams are unavailable, because Safari still needs them.
     */
    setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number) {
      if (!ctx) return;
      const l = ctx.listener as any;
      if (l.positionX) {
        const t = ctx.currentTime;
        l.positionX.setTargetAtTime(px, t, 0.02);
        l.positionY.setTargetAtTime(py, t, 0.02);
        l.positionZ.setTargetAtTime(pz, t, 0.02);
        l.forwardX.setTargetAtTime(fx, t, 0.02);
        l.forwardY.setTargetAtTime(fy, t, 0.02);
        l.forwardZ.setTargetAtTime(fz, t, 0.02);
        l.upX.setTargetAtTime(0, t, 0.02);
        l.upY.setTargetAtTime(1, t, 0.02);
        l.upZ.setTargetAtTime(0, t, 0.02);
      } else if (typeof l.setPosition === 'function') {
        l.setPosition(px, py, pz);
        l.setOrientation(fx, fy, fz, 0, 1, 0);
      }
    },

    /* --------------------------- voice plumbing ------------------------ */

    /**
     * Destination for a voice. `at` spatialises it; omitting `at` centres it.
     * The panner is created per voice and garbage-collected with it, so the
     * live panner count is bounded by the voice count.
     */
    dest(bus: 'music' | 'sfx' | 'ui', at?: { x: number; y: number; z: number } | null): AudioNode | null {
      if (!ctx) return null;
      const target = bus === 'music' ? musicBus : bus === 'sfx' ? sfxBus : uiBus;
      if (!target) return null;
      if (!at) return target;

      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 6;
      panner.maxDistance = 90;
      panner.rolloffFactor = 1.1;
      if ((panner as any).positionX) {
        panner.positionX.value = at.x;
        panner.positionY.value = at.y;
        panner.positionZ.value = at.z;
      } else if (typeof (panner as any).setPosition === 'function') {
        (panner as any).setPosition(at.x, at.y, at.z);
      }
      panner.connect(target);
      return panner;
    },

    sends() {
      return { reverb: reverbSend, delay: delaySend };
    },

    noiseBuffer(): AudioBuffer | null {
      return noise;
    },

    dispose() {
      try { ctx?.close(); } catch { /* already closed */ }
      ctx = null;
    },
  };
}

export type AudioEngine = ReturnType<typeof createAudioEngine>;

/* -------------------------------------------------------------------------- */

function clamp01(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

/** White noise, generated once and reused by every percussive voice. */
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * A room, in eight lines: decaying stereo noise convolved with the signal.
 * `decay` above 1 makes the tail die faster than linear, which is what a real
 * space does and what keeps the reverb from washing the mix out.
 */
function impulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}
