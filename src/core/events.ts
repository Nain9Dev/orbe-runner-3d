/**
 * Bus de eventos mínimo.
 *
 * Es el pegamento que permite que los sistemas se comuniquen sin conocerse
 * entre ellos: `physics` emite "player:hit" y quien quiera reacciona.
 */
export class Events {
  constructor() {
    this.listeners = new Map();
  }

  /** Suscribe un callback. Devuelve una función para desuscribirse. */
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copia: un listener puede desuscribirse durante la emisión.
    for (const fn of [...set]) fn(payload);
  }

  clear() {
    this.listeners.clear();
  }
}
