// Every sound is synthesized with WebAudio: no audio files, no network.
// Short oscillator and noise bursts for effects, and a small step sequencer
// for music — a calm arpeggio on the title, a driving line in combat, and
// a low pulse under the bosses. The context stays suspended until the first
// input unlocks it, as browsers require.

const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, E6: 1318.5,
};

/** The sequencer's patterns, one per mood: [bass, arpeggio] step lists. */
const MUSIC = {
  calm: {
    bpm: 72,
    bass: [NOTE.C3, 0, NOTE.G3, 0, NOTE.A3, 0, NOTE.G3, 0, NOTE.C3, 0, NOTE.G3, 0, NOTE.E3, 0, NOTE.D3, 0],
    arp: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5],
  },
  combat: {
    bpm: 112,
    bass: [NOTE.C3, NOTE.C3, NOTE.G3, NOTE.C3, NOTE.A3, NOTE.A3, NOTE.G3, NOTE.E3, NOTE.C3, NOTE.C3, NOTE.G3, NOTE.C3, NOTE.D3, NOTE.D3, NOTE.G3, NOTE.G3],
    arp: [NOTE.C5, 0, NOTE.E5, NOTE.G5, 0, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.C5, 0, NOTE.E5, NOTE.G5, NOTE.A5, 0, NOTE.G5, NOTE.E5],
  },
  boss: {
    bpm: 132,
    bass: [NOTE.C3, 0, NOTE.C3, NOTE.D3, NOTE.C3, 0, NOTE.E3, NOTE.D3, NOTE.C3, 0, NOTE.C3, NOTE.D3, NOTE.G3, NOTE.E3, NOTE.D3, NOTE.D3],
    arp: [NOTE.C5, NOTE.C5, 0, NOTE.E5, NOTE.G5, 0, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, 0, NOTE.D5, NOTE.E5, NOTE.G5, 0, NOTE.C6],
  },
};

export function createAudio() {
  let context = null;
  let master = null;
  let musicBus = null;
  let muted = false;
  let mood = 'calm';
  let step = 0;
  let stepTimer = 0;
  let noiseBuffer = null;

  function ensure() {
    if (context !== null) return true;
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (AudioContextClass === undefined) return false;
    try {
      context = new AudioContextClass();
    } catch {
      return false;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(context.destination);
    musicBus = context.createGain();
    musicBus.gain.value = 0.35;
    musicBus.connect(master);
    const length = context.sampleRate * 0.5;
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  /** Start the context after a user gesture; safe to call any time. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') void context.resume();
  }

  function tone({ frequency, endFrequency = null, type = 'sine', duration, volume, when = 0, bus = null }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(bus ?? master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function noise({ duration, volume, filterFrequency = 1200, type = 'lowpass', when = 0 }) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFrequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function playStep() {
    const pattern = MUSIC[mood];
    const index = step % pattern.bass.length;
    const bass = pattern.bass[index];
    const arp = pattern.arp[index];
    if (bass !== 0) tone({ frequency: bass, type: 'triangle', duration: 0.32, volume: 0.5, bus: musicBus });
    if (arp !== 0) tone({ frequency: arp, type: 'sine', duration: 0.22, volume: 0.3, bus: musicBus });
    step += 1;
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = muted ? 0 : 0.9;
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    /** Advance the sequencer; call once a frame with the frame's delta. */
    music(dt, nextMood) {
      if (nextMood !== mood) {
        mood = nextMood;
        step = 0;
        stepTimer = 0;
      }
      if (context === null || context.state !== 'running') return;
      stepTimer += dt;
      const stepLength = 60 / MUSIC[mood].bpm / 2;
      while (stepTimer >= stepLength) {
        stepTimer -= stepLength;
        playStep();
      }
    },
    shoot() { tone({ frequency: 880, endFrequency: 520, type: 'square', duration: 0.07, volume: 0.08 }); },
    hurt() { tone({ frequency: 180, endFrequency: 70, type: 'sawtooth', duration: 0.18, volume: 0.22 }); noise({ duration: 0.12, volume: 0.12, filterFrequency: 700 }); },
    spireHit() { tone({ frequency: 240, endFrequency: 90, type: 'triangle', duration: 0.3, volume: 0.3 }); tone({ frequency: 120, endFrequency: 60, type: 'sine', duration: 0.35, volume: 0.3, when: 0.02 }); },
    kill() { tone({ frequency: 520, endFrequency: 180, type: 'triangle', duration: 0.12, volume: 0.16 }); },
    shard() { tone({ frequency: 1320, endFrequency: 1760, type: 'sine', duration: 0.09, volume: 0.1 }); },
    pickup() { tone({ frequency: 660, type: 'sine', duration: 0.1, volume: 0.18 }); tone({ frequency: 990, type: 'sine', duration: 0.14, volume: 0.18, when: 0.08 }); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => tone({ frequency: f, type: 'sine', duration: 0.16, volume: 0.2, when: i * 0.07 })); },
    waveHorn() { tone({ frequency: 196, type: 'sawtooth', duration: 0.5, volume: 0.16 }); tone({ frequency: 294, type: 'sawtooth', duration: 0.5, volume: 0.12, when: 0.05 }); },
    roar() { tone({ frequency: 90, endFrequency: 45, type: 'sawtooth', duration: 0.8, volume: 0.3 }); noise({ duration: 0.7, volume: 0.16, filterFrequency: 400 }); },
    explode() { noise({ duration: 0.5, volume: 0.32, filterFrequency: 900 }); tone({ frequency: 120, endFrequency: 40, type: 'sine', duration: 0.45, volume: 0.3 }); },
    dash() { noise({ duration: 0.16, volume: 0.14, filterFrequency: 2400, type: 'bandpass' }); },
    nova() { tone({ frequency: 1047, endFrequency: 262, type: 'sine', duration: 0.4, volume: 0.22 }); noise({ duration: 0.3, volume: 0.12, filterFrequency: 1800 }); },
    shieldUp() { tone({ frequency: 784, endFrequency: 1175, type: 'sine', duration: 0.2, volume: 0.16 }); },
    click() { tone({ frequency: 740, type: 'sine', duration: 0.06, volume: 0.12 }); },
    upgrade() { [392, 523, 659].forEach((f, i) => tone({ frequency: f, type: 'triangle', duration: 0.12, volume: 0.16, when: i * 0.06 })); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => tone({ frequency: f, type: 'triangle', duration: 0.34, volume: 0.2, when: i * 0.22 })); },
    victory() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ frequency: f, type: 'sine', duration: 0.22, volume: 0.2, when: i * 0.13 })); },
  };
}
