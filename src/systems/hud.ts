/**
 * HUD y menús: la única parte que toca el DOM.
 *
 * Lee `world.state` para los marcadores y escucha eventos `ui:*` para los
 * mensajes. Sustituir esta capa por React, por un canvas 2D o por nada no
 * afecta al resto del juego.
 */
export function hudSystem(engine, input) {
  const el = {
    level: document.getElementById('hud-level'),
    score: document.getElementById('hud-score'),
    lives: document.getElementById('hud-lives'),
    fps: document.getElementById('hud-fps'),
    overlay: document.getElementById('overlay'),
    title: document.getElementById('overlay-title'),
    text: document.getElementById('overlay-text'),
    button: document.getElementById('start'),
  };

  return {
    name: 'hud',

    init(world) {
      let pending = { level: 1 };

      // El botón nace desactivado en el HTML: si la red va lenta, nadie pulsa
      // "Jugar" antes de que el motor esté cargado.
      el.button.disabled = false;
      el.button.textContent = 'Jugar';

      el.button.addEventListener('click', () => {
        input.requestLock();               // el bloqueo de ratón exige un gesto del usuario
        world.events.emit('game:start', pending);
      });

      world.events.on('ui:message', ({ title, text, button, action }) => {
        el.title.textContent = title;
        el.text.textContent = text;
        el.button.hidden = !button;
        if (button) el.button.textContent = button;
        if (action) pending = action;
        el.overlay.classList.remove('hidden');
      });

      world.events.on('ui:hide', () => el.overlay.classList.add('hidden'));
    },

    render(world) {
      const s = world.state;
      el.level.textContent = `Nivel ${s.level ?? 1}`;
      el.score.textContent = `Orbes ${s.collected ?? 0}/${s.totalOrbs ?? 0}`;
      el.lives.textContent = `Vidas ${s.lives ?? 0}`;
      el.fps.textContent = `${engine.fps} FPS`;
    },
  };
}
