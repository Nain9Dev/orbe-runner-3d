# Tasks 025 — Resonancia

Ordered by dependency. Test first, one task at a time.

## Phase 0 — Aural layer foundations (no Web Audio in the tests)

- [x] **T-025.01** `[A]` `src/audio/clock.ts`: musical time from an injected source.
  - **Covers**: REQ-025.11, REQ-025.12
  - **Done when**: `tests/clock.test.ts` proves bars, beats, phase, pulse decay, tempo
    changes that do not skip a beat, and resynchronisation after a 60 s gap.

- [x] **T-025.02** `[A]` `src/audio/score.ts`: intensity model, layer gates with
      hysteresis, per-tier keys, patterns.
  - **Covers**: REQ-025.06 … REQ-025.10
  - **Done when**: `tests/score.test.ts` proves no single input saturates the mix, one
    layer of Núcleo overrides everything, and the tempo stays inside ±8 %.

- [x] **T-025.03** `[A]` `src/audio/engine.ts`: bus graph, generated reverb impulse,
      delay, limiter, scheduled sidechain, spatial destinations, listener.
  - **Covers**: REQ-025.01, REQ-025.03, REQ-025.05, REQ-025.18
  - **Done when**: a blocked or missing `AudioContext` leaves the game running and silent.

- [x] **T-025.04** `[A]` `src/audio/synth.ts`: voices from oscillators and one shared
      noise buffer.
  - **Covers**: REQ-025.02
  - **Done when**: percussion uses the noise buffer; every voice takes an explicit time
    and an explicit destination.

## Phase 1 — Binding

- [x] **T-025.05** `[A]` Rewrite `src/systems/audio.ts` as a binder: lookahead scheduler,
      intensity, listener, `world.state.beat`.
  - **Covers**: REQ-025.11, REQ-025.12, REQ-025.17
  - **Done when**: `world.state.beat.bar` advances at the configured tempo, live or silent.

- [x] **T-025.06** `[A]` `body.impactSpeed` in physics; landing volume scales with it.
  - **Covers**: REQ-025.15
  - **Done when**: `tests/physics.test.ts` proves a tall drop records more than a short
    one and that the value clears once airborne.

- [x] **T-025.07** `[A]` Footsteps by distance travelled.
  - **Covers**: REQ-025.16
  - **Done when**: stride cadence follows speed with no rate constant to tune.

- [x] **T-025.08** `[A]` Music and SFX volume settings, persisted.
  - **Covers**: REQ-025.04
  - **Done when**: the two sliders emit `audio:settings` and survive a reload.

## Phase 2 — Models

- [x] **T-025.09** `[A]` Avatar state carries `beat`, `fsm` and `stunned`; the enemy
      system records `fsm.duration` so telegraph progress has one source.
  - **Covers**: REQ-025.13, REQ-025.19
  - **Done when**: no lookup table of timings exists outside `enemy.ts`.

- [x] **T-025.10** `[A]` Visible tells: charge glow, closing ground ring, aim line.
  - **Covers**: REQ-025.20, REQ-025.22
  - **Done when**: a screenshot taken mid-telegraph shows a tell on every archetype.

- [x] **T-025.11** `[A]` Shockwave footprint at the true radius during a leap or slam.
  - **Covers**: REQ-025.21
  - **Done when**: the ring radius equals the radius the shockwave will use.

- [x] **T-025.12** `[A]` Lúmen's motion trail and dash after-images; beat-driven pulse on
      core, halo and lamp.
  - **Covers**: REQ-025.13, REQ-025.23
  - **Done when**: ghosts live in world space and are adopted and released by the renderer.

- [x] **T-025.13** `[A]` Beat-reactive bloom, bounded.
  - **Covers**: REQ-025.14
  - **Done when**: the pulse is a fraction added to a fixed base, never a multiplier.

## Phase 3 — Interface

- [x] **T-025.14** `[A]` `src/ui/compass.ts`: off-screen telegraph arrows and damage
      direction. **Closes the spec-024 follow-up T-024.F1.**
  - **Covers**: REQ-025.25, REQ-025.26
  - **Done when**: at most four arrows show, most urgent first, and a damage bearing is
    styled distinctly.

- [x] **T-025.15** `[A]` Ciclo intro card and end-of-run summary.
  - **Covers**: REQ-025.27, REQ-025.28
  - **Done when**: the summary replaces the hint line and hides for ordinary messages.

## Phase 4 — Documentation

- [x] **T-025.16** `[A]` ADR-011 and ADR-012; update lore, game design, interface,
      architecture, data model, requirements, traceability, changelog, runbook.
  - **Covers**: the spec's acceptance criterion 4
  - **Done when**: every REQ-025.* appears in `docs/50-traceability.md`.

## Defects found and fixed along the way

Recorded because they were not in the plan and two of them were shipping.

| Defect | Where | Consequence |
| :--- | :--- | :--- |
| `Number('')` is `0`, so an empty volume store read as silence | `src/ui/menu.ts` | **Every first-time player would have started the game muted.** |
| `background` shorthand resets `background-clip` | `src/style.css` | The game-over and level-cleared titles rendered as a solid coloured rectangle instead of text, on every run. |

## Session handoff

| Field | State |
| :--- | :--- |
| **Done** | T-025.01 … T-025.16. |
| **Verified** | `npm test` → 11 files, 200 tests, all passing. `npm run build` clean. Browser pass: beat advancing live at 131 BPM, tells visible on all four archetypes, compass arrows correct for off-screen Sombras, run summary and Ciclo card correct. |
| **Next** | Owner review; ADR-011 and ADR-012 are `Proposed`. |
| **Blocked** | Nothing. No dependency added. |
