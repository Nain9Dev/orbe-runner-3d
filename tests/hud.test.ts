import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { World } from '../src/core/world.js';
import { hudSystem } from '../src/systems/hud.js';
import { createIntegrityMeter } from '../src/ui/health.js';
import { CONFIG } from '../src/config.js';

/**
 * The HUD is tested against the *real* markup, not a hand-written fixture.
 *
 * That is the whole point: the bug this spec fixes was a binder reading
 * `#hud-total`, an element that did not exist in `index.html`. A fixture written
 * to match the binder would have reproduced the binder's assumptions and passed
 * happily while the shipped page threw on every frame.
 */
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

function mountDom() {
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

function makeWorld() {
  const world = new World();
  Object.assign(world.state, {
    status: 'playing',
    level: 1,
    collected: 0,
    score: 0,
    totalOrbs: 8,
    integrity: 3,
    maxIntegrity: 3,
    lives: 3,
    combo: 0,
    comboWindow: 0,
    dashRatio: 1,
    dashing: false,
    shield: false,
    critical: false,
    buff: null,
  });
  return world;
}

const fakeInput = { requestLock() {} };
const fakeEngine = { fps: 60 };

describe('HUD binder — REQ-024.29', () => {
  beforeEach(() => {
    mountDom();
    vi.useRealTimers();
  });

  it('renders 120 frames without throwing', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));

    expect(() => {
      for (let i = 0; i < 120; i++) {
        world.state.collected = i % 8;
        world.state.score = i;
        world.state.combo = i % 6;
        world.state.comboWindow = (i % 60) / 60;
        world.state.dashRatio = (i % 40) / 40;
        world.render(1 / 60);
      }
    }).not.toThrow();
  });

  it('populates the integrity meter instead of leaving it empty', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    world.render(1 / 60);

    const segments = document.querySelectorAll('#integrity-bar .seg');
    expect(segments.length).toBe(3);
    expect(document.querySelectorAll('#integrity-bar .seg.filled').length).toBe(3);
    expect(document.getElementById('integrity-now')?.textContent).toBe('3');
    expect(document.getElementById('integrity-max')?.textContent).toBe('3');
  });

  it('writes the Ciclo, the light total and the FPS readout', () => {
    const world = makeWorld();
    world.state.level = 7;
    world.state.score = 42;
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    world.render(1 / 60);

    expect(document.getElementById('hud-level')?.textContent).toBe('CICLO 7');
    expect(document.getElementById('hud-light')?.textContent).toBe('42');
    expect(document.getElementById('hud-fps')?.textContent).toBe('60 FPS');
  });

  it('tracks Ciclo progress — REQ-024.38', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    world.state.collected = 5;
    world.state.totalOrbs = 10;
    world.render(1 / 60);

    expect(document.getElementById('hud-score')?.textContent).toBe('5');
    expect(document.getElementById('hud-total')?.textContent).toBe('10');
    expect((document.getElementById('hud-progress-fill') as HTMLElement).style.transform)
      .toBe('scaleX(0.5)');
  });

  it('shows the Resonancia dial only above a streak of one — REQ-024.37', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    const dial = document.getElementById('hud-combo') as HTMLElement;

    world.render(1 / 60);
    expect(dial.hidden).toBe(true);

    world.state.combo = 4;
    world.state.comboWindow = 0.8;
    world.render(1 / 60);
    expect(dial.hidden).toBe(false);
    expect(document.getElementById('hud-combo-value')?.textContent).toBe('4');
    expect((document.getElementById('hud-combo-arc') as unknown as SVGElement).style.strokeDashoffset)
      .not.toBe('');
  });

  it('drives the Impulso ring from the readiness ratio — REQ-024.36', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    const reticle = document.getElementById('hud-reticle') as HTMLElement;

    world.state.dashRatio = 1;
    world.render(1 / 60);
    expect(reticle.classList.contains('dash-ready')).toBe(true);

    world.state.dashRatio = 0;
    world.state.dashing = true;
    world.render(1 / 60);
    expect(reticle.classList.contains('dash-ready')).toBe(false);
  });

  it('shows the active Ventaja and its remaining seconds', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    const chip = document.getElementById('hud-powerup') as HTMLElement;

    world.render(1 / 60);
    expect(chip.hidden).toBe(true);

    world.state.buff = { type: 'shield', timeleft: 12.4 };
    world.render(1 / 60);
    expect(chip.hidden).toBe(false);
    expect(document.getElementById('hud-powerup-name')?.textContent).toBe('Escudo');
    expect(document.getElementById('hud-powerup-time')?.textContent).toBe('13s');
  });

  it('raises a toast for a game event — REQ-024.39', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));

    world.events.emit('ui:toast', { text: 'SOMBRA FRACTURADA', tone: 'good' });

    const toasts = document.querySelectorAll('#hud-toasts .toast');
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toBe('SOMBRA FRACTURADA');
    expect(toasts[0].classList.contains('toast-good')).toBe(true);
  });

  it('collapses repeated toasts into a count instead of stacking them', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));

    for (let i = 0; i < 4; i++) {
      world.events.emit('ui:toast', { text: 'SOMBRA FRACTURADA', tone: 'good' });
    }

    const toasts = document.querySelectorAll('#hud-toasts .toast');
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toBe('SOMBRA FRACTURADA ×4');
  });

  it('flashes the damage vignette on a hit — REQ-024.42', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    const vignette = document.getElementById('damage-vignette') as HTMLElement;

    expect(vignette.classList.contains('hit')).toBe(false);
    world.events.emit('player:damaged', { shielded: false, lost: 1, critical: false });
    expect(vignette.classList.contains('hit')).toBe(true);
  });

  it('uses the shield colour when the Escudo absorbs the hit', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    const vignette = document.getElementById('damage-vignette') as HTMLElement;

    world.events.emit('player:damaged', { shielded: true, lost: 0 });
    expect(vignette.classList.contains('shielded')).toBe(true);
  });

  it('turns on the critical vignette at one layer — REQ-024.32', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    const critical = document.getElementById('critical-vignette') as HTMLElement;

    world.render(1 / 60);
    expect(critical.classList.contains('on')).toBe(false);

    world.state.integrity = 1;
    world.state.critical = true;
    world.render(1 / 60);
    expect(critical.classList.contains('on')).toBe(true);
  });

  it('writes only when a value actually changed', () => {
    const world = makeWorld();
    world.addSystem(hudSystem(fakeEngine, fakeInput));
    world.render(1 / 60);

    const level = document.getElementById('hud-level') as HTMLElement;
    const spy = vi.spyOn(level, 'textContent', 'set');

    for (let i = 0; i < 30; i++) world.render(1 / 60);
    expect(spy).not.toHaveBeenCalled();

    world.state.level = 2;
    world.render(1 / 60);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('Integrity meter — REQ-024.30 … REQ-024.35', () => {
  beforeEach(() => mountDom());

  it('renders one segment per point of maximum integrity — REQ-024.30', () => {
    const meter = createIntegrityMeter(document.getElementById('integrity'));
    meter.sync({ current: 5, max: 5, shield: false, critical: false, color: '#6ee7ff' });

    expect(document.querySelectorAll('#integrity-bar .seg').length).toBe(5);
    expect(meter.debug()).toEqual({ segments: 5, current: 5, max: 5 });
  });

  it('marks the lost segment as breaking so the chip layer can drain — REQ-024.31', () => {
    const root = document.getElementById('integrity');
    const meter = createIntegrityMeter(root);
    meter.sync({ current: 3, max: 3, shield: false, critical: false, color: '#6ee7ff' });
    meter.sync({ current: 2, max: 3, shield: false, critical: false, color: '#6ee7ff' });

    const segs = document.querySelectorAll('#integrity-bar .seg');
    expect(segs[2].classList.contains('breaking')).toBe(true);
    expect(segs[1].classList.contains('filled')).toBe(true);
    expect(segs[0].classList.contains('filled')).toBe(true);
  });

  it('breaks from the right, so damage reads as the bar retreating', () => {
    const meter = createIntegrityMeter(document.getElementById('integrity'));
    meter.sync({ current: 4, max: 4, shield: false, critical: false, color: '#6ee7ff' });
    meter.sync({ current: 2, max: 4, shield: false, critical: false, color: '#6ee7ff' });

    const segs = Array.from(document.querySelectorAll('#integrity-bar .seg'));
    expect(segs.map((s) => s.classList.contains('breaking'))).toEqual([false, false, true, true]);
  });

  it('uses a distinct animation when integrity is restored — REQ-024.34', () => {
    const meter = createIntegrityMeter(document.getElementById('integrity'));
    meter.sync({ current: 1, max: 3, shield: false, critical: true, color: '#6ee7ff' });
    meter.sync({ current: 3, max: 3, shield: false, critical: false, color: '#6ee7ff' });

    const segs = Array.from(document.querySelectorAll('#integrity-bar .seg'));
    expect(segs[1].classList.contains('repairing')).toBe(true);
    expect(segs[2].classList.contains('repairing')).toBe(true);
    expect(segs[1].classList.contains('breaking')).toBe(false);
  });

  it('marks the alarm state at one layer or less — REQ-024.32', () => {
    const root = document.getElementById('integrity') as HTMLElement;
    const meter = createIntegrityMeter(root);

    meter.sync({ current: 2, max: 3, shield: false, critical: false, color: '#6ee7ff' });
    expect(root.classList.contains('critical')).toBe(false);

    meter.sync({ current: 1, max: 3, shield: false, critical: true, color: '#6ee7ff' });
    expect(root.classList.contains('critical')).toBe(true);
  });

  it('renders the Escudo overlay across the whole bar — REQ-024.33', () => {
    const root = document.getElementById('integrity') as HTMLElement;
    const meter = createIntegrityMeter(root);

    meter.sync({ current: 3, max: 3, shield: true, critical: false, color: '#6ee7ff' });
    expect(root.classList.contains('shielded')).toBe(true);
    expect((document.getElementById('integrity-shield') as HTMLElement).hidden).toBe(false);

    meter.sync({ current: 3, max: 3, shield: false, critical: false, color: '#6ee7ff' });
    expect(root.classList.contains('shielded')).toBe(false);
  });

  it('exposes complete meter semantics to assistive tech — REQ-024.35', () => {
    const root = document.getElementById('integrity') as HTMLElement;
    const meter = createIntegrityMeter(root);

    meter.sync({ current: 2, max: 4, shield: false, critical: false, color: '#6ee7ff' });

    expect(root.getAttribute('role')).toBe('meter');
    expect(root.getAttribute('aria-valuemin')).toBe('0');
    expect(root.getAttribute('aria-valuemax')).toBe('4');
    expect(root.getAttribute('aria-valuenow')).toBe('2');
    expect(root.getAttribute('aria-valuetext')).toBe('Integridad 2 de 4');

    meter.sync({ current: 1, max: 4, shield: false, critical: true, color: '#6ee7ff' });
    expect(root.getAttribute('aria-valuetext')).toContain('crítica');

    meter.sync({ current: 0, max: 4, shield: false, critical: true, color: '#6ee7ff' });
    expect(root.getAttribute('aria-valuetext')).toBe('Núcleo colapsado');
  });

  it('rebuilds the row without losing the fill when the maximum changes — E-10', () => {
    const meter = createIntegrityMeter(document.getElementById('integrity'));
    meter.sync({ current: 2, max: 3, shield: false, critical: false, color: '#6ee7ff' });
    meter.sync({ current: 2, max: 5, shield: false, critical: false, color: '#6ee7ff' });

    const segs = Array.from(document.querySelectorAll('#integrity-bar .seg'));
    expect(segs.length).toBe(5);
    expect(segs.filter((s) => s.classList.contains('filled')).length).toBe(2);
    expect(document.getElementById('integrity-max')?.textContent).toBe('5');
  });

  it('takes Lúmen’s chosen frequency as the fill colour', () => {
    const root = document.getElementById('integrity') as HTMLElement;
    const meter = createIntegrityMeter(root);
    meter.sync({ current: 3, max: 3, shield: false, critical: false, color: '#39ff14' });

    expect(root.style.getPropertyValue('--integrity-color')).toBe('#39ff14');
  });

  it('clamps nonsense input instead of rendering a broken bar', () => {
    const meter = createIntegrityMeter(document.getElementById('integrity'));
    meter.sync({ current: 99, max: 3, shield: false, critical: false, color: '#6ee7ff' });
    expect(meter.debug().current).toBe(3);

    meter.sync({ current: Number.NaN, max: 3, shield: false, critical: false, color: '#6ee7ff' });
    expect(meter.debug().current).toBe(0);
  });

  it('degrades to a no-op when its root is missing', () => {
    const meter = createIntegrityMeter(null);
    expect(() => meter.sync({ current: 1, max: 3, shield: false, critical: false, color: '#fff' })).not.toThrow();
    expect(meter.debug()).toEqual({ segments: 0, current: 0, max: 0 });
  });

  it('keeps the default maximum in step with the configured integrity', () => {
    expect(CONFIG.player.lives).toBeGreaterThanOrEqual(1);
  });
});
