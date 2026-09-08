# Requirements

Status: Draft

Stable functional requirements, written in EARS notation. Feature-level detail lives in
`../specs/NNN-*/spec.md`; this file holds the consolidated, product-wide list. Each entry
maps to a passing test in [50-traceability.md](50-traceability.md).

EARS patterns:
- Event-driven: `When <trigger>, the system shall <response>.`
- State-driven: `While <state>, the system shall <response>.`
- Unwanted behaviour: `If <condition>, then the system shall <response>.`
- Ubiquitous: `The system shall <response>.`

## Product

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-001 | The system shall maintain 60 FPS on modern browsers and mobile devices. | Charter | Approved |
| REQ-002 | The system shall be playable with a single click at `https://orbe.naindev.com/` without downloads or backend latency. | Charter | Approved |
| REQ-003 | When accessed from a mobile device, the system shall support touch controls. | Charter | Approved |
| REQ-004 | The system shall prevent blocking bugs to maintain a 100 % zero-bug playable state in the main branch. | Charter | Approved |

## Physics

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-024.01 | The physics system shall integrate motion in sub-steps such that no body advances more than half its own radius per sub-step. | 024 | Proposed |
| REQ-024.02 | When a body rests on a moving platform, the system shall displace the body by the platform delta exactly once per frame, regardless of how many solver iterations run. | 024 | Proposed |
| REQ-024.03 | When a body collides with a surface whose normal has `y > 0.5`, the system shall mark the body grounded and store the surface normal in `body.groundNormal`. | 024 | Proposed |
| REQ-024.04 | While a body is grounded, the system shall not apply restitution along the ground normal. | 024 | Proposed |
| REQ-024.05 | When a body collides with a wall, the system shall remove only the velocity component along the contact normal and preserve the tangential component. | 024 | Proposed |
| REQ-024.06 | The system shall keep a body grounded for `physics.groundStickTime` after contact is lost while not moving upwards. | 024 | Proposed |
| REQ-024.07 | While a body is falling the system shall scale gravity by `world.fallGravityMultiplier`; near the apex it shall scale gravity by `world.apexGravityMultiplier`. | 024 | Proposed |

## Movement

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-024.08 | When jump is pressed within `player.jumpBuffer` seconds before landing, the system shall execute the jump on the landing frame. | 024 | Proposed |
| REQ-024.09 | While airborne after a jump, if the jump key is released before the apex, the system shall cut the upward velocity to `player.jumpCutFactor`. | 024 | Proposed |
| REQ-024.10 | The system shall grant coyote time measured in seconds (`player.coyoteTime`), independent of frame rate. | 024 | Proposed |
| REQ-024.11 | When the player dashes, the system shall direct the impulse along the movement input in camera space, falling back to camera forward when there is no input. | 024 | Proposed |
| REQ-024.12 | While a dash is active, the system shall suspend gravity and grant invulnerability for `player.dash.time`. | 024 | Proposed |
| REQ-024.13 | The system shall allow at most `player.dash.airDashes` dashes per airborne period; landing shall restore the allowance. | 024 | Proposed |
| REQ-024.14 | While a dash is active and the player contacts a Sombra marked `fragile`, the system shall destroy it, emit `enemy:shattered`, and grant Resonancia instead of dealing damage. | 024 | Proposed |
| REQ-024.15 | While the player supplies movement input, the system shall converge horizontal speed to the target and cap it at `targetSpeed × 1.15`; the cap shall not apply during a dash nor when there is no input. | 024 | Proposed |

