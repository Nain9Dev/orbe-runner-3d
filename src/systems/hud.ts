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
    touchControls: document.getElementById('touch-controls'),
  };

  return {
    name: 'hud',

    init(world) {
      let pending = { level: parseInt(localStorage.getItem('orbi_level') || '1') };
      
      // Leer Configuración
      const savedColor = localStorage.getItem('orbi_color');
      const savedMute = localStorage.getItem('orbi_mute') === 'true';
      const savedGfx = localStorage.getItem('orbi_gfx') === 'true'; // true = Low
      
      import('../config.js').then(m => {
        if (savedColor) m.CONFIG.player.color = parseInt(savedColor, 16);
        m.CONFIG.audio.muted = savedMute;
        m.CONFIG.graphics.lowQuality = savedGfx;
      });

      el.button.disabled = false;
      el.button.textContent = 'Jugar';

      // Elementos de Ajustes
      const mainContent = document.querySelector('#overlay > div:first-child');
      const settingsPanel = document.getElementById('settings-panel');
      const btnSettings = document.getElementById('btn-settings');
      const btnSave = document.getElementById('btn-save');
      const lvlUp = document.getElementById('lvl-up');
      const lvlDown = document.getElementById('lvl-down');
      const lvlDisplay = document.getElementById('lvl-display');
      const colorBtns = document.querySelectorAll('.color-btn');
      const btnSound = document.getElementById('btn-sound');
      const btnGfx = document.getElementById('btn-gfx');

      let currentLevel = pending.level;
      lvlDisplay.textContent = currentLevel;

      // Aplicar estado visual inicial
      if (savedColor) {
        colorBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
          if (b.dataset.color === savedColor) {
            b.classList.add('active');
            b.setAttribute('aria-checked', 'true');
          }
        });
      }

      function updateToggleBtn(btn, state, labelOn, labelOff) {
        if (state) {
          btn.classList.add('active');
          btn.textContent = labelOn;
        } else {
          btn.classList.remove('active');
          btn.textContent = labelOff;
        }
      }

      updateToggleBtn(btnSound, !savedMute, 'ON', 'OFF');
      updateToggleBtn(btnGfx, !savedGfx, 'ALTA', 'BAJA');

      // Alternar Paneles
      btnSettings.addEventListener('click', () => {
        mainContent.classList.add('hidden');
        settingsPanel.classList.remove('hidden');
      });

      btnSave.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        mainContent.classList.remove('hidden');
      });

      // Lógica Toggles (Audio / Gfx)
      let currentMute = savedMute;
      btnSound.addEventListener('click', () => {
        currentMute = !currentMute;
        localStorage.setItem('orbi_mute', currentMute.toString());
        updateToggleBtn(btnSound, !currentMute, 'ON', 'OFF');
        import('../config.js').then(m => m.CONFIG.audio.muted = currentMute);
      });

      let currentGfx = savedGfx;
      btnGfx.addEventListener('click', () => {
        currentGfx = !currentGfx;
        localStorage.setItem('orbi_gfx', currentGfx.toString());
        updateToggleBtn(btnGfx, !currentGfx, 'ALTA', 'BAJA');
        import('../config.js').then(m => m.CONFIG.graphics.lowQuality = currentGfx);
      });

      // Lógica Selector de Nivel
      lvlUp.addEventListener('click', () => {
        currentLevel = Math.min(20, currentLevel + 1);
        lvlDisplay.textContent = currentLevel;
        pending.level = currentLevel;
        localStorage.setItem('orbi_level', currentLevel.toString());
      });

      lvlDown.addEventListener('click', () => {
        currentLevel = Math.max(1, currentLevel - 1);
        lvlDisplay.textContent = currentLevel;
        pending.level = currentLevel;
        localStorage.setItem('orbi_level', currentLevel.toString());
      });

      // Lógica Selector de Color
      colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          colorBtns.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-checked', 'false');
          });
          const target = e.target as HTMLElement;
          target.classList.add('active');
          target.setAttribute('aria-checked', 'true');
          const colorHex = target.dataset.color;
          localStorage.setItem('orbi_color', colorHex);
          import('../config.js').then(m => m.CONFIG.player.color = parseInt(colorHex, 16));
        });
      });

      el.button.addEventListener('click', () => {
        input.requestLock();               // el bloqueo de ratón exige un gesto del usuario
        world.events.emit('game:start', pending);
      });

      world.events.on('ui:message', ({ title, text, button, action }) => {
        el.title.textContent = title;
        el.text.textContent = text;
        el.button.hidden = !button;
        if (button) el.button.textContent = button;
        if (action) {
            pending = action;
            currentLevel = pending.level;
            lvlDisplay.textContent = currentLevel;
        }
        el.overlay.classList.remove('hidden');
        mainContent.classList.remove('hidden');
        settingsPanel.classList.add('hidden');
        el.touchControls?.classList.add('hidden');
      });

      world.events.on('ui:hide', () => {
        el.overlay.classList.add('hidden');
        el.touchControls?.classList.remove('hidden');
      });
    },

    render(world) {
      el.score.textContent = world.state.collected.toString();
      el.total.textContent = world.state.totalOrbs.toString();
      el.level.textContent = 'Nivel ' + world.state.level;
      if (engine.fps !== undefined) {
        el.fps.textContent = `${engine.fps} FPS`;
      }
      
      // Sincronizar Pips de Vida
      const pipsContainer = document.getElementById('health-pips');
      if (pipsContainer) {
        // Asegurar que hay suficientes pips en el DOM
        import('../config.js').then(m => {
          const maxLives = m.CONFIG.player.lives;
          const currentLives = world.state.lives;
          const colorHex = '#' + m.CONFIG.player.color.toString(16).padStart(6, '0');

          while (pipsContainer.children.length < maxLives) {
            const pip = document.createElement('div');
            pip.className = 'health-pip';
            pipsContainer.appendChild(pip);
          }

          // Actualizar estado (activo/inactivo) y color de los pips
          for (let i = 0; i < maxLives; i++) {
            const pip = pipsContainer.children[i] as HTMLElement;
            if (i < currentLives) {
              pip.classList.add('active');
              pip.style.background = colorHex;
              pip.style.boxShadow = `0 0 8px ${colorHex}`;
            } else {
              pip.classList.remove('active');
              pip.style.background = 'rgba(255, 255, 255, 0.2)';
              pip.style.boxShadow = 'none';
            }
          }
        });
      }

      if (world.state.status === 'playing') {
        el.overlay.classList.add('hidden');
      } else {
        el.overlay.classList.remove('hidden');
        if (world.state.status === 'won') {
          el.title.textContent = '¡Fragmentos Recuperados!';
          el.text.textContent = 'Nivel ' + world.state.level + ' completado.';
          el.button.textContent = 'Siguiente Nivel';
        } else if (world.state.status === 'lost') {
          el.title.textContent = 'La luz se ha desvanecido';
          el.text.textContent = 'Las Sombras te atraparon.';
          el.button.textContent = 'Reintentar Nivel ' + world.state.level;
        }
      }
    },
  };
}
