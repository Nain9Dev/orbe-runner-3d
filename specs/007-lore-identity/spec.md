# Spec 007: Lore, Identity & Coyote Time

## Requirements

- **REQ-007.1**: The game shall establish a narrative identity documented in `docs/20-lore.md` defining the protagonist as "Lúmen", the enemies as "Sombras", and the collectibles as "Fragmentos de Estrella".
- **REQ-007.2**: The main UI (`index.html`) shall reflect this narrative in its titles, descriptions, and HUD (e.g., displaying "Fragmentos" instead of "Orbes").
- **REQ-007.3**: The `docs/00-charter.md` shall be updated to include the game's established identity and lore.
- **REQ-007.4**: To fix the inferred jump issue ("sometimes it doesn't jump"), the player physics shall implement "Coyote Time" (allowing the player to jump for a few frames after walking off a ledge).
