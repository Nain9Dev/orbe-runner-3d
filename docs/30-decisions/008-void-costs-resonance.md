# ADR 008: Falling into the Vacío costs Resonancia, not Núcleo

**Status:** Proposed
**Date:** 2026-09-08
**Spec:** 024

## Context

Spec 024 removed the infinite ground plane. Earlier Ciclos rested on a solid floor at
`y = -0.5`, which quietly cancelled the platforming: no jump could ever be missed, so no
platform ever mattered. With the floor gone, falling became a real outcome — and what it
should cost became the single most consequential balance decision in the spec.

The initial answer was the obvious one: a fall costs one layer of Núcleo, like any other
hazard.

## Evidence

A scripted agent was driven through Ciclo 1: hold forward, jump whenever grounded, dash on
cooldown, steer towards the nearest Fragmento.

| Run | Falls | Enemy contacts | Outcome |
| :--- | :--- | :--- | :--- |
| every run | 3 | **0** | ended at zero integrity |

Every run ended to the void; none ended to a Sombra. With three layers and a jumpable gap
every seven units, "a missed jump costs a third of your run" makes the void — not the
enemies — the subject of the game. And platforming mistakes are the ones a player makes
while they are still learning the arc, which is to say in the first five minutes.

## Decision

Split the two currencies:

- **Sombras and plasma take the Núcleo.** Those are what the player dodges.
- **El Vacío takes the Resonancia.** Falling resets the combo, returns Lúmen to the last
  Baliza with one second of grace, and costs no layer.

The fall still costs something real — up to 30 % movement speed and every step of a streak
that may have taken a minute to build, plus the seconds spent getting back. It is simply
not fatal.

To keep it from being tedious the void threshold moved from `y < -25` to `y < -12`: 1.1 s
of falling rather than 1.7 s, because the player has already registered the mistake and is
only waiting for the game to agree with them.

The rule is stated in two lines in the Registro and in the lore bible, because it has to be
learnable inside one Ciclo.

## Consequences

**Positive**

- Re-running the agent along the blueprint route: Ciclos 1, 2 and 4 completed with zero
  falls and 0–2 enemy hits; Ciclo 7 completed with nine falls and three hits; Ciclo 11
  ended to enemies at node 14 of 31. The escalating threat is now the Sombras, which is
  what the enemy design exists for.
- Balizas gain a purpose the player can feel.
- Learning the jump arc is free, which matters for a browser game where the first two
  minutes decide whether there is a third.

**Negative**

- A player can grind a difficult gap indefinitely at no cost to the Núcleo. Accepted: the
  Sombras keep moving, the Resonancia stays at zero, and an endless runner whose pressure
  comes from enemies rather than from retry limits is a legitimate design.
- The rule has to be taught. It is in the Registro, in the toast text
  (`VACÍO · RESONANCIA x7 PERDIDA`) and in the cyan flash that separates a fall from real
  damage.

**If this is ever reverted**, the gap count per Ciclo must come down with it. The two
numbers are coupled.
