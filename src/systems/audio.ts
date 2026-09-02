/**
 * Sistema de Audio Procedural.
 *
 * Genera música "Synthwave/8-bit" matemáticamente usando Web Audio API.
 * 0 bytes en texturas/MP3, carga instantánea.
 */
export function audioSystem() {
  let ctx: AudioContext | null = null;
  let isPlaying = false;
  let nextNoteTime = 0;
  let currentNote = 0;

  // Escala pentatónica menor (A menor)
  const scale = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
  // Patrón arpegiador
  const pattern = [0, 2, 4, 2, 0, 3, 5, 3];
  
  const tempo = 140; // BPM
  const noteDuration = 60 / (tempo * 2); // octavas

  function playNote(time: number, freq: number) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Envolvente rápida percusiva (synthwave bass)
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + noteDuration - 0.05);

    osc.start(time);
    osc.stop(time + noteDuration);
  }

  function schedule() {
    if (!ctx || !isPlaying) return;

    while (nextNoteTime < ctx.currentTime + 0.1) {
      const freq = scale[pattern[currentNote % pattern.length]] / 2; // Bass (bajar octava)
      playNote(nextNoteTime, freq);
      
      nextNoteTime += noteDuration;
      currentNote++;
    }
  }

  return {
    name: 'audio',
    
    init(world: any) {
      world.events.on('game:start', () => {
        if (!ctx) {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          nextNoteTime = ctx.currentTime + 0.1;
        }
        
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        isPlaying = true;
      });

      world.events.on('ui:message', () => {
        // Pausar música al morir / menú principal
        isPlaying = false;
      });

      world.events.on('orb:collected', () => {
        if (!ctx || !isPlaying) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
    
        // Sonido de "campanita" brillante (sine)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
        osc.frequency.exponentialRampToValueAtTime(2093.00, ctx.currentTime + 0.1); // Pitch bend hacia C7
    
        osc.connect(gain);
        gain.connect(ctx.destination);
    
        // Envolvente percusiva corta (Ting!)
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      });
    },

    update() {
      if (isPlaying) {
        schedule();
      }
    }
  };
}
