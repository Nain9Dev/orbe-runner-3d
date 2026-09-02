# Plan 007: Lore & Jump Fix

## Architectural Changes

1. **Narrative Documentation (`docs/20-lore.md`, `docs/00-charter.md`)**
   - Create the Lore file with the "Lúmen vs Sombras" concept.
   - Update the Charter to link to the Lore.

2. **UI Immersion (`index.html`, `src/systems/hud.ts`)**
   - Update HTML overlay text from generic "Orbe Runner" to narrative text.
   - Update `hud.ts` to render "Fragmentos" and "Lúmen".

3. **Coyote Time Physics (`src/systems/player.ts`)**
   - Add a timer/counter `coyoteFrames` that defaults to 0.
   - When `body.grounded` is true, set `coyoteFrames = 5` (approx 80ms).
   - When `body.grounded` becomes false, decrement `coyoteFrames`.
   - Allow jump if `body.grounded || coyoteFrames > 0`.
   - This fixes the frustration of missing a jump right at the edge of a platform.
