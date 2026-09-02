/**
 * Input: teclado + ratón, expuestos como estado consultable.
 *
 * Los sistemas no escuchan eventos del DOM: preguntan por el estado actual
 * (`input.down('KeyW')`). Así el mismo sistema funciona si mañana el estado lo
 * rellena un mando, una IA o una repetición grabada.
 */
export class Input {
  keys: Set<string>;
  virtualKeys: Set<string>;
  mouse: { dx: number; dy: number; locked: boolean };
  _target: any;
  _handlers: Array<() => void>;

  constructor(target = window) {
    this.keys = new Set();
    this.virtualKeys = new Set();
    this.mouse = { dx: 0, dy: 0, locked: false };
    this._target = target;
    this._handlers = [];

    this._bind(window, 'keydown', (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault(); // evita el scroll de la página
    });
    this._bind(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    this._bind(window, 'blur', () => {
      this.keys.clear();
      this.virtualKeys.clear();
    });

    this._bind(document, 'pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === this._target;
    });
    this._bind(window, 'mousemove', (e: MouseEvent) => {
      if (!this.mouse.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });

    this._setupTouchControls();
  }

  private _setupTouchControls() {
    const leftZone = document.getElementById('touch-left-zone');
    const rightZone = document.getElementById('touch-right-zone');
    const jumpBtn = document.getElementById('touch-jump-btn');
    const joyBase = document.getElementById('touch-joystick-base');
    const joyStick = document.getElementById('touch-joystick-stick');

    if (!leftZone || !rightZone || !jumpBtn || !joyBase || !joyStick) return;

    // Salto garantizado por tiempo
    const triggerJump = () => {
      this.virtualKeys.add('Space');
      // Aseguramos al menos 50ms para que el loop (a 60fps) no se lo salte nunca
      setTimeout(() => this.virtualKeys.delete('Space'), 50);
    };

    // Botón de Salto explícito
    this._bind(jumpBtn, 'touchstart', (e: TouchEvent) => {
      e.preventDefault();
      triggerJump();
    }, { passive: false });

    // Cámara (Derecha) y Salto por "Quick Tap"
    let lastCamTouch: { id: number, x: number, y: number, startX: number, startY: number, time: number } | null = null;
    this._bind(rightZone, 'touchstart', (e: TouchEvent) => {
      e.preventDefault(); // Evita scroll y gestos
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (!lastCamTouch) {
          lastCamTouch = { 
            id: t.identifier, 
            x: t.clientX, y: t.clientY, 
            startX: t.clientX, startY: t.clientY, 
            time: Date.now() 
          };
        }
      }
    }, { passive: false });
    
    this._bind(rightZone, 'touchmove', (e: TouchEvent) => {
      e.preventDefault();
      if (!lastCamTouch) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === lastCamTouch.id) {
          const dx = t.clientX - lastCamTouch.x;
          const dy = t.clientY - lastCamTouch.y;
          // Aplicamos factor de sensibilidad táctil a cámara
          this.mouse.dx += dx * 2.0; 
          this.mouse.dy += dy * 2.0;
          lastCamTouch.x = t.clientX;
          lastCamTouch.y = t.clientY;
        }
      }
    }, { passive: false });
    
    const endCam = (e: TouchEvent) => {
      if (!lastCamTouch) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lastCamTouch.id) {
          // Evaluar "Quick Tap"
          const duration = Date.now() - lastCamTouch.time;
          const dist = Math.hypot(lastCamTouch.x - lastCamTouch.startX, lastCamTouch.y - lastCamTouch.startY);
          
          if (duration < 300 && dist < 10) {
            triggerJump();
            rightZone.classList.add('tap-active');
            setTimeout(() => rightZone.classList.remove('tap-active'), 100);
          }
          
          lastCamTouch = null;
        }
      }
    };
    this._bind(rightZone, 'touchend', endCam);
    this._bind(rightZone, 'touchcancel', endCam);

    // Movimiento (Joystick Izquierdo)
    let joyId: number | null = null;
    let origin = { x: 0, y: 0 };
    const maxRadius = 40; // Pixeles de recorrido máximo del joystick

    const updateVirtualWASD = (dx: number, dy: number) => {
      this.virtualKeys.delete('KeyW');
      this.virtualKeys.delete('KeyS');
      this.virtualKeys.delete('KeyA');
      this.virtualKeys.delete('KeyD');
      const threshold = 15;
      if (dy < -threshold) this.virtualKeys.add('KeyW');
      if (dy > threshold) this.virtualKeys.add('KeyS');
      if (dx < -threshold) this.virtualKeys.add('KeyA');
      if (dx > threshold) this.virtualKeys.add('KeyD');
    };

    this._bind(leftZone, 'touchstart', (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (joyId === null) {
          const t = e.changedTouches[i];
          joyId = t.identifier;
          origin = { x: t.clientX, y: t.clientY };
          const rect = leftZone.getBoundingClientRect();
          joyBase.style.left = `${t.clientX - rect.left}px`;
          joyBase.style.top = `${t.clientY - rect.top}px`;
          joyBase.classList.remove('hidden');
          joyStick.style.transform = `translate(-50%, -50%)`;
        }
      }
    }, { passive: false });

    this._bind(leftZone, 'touchmove', (e: TouchEvent) => {
      e.preventDefault();
      if (joyId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joyId) {
          let dx = t.clientX - origin.x;
          let dy = t.clientY - origin.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
          }
          joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          updateVirtualWASD(dx, dy);
        }
      }
    }, { passive: false });

    const endJoy = (e: TouchEvent) => {
      if (joyId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyId) {
          joyId = null;
          joyBase.classList.add('hidden');
          updateVirtualWASD(0, 0); // reset
        }
      }
    };
    this._bind(leftZone, 'touchend', endJoy);
    this._bind(leftZone, 'touchcancel', endJoy);
  }

  /** ¿Está pulsada esta tecla? Acepta varios códigos (OR). */
  down(...codes: string[]) {
    return codes.some((code) => this.keys.has(code) || this.virtualKeys.has(code));
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

  _bind(el: any, type: string, fn: any, options?: any) {
    el.addEventListener(type, fn, options);
    this._handlers.push(() => el.removeEventListener(type, fn, options));
  }

  dispose() {
    for (const off of this._handlers) off();
    this._handlers.length = 0;
  }
}
