# Checklist 024 — consistency audit

`AGENTS.md` phase 5 (*Analyze*) and phase 7 (*Converge*). Filled in after implementation,
cross-checking spec, plan, tasks and code against each other.

---

## 1. Requirement coverage

Every `REQ-024.*` must be covered by a module **and** a task **and** a test.

| Requirement | Module | Task | Test | ✓ |
| :--- | :--- | :--- | :--- | :--- |
| .01 | `systems/physics.ts` | T-024.04 | `physics` | ✓ |
| .02 | `systems/physics.ts` | T-024.05 | `physics` | ✓ |
| .03 – .07 | `systems/physics.ts` | T-024.06 | `physics` | ✓ |
| .08 – .10 | `systems/player.ts` | T-024.07 | `player` | ✓ |
| .11 – .13 | `systems/player.ts` | T-024.08 | `player` | ✓ |
| .14 | `systems/triggers.ts`, `systems/enemy.ts` | T-024.09 | `enemy`, `game` | ✓ |
| .15 | `systems/player.ts` | T-024.08 | `player` | ✓ |
| .16 – .18 | `game/chunks.ts`, `game/composer.ts` | T-024.10, .11 | `level` | ✓ |
| .19 | `game/composer.ts`, `systems/game.ts` | T-024.11, .12 | `level`, `game` | ✓ |
| .20 | `game/composer.ts`, `game/level.ts` | T-024.12 | `level`, `game` | ✓ |
| .21 | `game/composer.ts` | T-024.11 | `level` | ✓ |
| .22 – .23 | `systems/enemy.ts` | T-024.14 | `enemy` | ✓ |
| .24 | `systems/projectile.ts` | T-024.15 | `enemy` | ✓ |
| .25 | `game/prefabs.ts`, `systems/enemy.ts` | T-024.13 | `enemy` | ✓ |
| .26 – .28 | `systems/enemy.ts`, `systems/triggers.ts` | T-024.16 | `enemy` | ✓ |
| .29 | `systems/hud.ts`, `ui/*` | T-024.17 | `hud` | ✓ |
| .30 – .35 | `ui/health.ts`, `domain/integrity.ts` | T-024.18 | `hud`, `integrity` | ✓ |
| .36 – .39 | `ui/widgets.ts` | T-024.19 | `hud` | ✓ |
| .40 – .41 | `ui/menu.ts` | T-024.21 | manual — see §3 | ⚠ |
| .42 | `ui/screen.ts` | T-024.20 | `hud` | ✓ |
| .43 – .44 | `docs/20-lore.md`, `docs/22-game-design.md` | T-024.22 | review | ✓ |

**No task without a requirement.** Verified: every T-024.* names at least one REQ.

---

## 2. Constitution compliance

| Rule (`AGENTS.md`) | State |
| :--- | :--- |
| Presentation must not calculate business figures or reach persistence | ✓ `src/ui/` imports only `config.ts`; every value arrives as a plain number from the binder |
| Presentation must not import the repository or the domain | ✓ Verified by inspection; the integrity wording is deliberately duplicated rather than imported |
| Domain depends on nothing | ✓ `src/domain/*` has zero imports |
| Locked stack, no new dependencies | ✓ `package.json` unchanged |
| Everything in the repo in English | ✓ Code, identifiers, comments, docs, tests, commits. Product strings remain `es-ES` per the documented exception |
| Diagrams updated in the same commit as their document | ✓ `20-architecture.md` (layers, flowchart), `21-data-model.md` (erDiagram), `22-game-design.md` (curve) |
| Significant decisions recorded as ADRs in `Proposed` | ✓ ADR 006 – 010, all `Proposed`. **No agent may promote them.** |
| Zero Bug Policy | ✓ Eight latent defects fixed; `npm test` and `npm run build` clean |

---

## 3. Gaps, stated honestly

| Item | Status | Why |
| :--- | :--- | :--- |
| REQ-024.40, REQ-024.41 | **Manual verification only** | Escape needs a real window key event; focus order needs a real layout engine. jsdom reports every element as unrendered, so a `focus()` assertion there would prove nothing. Both are verified by hand and recorded as such in `docs/50-traceability.md`. |
| REQ-001 (60 FPS) | **Manual verification only** | The available browser environment is software-rendered and reports 0–20 FPS regardless of the code. Not a measurement worth automating there. |
| REQ-003 (touch) | **Manual verification only** | jsdom has no touch event model. |
| Ciclos 8 – 15 | **Not played by a human** | The scripted agent gives a floor, not a verdict. Listed as `[H]` task T-024.H2. |

---

## 4. Follow-ups worth opening as their own spec

Deliberately **not** done here, because each one adds a requirement rather than closing
one, and `AGENTS.md` says a new requirement starts in a new spec.

1. **Off-screen telegraph indicator.** A Centinela aiming from behind the camera is
   audible but invisible. A screen-edge arrow would close the last gap in the fairness
   contract from ADR 010.
2. **Bundle size.** 674 kB (172 kB gzipped), almost entirely Three.js. Code-splitting the
   post-processing chain would help the charter's "instant load" pillar.
3. **Remove `state.lives`.** Deprecated mirror of `state.integrity`; removal target
   spec 026.
4. **Chunk variety at high Ciclos.** Eleven chunks stop feeling fresh somewhere past
   Ciclo 15. The library is an array; adding to it is cheap.
5. **Persist a best run.** There is a score (`Luz`) and no reason to beat it.

---

## 5. Converge audit

Phase 7 asks: what is implemented, what deviates, what is missing.

**Implemented:** every task, T-024.01 through T-024.22.

**Deviates from the original spec text**, with the spec amended in place rather than
silently:

- **REQ-024.15** was written as a hard cap at the target speed. Implemented as convergence
  to the target with a `×1.15` ceiling, because a dash cut off on the frame it ends cannot
  chain into a long jump — which is most of what makes the Impulso worth having. The
  requirement text and its test were both updated.
- **REQ-024.19** originally said a fall costs a layer of Núcleo and respawns at the
  Baliza. Implemented as *no layer lost, Resonancia reset*, on the evidence in ADR 008.
  Edge case E-06 in `spec.md` is superseded by that ADR.

**Missing:** nothing from this spec. The four items in §4 are new requirements, not
unfinished ones.
