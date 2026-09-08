/**
 * Integridad del Núcleo — the rules that govern Lúmen's health.
 *
 * Kept in the domain layer, free of Three.js and of the ECS, because these are
 * invariants rather than behaviour: whatever the presentation does with them,
 * integrity can never exceed its maximum, never fall below zero, and a shield
 * always absorbs a whole hit rather than a fraction of one.
 *
 * Domain layer: this module imports nothing.
 */

export interface IntegrityState {
  /** Current core layers, 0..max. */
  current: number;
  /** Maximum core layers. Drives the number of segments the meter renders. */
  max: number;
  /** Whether an Escudo is currently wrapped around the core. */
  shield: boolean;
}

export interface DamageResult {
  state: IntegrityState;
  /** Layers actually removed. Zero when a shield absorbed the hit. */
  lost: number;
  /** True when the Escudo took the hit instead of the core. */
  absorbed: boolean;
  /** True when this hit brought integrity to zero. */
  lethal: boolean;
}

export function create(max: number): IntegrityState {
  const safeMax = Math.max(1, Math.floor(max));
  return { current: safeMax, max: safeMax, shield: false };
}

/**
 * Apply `amount` layers of damage.
 *
 * An active Escudo absorbs the whole hit no matter how large it is — that is the
 * point of the power-up, and partial absorption would make lethal hazards
 * (lava deals 10) feel like the shield did nothing.
 */
export function applyDamage(state: IntegrityState, amount = 1): DamageResult {
  const dmg = Math.max(0, Math.floor(amount));

  if (dmg === 0) {
    return { state: { ...state }, lost: 0, absorbed: false, lethal: false };
  }

  if (state.shield) {
    return {
      state: { ...state, shield: false },
      lost: 0,
      absorbed: true,
      lethal: false,
    };
  }

  const current = Math.max(0, state.current - dmg);
  return {
    state: { ...state, current },
    lost: state.current - current,
    absorbed: false,
    lethal: current === 0,
  };
}

/** Restore layers, never above the maximum. Returns how many were actually restored. */
export function repair(state: IntegrityState, amount = 1): { state: IntegrityState; gained: number } {
  const heal = Math.max(0, Math.floor(amount));
  const current = Math.min(state.max, state.current + heal);
  return { state: { ...state, current }, gained: current - state.current };
}

/** Raise the ceiling (and fill the new layer), e.g. a permanent upgrade. */
export function extend(state: IntegrityState, extra = 1): IntegrityState {
  const add = Math.max(0, Math.floor(extra));
  return { ...state, max: state.max + add, current: state.current + add };
}

/** 0..1 fill ratio, safe when `max` is zero. */
export function ratio(state: IntegrityState): number {
  if (state.max <= 0) return 0;
  return Math.min(1, Math.max(0, state.current / state.max));
}

/**
 * Critical means "one more hit ends the run": a single layer left, or none.
 * The HUD keys its alarm state off this, so the threshold lives here and not in
 * the presentation layer.
 */
export function isCritical(state: IntegrityState): boolean {
  return state.current <= 1;
}

/** Human-readable status used for the meter's `aria-valuetext`. */
export function describe(state: IntegrityState): string {
  if (state.current <= 0) return 'Núcleo colapsado';
  if (state.shield) return `Integridad ${state.current} de ${state.max}, escudo activo`;
  if (isCritical(state)) return `Integridad crítica: ${state.current} de ${state.max}`;
  return `Integridad ${state.current} de ${state.max}`;
}
