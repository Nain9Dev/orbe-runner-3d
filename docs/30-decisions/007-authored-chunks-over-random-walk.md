# ADR 007: Authored chunks composed by a seeded sequencer

**Status:** Proposed
**Date:** 2026-09-08
**Spec:** 024

## Context

`buildLevel` generated a Ciclo by drifting a cursor: `lastPos.z -= range(8, 12)`,
`lastPos.y += range(-1, 2)`, `lastPos.x += range(-6, 6)`, with a coin flip between three
patterns. Three consequences:

- **No reachability guarantee.** Nothing checked that a gap was jumpable.
- **No rhythm.** Difficulty was noise. Two collapsing walkways could follow each other, or
  twenty platforms could pass with nothing happening.
- **No legible ideas.** Nothing in a stretch of level said anything, so the player could
  not learn a pattern — there were none to learn.

## Considered

1. **Keep the random walk, tighten the ranges.** Cheapest. Still cannot guarantee
   reachability, still has no rhythm; it only narrows the range of failures.
2. **Hand-build every Ciclo as JSON.** Best quality per Ciclo, and it kills the infinite
   progression pillar in `docs/00-charter.md`.
3. **Authored chunks composed by a seeded sequencer.** Chosen.

## Decision

- `src/game/chunks.ts` holds eleven authored pieces, each
  `{ id, name, intensity, minLevel, build(ctx) }`, each expressing one legible idea, each
  sizing its own gaps through `src/domain/jump-arc.ts`.
- `src/game/composer.ts` sequences them into a **blueprint** — plain data, no entities —
  weighting by Ciclo, forbidding an immediate repeat, and forcing a rest chunk after two
  tension chunks.
- `src/game/level.ts` turns the blueprint into entities and does nothing else.

A chunk is treated as a **rigid body**: its internal geometry is already safe, so the only
thing that can be wrong is the junction with the previous chunk, and that is fixed by
sliding the whole chunk along the junction.

## Consequences

**Positive**

- Reachability and rhythm become properties asserted over thirty seeds in
  `tests/level.test.ts`.
- Every stretch of level says something, and the vocabulary is named — so it can be
  referenced in the Registro, in a toast, and in a bug report.
- Adding content is adding one entry to an array.

**Negative**

- More upfront work per idea than a `random()` call.
- The library can look repetitive at low Ciclos where few chunks are eligible. Mitigated
  by lowering `minLevel` on the safe chunks; Ciclo 1 now draws from four rather than two.

**Learned the hard way**

- Correcting a route *after* assembly cascades: shortening a hop pulls its landing node
  back, which lengthens the next hop. The first implementation did this and never
  converged over four passes. Correcting per chunk, before anything is spawned, does.
- Path nodes on a continuous surface must be flagged `walk` and excluded from the guard,
  or the width of a 16-unit plaza is measured as an impossible gap.
