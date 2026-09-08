# ADR 009: Presentation extracted into `src/ui/`

**Status:** Proposed
**Date:** 2026-09-08
**Spec:** 024

## Context

`src/systems/hud.ts` was 282 lines mixing DOM construction, `localStorage`, dynamic
`import()` calls inside the render loop, per-frame layout writes and menu wiring. It also
contained the worst defect in the codebase:

```js
el.score.textContent = world.state.collected.toString();
el.total.textContent = world.state.totalOrbs.toString();   // el.total === undefined
```

There is no `#hud-total` in the markup. The second line threw a `TypeError` **on every
frame**, aborting the rest of `render()` — the Ciclo counter, the FPS readout, the
Resonancia, the Ventaja timer and **the entire health bar** — and, because systems render
in registration order, also killing the render phase of every system after it. The game
appeared to work only because the 3D renderer runs first.

`AGENTS.md` already required presentation to live in its own layer. It did not.

## Decision

Create `src/ui/`:

| Module | Owns |
| :--- | :--- |
| `health.ts` | The Integridad del Núcleo meter |
| `widgets.ts` | Impulso ring, Resonancia dial, Ciclo progress, Ventaja chip, toasts |
| `screen.ts` | Damage, critical and dash vignettes |
| `menu.ts` | Menus, settings, Registro, Escape handling, `localStorage` |

`src/systems/hud.ts` becomes a **binder**: it reads `world.state`, pushes plain numbers and
strings at the widgets, and does nothing else. Modules in `src/ui/` import nothing from
`src/core/`, `src/game/` or `src/systems/`; the single permitted import is `src/config.ts`,
for user settings.

Every widget dirty-checks: a value that has not changed produces no DOM write.

## Consequences

**Positive**

- The bug class is structurally gone. `tests/hud.test.ts` mounts the **real**
  `index.html` body and renders 120 frames — a hand-written fixture would have reproduced
  the binder's own assumptions and passed happily while the shipped page threw.
- Each widget is unit-testable in jsdom without booting a renderer.
- Removing the per-frame `textContent` writes and the per-frame `import()` removes layout
  work and promise churn that existed for values changing a few times a second.
- Three screen effects that existed in markup and CSS but were never toggled by anything
  now actually play.

**Negative**

- One more indirection between a state change and a pixel.
- The wording of the accessible integrity description is duplicated between
  `src/domain/integrity.ts` and `src/ui/health.ts`. Deliberate: the UI layer must not
  depend on the domain layer, and three strings are cheaper than the layer violation.
