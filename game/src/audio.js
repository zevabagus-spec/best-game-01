// Every sound is synthesized with WebAudio: no audio files, nothing fetched.
// Short effects are oscillators and filtered noise; the music is a small
// generative loop — a slow pad under a pentatonic arpeggio — whose pace and
// root follow the fight. Nothing starts until a gesture unlocks the context,
// and every call is a no-op when audio is unavailable or muted.

const SHOT_GAP = 0.06;
const KILL_GAP = 0.05;
const SHARD_GAP = 0.05;

/** A-minor pentatonic arpeggio notes, in Hz, across two octaves. */
const ARP_NOTES = [220.0, 261.63, 329.63, 392.0, 440.0, 523.25, 659.25, 783.99];
/** Pad chord roots the loop walks through (Am, F, C, G). */
const PAD_ROOTS = [110.0, 87.31, 130.81, 98.0];

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let unlocked = false;
  let lastShot = -1;
  let lastKill = -1;
  let lastShard = -1;
  let musicTime = 0;
  let nextArp = 0;
  let nextPad = 0;
  let arpStep = 0;
  let padStep = 0;
  let intensity = 'calm';

  function ensure() {
    if (context !== null) return true;
    if (typeof window === 'undefined') return false;
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      context = new AudioContext();
    } catch {
      return false;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
    return true;
  }

  function tone({ frequency, endFrequency, type = 'sine', duration, volume, when = 0, slide = true, destination = null }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide && endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination ?? master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise({ duration, volume, filterFrequency, type = 'lowpass', when = 0, quality = 0.8 }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFrequency;
    filter.Q.value = quality;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  function padChord(root) {
    if (!ensure() || muted) return;
    const start = context.currentTime + 0.05;
    for (const ratio of [1, 1.5, 2.02]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = root * ratio;
      oscillator.detune.value = ratio === 1 ? -4 : 4;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 1.2);
      gain.gain.linearRampToValueAtTime(0, start + 4.4);
      oscillator.connect(gain);
      gain.connect(musicGain);
      oscillator.start(start);
      oscillator.stop(start + 4.6);
    }
  }

  function arpNote(frequency, volume) {
    tone({ frequency, type: 'sine', duration: 0.32, volume, destination: musicGain });
    tone({ frequency: frequency * 2, type: 'sine', duration: 0.18, volume: volume * 0.4, destination: musicGain });
  }

  return {
    /** Start the context after a user gesture; safe to call often. */
    unlock() {
      if (!ensure()) return;
      unlocked = true;
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }
    },
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = muted ? 0 : 0.9;
    },
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },
    get isMuted() {
      return muted;
    },
    /** Advance the generative loop; `mood` is calm, combat or boss. */
    music(dt, mood) {
      if (!unlocked || !ensure() || muted) return;
      intensity = mood;
      musicTime += dt;
      const arpGap = intensity === 'boss' ? 0.19 : intensity === 'combat' ? 0.26 : 0.52;
      if (musicTime >= nextArp) {
        nextArp = musicTime + arpGap;
        const note = ARP_NOTES[arpStep % ARP_NOTES.length];
        arpStep += intensity === 'boss' ? 3 : 1;
        arpNote(intensity === 'boss' ? note / 2 : note, intensity === 'calm' ? 0.06 : 0.085);
      }
      if (musicTime >= nextPad) {
        nextPad = musicTime + 4.4;
        padChord(PAD_ROOTS[padStep % PAD_ROOTS.length]);
        padStep += 1;
      }
    },
    shoot() {
      if (!unlocked) return;
      const now = context ? context.currentTime : 0;
      if (now - lastShot < SHOT_GAP) return;
      lastShot = now;
      tone({ frequency: 880, endFrequency: 340, type: 'square', duration: 0.07, volume: 0.05 });
    },
    hurt() {
      tone({ frequency: 160, endFrequency: 60, type: 'sawtooth', duration: 0.22, volume: 0.16 });
      noise({ duration: 0.14, volume: 0.1, filterFrequency: 700 });
    },
    beaconHit() {
      tone({ frequency: 220, endFrequency: 110, type: 'triangle', duration: 0.3, volume: 0.16 });
      tone({ frequency: 440, endFrequency: 220, type: 'sine', duration: 0.3, volume: 0.1, when: 0.02 });
    },
    kill() {
      if (!unlocked) return;
      const now = context ? context.currentTime : 0;
      if (now - lastKill < KILL_GAP) return;
      lastKill = now;
      tone({ frequency: 520, endFrequency: 180, type: 'triangle', duration: 0.09, volume: 0.08 });
      noise({ duration: 0.06, volume: 0.05, filterFrequency: 2400, type: 'highpass' });
    },
    shard() {
      if (!unlocked) return;
      const now = context ? context.currentTime : 0;
      if (now - lastShard < SHARD_GAP) return;
      lastShard = now;
      tone({ frequency: 1320, endFrequency: 1760, type: 'sine', duration: 0.08, volume: 0.05 });
    },
    pickup() {
      tone({ frequency: 660, type: 'sine', duration: 0.1, volume: 0.1 });
      tone({ frequency: 990, type: 'sine', duration: 0.14, volume: 0.1, when: 0.07 });
    },
    levelup() {
      for (let index = 0; index < 4; index += 1) {
        tone({ frequency: 440 * [1, 1.25, 1.5, 2][index], type: 'triangle', duration: 0.16, volume: 0.11, when: index * 0.07 });
      }
    },
    upgrade() {
      tone({ frequency: 523, type: 'sine', duration: 0.12, volume: 0.1 });
      tone({ frequency: 784, type: 'sine', duration: 0.18, volume: 0.1, when: 0.08 });
    },
    dash() {
      noise({ duration: 0.16, volume: 0.09, filterFrequency: 1400, type: 'bandpass', quality: 1.4 });
    },
    nova() {
      tone({ frequency: 180, endFrequency: 720, type: 'sine', duration: 0.3, volume: 0.12 });
      noise({ duration: 0.25, volume: 0.07, filterFrequency: 900 });
    },
    explode() {
      tone({ frequency: 120, endFrequency: 40, type: 'sawtooth', duration: 0.4, volume: 0.18 });
      noise({ duration: 0.35, volume: 0.14, filterFrequency: 500 });
    },
    waveHorn() {
      tone({ frequency: 98, type: 'triangle', duration: 0.7, volume: 0.14 });
      tone({ frequency: 147, type: 'triangle', duration: 0.7, volume: 0.1, when: 0.12 });
    },
    roar() {
      tone({ frequency: 70, endFrequency: 46, type: 'sawtooth', duration: 1.1, volume: 0.2 });
      tone({ frequency: 93, endFrequency: 55, type: 'sawtooth', duration: 1.1, volume: 0.14, when: 0.08 });
      noise({ duration: 0.9, volume: 0.08, filterFrequency: 300 });
    },
    shieldUp() {
      tone({ frequency: 392, endFrequency: 784, type: 'sine', duration: 0.25, volume: 0.1 });
    },
    click() {
      tone({ frequency: 700, type: 'sine', duration: 0.05, volume: 0.06 });
    },
    victory() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      notes.forEach((frequency, index) => {
        tone({ frequency, type: 'triangle', duration: 0.3, volume: 0.12, when: index * 0.13 });
      });
    },
    gameOver() {
      tone({ frequency: 220, endFrequency: 55, type: 'triangle', duration: 1.4, volume: 0.16 });
      tone({ frequency: 110, endFrequency: 49, type: 'sine', duration: 1.6, volume: 0.12, when: 0.15 });
    },
  };
}
