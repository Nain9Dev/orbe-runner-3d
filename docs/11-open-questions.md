# Open questions

Unresolved ambiguities and known gaps. An open question blocks the requirement it
references.

| ID | Question | Blocks | Status |
| :--- | :--- | :--- | :--- |
| OQ-001 | What frame rate must be sustained, on which reference device, for REQ-001 to count as met? The requirement says "60 FPS on modern browsers and mobile devices" without naming a device or a measurement method, so it cannot be verified or falsified as written. | REQ-001 | **Open** |
| OQ-002 | When does `tsc --noEmit` become a required CI gate? The sources were renamed from `.js` to `.ts` without being typed, and `tsconfig.json` sets `strict: true`, so a type check currently reports **451 pre-existing errors**. It runs in CI as informational (`continue-on-error`) and is not a gate. `AGENTS.md` *Quality gates* promises type checks in CI, so the constitution and the pipeline disagree until this is resolved. | AGENTS.md quality gates | **Open** |
| OQ-003 | Is 30 Ciclos the intended horizon for a run, or should the composer keep introducing new chunk vocabulary past Ciclo 15? Eleven chunks stop feeling fresh somewhere around there. Affects how much content the library needs. | REQ-024.16 | **Open** |
| OQ-004 | Should a run be persisted (best Luz, furthest Ciclo)? There is a score and currently no reason to beat it. Out of scope for spec 024; it is a product decision, not a technical one. | — | **Open** |

## Resolved

| ID | Question | Resolution |
| :--- | :--- | :--- |
| OQ-005 | What should falling into the Vacío cost? | Resolved by measurement during spec 024: the Resonancia, not a layer of Núcleo. See [ADR-008](30-decisions/008-void-costs-resonance.md). |
| OQ-006 | Should the level generator stay procedural or become hand-authored? | Both: authored chunks, generated sequence. See [ADR-007](30-decisions/007-authored-chunks-over-random-walk.md). |
