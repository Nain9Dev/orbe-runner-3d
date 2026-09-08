import * as THREE from 'three';

const pull = new THREE.Vector3();

/**
 * Temporary advantages: the four Ventajas and their lifetimes.
 *
 * The buff clock runs in *real* seconds even while Cámara Lenta is dilating the
 * simulation, which is why the countdown divides by `timeScale`. A slow-motion
 * power-up that also extends its own duration would never end.
 */
export function powerupsSystem() {
  const magnetRadius = 15;
  const magnetSpeed = 14;

  return {
    name: 'powerups',

    update(world, dt) {
      if (world.state.status !== 'playing') return;

      const p = world.first('player');
      if (!p) return;

      const buff = p.player.buff;
      if (!buff) {
        world.state.timeScale = 1;
        world.state.shield = false;
        world.state.buff = null;
        return;
      }

      buff.timeleft -= dt / (world.state.timeScale || 1);

      if (buff.timeleft <= 0) {
        world.events.emit('powerup:expired', buff);
        p.player.buff = null;
        world.state.timeScale = 1;
        world.state.buff = null;
        return;
      }

      world.state.buff = { type: buff.type, timeleft: buff.timeleft };

      if (buff.type === 'magnet') attract(world, p, magnetRadius, magnetSpeed, dt);
      else if (buff.type === 'time') world.state.timeScale = 0.4;
      else if (buff.type === 'shield') world.state.shield = true;
    },
  };
}

/**
 * Imán: drags loose Fragmentos towards Lúmen.
 *
 * Note the query. This used to read `world.query('orb', …)`, looking for a
 * component named `orb` that no prefab has ever declared — Fragmentos carry the
 * tag `orb` and the component `pickup`. The query matched nothing, so the Imán
 * has never once attracted anything. Querying `pickup` and skipping power-ups
 * fixes it, and keeps the magnet from dragging the next Ventaja into your lap.
 */
function attract(world, player, radius, speed, dt) {
  const from = player.transform.position;

  for (const item of world.query('pickup', 'transform')) {
    if (item.powerup) continue;

    const to = item.transform.position;
    const distance = from.distanceTo(to);
    if (distance > radius || distance === 0) continue;

    // Pull harder the closer it gets, so Fragmentos snap in rather than drifting.
    const urgency = 0.35 + (1 - distance / radius) * 0.65;
    pull.subVectors(from, to).normalize().multiplyScalar(speed * urgency * dt);
    to.add(pull);

    // `triggerSystem` rewrites `y` from the bob base every frame, so the base
    // has to travel with the Fragmento or the magnet only works horizontally.
    item.pickup.base += pull.y;
  }

  world.state.magnetRadius = radius;
}
