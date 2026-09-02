# Project constitution

[Short project description]. [Tech stack overview, e.g. Python 3.12, FastAPI, Clean Architecture, Vue 3 presentation, PostgreSQL persistence].

This file is the operational contract for any AI agent working on this repository (Claude Code, Codex, Cursor, Antigravity or any other). Read `docs/README.md` before proposing anything.

## Authority

- `docs/` is the canonical, stable source of truth for the product. `specs/` holds the working cycle of each feature. Code that contradicts an `Approved` document is a defect, not a decision.
- Only the owner approves a decision. An agent may draft one as `Proposed`; never record it as `Approved`.
- A document marked `Superseded` or `Draft` never drives an implementation.

## Workflow (spec-driven)

Every feature follows this cycle. Never skip a phase, never start in the code.

1. **Specify** — create `specs/NNN-feature-name/spec.md`: functional requirements in EARS notation (`When <trigger>, the system shall <response>`), edge cases, out of scope, acceptance criteria. Update `docs/10-requirements.md` with the stable `REQ-###` entries.
2. **Clarify** — review the spec for ambiguities and contradictions; unresolved items go to `docs/11-open-questions.md` and block the requirement they reference.
3. **Plan** — create `specs/NNN-feature-name/plan.md`: modules, data model changes, key decisions with discarded alternatives, test strategy, and which requirement each module covers. Significant decisions become ADRs under `docs/30-decisions/` as `Proposed`.
4. **Tasks** — create `specs/NNN-feature-name/tasks.md`: tasks under 30 minutes, ordered by dependency, each labelled `[A]`/`[M]`/`[H]`, each with a verifiable `Done when:` line. Mirror them into `docs/40-tasks.md`. External dependencies go to `docs/41-blockers.md` before any code.
5. **Analyze** — before writing any code, cross-check spec, plan and tasks for consistency: every requirement covered by a module and a task, no task without a requirement, no contradiction with the constitution. Fill in `specs/NNN-feature-name/checklist.md`. Findings block implementation until resolved.
6. **Implement** — one task at a time, test first (TDD). Run the test suite and show the output before marking a task done. Stop after each task.
7. **Converge** — after the last task, audit the codebase against spec, plan and tasks: list what is implemented, what deviates and what is missing. Append the remaining work as new tasks and repeat until nothing is missing. Never assume completion.
8. **Validate** — map every requirement to its passing test in `docs/50-traceability.md`. A requirement with no test is not done, whatever the code says. Review is done by a session that did not implement the code, actively trying to refute that each requirement is met.
9. **Change** — a new or changed requirement updates the spec first, shown as a diff for approval, before any plan or code changes.

**Fast lane (proportionality)** — a change that adds no requirement, touches no public contract and fits in one task with existing test coverage (typo, small bug fix, doc fix) may skip spec and plan: one task with a `Done when:` line and a test. Anything larger follows the full cycle. When in doubt, full cycle.

## Session handoff (mandatory)

Agent context is disposable; documents are not. Before ending a session, when context runs low, and after closing each task: write the current state into `tasks.md` and `spec.md` (what is done, what is verified, what is next, what is blocked). The next session starts by reading `docs/` and the active spec — never from memory of a previous session.

## Diagrams

Design documents carry their diagrams as Mermaid blocks and both are updated in the same commit:

- `docs/20-architecture.md`: layer/component diagram (`flowchart` or C4).
- `docs/21-data-model.md`: entity-relationship diagram (`erDiagram`) kept in sync with the actual schema.
- `specs/*/plan.md`: a diagram whenever the feature adds flows or entities.

A diagram that contradicts the code is a defect in the diagram or in the code — flag it, do not ignore it.

Richer visual artifacts (whiteboards, wireframes, ER exploration) use FOSS tools with file formats that live in the repo: Excalidraw (`docs/diagrams/*.excalidraw`), draw.io (`*.drawio.svg`), or generated ER diagrams (eralchemy/mermerd from the real schema). No paid diagramming services.

## Non-negotiable architecture

Layer boundaries, strictest first:

1. **Presentation** (`src/ui/` or `frontend/`) renders and captures input. It must not calculate business figures, enforce domain rules, or reach persistence.
2. **Services** (`src/services/` or `backend/services/`) hold business logic and orchestration. This is the only layer the presentation may call.
3. **Domain** (`src/domain/`) holds entities, invariants and validation. It depends on nothing.
4. **Repository** (`src/repository/`) is the only layer that touches the database.

The presentation layer must never import from the repository or domain directly without going through services.

## Stack

Locked unless an approved ADR says otherwise: [Define specific stack, e.g. Python 3.12, FastAPI, SQLAlchemy 2.0 async, Pydantic v2, Vue 3, pytest + Hypothesis].

Do not introduce frameworks, services or dependencies as a side effect of another task.

## Quality gates

- Tests, linting and type checks run in CI on every push (`.github/workflows/ci.yml`). A red pipeline blocks the task that broke it.
- Minimum coverage on domain and service logic: [e.g. 80%].
- Dependencies: prefer FOSS with permissive licenses; record any copyleft or paid dependency as an ADR before adding it.
- Never write real personal data into fixtures, tests or seed data.
- Every released change is recorded in `docs/90-changelog.md`.

## Working rules

- Smallest correct change. No unrelated refactors.
- One task at a time, from the active `tasks.md`. Test first.
- A task is done only when its `Done when:` criterion is verifiable and verified. Show the verification output.
- Stop and ask when a `[M]` or `[H]` task blocks progress. Never fake a credential or silently mock an external dependency.

## Language

Everything in this repository is written in English: code, identifiers, folder and file names, branches, commit messages, comments, docstrings, documentation, tests, fixtures, logs, schemas, migrations and configuration.

Two exceptions:
- End-user facing strings use the product locale ([specify, e.g. Spanish]).
- Local legal and tax terms with no exact English equivalent (e.g. `NIF`, `IRPF`) keep their original form as values or constants, with an English comment explaining them.

## Commits

Conventional Commits, subject in English: `<type>(<scope>): <description>`.
Contract breaks use `!`. No dates in the message. Never commit or push unless explicitly asked.
