# Traceability

Every requirement and the test that proves it. **A requirement with no passing test is not
done**, whatever the code says.

Last full run: `npm test` → **11 files, 200 tests, all passing.**

## Physics — `tests/physics.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-024.01 | `sub-steps fast bodies so they cannot tunnel through a thin wall` | integration |
| REQ-024.02 | `applies the moving-platform carry exactly once per frame` | integration |
| REQ-024.03 | `publishes the contact normal of the surface underfoot` | integration |
| REQ-024.04 | `never bounces a resting body off a flat floor` | integration |
| REQ-024.05 | `preserves tangential velocity when sliding along a wall` | integration |
| REQ-024.06 | `holds grounded briefly across a seam instead of flickering`, `drops the grounded grace immediately when the body leaps` | integration |
| REQ-024.07 | `falls faster than it rises`, `hangs at the apex with reduced gravity` | integration |
| REQ-024.19 (route survives a fall) | `reforms after its respawn delay so a Ciclo stays finishable`, `stops being a surface while it is gone, and falls through`, `waits rather than reforming around a body standing in the hole`, `lets a projectile pass through a collapsed tile` | integration |

## Movement — `tests/player.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-024.08 | `buffers a jump pressed before landing and fires it on contact`, `expires the buffer once the window passes` | unit |
| REQ-024.09 | `cuts the rise when the jump key is released early`, `does not cut the rise while the key is held` | unit |
| REQ-024.10 | `measures coyote time in seconds, not frames`, `refuses a jump once coyote time has elapsed` | unit |
| REQ-024.11 | `dashes along the input direction, not the model facing`, `dashes along camera forward when there is no movement input` | unit |
| REQ-024.12 | `suspends gravity and grants invulnerability while dashing` | unit |
| REQ-024.13 | `allows one air dash and refuses the second until landing` | unit |
| REQ-024.14 | `shatters a Sombra whose integrity reaches zero` (`tests/enemy.test.ts`), `feeds Resonancia from a shattered Sombra as well` (`tests/game.test.ts`) | integration |
| REQ-024.15 | `caps horizontal speed on the ground as well as in the air`, `raises the speed cap with the Resonancia multiplier` | unit |
| E-03 | `ignores a held dash key as a repeat input` | unit |

## Level design — `tests/level.test.ts`, `tests/jump-arc.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-024.16 | `exposes at least eight authored chunks`, `declares a complete descriptor for every chunk`, `uses unique ids`, `gates the harder chunks behind a level` | unit |
| REQ-024.17 | `never places an unreachable jump on the critical path` (30 seeds) + the whole of `tests/jump-arc.test.ts` | property |
| REQ-024.18 | `never runs more tension chunks back to back than the rhythm allows` (30 seeds), `never repeats a chunk immediately`, `always offers a rest chunk, at every level band` | property |
| REQ-024.19 | `places at least one Baliza in every Ciclo` (30 seeds); `does not take a layer of Núcleo for falling into the void`, `takes the Resonancia instead, and says so`, `returns Lúmen to the last Baliza, not to the start of the Ciclo`, `grants a moment of grace on reappearing`, `clears an in-flight Impulso when Lúmen reappears` (`tests/game.test.ts`) | property + unit |
| REQ-024.20 | `offers risk Fragmentos from Ciclo 2 onwards` (30 seeds), `always offers more path Fragmentos than risk ones`, `counts Fragmentos by piece and light by value`, `gives a risk Fragmento twice the Resonancia of a path one` | property + unit |
| REQ-024.21 | `is deterministic for a given Ciclo`, `produces different Ciclos for different numbers` | unit |

## Enemies — `tests/enemy.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-024.22 | `never telegraphs for less than the fairness floor` (all archetypes) | property |
| REQ-024.23 | `announces the telegraph so the presentation layer can render a tell` | unit |
| REQ-024.24 | `fires a bolt from a Centinela and never moves it`; `travels in a straight line at its declared speed`, `expires when its lifetime runs out`, `is destroyed by a solid instead of passing through it` | unit |
| REQ-024.25 | `moves an Interceptor, which the missing body used to make impossible`, `keeps the escort Dron near the player and lets it stagger a Sombra` | integration |
| REQ-024.26 | `pushes and damages the player inside the radius`, `leaves a player outside the radius alone`, `still throws an invulnerable player without damaging them` | unit |
| REQ-024.27 | `runs the Devorador through three phases as its integrity falls` | unit |
| REQ-024.28 | `suppresses a stunned Sombra`, `survives a hit when it has integrity to spare` | unit |
| E-08 | `is destroyed immediately when it spawns inside geometry` | unit |

