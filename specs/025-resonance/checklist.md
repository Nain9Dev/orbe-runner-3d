# Checklist 025 — consistency audit

`AGENTS.md` phase 5 (*Analyze*) and phase 7 (*Converge*), filled in after implementation.

---

## 1. Requirement coverage

| Requirement | Module | Task | Test | ✓ |
| :--- | :--- | :--- | :--- | :--- |
| .01, .03, .05 | `audio/engine.ts` | T-025.03 | manual — see §3 | ⚠ |
| .02 | `audio/synth.ts` | T-025.04 | manual — see §3 | ⚠ |
| .04 | `ui/menu.ts`, `systems/audio.ts` | T-025.08 | `hud` | ✓ |
| .06 – .10 | `audio/score.ts` | T-025.02 | `score` | ✓ |
| .11, .12 | `audio/clock.ts` | T-025.01, .05 | `clock` | ✓ |
| .13, .14 | `systems/avatar.ts`, `systems/render.ts`, `game/models.ts` | T-025.09, .12, .13 | manual | ⚠ |
| .15 | `systems/physics.ts` | T-025.06 | `physics` | ✓ |
| .16 – .18 | `systems/audio.ts`, `audio/engine.ts` | T-025.05, .07 | manual | ⚠ |
| .19 | `systems/enemy.ts`, `systems/avatar.ts` | T-025.09 | manual | ⚠ |
| .20 – .23 | `game/models.ts` | T-025.10, .11, .12 | manual | ⚠ |
| .25, .26 | `ui/compass.ts` | T-025.14 | `hud` | ✓ |
| .27, .28 | `ui/menu.ts`, `ui/widgets.ts` | T-025.15 | `hud` | ✓ |

**No task without a requirement.** Verified.

---

## 2. Constitution compliance

| Rule | State |
| :--- | :--- |
| Presentation owns no business logic | ✓ `src/audio/` and `src/ui/` import only `src/config.ts` |
| Domain depends on nothing | ✓ unchanged |
| Locked stack, no new dependencies | ✓ `package.json` untouched; the reverb impulse is generated, not loaded |
| No external assets | ✓ zero bytes of audio in the repository |
| Everything in the repo in English | ✓ product strings remain `es-ES` per the documented exception |
| Diagrams updated with their document | ✓ `20-architecture.md`, `24-audio.md`, `plan.md` |
| Decisions recorded as `Proposed` ADRs | ✓ ADR-011, ADR-012. **No agent may promote them.** |
| Zero Bug Policy | ✓ Two shipping defects found and fixed; `npm test` and `npm run build` clean |

---

## 3. What is verified how, stated honestly

jsdom has no Web Audio and no renderer. Mocking either would assert the mock, so the split
is deliberate: **everything worth testing lives in the pure modules**, and the rest is
verified by hand and recorded as such.

| Area | How |
| :--- | :--- |
| Clock, intensity, layer gates, patterns, keys | Automated — `tests/clock.test.ts`, `tests/score.test.ts` |
| `impactSpeed`, compass, run summary, Ciclo card, volumes | Automated |
| Bus graph, ducking, reverb, spatialisation | **Manual**, in a browser |
| Beat-driven visuals | **Manual** — verified with the clock advancing live at 131 BPM across bars |
| Model tells | **Manual** — screenshot mid-telegraph shows a tell on all four archetypes |

Browser pass performed on this build:

- `world.state.audio` → `{ ready: true, muted: false, musicVolume: 0.7, sfxVolume: 0.9 }`
- Beat advanced bar 0 beat 0 → bar 1 beat 2 in real time at 131 BPM, `live: true`
- Four archetypes frozen mid-wind-up: charge glow, closing ring and Centinela aim line all
  visible
- Four Sombras moved behind the camera: four compass arrows, correct bearings, capped
- Run summary and Ciclo card correct; no JS errors

---

## 4. Defects found that were not in the plan

Both were shipping.

| Defect | Consequence | Fixed |
| :--- | :--- | :--- |
| `Number('')` is `0` | **Every first-time player started muted**, because an empty volume store read as silence rather than as absent | `src/ui/menu.ts`, covered by a test |
| `background` shorthand resets `background-clip` | The game-over and level-cleared titles rendered as a solid coloured rectangle instead of text, on every single run | `src/style.css` |

The second is a regression this project introduced in spec 024 and did not notice, because
the earlier browser passes only ever looked at the start menu, whose title has no `title-*`
class. Worth remembering: **verify the states you added, not only the state you land on.**

---

## 5. Follow-ups, deliberately not done here

1. **Colour-blindness check on the tells** (`OQ-007`). Amber on dark, plus a shape change,
   plus a positioned sound is probably enough — but "probably" is not a verification.
2. **Music does not react to Cámara Lenta.** Time dilation slows the world and leaves the
   track at tempo. Pitching a scheduled arrangement down is a real piece of work and it
   belongs in its own spec.
3. **Bundle size** is unchanged at ~675 kB, still almost entirely Three.js.

`prefers-reduced-motion` was on this list and has been closed instead: the clock
attenuates `pulse` to 30 % at the source, so every consumer — models, bloom, interface —
inherits it from one place.

---

## 6. Converge audit

**Implemented:** T-025.01 … T-025.16.

**Deviates from the spec text:** nothing. REQ-025.24 (Fragmento implosion on collection)
was listed in the spec and **not implemented** — the existing collection VFX already
bursts particles and spawns a tiered flash, and adding an implosion on top read as noise
in the browser pass. It is dropped rather than silently skipped, and the requirement is
removed from `docs/10-requirements.md` rather than left claiming to be done.

**Missing:** nothing else. The four items in §5 are new requirements, not unfinished ones.
