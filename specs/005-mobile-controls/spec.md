# Spec 005: Mobile Touch Controls

## Requirements

- **REQ-005.1**: When running on a touch-enabled device, the system shall provide on-screen virtual controls for movement (joystick) and jumping (button).
- **REQ-005.2**: When the user drags a finger on the left side of the screen, the system shall translate the vector into WASD inputs for the player character.
- **REQ-005.3**: When the user drags a finger on the right side of the screen, the system shall translate the movement into mouse delta inputs for camera rotation.
- **REQ-005.4**: When the user taps the virtual jump button, the system shall trigger the 'Space' key action to jump.
- **REQ-005.5**: If the user is on a desktop device (no touch), the system shall hide the virtual controls entirely.

## Out of Scope
- Gamepad/controller support.
- Gyroscope support.
