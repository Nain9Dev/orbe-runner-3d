/**
 * Screen-edge indicators: things that matter and are not on screen.
 *
 * Two consumers, one mechanism.
 *
 *  - **Telegraph arrows** (REQ-025.25). ADR-010 promises at least 0.45 s of
 *    warning before anything that can hurt Lúmen, and spec 025 made that warning
 *    visible on the model. A model behind the camera is still invisible, which
 *    is the last hole in the fairness contract and the follow-up spec 024 left
 *    open as T-024.F1. An arrow at the edge of the screen closes it.
 *  - **Damage direction** (REQ-025.26). When something does connect, the player
 *    needs to know where it came from, or the only lesson available is "that was
 *    unfair".
 *
 * The binder does the projection and hands this module plain screen-space
 * angles. Nothing here knows what a camera is.
 */

export interface Mark {
  /** Screen-space angle from the centre, radians, 0 = right, growing clockwise. */
  angle: number;
  /** 0..1 — how close to landing. Drives opacity and size. */
  urgency: number;
  /** Distinguishes the styling: a warning is not a hit. */
  kind: 'telegraph' | 'damage';
  /** Stable identity, so an existing arrow is moved rather than recreated. */
  id: string | number;
}

const MAX_MARKS = 4;
const DAMAGE_MS = 900;

export function createCompass(root: HTMLElement | null) {
  if (!root) {
    return { sync(_m: Mark[]) {}, damage(_a: number) {}, clear() {} };
  }

  const pool: HTMLElement[] = [];
  const damageMarks: Array<{ angle: number; born: number }> = [];

  function element(i: number): HTMLElement {
    while (pool.length <= i) {
      const el = document.createElement('div');
      el.className = 'compass-mark';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<span class="compass-arrow"></span>';
      root.appendChild(el);
      pool.push(el);
    }
    return pool[i];
  }

  function paint(marks: Mark[]) {
    // Nearest to landing first, then capped: twenty Sombras winding up at once
    // must not turn the screen into a ring of arrows (edge case E-03).
    const shown = marks
      .slice()
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, MAX_MARKS);

    for (let i = 0; i < Math.max(shown.length, pool.length); i++) {
      const el = pool[i];
      if (i >= shown.length) {
        if (el) el.style.display = 'none';
        continue;
      }
      const m = shown[i];
      const node = element(i);
      node.style.display = 'block';
      node.dataset.kind = m.kind;
      // One transform does the whole job: rotate to the bearing, push out to the
      // edge, then counter-rotate the glyph so it still points outward.
      node.style.transform =
        `translate(-50%, -50%) rotate(${m.angle}rad) translateX(var(--compass-radius))`;
      node.style.opacity = String(0.35 + m.urgency * 0.65);
      node.style.setProperty('--mark-scale', String(0.8 + m.urgency * 0.5));
    }
  }

  return {
    /** Called each frame with the live telegraph marks; damage marks merge in. */
    sync(marks: Mark[]) {
      const now = Date.now();
      while (damageMarks.length && now - damageMarks[0].born > DAMAGE_MS) damageMarks.shift();

      const merged: Mark[] = marks.slice();
      for (const d of damageMarks) {
        const age = (now - d.born) / DAMAGE_MS;
        merged.push({ angle: d.angle, urgency: 1 - age, kind: 'damage', id: `d${d.born}` });
      }
      paint(merged);
    },

    /** Records a hit arriving from `angle`, which fades over its own lifetime. */
    damage(angle: number) {
      if (!Number.isFinite(angle)) return;
      damageMarks.push({ angle, born: Date.now() });
      if (damageMarks.length > MAX_MARKS) damageMarks.shift();
    },

    clear() {
      damageMarks.length = 0;
      for (const el of pool) el.style.display = 'none';
    },
  };
}

export type Compass = ReturnType<typeof createCompass>;
