import { CONFIG } from '../config.js';

/**
 * Contactos por distancia: recoger orbes y recibir golpes.
 *
 * Se mantiene aparte de la física de sólidos porque son eventos de juego, no
 * colisiones que haya que resolver: aquí solo se emite y otro sistema decide.
 */
export function triggerSystem() {
  let elapsed = 0;

  return {
    name: 'triggers',

    update(world, dt) {
      elapsed += dt;

      const player = world.first('player');
      if (!player || world.state.status !== 'playing') return;
      const pos = player.transform.position;
      const reach = player.body.radius;

      // Orbes: giran, flotan y se recogen al tocarlos.
      for (const orb of world.find('pickup', 'transform')) {
        orb.transform.yaw += orb.pickup.spin * dt;
        orb.transform.position.y = orb.pickup.base + Math.sin(elapsed * 2 + orb.id) * 0.22;

        if (pos.distanceTo(orb.transform.position) < reach + CONFIG.pickup.radius + 0.2) {
          world.destroy(orb);
          world.events.emit('orb:collected', { orb, value: orb.pickup.value });
        }
      }

      // Peligros: los cazadores hacen daño al contacto.
      if (player.player.invulnerable > 0) return;
      for (const hazard of world.query('hazard', 'transform')) {
        if (pos.distanceTo(hazard.transform.position) < reach + hazard.hazard.radius) {
          world.events.emit('player:hit', { player, source: hazard });
          return;
        }
      }
    },
  };
}
