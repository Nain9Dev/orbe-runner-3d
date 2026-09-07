# Changelog

Relevant changes, newest first. Format: `## [version] - YYYY-MM-DD` with Added / Changed / Fixed / Removed sections.

## [Unreleased]

### Fixed

- Remove artificial arena boundary clamp in physics integration allowing unbounded movement along runner track.
- Restore responsive air control acceleration so airborne jumps do not stall player forward velocity.
- Remove horizontal camera bounds clamping to follow player continuously along the track.
- Divide northern perimeter wall in level builder to keep bridge entrance unblocked.
- Support headless execution without 2D canvas context in noise texture generator.
- Upgrade visor material to MeshPhysicalMaterial to eliminate Three.js clearcoat warning.

### Added

- Initial project structure.
