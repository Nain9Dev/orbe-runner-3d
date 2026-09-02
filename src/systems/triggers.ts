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

      // Objetos coleccionables (orbes y powerups): giran, flotan y se recogen al tocarlos.
      for (const item of world.find('pickup', 'transform')) {
        item.transform.yaw += item.pickup.spin * dt;
        item.transform.position.y = item.pickup.base + Math.sin(elapsed * 2 + item.id) * 0.22;

        if (pos.distanceTo(item.transform.position) < reach + CONFIG.pickup.radius + 0.2) {
          world.destroy(item);
          if (item.powerup) {
            world.events.emit('powerup:collected', { powerup: item });
          } else {
            world.events.emit('orb:collected', { orb: item, value: item.pickup.value });
          }
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
