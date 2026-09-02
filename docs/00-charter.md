# Orbe Runner 3D

## Vision

A high-performance, 1-click endless runner 3D game playable directly in the browser. It prioritizes zero-latency execution, raw WebGL performance via Three.js, and immediate accessibility without requiring downloads, backend servers, or complex setups.

## Goals

1. **Zero Latency Access**: Must run statically via GitHub Pages (`orbe.naindev.com`) with instant load times.
2. **Raw WebGL Performance**: Achieve stable 60 FPS using raw Three.js primitives without the overhead of heavy game engines.
3. **Spec Driven Development**: Maintain strict documentation and spec-driven iterations for any new features or architectural changes.
4. **Static Modernization**: Migrate from Vanilla JS to TypeScript + Vite without compromising the static nature of the deployment.

## Non-Goals

1. **Backend Integration**: We will NOT introduce Python, Node.js, or any server-side rendering/logic that adds network latency or requires active hosting.
2. **Heavy Engines**: We will NOT migrate to Unity or Unreal Engine WebGL exports, which bloat the initial load time.
3. **Multiplayer**: This is a single-player deterministic experience.

## Target Audience

Players looking for a quick, accessible, and smooth 3D arcade experience directly in their web browsers.
