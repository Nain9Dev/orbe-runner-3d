# Spec 024 — Flow & Feel

| Field | Value |
| :--- | :--- |
| Status | Implemented |
| Supersedes | — |
| Extends | Spec 022 (Momentum), Spec 023 (Cyber Polish) |
| Owner approval | Pending |

## 1. Motivation

`Orbe Runner 3D` already has the raw material of a good arcade runner — a procedural
arena, a combo system, a dash, four enemy archetypes — but three things stop it from
being *fun*:

1. **The movement does not obey the hand.** Jumps are binary, the dash fires in the
   direction the model happens to face instead of the direction the player is pushing,
   and colliding with a moving platform multiplies the carry by the number of solver
   iterations. The player is fighting the simulation instead of playing it.
2. **The level is a random walk, not a level.** Platforms are placed by drifting a
   cursor with `range(8, 12)` steps, so nothing guarantees a gap is jumpable. The
   difficulty is noise, not a curve, and there is no rhythm between tension and rest.
3. **The interface is dead.** `hudSystem.render()` dereferences `el.total`, which does
   not exist in the DOM. That throws a `TypeError` on **every single frame**, which
   silently kills every HUD update after the first line: the level counter, the FPS
   counter, the combo, the power-up timer and — critically — **the entire health bar**
   never update. The player has no idea how much life they have.

This spec closes those three gaps and adds the connective tissue that turns a tech
demo into a game: readable enemy telegraphs, an offensive use for the dash, a health
interface that communicates state at a glance, and a lore layer that gives the numbers
a meaning.

## 2. Glossary (product language)

The in-game vocabulary is fixed by [docs/20-lore.md](../../docs/20-lore.md) and MUST be
used consistently in every user-facing string.

| Concept | In-game name (es-ES) | Code identifier |
| :--- | :--- | :--- |
| Player character | Lúmen | `player` |
| Health | Integridad del Núcleo | `player.integrity` |
| One health segment | Capa de Núcleo | `integrity segment` |
| Collectible | Fragmento de Estrella | `orb` |
| Enemy family | Sombras | `enemy` |
| Level | Ciclo | `level` |
| Dash | Impulso | `dash` |
| Combo | Resonancia | `combo` |

## 3. Functional requirements (EARS)

### 3.1 Physics — simulation correctness

- **REQ-024.01** — The physics system shall integrate motion in sub-steps such that no
  body advances more than half its own radius per sub-step.
  *Rationale: the dash reaches 34 u/s; at `dt = 1/60` that is 0.57 u, which is enough
  to tunnel through a 1 u thick perimeter wall.*
- **REQ-024.02** — When a body rests on a moving platform, the system shall displace
  the body by the platform delta exactly once per frame, regardless of how many
  collision-solver iterations run.
- **REQ-024.03** — When a body collides with a surface whose normal has `y > 0.5`, the
  system shall mark the body as grounded and shall store the surface normal in
  `body.groundNormal`.
- **REQ-024.04** — While a body is grounded, the system shall not apply restitution
  along the ground normal, so that the player never bounces on flat floors.
- **REQ-024.05** — When a body collides with a wall, the system shall remove only the
  velocity component along the contact normal and shall preserve the tangential
  component, so that the player slides along walls instead of stopping dead.
- **REQ-024.06** — The system shall keep a body grounded for a configurable
  `groundStickTime` after it loses contact while not moving upwards, so that running
  down stairs does not produce a flicker between grounded and airborne.
- **REQ-024.07** — While a body is falling, the system shall multiply gravity by
  `CONFIG.world.fallGravityMultiplier`; while a body is near the apex of a jump
  (`|velocity.y| < apexThreshold`), the system shall multiply gravity by
  `CONFIG.world.apexGravityMultiplier`.

### 3.2 Movement — the hand-to-avatar contract

- **REQ-024.08** — When the jump key is pressed within `CONFIG.player.jumpBuffer`
  seconds before the player becomes grounded, the system shall execute the jump on the
  frame the player lands.
- **REQ-024.09** — While the player is airborne after a jump and the jump key is
  released before the apex, the system shall cut the upward velocity to
  `CONFIG.player.jumpCutFactor` of its current value (variable jump height).
- **REQ-024.10** — The system shall grant coyote time measured in seconds
  (`CONFIG.player.coyoteTime`), independent of the frame rate.
- **REQ-024.11** — When the player dashes, the system shall direct the impulse along
  the current movement input projected into camera space; if there is no movement
  input, the impulse shall follow the camera forward vector.
- **REQ-024.12** — While a dash is active, the system shall suspend gravity for
  `CONFIG.player.dashTime` seconds and shall grant the player invulnerability for the
  same duration.
- **REQ-024.13** — The system shall allow at most `CONFIG.player.airDashes` dashes per
  airborne period; landing shall restore the airborne dash allowance.
