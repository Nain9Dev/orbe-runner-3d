/**
 * Da vida a los modelos animados.
 *
 * Cualquier entidad con componente `avatar` recibe cada paso de lógica un
 * retrato de cómo se está moviendo y de qué tiene alrededor; el modelo decide
 * qué hacer con eso (rodar, inclinarse, asustarse, celebrar).
 *
 * También traduce eventos del juego en reacciones. El resto del juego no sabe
 * nada de ojos ni de antenas: solo emite "orb:collected" y sigue a lo suyo.
 */
export function avatarSystem() {
  return {
    name: 'avatar',

    init(world) {
      const react = (kind) => {
        const player = world.first('player', 'avatar');
        player?.avatar.api.react?.(kind);
      };
      world.events.on('orb:collected', () => react('collect'));
      world.events.on('player:damaged', () => react('hit'));
      world.events.on('player:jump', () => react('jump'));
    },

    update(world, dt) {
      // The musical clock, handed to every model so the whole world can breathe
      // on the same beat (REQ-025.13). It is read once per step rather than per
      // model, and it is safe before the audio system has published anything.
      const beat = world.state.beat ?? null;

      for (const e of world.query('avatar', 'transform')) {
        const v = e.body?.velocity;
        const state = {
          speed: v ? Math.hypot(v.x, v.z) : 0,
          grounded: e.body?.grounded,
          yaw: e.transform.yaw,
          invulnerable: e.player ? e.player.invulnerable > 0 : false,
          beat,
          // The FSM, normalised, so a model can render the tell for whatever its
          // brain is currently doing (REQ-025.19). `progress` runs 0 → 1 across
          // the telegraph, which is exactly the shape a wind-up wants.
          fsm: e.fsm ? { state: e.fsm.state, progress: telegraphProgress(e) } : null,
          stunned: (e.enemy?.stun ?? 0) > 0,
          dashing: e.player ? (e.player.dash?.time ?? 0) > 0 : false,
          reached: e.checkpoint ? e.checkpoint.reached : undefined,
        };

        if (e.player) {
          // Amenaza más cercana: el modelo la usa para poner cara de susto.
          const enemy = nearest(world, e, 'enemy');
          state.threat = enemy ? enemy.dist : Infinity;

          // A dónde mira: al cazador si lo tiene encima, si no al orbe más cercano.
          const orb = nearest(world, e, 'pickup');
          const target = state.threat < 8 ? enemy : orb;
          Object.assign(state, localLook(e, target));
        } else if (e.enemy) {
          // Los cazadores solo tienen ojos para el jugador.
          const player = world.first('player', 'transform');
          const dist = player ? e.transform.position.distanceTo(player.transform.position) : Infinity;
          state.threat = dist;
          Object.assign(state, localLook(e, player ? { entity: player } : null));
        }

        e.avatar.api.update(dt, state);
      }
    },
  };
}

/**
 * How far through its current state a brain is, as 0..1.
 *
 * Telegraph states count *down* from their duration, so the progress a wind-up
 * animation wants is the inverse. The duration is recorded by the enemy system
 * when it enters the state, which is what keeps this from needing a copy of
 * every timing in the game.
 */
function telegraphProgress(entity) {
  const total = entity.fsm.duration;
  if (!total || total <= 0) return 0;
  const left = Math.max(0, entity.fsm.timer ?? 0);
  return Math.min(1, Math.max(0, 1 - left / total));
}

/** Entidad con ese componente más cercana a `from`, con su distancia. */
function nearest(world, from, component) {
  let best = null;
  for (const other of world.query(component, 'transform')) {
    const dist = from.transform.position.distanceTo(other.transform.position);
    if (!best || dist < best.dist) best = { entity: other, dist };
  }
  return best;
}

/**
 * Convierte "dónde está el objetivo" en un par de valores -1..1 en el espacio
 * local del modelo, que es lo que necesitan las pupilas.
 */
function localLook(entity, target) {
  if (!target) return { lookX: 0, lookY: 0 };

  const from = entity.transform.position;
  const to = target.entity.transform.position;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz) || 1;

  // Deshacemos el giro de la entidad para pasar a coordenadas del modelo.
  const yaw = entity.transform.yaw;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const lx = (dx * cos - dz * sin) / dist;
  const lz = (dx * sin + dz * cos) / dist;

  // Si el objetivo queda a la espalda, mira todo lo que puede hacia ese lado.
  const lookX = lz < 0 ? Math.sign(lx || 1) : lx;
  return { lookX, lookY: dy / dist };
}
