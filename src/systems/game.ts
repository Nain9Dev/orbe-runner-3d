import { CONFIG } from '../config.js';
import { buildLevel } from '../game/level.js';

/**
 * Reglas del juego: puntuación, vidas, cambio de nivel y fin de partida.
 *
 * Es el único sistema que conoce "de qué va" el juego. El motor, la física y
 * el render son genéricos y no saben nada de orbes ni de vidas.
 */
export function gameSystem() {
  let timer = 0;

  return {
    name: 'game',

    init(world) {
      world.events.on('orb:collected', ({ value }) => {
        world.state.collected += value;
        if (world.state.collected >= world.state.totalOrbs) {
          world.state.status = 'levelup';
          timer = 1.6;
          world.events.emit('game:levelup');
          world.events.emit('ui:message', {
            title: `¡Nivel ${world.state.level} superado!`,
            text: 'Preparando el siguiente...',
            button: null,
            theme: 'victory'
          });
        }
      });

      world.events.on('powerup:collected', ({ powerup }) => {
        const player = world.first('player');
        if (player) {
          player.player.buff = { type: powerup.powerup.type, timeleft: 15 };
        }
      });
      world.events.on('player:hit', ({ player, source }) => damage(world, player, source));

      world.events.on('body:fell', (entity) => {
        if (entity.player) damage(world, entity);
        else world.destroy(entity);
      });

      world.events.on('game:start', ({ level = 1, lives = CONFIG.player.lives } = {}) => {
        world.state.timeScale = 1.0;
        buildLevel(world, level, { lives });
        world.events.emit('ui:hide');
      });
    },

    update(world, dt) {
      if (world.state.status !== 'levelup') return;
      timer -= dt;
      if (timer <= 0) {
        const player = world.first('player');
        world.events.emit('game:start', {
          level: world.state.level + 1,
          lives: player?.player.lives ?? CONFIG.player.lives,
        });
      }
    },
  };
}

function damage(world, player, source = null) {
  if (world.state.status !== 'playing' || player.player.invulnerable > 0) return;

  if (player.player.buff?.type === 'shield') {
    player.player.buff = null;
    player.player.invulnerable = CONFIG.player.respawnInvuln;
    // Efecto visual/sonoro del escudo rompiéndose podría ir aquí o escuchar `player:damaged` sin pérdida de vida.
    // Emitimos igual el evento para audio pero indicando que el escudo paró el golpe.
    const hitAt = player.transform.position.clone();
    world.events.emit('player:damaged', { player, at: hitAt, shielded: true });
    return;
  }

  const hitAt = player.transform.position.clone(); // antes de reaparecer
  const dmg = source?.hazard?.damage ?? 1;
  player.player.lives -= dmg;
  world.state.lives = Math.max(0, player.player.lives);
  player.player.invulnerable = CONFIG.player.respawnInvuln;
  player.transform.position.copy(player.player.spawn);
  player.body.velocity.set(0, 0, 0);

  // Los cazadores cercanos vuelven a su zona: nada de acampar en el respawn.
  for (const enemy of world.query('enemy', 'transform')) {
    if (enemy.transform.position.distanceTo(player.player.spawn) < 12) {
      enemy.transform.position.copy(enemy.enemy.home);
      enemy.body.velocity.set(0, 0, 0);
    }
  }

  world.events.emit('player:damaged', { player, at: hitAt });

  if (player.player.lives <= 0) {
    world.state.status = 'gameover';
    world.state.timeScale = 0.05; // SLOW MOTION EXTREMO

    // Retrasar el menú de Game Over usando setTimeout para dar 
    // protagonismo a la cámara lenta y a las partículas.
    setTimeout(() => {
      world.state.timeScale = 1.0; // Restaurar para animaciones de UI
      world.events.emit('ui:message', {
        title: 'Fin de la partida',
        text: `Llegaste al nivel ${world.state.level} con ${world.state.collected} orbes.`,
        button: 'Reintentar',
        theme: 'death',
        action: { level: 1, lives: CONFIG.player.lives },
      });
    }, 1200); // 1.2 segundos reales de "Matrix mode"
  }
}
