import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createIntegrityMeter } from '../ui/health.js';
import { createDashRing, createComboDial, createProgress, createPowerupChip, createToasts } from '../ui/widgets.js';
import { createScreenFx } from '../ui/screen.js';
import { createCompass } from '../ui/compass.js';
import { createCycleCard, TIER_NAMES } from '../ui/widgets.js';
import { createMenu } from '../ui/menu.js';

/**
 * The binder: ECS world ➜ presentation.
 *
 * This file used to *be* the interface — 282 lines of DOM construction,
 * `localStorage`, dynamic `import()` calls inside the render loop and per-frame
 * layout writes. It also contained the single worst bug in the codebase:
 *
 * ```js
 * el.score.textContent = world.state.collected.toString();
 * el.total.textContent = world.state.totalOrbs.toString();   // el.total is undefined
 * ```
 *
 * There is no `#hud-total` in the markup, so `el.total` was `undefined` and the
 * second line threw a `TypeError` **on every frame**. The exception aborted the
 * rest of `render()` — the Ciclo counter, the FPS readout, the Resonancia, the
 * Ventaja timer and the entire health bar — and, because systems render in
 * registration order, it also killed the render phase of every system after this
 * one. The game looked like it worked because the 3D renderer runs first.
 *
 * The fix is not a null check. It is the layer boundary `AGENTS.md` asks for:
 * widgets live in `src/ui/`, they own their own DOM, and this system does one
 * thing — read `world.state` and push plain values at them (REQ-024.29).
 */
