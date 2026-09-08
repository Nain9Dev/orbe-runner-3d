/**
 * The adaptive score: what to play, and how much of it.
 *
 * Pure decisions, no Web Audio. Given the state of the run this module answers
 * two questions — *how tense is this* and *which notes go on this sixteenth* —
 * and `src/systems/audio.ts` hands the answers to the synth.
 *
 * Keeping it pure is what lets the interesting half be tested: the intensity
 * model is the thing that decides whether the music is doing its job, and it is
 * ordinary arithmetic.
 */

export interface IntensityInputs {
  /** Resonancia streak. */
  combo: number;
  /** Distance to the nearest Sombra, in units. `Infinity` when there is none. */
  threat: number;
  /** Remaining capas de Núcleo. */
  integrity: number;
  maxIntegrity: number;
  /** Horizontal speed, in units per second. */
  speed: number;
  maxSpeed: number;
}

/**
 * Where each musical layer switches on.
 *
 * Thresholds carry hysteresis (`off` sits below `on`) because a player hovering
 * at the boundary would otherwise make the arrangement flap on and off several
 * times a second, which is far more distracting than either state.
 */
export const LAYERS = {
  bass:    { on: 0.00, off: -1 },     // always
  kick:    { on: 0.00, off: -1 },     // always
  hat:     { on: 0.18, off: 0.12 },
  arp:     { on: 0.38, off: 0.30 },
  pad:     { on: 0.30, off: 0.22 },
  lead:    { on: 0.62, off: 0.52 },
  ride:    { on: 0.78, off: 0.68 },
} as const;

export type LayerName = keyof typeof LAYERS;

/**
 * Musical identity per palette tier, so a change of Ciclo band is audible as
 * well as visible. Roots are in Hz; the modes are the scale degrees in semitones.
 */
export const TIERS = [
  { name: 'Neón',       root: 220.00, mode: [0, 3, 5, 7, 10],      bpm: 132 }, // A minor pentatonic
  { name: 'Abismo',     root: 196.00, mode: [0, 2, 3, 7, 8],       bpm: 138 }, // G phrygian-ish
  { name: 'Radiación',  root: 246.94, mode: [0, 2, 4, 7, 9],       bpm: 144 }, // B major pentatonic
  { name: 'Carmesí',    root: 174.61, mode: [0, 1, 5, 6, 10],      bpm: 150 }, // F, unstable
];

/** Bass pattern per sixteenth of a bar (index into the mode, or null for a rest). */
const BASS = [0, null, null, 0, null, 2, null, null, 4, null, null, 2, null, 0, null, 3];
const ARP  = [0, 4, 2, 4, 3, 5, 2, 4, 0, 4, 2, 5, 3, 4, 2, 4];
const LEAD = [7, null, 5, null, 4, null, 7, null, null, 9, null, 7, 5, null, 4, null];

/** Kick on the four, snare on 2 and 4, hats on the offbeat. */
const KICK  = [0, 8];
const SNARE = [4, 12];

export function tierFor(level: number): number {
  return Math.min(TIERS.length - 1, Math.floor((Math.max(1, level) - 1) / 3));
}

/**
 * Converts a scale degree into a frequency.
 *
 * `degree` may exceed the mode length; it wraps and lifts by an octave, so
 * writing patterns in degrees rather than in Hz keeps them transposable.
 */
export function noteAt(tier: number, degree: number, octave = 0): number {
  const t = TIERS[Math.min(tier, TIERS.length - 1)];
  const len = t.mode.length;
  const wrapped = ((degree % len) + len) % len;
  const lift = Math.floor(degree / len) + octave;
  return t.root * Math.pow(2, t.mode[wrapped] / 12 + lift);
}

/**
 * How tense is this, right now, in 0..1.
 *
 * Three inputs, deliberately weighted so that no single one can saturate the
 * mix on its own — except being one hit from death, which overrides everything
 * (REQ-025.08). A player at maximum Resonancia in an empty stretch should not
 * get the same music as a player being cornered.
 */
export function rawIntensity(input: IntensityInputs): number {
  const combo = Math.min(1, (input.combo ?? 0) / 10) * 0.35;

  // Threat: nothing beyond 26 units, full weight inside 6.
  const d = input.threat ?? Infinity;
  const threat = Number.isFinite(d)
    ? Math.min(1, Math.max(0, (26 - d) / 20)) * 0.4
    : 0;

  const max = Math.max(1, input.maxIntegrity ?? 3);
  const hurt = 1 - Math.min(1, Math.max(0, (input.integrity ?? max) / max));
  const wounded = hurt * 0.15;

  const pace = Math.min(1, Math.max(0, (input.speed ?? 0) / Math.max(1, input.maxSpeed ?? 14))) * 0.1;

  const base = combo + threat + wounded + pace;

  // One layer left: the arrangement goes to its tension voicing regardless of
  // everything else. The player should hear that they are about to lose.
  if ((input.integrity ?? max) <= 1) return Math.max(base, 0.8);

  return Math.min(1, base);
}

/**
 * Stateful smoother plus layer gating.
 *
 * The smoothing constant is deliberately slow: intensity is a mood, and a mood
 * that changes in a tenth of a second is a glitch.
 */
export function createArrangement() {
  let intensity = 0;
  const active: Record<string, boolean> = {};

  return {
    /** Advances the smoothed intensity towards the raw value. */
    update(input: IntensityInputs, dt: number): number {
      const target = rawIntensity(input);
      // Rising is faster than falling: danger should arrive promptly and leave
      // reluctantly, which is also how the player experiences it.
      const rate = target > intensity ? 1.6 : 0.55;
      intensity += (target - intensity) * (1 - Math.exp(-rate * Math.max(0, dt)));
      return intensity;
    },

    value: () => intensity,

    /** Whether a layer plays, with hysteresis so it cannot flap at the boundary. */
    isActive(layer: LayerName): boolean {
      const gate = LAYERS[layer];
      const was = active[layer] ?? false;
      const now = was ? intensity > gate.off : intensity >= gate.on;
      active[layer] = now;
      return now;
    },

    /** Tempo follows intensity, but only within ±8 % (REQ-025.10). */
    bpmFor(tier: number): number {
      const base = TIERS[Math.min(tier, TIERS.length - 1)].bpm;
      return base * (0.96 + intensity * 0.12);
    },

    reset() {
      intensity = 0;
      for (const k of Object.keys(active)) active[k] = false;
    },
  };
}

/**
 * What plays on a given sixteenth of the bar.
 *
 * Returns degrees, not frequencies: the caller transposes with `noteAt`, which
 * is what makes the same pattern work in four different keys.
 */
export function stepFor(sixteenth: number) {
  const i = ((sixteenth % 16) + 16) % 16;
  return {
    kick: KICK.includes(i),
    snare: SNARE.includes(i),
    hat: i % 2 === 1,
    ride: i % 2 === 0,
    bass: BASS[i],
    arp: ARP[i],
    lead: LEAD[i],
    /** The bar's first sixteenth, where the pad re-triggers. */
    downbeat: i === 0,
  };
}

export type Arrangement = ReturnType<typeof createArrangement>;
