# Spec 023: Cyber Polish & Procedural Audio

## Motivation
To support the intense momentum mechanics from Spec 022, the game requires high-fidelity audiovisual feedback. The "Cyber Polish" update redesigns the Hunter enemy into an aggressive wireframe model, adds a dynamic HUD, and introduces a combo-reactive procedural synthesizer.

## Requirements (EARS)

- **[REQ-023.01]** The system SHALL render the Enemy Hunter as a pulsating red wireframe cage.
- **[REQ-023.02]** The system SHALL display the current Combo multiplier prominently on the HUD.
- **[REQ-023.03]** WHEN the Combo counter is > 1, the HUD Combo element SHALL scale and pulse dynamically.
- **[REQ-023.04]** The audio system SHALL synthesize a kick drum on a 4/4 beat.
- **[REQ-023.05]** The audio system SHALL play an arpeggiator synth melody on top of the bassline.
- **[REQ-023.06]** WHEN the Combo counter is > 1, the system SHALL dynamically unmute higher-octave arpeggiator layers to increase musical tension.
- **[REQ-023.07]** The system SHALL trigger procedural SFX for Dash and Hit events via ECS events.

## Data Model Updates
- The `HUD` DOM layer now listens to `world.state.combo`.
- The `audioSystem` maintains internal references to `AudioContext` and dynamically reads `world.state.combo` during note scheduling.

## Architecture
- `hud.ts`: Receives ECS state and updates DOM CSS styles dynamically to achieve the "cyber" look (blur, neon shadows).
- `models.ts`: Updates the Three.js mesh generation to use `MeshStandardMaterial` with `wireframe: true`.
- `audio.ts`: Replaces static tracks with a fully Web Audio API-driven procedural sequencer.
