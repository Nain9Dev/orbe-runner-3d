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
      for (const e of world.query('avatar', 'transform')) {
        const v = e.body?.velocity;
        const state = {
          speed: v ? Math.hypot(v.x, v.z) : 0,
          grounded: e.body?.grounded,
          yaw: e.transform.yaw,
          invulnerable: e.player ? e.player.invulnerable > 0 : false,
        };

        if (e.player) {
          // Amenaza más cercana: el modelo la usa para poner cara de susto.
          const enemy = nearest(world, e, 'enemy');
          state.threat = enemy ? enemy.dist : Infinity;

          // A dónde mira: al cazador si lo tiene encima, si no al orbe más cercano.
          const orb = nearest(world, e, 'pickup');
          const target = state.threat < 8 ? enemy : orb;
          Object.assign(state, localLook(e, target));
        }

        e.avatar.api.update(dt, state);
      }
    },
  };
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
