# ADR 006: A domain layer for jump arc and integrity

**Status:** Proposed
**Date:** 2026-09-08
**Spec:** 024

## Context

Two pieces of arithmetic decide whether the game is fair, and both were previously
scattered through code that cannot run without a browser:

1. **How far can Lúmen jump?** The level generator needs this to know whether a gap is
   crossable. It was implicit: platforms were placed by drifting a cursor with
   `range(8, 12)` steps and nothing checked the result. Gaps were sometimes impossible.
2. **What happens to health when something hits it?** Three lines of subtraction spread
   across `game.ts`, entangled with respawn, camera shake and the game-over menu.

Both are pure functions of a handful of numbers. Neither needs Three.js, the ECS, a canvas
or a frame loop — but both were only reachable through all four.

## Decision

Introduce `src/domain/`, which **imports nothing**:

- `jump-arc.ts` — apex height, rise time, fall time, `maxJumpDistance(dh)`, `isReachable`,
  `clampGap`, `maxStepUp`, derived from `{ gravity, jump, speed, fallMultiplier }`.
- `integrity.ts` — `applyDamage`, `repair`, `extend`, `ratio`, `isCritical`, `describe`
  over an immutable `{ current, max, shield }`.

The level composer sizes every gap through `jump-arc`. The game rules apply every hit
through `integrity`.

## Consequences

**Positive**

- The reachability guarantee becomes a testable invariant rather than a hope. Thirty
  Ciclos of level design are verified in milliseconds with no renderer.
- Re-tuning gravity or the jump impulse automatically re-sizes every gap in the game. A
  hard-coded "max gap = 10" would have silently broken.
- The arc model is deliberately conservative — it ignores apex hang time and air
  acceleration, so it under-reports the real reach by about 12 %. Anything built on it is
  safe by construction.
- Integrity rules (a shield absorbs a whole hit, clamping, the criticality threshold) are
  covered by pure tests, and the interface can duplicate the wording of `describe()`
  without importing the domain.

**Negative**

- One more layer to keep honest. If `CONFIG.player.speed` ever stops matching the real
  steady-state speed again, the model lies and every gap inherits the error. Spec 024
  found exactly that bug; `docs/22-game-design.md` §2.1 now records both the model and the
  measurement side by side so the drift stays visible.
