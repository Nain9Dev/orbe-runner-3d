# Changelog

Relevant changes, newest first. Format: `## [version] - YYYY-MM-DD` with Added / Changed /
Fixed / Removed sections.

## [Unreleased] — Spec 025, *Resonancia*

### Fixed

- **A first-time player started the game muted.** `Number('')` is `0`, which is finite and
  inside the valid range, so reading an empty volume store returned silence rather than
  the default.
- **Every game-over title rendered as a solid coloured rectangle.** The `background`
  shorthand on `.title-death` and `.title-victory` reset `background-clip` to `border-box`,
  undoing the `background-clip: text` that makes a gradient title into text.

### Added

- **A shared musical clock.** `world.state.beat` is published by the audio layer and read
  by the models, the environment and the interface, so the world pulses with the music by
  construction instead of by coincidence. It runs on an injected time source, so a muted
  or blocked browser still pulses. See ADR-011.
- **The aural layer** (`src/audio/`): bus graph with separate music, SFX and UI paths, a
  generated convolution reverb, a delay send, a master limiter, and a sidechain duck
  scheduled with every kick. Contract in [`24-audio.md`](24-audio.md).
- **An adaptive score.** Layers gated on a smoothed intensity derived from Resonancia,
  the distance to the nearest Sombra and remaining Núcleo. One layer of Núcleo overrides
  everything. Each palette band has its own key, mode and tempo.
- **Percussion from a noise buffer** rather than a square oscillator.
- **Spatial audio**: telegraphs, bolts, shockwaves, Fragmentos and Balizas are positioned,
  and the listener follows the camera.
- **Physics-driven sound**: `body.impactSpeed` scales the landing, footsteps follow
  distance travelled rather than a timer, and the music low-pass opens with speed.
- **The telegraph is now visible** — charge glow, a ground ring that closes as the attack
  approaches, and an aim line for the archetypes that shoot. Before this, the 0.45 s
  fairness guarantee existed only in the simulation. See ADR-012.
- **A shockwave footprint** at the exact radius, drawn while a Coloso or Devorador is in
  the air, so the player can see where it is safe.
- **A screen-edge compass** for Sombras winding up behind the camera and for the direction
  damage came from. Closes the spec-024 follow-up T-024.F1.
- **A motion trail** for Lúmen, denser during an Impulso.
- A Ciclo intro card, an end-of-run summary, and separate music and effects volume.
- 55 new tests (145 → 200), including the musical clock and the intensity model.

### Changed

- `src/systems/audio.ts` is now a binder; all Web Audio lives in `src/audio/`.
- Bloom strength and enemy auras breathe with the beat, bounded so they never obscure a
  platform edge.

---

## [Unreleased] — Spec 024, *Flow & Feel*

### Fixed

Seven of these had never worked in any shipped build.

- **The HUD threw a `TypeError` on every frame.** `hudSystem.render()` dereferenced
  `el.total`, an element that does not exist in the markup. The exception aborted every
  HUD update after the score — the Ciclo counter, the FPS readout, the Resonancia, the
  Ventaja timer and **the entire health bar** — and killed the render phase of every
  system registered after it.
- **The escort Dron never moved.** Its prefab declared no `body`, and its system queried
  for a component named `drone` that no prefab has ever declared. Two independent reasons
  for the query to match nothing.
- **The Interceptor never moved.** Same missing `body`.
- **The Imán Ventaja never attracted anything.** `world.query('orb', …)` looked for a
  component named `orb`; Fragmentos carry `pickup`.
- **The damage vignette never played.** The markup and CSS existed; nothing ever toggled
  the class.
- **A missing brace in `style.css`** swallowed the `:active` state of the touch buttons
  and everything after it.
- **Collapsing platforms made a Ciclo unwinnable.** The Sendero Efímero destroyed its
  tiles permanently, and the Baliza covering it sits *before* it — so crossing the
  gauntlet, missing the next jump and respawning left the player with no route forward
  and no way out except dying on purpose. Tiles now reform 2.5 s after collapsing. A
  scripted route follower went from 55 consecutive falls on Ciclo 3 to two.
- Moving platforms displaced the player once per solver iteration — three times per frame
  — so they flung whatever was standing on them.
- `CONFIG.player.speed` was off by 20 %: the controller added a fixed impulse and the
  integrator damped it back, settling at 11.2 u/s for a configured 14. Every distance
  derived from it inherited the error.
- Coyote time was counted in frames, making the game measurably easier at 30 FPS than at
  60.
