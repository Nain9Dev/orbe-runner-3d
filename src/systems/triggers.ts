import * as THREE from 'three';
import { CONFIG } from '../config.js';

const delta = new THREE.Vector3();

/**
 * Contact resolution: what touching something *means*.
 *
 * Kept separate from the solver because these are game events, not collisions to
 * push apart. The rule this file owns is the one the whole combat loop rests on:
 *
 *   **While an Impulso is active, contact with a Sombra damages the Sombra.**
 *
 * That single inversion (REQ-024.14) is what turns the dash from an escape hatch
 * into a decision. A Rastreador in your way stops being a tax on your route and
 * becomes a Resonancia step you can choose to take — at the price of spending
 * the dash you might have needed for the next gap.
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
      const dashing = (player.player.dash?.time ?? 0) > 0;

      animateAndCollect(world, player, pos, reach, elapsed, dt);
      anchorBeacons(world, player, pos, reach);

      if (dashing) {
        shatterOnDash(world, player, pos, reach);
        return;                              // i-frames: nothing can hurt Lúmen
      }

      if (player.player.invulnerable > 0) return;
      resolveHazards(world, player, pos, reach);
    },
  };
}

/* -------------------------------------------------------------------------- */

/** Fragmentos and power-ups: they spin, they bob, and they vanish on contact. */
function animateAndCollect(world, player, pos, reach, elapsed, dt) {
  for (const item of world.find('pickup', 'transform')) {
    item.transform.yaw += item.pickup.spin * dt;
    item.transform.position.y = item.pickup.base + Math.sin(elapsed * 2 + item.id) * 0.22;

    const magnet = player.player.buff?.type === 'magnet';
    const grab = reach + CONFIG.pickup.radius + 0.2 + (magnet ? 0.6 : 0);

    if (pos.distanceTo(item.transform.position) >= grab) continue;

    world.destroy(item);
    if (item.powerup) {
      world.events.emit('powerup:collected', { powerup: item });
    } else {
      world.events.emit('orb:collected', {
        orb: item,
        value: item.pickup.value,
        tier: item.pickup.tier ?? 'path',
      });
    }
  }
}

/**
 * Balizas. Anchoring is one-way and permanent for the Ciclo: a checkpoint you
 * can lose is a checkpoint you have to think about, and thinking about your
 * checkpoint is not what this game is for. (REQ-024.19)
 */
function anchorBeacons(world, player, pos, reach) {
  for (const beacon of world.find('checkpoint', 'transform')) {
    if (beacon.checkpoint.reached) continue;
    if (pos.distanceTo(beacon.transform.position) > reach + beacon.checkpoint.radius) continue;

    beacon.checkpoint.reached = true;
    player.player.checkpoint = pos.clone();
    beacon.avatar?.api.react?.('anchor');
    world.events.emit('player:anchored', { player, beacon, at: pos.clone() });
  }
}

/** An Impulso through a Sombra: the Sombra takes the hit, not Lúmen. */
function shatterOnDash(world, player, pos, reach) {
  for (const hazard of world.find('hazard', 'transform')) {
    if (!hazard.enemy) continue;                        // bolts and lava do not shatter
    if (pos.distanceTo(hazard.transform.position) > reach + hazard.hazard.radius + 0.35) continue;

    world.events.emit('enemy:hit', {
      enemy: hazard,
      amount: 1,
      from: pos.clone(),
    });
  }
}

/**
 * Everything that can hurt Lúmen, in one loop.
 *
 * Lava carries a `box` so it is tested as the rectangle it looks like. A radius
 * around a 12x7 pool either kills you standing beside it or lets you stand in a
 * corner of it — both of which read as the game lying about its own geometry.
 */
function resolveHazards(world, player, pos, reach) {
  for (const hazard of world.find('hazard', 'transform')) {
    const box = hazard.hazard.box;
    const centre = hazard.transform.position;

    const touching = box
      ? Math.abs(pos.x - centre.x) < box.x / 2 + reach &&
        Math.abs(pos.y - centre.y) < box.y / 2 + reach &&
        Math.abs(pos.z - centre.z) < box.z / 2 + reach
      : pos.distanceTo(centre) < reach + hazard.hazard.radius;

    if (!touching) continue;

    world.events.emit('player:hit', { player, source: hazard });
    if (hazard.projectile) world.destroy(hazard);
    return;                                             // one hit per frame
  }
}

/**
 * Area damage from a Coloso landing or a Devorador slam.
 *
 * A separate system rather than part of the trigger loop because a shockwave is
 * an instant, not a contact: it exists for exactly one frame and has to be
 * resolved when it is announced. (REQ-024.26)
 */
export function shockwaveSystem() {
  return {
    name: 'shockwave',

    init(world) {
      world.events.on('enemy:shockwave', ({ at, radius, damage, enemy }) => {
        world.events.emit('particles:shockwave', { at: at.clone(), radius });

        const player = world.first('player');
        if (!player || world.state.status !== 'playing') return;

        delta.subVectors(player.transform.position, at).setY(0);
        const distance = delta.length();
        if (distance > radius) return;

        // Always push, even through i-frames: being thrown is information, and
        // it is what sells the weight of the archetype.
        if (distance > 0) {
          delta.normalize();
          const force = 18 * (1 - distance / radius) + 6;
          player.body.velocity.addScaledVector(delta, force);
          player.body.velocity.y = Math.max(player.body.velocity.y, 7);
        }

        if (player.player.invulnerable > 0) return;
        world.events.emit('player:hit', {
          player,
          source: { hazard: { damage: damage ?? 2 }, enemy: enemy?.enemy },
        });
      });
    },
  };
}
