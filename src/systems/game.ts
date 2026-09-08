import { CONFIG } from '../config.js';
import { buildLevel } from '../game/level.js';
import { spawn } from '../game/prefabs.js';
import { applyDamage, isCritical } from '../domain/integrity.js';

/**
 * The rules. The only system that knows what this game is *about*.
 *
 * Everything below it — the engine, the solver, the renderer — is generic and
 * has never heard of a Fragmento or a Núcleo. Everything above it reads
 * `world.state` and draws.
 *
 * Integrity arithmetic is delegated to `src/domain/integrity.ts` rather than
 * being written inline. It is three lines of subtraction, but it is three lines
 * that decide whether a run ends, and having them in one pure, tested place is
 * worth more than the indirection costs.
 */
export function gameSystem() {
  let levelTimer = 0;

  return {
    name: 'game',

    init(world) {
      // The enemy systems spawn bolts through this seam rather than importing
      // the prefab registry, which is what keeps them testable in isolation.
      world.state.spawn = spawn;

      world.events.on('orb:collected', ({ value = 1, tier = 'path' }) => {
        world.state.collected += 1;
        world.state.score = (world.state.score ?? 0) + value;
        bumpResonance(world, tier === 'risk' ? 2 : 1);

        if (world.state.collected >= world.state.totalOrbs) {
          world.state.status = 'levelup';
          levelTimer = 1.6;
          world.events.emit('game:levelup', { level: world.state.level });
          world.events.emit('ui:message', {
            title: `Ciclo ${world.state.level} superado`,
            text: 'Convergiendo hacia el siguiente umbral…',
            button: null,
            theme: 'victory',
          });
        }
      });

      // Shattering a Sombra feeds the same meter Fragmentos do. That is the
      // point: the aggressive line and the collecting line are the same line.
      world.events.on('enemy:shattered', ({ at }) => {
        world.state.score = (world.state.score ?? 0) + 5;
        world.state.shattered = (world.state.shattered ?? 0) + 1;
        bumpResonance(world, 1);
        world.events.emit('ui:toast', { text: 'SOMBRA FRACTURADA', tone: 'good', at });
      });

      world.events.on('player:anchored', () => {
        world.events.emit('ui:toast', { text: 'BALIZA ANCLADA', tone: 'info' });
      });

      world.events.on('powerup:collected', ({ powerup }) => {
        const player = world.first('player');
        if (!player) return;
        const type = powerup.powerup.type;
        player.player.buff = { type, timeleft: 15 };
        if (type === 'shield') world.state.shield = true;
        world.events.emit('ui:toast', { text: `${POWERUP_LABEL[type] ?? type} activo`, tone: 'good' });
      });

      world.events.on('powerup:expired', (buff) => {
        if (buff?.type === 'shield') world.state.shield = false;
        world.events.emit('ui:toast', { text: 'Ventaja agotada', tone: 'warn' });
      });

      world.events.on('player:hit', ({ player, source }) => damage(world, player, source));

      world.events.on('body:fell', (entity) => {
        if (entity.player) fall(world, entity);
        else world.destroy(entity);
      });

      world.events.on('game:start', ({ level = 1, lives = CONFIG.player.lives } = {}) => {
        Object.assign(world.state, {
          timeScale: 1,
          combo: 0,
          comboTimer: 0,
          comboWindow: 0,
          score: 0,
          shield: false,
          shattered: 0,
          bestCombo: 0,
        });
        world.state.gameOverIn = 0;
        buildLevel(world, level, { lives });
        world.events.emit('ui:hide');
      });
    },

    update(world, dt) {
      if (world.state.status === 'playing' && world.state.comboTimer > 0) {
        world.state.comboTimer -= dt;
        world.state.comboWindow = Math.max(0, world.state.comboTimer / RESONANCE_WINDOW);
        if (world.state.comboTimer <= 0) {
          world.state.combo = 0;
          world.state.comboWindow = 0;
          world.events.emit('combo:lost');
        }
      }

      // The death pause is measured in simulated time, not by a wall-clock
      // timer. The previous implementation used `setTimeout`, which kept running
      // while the tab was hidden and while the game was paused, so the game-over
      // menu could arrive over a frozen frame — or several seconds after the
      // player had already alt-tabbed back.
      if (world.state.gameOverIn > 0) {
        world.state.gameOverIn -= dt;
        if (world.state.gameOverIn <= 0) showGameOver(world);
      }

      if (world.state.status !== 'levelup') return;
      levelTimer -= dt;
      if (levelTimer <= 0) {
        const player = world.first('player');
        world.events.emit('game:start', {
          level: world.state.level + 1,
          lives: player?.player.lives ?? CONFIG.player.lives,
        });
      }
    },
  };
}

/* -------------------------------------------------------------------------- */

const RESONANCE_WINDOW = 3.0;

const POWERUP_LABEL = {
  shield: 'Escudo',
  magnet: 'Imán',
  jump: 'Súper Salto',
  time: 'Cámara Lenta',
};

/** Resonancia milestones are announced; the rest just tick up quietly. */
function bumpResonance(world, steps) {
  const before = world.state.combo || 0;
  world.state.combo = before + steps;
  world.state.comboTimer = RESONANCE_WINDOW;
  world.state.comboWindow = 1;
  world.state.bestCombo = Math.max(world.state.bestCombo ?? 0, world.state.combo);

  const milestone = Math.floor(world.state.combo / 5);
  if (milestone > Math.floor(before / 5) && world.state.combo >= 5) {
    world.events.emit('ui:toast', { text: `RESONANCIA x${world.state.combo}`, tone: 'good' });
  }
}

