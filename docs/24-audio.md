# Audio contract

Status: **Draft** · Covers REQ-025.01 … REQ-025.18

`src/audio/` is the **aural presentation layer**: the exact counterpart of `src/ui/`. It
owns the Web Audio graph, it knows nothing about the ECS, and the binder in
`src/systems/audio.ts` is the only thing that talks to both.

Everything is synthesised at runtime. There is not one byte of audio in the repository,
and there never will be — the charter's "instant load" pillar and the FOSS/zero-cost rule
both point the same way.

---

## 1. The graph

```
   music voices ─┬─► musicBus ──► duck ──► lowpass ──┐
                 │                  ▲                 │
                 │            scheduled with          ├─► master ─► limiter ─► out
                 │              every kick            │
   sfx voices ───┼─► sfxBus ───────────────────────── ┤
   ui voices ────┼─► uiBus ─────────────────────────  ┘
                 │
                 ├─► reverbSend ─► convolver (generated IR) ─► master
                 └─► delaySend ──► delay ─► tone ─► feedback ─┘
```

| Node | Why it is there |
| :--- | :--- |
| Three buses | The SFX cues are a *fairness feature* (ADR-012). A player who turns the music down must keep them, so they cannot share a fader. The UI bus is separate again so a click is never ducked or muffled. |
| `duck` | There is no sidechain input in Web Audio. The duck is gain automation scheduled alongside each kick, which is sample-accurate and free. |
| `lowpass` | Opens with Lúmen's speed: moving fast literally sounds brighter (REQ-025.17). Also the "muffle" used for pause and death, so silence is never abrupt. |
| `limiter` | A boss volley over a landing over a shatter would otherwise clip. Slow release, high ratio — inaudible until it works. |
| Convolver | A room in eight lines: exponentially decaying noise as an impulse response. No external asset, and it sounds like a space. |
| Delay | Dotted-eighth with a filtered feedback path. The synthwave staple, and it is what makes the arpeggio sit in the mix. |

---

## 2. Voices

Every sound is oscillators plus one shared white-noise buffer, generated once.

| Voice | Construction |
| :--- | :--- |
| Kick | Sine with a collapsing pitch envelope, plus a high-passed noise click for the beater |
| Snare | Triangle body plus band-passed noise |
| Hat / ride | High-passed noise, very short (open hats and the ride are longer) |
| Bass | Two detuned saws through a resonant low-pass that closes over the note |
| Arp | Square two octaves up, heavy on the delay send |
| Lead | Three detuned saws, soft attack, heavy on the reverb |
| Pad | Three triangles at 1 / 1.5 / 2, long swell, mostly reverb |
| SFX | Frequency sweeps and filtered noise bursts |

Two conventions, and both matter:

- **Every voice takes an explicit `time`.** Music is scheduled ahead of the audible clock.
  Passing `currentTime` from the caller would put every note wherever the frame landed,
  which is the difference between a groove and a stumble.
- **Every voice takes an explicit destination.** The caller decides the bus, and whether
  the sound comes from a place in the world. Spatialisation is a property of the *call*,
  not of the voice.

### 2.1 Percussion is noise, not a square wave

The previous hi-hat was a 400 Hz square oscillator, which is a tone. One shared noise
buffer, filtered per voice and started at a random offset so repeated hits differ, is both
cheaper and correct.

---

## 3. The adaptive score

### 3.1 Intensity

A single scalar in 0..1, smoothed, from four inputs:

| Input | Weight | Reasoning |
| :--- | :--- | :--- |
| Resonancia streak | 0.35 | The player's own aggression |
| Nearest Sombra (26 u → 6 u) | 0.40 | The dominant term; being cornered is the tense thing |
| Núcleo missing | 0.15 | A worn-down run should sound worn down |
| Speed | 0.10 | A trickle, so movement colours the mix without driving it |

**No single input can saturate the mix**, which is asserted in `tests/score.test.ts`. A
player at maximum Resonancia in an empty stretch must not get the same music as a player
being cornered.

**One exception**: at one layer of Núcleo, intensity floors at 0.8 regardless of
everything else. The player should hear that they are about to lose.

Rising is faster than falling (1.6 vs 0.55): danger arrives promptly and leaves
reluctantly, which is also how the player experiences it.

