# Spec 025 — Resonancia

| Field | Value |
| :--- | :--- |
| Status | Implemented |
| Extends | Spec 024 (Flow & Feel) |
| Owner approval | Pending |

## 1. Motivation

Spec 024 made the game fair. This one makes it *legible and alive*, and it closes the
follow-up 024 explicitly deferred (T-024.F1).

Three gaps, and they turn out to be the same gap seen from three angles.

1. **The enemies telegraph in the logic but not on screen.** `CONFIG.enemy.telegraphFloor`
   guarantees 0.45 s of warning before anything that can hurt Lúmen, and
   `enemy:telegraph` is emitted faithfully — but the model that is about to attack looks
   exactly like the model that is not. The fairness contract from ADR-010 is honoured by
   the simulation and broken by the presentation. A warning nobody can see is not a
   warning.

2. **The music does not know a game is being played.** The score is a fixed 140 BPM
   sequencer whose only inputs are the Ciclo number and the combo. It does not know how
   fast Lúmen is moving, whether something is about to hit it, how close a Sombra is, or
   that its Núcleo is down to one layer. Every sound is centred: a Centinela firing from
   the left and one firing from behind sound identical.

3. **The models and the music ignore each other.** They run on separate clocks and share
   nothing, so the game looks like a demo with a soundtrack playing over it rather than
   one object.

The unifying idea of this spec is a **shared musical clock**. The audio layer publishes a
beat; the models, the environment and the interface read it. From that one contract, the
game starts behaving like a single instrument.

## 2. Functional requirements (EARS)

### 2.1 Audio architecture

- **REQ-025.01** — The audio layer shall present a bus graph with separate music, SFX and
  UI paths, a shared reverb send, a delay send, and a master limiter.
- **REQ-025.02** — Percussion shall be synthesised from a noise buffer, not from a square
  oscillator.
- **REQ-025.03** — When a kick is scheduled, the system shall duck the music bus and
  recover over the following beat (sidechain compression).
- **REQ-025.04** — The system shall expose independent music and SFX volume settings, and
  shall persist them.
- **REQ-025.05** — If the Web Audio API is unavailable or blocked, the game shall run
  unchanged and silent; no audio failure may interrupt the simulation.

### 2.2 Adaptive score

- **REQ-025.06** — The score shall be organised in layers, each gated by a threshold on a
  continuous `intensity` value in 0..1.
- **REQ-025.07** — `intensity` shall be derived from Resonancia, the distance to the
  nearest Sombra, and remaining Núcleo, and shall move smoothly rather than stepping.
- **REQ-025.08** — While Lúmen holds one layer of Núcleo, the score shall shift to its
  tension voicing regardless of the other inputs.
- **REQ-025.09** — Each palette tier shall use its own key and mode, so a change of Ciclo
  band is audible as well as visible.
- **REQ-025.10** — Tempo shall scale modestly with intensity, within `±8 %` of the base,
  so the pulse tightens without the track falling apart.

### 2.3 The beat clock — music ↔ everything

- **REQ-025.11** — The audio layer shall publish `world.state.beat` containing `bar`,
  `beat`, `sixteenth`, `phase` (0..1 within the beat), `pulse` (1 at the onset, decaying),
  `bpm` and `intensity`.
- **REQ-025.12** — The beat clock shall keep running when audio is muted, unavailable or
  not yet started, so that visuals never freeze on a silent machine.
- **REQ-025.13** — The avatar layer shall pass the beat to every model, and models may use
  it to pulse.
- **REQ-025.14** — The environment (bloom strength, grid emission) shall react to the
  beat, bounded so that it never obscures gameplay.

### 2.4 Physics ↔ audio

- **REQ-025.15** — When a body lands, the physics system shall record the impact speed on
  `body.impactSpeed`, and the audio layer shall scale the landing sound by it.
- **REQ-025.16** — While Lúmen is grounded and moving, the system shall emit footsteps at
  a rate proportional to its speed.
- **REQ-025.17** — The music bus low-pass shall open with Lúmen's speed, so moving fast
  literally sounds brighter.
