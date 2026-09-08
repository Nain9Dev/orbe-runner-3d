# ADR 011: A shared musical clock

**Status:** Proposed
**Date:** 2026-09-08
**Spec:** 025

## Context

Before spec 025 the soundtrack and the game ran on separate clocks and shared nothing.
The score was a fixed 140 BPM sequencer whose only inputs were the Ciclo number and the
combo counter; the models animated from their own accumulated `t`. Nothing in the world
happened *with* the music, so the result read as a demo with a soundtrack playing over it
rather than as one object.

The obvious fix — have each system watch the audio for a beat event — does not work.
Systems that keep their own timers drift apart, and a beat delivered as an event arrives
on whichever frame the listener happens to run, which is exactly the jitter that makes
synchronised visuals look broken rather than tight.

## Decision

The audio layer owns musical time and publishes it. `src/audio/clock.ts` produces a
`Beat`:

```ts
{ bar, beat, sixteenth, phase, pulse, downbeat, bpm, intensity, live }
```

`src/systems/audio.ts` writes it to `world.state.beat` once per step. The avatar system
passes it into every model; the renderer reads it for bloom; the interface may read it
too. One value, one phase, no drift by construction.

Three properties are load-bearing:

1. **The clock takes an injected time source.** `AudioContext.currentTime` when there is
   an audio context, an accumulated fallback when there is not. A muted, blocked or
   audio-less browser still has a pulsing world (REQ-025.12), and the whole module is
   testable without Web Audio.
2. **`pulse`, not `phase`, is what visuals consume.** `phase` is a sawtooth and reads as a
   stutter; `pulse` is 1 at the onset decaying to 0, which reads as a heartbeat.
3. **A gap is absorbed, not replayed.** Musical position is recomputed from the source
   rather than accumulated, so returning to a hidden tab resynchronises to the grid
   instead of firing a burst of skipped beats.

## Consequences

**Positive**

- "The world pulses with the music" becomes a contract rather than a coincidence, and it
  is asserted in `tests/clock.test.ts` with no audio hardware involved.
- Any future consumer — a shader, a UI element, a gameplay mechanic on the beat — gets
  synchronisation for free by reading one value.
- Tempo can move with intensity without anything else needing to know, because the clock
  rebases its origin on a tempo change so no beat is skipped or repeated.

**Negative**

- One more key on `world.state`, which is already the widest interface in the project.
- Visual pulsing is a taste that can be overdone. Mitigated by making every consumer add
  a bounded fraction to a fixed base rather than multiplying, so the worst case is a known
  constant. Bloom in particular is capped, because it is the one effect that can hide a
  platform edge.

**Rejected alternatives**

- *A `beat` event on the bus.* Delivery lands on an arbitrary frame, and a listener that
  misses one has no way to recover its phase.
- *Reading `AudioContext.currentTime` wherever it is needed.* Couples every consumer to
  Web Audio, and breaks entirely when there is no context.
