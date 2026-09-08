/**
 * INTEGRIDAD DEL NÚCLEO — the health meter.
 *
 * The most important widget on screen, and until this spec the only one that
 * literally never rendered: `hudSystem.render()` threw on a missing element
 * before it reached the health code, every frame, so the bar the player was
 * supposed to read their life from was permanently frozen at its initial state.
 *
 * ## The design
 *
 * Lúmen's health is not a number, it is a stack of **capas de Núcleo** — one
 * segment per point of integrity. Segments, not a continuous bar, because the
 * quantity being shown is discrete: the player needs to answer "how many more
 * hits do I have" at a glance, and a bar at 62 % does not answer that.
 *
 * Each segment is drawn in three layers, back to front:
 *
 * ```
 *   ┌─────────────────────────────┐
 *   │ shell   the empty frame     │  always visible, defines the slot
 *   │ ┌─────────────────────────┐ │
 *   │ │ chip  the delayed ghost │ │  drains 0.45 s AFTER the hit
 *   │ │ ┌─────────────────────┐ │ │
 *   │ │ │ fill  live state    │ │ │  drops instantly on the hit
 *   │ │ └─────────────────────┘ │ │
 *   │ └─────────────────────────┘ │
 *   └─────────────────────────────┘
 * ```
 *
 * The chip layer is the whole trick (REQ-024.31). The fill vanishes on the frame
 * of the hit, which is honest; the chip lingers in white and then drains, which
 * is *legible*. Fighting games have used this for thirty years for the same
 * reason: at the moment of the hit the player is looking at the thing that hit
 * them, not at the HUD, so the HUD has to still be telling the story a
 * half-second later.
 *
 * ## Presentation layer
 *
 * This module owns DOM and nothing else. It never sees an entity, a component or
 * the ECS world — `src/systems/hud.ts` pushes it a plain view-model. That is the
 * boundary `AGENTS.md` asks for, and it is what makes the meter testable in
 * jsdom without booting a renderer.
 */

export interface IntegrityView {
  current: number;
  max: number;
  shield: boolean;
  critical: boolean;
  /** Lúmen's chosen frequency, as a CSS colour. Drives the fill. */
  color: string;
}

export interface IntegrityMeter {
  /** Idempotent: writes to the DOM only when something actually changed. */
  sync(view: IntegrityView): void;
  /** Called on `player:damaged` so the meter can react beyond its new value. */
  onDamage(lost: number): void;
  /** Called when integrity is restored. */
  onRepair(gained: number): void;
  /** Called when the Escudo eats a hit instead of the core. */
  onShieldBreak(): void;
  /** Test seam: the current DOM state, without reading the elements back. */
  debug(): { segments: number; current: number; max: number };
}

const CHIP_DELAY_MS = 150;
const CHIP_DRAIN_MS = 450;

