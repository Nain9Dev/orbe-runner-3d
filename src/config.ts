/**
 * Every number you can turn without opening the engine.
 *
 * Changing how the game *feels* should be editing this file and nothing else.
 * The intent behind each value — and the arithmetic that ties them together —
 * is documented in `docs/22-game-design.md`; if you change one here, update the
 * feel table there in the same commit.
 */
export const CONFIG = {
  world: {
    gravity: -20,
    arenaSize: 40,     // side of the square floor
    wallHeight: 3,

    /**
     * Gravity is not symmetric. A jump that rises and falls at the same rate
     * reads as floaty; multiplying gravity on the way down makes the arc snap
     * without shortening the hang time at the top, which is where the player
     * actually aims. Classic platformer trick, and the reason the arc maths in
     * `src/domain/jump-arc.ts` takes a fall multiplier.
     */
    fallGravityMultiplier: 1.55,
    /** Gravity near the apex, where a moment of hang time buys aim time. */
    apexGravityMultiplier: 0.72,
    /** |velocity.y| below this counts as "at the apex". */
    apexThreshold: 3.2,

    /**
     * Below this height a body has fallen out of the Ciclo.
     *
     * It used to be -25, which is a full 1.7 s of falling before anything
     * happened — long enough that the player has already registered the mistake
     * and is just waiting for the game to agree with them.
     */
    voidY: -12,
  },

  audio: {
    muted: false,
  },

  graphics: {
    lowQuality: false,
    /**
     * Camera shake. On by default because impact needs weight, but exposed as a
     * setting: shake is a common motion-sickness trigger and a game nobody can
     * play for ten minutes is not a game.
     */
    shake: true,
  },

  physics: {
    /** Solver passes per sub-step. Three is enough to settle corners and stacks. */
    iterations: 3,
    /** Hard cap on integration sub-steps, so a pathological frame cannot stall. */
    maxSubSteps: 4,
    /**
     * A body may not advance more than this fraction of its own radius per
     * sub-step. At the dash speed (34 u/s) that yields two sub-steps at 60 Hz,
     * which is what stops the dash tunnelling through the 1 u perimeter walls.
     */
    maxTravelPerStep: 0.5,
    /**
     * Grace period after losing floor contact during which a body still counts
     * as grounded. Removes the grounded/airborne flicker when running down
     * stairs or across the seam between two platforms.
     */
    groundStickTime: 0.08,
  },

  player: {
    speed: 14,
    airControl: 0.75,  // 0 = no air steering, 1 = as responsive as the ground
    jump: 12.5,
    radius: 0.6,
    lives: 3,          // maximum Integridad del Núcleo, in core layers
    respawnInvuln: 1.5,
    startGrace: 3,
    color: 0x6ee7ff,   // cyan by default

    /** Jump pressed this long before landing still fires on the landing frame. */
    jumpBuffer: 0.14,
    /** Coyote time, in seconds — frame-rate independent by construction. */
    coyoteTime: 0.11,
    /** Releasing jump mid-rise cuts upward velocity to this fraction. */
    jumpCutFactor: 0.42,

    dash: {
      speed: 34,
      /** Seconds of suspended gravity, locked velocity and invulnerability. */
      time: 0.2,
      /** Seconds before the next dash, counted from the end of the current one. */
      cooldown: 0.85,
      /** Dashes allowed per airborne period; landing restores the budget. */
      airDashes: 1,
      /** Upward nudge so a ground dash clears small lips. */
      lift: 2.0,
    },
  },

  camera: {
    distance: 6.8,
    height: 2.9,
    sensitivity: 0.0022,
    pitchMin: -0.5,
    pitchMax: 1.1,
    smooth: 12,
    fov: 68,
    /** FOV while time is dilated (Cámara Lenta) or while dashing. */
    fovDash: 78,
    fovSlow: 88,
  },

  enemy: {
    speed: 4.5,
    radius: 0.7,
    aggroRange: 24,
    /**
     * No hostile action may start with less warning than this. It is the single
     * number that separates "hard" from "unfair": every archetype's telegraph
     * state is clamped to at least this long.
     */
    telegraphFloor: 0.45,
    /** Seconds a Sombra stays stunned after an Impulso connects. */
    stunTime: 1.1,
  },

  pickup: {
    radius: 0.55,
    spin: 2.2,
    /** Value of a Fragmento on the critical path. */
    pathValue: 1,
    /** Value of a Fragmento placed somewhere that costs a risk to reach. */
    riskValue: 3,
  },

  level: {
    /**
     * Fraction of the theoretical jump reach the composer is allowed to spend
     * on a gap. At 1.0 every jump would be frame-perfect from a full run-up.
     *
     * Measured against the running game: the analytic model in
     * `src/domain/jump-arc.ts` predicts a 15.8 u flat jump and the engine
     * actually delivers 17.8, because the model deliberately ignores apex hang
     * time and air acceleration. The model therefore under-reports by ~12 %,
     * which means 0.70 here spends about 62 % of the real reach — demanding
     * enough to require a run-up, forgiving enough to survive a late input.
     */
    reachSafety: 0.70,
    /** High-intensity chunks allowed back to back before a rest chunk is forced. */
    maxTensionRun: 2,
    /** Chunks per Ciclo: grows with the Ciclo number, capped so runs stay short. */
    minChunks: 4,
    maxChunks: 9,
  },

  /** Infinite progression: everything the Ciclo number decides. */
  levelSpec: (n) => ({
    orbs: 5 + Math.floor(n * 2.5),
    // Exponential with an asymptotic cap so memory never blows up.
    enemies: Math.min(Math.floor(2 + Math.pow(n, 1.2)), 30),
    chunks: Math.min(
      CONFIG.level.minChunks + Math.floor(n * 0.6),
      CONFIG.level.maxChunks,
    ),
    // Asymptotic top speed: starts at 4.5, caps near 16.5.
    enemySpeed: CONFIG.enemy.speed + (12 * (1 - Math.exp(-n * 0.1))),
    arenaScale: Math.min(1 + (n * 0.08), 2.5),
  }),
};

/**
 * Note for anyone returning to older notes: `CONFIG.level` used to *be* the
 * progression function. It is now the composer's tuning block, and the function
 * moved to `CONFIG.levelSpec(n)`. There is deliberately no callable alias — a
 * silent shim would hide the rename from console mods instead of failing loudly.
 */

/** Arc parameters for the domain layer, assembled from the tuning above. */
export function arcParams() {
  return {
    gravity: Math.abs(CONFIG.world.gravity),
    jump: CONFIG.player.jump,
    speed: CONFIG.player.speed,
    fallMultiplier: CONFIG.world.fallGravityMultiplier,
  };
}
