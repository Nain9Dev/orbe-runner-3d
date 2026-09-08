# Tasks 024 — Flow & Feel

Ordered by dependency. Every task carries a label (`[A]` agent, `[M]` mixed, `[H]` human)
and a verifiable `Done when:` line. Test first, one task at a time.

## Phase 0 — Foundations (domain, no engine)

- [x] **T-024.01** `[A]` Add `src/domain/jump-arc.ts`: apex height, air time and maximum
      horizontal jump distance for a height delta, derived from gravity / jump impulse /
      speed. No imports.
  - **Covers**: REQ-024.17
  - **Done when**: `tests/jump-arc.test.ts` proves apex height matches `v0²/2g`, that
    reachable distance shrinks as the target rises, and that an unreachable rise returns 0.

- [x] **T-024.02** `[A]` Add `src/domain/integrity.ts`: pure integrity rules (apply
      damage, shield absorption, repair, clamping, `isCritical`).
  - **Covers**: REQ-024.30, REQ-024.32, REQ-024.33
  - **Done when**: `tests/integrity.test.ts` covers damage, over-damage clamping, shield
    absorption of lethal damage, and repair capped at maximum.

- [x] **T-024.03** `[A]` Extend `src/config.ts` with the feel block: `fallGravityMultiplier`,
      `apexGravityMultiplier`, `jumpBuffer`, `jumpCutFactor`, `coyoteTime`, dash block,
      `groundStickTime`, level composer block.
  - **Covers**: REQ-024.07 … REQ-024.15, REQ-024.17, REQ-024.18
  - **Done when**: every new key is read by at least one system and documented in
    `docs/22-game-design.md`.

## Phase 1 — Physics

- [x] **T-024.04** `[A]` Sub-stepped integration capped at 4 sub-steps.
  - **Covers**: REQ-024.01
  - **Done when**: a body moving at 40 u/s toward a 1 u wall stops at the wall instead of
    passing through it (`tests/physics.test.ts`).

- [x] **T-024.05** `[A]` Single-application platform carry via `body.carry`.
  - **Covers**: REQ-024.02
  - **Done when**: a body resting on a platform moving at a known speed is displaced by
    exactly the platform delta over one frame, ±1 %.

- [x] **T-024.06** `[A]` Ground normal, ground stick timer, no restitution on the ground
      normal, tangential preservation on walls, split gravity by flight phase.
  - **Covers**: REQ-024.03 … REQ-024.07
  - **Done when**: a body dropped on flat floor comes to rest with `|velocity.y| < 0.01`
    and never rebounds; a body pushed into a wall keeps its tangential speed.

## Phase 2 — Movement

- [x] **T-024.07** `[A]` Jump buffer, variable jump height, coyote time in seconds.
  - **Covers**: REQ-024.08, REQ-024.09, REQ-024.10
  - **Done when**: pressing jump one frame before landing produces a jump on the landing
    frame; releasing jump mid-rise cuts upward velocity.

- [x] **T-024.08** `[A]` Dash rework: input-space direction, gravity suspension,
      i-frames, air-dash budget, cooldown ratio published to `state.dashRatio`.
  - **Covers**: REQ-024.11 … REQ-024.13, REQ-024.15
  - **Done when**: a dash with `KeyA` held and `cameraYaw = 0` moves the body along `-X`;
    a second air dash is refused; the third succeeds after landing.

- [x] **T-024.09** `[A]` Dash-shatter: destroying `fragile` Sombras on dash contact.
  - **Covers**: REQ-024.14
  - **Done when**: contact during a dash destroys a `fragile` enemy, emits
    `enemy:shattered`, and leaves integrity untouched.

## Phase 3 — Level design

- [x] **T-024.10** `[A]` Add `src/game/chunks.ts`: authored chunk library with intensity,
      level band, and a builder function per chunk.
  - **Covers**: REQ-024.16, REQ-024.18
  - **Done when**: the library exposes ≥ 8 chunks and every entry declares
    `{ id, intensity, minLevel, build }`.

- [x] **T-024.11** `[A]` Rewrite `buildLevel` as a seeded composer with a reachability
      guard, rest chunks and Balizas.
  - **Covers**: REQ-024.16 … REQ-024.21
  - **Done when**: `tests/level.test.ts` runs seeds 1..30 and finds no unreachable gap
    and no run of tension chunks longer than the configured maximum.

