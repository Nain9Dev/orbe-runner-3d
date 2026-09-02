import * as THREE from 'three';

/**
 * Sistema de Power-Ups.
 * Maneja la duración de los buffs y sus efectos activos frame a frame.
 */
export function powerupsSystem() {
  const magnetRadius = 15;
  const magnetSpeed = 12;

  return {
    name: 'powerups',
    
    update(world, dt) {
      if (world.state.status !== 'playing') return;
      
      const p = world.first('player');
      if (!p) return;

      if (p.player.buff) {
        // Reducir tiempo del buff (desescalando dt para que dure el tiempo real)
        p.player.buff.timeleft -= dt / (world.state.timeScale || 1.0);
        
        if (p.player.buff.timeleft <= 0) {
          world.events.emit('powerup:expired', p.player.buff);
          p.player.buff = null;
          world.state.timeScale = 1.0;
        } else {
          // Ejecutar efecto activo
          if (p.player.buff.type === 'magnet') {
            const pPos = p.transform.position;
            // Atraer orbes
            for (const orb of world.query('orb', 'transform')) {
              const oPos = orb.transform.position;
              const dist = pPos.distanceTo(oPos);
              if (dist < magnetRadius) {
                // Mover el orbe hacia el jugador
                const dir = new THREE.Vector3().subVectors(pPos, oPos).normalize();
                oPos.add(dir.multiplyScalar(magnetSpeed * dt));
              }
            }
          } else if (p.player.buff.type === 'time') {
            world.state.timeScale = 0.4; // Ralentizar todo el juego
          }
        }
      } else {
        world.state.timeScale = 1.0;
      }
    }
  };
}
