# Orbe Runner 3D

## Vision

A high-performance, 1-click endless runner 3D game playable directly in the browser. It prioritizes zero-latency execution, raw WebGL performance via Three.js, and immediate accessibility without requiring downloads, backend servers, or complex setups.

## Goals

1. **Pure Fun & Engagement**: The game must be genuinely fun, engaging, and addictive. Gameplay feel (squash & stretch, particles, physics) comes first.
2. **Zero Bug Tolerance**: We maintain a 100% bug-free mindset. Any bug that blocks gameplay or breaks the UI is a critical priority and must be fixed before any new features are merged.
3. **Zero Latency Access**: Must run statically via GitHub Pages (`https://orbe.naindev.com/`) with instant load times.
4. **Mobile & Cross-Device Playability**: The game must be fully playable in mobile browsers using touch controls and responsive UI, maintaining the 1-click accessibility everywhere.
5. **Raw WebGL Performance**: Achieve stable 60 FPS using raw Three.js primitives without the overhead of heavy game engines.
6. **Spec Driven Development**: Maintain strict documentation and spec-driven iterations for any new features or architectural changes.
7. **Narrative Identity**: Establish a cohesive lore (Lúmen vs Sombras) to provide personality and player motivation without adding overhead. See [Lore](file:///D:/Development/Personal-Projects/orbe-runner-3d/docs/20-lore.md).

## Non-Goals

1. **Backend Integration**: We will NOT introduce Python, Node.js, or any server-side rendering/logic that adds network latency or requires active hosting.
2. **Heavy Engines**: We will NOT migrate to Unity or Unreal Engine WebGL exports, which bloat the initial load time.
3. **Multiplayer**: This is a single-player deterministic experience.

## Target Audience

Players looking for a quick, accessible, and smooth 3D arcade experience directly in their web browsers.
