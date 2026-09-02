# Spec 008: UI Optimization, A11y & Audio Control

## Requirements

- **REQ-008.1**: The project shall avoid adding UI frameworks (React/Vue) to maintain 0-latency access and preserve raw WebGL performance.
- **REQ-008.2**: The Settings Menu shall include a "Sound" toggle to mute/unmute all game audio. The state shall persist in `localStorage` as `orbi_mute`.
- **REQ-008.3**: The Settings Menu shall include a "Graphics" toggle (High/Low) to reduce rendering overhead (shadows/resolution) on lower-end devices. State shall persist as `orbi_gfx`.
- **REQ-008.4**: UI buttons and controls in `index.html` must include standard accessibility attributes (e.g., `aria-label`).
- **REQ-008.5**: The Audio System (`audio.ts`) must support global muting via a Master Gain node.
- **REQ-008.6**: The Render System (`render.ts`) must support toggling high/low quality rendering modes.
