/**
 * Sistema de Audio Procedural.
 *
 * Genera música "Synthwave/8-bit" matemáticamente usando Web Audio API.
 * 0 bytes en texturas/MP3, carga instantánea.
 */
export function audioSystem() {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let lowPassFilter: BiquadFilterNode | null = null;
  let isPlaying = false;
  let nextNoteTime = 0;
  let currentNote = 0;
  let cachedWorld: any = null;

  // Escala pentatónica menor (A menor)
  const scale = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
  // Patrón arpegiador
  const pattern = [0, 2, 4, 2, 0, 3, 5, 3];
  
  const tempo = 140; // BPM
  const noteDuration = 60 / (tempo * 2); // octavas

  function playNote(time: number, freq: number) {
    if (!ctx || !masterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(masterGain);

    // Envolvente rápida percusiva (synthwave bass)
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + noteDuration - 0.05);

    osc.start(time);
    osc.stop(time + noteDuration);
  }

  function playArp(time: number, freq: number) {
    if (!ctx || !masterGain || !lowPassFilter) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq * 4; // 2 octavas arriba
    osc.connect(gain);
    gain.connect(lowPassFilter);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + noteDuration / 2);
    osc.start(time);
    osc.stop(time + noteDuration / 2);
  }

  function playKick(time: number) {
    if (!ctx || !masterGain || !lowPassFilter) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.connect(gain);
    gain.connect(lowPassFilter);
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  function playHihat(time: number) {
    if (!ctx || !masterGain || !lowPassFilter) return;
    // Hi-hat simulado con un oscilador cuadrado muy rápido y envolvente ultracorta
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, time);
    osc.connect(gain);
    gain.connect(lowPassFilter);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  function schedule() {
    if (!ctx || !isPlaying) return;

    while (nextNoteTime < ctx.currentTime + 0.1) {
      const freq = scale[pattern[currentNote % pattern.length]] / 2; // Bass
      playNote(nextNoteTime, freq);
      
      const level = cachedWorld?.state?.level ?? 1;
      const combo = cachedWorld?.state?.combo ?? 0;
      
      // Arpegio de Adrenalina si hay Combo
      if (combo > 1) {
        playArp(nextNoteTime, freq);
        if (combo > 3) playArp(nextNoteTime + noteDuration / 2, scale[(pattern[currentNote % pattern.length] + 2) % scale.length] / 2);
      }
      
      // Kick en cada golpe (4/4)
      if (currentNote % 4 === 0) playKick(nextNoteTime);
      
      // Hi-hats rítmicos a partir del nivel 3
      if (level >= 3 && currentNote % 2 === 1) playHihat(nextNoteTime);
      // Doble Hi-hat en niveles altos
      if (level >= 6 && currentNote % 4 === 2) {
        playHihat(nextNoteTime);
        playHihat(nextNoteTime + noteDuration / 2);
      }
      
      nextNoteTime += noteDuration;
      currentNote++;
    }
  }

  return {
    name: 'audio',
    
    init(world: any) {
      cachedWorld = world;

      world.events.on('game:start', () => {
        if (!ctx) {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          masterGain = ctx.createGain();
          lowPassFilter = ctx.createBiquadFilter();
          
          lowPassFilter.type = 'lowpass';
          lowPassFilter.frequency.value = 20000; // Abierto por defecto

          lowPassFilter.connect(masterGain);
          masterGain.connect(ctx.destination);
          nextNoteTime = ctx.currentTime + 0.1;
        }
        
        if (lowPassFilter) {
          // Abrir el filtro al jugar
          lowPassFilter.frequency.setTargetAtTime(20000, ctx.currentTime, 0.5);
        }
        
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        isPlaying = true;
      });

      world.events.on('ui:message', () => {
        // Pausar música al morir / menú principal no la corta, aplica LowPass filter para ahogarla
        if (lowPassFilter && ctx) {
          lowPassFilter.frequency.setTargetAtTime(300, ctx.currentTime, 0.1); // Muffled effect
        }
        // No detenemos isPlaying, solo la ahogamos
      });

      world.events.on('orb:collected', () => {
        if (!ctx || !isPlaying || !masterGain) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
    
        // Sonido de "campanita" brillante (sine)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
        osc.frequency.exponentialRampToValueAtTime(2093.00, ctx.currentTime + 0.1); // Pitch bend hacia C7
    
        osc.connect(gain);
        gain.connect(masterGain); // Pasa directo al master sin filtro ahogado
    
        // Envolvente percusiva corta (Ting!)
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      });

      world.events.on('player:damaged', ({ player }) => {
        if (!ctx || !masterGain) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        if (player.player.lives <= 0) {
          // Death sound (caída de graves y distorsión implícita por onda de sierra fuerte)
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 1.2);
          
          osc.connect(gain);
          gain.connect(masterGain);
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 1.2);
        } else {
          // Hit sound (ruido disonante corto)
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(80, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.4);
          
          osc.connect(gain);
          gain.connect(masterGain);
          
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        }
      });

      world.events.on('game:levelup', () => {
        // Acorde de victoria!
        if (!ctx || !masterGain) return;
        [523.25, 659.25, 783.99].forEach((freq, idx) => { // C Mayor
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(gain);
          gain.connect(masterGain);
          gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
          gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + idx * 0.1 + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
          osc.start(ctx.currentTime + idx * 0.1);
          osc.stop(ctx.currentTime + 2.0);
        });
      });
    },

    update() {
      if (masterGain) {
        import('../config.js').then(m => {
          masterGain!.gain.value = m.CONFIG.audio.muted ? 0 : 1;
        });
      }
      
      if (isPlaying) {
        schedule();
      }
    }
  };
}