- The camera hard-coded a 75° field of view and ignored `CONFIG.camera.fov`.
- Plasma pools used a circular hazard around a rectangular pool, so they killed the player
  beside them and spared them in the corners.
- Three `import()` calls ran inside frame loops (HUD, renderer, audio), each creating a
  promise per frame to read a boolean from an already-loaded module and applying it a
  frame late.
- The game-over pause used `setTimeout`, which kept running while the tab was hidden and
  while the game was paused.
- `player:damaged` listeners in the audio and VFX systems assumed a fully populated
  payload and threw on a partial one.

### Added

- **Domain layer** (`src/domain/`): `jump-arc.ts` (reachability maths) and `integrity.ts`
  (health invariants). Imports nothing. See ADR 006.
- **Authored level design**: eleven named chunks in `src/game/chunks.ts`, sequenced by
  `src/game/composer.ts` into a verifiable blueprint. Reachability, rhythm, checkpoint
  placement and Fragmento tiers are asserted over thirty seeds. See ADR 007.
- **Balizas de Reanclaje** — checkpoints, at least one per Ciclo.
- **Two-tier Fragmentos**: `path` worth 1 (amber) and `risk` worth 3 (violet), the latter
  guaranteed from Ciclo 2 and readable from across the arena.
- **The Impulso is now a weapon.** Dashing through a fragile Sombra shatters it and feeds
  the Resonancia. Non-fragile ones are stunned instead.
- **Enemy state machines with a 0.45 s telegraph floor** for every archetype, plus
  projectiles (Centinela), a shockwave (Coloso) and three integrity-keyed phases for the
  Devorador. See ADR 010.
- **Presentation layer** (`src/ui/`): `health.ts`, `widgets.ts`, `screen.ts`, `menu.ts`.
  See ADR 009.
- **Integridad del Núcleo**: a segmented meter with a delayed chip layer, a critical alarm
  state, a shield overlay, a repair animation and full `role="meter"` semantics.
- Impulso readiness ring, Resonancia dial with a decay arc, Ciclo progress bar, Ventaja
  chip, and a deduplicating toast stack.
- Critical and dash-streak screen layers.
- **Escape pauses and resumes**; menus are fully keyboard-operable with visible focus
  rings.
- An in-game **Registro** and a camera-shake setting.
- Jump buffering, variable jump height, an air-dash budget and asymmetric gravity.
- Glowing platform edges that encode behaviour: cyan is solid, carmine collapses, amber
  moves.
- New documentation: [`20-lore.md`](20-lore.md) (lore bible and naming contract),
  [`22-game-design.md`](22-game-design.md) (feel targets and difficulty curve),
  [`23-interface.md`](23-interface.md) (interface contract), ADRs 006–010.
- 131 new tests (14 → 145), including two property-style sweeps over thirty seeds.

### Changed

- **Falling into the Vacío costs the Resonancia, not a layer of Núcleo.** Measured
  decision; see ADR 008.
- Collapsing platforms reform instead of being destroyed, so no failure permanently
  removes a route the player still needs.
- The dev server is pinned to **port 5310** (preview 5311) with `strictPort: true`, so a
  port collision with another local project fails loudly instead of silently serving from
  a neighbour's origin. See `docs/60-runbook.md`.
- The infinite ground plane is gone. The void is real, and the Balizas are what keep that
  fair.
- `CONFIG.level` is now the composer's tuning block; the progression function moved to
  `CONFIG.levelSpec(n)`. There is deliberately no callable shim.
- `state.integrity` replaces `state.lives`, which is kept as a deprecated mirror until
  spec 026.
- Platform surfaces darkened; the light moved into the edge frame so a landing zone is
  readable against the void.
- Hovering archetypes (Acechante, Centinela, Interceptor, Devorador, Dron) ignore gravity;
  grounded ones are leashed to their slot so they stop deleting themselves in the void.
- The void threshold moved from `y < -25` to `y < -12`.

### Removed

- The random-walk level generator.
- The perimeter walls and the solid ground plane.

---

## Earlier

### Fixed

- Remove artificial arena boundary clamp in physics integration allowing unbounded
  movement along the runner track.
- Restore responsive air control acceleration so airborne jumps do not stall player
  forward velocity.
- Remove horizontal camera bounds clamping to follow player continuously along the track.
- Divide northern perimeter wall in level builder to keep bridge entrance unblocked.
- Support headless execution without 2D canvas context in noise texture generator.
- Upgrade visor material to MeshPhysicalMaterial to eliminate Three.js clearcoat warning.

### Added

- Initial project structure.
