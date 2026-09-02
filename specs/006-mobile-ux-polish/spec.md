# Spec 006: Mobile UX Polish & Jump Fix

## Requirements

- **REQ-006.1**: The system shall properly register all touch event listeners using `passive: false` where required to prevent mobile browsers from dropping inputs.
- **REQ-006.2**: When a user taps the right zone of the screen (touch duration < 300ms, total displacement < 10px), the system shall interpret this gesture as a Jump (`Space` key action).
- **REQ-006.3**: The on-screen jump button shall be visually enlarged and feature an upward arrow icon (⬆️) for clearer UX.
- **REQ-006.4**: The system shall guarantee jump event capture regardless of frame timing by instantly emitting the jump event or locking the virtual key state for at least one game frame.
