# Requirements

Status: Draft

Stable functional requirements, written in EARS notation. Feature-level detail lives in `../specs/NNN-*/spec.md`; this file holds the consolidated, product-wide list.

EARS patterns:
- Event-driven: `When <trigger>, the system shall <response>.`
- State-driven: `While <state>, the system shall <response>.`
- Unwanted behaviour: `If <condition>, then the system shall <response>.`
- Ubiquitous: `The system shall <response>.`

| ID | Requirement | Source spec | Status |
| :--- | :--- | :--- | :--- |
| REQ-001 | The system shall maintain 60 FPS on modern browsers and mobile devices. | Charter | Approved |
| REQ-002 | The system shall be playable with a single click at `https://orbe.naindev.com/` without downloads or backend latency. | Charter | Approved |
| REQ-003 | When accessed from a mobile device, the system shall support touch controls. | Charter | Approved |
| REQ-004 | The system shall prevent blocking bugs to maintain a 100% zero-bug playable state in the main branch. | Charter | Approved |