## Interface — `tests/hud.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-024.29 | `renders 120 frames without throwing` (against the real `index.html` body) | integration |
| REQ-024.30 | `populates the integrity meter instead of leaving it empty`, `renders one segment per point of maximum integrity` | unit |
| REQ-024.31 | `marks the lost segment as breaking so the chip layer can drain`, `breaks from the right, so damage reads as the bar retreating` | unit |
| REQ-024.32 | `marks the alarm state at one layer or less`, `turns on the critical vignette at one layer` | unit |
| REQ-024.33 | `renders the Escudo overlay across the whole bar`, `uses the shield colour when the Escudo absorbs the hit` | unit |
| REQ-024.34 | `uses a distinct animation when integrity is restored` | unit |
| REQ-024.35 | `exposes complete meter semantics to assistive tech`, `produces an accessible description for every state` (`tests/integrity.test.ts`) | unit |
| REQ-024.36 | `drives the Impulso ring from the readiness ratio`, `publishes dash readiness for the HUD` (`tests/player.test.ts`) | unit |
| REQ-024.37 | `shows the Resonancia dial only above a streak of one` | unit |
| REQ-024.38 | `tracks Ciclo progress` | unit |
| REQ-024.39 | `raises a toast for a game event`, `collapses repeated toasts into a count instead of stacking them` | unit |
| REQ-024.42 | `flashes the damage vignette on a hit` | unit |
| Dirty check | `writes only when a value actually changed` | unit |
| E-10 | `rebuilds the row without losing the fill when the maximum changes` | unit |

## Integrity rules — `tests/integrity.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-024.30 | `starts full`, `removes exactly the damage taken`, `clamps over-damage at zero and reports it as lethal` | unit |
| REQ-024.32 | `flags critical at one layer or less` | unit |
| REQ-024.33 / E-05 | `absorbs a whole lethal hit with the Escudo and consumes it`, `ignores zero damage without consuming the Escudo`; `lets the Escudo absorb a lethal hit without losing a layer` (`tests/game.test.ts`) | unit |
| REQ-024.34 | `never repairs above the maximum`, `extends the ceiling and fills the new layer` | unit |

## ECS core — `tests/ecs.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-004 | `should spawn entities with incrementing IDs`, `should find entities by components`, `should destroy entities at the end of the frame`, `should execute systems sequentially` | unit |

## Audio and reactivity — `tests/clock.test.ts`, `tests/score.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-025.06 | `gates the optional layers behind their thresholds`, `does not flap at a threshold boundary (hysteresis)` | unit |
| REQ-025.07 | `rises with the Resonancia streak`, `rises as a Sombra closes in`, `rises as the Núcleo is worn down`, `lets no single input saturate the mix on its own`, `rises faster than it falls` | unit |
| REQ-025.08 | `goes to the tension voicing at one layer, whatever else is true` | unit |
| REQ-025.09 | `gives each palette tier its own key`, `maps Ciclo bands onto tiers`, `transposes a degree into a frequency inside the mode` | unit |
| REQ-025.10 | `keeps the tempo inside eight per cent of the base` | unit |
| REQ-025.11 | `advances one beat per half second at 120 BPM`, `rolls into the next bar after four beats`, `reports the sixteenth within the bar`, `pulses at the onset and decays before the next beat`, `accents the downbeat only` | unit |
| REQ-025.12 | `treats the first advance as musical zero`, `resynchronises after a long gap`, `reports whether real audio is driving it`, `never runs backwards when the source does` | unit |
| REQ-025.15 | `records the speed a landing cancelled`, `scales the recorded impact with the height of the fall`, `forgets the last landing once the body is airborne again` (`tests/physics.test.ts`) | integration |

## Interface additions — `tests/hud.test.ts`

| Requirement | Test | Type |
| :--- | :--- | :--- |
| REQ-025.04 | `reports music and effects volume separately`, `starts at the configured volume when nothing has been saved`, `keeps the telegraph cues separable from the music` | unit |
| REQ-025.25 | `draws one arrow per off-screen tell`, `never shows more than four at once, nearest to landing first`, `hides arrows again when nothing is telegraphing` | unit |
| REQ-025.26 | `marks a damage bearing distinctly from a telegraph`, `ignores a nonsense bearing` | unit |
| REQ-025.27 | `renders one row per statistic and replaces the hint line`, `stays hidden for an ordinary message` | unit |
| REQ-025.28 | `names the Ciclo and its tier`, `covers every palette tier`, `hides on demand and degrades without a root` | unit |

## Not covered by an automated test

Recorded honestly rather than claimed.

| Requirement | Why | How it was verified |
| :--- | :--- | :--- |
| REQ-001 (60 FPS) | Needs real GPU timing; the CI environment is software-rendered | Manual, on target hardware |
| REQ-002 (one click to play) | Deployment property | Manual, at `https://orbe.naindev.com/` |
| REQ-003 (touch controls) | jsdom has no touch event model | Manual, on device |
| REQ-024.40 (Escape pauses) | Needs a real key event through the window listener | Manual |
| REQ-024.41 (keyboard menus) | Focus behaviour needs a real layout engine; jsdom reports every element as unrendered | Manual |
| REQ-024.43 / REQ-024.44 (documentation) | Prose | Review against `docs/20-lore.md` §8 and `docs/22-game-design.md` |
| REQ-025.01 – .03, .05 (audio graph) | jsdom has no Web Audio; a mock would assert the mock | Manual, in a browser: buses audible and separable, kick ducks the music, a blocked context plays silently |
| REQ-025.13, .14 (beat-driven visuals) | Needs a renderer and an eye | Manual: verified with the clock advancing live at 131 BPM |
| REQ-025.16 – .18 (footsteps, brightness, spatialisation) | Needs Web Audio and ears | Manual |
| REQ-025.20 – .23 (model tells and trail) | Needs a renderer | Manual: screenshot mid-telegraph shows a tell on all four archetypes |
