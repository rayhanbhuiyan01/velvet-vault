// Synthesised sound, no audio files: every effect is a few WebAudio
// oscillators shaped by a gain envelope. The context is built lazily on the
// first user gesture, so a quiet page load stays quiet.

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

  function tone(freq, dur, type, volume, when, slideTo) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  return {
    /** Call from any user gesture so the browser lets audio start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.12);
      tone(990, 0.16, 'sine', 0.12, 0.08);
    },
    coin() {
      tone(1568, 0.07, 'triangle', 0.1);
      tone(2093, 0.09, 'triangle', 0.08, 0.06);
    },
    alarmBeep() {
      tone(880, 0.09, 'square', 0.05);
    },
    caught() {
      tone(392, 0.25, 'sawtooth', 0.12, 0, 196);
      tone(196, 0.5, 'sawtooth', 0.12, 0.2, 98);
    },
    escape() {
      tone(523, 0.12, 'sine', 0.12);
      tone(659, 0.12, 'sine', 0.12, 0.1);
      tone(784, 0.12, 'sine', 0.12, 0.2);
      tone(1047, 0.3, 'sine', 0.12, 0.3);
    },
  };
}