- [x] **T-024.12** `[A]` Two-tier Fragmento placement (`path` = 1, `risk` = 3) and
      checkpoint prefab.
  - **Covers**: REQ-024.19, REQ-024.20
  - **Done when**: every generated Ciclo contains at least one `risk` Fragmento from
    Ciclo 2 onwards, and at least one Baliza.

## Phase 4 — Enemies

- [x] **T-024.13** `[A]` Give `interceptor` and `drone` a `body`; verify their systems now
      match and integrate.
  - **Covers**: REQ-024.25
  - **Done when**: a spawned interceptor changes position after 60 physics steps.

- [x] **T-024.14** `[A]` Archetype FSMs with a telegraph state ≥ 0.45 s and
      `enemy:telegraph` emission.
  - **Covers**: REQ-024.22, REQ-024.23
  - **Done when**: every archetype's telegraph duration is asserted ≥ 0.45 s in
    `tests/enemy.test.ts`.

- [x] **T-024.15** `[A]` Projectile entity + `projectileSystem` (lifetime, damage, solid
      destruction); Centinela fires them.
  - **Covers**: REQ-024.24
  - **Done when**: a projectile expires by TTL, damages Lúmen on contact, and is
    destroyed when it reaches a solid.

- [x] **T-024.16** `[A]` Coloso shockwave, Impulso stun, Devorador three-phase boss.
  - **Covers**: REQ-024.26 … REQ-024.28
  - **Done when**: the boss changes phase as integrity crosses its thresholds; a stunned
    Sombra does not accelerate while `stun > 0`.

## Phase 5 — Interface

- [x] **T-024.17** `[A]` Fix the fatal HUD render (`el.total`) and extract presentation
      into `src/ui/`.
  - **Covers**: REQ-024.29
  - **Done when**: `tests/hud.test.ts` runs 120 render frames with no exception.

- [x] **T-024.18** `[A]` `src/ui/health.ts`: segmented Integridad meter with chip drain,
      critical pulse, shield overlay, repair animation and ARIA metadata.
  - **Covers**: REQ-024.30 … REQ-024.35
  - **Done when**: the meter reports `aria-valuenow` equal to current integrity and
    renders exactly `maxIntegrity` segments.

- [x] **T-024.19** `[A]` `src/ui/widgets.ts`: dash ring, Resonancia arc, Ciclo progress,
      toasts.
  - **Covers**: REQ-024.36 … REQ-024.39
  - **Done when**: each widget updates only when its bound value changes (dirty check
    asserted in the HUD test).

- [x] **T-024.20** `[A]` `src/ui/screen.ts`: damage vignette wiring and critical vignette.
  - **Covers**: REQ-024.32, REQ-024.42
  - **Done when**: `player:damaged` toggles the vignette class and it clears after decay.

- [x] **T-024.21** `[A]` `src/ui/menu.ts`: Escape toggles pause, full keyboard navigation,
      visible focus rings, settings preserved.
  - **Covers**: REQ-024.40, REQ-024.41
  - **Done when**: Escape while playing sets `status = 'paused'`; every interactive
    control is reachable with `Tab` and has a `:focus-visible` style.

## Phase 6 — Documentation

- [x] **T-024.22** `[A]` Write `docs/20-lore.md` (lore bible), `docs/22-game-design.md`
      (feel targets, chunk curve, enemy design), `docs/23-interface.md` (HUD contract and
      the integrity meter in detail); update `10-requirements`, `20-architecture`,
      `21-data-model`, `40-tasks`, `50-traceability`, `90-changelog`; add ADRs 006–010.
  - **Covers**: REQ-024.43, REQ-024.44
  - **Done when**: every REQ-024.* appears in `docs/50-traceability.md` mapped to a
    passing test, and every user-facing string traces to the lore glossary.

## Session handoff

| Field | State |
| :--- | :--- |
| **Done** | T-024.01 … T-024.22. |
| **Verified** | `npm test` → 4 test files before, 9 after; 14 tests before, 145 after; all passing. Run log below. |
| **Next** | Owner reviews ADR-006 … ADR-010 and promotes them from `Proposed` to `Approved`. Optional follow-ups are listed in `checklist.md` §4. |
| **Blocked** | Nothing. No new dependency, no credential, no external service. |

```
 Test Files  9 passed (9)
      Tests  145 passed (145)
```

New suites: `tests/jump-arc.test.ts`, `tests/integrity.test.ts`, `tests/level.test.ts`,
`tests/enemy.test.ts`, `tests/hud.test.ts`. Existing suites (`physics`, `player`, `game`,
`ecs`) were extended rather than replaced.
