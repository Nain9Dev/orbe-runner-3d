/**
 * Menus: the start panel, the settings panel and the Registro.
 *
 * Two things this layer is responsible for that the previous HUD was not:
 *
 *  - **Escape actually pauses** (REQ-024.40). Pausing used to be a side effect of
 *    losing pointer lock, which meant it worked by accident on desktop and not at
 *    all on a device without a pointer to lock.
 *  - **Everything is reachable from the keyboard** (REQ-024.41). Arrow keys move
 *    within a panel, Enter and Space activate, Escape backs out of a sub-panel to
 *    the main one, and every control carries a visible focus ring. A game that
 *    can be started with the keyboard should not need a mouse to be configured.
 *
 * Settings are persisted to `localStorage` under the `orbi_*` keys the previous
 * build used, so nobody loses their colour or their starting Ciclo in the upgrade.
 */

import { CONFIG } from '../config.js';

export interface MenuCallbacks {
  onStart(pending: { level: number }): void;
  onResume(): void;
  isPaused(): boolean;
  isPlaying(): boolean;
  requestPause(): void;
}

const KEYS = {
  level: 'orbi_level',
  color: 'orbi_color',
  mute: 'orbi_mute',
  gfx: 'orbi_gfx',
  shake: 'orbi_shake',
};

/** `localStorage` is unavailable in private modes and inside some embeds. */
function readStore(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Settings simply do not persist. Not a reason to break the game. */
  }
}