export function createIntegrityMeter(root: HTMLElement | null): IntegrityMeter {
  const noop: IntegrityMeter = {
    sync() {}, onDamage() {}, onRepair() {}, onShieldBreak() {},
    debug: () => ({ segments: 0, current: 0, max: 0 }),
  };
  if (!root) return noop;

  const bar = root.querySelector<HTMLElement>('#integrity-bar');
  const now = root.querySelector<HTMLElement>('#integrity-now');
  const max = root.querySelector<HTMLElement>('#integrity-max');
  const shieldBadge = root.querySelector<HTMLElement>('#integrity-shield');
  if (!bar) return noop;

  const segments: HTMLElement[] = [];
  const chipTimers: Array<ReturnType<typeof setTimeout> | undefined> = [];

  // Last rendered state. Every write below is guarded on this, so a HUD that
  // runs at 144 Hz still only touches the DOM when the player's health changes.
  let shown = { current: -1, max: -1, shield: false, critical: false, color: '' };

  /**
   * Builds or trims the segment row.
   *
   * Rebuilding only when the count changes matters for edge case E-10: a Ciclo
   * that raises maximum integrity must not blank the segments the player is
   * currently looking at.
   */
  function ensureSegments(count: number) {
    while (segments.length < count) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('aria-hidden', 'true');

      const chip = document.createElement('div');
      chip.className = 'seg-chip';
      const fill = document.createElement('div');
      fill.className = 'seg-fill';
      const spark = document.createElement('div');
      spark.className = 'seg-spark';

      seg.append(chip, fill, spark);
      bar.appendChild(seg);
      segments.push(seg);
      chipTimers.push(undefined);
    }

    while (segments.length > count) {
      const seg = segments.pop();
      clearTimeout(chipTimers.pop());
      seg?.remove();
    }
  }

  /** A segment goes out: the fill drops now, the chip drains a moment later. */
  function breakSegment(index: number) {
    const seg = segments[index];
    if (!seg) return;

    seg.classList.remove('filled', 'repairing');
    seg.classList.add('breaking');

    clearTimeout(chipTimers[index]);
    chipTimers[index] = setTimeout(() => {
      seg.classList.remove('breaking');
      seg.classList.add('empty');
    }, CHIP_DELAY_MS + CHIP_DRAIN_MS);
  }

  /** A segment comes back: distinct animation, so a repair never reads as damage. */
  function restoreSegment(index: number) {
    const seg = segments[index];
    if (!seg) return;

    clearTimeout(chipTimers[index]);
    seg.classList.remove('breaking', 'empty');
    seg.classList.add('filled', 'repairing');
    chipTimers[index] = setTimeout(() => seg.classList.remove('repairing'), 520);
  }

  function sync(view: IntegrityView) {
    const current = clamp(view.current, 0, view.max);
    const total = Math.max(1, Math.floor(view.max));

    if (total !== shown.max) {
      ensureSegments(total);
      if (max) max.textContent = String(total);
      root.setAttribute('aria-valuemax', String(total));

      // A rebuilt row is painted from the truth rather than animated into it:
      // there is no "before" to transition from, and animating a Ciclo start as
      // if the player had just been healed would be a lie.
      segments.forEach((seg, i) => {
        seg.classList.remove('breaking', 'repairing');
        seg.classList.toggle('filled', i < current);
        seg.classList.toggle('empty', i >= current);
      });

      if (now) now.textContent = String(current);
      root.setAttribute('aria-valuenow', String(current));
      shown.max = total;
      shown.current = current;
    } else if (current !== shown.current) {
      // Segments are indexed from the left; the rightmost one is always the one
      // that breaks, so damage reads as the bar retreating rather than as an
      // arbitrary block going dark.
      if (current < shown.current) {
        for (let i = current; i < shown.current; i++) breakSegment(i);
        root.classList.add('hit');
        setTimeout(() => root.classList.remove('hit'), 320);
      } else {
        for (let i = shown.current; i < current; i++) restoreSegment(i);
      }

      if (now) now.textContent = String(current);
      root.setAttribute('aria-valuenow', String(current));
      shown.current = current;
    }

    if (view.critical !== shown.critical) {
      root.classList.toggle('critical', view.critical);
      shown.critical = view.critical;
    }

    if (view.shield !== shown.shield) {
      root.classList.toggle('shielded', view.shield);
      if (shieldBadge) shieldBadge.hidden = !view.shield;
      shown.shield = view.shield;
    }

    if (view.color && view.color !== shown.color) {
      root.style.setProperty('--integrity-color', view.color);
      shown.color = view.color;
    }

    // The screen reader gets a sentence, not a ratio. `aria-valuenow` alone
    // reads as "3" with no unit, which tells a blind player nothing.
    root.setAttribute('aria-valuetext', describe(current, total, view.shield));
  }

  return {
    sync,

    onDamage(lost: number) {
      if (lost <= 0) return;
      root.classList.add('hit');
      setTimeout(() => root.classList.remove('hit'), 320);
    },

    onRepair(gained: number) {
      if (gained <= 0) return;
      root.classList.add('repaired');
      setTimeout(() => root.classList.remove('repaired'), 620);
    },

    onShieldBreak() {
      root.classList.add('shield-break');
      setTimeout(() => root.classList.remove('shield-break'), 520);
    },

    debug: () => ({ segments: segments.length, current: shown.current, max: shown.max }),
  };
}

/* -------------------------------------------------------------------------- */

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
}

/**
 * The accessible description (REQ-024.35).
 *
 * Deliberately the same wording as `src/domain/integrity.ts::describe`, but
 * duplicated rather than imported: the UI layer must not depend on the domain
 * layer, and three strings are a cheaper price than the layer violation.
 */
function describe(current: number, max: number, shield: boolean): string {
  if (current <= 0) return 'Núcleo colapsado';
  if (shield) return `Integridad ${current} de ${max}, escudo activo`;
  if (current <= 1) return `Integridad crítica: ${current} de ${max}`;
  return `Integridad ${current} de ${max}`;
}
