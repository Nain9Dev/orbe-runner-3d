# Tasks

Consolidated task list. Feature-level detail lives in `../specs/NNN-*/tasks.md`.

## Spec 024 — Flow & Feel

All tasks complete and verified. Detail, `Done when:` criteria and the session handoff:
[`specs/024-flow-and-feel/tasks.md`](../specs/024-flow-and-feel/tasks.md).

| Task | Label | Covers | State |
| :--- | :--- | :--- | :--- |
| T-024.01 Domain: `jump-arc.ts` | `[A]` | REQ-024.17 | Done |
| T-024.02 Domain: `integrity.ts` | `[A]` | REQ-024.30, .32, .33 | Done |
| T-024.03 Feel block in `config.ts` | `[A]` | REQ-024.07 … .18 | Done |
| T-024.04 Sub-stepped integration | `[A]` | REQ-024.01 | Done |
| T-024.05 Single-application platform carry | `[A]` | REQ-024.02 | Done |
| T-024.06 Ground normal, stick, asymmetric gravity | `[A]` | REQ-024.03 … .07 | Done |
| T-024.07 Jump buffer, variable height, coyote in seconds | `[A]` | REQ-024.08 … .10 | Done |
| T-024.08 Impulso rework | `[A]` | REQ-024.11 … .13, .15 | Done |
| T-024.09 Dash-shatter | `[A]` | REQ-024.14 | Done |
| T-024.10 Chunk library | `[A]` | REQ-024.16, .18 | Done |
| T-024.11 Seeded composer with reach guard | `[A]` | REQ-024.16 … .21 | Done |
| T-024.12 Two-tier Fragmentos and Balizas | `[A]` | REQ-024.19, .20 | Done |
| T-024.13 Bodies for Interceptor and Dron | `[A]` | REQ-024.25 | Done |
| T-024.14 Archetype FSMs with a telegraph floor | `[A]` | REQ-024.22, .23 | Done |
| T-024.15 Projectiles | `[A]` | REQ-024.24 | Done |
| T-024.16 Shockwave, stun, boss phases | `[A]` | REQ-024.26 … .28 | Done |
| T-024.17 Fix the fatal HUD render; extract `src/ui/` | `[A]` | REQ-024.29 | Done |
| T-024.18 Integridad del Núcleo meter | `[A]` | REQ-024.30 … .35 | Done |
| T-024.19 Impulso ring, Resonancia dial, progress, toasts | `[A]` | REQ-024.36 … .39 | Done |
| T-024.20 Screen effects | `[A]` | REQ-024.32, .42 | Done |
| T-024.21 Menus, Escape, keyboard navigation, Registro | `[A]` | REQ-024.40, .41 | Done |
| T-024.22 Documentation | `[A]` | REQ-024.43, .44 | Done |

**Verification:** `npm test` → 9 files, 145 tests, all passing. `npm run build` clean.

## Spec 025 — Resonancia

Detail in [`specs/025-resonance/tasks.md`](../specs/025-resonance/tasks.md).

| Task | Label | Covers | State |
| :--- | :--- | :--- | :--- |
| T-025.01 Musical clock | `[A]` | REQ-025.11, .12 | Done |
| T-025.02 Adaptive score and intensity | `[A]` | REQ-025.06 … .10 | Done |
| T-025.03 Audio engine and bus graph | `[A]` | REQ-025.01, .03, .05, .18 | Done |
| T-025.04 Voices from noise and oscillators | `[A]` | REQ-025.02 | Done |
| T-025.05 Audio binder and beat publication | `[A]` | REQ-025.11, .12, .17 | Done |
| T-025.06 `body.impactSpeed` | `[A]` | REQ-025.15 | Done |
| T-025.07 Footsteps by distance | `[A]` | REQ-025.16 | Done |
| T-025.08 Music and effects volume | `[A]` | REQ-025.04 | Done |
| T-025.09 Beat and FSM in the avatar state | `[A]` | REQ-025.13, .19 | Done |
| T-025.10 Visible tells | `[A]` | REQ-025.20, .22 | Done |
| T-025.11 Shockwave footprint | `[A]` | REQ-025.21 | Done |
| T-025.12 Lúmen motion trail | `[A]` | REQ-025.13, .23 | Done |
| T-025.13 Beat-reactive bloom | `[A]` | REQ-025.14 | Done |
| T-025.14 Compass — closes T-024.F1 | `[A]` | REQ-025.25, .26 | Done |
| T-025.15 Ciclo card and run summary | `[A]` | REQ-025.27, .28 | Done |
| T-025.16 Documentation and ADRs 011–012 | `[A]` | — | Done |

**Verification:** `npm test` → 11 files, 200 tests, all passing. `npm run build` clean.

## Open

| Task | Label | Notes |
| :--- | :--- | :--- |
| T-024.H1 Approve ADR 006 – 012 | `[H]` | Owner only. They are `Proposed`; an agent may not promote them. |
| T-025.H1 Check the tells against a colour-blindness simulation | `[H]` | Amber on dark plus a shape change plus a sound is likely enough, but it has not been verified. See `docs/11-open-questions.md` OQ-007. |
| T-024.H2 Confirm the difficulty of Ciclos 8 – 15 by hand | `[H]` | The scripted agent in `docs/22-game-design.md` §7 is a floor, not a substitute for playing it. |
| ~~T-024.F1 Off-screen telegraph indicator~~ | `[A]` | **Done** in spec 025 (T-025.14). |
| T-024.F2 Remove `state.lives` | `[A]` | Deprecated mirror of `state.integrity`. Removal target: spec 026. |
