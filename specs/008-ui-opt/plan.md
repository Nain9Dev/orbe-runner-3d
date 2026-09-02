# Plan 008: UI Opt & Config

## Architectural Changes

1. **Framework Decision**
   - Retain Vanilla HTML/CSS/TS to preserve the strict 0-latency and lightweight bundle size required by `00-charter.md`.

2. **Settings Logic (`src/systems/hud.ts`, `src/config.ts`)**
   - Read `orbi_mute` and `orbi_gfx` from localStorage at boot.
   - Attach click listeners to new UI toggles.
   - Dispatch custom UI events (`ui:mute_changed`, `ui:gfx_changed`) when settings change, or just update `CONFIG` and let systems read it.
   - Actually, using `CONFIG.audio.muted` and `CONFIG.graphics.lowQuality` is easier. We will update `CONFIG` dynamically.

3. **Audio Master Node (`src/systems/audio.ts`)**
   - Create a `MasterGain` node on `AudioContext` init.
   - Connect all procedural oscillators to `MasterGain` instead of `ctx.destination`.
   - Toggle `MasterGain.gain.value = 0` (muted) or `1` (unmuted) based on `CONFIG.audio.muted`.

4. **Render Optimization (`src/systems/render.ts`)**
   - If `CONFIG.graphics.lowQuality` is true, disable shadows and reduce pixel ratio to 1.
   - If false, enable soft shadows and use `Math.min(devicePixelRatio, 2)`.