export function hudSystem(engine, input) {
  const el = {
    level: document.getElementById('hud-level'),
    fps: document.getElementById('hud-fps'),
    light: document.getElementById('hud-light'),
  };

  const integrity = createIntegrityMeter(document.getElementById('integrity'));
  const dashRing = createDashRing(
    document.getElementById('hud-dash-arc') as unknown as SVGCircleElement,
    document.getElementById('hud-reticle'),
  );
  const combo = createComboDial(
    document.getElementById('hud-combo'),
    document.getElementById('hud-combo-value'),
    document.getElementById('hud-combo-arc') as unknown as SVGCircleElement,
  );
  const progress = createProgress(
    document.getElementById('hud-progress'),
    document.getElementById('hud-progress-fill'),
    document.getElementById('hud-score'),
    document.getElementById('hud-total'),
  );
  const powerup = createPowerupChip(
    document.getElementById('hud-powerup'),
    document.getElementById('hud-powerup-icon'),
    document.getElementById('hud-powerup-name'),
    document.getElementById('hud-powerup-time'),
  );
  const toasts = createToasts(document.getElementById('hud-toasts'));
  const compass = createCompass(document.getElementById('hud-compass'));
  const cycleCard = createCycleCard(
    document.getElementById('hud-cycle-card'),
    document.getElementById('hud-cycle-number'),
    document.getElementById('hud-cycle-name'),
  );
  const fx = createScreenFx();

  // Last written values, so the binder touches the DOM only on a real change.
  const shown = { level: -1, fps: -1, light: -1 };

  return {
    name: 'hud',

    init(world) {
      const menu = createMenu({
        onStart: (pending) => {
          input.requestLock();
          world.events.emit('game:start', pending);
        },
        onResume: () => {
          input.requestLock();
          world.state.status = 'playing';
          world.events.emit('ui:hide');
        },
        isPaused: () => world.state.status === 'paused',
        isPlaying: () => world.state.status === 'playing',
        requestPause: () => {
          world.state.status = 'paused';
          world.events.emit('ui:pause');
        },
        onAudio: (settings) => world.events.emit('audio:settings', settings),
      });

      world.events.on('ui:message', (payload) => { toasts.clear(); menu.message(payload); });
      world.events.on('ui:pause', () => menu.pause());
      world.events.on('ui:hide', () => { fx.reset(); menu.hide(); });
      world.events.on('ui:toast', ({ text, tone }) => toasts.push(text, tone));

      world.events.on('player:damaged', ({ shielded, lost, critical, from }) => {
        // Point at whatever did it, so the lesson is available (REQ-025.26).
        const bearing = screenBearing(world, from);
        if (bearing !== null) compass.damage(bearing);

        if (shielded) {
          fx.shieldBreak();
          integrity.onShieldBreak();
          return;
        }
        // The flash scales with the size of the hit: a Devorador slam takes three
        // layers and should not look like a graze from a Rastreador.
        fx.damage(0.35 + Math.min(1, (lost ?? 1) / 3) * 0.65);
        integrity.onDamage(lost ?? 1);
        if (critical) toasts.push('NÚCLEO CRÍTICO', 'bad');
      });

      world.events.on('level:built', ({ level }) => {
        toasts.clear();
        compass.clear();
        cycleCard.show(level, TIER_NAMES[Math.min(TIER_NAMES.length - 1, Math.floor((level - 1) / 3))]);
      });

      // The void is a distinct kind of setback and gets a distinct read: a blue
      // flash, not the red one, because nothing was taken from the Núcleo.
      world.events.on('player:voided', () => fx.shieldBreak());

      world.events.on('combo:lost', () => {
        if ((world.state.combo ?? 0) >= 5) toasts.push('RESONANCIA PERDIDA', 'warn');
      });
    },

    /**
     * Runs once per rendered frame, not once per logic step. Every widget
     * dirty-checks, so a 144 Hz display costs the same DOM work as a 30 Hz one.
     */
    render(world) {
      const state = world.state;

      if (state.level !== shown.level) {
        if (el.level) el.level.textContent = `CICLO ${state.level}`;
        shown.level = state.level;
      }

      const light = state.score ?? 0;
      if (light !== shown.light) {
        if (el.light) el.light.textContent = String(light);
        shown.light = light;
      }

      const fps = engine?.fps ?? 0;
      if (fps !== shown.fps) {
        if (el.fps) el.fps.textContent = `${fps} FPS`;
        shown.fps = fps;
      }

      progress.sync(state.collected ?? 0, state.totalOrbs ?? 0);
      combo.sync(state.combo ?? 0, state.comboWindow ?? 0);
      dashRing.sync(state.dashRatio ?? 1, !!state.dashing);
      powerup.sync(state.buff?.type ?? null, state.buff?.timeleft ?? 0);

      integrity.sync({
        current: state.integrity ?? state.lives ?? 0,
        max: state.maxIntegrity ?? CONFIG.player.lives,
        shield: !!state.shield,
        critical: !!state.critical,
        color: `#${(CONFIG.player.color >>> 0).toString(16).padStart(6, '0')}`,
      });

      fx.setCritical(!!state.critical && state.status === 'playing');
      fx.setDashing(!!state.dashing);

      compass.sync(state.status === 'playing' ? offscreenTells(world) : []);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Screen projection                                                           */
/* -------------------------------------------------------------------------- */

const projected = new THREE.Vector3();

/**
 * Screen-space bearing from the centre of the view to a world point.
 *
 * Returns radians in the CSS convention — 0 points right, positive turns
 * clockwise — which is what the compass transform consumes directly.
 *
 * The awkward case is *behind* the camera. A point behind projects to a
 * mirrored position, so an arrow drawn from it would point at exactly the wrong
 * side of the screen. Flipping both axes for that case is the standard fix and
 * the reason this is a function rather than three inline lines.
 */
function screenBearing(world, worldPos, requireOffscreen = false) {
  const camera = world.state.three?.camera;
  if (!camera || !worldPos) return null;

  projected.set(worldPos.x, worldPos.y, worldPos.z).project(camera);
  const behind = projected.z > 1;
  const x = behind ? -projected.x : projected.x;
  const y = behind ? -projected.y : projected.y;

  if (requireOffscreen && !behind && Math.abs(x) <= 0.92 && Math.abs(y) <= 0.92) return null;

  // NDC grows upwards, screen space grows downwards.
  return Math.atan2(-y, x);
}

/**
 * Every Sombra currently winding up that the player cannot see.
 *
 * This is the last hole in the fairness contract from ADR-010: the telegraph is
 * guaranteed, it is now drawn on the model, and this covers the case where the
 * model is behind the camera. `fsm.duration` is recorded by the enemy system, so
 * the urgency here is the same number the model is animating with.
 */
function offscreenTells(world) {
  const out = [];
  for (const e of world.find('enemy', 'transform', 'fsm')) {
    if (!e.fsm.telegraph) continue;
    const total = e.fsm.duration;
    if (!total || total <= 0) continue;

    const bearing = screenBearing(world, e.transform.position, true);
    if (bearing === null) continue;

    const left = Math.max(0, e.fsm.timer ?? 0);
    out.push({
      angle: bearing,
      urgency: Math.min(1, Math.max(0, 1 - left / total)),
      kind: 'telegraph',
      id: e.id,
    });
  }
  return out;
}
