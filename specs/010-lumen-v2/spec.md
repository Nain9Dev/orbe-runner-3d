# Spec 010: Lúmen v2 Redesign

## Requirements
- **REQ-010:** The 3D model of Lúmen shall be upgraded to a more charismatic, mecha-inspired design using only procedural Three.js geometry.
- **REQ-011:** Lúmen shall have a cybernetic visor instead of fixed spherical eyes.
- **REQ-012:** Lúmen shall have floating energy hands (spheres) that animate according to movement and state (cheering, jumping).
- **REQ-013:** Lúmen shall have aerodynamic ears/fins that react to speed and jump states.
- **REQ-014:** The procedural geometries must not impact the 60 FPS performance target.

## Acceptance Criteria
- Lúmen's face features a visor where the LED eyes move.
- Hands and ears bounce dynamically in the `update(dt)` loop.
- Zero external assets are loaded.
