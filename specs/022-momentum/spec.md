# Spec 022: Momentum & Physical Mechanics

## Motivation
The game was starting to feel static and repetitive. By introducing momentum mechanics (Dash, Combo Multiplier) and environmental hazards (Crumbling Platforms), we add a layer of skill, speedrunning capability, and adrenaline to the gameplay loop.

## Requirements (EARS)

- **[REQ-022.01]** The system SHALL provide a Dash mechanic bound to the `Shift` key.
- **[REQ-022.02]** WHEN the player initiates a Dash, the system SHALL apply a forward velocity impulse of 35 units and enforce a 1.5-second cooldown.
- **[REQ-022.03]** WHEN the player collects an orb, the system SHALL increment the Combo Counter.
- **[REQ-022.04]** The system SHALL apply a global speed multiplier up to +30% based on the current Combo Counter.
- **[REQ-022.05]** IF 3 seconds pass without collecting an orb, the system SHALL reset the Combo Counter to zero.
- **[REQ-022.06]** The system SHALL spawn unstable "Crumbling Platforms".
- **[REQ-022.07]** WHEN a player steps on a Crumbling Platform, the system SHALL destroy the platform after a short delay, creating a pit.

## Data Model Updates
- `world.state.combo`: Number of consecutively collected orbs.
- `world.state.comboTimer`: Time remaining until combo resets.
- Entity `crumbling`: Tag for unstable platforms.
- Component `player.dashCooldown`: Tracks the 1.5s dash cooldown.

## Architecture
These mechanics are integrated into the existing ECS architecture.
- `physics.ts`: Handles the destruction of `crumbling` platforms.
- `game.ts`: Manages the `comboTimer` and score multipliers.
- `player.ts`: Handles input and applies physics impulses for the Dash.
