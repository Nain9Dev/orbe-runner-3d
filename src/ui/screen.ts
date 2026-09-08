/**
 * Full-screen feedback: the layers that tell the player something happened *to
 * them* rather than in front of them.
 *
 * Three of them, in increasing duration:
 *
 *  - **Damage vignette** — a red flash on the frame of the hit, gone in 0.4 s
 *    (REQ-024.42). The markup and the CSS for this already existed; nothing in
 *    the codebase ever toggled the class, so the effect had never once played.
 *  - **Critical vignette** — a slow, permanent pulse while integrity is at one
 *    layer or less (REQ-024.32). Unlike the flash, this one is a *state*: it
 *    keeps the stakes present without needing another event to fire.
 *  - **Dash streaks** — radial speed lines for the duration of an Impulso, so
 *    the 0.2 s of invulnerability is visible rather than merely true.
 *
 * All three are `pointer-events: none` overlays and never touch layout.
 */

export interface ScreenFx {
  damage(intensity?: number): void;
  shieldBreak(): void;
  setCritical(on: boolean): void;
  setDashing(on: boolean): void;
  reset(): void;
}

export function createScreenFx(): ScreenFx {
  const damageEl = document.getElementById('damage-vignette');
  const criticalEl = document.getElementById('critical-vignette');
  const streaksEl = document.getElementById('dash-streaks');

  let damageTimer: ReturnType<typeof setTimeout> | undefined;
  let criticalOn = false;
  let dashOn = false;

  return {
    /**
     * `intensity` scales the flash so a three-layer Devorador slam does not look
     * like a graze. Clamped, because a hit that whites out the screen takes the
     * game away from the player at exactly the moment they need to react.
     */
    damage(intensity = 1) {
      if (!damageEl) return;
      const strength = Math.min(1, Math.max(0.35, intensity));
      damageEl.style.setProperty('--damage-strength', String(strength));

      damageEl.classList.remove('hit');
      void damageEl.offsetWidth;                 // restart the transition
      damageEl.classList.add('hit');

      clearTimeout(damageTimer);
      damageTimer = setTimeout(() => damageEl.classList.remove('hit'), 400);
    },

    /** The Escudo absorbing a hit is cyan, not red: nothing was actually lost. */
    shieldBreak() {
      if (!damageEl) return;
      damageEl.classList.add('shielded');
      damageEl.classList.remove('hit');
      void damageEl.offsetWidth;
      damageEl.classList.add('hit');

      clearTimeout(damageTimer);
      damageTimer = setTimeout(() => {
        damageEl.classList.remove('hit', 'shielded');
      }, 400);
    },

    setCritical(on: boolean) {
      if (!criticalEl || on === criticalOn) return;
      criticalOn = on;
      criticalEl.classList.toggle('on', on);
    },

    setDashing(on: boolean) {
      if (!streaksEl || on === dashOn) return;
      dashOn = on;
      streaksEl.classList.toggle('on', on);
    },

    reset() {
      clearTimeout(damageTimer);
      damageEl?.classList.remove('hit', 'shielded');
      criticalEl?.classList.remove('on');
      streaksEl?.classList.remove('on');
      criticalOn = false;
      dashOn = false;
    },
  };
}
