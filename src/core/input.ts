/**
 * Input: teclado + ratón, expuestos como estado consultable.
 *
 * Los sistemas no escuchan eventos del DOM: preguntan por el estado actual
 * (`input.down('KeyW')`). Así el mismo sistema funciona si mañana el estado lo
 * rellena un mando, una IA o una repetición grabada.
 */
export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.mouse = { dx: 0, dy: 0, locked: false };
    this._target = target;
    this._handlers = [];

    this._bind(window, 'keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault(); // evita el scroll de la página
    });
    this._bind(window, 'keyup', (e) => this.keys.delete(e.code));
    this._bind(window, 'blur', () => this.keys.clear());

    this._bind(document, 'pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === this._target;
    });
    this._bind(window, 'mousemove', (e) => {
      if (!this.mouse.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
  }

  /** ¿Está pulsada esta tecla? Acepta varios códigos (OR). */
  down(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  /** Consume el movimiento de ratón acumulado desde la última llamada. */
  consumeMouse() {
    const delta = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return delta;
  }

  requestLock() {
    this._target.requestPointerLock?.();
  }

  _bind(el, type, fn) {
    el.addEventListener(type, fn);
    this._handlers.push(() => el.removeEventListener(type, fn));
  }

  dispose() {
    for (const off of this._handlers) off();
    this._handlers.length = 0;
  }
}
