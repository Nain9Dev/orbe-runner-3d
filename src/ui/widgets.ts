/**
 * HUD widgets: Impulso ring, Resonancia dial, Ciclo progress, Ventaja chip and
 * the toast stack.
 *
 * Every widget follows the same two rules:
 *
 *  1. **It owns DOM and nothing else.** No entity, no component, no world. The
 *     binder in `src/systems/hud.ts` pushes plain numbers and strings.
 *  2. **It writes only when the value changed** (REQ-024.39 and the dirty-check
 *     acceptance criterion). The previous HUD rewrote nine `textContent`
 *     properties every single frame, which is layout work the browser has to do
 *     for a value that changes a few times a second at most.
 */

/* -------------------------------------------------------------------------- */
/* Impulso readiness ring                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The ring around the reticle. Empty while the Impulso recharges, closed and
 * bright the instant it is available again (REQ-024.36).
 *
 * The "ready" pop fires once on the transition rather than continuously: a
 * permanently glowing ring is wallpaper, a ring that flashes at the moment it
 * becomes usable is information.
 */
export function createDashRing(arc: SVGCircleElement | null, reticle: HTMLElement | null) {
  if (!arc) return { sync(_r: number, _d: boolean) {} };

  const radius = Number(arc.getAttribute('r') ?? 16);
  const circumference = 2 * Math.PI * radius;
  arc.style.strokeDasharray = `${circumference}`;

  let shownRatio = -1;
  // `null` rather than `true`: the very first sync has to paint the ring, and a
  // boolean seed would make the initial state compare equal and be skipped.
  let wasReady: boolean | null = null;
  let popTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    sync(ratio: number, dashing: boolean) {
      const clamped = Math.min(1, Math.max(0, ratio));
      // Quantised to whole percent: the eye cannot read finer, and it keeps the
      // ring from writing a new dash offset on every animation frame.
      const quantised = Math.round(clamped * 100) / 100;

      if (quantised !== shownRatio) {
        arc.style.strokeDashoffset = `${circumference * (1 - quantised)}`;
        shownRatio = quantised;
      }

      const ready = clamped >= 1 && !dashing;
      if (ready === wasReady) return;

      const first = wasReady === null;
      wasReady = ready;
      reticle?.classList.toggle('dash-ready', ready);
      if (!ready || first) return;   // no "ready" flourish on the opening frame

      reticle?.classList.add('dash-pop');
      clearTimeout(popTimer);
      popTimer = setTimeout(() => reticle?.classList.remove('dash-pop'), 340);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Resonancia                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The combo dial. Shows the multiplier *and* how long is left to feed it
 * (REQ-024.37) — a combo counter with no visible decay window makes the player
 * guess at the one piece of information they need to keep it alive.
 */
export function createComboDial(
  root: HTMLElement | null,
  value: HTMLElement | null,
  arc: SVGCircleElement | null,
) {
  if (!root) return { sync(_c: number, _w: number) {} };

  const radius = Number(arc?.getAttribute('r') ?? 19);
  const circumference = 2 * Math.PI * radius;
  if (arc) arc.style.strokeDasharray = `${circumference}`;

  let shownCombo = -1;
  let shownWindow = -1;

  return {
    sync(combo: number, window: number) {
      const active = combo > 1;

      if (combo !== shownCombo) {
        if (value) value.textContent = String(combo);
        root.hidden = !active;
        // The dial grows with the streak but stops at 1.15. The CSS applies the
        // scale to the ring and the number only, never to the caption — see the
        // note above `.combo` in style.css.
        root.style.setProperty('--combo-scale', String(Math.min(1 + combo * 0.02, 1.15)));
        root.classList.toggle('hot', combo >= 5);
        root.classList.toggle('blazing', combo >= 10);
        if (active && combo > shownCombo) {
          root.classList.remove('bump');
          void root.offsetWidth;              // restart the animation
          root.classList.add('bump');
        }
        shownCombo = combo;
      }

      if (!arc) return;
      const quantised = Math.round(Math.min(1, Math.max(0, window)) * 50) / 50;
      if (quantised === shownWindow) return;
      arc.style.strokeDashoffset = `${circumference * (1 - quantised)}`;
      // The last third of the window turns the arc red: the streak is about to go.
      root.classList.toggle('expiring', quantised < 0.34);
      shownWindow = quantised;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Ciclo progress                                                              */
/* -------------------------------------------------------------------------- */

/** Fragmentos recovered out of the Ciclo total, as a bar and as a number. */
export function createProgress(
  root: HTMLElement | null,
  fill: HTMLElement | null,
  current: HTMLElement | null,
  total: HTMLElement | null,
) {
  let shownCurrent = -1;
  let shownTotal = -1;

  return {
    sync(collected: number, target: number) {
      if (target !== shownTotal) {
        if (total) total.textContent = String(target);
        root?.setAttribute('aria-valuemax', String(target));
        shownTotal = target;
      }
      if (collected === shownCurrent) return;

      if (current) current.textContent = String(collected);
      root?.setAttribute('aria-valuenow', String(collected));
      if (fill) {
        const ratio = target > 0 ? Math.min(1, collected / target) : 0;
        fill.style.transform = `scaleX(${ratio})`;
      }
      root?.classList.remove('tick');
      void root?.offsetWidth;
      root?.classList.add('tick');
      shownCurrent = collected;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Ventaja chip                                                                */
/* -------------------------------------------------------------------------- */

const POWERUPS: Record<string, { icon: string; name: string }> = {
  shield: { icon: '🛡', name: 'Escudo' },
  magnet: { icon: '🧲', name: 'Imán' },
  jump: { icon: '🚀', name: 'Súper Salto' },
  time: { icon: '⏳', name: 'Cámara Lenta' },
};

/** The active temporary advantage and its remaining seconds. */
export function createPowerupChip(
  root: HTMLElement | null,
  icon: HTMLElement | null,
  name: HTMLElement | null,
  time: HTMLElement | null,
) {
  let shownType: string | null = null;
  let shownSeconds = -1;

  return {
    sync(type: string | null, secondsLeft: number) {
      if (!root) return;

      if (type !== shownType) {
        root.hidden = !type;
        if (type) {
          const meta = POWERUPS[type] ?? { icon: '✦', name: type };
          if (icon) icon.textContent = meta.icon;
          if (name) name.textContent = meta.name;
          root.dataset.kind = type;
        }
        shownType = type;
        shownSeconds = -1;
      }

      if (!type) return;
      const seconds = Math.max(0, Math.ceil(secondsLeft));
      if (seconds === shownSeconds) return;
      if (time) time.textContent = `${seconds}s`;
      // The last three seconds pulse, so a Ventaja never ends as a surprise.
      root.classList.toggle('fading', seconds <= 3);
      shownSeconds = seconds;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */

const TOAST_MS = 1600;
const MAX_TOASTS = 3;

/**
 * Transient event feedback (REQ-024.39).
 *
 * Capped at three visible at once and deduplicated against the newest one:
 * shattering four Sombras with a single Impulso should read as one event with a
 * count, not as four identical banners shoving each other up the screen.
 */
export function createToasts(root: HTMLElement | null) {
  if (!root) return { push(_t: string, _tone?: string) {}, clear() {} };

  let last: { text: string; el: HTMLElement; count: number; at: number } | null = null;

  return {
    push(text: string, tone: string = 'info') {
      const nowMs = Date.now();

      if (last && last.text === text && nowMs - last.at < TOAST_MS) {
        last.count += 1;
        last.el.textContent = `${text} ×${last.count}`;
        last.at = nowMs;
        return;
      }

      const el = document.createElement('div');
      el.className = `toast toast-${tone}`;
      el.textContent = text;
      root.appendChild(el);

      while (root.children.length > MAX_TOASTS) root.firstElementChild?.remove();

      last = { text, el, count: 1, at: nowMs };
      setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 260);
        if (last?.el === el) last = null;
      }, TOAST_MS);
    },

    clear() {
      root.replaceChildren();
      last = null;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Ciclo intro card                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Names of the four palette tiers, in order.
 *
 * The canonical list lives in the lore bible (`docs/20-lore.md` §8.2). It is
 * repeated here rather than imported because the aural layer keeps its own copy
 * for its own use and neither presentation layer may import the other — the same
 * trade this codebase already makes for the integrity description.
 */
export const TIER_NAMES = ['Neón', 'Abismo', 'Radiación', 'Carmesí'];

/**
 * A brief card naming the Ciclo at the start of it (REQ-025.28).
 *
 * It exists because a generated level has no title screen and no landmarks: the
 * player needs one moment that says "this is a new place" or every Ciclo blurs
 * into the previous one. The animation is fire-and-forget CSS; restarting it
 * means removing and re-adding the element to the flow.
 */
export function createCycleCard(
  root: HTMLElement | null,
  number: HTMLElement | null,
  name: HTMLElement | null,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    show(level: number, tierName: string) {
      if (!root) return;
      if (number) number.textContent = String(level);
      if (name) name.textContent = tierName ?? '';

      root.hidden = false;
      root.style.animation = 'none';
      void root.offsetWidth;                 // restart the CSS animation
      root.style.animation = '';

      clearTimeout(timer);
      timer = setTimeout(() => { root.hidden = true; }, 2400);
    },

    hide() {
      clearTimeout(timer);
      if (root) root.hidden = true;
    },
  };
}