### 3.2 Layers

| Layer | On at | Off at |
| :--- | :--- | :--- |
| Bass, kick | always | — |
| Hat, snare | 0.18 | 0.12 |
| Pad | 0.30 | 0.22 |
| Arp | 0.38 | 0.30 |
| Lead | 0.62 | 0.52 |
| Ride | 0.78 | 0.68 |

The gap between `on` and `off` is hysteresis. Without it a player hovering at a boundary
makes the arrangement flap several times a second, which is far more distracting than
either state.

### 3.3 Key per tier

Each palette tier gets its own root and mode, so a change of Ciclo band is audible as well
as visible (REQ-025.09). Names are the ones in the lore bible.

| Tier | Ciclos | Name | Root | Mode | Base BPM |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | 1–3 | Neón | A 220 Hz | minor pentatonic | 132 |
| 1 | 4–6 | Abismo | G 196 Hz | phrygian-flavoured | 138 |
| 2 | 7–9 | Radiación | B 246.94 Hz | major pentatonic | 144 |
| 3 | 10+ | Carmesí | F 174.61 Hz | unstable (♭2, ♭5) | 150 |

Tempo follows intensity within **±8 %**. Wider than that and the track stops being the
same track.

Patterns are written in **scale degrees**, not frequencies, which is what lets one pattern
work in four keys.

---

## 4. The beat clock

The contract that ties the music to everything else. Full reasoning in
[ADR-011](30-decisions/011-shared-musical-clock.md).

```ts
world.state.beat = { bar, beat, sixteenth, phase, pulse, downbeat, bpm, intensity, live }
```

| Consumer | Uses |
| :--- | :--- |
| Lúmen's model | Core emissive, halo, lamp — `pulse` |
| Sombra models | Aura opacity and scale — `pulse`, scaled by aggro |
| Renderer | Bloom strength — `pulse` and `intensity`, bounded |

**Consume `pulse`, not `phase`.** `phase` is a sawtooth and reads as a stutter.

**Always add a bounded fraction to a fixed base, never multiply.** Bloom is the one effect
that can hide a platform edge, and platform edges are how the player knows where to land.

The clock runs on `AudioContext.currentTime` when there is one and on an accumulated
fallback when there is not, so a muted or blocked browser still has a pulsing world.

---

## 5. Physics ↔ audio

| Physical fact | Audible consequence |
| :--- | :--- |
| `body.impactSpeed` on landing | Landing level scales with it, so a drop from a Torre de Impulso lands like one |
| Horizontal speed | Music low-pass opens; footstep cadence |
| Distance travelled while grounded | A footstep every 2.6 units — a stride is a distance, not a timer |
| Dash | Descending whoosh plus a noise burst |
| World position of a Sombra, bolt or Fragmento | Panned and attenuated; the listener follows the camera |

`impactSpeed` exists for exactly one frame — the solver cancels the downward velocity and
one frame later the information is gone — which is why physics records it rather than
letting the audio layer try to infer it.

---

## 6. Spatialisation

One `PannerNode` per *sound*, created with the voice and collected with it, so the live
panner count is bounded by the voice count. `HRTF`, inverse distance, reference 6 u,
maximum 90 u.

This is why a Centinela locking on from the left is heard on the left, which is the
channel of ADR-012 that covers "the player is looking somewhere else".

---

## 7. Failure

No audio failure may interrupt the simulation (REQ-025.05). A missing or blocked
`AudioContext` leaves the engine inert: `engine.now()` returns `null`, the clock falls
back, every voice returns early, and the game plays silently at full speed.

Browsers only allow an `AudioContext` to start from a user gesture. `game:start` is always
downstream of a click or a key press, which is where `engine.start()` is called from.

---

## 8. Settings

| Setting | Key | Default |
| :--- | :--- | :--- |
| Music volume | `orbi_music` | 0.7 |
| Effects volume | `orbi_sfx` | 0.9 |
| Mute | `orbi_mute` | false |

Two sliders, not twelve.

> **A note that cost a bug.** `Number('')` is `0`, which is finite and inside the valid
> range — so a naive read of an empty store starts a first-time player in silence. The
> parser checks for an empty string explicitly, and `tests/hud.test.ts` covers it.
