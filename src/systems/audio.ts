import { CONFIG } from '../config.js';
import { createAudioEngine } from '../audio/engine.js';
import { createSynth } from '../audio/synth.js';
import { createClock } from '../audio/clock.js';
import { createArrangement, stepFor, noteAt, tierFor, TIERS } from '../audio/score.js';

/**
 * The audio binder: world state in, sound out, musical time back.
 *
 * It owns no Web Audio of its own — that lives in `src/audio/`, the aural
 * counterpart of `src/ui/`, which knows nothing about the ECS. This system reads
 * `world.state`, decides what the score should be doing, and publishes
 * `world.state.beat` so the models, the environment and the interface can move
 * with the music (REQ-025.11).
 *
 * That last part is the point of the whole spec. Before it, the soundtrack and
 * the game ran on separate clocks and shared nothing; one shared beat is what
 * makes them a single object rather than a demo with music over it.
 *
 * ## Scheduling
 *
 * Web Audio is scheduled ahead of time. Each frame the loop looks a lookahead
 * window into the future, emits every sixteenth that falls inside it, and lets
 * the audio thread play them at the exact sample. Frame jitter therefore never
 * reaches the groove — which is why every voice takes an explicit `time`
 * instead of reading the clock itself.
 */
export function audioSystem() {
  const engine = createAudioEngine();
  const synth = createSynth(engine);
  const clock = createClock({ bpm: TIERS[0].bpm });
  const arrangement = createArrangement();

  const LOOKAHEAD = 0.14;       // seconds of future scheduled each frame
  let nextStepTime = 0;         // audio time of the next sixteenth
  let step = 0;                 // sixteenth counter since the run started
  let playing = false;
  let tier = 0;

  // Fallback musical time for when there is no audio context at all: the world
  // still has to pulse on a muted or blocked machine (REQ-025.12).
  let silentTime = 0;

  // Footstep cadence driven by distance travelled rather than by a timer, so
  // steps stay with the legs at any speed.
  let strideAccumulator = 0;

  return {
    name: 'audio',

    init(world) {
      const at = (v) => (v ? { x: v.x, y: v.y, z: v.z } : null);
      const when = () => engine.now() ?? 0;

      world.state.audio = {
        ready: false,
        muted: CONFIG.audio.muted,
        musicVolume: CONFIG.audio.musicVolume,
        sfxVolume: CONFIG.audio.sfxVolume,
      };

      engine.setMusicVolume(CONFIG.audio.musicVolume);
      engine.setSfxVolume(CONFIG.audio.sfxVolume);
      engine.setMuted(CONFIG.audio.muted);

      world.events.on('game:start', ({ level = 1 } = {}) => {
        // Browsers only allow an AudioContext to start from a user gesture, and
        // `game:start` is always downstream of a click or a key press.
        const ok = engine.start();
        world.state.audio.ready = ok;
        clock.setLive(ok);

        tier = tierFor(level);
        arrangement.reset();
        clock.reset();
        clock.setBpm(TIERS[tier].bpm);
        engine.setMuffled(false);

        const now = engine.now();
        nextStepTime = now === null ? 0 : now + 0.06;
        step = 0;
        silentTime = 0;
        playing = true;
      });

      world.events.on('ui:message', () => engine.setMuffled(true));
      world.events.on('ui:pause', () => engine.setMuffled(true));
      world.events.on('ui:hide', () => engine.setMuffled(false));

      /* ------------------------------ events ----------------------------- */

      world.events.on('orb:collected', ({ orb, tier: t }) => {
        synth.collect(when(), t === 'risk', at(orb?.transform?.position));
      });

      world.events.on('player:jump', (e) => synth.jump(when(), at(e?.transform?.position)));
      world.events.on('player:dash', (e) => synth.dash(when(), at(e?.transform?.position)));

      // Landing level comes from the impact speed physics records, so a drop
      // from a Torre de Impulso lands like one (REQ-025.15).
      world.events.on('player:landed', (e) => {
        const impact = Math.min(1, (e?.body?.impactSpeed ?? 0) / 22);
        if (impact < 0.06) return;
        synth.land(when(), impact, at(e?.transform?.position));
      });

      world.events.on('player:damaged', ({ shielded, critical }) => {
        if (shielded) { synth.shielded(when()); return; }
        synth.hurt(when(), (world.state.integrity ?? 1) <= 0);
        if (critical) engine.setBrightness(0.25);
      });

      world.events.on('player:voided', () => synth.voided(when()));
      world.events.on('player:anchored', ({ at: pos }) => synth.anchor(when(), at(pos)));

      world.events.on('enemy:telegraph', ({ at: pos }) => synth.telegraph(when(), at(pos)));
      world.events.on('enemy:fired', ({ at: pos }) => synth.fire(when(), at(pos)));
      world.events.on('enemy:shattered', ({ at: pos }) => synth.shatter(when(), at(pos)));
      world.events.on('enemy:shockwave', ({ at: pos }) => synth.shockwave(when(), at(pos)));
      world.events.on('projectile:impact', ({ at: pos }) => synth.impact(when(), at(pos)));
      world.events.on('platform:collapsed', (p) => synth.collapse(when(), at(p?.transform?.position)));

      world.events.on('game:levelup', () => synth.levelUp(when(), TIERS[tier].root));
      world.events.on('game:over', () => { playing = false; engine.setMuffled(true); });
      world.events.on('ui:click', ({ up = true } = {}) => synth.ui(when(), up));

      world.events.on('audio:settings', ({ muted, musicVolume, sfxVolume } = {}) => {
        if (muted !== undefined) { engine.setMuted(muted); world.state.audio.muted = muted; }
        if (musicVolume !== undefined) { engine.setMusicVolume(musicVolume); world.state.audio.musicVolume = musicVolume; }
        if (sfxVolume !== undefined) { engine.setSfxVolume(sfxVolume); world.state.audio.sfxVolume = sfxVolume; }
      });
    },

    update(world, dt) {
      const player = world.first('player');

      /* ---------------------------- intensity ---------------------------- */

      const intensity = arrangement.update({
        combo: world.state.combo ?? 0,
        threat: nearestThreat(world, player),
        integrity: world.state.integrity ?? 3,
        maxIntegrity: world.state.maxIntegrity ?? 3,
        speed: world.state.playerSpeed ?? 0,
        maxSpeed: CONFIG.player.speed,
      }, dt);

      clock.setIntensity(intensity);
      clock.setBpm(arrangement.bpmFor(tier));

      /* ------------------------------ clock ------------------------------ */

      // Real audio time when there is any; otherwise an accumulated fallback,
      // which keeps the world pulsing on a muted or blocked machine.
      const audioNow = engine.now();
      let source;
      if (audioNow !== null) {
        source = audioNow;
      } else {
        silentTime += Math.max(0, dt);
        source = silentTime;
      }

      world.state.beat = clock.advance(source);
      world.state.audio.ready = engine.running;

      if (!playing || world.state.status !== 'playing') return;

      /* --------------------------- live mixing --------------------------- */

      const speedRatio = Math.min(1, (world.state.playerSpeed ?? 0) / CONFIG.player.speed);
      engine.setBrightness(0.35 + speedRatio * 0.65);

      const camera = world.state.three?.camera;
      if (player && camera) {
        engine.setListener(
          camera.position.x, camera.position.y, camera.position.z,
          player.transform.position.x - camera.position.x,
          player.transform.position.y - camera.position.y,
          player.transform.position.z - camera.position.z,
        );
      }

      footsteps(player, dt);

      /* ---------------------------- scheduling --------------------------- */

      if (audioNow === null || !engine.running) return;
      const stepSeconds = clock.beatSeconds() / 4;

      // Recover from a long gap (a hidden tab) instead of replaying every missed
      // sixteenth at once, which would arrive as a burst of noise.
      if (nextStepTime < audioNow - 0.5) nextStepTime = audioNow + 0.02;

      while (nextStepTime < audioNow + LOOKAHEAD) {
        schedule(step, nextStepTime, stepSeconds);
        nextStepTime += stepSeconds;
        step++;
      }
    },
  };

  /* -------------------------------------------------------------------- */

  /** Emits one sixteenth of the arrangement at `time`. */
  function schedule(index, time, stepSeconds) {
    const s = stepFor(index);
    const level = 0.75 + arrangement.value() * 0.35;

    if (s.kick) {
      synth.kick(time, level);
      // The duck is scheduled with the kick rather than reacted to, which makes
      // it sample-accurate and free. See ADR-011.
      engine.duck(time, 0.36 + arrangement.value() * 0.16, stepSeconds * 4);
    }

    if (s.snare && arrangement.isActive('hat')) synth.snare(time, level);
    if (s.hat && arrangement.isActive('hat')) synth.hat(time, level * 0.9, index % 8 === 7);
    if (s.ride && arrangement.isActive('ride')) synth.ride(time, level * 0.7);

    if (s.bass !== null && s.bass !== undefined) {
      synth.bass(time, noteAt(tier, s.bass, -1), stepSeconds * 1.6, level);
    }

    if (arrangement.isActive('arp') && s.arp !== null && s.arp !== undefined) {
      synth.arp(time, noteAt(tier, s.arp), stepSeconds * 0.9, level * 0.9);
    }

    if (arrangement.isActive('lead') && s.lead !== null && s.lead !== undefined) {
      synth.lead(time, noteAt(tier, s.lead), stepSeconds * 2.2, level);
    }

    if (arrangement.isActive('pad') && s.downbeat) {
      synth.pad(time, noteAt(tier, 0, -1), stepSeconds * 15, 0.8 + arrangement.value() * 0.5);
    }
  }

  /**
   * Footsteps by distance travelled rather than by a timer (REQ-025.16): a
   * stride is a distance, so a slow Lúmen takes slow steps and a fast one takes
   * fast ones without anybody tuning a rate.
   */
  function footsteps(player, dt) {
    if (!player || !player.body.grounded) { strideAccumulator = 0; return; }
    const speed = Math.hypot(player.body.velocity.x, player.body.velocity.z);
    if (speed < 1.5) { strideAccumulator = 0; return; }

    strideAccumulator += speed * dt;
    if (strideAccumulator < 2.6) return;

    strideAccumulator -= 2.6;
    const now = engine.now();
    if (now === null) return;
    synth.step(now, Math.min(1, speed / CONFIG.player.speed), player.transform.position);
  }
}

/** Distance to the nearest Sombra, for the intensity model. */
function nearestThreat(world, player) {
  if (!player) return Infinity;
  let best = Infinity;
  for (const e of world.query('enemy', 'transform')) {
    const d = player.transform.position.distanceTo(e.transform.position);
    if (d < best) best = d;
  }
  return best;
}
