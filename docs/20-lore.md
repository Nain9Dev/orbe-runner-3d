# Lore bible — Lúmen and the Void

Status: **Approved** (naming contract) · Covers REQ-024.43

This document is the **naming contract** for the product. Every string a player can
read — menu, HUD, toast, Registro, page title, share preview — resolves to a term defined
here. If a word is not in §8, it does not appear on screen.

It is also, deliberately, more than a glossary. A runner where you collect points and
avoid cubes is a spreadsheet with a camera. The point of the fiction is that it gives
every number on screen a reason to be the number it is: why health is *layers*, why
falling costs a streak instead of a life, why the dash both saves you and kills things.
Where a mechanic and the fiction disagree, the mechanic wins and this document is the
defect — flag it rather than bending the game to the story.

> **Language note.** The repository is written in English. The terms in **bold Spanish**
> below are product strings and are reproduced exactly as the player sees them; they are
> values, not identifiers. The code identifier for each one is in §8.

---

## 1. The premise, in one paragraph

The universe ran out of light before it ran out of space. What is left is **el Vacío** —
not darkness, which is merely the absence of a lamp, but a region where the rules that
let light *stay* light have stopped applying. Stars did not go out; they came apart, and
their pieces are still falling. **Lúmen** is the last spark that has not come apart yet.
It cannot fight, it cannot heal, and it cannot stop: it can only cross one **Ciclo**
after another, gathering enough of the fallen to hold itself together for one more.

---

## 2. Lúmen — the protagonist

**Lúmen** is a coherent spark: a core of light wrapped in a shell that keeps it coherent.
It has no face by design and every expression by accident — the shell rolls, the core
pulses, the antenna reacts, and the player reads emotion into it. That is cheaper and
more durable than a face.

### 2.1 The Núcleo

Lúmen's health is not a bar of hit points. It is the **Núcleo**, and the Núcleo is built
in **capas** — layers. Three of them, by default.

- A layer is not damaged. It is **lost**: it comes apart and does not come back on its own.
- Losing a layer does not slow Lúmen down. It makes it *less able to survive being wrong
  again*. The cost is future tolerance, not present capability — which is exactly why the
  meter shows a count of layers and not a percentage (see
  [23-interface.md](23-interface.md) §3).
- At one layer, Lúmen is **crítico**. The interface says so loudly and does not stop
  saying it.
- At zero layers the spark stops being coherent. The run ends: *«El núcleo se ha apagado.»*

### 2.2 Frecuencia

The player picks Lúmen's colour in the settings. In fiction that is its **frecuencia** —
which band of the old spectrum this particular spark came from. It is cosmetic, and the
one place the game lets the player say something about themselves, so it propagates
everywhere it can: the model, the light it casts, the trail, and the fill of the
integrity meter.

### 2.3 What Lúmen cannot do

Stated explicitly, because the absence is the design:

- **It cannot attack.** There is no attack button. The only offence in the game is the
  Impulso, and using it offensively costs you the ability to use it defensively.
- **It cannot heal.** Nothing in a Ciclo restores a layer. The Escudo prevents a loss; it
  never undoes one.
- **It cannot stop.** Standing still is legal and always wrong.

---

## 3. El Impulso — the one verb

**El Impulso** is a short sideways step through space rather than through time: for two
tenths of a second Lúmen is *not quite here*, which is why nothing can touch it and why
it passes straight through anything not solid enough to hold its shape.

Mechanically this is one verb doing three jobs, and that is the whole reason the game has
a shape:

| Use | What it costs |
| :--- | :--- |
| **Cross** a gap you could not jump | the cooldown, which you may want for the next gap |
| **Dodge** through an attack you cannot outrun | the cooldown, and being where the attack was |
| **Shatter** a fragile Sombra in your way | the cooldown, and having chosen offence over escape |

There is only ever one Impulso available, and the ring around the reticle is the entire
tactical layer of the game: *do I spend it on the ground I want, the hit I fear, or the
Sombra I resent?*

---

## 4. Las Sombras — the antagonists

The **Sombras** are not creatures and not machines. They are the Vacío's answer to the
question "what shape does something take if its only purpose is to stop light from
travelling". Each archetype is a different answer.

They share one law, and it is a design law before it is a fiction one: **a Sombra always
announces itself before it commits.** The Vacío does not need to be sly. It has already
won everywhere else. Mechanically, every archetype telegraphs for at least 0.45 s before
anything that can hurt you (`CONFIG.enemy.telegraphFloor`), which is what makes the game
hard rather than unfair.