- **REQ-025.18** — Sounds belonging to a world position (Sombra telegraphs, projectiles,
  shockwaves, Fragmentos, Balizas) shall be spatialised, and the listener shall follow the
  camera.

### 2.5 Models — the tell must be visible

- **REQ-025.19** — The avatar state shall carry the entity's FSM state and a normalised
  telegraph progress.
- **REQ-025.20** — While an archetype is telegraphing, its model shall render a visible
  tell that grows with the telegraph progress.
- **REQ-025.21** — Before a Coloso or a Devorador lands a shockwave, the system shall
  project a ground ring showing the exact radius that will be affected.
- **REQ-025.22** — The Centinela shall render an aim line towards its target while
  locking on, fading in over the telegraph.
- **REQ-025.23** — Lúmen shall leave a motion trail whose length scales with speed, and
  after-images while an Impulso is active.
- ~~**REQ-025.24** — When a Fragmento is collected, its model shall implode rather than
  simply disappearing.~~
  **Dropped during implementation.** The existing collection effect already bursts
  particles and spawns a tier-coloured flash; an implosion on top read as noise in the
  browser pass. Removed from `docs/10-requirements.md` rather than left claiming to be
  done — see `checklist.md` §6.

### 2.6 Interface

- **REQ-025.25** — When a Sombra telegraphs from outside the view, the HUD shall show a
  screen-edge indicator pointing at it for the duration of the telegraph.
  *(Closes follow-up T-024.F1.)*
- **REQ-025.26** — When Lúmen takes damage from a source with a position, the HUD shall
  show a directional damage indicator.
- **REQ-025.27** — When a run ends, the overlay shall present a summary: Ciclo reached,
  Luz, best Resonancia and Sombras shattered.
- **REQ-025.28** — When a Ciclo starts, the HUD shall present a brief intro card naming
  the Ciclo.

## 3. Edge cases

| # | Case | Expected |
| :--- | :--- | :--- |
| E-01 | `AudioContext` construction throws (autoplay policy, embed) | The game runs silent; the beat clock falls back to the engine clock. |
| E-02 | The tab is hidden and `currentTime` jumps on return | The clock resynchronises to the audio grid rather than replaying skipped beats. |
| E-03 | Twenty Sombras telegraph in the same frame | The off-screen indicator shows at most four, nearest first. |
| E-04 | Several shockwaves are pending at once | Solved by construction rather than by pooling: the ring belongs to the Sombra's own model, so there is exactly one per Sombra and none to recycle. |
| E-05 | Music muted mid-beat | Scheduling stops, the clock keeps running, visuals keep pulsing. |
| E-06 | Reduced-motion preference | The clock attenuates `pulse` to 30 % at the source, so every consumer inherits it. Attenuated and not removed: at zero the world looks broken rather than calm. |

## 4. Out of scope

- Loading any external audio or model asset. Everything stays procedural.
- Replacing Three.js or the renderer.
- Voice, narration, or licensed music.
- A full mixing console in the settings: two sliders, not twelve.

## 5. Acceptance criteria

1. `npm test` passes, with the beat clock, the intensity model and the audio settings
   covered by unit tests that need no Web Audio.
2. Every archetype's telegraph is visible in a screenshot taken during the telegraph.
3. `world.state.beat.bar` advances at the configured tempo with audio disabled.
4. Every new user-facing string appears in the lore glossary.

## 6. Session handoff

| Field | State |
| :--- | :--- |
| Done | T-025.01 … T-025.16. REQ-025.24 dropped, see above. |
| Verified | `npm test` → 11 files, 200 tests. `npm run build` clean. Browser pass: beat live at 131 BPM across bars, tells visible on all four archetypes, compass correct for off-screen Sombras, run summary and Ciclo card correct, no JS errors. |
| Amended in flight | REQ-025.24 dropped. Two shipping defects found and fixed that were not in the plan — see `checklist.md` §4. |
| Next | Owner review; ADR-011 and ADR-012 are `Proposed`. Colour-blindness check on the tells is `[H]` (OQ-007). |
| Blocked | Nothing. No dependency added. |
