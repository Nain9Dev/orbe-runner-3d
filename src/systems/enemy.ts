import * as THREE from 'three';
import { CONFIG } from '../config.js';

const dir = new THREE.Vector3();
const away = new THREE.Vector3();

/**
 * IA de los cazadores: perseguir si el jugador está cerca, patrullar si no,
 * y separarse un poco entre ellos para no apelotonarse.
 *
 * Comportamientos nuevos (huir, disparar, patrullar rutas) se añaden como
 * sistemas aparte que filtren por su propio componente.
 */
export function enemySystem() {
  return {
    name: 'enemy',

    update(world, dt) {
      if (world.state.status !== 'playing') return;

      const player = world.first('player');
      const enemies = world.find('enemy', 'transform', 'body');

      for (const e of enemies) {
        const pos = e.transform.position;
        let speed = e.enemy.speed;

        if (player && pos.distanceTo(player.transform.position) < (e.enemy.aggroRange || 16)) {
          dir.subVectors(player.transform.position, pos);
        } else {
          // Patrulla: vuelve a su zona y da vueltas alrededor.
          dir.subVectors(e.enemy.home, pos);
          if (dir.lengthSq() < 4) dir.set(Math.sin(pos.x + pos.z), 0, Math.cos(pos.x - pos.z));
          speed *= 0.55;
        }

        dir.y = 0;
        if (dir.lengthSq() > 0) dir.normalize();

        // La física ahora resuelve los choques entre enemigos,
        // no hace falta código manual de separación.
        const accelFactor = e.body.grounded ? (e.body.friction ?? 10) : (e.body.drag ?? 2);
        
        e.body.velocity.x += dir.x * speed * accelFactor * dt;
        e.body.velocity.z += dir.z * speed * accelFactor * dt;
        e.transform.yaw = Math.atan2(dir.x, dir.z);

        // Saltito cuando chocan con un obstáculo pero siguen empujando.
        if (e.body.grounded && Math.hypot(e.body.velocity.x, e.body.velocity.z) < speed * 0.25) {
          e.body.velocity.y = 7;
        }
      }
    },
  };
}

export function interceptorSystem() {
  const dir = new THREE.Vector3();
  return {
    name: 'interceptor',
    update(world, dt) {
      if (world.state.status !== 'playing') return;
      
      const player = world.first('player');
      const interceptors = world.find('interceptor', 'transform', 'body', 'ai');
      
      for (const e of interceptors) {
        const ai = e.ai;
        const pos = e.transform.position;
        const speed = e.interceptor?.speed || 15;
        
        if (ai.state === 'idle') {
          ai.timer -= dt;
          e.body.velocity.x *= 0.9;
          e.body.velocity.z *= 0.9;
          
          if (player && pos.distanceTo(player.transform.position) < 18 && ai.timer <= 0) {
            ai.state = 'aiming';
            ai.timer = 1.0; // 1 second to aim
          }
        } else if (ai.state === 'aiming') {
          ai.timer -= dt;
          if (player) {
            dir.subVectors(player.transform.position, pos);
            dir.y = 0;
            if (dir.lengthSq() > 0) dir.normalize();
            e.transform.yaw = Math.atan2(dir.x, dir.z);
          }
          if (ai.timer <= 0) {
            ai.state = 'dashing';
            ai.timer = 0.5; // dash duration
            ai.targetDir = dir.clone();
          }
        } else if (ai.state === 'dashing') {
          ai.timer -= dt;
          e.body.velocity.x = ai.targetDir.x * speed;
          e.body.velocity.z = ai.targetDir.z * speed;
          if (ai.timer <= 0) {
            ai.state = 'idle';
            ai.timer = 2.0; // cooldown
          }
        }
      }
    }
  };
}

export function droneSystem() {
  const dir = new THREE.Vector3();
  return {
    name: 'drone',
    update(world, dt) {
      if (world.state.status !== 'playing') return;
      
      const player = world.first('player');
      if (!player) return;
      
      const drones = world.find('drone', 'transform', 'body', 'ally');
      for (const d of drones) {
        const ally = d.ally;
        const pos = d.transform.position;
        const pPos = player.transform.position;
        
        dir.subVectors(pPos, pos);
        dir.y = 0;
        const dist = dir.length();
        
        if (dist > ally.followDist) {
          dir.normalize();
          d.body.velocity.x += dir.x * 20 * dt;
          d.body.velocity.z += dir.z * 20 * dt;
        } else {
          d.body.velocity.x *= 0.95;
          d.body.velocity.z *= 0.95;
        }
        
        // Simple attack logic: find nearest enemy
        ally.fireTimer = (ally.fireTimer || 0) - dt;
        if (ally.fireTimer <= 0) {
          let nearest = null;
          let minDist = 15;
          for (const e of world.find('enemy', 'transform')) {
            const d = pos.distanceTo(e.transform.position);
            if (d < minDist) { minDist = d; nearest = e; }
          }
          if (nearest) {
            world.events.emit('particles:burst', { pos: nearest.transform.position, color: 0x00ffff, count: 10 });
            // Push enemy away
            const pushDir = new THREE.Vector3().subVectors(nearest.transform.position, pos).normalize();
            nearest.body?.velocity.addScaledVector(pushDir, 10);
            ally.fireTimer = 2.0; // 2 sec cooldown
          }
        }
      }
    }
  };
}
