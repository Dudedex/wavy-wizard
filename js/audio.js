'use strict';

// ===========================================================================
// Audio — tiny WebAudio synth (blips + filtered noise) & per-spell sounds
// ===========================================================================

let audioCtx = null;
let muted = false;
const sfxLast = {};
const SPELL_SFX_GAIN = 0.68;

function blip(f0, f1, dur, type, vol, delay = 0, gain = 1) {
  const v = vol * gain * (game.opt && game.opt.volume !== undefined ? game.opt.volume : 1);
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
function noise(dur, filterType, f0, f1, vol, delay = 0, gain = 1) {
  const v = vol * gain * (game.opt && game.opt.volume !== undefined ? game.opt.volume : 1);
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

// Layered soft tones; note arrays may omit delay, so append gain safely.
function playTone(note, gain = 1) { if (note) blip(note[0], note[1], note[2], note[3], note[4], note[5] || 0, gain); }
function chord(a, b, c, gain = 1) { playTone(a, gain); playTone(b, gain); playTone(c, gain); }
function arpeggio(notes, type, vol, dur = 0.08, gap = 0.045, gain = 1) {
  notes.forEach((f, i) => blip(f, f * 1.08, dur, type, vol, i * gap, gain));
}
function waveBreathSfx(color, gain = 1) {
  // Two noise bands make an audible wave front: a rising swell followed by a rolling crash.
  const high = color === 'ice' ? 5200 : color === 'wind' ? 3400 : color === 'fire' ? 1700 : 760;
  const low = color === 'earth' ? 80 : color === 'fire' ? 220 : color === 'ice' ? 1800 : 420;
  noise(0.28, color === 'ice' ? 'highpass' : 'bandpass', low, high, color === 'earth' ? 0.035 : 0.03, 0, gain);
  noise(0.48, color === 'wind' ? 'bandpass' : 'lowpass', high, low, color === 'fire' ? 0.045 : 0.04, 0.08, gain);
  blip(color === 'earth' ? 120 : 260, color === 'earth' ? 55 : 140, 0.26, 'triangle', 0.016, 0.11, gain);
}

// Per-spell cast sound, themed to the spell. Lightly throttled per spell.
function spellSfx(id) {
  const now = performance.now();
  const key = 'sp:' + id;
  if (sfxLast[key] && now - sfxLast[key] < 45) return;
  sfxLast[key] = now;
  switch (id) {
    case 'missile': // three tiny particle-triangle chirps snapping into one dart
      arpeggio([1320, 1640, 1980], 'triangle', 0.014, 0.05, 0.03, SPELL_SFX_GAIN);
      blip(2100, 980, 0.10, 'triangle', 0.012, 0.055, SPELL_SFX_GAIN);
      break;
    case 'fireball': // ignition pop + rushing flame body
      blip(120, 72, 0.18, 'sawtooth', 0.022, 0, SPELL_SFX_GAIN);
      noise(0.34, 'lowpass', 1500, 260, 0.04, 0.015, SPELL_SFX_GAIN);
      blip(420, 720, 0.14, 'triangle', 0.016, 0.04, SPELL_SFX_GAIN);
      break;
    case 'frost': // glassy crystal ping with brittle ice crackle
      chord([1550, 2280, 0.18, 'sine', 0.016], [2200, 2900, 0.14, 'triangle', 0.012, 0.035], [920, 1280, 0.20, 'sine', 0.01, 0.06], SPELL_SFX_GAIN);
      noise(0.16, 'highpass', 3800, 5600, 0.012, 0.025, SPELL_SFX_GAIN);
      break;
    case 'lightning': // instant jagged electrical snap
      arpeggio([2200, 900, 1900, 620], 'triangle', 0.017, 0.04, 0.02, SPELL_SFX_GAIN);
      noise(0.12, 'bandpass', 3600, 900, 0.02, 0, SPELL_SFX_GAIN);
      break;
    case 'shield': // stable arcane shield lock-in, no wobble/pulse
      chord([360, 720, 0.26, 'sine', 0.022], [540, 1080, 0.24, 'sine', 0.016], [900, 900, 0.20, 'triangle', 0.011, 0.04], SPELL_SFX_GAIN);
      break;
    case 'poison': // wet toxic bubbles and a soft gas hiss
      blip(150, 82, 0.20, 'sine', 0.018, 0, SPELL_SFX_GAIN);
      blip(115, 170, 0.14, 'triangle', 0.012, 0.07, SPELL_SFX_GAIN);
      blip(190, 105, 0.18, 'sine', 0.014, 0.13, SPELL_SFX_GAIN);
      noise(0.34, 'lowpass', 620, 180, 0.018, 0.02, SPELL_SFX_GAIN);
      break;
    case 'meteor': // high incoming whistle into a heavy burning descent
      blip(1150, 260, 0.46, 'sine', 0.018, 0, SPELL_SFX_GAIN);
      noise(0.42, 'lowpass', 820, 120, 0.035, 0.08, SPELL_SFX_GAIN);
      blip(180, 70, 0.25, 'sawtooth', 0.022, 0.22, SPELL_SFX_GAIN);
      break;
    case 'drain': // red droplets siphoning downward along the tether
      arpeggio([760, 620, 480, 340], 'triangle', 0.014, 0.08, 0.055, SPELL_SFX_GAIN);
      blip(180, 120, 0.30, 'triangle', 0.016, 0.08, SPELL_SFX_GAIN);
      break;
    case 'orbs': // symmetric purple orbit chimes
      chord([660, 990, 0.20, 'sine', 0.014], [990, 1320, 0.20, 'sine', 0.012, 0.045], [1320, 990, 0.20, 'sine', 0.01, 0.09], SPELL_SFX_GAIN);
      break;
    case 'nova': // round holy wave expanding outward
      chord([392, 784, 0.38, 'sine', 0.025], [523, 1046, 0.36, 'triangle', 0.018, 0.035], [659, 1318, 0.34, 'sine', 0.014, 0.07], SPELL_SFX_GAIN);
      noise(0.24, 'highpass', 1800, 3300, 0.011, 0.08, SPELL_SFX_GAIN);
      break;
    case 'firebreath': // flame wave: swell, crest, and hot crash
      waveBreathSfx('fire', SPELL_SFX_GAIN);
      blip(180, 95, 0.20, 'sawtooth', 0.014, 0.18, SPELL_SFX_GAIN);
      break;
    case 'icebreath': // freezing wave: glassy swell with icy spray
      waveBreathSfx('ice', SPELL_SFX_GAIN);
      chord([1400, 2100, 0.18, 'sine', 0.009, 0.07], [2100, 2800, 0.16, 'sine', 0.008, 0.16], null, SPELL_SFX_GAIN);
      break;
    case 'earthbreath': // ground wave: rolling rumble and impact
      waveBreathSfx('earth', SPELL_SFX_GAIN);
      blip(90, 45, 0.34, 'sawtooth', 0.03, 0.16, SPELL_SFX_GAIN);
      break;
    case 'windbreath': // air wave: rushing swell and trailing gust
      waveBreathSfx('wind', SPELL_SFX_GAIN);
      blip(620, 980, 0.22, 'sine', 0.009, 0.15, SPELL_SFX_GAIN);
      break;
    default:
      blip(700, 320, 0.08, 'triangle', 0.016, 0, SPELL_SFX_GAIN);
  }
}

function sfx(name) {
  const now = performance.now();
  if (sfxLast[name] && now - sfxLast[name] < 50) return; // throttle spam
  sfxLast[name] = now;
  switch (name) {
    case 'shoot':  blip(700, 320, 0.08, 'triangle', 0.016, 0, SPELL_SFX_GAIN); break;
    case 'hit':    blip(300, 150, 0.06, 'triangle', 0.04); break;
    case 'boom':   blip(180, 40, 0.30, 'sawtooth', 0.07); break;
    case 'zap':    blip(1400, 200, 0.10, 'sawtooth', 0.035); break;
    case 'frost':  blip(900, 1400, 0.08, 'sine', 0.03); break;
    case 'pickup': blip(900, 1500, 0.07, 'sine', 0.035); break;
    case 'buy':    blip(600, 1200, 0.12, 'square', 0.045); break;
    case 'shopBuy':    chord([520, 900, 0.10, 'triangle', 0.028], [760, 1320, 0.12, 'sine', 0.022, 0.045]); break;
    case 'shopSpell':  chord([740, 1480, 0.14, 'sine', 0.026], [1110, 1665, 0.16, 'triangle', 0.018, 0.05]); break;
    case 'shopFuse':   chord([420, 840, 0.16, 'triangle', 0.03], [840, 1680, 0.22, 'sine', 0.026, 0.05], [1260, 1890, 0.18, 'sine', 0.018, 0.11]); break;
    case 'shopReroll': arpeggio([360, 520, 700, 520], 'square', 0.022, 0.045, 0.035); break;
    case 'shopLock':   blip(280, 620, 0.11, 'triangle', 0.035); blip(620, 420, 0.08, 'sine', 0.018, 0.07); break;
    case 'shopSell':   blip(820, 360, 0.16, 'triangle', 0.032); blip(520, 260, 0.10, 'sine', 0.018, 0.06); break;
    case 'shopDeny':   blip(160, 95, 0.12, 'sawtooth', 0.035); break;
    case 'shopLegendary': chord([392, 784, 0.22, 'sine', 0.036], [587, 1174, 0.24, 'triangle', 0.026, 0.05], [880, 1760, 0.20, 'sine', 0.018, 0.1]); break;
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
