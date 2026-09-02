# ADR 001: Vanilla UI over Frameworks

**Status:** Approved
**Date:** 2026-09-02

## Context
Orbe Runner 3D is a browser game where latency and load time are the most critical factors. The presentation layer needs an overlay for Menus, HUD (health, score, level), and settings. Typical web development introduces frameworks like React, Vue, or Angular to manage this UI state.

## Decision
We decided to build the UI exclusively using Vanilla HTML, CSS, and JavaScript. The DOM is manipulated directly via the `hud.ts` system without virtual DOM overhead. We use custom CSS variables and glassmorphism styling to achieve a modern look without importing external libraries (e.g., Tailwind, Bootstrap, Material UI).

## Consequences
- **Positive:** Zero latency rendering. The game bundle remains under 200KB (gzipped). The HTML structure is extremely minimal and directly tied to the ECS (Entity Component System) events (`ui:message`, `ui:hide`).
- **Negative:** UI state synchronization is imperative. Adding new complex menus requires manual DOM querying and event listener management, which can become brittle if not contained strictly within `hud.ts`.
