# Orbe Runner 3D - Architecture & SDD (Specification Driven Development)

## 1. Overview
Orbe Runner 3D uses a custom, lightweight Entity-Component-System (ECS) built over Three.js. It prioritizes procedural generation, minimal bundle sizes (no external image/model assets), and strict rendering rules.

## 2. ECS Core
- **World (`world.ts`)**: Maintains entities, components, and the event bus.
- **Engine (`engine.ts`)**: Handles the core requestAnimationFrame loop.
- **Systems**: Isolated logic blocks executed every frame in a fixed order (defined in `main.ts`).
  - `renderSystem`: Updates camera and scene graphics.
  - `physicsSystem`: Handles velocity, gravity, friction, and collision resolution (Sphere-Box, Sphere-Sphere).
  - `enemySystem`: Manages AI states for Hunters, Interceptors, and Drones.
  - `gameSystem`: Evaluates win/loss conditions and orb collection.

## 3. Rendering & Anti-Bloom Safeguards
The game uses `UnrealBloomPass` combined with `ACESFilmicToneMapping` for HDR glow.
- **Rule 1**: The bloom threshold is strictly `1.0`.
- **Rule 2**: Solid procedural meshes (like platforms, powerups, or character bodies) MUST NOT have an `emissiveIntensity` greater than `1.0`. Exceeding this causes massive bloom blowout bugs.
- **Rule 3**: `SpriteMaterial` with `AdditiveBlending` is permitted to exceed 1.0 cumulatively but must have a base `opacity` < `0.3` to prevent additive blowouts when multiple sprites overlap.

## 4. Procedural Textures
To maintain zero external assets while improving visual fidelity, the game generates a Canvas-based noise texture (`getNoiseTexture()` in `prefabs.ts`). This is used as a `bumpMap` and `roughnessMap` on `MeshStandardMaterial` for surfaces like `ground`, `platform`, and `wall`, yielding a brushed/cyberpunk aesthetic.

## 5. Level Generation (Set Pieces)
The level generator (`level.ts`) constructs arenas using "chunks" or "set pieces" rather than pure randomness:
- **Bridges**: Sequential straight lines of platforms.
- **Spiral Stairs**: Ascending corner blocks.
- **Moving Obstacles**: Platforms that oscillate along an axis using the `movingPlatform` component and physics integration.
- **Failsafe**: A critical path is always guaranteed by clamping gap distances.

## 6. Entities & AI
- **Hunter**: Follows the player with simple steering.
- **Interceptor**: Locks onto the player, pauses to aim, and executes a high-speed dash.
- **Drone (Ally)**: Orbits the player and repels nearby enemies using a localized burst particle effect and physics impulse.
