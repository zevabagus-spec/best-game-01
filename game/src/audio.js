// Every sound is synthesized with WebAudio: no audio files, nothing to load.
// The context is created on the first user gesture (browsers forbid sound
// before one), so the title screen is silent until the player starts. Music is
// a slow pentatonic pluck over a soft pad, scheduled a little ahead of time.

const PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicNext = 0;
  let musicStep = 0;
  let pluckIndex = 0;

  function ensure() {
    if (context !== null) return context !== null;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  /** Call from a user gesture (click or key) so the browser allows sound. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, volume, when, slideTo) {
    if (context === null || muted) return;
    try {
      const t0 = when ?? context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, volume, lowpass) {
    if (context === null || muted) return;
    try {
      const t0 = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(t0);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function note(freq, dur, volume) {
    if (context === null || muted || musicGain === null) return;
    try {
      const t0 = musicNext;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone(720, 0.09, 'square', 0.10, undefined, 320);
    },
    hit() {
      noise(0.06, 0.12, 2400);
    },
    kill() {
      tone(520, 0.12, 'triangle', 0.16, undefined, 140);
      noise(0.08, 0.10, 1800);
    },
    shard() {
      tone(1180, 0.10, 'sine', 0.12, undefined, 1560);
    },
    hurt() {
      tone(180, 0.25, 'sawtooth', 0.18, undefined, 70);
    },
    lanternHit() {
      tone(120, 0.30, 'sine', 0.22, undefined, 55);
      noise(0.12, 0.10, 700);
    },
    explode() {
      noise(0.28, 0.20, 900);
      tone(90, 0.28, 'sine', 0.20, undefined, 40);
    },
    waveHorn() {
      if (context === null || muted) return;
      const t0 = context.currentTime;
      tone(392, 0.35, 'triangle', 0.16, t0);
      tone(523.25, 0.5, 'triangle', 0.16, t0 + 0.18);
    },
    upgrade() {
      if (context === null || muted) return;
      const t0 = context.currentTime;
      tone(523.25, 0.14, 'sine', 0.14, t0);
      tone(659.25, 0.14, 'sine', 0.14, t0 + 0.09);
      tone(783.99, 0.22, 'sine', 0.14, t0 + 0.18);
    },
    gameOver() {
      if (context === null || muted) return;
      const t0 = context.currentTime;
      tone(392, 0.3, 'triangle', 0.16, t0, 370);
      tone(311, 0.3, 'triangle', 0.16, t0 + 0.28, 294);
      tone(233, 0.6, 'triangle', 0.16, t0 + 0.56, 220);
    },
    victory() {
      if (context === null || muted) return;
      const t0 = context.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, 0.35, 'triangle', 0.15, t0 + i * 0.13));
    },
    /** Advance the music clock; schedules plucks just ahead of playback. */
    music(dt) {
      if (context === null || muted) return;
      if (musicNext === 0) musicNext = context.currentTime + 0.1;
      while (musicNext < context.currentTime + 0.25) {
        const stepDur = 0.42;
        if (musicStep % 8 === 0) {
          // A low pad note at the top of each bar.
          note(PENTATONIC[0] / 2, 3.2, 0.5);
        }
        if (musicStep % 2 === 0) {
          const pick = PENTATONIC[(pluckIndex * 2 + (musicStep % 5)) % PENTATONIC.length];
          note(pick, 1.4, 0.5);
          pluckIndex += 1;
        }
        musicStep += 1;
        musicNext += stepDur;
      }
    },
  };
}
