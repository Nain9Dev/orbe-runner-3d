# Plan 006: Mobile UX Polish & Jump Fix

## Architectural Changes

1. **Fixing Event Binding (`src/core/input.ts`)**
   The custom `_bind(el, type, fn)` method does not accept the `options` parameter (like `{ passive: false }`). I will change its signature to `_bind(el, type, fn, options = false)` and pass it down to `addEventListener`.

2. **Quick Tap for Jump (`src/core/input.ts`)**
   - Record `touchstartTime` and initial touch coordinates in the right zone.
   - On `touchend`, if `time < 300ms` and `delta < 10px`, force the `Space` virtual key.
   - To guarantee the jump isn't missed by the game loop due to micro-taps, if a tap occurs, we can force `.virtualKeys.add('Space')` and set a timeout (e.g. 50ms) to clear it, guaranteeing it lasts at least 2-3 frames.

3. **UX Polish (`index.html` & `style.css`)**
   - Replace the word "SALTO" with an SVG/Emoji arrow (⬆️).
   - Increase `#touch-jump-btn` dimensions to 90x90px or 100x100px.
   - Add `.tap-active` class logic to show immediate visual feedback when the right zone is tapped.
