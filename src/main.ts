import { World } from './core/world.js';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { CONFIG } from './config.js';

import { renderSystem } from './systems/render.js';
import { playerSystem } from './systems/player.js';
import { enemySystem, interceptorSystem, droneSystem } from './systems/enemy.js';
import { physicsSystem } from './systems/physics.js';
import { triggerSystem } from './systems/triggers.js';
import { cameraSystem } from './systems/camera.js';
import { avatarSystem } from './systems/avatar.js';
import { particleSystem } from './systems/particles.js';
import { gameSystem } from './systems/game.js';
import { hudSystem } from './systems/hud.js';
import { audioSystem } from './systems/audio.js';
import { powerupsSystem } from './systems/powerups.js';

/**
 * Arranque: montar el mundo y enchufar los sistemas en orden.
 *
 * Esta lista ES la definición del juego. Añadir una mecánica es añadir una
 * línea aquí; quitarla es borrarla. Nada más hay que tocar.
 */
const canvas = document.getElementById('game');
const input = new Input(canvas);
const world = new World();
const engine = new Engine(world);

Object.assign(world.state, {
  status: 'menu',
  level: 1,
  collected: 0,
  totalOrbs: 0,
  lives: CONFIG.player.lives,
});

world.addSystem(renderSystem(canvas)); // escena, luces y cámara
world.addSystem(playerSystem(input));  // intención del jugador -> velocidad
world.addSystem(enemySystem());        // IA -> velocidad
world.addSystem(interceptorSystem());
world.addSystem(droneSystem());
world.addSystem(physicsSystem());      // velocidad -> posición + colisiones
world.addSystem(triggerSystem());      // contactos -> eventos de juego
world.addSystem(cameraSystem(input));  // seguimiento de cámara
world.addSystem(avatarSystem());        // vida propia de los modelos
world.addSystem(particleSystem());      // chispas, polvo y celebraciones
world.addSystem(gameSystem());         // reglas: orbes, vidas, niveles
world.addSystem(powerupsSystem());     // gestor de ventajas temporales
world.addSystem(hudSystem(engine, input)); // marcadores y menús
world.addSystem(audioSystem());        // música procedural

// Lógica de Pausa / Ratón
canvas.addEventListener('click', () => {
  if (world.state.status === 'playing') input.requestLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && world.state.status === 'playing') {
    world.state.status = 'paused';
    world.events.emit('ui:pause');
  }
});

engine.start();

// Punto de entrada para consola y mods: `GAME.world.addSystem(...)` en caliente.
window.GAME = { world, engine, input, CONFIG };
