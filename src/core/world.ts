import { Events } from './events.js';

/**
 * World: un ECS (Entity-Component-System) diminuto.
 *
 *  - Entidad  = objeto plano con un `id`.
 *  - Componente = una propiedad de esa entidad (`transform`, `velocity`, ...).
 *  - Sistema  = función `update(world, dt)` que opera sobre las entidades
 *               que tienen ciertos componentes.
 *
 * Todo el crecimiento del juego pasa por aquí: añadir contenido es añadir
 * componentes, y añadir comportamiento es añadir un sistema. Nunca hay que
 * tocar el bucle principal.
 */
export class World {
  constructor() {
    this.entities = new Map();   // id -> entidad
    this.systems = [];           // sistemas en orden de ejecución
    this.events = new Events();  // bus compartido
    this.state = {};             // estado global del juego (score, nivel, ...)
    this._nextId = 1;
    this._toDestroy = new Set();
  }

  /* ----------------------------- Entidades ----------------------------- */

  /** Crea una entidad a partir de un objeto de componentes. */
  spawn(components = {}) {
    const entity = { id: this._nextId++, ...components };
    this.entities.set(entity.id, entity);
    this.events.emit('entity:spawned', entity);
    return entity;
  }

  /** Marca una entidad para eliminarse al final del frame (evita borrar mientras se itera). */
  destroy(entity) {
    if (entity) this._toDestroy.add(entity.id ?? entity);
  }

  /** Itera las entidades que tienen TODOS los componentes indicados. */
  *query(...components) {
    for (const entity of this.entities.values()) {
      let ok = true;
      for (const name of components) {
        if (entity[name] === undefined) { ok = false; break; }
      }
      if (ok) yield entity;
    }
  }

  /** Igual que `query` pero devuelve un array (cómodo cuando se va a mutar la lista). */
  find(...components) {
    return [...this.query(...components)];
  }

  /** Primera entidad que cumple la consulta, o `null`. */
  first(...components) {
    for (const entity of this.query(...components)) return entity;
    return null;
  }

  /* ------------------------------ Sistemas ----------------------------- */

  /**
   * Registra un sistema. Un sistema es un objeto:
   *   { name, init?(world), update?(world, dt), dispose?(world) }
   */
  addSystem(system) {
    this.systems.push(system);
    system.init?.(this);
    return system;
  }

  removeSystem(name) {
    const index = this.systems.findIndex((s) => s.name === name);
    if (index === -1) return false;
    this.systems[index].dispose?.(this);
    this.systems.splice(index, 1);
    return true;
  }

  /* -------------------------------- Ciclo ------------------------------ */

  update(dt) {
    for (const system of this.systems) {
      if (system.enabled === false) continue;
      system.update?.(this, dt);
    }
    this._flushDestroyed();
  }

  /** Fase de dibujado: se ejecuta una vez por frame, después de la lógica. */
  render(dt) {
    for (const system of this.systems) {
      if (system.enabled === false) continue;
      system.render?.(this, dt);
    }
  }

  _flushDestroyed() {
    if (this._toDestroy.size === 0) return;
    for (const id of this._toDestroy) {
      const entity = this.entities.get(id);
      if (!entity) continue;
      this.entities.delete(id);
      this.events.emit('entity:destroyed', entity);
    }
    this._toDestroy.clear();
  }

  /** Borra todas las entidades (los sistemas siguen vivos). Útil al cambiar de nivel. */
  clearEntities() {
    for (const entity of [...this.entities.values()]) this.destroy(entity);
    this._flushDestroyed();
  }
}
