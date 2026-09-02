/**
 * Engine: el bucle principal.
 *
 * Usa paso fijo (fixed timestep) para la lógica, de forma que la física y la
 * IA se comportan igual a 30 o a 144 FPS. El acumulador se limita para que un
 * cambio de pestaña no provoque una "espiral de la muerte".
 */
export class Engine {
  constructor(world, { step = 1 / 60, maxFrame = 0.25 } = {}) {
    this.world = world;
    this.step = step;
    this.maxFrame = maxFrame;
    this.running = false;
    this.time = 0;          // tiempo simulado acumulado (segundos)
    this.fps = 0;
    this._accumulator = 0;
    this._last = 0;
    this._fpsTimer = 0;
    this._fpsFrames = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);

    const elapsed = Math.min((now - this._last) / 1000, this.maxFrame);
    this._last = now;
    this._accumulator += elapsed;

    while (this._accumulator >= this.step) {
      this.world.update(this.step);
      this.time += this.step;
      this._accumulator -= this.step;
    }

    // El dibujado va una vez por frame, no una vez por paso de lógica.
    this.world.render(elapsed);

    // Contador de FPS (solo informativo para el HUD).
    this._fpsFrames++;
    this._fpsTimer += elapsed;
    if (this._fpsTimer >= 0.5) {
      this.fps = Math.round(this._fpsFrames / this._fpsTimer);
      this._fpsFrames = 0;
      this._fpsTimer = 0;
    }
  }
}
