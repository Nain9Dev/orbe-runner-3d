# ADR 003: Entity Component System (ECS) Architecture

**Status:** Approved
**Date:** 2026-09-02

## Context
In a 3D game with physics, rendering, player input, and enemy AI, putting all logic inside a monolithic `Game` class or coupling state directly to Three.js meshes leads to spaghetti code and poor performance. We need a way to cleanly separate data (state) from behavior (logic), making it easy to add new features without breaking existing ones.

## Decision
We implemented a strict Entity Component System (ECS) architecture.
- **Entities:** Simple IDs (or JS objects serving as bags of components).
- **Components:** Pure data objects (`transform`, `body`, `player`, `enemy`, `render`).
- **Systems:** Pure logic functions that iterate over specific components every frame (e.g., `physicsSystem`, `renderSystem`, `enemySystem`).

## Consequences
- **Positive:** High performance and cache locality (conceptually). Decoupled logic: the `renderSystem` doesn't care about health, and the `physicsSystem` doesn't care about meshes. Adding new behaviors (like a `hazard` component) is trivial and doesn't require modifying class hierarchies.
- **Negative:** ECS can be verbose. Logic is spread across multiple system files, meaning tracing a single feature (e.g., "jumping") might require looking at `inputSystem`, `playerSystem`, and `physicsSystem`.