- **REQ-024.14** — While a dash is active and the player contacts a Sombra whose
  archetype is marked `fragile`, the system shall destroy the Sombra, emit
  `enemy:shattered`, and grant one Resonancia step instead of dealing damage.
- **REQ-024.15** — While the player is supplying movement input, the system shall cap
  the horizontal speed at `targetSpeed × 1.15` on the ground and in the air, and shall
  converge it to `targetSpeed`; while a dash is active the cap does not apply, and
  while there is no movement input the cap does not apply so that knock-back and
  bounce pads keep the momentum they were given.
  *The 1.15 allowance is the Impulso carry factor: a dash that is cut off the frame it
  ends cannot be chained into a long jump, which is most of what makes it worth having.*

### 3.3 Level design — authored rhythm over noise

- **REQ-024.16** — The level builder shall assemble each Ciclo from a library of named,
  hand-authored chunks instead of a random cursor walk.
- **REQ-024.17** — For every consecutive pair of platforms on the critical path, the
  builder shall guarantee that the gap is reachable: the horizontal distance shall not
  exceed `maxJumpDistance(dh) * CONFIG.level.reachSafety` for the height difference
  `dh`, where `maxJumpDistance` is derived analytically from gravity, jump impulse and
  movement speed.
- **REQ-024.18** — The builder shall alternate chunk intensity so that no more than
  `CONFIG.level.maxTensionRun` high-intensity chunks appear consecutively; a rest chunk
  shall follow.
- **REQ-024.19** — When a Ciclo is built, the builder shall place at least one Baliza
  (checkpoint); when Lúmen falls into the Vacío, the system shall respawn it at the last
  Baliza reached and shall reset the Resonancia **without** removing a layer of Núcleo.
  *Amended during implementation. The requirement originally cost a layer, like any other
  hazard. A scripted agent then ended every Ciclo-1 run at zero integrity with three falls
  and zero enemy contacts, which makes the void rather than the Sombras the subject of the
  game. Evidence and reasoning:*
  [ADR-008](../../docs/30-decisions/008-void-costs-resonance.md).
- **REQ-024.20** — The builder shall place Fragmentos in two tiers: `path` fragments on
  the critical route worth 1, and `risk` fragments on optional hazardous positions
  worth 3.
- **REQ-024.21** — Given the same Ciclo number, the builder shall produce an identical
  layout on any machine (deterministic seeded generation).

### 3.4 Enemies — readable, fair, aggressive

- **REQ-024.22** — Every hostile archetype shall expose a finite state machine with an
  explicit telegraph state whose duration is at least `0.45 s` before any damaging
  action.
- **REQ-024.23** — While an archetype is in its telegraph state, the system shall emit
  `enemy:telegraph` so that the presentation layer can render the tell (colour shift,
  aim line, charge glow).
- **REQ-024.24** — The Centinela archetype shall fire projectiles at Lúmen; projectiles
  shall be entities with a lifetime, shall damage Lúmen on contact, and shall be
  destroyed on contact with any solid.
- **REQ-024.25** — The Interceptor and the Dron shall own a `body` component so that the
  physics system integrates them. *(Regression: they currently have none, so their
  systems never match and both entities are inert.)*
- **REQ-024.26** — When a Coloso lands after a leap, the system shall emit a shockwave
  that pushes Lúmen away and deals damage within `shockwaveRadius`.
- **REQ-024.27** — The Devorador (boss, every 5 Ciclos) shall run three phases keyed to
  its remaining integrity, each phase changing its move set.
- **REQ-024.28** — While a Sombra has been stunned by an Impulso, the system shall
  suppress its movement for `stunTime` seconds.

### 3.5 Interface — health first

- **REQ-024.29** — The HUD shall render without throwing on every frame. *(Regression:
  `el.total` is `undefined`; the exception aborts every HUD update after the score.)*
- **REQ-024.30** — The system shall display Integridad del Núcleo as a segmented meter
  with one segment per point of maximum integrity.
- **REQ-024.31** — When Lúmen takes damage, the affected segment shall drain over
  `0.45 s` through a delayed "chip" ghost layer, so that the amount lost is legible
  after the fact.
- **REQ-024.32** — While Lúmen holds one integrity point or less, the meter shall pulse
  in an alarm state and the screen shall carry a permanent low-integrity vignette.
- **REQ-024.33** — While the Escudo power-up is active, the meter shall render a shield
  overlay over the whole bar; when the shield absorbs a hit, the overlay shall shatter
  without draining a segment.
- **REQ-024.34** — When Lúmen recovers integrity, the affected segment shall fill with a
  distinct repair animation.
- **REQ-024.35** — The meter shall expose `role="meter"` with `aria-valuenow`,
  `aria-valuemin`, `aria-valuemax` and a human-readable `aria-valuetext`.
