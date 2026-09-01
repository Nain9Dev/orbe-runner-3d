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
          world.events.emit('ui:message', {
            title: `¡Nivel ${world.state.level} superado!`,
            text: 'Preparando el siguiente...',
            button: null,
          });
        }
      });

      world.events.on('player:hit', ({ player }) => damage(world, player));

      world.events.on('body:fell', (entity) => {
        if (entity.player) damage(world, entity);
        else world.destroy(entity);
      });

      world.events.on('game:start', ({ level = 1, lives = CONFIG.player.lives } = {}) => {
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

function damage(world, player) {
  if (world.state.status !== 'playing' || player.player.invulnerable > 0) return;

  const hitAt = player.transform.position.clone(); // antes de reaparecer
  player.player.lives -= 1;
  world.state.lives = player.player.lives;
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
    world.events.emit('ui:message', {
      title: 'Fin de la partida',
      text: `Llegaste al nivel ${world.state.level} con ${world.state.collected} orbes.`,
      button: 'Reintentar',
      action: { level: 1, lives: CONFIG.player.lives },
    });
  }
}
