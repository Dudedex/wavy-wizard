'use strict';

// ===========================================================================
// Audio — tiny WebAudio synth (blips + filtered noise) & per-spell sounds
// ===========================================================================

let audioCtx = null;
let muted = false;
const sfxLast = {};

function blip(f0, f1, dur, type, vol, delay = 0) {
  const v = vol * (game.opt && game.opt.volume !== undefined ? game.opt.volume : 1);
  if (muted || v <= 0) return;
  vol = v;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { muted = true; return; }
  }
  const t = audioCtx.currentTime + delay;
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
function noise(dur, filterType, f0, f1, vol, delay = 0) {
  const v = vol * (game.opt && game.opt.volume !== undefined ? game.opt.volume : 1);
  if (muted || v <= 0) return;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { muted = true; return; }
  }
  const t = audioCtx.currentTime + delay;
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
function chord(a, b, c) { if (a) blip(...a); if (b) blip(...b); if (c) blip(...c); }
function arpeggio(notes, type, vol, dur = 0.08, gap = 0.045) {
  notes.forEach((f, i) => blip(f, f * 1.08, dur, type, vol, i * gap));
}

// Per-spell cast sound, themed to the spell. Lightly throttled per spell.
function spellSfx(id) {
  const now = performance.now();
  const key = 'sp:' + id;
  if (sfxLast[key] && now - sfxLast[key] < 45) return;
  sfxLast[key] = now;
  switch (id) {
    case 'missile': // three tiny particle-triangle chirps snapping into one dart
      arpeggio([1320, 1640, 1980], 'triangle', 0.018, 0.045, 0.026);
      blip(2100, 980, 0.09, 'square', 0.018, 0.055);
      break;
    case 'fireball': // ignition pop + rushing flame body
      blip(120, 72, 0.16, 'sawtooth', 0.035);
      noise(0.28, 'lowpass', 1800, 260, 0.065, 0.015);
      blip(420, 720, 0.12, 'triangle', 0.025, 0.04);
      break;
    case 'frost': // glassy crystal ping with brittle ice crackle
      chord([1650, 2480, 0.16, 'sine', 0.024], [2300, 3100, 0.12, 'triangle', 0.018, 0.035], [920, 1280, 0.18, 'sine', 0.014, 0.06]);
      noise(0.13, 'highpass', 4200, 6200, 0.018, 0.025);
      break;
    case 'lightning': // instant jagged electrical snap
      arpeggio([2600, 900, 2100, 520], 'sawtooth', 0.025, 0.035, 0.018);
      noise(0.10, 'bandpass', 4200, 900, 0.035);
      break;
    case 'shield': // stable arcane shield lock-in, no wobble/pulse
      chord([360, 720, 0.24, 'sine', 0.035], [540, 1080, 0.22, 'sine', 0.026], [900, 900, 0.18, 'triangle', 0.018, 0.04]);
      break;
    case 'poison': // wet toxic bubbles and a soft gas hiss
      blip(150, 82, 0.18, 'sine', 0.03);
      blip(115, 170, 0.12, 'triangle', 0.02, 0.07);
      blip(190, 105, 0.16, 'sine', 0.022, 0.13);
      noise(0.30, 'lowpass', 620, 180, 0.028, 0.02);
      break;
    case 'meteor': // high incoming whistle into a heavy burning descent
      blip(1250, 260, 0.42, 'sine', 0.03);
      noise(0.36, 'lowpass', 900, 120, 0.055, 0.08);
      blip(180, 70, 0.22, 'sawtooth', 0.035, 0.22);
      break;
    case 'drain': // red droplets siphoning downward along the tether
      arpeggio([760, 620, 480, 340], 'sawtooth', 0.022, 0.07, 0.05);
      blip(180, 120, 0.28, 'triangle', 0.025, 0.08);
      break;
    case 'orbs': // symmetric purple orbit chimes
      chord([660, 990, 0.18, 'sine', 0.022], [990, 1320, 0.18, 'sine', 0.018, 0.045], [1320, 990, 0.18, 'sine', 0.016, 0.09]);
      break;
    case 'nova': // round holy wave expanding outward
      chord([392, 784, 0.36, 'sine', 0.04], [523, 1046, 0.34, 'triangle', 0.03, 0.035], [659, 1318, 0.32, 'sine', 0.022, 0.07]);
      noise(0.22, 'highpass', 1800, 3600, 0.018, 0.08);
      break;
    case 'firebreath': // cone shockwave of flame
      noise(0.52, 'lowpass', 1500, 300, 0.08);
      blip(140, 80, 0.35, 'sawtooth', 0.035);
      break;
    case 'icebreath': // freezing cone shockwave
      noise(0.50, 'highpass', 3600, 6200, 0.046);
      chord([1200, 1800, 0.20, 'sine', 0.018, 0.02], [1800, 2600, 0.18, 'sine', 0.014, 0.09]);
      break;
    case 'earthbreath': // gravel shockwave rumble
      noise(0.46, 'lowpass', 520, 90, 0.09);
      blip(95, 55, 0.30, 'sawtooth', 0.055, 0.03);
      break;
    case 'windbreath': // airy cone gust
      noise(0.52, 'bandpass', 900, 3200, 0.055);
      blip(680, 1180, 0.25, 'sine', 0.018, 0.04);
      break;
    default:
      blip(700, 320, 0.07, 'square', 0.025);
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