/**
 * Falling into the void.
 *
 * **The void does not take Núcleo.** It takes the Resonancia and the seconds
 * spent getting back — and Lúmen reappears at the last Baliza, not at the start
 * of the Ciclo (REQ-024.19).
 *
 * This is the single most consequential balance decision in spec 024, and it was
 * made against evidence rather than taste. Falling was originally worth one
 * layer, like any other hazard; a scripted bot then crossed Ciclo 1 four times
 * and ended every run at zero integrity with three falls and zero enemy
 * contacts. With three layers and gaps every seven units, "a missed jump costs a
 * third of your run" makes the void, not the Sombras, the thing the game is
 * about — and platforming mistakes are the ones a player makes while they are
 * still learning the arc.
 *
 * So the contract splits cleanly, and it is a contract the player can learn in
 * one Ciclo:
 *
 *   - **Sombras and plasma take Núcleo.**  Those are what you dodge.
 *   - **The void takes Resonancia.**       That is what you lose by falling.
 *
 * The fall still costs something real — up to 30 % movement speed and every
 * step of a streak that may have taken a minute to build — so it is not free.
 * It just is not fatal.
 */
function fall(world, player) {
  const lostStreak = world.state.combo ?? 0;

  world.state.combo = 0;
  world.state.comboTimer = 0;
  world.state.comboWindow = 0;

  respawn(world, player);
  // A short grace on arrival: reappearing inside a Sombra's lunge would turn a
  // free mistake into an expensive one anyway.
  player.player.invulnerable = Math.max(player.player.invulnerable, 1.0);

  world.events.emit('player:voided', { player, lostStreak });
  world.events.emit('ui:toast', {
    text: lostStreak > 1 ? `VACÍO · RESONANCIA x${lostStreak} PERDIDA` : 'VACÍO · REANCLANDO',
    tone: 'warn',
  });
}

function damage(world, player, source = null) {
  if (world.state.status !== 'playing') return;
  if (player.player.invulnerable > 0) return;

  const state = {
    current: player.player.lives,
    max: player.player.maxLives ?? CONFIG.player.lives,
    shield: player.player.buff?.type === 'shield',
  };
  const result = applyDamage(state, source?.hazard?.damage ?? 1);
  const hitAt = player.transform.position.clone();

  if (result.absorbed) {
    player.player.buff = null;
    world.state.shield = false;
    player.player.invulnerable = CONFIG.player.respawnInvuln;
    world.events.emit('player:damaged', {
      player, at: hitAt, from: source?.transform?.position?.clone?.() ?? null,
      shielded: true, lost: 0,
    });
    world.events.emit('ui:toast', { text: 'ESCUDO ROTO', tone: 'warn' });
    return;
  }

  player.player.lives = result.state.current;
  player.player.invulnerable = CONFIG.player.respawnInvuln;

  Object.assign(world.state, {
    integrity: result.state.current,
    lives: result.state.current,          // deprecated mirror
    critical: isCritical(result.state),
  });

  respawn(world, player);

  world.events.emit('player:damaged', {
    player,
    at: hitAt,
    // Where the hit came *from*, so the HUD can point at it (REQ-025.26).
    // `at` is where Lúmen was standing, which answers a different question.
    from: source?.transform?.position?.clone?.() ?? null,
    shielded: false,
    lost: result.lost,
    critical: isCritical(result.state),
  });

  if (!result.lethal) return;

  world.state.status = 'gameover';
  world.state.timeScale = 0.05;            // the long look at the mistake
  world.events.emit('game:over', { level: world.state.level, score: world.state.score });

  // 1.2 seconds of wall clock. `dt` arrives already multiplied by `timeScale`,
  // so the budget has to be expressed in the same dilated units the loop feeds
  // back — otherwise the "Matrix moment" would last twenty-four real seconds.
  world.state.gameOverIn = 1.2 * world.state.timeScale;
}

/** Returns Lúmen to its anchor, clears any in-flight dash, and resets the field. */
function respawn(world, player) {
  const anchor = player.player.checkpoint ?? player.player.spawn;
  if (anchor) player.transform.position.copy(anchor);

  player.body.velocity.set(0, 0, 0);
  player.body.noGravity = false;
  if (player.player.dash) {
    player.player.dash.time = 0;
    player.player.dash.cooldown = 0;
    player.player.dash.airLeft = CONFIG.player.dash.airDashes;
  }

  // Sombras camped on the anchor go home. Respawning inside a Coloso is not a
  // difficulty spike, it is a bug the player experiences as one.
  for (const enemy of world.query('enemy', 'transform')) {
    if (!enemy.enemy?.home) continue;
    if (enemy.transform.position.distanceTo(player.transform.position) < 12) {
      enemy.transform.position.copy(enemy.enemy.home);
      enemy.body?.velocity.set(0, 0, 0);
      if (enemy.fsm) { enemy.fsm.state = 'idle'; enemy.fsm.timer = 0.8; }
    }
  }
}

function showGameOver(world) {
  if (world.state.status !== 'gameover') return;
  world.state.gameOverIn = 0;
  world.state.timeScale = 1;
  world.events.emit('ui:message', {
    title: 'El núcleo se ha apagado',
    text: `Lúmen se dispersó en el Ciclo ${world.state.level}.`,
    button: 'Reintentar',
    theme: 'death',
    action: { level: 1, lives: CONFIG.player.lives },
    // A run deserves a scoreboard. Without one there is nothing to beat, and
    // nothing to beat is a short-lived game (REQ-025.27).
    summary: [
      { label: 'Ciclo alcanzado', value: String(world.state.level) },
      { label: 'Luz recuperada', value: String(world.state.score ?? 0) },
      { label: 'Mejor Resonancia', value: `x${world.state.bestCombo ?? 0}` },
      { label: 'Sombras fracturadas', value: String(world.state.shattered ?? 0) },
    ],
  });
}
