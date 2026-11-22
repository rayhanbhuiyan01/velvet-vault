// Sound, synthesised with WebAudio: no audio files, no network. Everything is a short
// oscillator blip, so the game stays a handful of static files. Sound starts on the first user
// gesture (a browser rule) and can be muted with M.
export function createSound() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, seconds, type, gainValue, when = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + seconds);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime + when);
    oscillator.stop(ctx.currentTime + when + seconds);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.12);
      tone(990, 0.14, 'sine', 0.12, 0.07);
    },
    coin() {
      tone(1200, 0.06, 'square', 0.05);
    },
    spotted() {
      tone(880, 0.08, 'square', 0.06);
    },
    caught() {
      tone(392, 0.2, 'sawtooth', 0.1);
      tone(262, 0.3, 'sawtooth', 0.1, 0.16);
      tone(175, 0.45, 'sawtooth', 0.1, 0.32);
    },
    win() {
      tone(523, 0.12, 'sine', 0.12);
      tone(659, 0.12, 'sine', 0.12, 0.1);
      tone(784, 0.12, 'sine', 0.12, 0.2);
      tone(1047, 0.25, 'sine', 0.12, 0.3);
    },
  };
}
