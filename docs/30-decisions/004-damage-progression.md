# ADR 004: Damage, Health, and Progression System

**Status:** Approved
**Date:** 2026-09-02

## Context
The game needs a difficulty curve to remain engaging. A single enemy type that deals random damage or 1-hit-kills the player feels either too punishing or too repetitive. We need a systematic way to manage health, damage, and enemy variety without relying on jump scares.

## Decision
1. **Health System:** The player has a maximum of 3 health points (Pips). When health reaches 0, the game resets to Level 1.
2. **Enemy Archetypes:** 
   - **Tracker:** Medium speed, 1 damage. Persistent chase.
   - **Stalker:** Fast speed, 1 damage. Patrols a small area, aggressive chase if the player gets close.
   - **Tank:** Slow speed, 2 damage. Enormous size, relentless. 
3. **Progression:** The `buildLevel` function dynamically assigns enemy types based on the current level. Early levels only have Trackers. Tanks appear at level 5+.

## Consequences
- **Positive:** Clear tension curve. Predictable mechanics allow players to strategize based on enemy types (e.g., avoid the Tank, outrun the Stalker). 
- **Negative:** Hardcoding the progression in `level.ts` can become messy if the game scales to dozens of enemy types, but for a 3-enemy scoped browser game, it is the most efficient approach.
