# ADR 002: Procedural Geometry over External Assets

**Status:** Approved
**Date:** 2026-09-02

## Context
A modern 3D game typically relies on external assets (`.gltf`, `.glb`, `.obj`, `.png` textures) designed in software like Blender. While these provide high fidelity, they require network requests, introduce parsing overhead, and increase the project's payload size, delaying the Time-to-Interactive (TTI).

## Decision
All 3D models (Lúmen, Sombras, Fragmentos, Plataformas) and textures (Glow effects) are generated procedurally at runtime using primitive Three.js geometries (`BoxGeometry`, `IcosahedronGeometry`, `TorusGeometry`, etc.) and Canvas APIs (`createRadialGradient`). 

## Consequences
- **Positive:** The game starts instantly. There is no `loading screen` because there are 0 assets to fetch. The entire game logic and graphics are contained within the JS bundle. It is highly optimized for mobile browsers and offline caching.
- **Negative:** Visual fidelity is limited to primitive shapes. Achieving "charismatic" and detailed characters requires complex mathematical composition of grouped primitives and precise `update(dt)` animation logic to give them life.