export function createMenu(callbacks: MenuCallbacks) {
  const overlay = document.getElementById('overlay');
  const main = document.getElementById('panel-main');
  const settings = document.getElementById('settings-panel');
  const registry = document.getElementById('registry-panel');
  const title = document.getElementById('overlay-title');
  const text = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start') as HTMLButtonElement | null;
  const touch = document.getElementById('touch-controls');

  const pending = { level: clampLevel(parseInt(readStore(KEYS.level, '1'), 10)) };

  /* ------------------------------ settings ------------------------------- */

  const savedColor = readStore(KEYS.color, '');
  const savedMute = readStore(KEYS.mute, 'false') === 'true';
  const savedGfx = readStore(KEYS.gfx, 'false') === 'true';       // true = low
  const savedShake = readStore(KEYS.shake, 'true') === 'true';

  if (savedColor) CONFIG.player.color = parseInt(savedColor, 16);
  CONFIG.audio.muted = savedMute;
  CONFIG.graphics.lowQuality = savedGfx;
  CONFIG.graphics.shake = savedShake;

  const lvlDisplay = document.getElementById('lvl-display');
  if (lvlDisplay) lvlDisplay.textContent = String(pending.level);

  bindToggle('btn-sound', !savedMute, ['ON', 'OFF'], (on) => {
    CONFIG.audio.muted = !on;
    writeStore(KEYS.mute, String(!on));
  });

  bindToggle('btn-gfx', !savedGfx, ['ALTA', 'BAJA'], (on) => {
    CONFIG.graphics.lowQuality = !on;
    writeStore(KEYS.gfx, String(!on));
  });

  bindToggle('btn-shake', savedShake, ['ON', 'OFF'], (on) => {
    CONFIG.graphics.shake = on;
    writeStore(KEYS.shake, String(on));
  });

  bindStepper('lvl-down', -1);
  bindStepper('lvl-up', +1);

  const colorButtons = Array.from(document.querySelectorAll<HTMLElement>('.color-btn'));
  for (const btn of colorButtons) {
    const isSaved = savedColor && btn.dataset.color === savedColor;
    setChecked(btn, isSaved || (!savedColor && btn.classList.contains('active')));
    btn.addEventListener('click', () => {
      colorButtons.forEach((b) => setChecked(b, b === btn));
      const hex = btn.dataset.color ?? '0x6ee7ff';
      writeStore(KEYS.color, hex);
      CONFIG.player.color = parseInt(hex, 16);
    });
  }

  /* -------------------------------- panels -------------------------------- */

  function show(panel: HTMLElement | null) {
    for (const p of [main, settings, registry]) p?.classList.toggle('hidden', p !== panel);
    focusFirst(panel);
  }

  document.getElementById('btn-settings')?.addEventListener('click', () => show(settings));
  document.getElementById('btn-registry')?.addEventListener('click', () => show(registry));
  document.getElementById('btn-save')?.addEventListener('click', () => show(main));
  document.getElementById('btn-registry-back')?.addEventListener('click', () => show(main));

  startBtn?.addEventListener('click', () => {
    if (callbacks.isPaused()) callbacks.onResume();
    else callbacks.onStart(pending);
  });

  /* ------------------------------- keyboard ------------------------------- */

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      // Escape is the one binding that has to work from every state.
      if (callbacks.isPlaying()) {
        event.preventDefault();
        callbacks.requestPause();
        return;
      }
      if (!main?.classList.contains('hidden')) {
        if (callbacks.isPaused()) { event.preventDefault(); callbacks.onResume(); }
        return;
      }
      event.preventDefault();
      show(main);
      return;
    }

    if (overlay?.classList.contains('hidden')) return;
    if (event.code !== 'ArrowDown' && event.code !== 'ArrowUp') return;

    // Arrow keys walk the focusable controls of the panel that is on screen, so
    // the menu is navigable without knowing where Tab happens to be.
    const panel = [main, settings, registry].find((p) => p && !p.classList.contains('hidden'));
    const items = focusable(panel);
    if (items.length === 0) return;

    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.code === 'ArrowDown'
      ? (at + 1) % items.length
      : (at <= 0 ? items.length - 1 : at - 1);
    items[next].focus();
  });

  /* -------------------------------- surface ------------------------------- */

  return {
    pending,

    /** A titled message: level cleared, run over, and so on. */
    message({ title: t, text: body, button, action, theme }: any) {
      if (title) {
        title.textContent = t;
        title.className = theme ? `title-${theme}` : '';
      }
      if (text) text.textContent = body;
      if (startBtn) {
        startBtn.hidden = !button;
        if (button) startBtn.textContent = button;
      }
      if (action) {
        pending.level = clampLevel(action.level);
        if (lvlDisplay) lvlDisplay.textContent = String(pending.level);
      }

      restartPanelAnimation();
      overlay?.classList.remove('hidden');
      show(main);
      touch?.classList.add('hidden');
      if (button) requestAnimationFrame(() => startBtn?.focus());
    },

    pause() {
      if (title) {
        title.textContent = 'SISTEMA EN PAUSA';
        title.className = '';
      }
      if (text) text.textContent = 'El Ciclo espera. El Vacío también.';
      if (startBtn) {
        startBtn.hidden = false;
        startBtn.textContent = 'REANUDAR';
      }
      overlay?.classList.remove('hidden');
      show(main);
      touch?.classList.add('hidden');
      requestAnimationFrame(() => startBtn?.focus());
    },

    hide() {
      overlay?.classList.add('hidden');
      touch?.classList.remove('hidden');
    },
  };

  /* ------------------------------- helpers -------------------------------- */

  function bindToggle(id: string, initial: boolean, labels: [string, string], apply: (on: boolean) => void) {
    const btn = document.getElementById(id);
    if (!btn) return;
    let on = initial;
    const paint = () => {
      btn.classList.toggle('active', on);
      btn.textContent = on ? labels[0] : labels[1];
      btn.setAttribute('aria-pressed', String(on));
    };
    paint();
    btn.addEventListener('click', () => { on = !on; paint(); apply(on); });
  }

  function bindStepper(id: string, delta: number) {
    document.getElementById(id)?.addEventListener('click', () => {
      pending.level = clampLevel(pending.level + delta);
      if (lvlDisplay) lvlDisplay.textContent = String(pending.level);
      writeStore(KEYS.level, String(pending.level));
    });
  }

  function restartPanelAnimation() {
    const panel = overlay?.querySelector('.panel') as HTMLElement | null;
    if (!panel) return;
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';
  }
}

function focusable(panel: HTMLElement | null | undefined): HTMLElement[] {
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll<HTMLElement>('button:not([hidden]):not([disabled])'),
  ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
}

function focusFirst(panel: HTMLElement | null | undefined) {
  const items = focusable(panel);
  if (items.length > 0) requestAnimationFrame(() => items[0].focus());
}

function setChecked(btn: HTMLElement, on: boolean) {
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-checked', String(on));
}

function clampLevel(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(30, Math.max(1, Math.floor(n)));
}