- **REQ-024.36** — The HUD shall display the Impulso cooldown as a radial timer around
  the reticle, reaching full ring exactly when the dash becomes available again.
- **REQ-024.37** — The HUD shall display the Resonancia (combo) with a draining timer
  arc showing the remaining window before it decays.
- **REQ-024.38** — The HUD shall display Ciclo progress as `collected / total`
  Fragmentos with a progress bar.
- **REQ-024.39** — When a notable event occurs (Sombra shattered, Resonancia milestone,
  Baliza reached, power-up gained or lost), the HUD shall show a transient toast for
  `1.6 s`.
- **REQ-024.40** — When the player presses `Escape` while playing, the system shall
  pause and open the menu; when the player presses it again while paused, the system
  shall resume.
- **REQ-024.41** — The pause and start menus shall be operable by keyboard alone: `Tab`
  and arrow keys move focus, `Enter`/`Space` activate, and every control shall show a
  visible focus ring.
- **REQ-024.42** — When damage is taken, the screen shall flash a red vignette that
  decays over `0.4 s`. *(Regression: `#damage-vignette` exists in markup and CSS but
  nothing ever toggles it.)*

### 3.6 Documentation

- **REQ-024.43** — The repository shall carry a lore bible covering the world, the
  factions, every archetype, every power-up and the meaning of each HUD element, and
  every user-facing string shall be traceable to it.
- **REQ-024.44** — The repository shall carry a game-design document stating the
  numeric feel targets (jump arc, dash arc, time-to-kill, chunk intensity curve) so
  that any future tuning change can be checked against an intended value.

## 4. Edge cases

| # | Case | Expected behaviour |
| :--- | :--- | :--- |
| E-01 | Dash fired the same frame the player lands | The landing restores the air-dash allowance before the dash is consumed; the dash executes as a ground dash. |
| E-02 | Jump buffered while already grounded | Behaves as an ordinary jump; the buffer is consumed and not replayed. |
| E-03 | Two dashes buffered inside the cooldown | The second input is ignored, not queued. |
| E-04 | Player dashes into a Coloso (non-fragile) | No shatter; the dash i-frames still prevent damage; the Coloso is stunned. |
| E-05 | Shield active and lethal damage taken | The shield absorbs it; integrity is unchanged; the shield breaks. |
| E-06 | Player falls into the void with 1 integrity | ~~Damage applies, integrity reaches 0, game over.~~ **Superseded by ADR-008**: the fall costs the Resonancia, not the layer. Lúmen reappears at the last Baliza with 1 integrity and one second of grace. |
| E-07 | Baliza reached, then the player quits to menu and restarts the Ciclo | The Baliza resets to the Ciclo origin. |
| E-08 | Projectile spawned inside a wall | Destroyed on its first physics step; no damage. |
| E-09 | Chunk composer cannot satisfy the reach constraint | It falls back to the `bridge` chunk, which is always reachable. |
| E-10 | `maxLives` changes between Ciclos (power-up) | The meter rebuilds its segments without losing the current fill state. |

## 5. Out of scope

- Multiplayer, leaderboards, persistence beyond `localStorage`.
- Loading external assets (models, textures, audio files). Everything stays procedural.
- Replacing the renderer, the bundler or the UI approach — see the locked stack in
  `AGENTS.md`.
- Localisation beyond `es-ES` for user-facing strings.

## 6. Acceptance criteria

1. `npm test` passes, with at least one test per requirement group listed in
   [docs/50-traceability.md](../../docs/50-traceability.md).
2. `hudSystem.render()` completes without throwing for a full Ciclo (proved by a test
   that runs the render binder against a jsdom HUD and asserts the integrity meter is
   populated).
3. A generated Ciclo for any seed in `1..30` satisfies the reachability invariant
   (property-style test over 30 seeds).
4. Every user-facing string in `index.html` and `src/ui/` appears in the lore bible
   glossary.

## 7. Session handoff

| Field | State |
| :--- | :--- |
| Done | All tasks T-024.01 … T-024.22 implemented and verified. |
| Verified | `npm test` — 9 files, 145 tests, all passing. `npm run build` clean. Arc and difficulty measured against the running game; numbers in `docs/22-game-design.md` §2.1 and §7. |
| Amended in flight | REQ-024.15 (speed cap → convergence plus a 1.15 carry ceiling) and REQ-024.19 (the Vacío costs Resonancia, not Núcleo). Both amended here rather than silently; see `checklist.md` §5. |
| Next | Owner review; promote ADRs 006–010 from `Proposed` to `Approved`. Play Ciclos 8–15 by hand (`docs/40-tasks.md`, T-024.H2). |
| Blocked | Nothing. No external dependency was added, no credential, no external service. |
