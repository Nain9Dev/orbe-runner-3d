# ADR 012: The tell must be visible, audible and off-screen

**Status:** Proposed
**Date:** 2026-09-08
**Spec:** 025

## Context

[ADR-010](010-telegraph-floor.md) established the fairness contract: no hostile action
begins with less than `CONFIG.enemy.telegraphFloor` = 0.45 s of warning, enforced in
`enter()` so no code path can shorten it, and asserted for every archetype in
`tests/enemy.test.ts`.

The contract was honoured by the simulation and broken by the presentation. A Sombra
winding up looked exactly like a Sombra standing still: same hull, same aura, same
animation. The `enemy:telegraph` event fired faithfully into a bus nobody was drawing
from. The guarantee was real, measurable, tested — and invisible.

Spec 024 recorded this honestly as follow-up **T-024.F1** rather than claiming the
contract was complete.

## Decision

A telegraph is announced through three channels, because each covers a case the others
cannot.

| Channel | Covers | Where |
| :--- | :--- | :--- |
| **Model** — charge glow, closing ground ring, aim line | The Sombra is on screen and the player is looking at it | `createHunter` in `src/game/models.ts` |
| **Sound** — a spatialised two-note cue | The player is looking somewhere else, but the Sombra is in the world | `synth.telegraph` via `src/systems/audio.ts` |
| **Compass** — a screen-edge arrow | The Sombra is behind the camera entirely | `src/ui/compass.ts` |

Supporting decisions:

- **Progress drives the tell.** The enemy system records `fsm.duration` when it enters a
  state, so the model animation, the compass urgency and the logic all read the same
  number. A lookup table of timings copied into the presentation layers would be two more
  places to forget when a duration changes.
- **The shockwave ring shows the true radius.** During a Coloso's leap or a Devorador's
  slam the ring stops being a countdown and becomes a footprint at the exact radius the
  wave will cover. The player needs to know where it is *safe*, not merely that something
  is coming.
- **The cue is on the SFX bus, not the music bus.** A player who turns the soundtrack down
  must not lose a fairness feature, which is why the settings expose music and effects
  separately.
- **At most four arrows**, most urgent first. Twenty Sombras winding up at once must not
  turn the screen into a ring of arrows.

## Consequences

**Positive**

- The fairness contract is now complete: on screen, off screen and eyes-elsewhere are all
  covered. T-024.F1 is closed.
- Archetypes become distinguishable by their tells rather than only by their silhouettes,
  which is most of what makes a roster worth having.
- The ground ring makes the heaviest attack in the game the most readable one, which is
  the right way round.

**Negative**

- Three channels for one event is three places to keep consistent. The single
  `fsm.duration` source limits the damage, but a new archetype must remember all three.
- A visible tell makes the game easier for a player who has learned to read it. That is
  the intent, and the difficulty lever remains density and variety rather than reaction
  time.

**Still open**

- The tell is not colour-blind-tested. Amber on a dark ground plus a shape change plus a
  sound is likely sufficient, but it has not been verified with a simulation. Recorded in
  `docs/11-open-questions.md`.