| Name | Code | Shape | Behaviour | Fragile? |
| :--- | :--- | :--- | :--- | :--- |
| **Rastreador** | `tracker` | A hull that walks | Follows, winds up, lunges. The archetype the early Ciclos are made of. | Yes |
| **Acechante** | `stalker` | Small, fast, hovering | Orbits at striking distance, commits to one straight strike, then retreats to recharge. | Yes |
| **Coloso** | `tank` | Heavy, slow, grounded | Crouches for three quarters of a second, leaps, and detonates the ground where it lands. | **No** |
| **Centinela** | `turret` | Anchored, hovering | Never moves. Sweeps, locks on, fires. Owns the Corredor Vigilado. | **No** |
| **Interceptor** | `interceptor` | An arrowhead | Hangs still, aims, then crosses the whole space in a straight line. | Yes |
| **Devorador** | `boss` | Enormous | Presides over every fifth Ciclo. Three phases. Nine layers. | **No** |

### 4.1 Fragility is the whole roster design

**Fragile** Sombras shatter on contact with an Impulso. Non-fragile ones only get
stunned, and take several Impulsos to break. That single flag does all the work:

- Early Ciclos are stocked with Rastreadores because they are the archetype that
  *teaches* the trick — the first time a player dashes into one out of panic and it
  breaks, the game has explained its own combat system without a tutorial.
- The Coloso and the Centinela exist to answer "what if I just dash through everything".
  They are the two archetypes that punish that answer.
- The Devorador is nine connected Impulsos. Every boss fight is an exam in the one verb.

### 4.2 The Devorador's three phases

| Phase | Integrity | Move set | Idea |
| :--- | :--- | :--- | :--- |
| I | 9 – 7 | Pursuit and slams | Learn the slam telegraph |
| II | 6 – 4 | Slams plus radial volleys | Space is no longer safe by default |
| III | 3 – 1 | Faster pursuit, denser volleys, shorter recovery | The windows are still there, they are just smaller |

---

## 5. Los Fragmentos de Estrella

The stars did not go out. They came apart, and the pieces are still falling. A
**Fragmento de Estrella** is one of those pieces: enough coherent light for Lúmen to
borrow. Gathering every Fragmento in a Ciclo is what opens the way to the next one.

Two tiers, and they are distinguishable across the whole arena on purpose:

| Tier | Colour | Worth | Where it is |
| :--- | :--- | :--- | :--- |
| **De ruta** | amber | 1 | On the critical path. You get these by playing. |
| **De riesgo** | violet | 3 | Never where you should be. Over a gap, past a lava pool, on a ledge that only a bounce pad reaches. |

A risk Fragmento spins faster, glows wider and throws a taller beam. It has to be
readable from far enough away that the player can decide *before* committing to the
detour — a reward you only notice once you are already dead is not a decision, it is a
trap.

---

## 6. La Resonancia

Every Fragmento and every shattered Sombra raises the **Resonancia**. While it holds,
Lúmen moves up to 30 % faster. Three seconds without feeding it and it collapses.

The fiction: borrowed light does not sit still inside a spark, it *rings*, and a ringing
spark travels further per unit of effort. The design: it is a voluntary difficulty knob
that the player turns by playing aggressively, and it is the reason to shatter a Sombra
rather than walk around it.

---

## 7. Las Balizas y el Vacío

A **Baliza de Reanclaje** is a fixed point that has not come apart yet. Lúmen can anchor
to one, and anchoring is permanent for the Ciclo. Physically they sit on the wide, safe
plateaus, which is also where the level design wants the player to breathe.

Then the rule that decides how the whole game feels:

> **El Vacío no se cobra el Núcleo. Se cobra la Resonancia.**
> Falling costs your streak and the seconds it takes to get back. It does not cost a
> layer.

This is stated as fiction — the Vacío has nothing to take from a spark that is already
falling, it simply lets go of it near the last thing that was still holding — but it was
decided as balance, against evidence. See
[30-decisions/008-void-costs-resonance.md](30-decisions/008-void-costs-resonance.md) for
the measurement that produced it.

The consequence is a contract the player learns in one Ciclo, and it is worth stating in
exactly two lines because that is how it should be teachable:

- **Sombras and plasma take the Núcleo.** Those are what you dodge.
- **The Vacío takes the Resonancia.** That is what you lose by falling.

---

## 8. Naming contract

Every user-facing string resolves to a row here. Code identifiers are English; product
strings are Spanish (`AGENTS.md`, *Language*).

