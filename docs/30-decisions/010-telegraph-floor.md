# ADR 010: A hard floor on enemy telegraphs

**Status:** Proposed
**Date:** 2026-09-08
**Spec:** 024

## Context

Before spec 024 the roster had four archetypes and one behaviour: move towards the player
at a speed set by the Ciclo number, and deal damage on contact. There was nothing to read
and therefore nothing to learn — difficulty scaled by making the same unreadable thing
faster.

Two archetypes did not work at all. The Interceptor and the Dron declared no `body`
component while their systems queried for one, so neither had ever moved in any shipped
build. The Dron's query was wrong twice over: it asked for a component named `drone` that
no prefab has ever declared.

## Decision

1. Every hostile runs the same **shape** of state machine: approach → telegraph → commit →
   recover.
2. `CONFIG.enemy.telegraphFloor` = 0.45 s. `enter()` clamps every telegraph state to at
   least this, so no code path can produce a shorter warning.
3. Every telegraph emits `enemy:telegraph` with a position, so the presentation layer can
   render the tell without knowing anything about the state machine.
4. The heaviest attack carries the longest wind-up: the Coloso telegraphs 0.75 s and lands
   for two layers; the Devorador telegraphs 0.80 s and lands for three.
5. Difficulty above the floor is expressed as **density and variety**, never as reaction
   time: more Sombras, more archetypes, shorter recoveries — never a shorter tell.

## Consequences

**Positive**

- A player who loses a layer can always point at the moment they should have moved. That
  is the difference between hard and unfair, and it is now a constant rather than a habit.
- Archetypes become distinguishable by their tells rather than by their silhouette, which
  is what makes a roster worth having.
- The floor is asserted across every archetype in `tests/enemy.test.ts`, so it cannot be
  eroded by a future tuning pass.

**Negative**

- Late Ciclos need more entities to feel dangerous, which costs frame time in an O(n²)
  contact solver. Bounded by the 30-enemy cap.
- A telegraph is only useful if it is perceived. The tell currently spends its budget on
  particles, colour and motion; an off-screen Centinela's aim is audible but not visible.
  Recorded as a follow-up in `specs/024-flow-and-feel/checklist.md`.
