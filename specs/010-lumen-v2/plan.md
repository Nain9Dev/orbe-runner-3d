# Plan: Lúmen v2 Redesign

## Architecture Changes
No architecture changes. We will modify `src/game/models.ts`.

## Implementation Strategy
1. **Visor:** In `createOrbi()`, replace the two white spherical eyes and smiling mouths with a single curved `CylinderGeometry` (dark visor).
2. **LED Eyes:** The pupils (`lookX`, `lookY`) will move along the surface of the visor.
3. **Ears/Fins:** Add two `ConeGeometry` or flattened `SphereGeometry` items to the sides of the head. Add physics (spring mathematics) to them in `update(dt)` so they react to `speed`, `jump` (squash), and `bank` (turning).
4. **Hands:** Add two small emissive spheres on the sides. Animate their Y positions based on `cheer` (up in the air) and `jump` (downward drag).

## Verification
- Load the game via `npm run dev`.
- Ensure Lúmen looks better, the animations work, and FPS remains at 60.
