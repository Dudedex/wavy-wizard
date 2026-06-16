'use strict';

// ===========================================================================
// Audio — tiny WebAudio synth (blips + filtered noise) & per-spell sounds
// ===========================================================================

let audioCtx = null;
let muted = false;
const sfxLast = {};

function blip(f0, f1, dur, type, vol) {
  const v = vol * (game.opt && game.opt.volume !== undefined ? game.opt.volume : 1);
  if (muted || v <= 0) return;
  vol = v;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { muted = true; return; }
  }
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Filtered white-noise burst — for whooshes, fire/wind/earth/ice breath, etc.
function noise(dur, filterType, f0, f1, vol) {
  const v = vol * (game.opt && game.opt.volume !== undefined ? game.opt.volume : 1);
  if (muted || v <= 0) return;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { muted = true; return; }
  }
  const t = audioCtx.currentTime;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const filt = audioCtx.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.setValueAtTime(f0, t);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  filt.Q.value = filterType === 'bandpass' ? 5 : 1;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(audioCtx.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Two quick blips layered, for richer tonal casts.
function chord(a, b) { if (a) blip(...a); if (b) blip(...b); }

// Per-spell cast sound, themed to the spell. Lightly throttled per spell.
function spellSfx(id) {
  const now = performance.now();
  const key = 'sp:' + id;
  if (sfxLast[key] && now - sfxLast[key] < 45) return;
  sfxLast[key] = now;
  switch (id) {
    case 'missile':   blip(900, 380, 0.08, 'square', 0.03); break;                 // sharp pew
    case 'fireball':  noise(0.20, 'lowpass', 1400, 320, 0.06); break;              // flaming whoosh
    case 'frost':     chord([1300, 1900, 0.12, 'sine', 0.028], [1800, 2400, 0.1, 'sine', 0.02]); break; // crystalline shimmer
    case 'lightning': blip(2200, 180, 0.09, 'sawtooth', 0.04); break;              // crackle
    case 'poison':    blip(170, 90, 0.28, 'sine', 0.045); break;                   // gloopy bubble
    case 'meteor':    blip(300, 1000, 0.45, 'sine', 0.03); break;                  // incoming whistle
    case 'drain':     blip(760, 150, 0.32, 'sawtooth', 0.03); break;               // eerie descent
    case 'nova':      chord([520, 120, 0.25, 'triangle', 0.05], [780, 200, 0.22, 'sine', 0.03]); break; // holy swell
    case 'shield':    blip(420, 840, 0.16, 'sine', 0.04); break;                   // warm hum
    case 'orbs':      blip(1100, 1500, 0.05, 'sine', 0.02); break;                 // soft chime
    case 'firebreath':  noise(0.5, 'lowpass', 1000, 380, 0.075); break;            // roar
    case 'icebreath':   noise(0.5, 'highpass', 3200, 5200, 0.045); break;          // freezing hiss
    case 'earthbreath': noise(0.42, 'lowpass', 420, 110, 0.085); break;            // gravelly rumble
    case 'windbreath':  noise(0.5, 'bandpass', 1200, 2800, 0.05); break;           // airy gale
    default:          blip(700, 320, 0.07, 'square', 0.025);
  }
}

function sfx(name) {
  const now = performance.now();
  if (sfxLast[name] && now - sfxLast[name] < 50) return; // throttle spam
  sfxLast[name] = now;
  switch (name) {
    case 'shoot':  blip(700, 320, 0.07, 'square', 0.025); break;
    case 'hit':    blip(300, 150, 0.06, 'triangle', 0.04); break;
    case 'boom':   blip(180, 40, 0.30, 'sawtooth', 0.07); break;
    case 'zap':    blip(1400, 200, 0.10, 'sawtooth', 0.035); break;
    case 'frost':  blip(900, 1400, 0.08, 'sine', 0.03); break;
    case 'pickup': blip(900, 1500, 0.07, 'sine', 0.035); break;
    case 'buy':    blip(600, 1200, 0.12, 'square', 0.045); break;
    case 'sell':   blip(800, 400, 0.12, 'square', 0.04); break;
    case 'hurt':   blip(220, 80, 0.18, 'sawtooth', 0.08); break;
    case 'heal':   blip(500, 900, 0.12, 'sine', 0.035); break;
    case 'level':  blip(520, 1040, 0.25, 'square', 0.05); break;
    case 'nova':   blip(500, 100, 0.25, 'triangle', 0.06); break;
    case 'shield': blip(400, 800, 0.15, 'sine', 0.04); break;
    case 'death':  blip(300, 30, 0.6, 'sawtooth', 0.1); break;
    case 'win':    blip(523, 1046, 0.5, 'square', 0.06); break;
  }
}