## Level design

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-024.16 | The level builder shall assemble each Ciclo from a library of named, hand-authored chunks. | 024 | Proposed |
| REQ-024.17 | For every consecutive pair of platforms on the critical path, the builder shall guarantee `horizontal ≤ maxJumpDistance(Δh) × level.reachSafety`, derived analytically from gravity, jump impulse and speed. | 024 | Proposed |
| REQ-024.18 | The builder shall allow no more than `level.maxTensionRun` consecutive high-intensity chunks; a rest chunk shall follow. | 024 | Proposed |
| REQ-024.19 | The builder shall place at least one Baliza per Ciclo; when Lúmen falls into the void, the system shall respawn it at the last Baliza and shall reset the Resonancia **without** removing a layer of Núcleo. | 024 | Proposed |
| REQ-024.20 | The builder shall place Fragmentos in two tiers — `path` worth 1 on the route, `risk` worth 3 off it — and shall guarantee at least one `risk` Fragmento from Ciclo 2. | 024 | Proposed |
| REQ-024.21 | Given the same Ciclo number, the builder shall produce an identical layout on any machine. | 024 | Proposed |

## Enemies

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-024.22 | Every hostile archetype shall expose a state machine with a telegraph state lasting at least `enemy.telegraphFloor` before any damaging action. | 024 | Proposed |
| REQ-024.23 | While an archetype is telegraphing, the system shall emit `enemy:telegraph` so the presentation layer can render the tell. | 024 | Proposed |
| REQ-024.24 | The Centinela shall fire projectiles that expire by lifetime, damage Lúmen on contact, and are destroyed by any solid. | 024 | Proposed |
| REQ-024.25 | The Interceptor and the Dron shall own a `body` component, and their systems shall query by component rather than by tag. | 024 | Proposed |
| REQ-024.26 | When a Coloso lands after a leap, the system shall emit a shockwave that pushes Lúmen away and damages it within the radius. | 024 | Proposed |
| REQ-024.27 | The Devorador shall run three phases keyed to its remaining integrity, each changing its move set. | 024 | Proposed |
| REQ-024.28 | While a Sombra is stunned by an Impulso, the system shall suppress its movement for `enemy.stunTime`. | 024 | Proposed |

## Interface

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-024.29 | The HUD shall render without throwing on every frame. | 024 | Proposed |
| REQ-024.30 | The system shall display Integridad del Núcleo as a segmented meter with one segment per point of maximum integrity. | 024 | Proposed |
| REQ-024.31 | When Lúmen takes damage, the affected segment shall drain through a delayed chip layer so the amount lost stays legible after the fact. | 024 | Proposed |
| REQ-024.32 | While Lúmen holds one layer or less, the meter shall pulse in an alarm state and the screen shall carry a critical vignette. | 024 | Proposed |
| REQ-024.33 | While the Escudo is active, the meter shall render a shield overlay across the whole bar; absorbing a hit shall shatter it without draining a segment. | 024 | Proposed |
| REQ-024.34 | When Lúmen recovers integrity, the affected segment shall fill with a distinct repair animation. | 024 | Proposed |
| REQ-024.35 | The meter shall expose `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a human-readable `aria-valuetext`. | 024 | Proposed |
| REQ-024.36 | The HUD shall display the Impulso cooldown as a radial timer around the reticle. | 024 | Proposed |
| REQ-024.37 | The HUD shall display the Resonancia with a draining arc showing the window before decay. | 024 | Proposed |
| REQ-024.38 | The HUD shall display Ciclo progress as `collected / total` Fragmentos with a progress bar. | 024 | Proposed |
| REQ-024.39 | When a notable event occurs, the HUD shall show a transient toast, deduplicating repeats into a count. | 024 | Proposed |
| REQ-024.40 | When the player presses `Escape` while playing, the system shall pause; pressing it again while paused shall resume. | 024 | Proposed |
| REQ-024.41 | The menus shall be fully operable by keyboard, with a visible focus ring on every control. | 024 | Proposed |
| REQ-024.42 | When damage is taken, the screen shall flash a vignette that decays over 0.4 s. | 024 | Proposed |

## Documentation

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-024.43 | The repository shall carry a lore bible covering the world, the factions, every archetype, every Ventaja and every HUD element, and every user-facing string shall trace to its glossary. | 024 | Proposed |
| REQ-024.44 | The repository shall carry a game-design document stating the numeric feel targets so any future tuning change can be checked against an intended value. | 024 | Proposed |
