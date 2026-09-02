# Plan 005: Mobile Touch Controls

## Approach

To avoid coupling touch logic into the game systems (`player.ts`, `camera.ts`), the touch events will be trapped by `src/core/input.ts`. The touch inputs will simulate keyboard (`KeyW`, `KeyA`, etc.) and mouse (`mouse.dx`) events.

## Components

1. **DOM Structure (`index.html`)**:
   - `#touch-controls`: A container hidden by default.
   - `#touch-joystick-area`: Left 50% of the screen. Captures pointer events to render a dynamic joystick (a visual knob tracking the finger).
   - `#touch-look-area`: Right 50% of the screen. Captures pointer events to move the camera.
   - `#touch-jump-btn`: A circular button in the bottom right corner.

2. **Styling (`style.css`)**:
   - Media queries (`@media (pointer: coarse)`) to show `#touch-controls`.
   - Semi-transparent glassmorphism for buttons and joystick bases so they don't block visibility.

3. **Input Core (`src/core/input.ts`)**:
   - Add `.virtualKeys` Set to store keys activated via touch.
   - Override `.down()` to check both physical `.keys` and `.virtualKeys`.
   - Bind `touchstart`, `touchmove`, `touchend` events to the UI overlays.
   - Left side: calculate delta from the initial touch point to determine which virtual keys (`W/A/S/D`) are active.
   - Right side: map delta movement to `mouse.dx` and `mouse.dy`.
   - Jump button: map `touchstart` to `Space`.

## Test Strategy
- Ensure desktop play is completely unaffected (no overlapping DOM blocking clicks).
- Verify virtual jump doesn't trigger zooming or context menus (`preventDefault()`).