| Product string (es-ES) | Code identifier | Meaning |
| :--- | :--- | :--- |
| **Lúmen** | `player` | The protagonist |
| **Núcleo** | `player.lives`, `state.integrity` | Health |
| **Integridad del Núcleo** | `state.integrity` / `state.maxIntegrity` | The health meter's label |
| **Capa de Núcleo** | one integrity segment | One point of health |
| **Frecuencia** | `CONFIG.player.color` | The player's chosen colour |
| **Impulso** | `player.dash` | The dash |
| **Resonancia** | `state.combo` | The combo |
| **Fragmento de Estrella** | `orb` / `pickup` | The collectible |
| **Fragmento de ruta** | `tier: 'path'` | Worth 1 |
| **Fragmento de riesgo** | `tier: 'risk'` | Worth 3 |
| **Luz** | `state.score` | Accumulated value, the run's score |
| **Ciclo** | `state.level` | One level |
| **Baliza de Reanclaje** | `beacon` / `checkpoint` | Checkpoint |
| **El Vacío** | the void below the route | Falling out of the Ciclo |
| **Sombra** | `enemy` | Any hostile |
| **Rastreador** | `tracker` | Archetype |
| **Acechante** | `stalker` | Archetype |
| **Coloso** | `tank` | Archetype |
| **Centinela** | `turret` | Archetype |
| **Interceptor** | `interceptor` | Archetype |
| **Devorador** | `boss` | Archetype |
| **Dron de Escolta** | `drone` / `ally` | The one friendly entity |
| **Ventaja** | `powerup` | Any temporary advantage |
| **Escudo** | `shield` | Absorbs one hit entirely |
| **Imán** | `magnet` | Draws Fragmentos in |
| **Súper Salto** | `jump` | ×1.5 jump impulse |
| **Cámara Lenta** | `time` | Dilates time to 0.4× |
| **Registro** | `registry-panel` | The in-game reference where the player can read this lore |
| **Monolito** | `monolith` | Background geometry |
| **Plasma** | `lava` | The instant-death pools |

### 8.1 Names of the authored chunks

The Ciclo composer speaks in named pieces. The names are player-facing (they appear in
the Registro and may appear in toasts) and are fixed here.

| Chunk id | Name | Idea |
| :--- | :--- | :--- |
| `anchor_bridge` | **Puente de Anclaje** | The safe walkway. Always reachable by construction. |
| `rest_beacon` | **Baliza de Reanclaje** | The exhale, and the checkpoint. |
| `spiral_ascent` | **Ascenso Espiral** | Gain height while turning. |
| `bounce_towers` | **Torres de Impulso** | Vertical play, and a prize only a pad reaches. |
| `moving_ferry` | **Transporte de Vacío** | Timing, not precision. |
| `void_leap` | **Salto del Vacío** | One long gap, with the prize over the middle of it. |
| `crumble_gauntlet` | **Sendero Efímero** | Commit or fall. The path unmakes itself behind you and re-coheres a few seconds later. |
| `plasma_ford` | **Vado de Plasma** | A narrow dry line through a wide floor. |
| `pillar_field` | **Campo de Pilares** | Small tops, no room to be sloppy. |
| `shatter_yard` | **Patio de Fractura** | Where the Impulso is a weapon. |
| `watched_corridor` | **Corredor Vigilado** | Free platforming, hostile air. |

---

## 9. Tone

Cold, spare, unsentimental. The Vacío is not evil and Lúmen is not brave; one is a
condition and the other is a physical process that has not finished yet. Nothing in the
game gloats, encourages, or congratulates in more than three words.

**Do:** *«Baliza anclada.»* · *«Sombra fracturada.»* · *«Núcleo crítico.»*
**Do not:** *«¡Genial!»* · *«¡Sigue así, campeón!»* · exclamation marks in the HUD.

The visual grammar carries the same rule: near-black grounds, one saturated accent per
meaning, and light used as information rather than decoration —

| Colour | Means |
| :--- | :--- |
| Cyan | Lúmen, solid ground, safety, a Baliza |
| Amber | A Fragmento de ruta, a moving surface, a warning |
| Violet | A Fragmento de riesgo — worth more, placed worse |
| Carmine | A Sombra, a collapsing surface, damage |
| White | The chip layer on the integrity meter: what you just lost |

---

## 10. Where the fiction touches the code

Kept here so a future change can find every place a term is asserted.

| Fiction | Enforced in |
| :--- | :--- |
| Layers, not hit points | [`src/domain/integrity.ts`](../src/domain/integrity.ts), [`src/ui/health.ts`](../src/ui/health.ts) |
| Sombras always announce themselves | [`src/systems/enemy.ts`](../src/systems/enemy.ts), `CONFIG.enemy.telegraphFloor` |
| Fragility, and therefore the whole roster | `ARCHETYPES` in [`src/game/prefabs.ts`](../src/game/prefabs.ts) |
| The Impulso is one verb with three uses | [`src/systems/player.ts`](../src/systems/player.ts), [`src/systems/triggers.ts`](../src/systems/triggers.ts) |
| The Vacío takes Resonancia, not Núcleo | `fall()` in [`src/systems/game.ts`](../src/systems/game.ts) |
| Risk Fragmentos must be readable at distance | `createOrbGem` in [`src/game/models.ts`](../src/game/models.ts) |
| Chunk names | [`src/game/chunks.ts`](../src/game/chunks.ts) |
| Every product string | [`index.html`](../index.html), [`src/ui/`](../src/ui/) |
