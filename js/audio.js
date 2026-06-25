'use strict';

// ===========================================================================
// Audio — tiny WebAudio synth (blips + filtered noise) & per-spell sounds
// ===========================================================================

let audioCtx = null;
let muted = false;
let pageAudioMuted = false;
const sfxLast = {};
const SPELL_SFX_GAIN = 0.68;
let activeAudioCategory = 'spell';
const MENU_SFX = new Set(['buy', 'shopBuy', 'shopSpell', 'shopFuse', 'shopReroll', 'shopLock', 'shopSell', 'shopDeny', 'shopLegendary', 'sell']);

let music = null;
let audioOut = null;
const MUSIC_LOOKAHEAD = 0.18;
const MUSIC_MENU_STEP = 0.5;   // relaxed tempo in menus
const ARCANE_STEP = 0.26;      // steady combat tempo — the base soundtrack never speeds up
// "Arcane Battle" — a dramatic minor progression (Am · G · F · E) for the wizard
// arena: driving bass + four-on-the-floor under a memorable arcane lead, with a
// harmonic-minor G# leading tone before the loop for tension.
const ARCANE_PATTERN = [
  { root: 110.00, fifth: 164.81, top: 329.63 }, // Am
  { root: 98.00,  fifth: 146.83, top: 392.00 }, // G
  { root: 87.31,  fifth: 130.81, top: 349.23 }, // F
  { root: 82.41,  fifth: 123.47, top: 329.63 }, // E (→ G# leading tone in the lead)
];
// 16-step lead hook (one note per step, null = rest) over the 4-bar progression.
const ARCANE_MELODY = [
  440.00, null,   523.25, 659.25, // Am:  A · · C  E
  587.33, 523.25, 493.88, null,   // G:   D  C  B ·
  523.25, 440.00, 349.23, null,   // F:   C  A  F ·
  415.30, 493.88, 659.25, 587.33, // E:   G# B  E  D  (resolves back to A)
];

function ensureAudio(startMusic = true) {
  if (muted || pageAudioMuted) return false;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { muted = true; return false; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  if (startMusic && typeof game !== 'undefined' && musicLevel() > 0) setTimeout(updateSoundtrack, 0);
  return true;
}

function audioVolume(category = 'master') {
  const master = game.opt && game.opt.volume !== undefined ? game.opt.volume : 1;
  if (category === 'music') return master * (game.opt && game.opt.musicVolume !== undefined ? game.opt.musicVolume : 1);
  if (category === 'menu') return master * (game.opt && game.opt.menuVolume !== undefined ? game.opt.menuVolume : 1);
  if (category === 'spell') return master * (game.opt && game.opt.spellVolume !== undefined ? game.opt.spellVolume : 1);
  return master;
}

function withAudioCategory(category, fn) {
  const prev = activeAudioCategory;
  activeAudioCategory = category;
  try { return fn(); } finally { activeAudioCategory = prev; }
}

function soundtrackMode() { return 'arcane'; } // only one soundtrack: Arcane Battle

function getAudioOutput() {
  if (!audioCtx) return null;
  if (audioOut) return audioOut;
  const input = audioCtx.createGain();
  input.gain.value = 0.86;
  let output = input;
  if (audioCtx.createDynamicsCompressor) {
    const comp = audioCtx.createDynamicsCompressor();
    // Conservative full-mix limiter: the revised soundtrack stacks sustained pads,
    // bass, hats, delay tails, and spell SFX. Catch those combined peaks before
    // they hit the browser output and turn into audible crackle.
    comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 10;
    comp.attack.value = 0.003; comp.release.value = 0.16;
    input.connect(comp);
    output = comp;
  }
  output.connect(audioCtx.destination);
  audioOut = input;
  return audioOut;
}

function makeMusic() {
  if (!ensureAudio(false)) return null;
  const master = audioCtx.createGain();
  const pad = audioCtx.createGain();
  const sparkle = audioCtx.createGain();
  const lowpass = audioCtx.createBiquadFilter();
  const spaceDelay = audioCtx.createDelay();
  const delayFeedback = audioCtx.createGain();
  const spaceWet = audioCtx.createGain();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1850;
  lowpass.Q.value = 0.7;
  spaceDelay.delayTime.value = 0.42;
  delayFeedback.gain.value = 0.28;
  spaceWet.gain.value = 0;
  pad.gain.value = 1;
  sparkle.gain.value = 1;
  pad.connect(lowpass).connect(master);
  sparkle.connect(master);
  sparkle.connect(spaceDelay);
  spaceDelay.connect(delayFeedback).connect(spaceDelay);
  spaceDelay.connect(spaceWet).connect(master);
  master.gain.value = 0;
  // soft limiter on the music bus: tames peaks when many voices stack so the mix
  // never clips into harsh digital crackle
  let tail = master;
  if (audioCtx.createDynamicsCompressor) {
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 5;
    comp.attack.value = 0.006; comp.release.value = 0.20;
    master.connect(comp); tail = comp;
  }
  tail.connect(getAudioOutput());
  return { master, pad, sparkle, spaceWet, timer: null, next: audioCtx.currentTime, nextHeartbeat: 0, step: 0, running: false };
}

function musicLevel() {
  if (muted || pageAudioMuted || typeof game === 'undefined' || !game.opt || game.opt.volume === 0) return 0;
  const base = audioVolume('music');
  // Keep the soundtrack under spell SFX; it should feel present, not busy.
  if (game.state === 'playing') return 0.72 * base;
  if (['paused', 'levelup', 'mastery', 'shop', 'settings'].includes(game.state)) return 0.26 * base;
  return 0;
}

function roundProgress() {
  if (typeof game === 'undefined' || game.state !== 'playing') return 0;
  const dur = Number.isFinite(game.waveDur) ? game.waveDur : 60;
  return Math.max(0, Math.min(1, (game.waveTime || 0) / Math.max(1, dur)));
}

function roundRemaining() {
  if (typeof game === 'undefined' || game.state !== 'playing' || !Number.isFinite(game.waveDur)) return Infinity;
  return Math.max(0, game.waveDur - (game.waveTime || 0));
}

function finalHeartbeat() {
  const left = roundRemaining();
  return left <= 10 ? 1 - left / 10 : 0;
}

function currentMusicStep() {
  // Constant tempo: the base soundtrack never speeds up — only the heartbeat does.
  if (typeof game === 'undefined' || game.state !== 'playing') return MUSIC_MENU_STEP;
  return ARCANE_STEP;
}

// The heartbeat is the only thing that accelerates: its interval shrinks as the
// wave progresses, then races in the final 10 seconds.
function heartbeatInterval() {
  const iv = 1.15 - roundProgress() * 0.5 - finalHeartbeat() * 0.45;
  return Math.max(0.34, iv);
}

function scheduleMusicTone(freq, start, dur, type, vol, dest, pan = 0, bend = 1) {
  if (!music || !audioCtx || !(vol > 0)) return; // exp envelope needs a positive target
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), start + dur);
  // Smooth, click-free envelope that scales to the note length: gentle exponential
  // attack & release (no hard value steps), so short notes don't pop and long pads
  // fade cleanly. Longer notes get a longer, softer attack/release.
  const atk = Math.min(0.5, Math.max(0.012, dur * 0.35));
  const rel = Math.min(1.2, Math.max(0.06, dur * 0.5));
  const sustainAt = start + Math.max(atk, dur - rel);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + atk);
  g.gain.setValueAtTime(vol, sustainAt);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  let out = g;
  if (audioCtx.createStereoPanner) {
    const p = audioCtx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p); out = p;
  }
  osc.connect(g);
  out.connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function scheduleMusicNoise(start, dur, vol, pan = 0) {
  if (!music || !audioCtx) return;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const filt = audioCtx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 2500 + Math.random() * 1800; filt.Q.value = 8;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  let out = g;
  if (audioCtx.createStereoPanner) { const p = audioCtx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  src.connect(filt).connect(g); out.connect(music.sparkle);
  src.start(start); src.stop(start + dur + 0.05);
}


function scheduleCombatNoise(start, dur, vol) {
  if (!music || !audioCtx) return;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const filt = audioCtx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 520; filt.Q.value = 0.8;
  const g = audioCtx.createGain();
  // soft 3ms attack instead of an instant jump → no onset click ("GSM buzz")
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filt).connect(g).connect(music.pad);
  src.start(start); src.stop(start + dur + 0.03);
}


// A single kick-drum thud (pitched-down sine + lowpassed noise body).
function heartKick(start, vol) {
  if (!music || !audioCtx) return;
  scheduleMusicTone(95, start, 0.20, 'sine', vol, music.pad, 0, 0.42);
  scheduleCombatNoise(start + 0.004, 0.07, vol * 0.55);
}

// A real "lub-dub" heartbeat drum (replaces the old tonal phrase).
function scheduleHeartbeatPhrase(start, root, gain) {
  if (!music || !audioCtx || gain <= 0) return;
  heartKick(start, 0.062 * gain);          // lub
  heartKick(start + 0.17, 0.046 * gain);   // dub
}

function scheduleTechnoHat(start, dur, vol, pan = 0) {
  if (!music || !audioCtx) return;
  const n = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const filt = audioCtx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 5200; filt.Q.value = 0.8;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, start);           // 2ms attack → no high-freq click
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  let out = g;
  if (audioCtx.createStereoPanner) { const p = audioCtx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  src.connect(filt).connect(g); out.connect(music.sparkle);
  src.start(start); src.stop(start + dur + 0.02);
}

// "Arcane Battle": melodic minor battle theme — sustained pad, driving bass,
// four-on-the-floor percussion, and a recognizable arcane lead hook that all
// intensify as the wave clock runs down.
function scheduleArcaneStep() {
  if (!music || muted || pageAudioMuted || audioVolume() <= 0) return;
  const cycle = music.step % 16;
  const chord = ARCANE_PATTERN[Math.floor(cycle / 4) % ARCANE_PATTERN.length];
  const t = music.next;
  const inCombat = typeof game !== 'undefined' && game.state === 'playing';
  const urgency = inCombat ? roundProgress() : 0;
  const step = currentMusicStep();
  const beat = cycle % 4;

  // sustained chord pad at the head of each bar — runs LONGER than the bar so it
  // overlaps (crossfades into) the next bar's pad, removing the per-loop seam.
  if (beat === 0) {
    const padDur = step * 5.2; // bar = 4 steps; ~1.2 steps of overlap for a seamless join
    scheduleMusicTone(chord.root, t, padDur, 'triangle', 0.013 + urgency * 0.004, music.pad, -0.28, 1.001);
    scheduleMusicTone(chord.fifth, t + 0.03, padDur, 'triangle', 0.010, music.pad, 0.22, 0.999);
    scheduleMusicTone(chord.top, t + 0.06, padDur, 'sine', 0.0075, music.pad, 0.4, 1.002);
  }

  // driving bass: smooth triangle root each step, soft octave push on the offbeat
  scheduleMusicTone(chord.root * 0.5, t, step * 0.95, 'triangle', 0.026 + urgency * 0.010, music.pad, -0.08, 1.0);
  if (inCombat) scheduleMusicTone(chord.root, t + step * 0.5, step * 0.5, 'sine', 0.009 + urgency * 0.007, music.pad, 0.06, 1.0);

  // percussion: kick body on each beat, bright backbeat on beat 2, hats while fighting
  scheduleCombatNoise(t + 0.008, 0.06, 0.011 + urgency * 0.008);
  if (beat === 2) scheduleMusicNoise(t + 0.01, 0.12, 0.008 + urgency * 0.008, 0.05);
  if (inCombat) {
    scheduleTechnoHat(t + step * 0.5, 0.04, 0.006 + urgency * 0.004, beat % 2 ? 0.3 : -0.3);
    if (urgency > 0.4 && beat % 2 === 1) scheduleTechnoHat(t + step * 0.25, 0.03, 0.0035 + urgency * 0.003, Math.random() - 0.5);
  }

  // the arcane lead hook — the recognizable melody (plays softer in menus)
  const mel = ARCANE_MELODY[cycle];
  if (mel) {
    const leadVol = (inCombat ? 0.012 : 0.008) + urgency * 0.004;
    scheduleMusicTone(mel, t + step * 0.04, step * 0.92, 'triangle', leadVol, music.sparkle, 0.0, 1.0);
    scheduleMusicTone(mel * 2, t + step * 0.05, step * 0.5, 'sine', leadVol * 0.4, music.sparkle, 0.25, 1.0);
  }

  // On the last step, add a quiet pickup that resolves into the next cycle. It
  // masks the 16-step boundary without changing tempo, making the soundtrack feel
  // like one continuous loop instead of a restarted phrase.
  if (cycle === 15) {
    scheduleMusicTone(415.30, t + step * 0.55, step * 0.42, 'sine', 0.006 + urgency * 0.0025, music.sparkle, -0.16, 1.006);
    scheduleMusicTone(493.88, t + step * 0.78, step * 0.26, 'triangle', 0.0045 + urgency * 0.002, music.sparkle, 0.18, 1.004);
  }

  // heartbeat drum on its OWN accelerating cadence (the base tempo stays constant);
  // it quickens as the wave runs down and races in the final 10 seconds.
  if (inCombat && t >= (music.nextHeartbeat || 0)) {
    scheduleHeartbeatPhrase(t, chord.root * 0.5, 0.55 + finalHeartbeat() * 0.6);
    music.nextHeartbeat = t + heartbeatInterval();
  }

  music.next += step;
  music.step++;
}

function scheduleMusicStep() {
  scheduleArcaneStep(); // the only soundtrack
}

function updateSoundtrack() {
  const target = musicLevel();
  if (target <= 0 && !music) return;
  if (!music) music = makeMusic();
  if (!music || !audioCtx) return;
  const t = audioCtx.currentTime;
  music.master.gain.cancelScheduledValues(t);
  music.master.gain.setTargetAtTime(target, t, target > 0 ? 0.8 : 0.25);
  if (music.spaceWet) music.spaceWet.gain.setTargetAtTime(game.state === 'playing' ? 1 : 0, t, 0.35);
  if (target > 0 && !music.running) {
    music.running = true;
    music.next = Math.max(music.next || t, t + 0.04);
    while (music.next < audioCtx.currentTime + MUSIC_LOOKAHEAD) scheduleMusicStep();
    music.timer = setInterval(() => {
      if (!music || !audioCtx) return;
      while (music.next < audioCtx.currentTime + MUSIC_LOOKAHEAD) scheduleMusicStep();
    }, 80);
  } else if (target <= 0 && music.running) {
    music.running = false;
    clearInterval(music.timer);
    music.timer = null;
    music.next = t + 0.2;
  }
}


function setPageAudioMuted(on) {
  pageAudioMuted = !!on;
  updateSoundtrack();
  if (!audioCtx) return;
  if (pageAudioMuted) audioCtx.suspend().catch(() => {});
  else if (!muted && audioVolume() > 0) audioCtx.resume().then(() => updateSoundtrack()).catch(() => {});
}

function blip(f0, f1, dur, type, vol, delay = 0, gain = 1) {
  const v = vol * gain * audioVolume(activeAudioCategory);
  if (muted || pageAudioMuted || v <= 0) return;
  vol = v;
  if (!ensureAudio()) return;
  const t = audioCtx.currentTime + delay;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(getAudioOutput());
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Filtered white-noise burst — for whooshes, fire/wind/earth/ice breath, etc.
function noise(dur, filterType, f0, f1, vol, delay = 0, gain = 1) {
  const v = vol * gain * audioVolume(activeAudioCategory);
  if (muted || pageAudioMuted || v <= 0) return;
  if (!ensureAudio()) return;
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
  src.connect(filt).connect(g).connect(getAudioOutput());
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Layered soft tones; note arrays may omit delay, so append gain safely.
function playTone(note, gain = 1) { if (note) blip(note[0], note[1], note[2], note[3], note[4], note[5] || 0, gain); }
function chord(a, b, c, gain = 1) { playTone(a, gain); playTone(b, gain); playTone(c, gain); }
function arpeggio(notes, type, vol, dur = 0.08, gap = 0.045, gain = 1) {
  notes.forEach((f, i) => blip(f, f * 1.08, dur, type, vol, i * gap, gain));
}
function debrisBurst(dur, f0, f1, vol, delay = 0, gain = 1) {
  noise(dur, 'bandpass', f0, f1, vol, delay, gain);
  noise(dur * 0.55, 'highpass', f0 * 1.8, f1 * 1.35, vol * 0.45, delay + dur * 0.12, gain);
}

function impactThump(freq = 120, delay = 0, gain = 1) {
  blip(freq, Math.max(35, freq * 0.34), 0.16, 'sine', 0.026, delay, gain);
  noise(0.09, 'lowpass', 260, 80, 0.018, delay + 0.012, gain);
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
  return withAudioCategory('spell', () => {
  switch (id) {
    case 'missile': // arcane rail-dart: pressure snap, rune ticks, and doppler tail
      debrisBurst(0.06, 2600, 6200, 0.012, 0, SPELL_SFX_GAIN);
      arpeggio([980, 1470, 1960, 2940], 'triangle', 0.009, 0.036, 0.020, SPELL_SFX_GAIN);
      blip(2600, 720, 0.12, 'sine', 0.012, 0.055, SPELL_SFX_GAIN);
      break;
    case 'fireball': // palm ignition, pressure bloom, ember spit, and rolling flame body
      impactThump(118, 0, SPELL_SFX_GAIN);
      blip(520, 1180, 0.08, 'sawtooth', 0.011, 0.018, SPELL_SFX_GAIN);
      noise(0.42, 'lowpass', 2200, 230, 0.040, 0.025, SPELL_SFX_GAIN);
      debrisBurst(0.16, 1600, 4200, 0.012, 0.075, SPELL_SFX_GAIN);
      break;
    case 'frost': // flash-freeze: cold inhale, crystal fork, and brittle spray
      noise(0.20, 'highpass', 5200, 2800, 0.012, 0, SPELL_SFX_GAIN);
      chord([1320, 2110, 0.15, 'sine', 0.012, 0.015], [1980, 3020, 0.12, 'triangle', 0.010, 0.045], [660, 990, 0.19, 'sine', 0.007, 0.075], SPELL_SFX_GAIN);
      debrisBurst(0.16, 4200, 6800, 0.012, 0.07, SPELL_SFX_GAIN);
      break;
    case 'lightning': // forked arc: transformer buzz, crack, and delayed thunderlet
      noise(0.055, 'bandpass', 5600, 900, 0.024, 0, SPELL_SFX_GAIN);
      arpeggio([3100, 740, 2480, 580, 1900], 'square', 0.011, 0.026, 0.012, SPELL_SFX_GAIN);
      noise(0.14, 'bandpass', 1200, 2600, 0.010, 0.035, SPELL_SFX_GAIN);
      impactThump(155, 0.055, SPELL_SFX_GAIN);
      break;
    case 'shield': // ward plates unfolding into a resonant glass dome
      impactThump(210, 0, SPELL_SFX_GAIN);
      chord([330, 660, 0.30, 'sine', 0.018, 0.015], [495, 990, 0.32, 'triangle', 0.014, 0.045], [1320, 1320, 0.18, 'sine', 0.009, 0.09], SPELL_SFX_GAIN);
      debrisBurst(0.10, 1800, 4200, 0.007, 0.06, SPELL_SFX_GAIN);
      break;
    case 'poison': // caustic flask slosh, wet bubbles, and pressurized gas leak
      noise(0.24, 'lowpass', 520, 160, 0.018, 0, SPELL_SFX_GAIN);
      blip(130, 78, 0.18, 'sine', 0.017, 0.015, SPELL_SFX_GAIN);
      blip(95, 155, 0.11, 'triangle', 0.011, 0.09, SPELL_SFX_GAIN);
      blip(180, 105, 0.15, 'sine', 0.012, 0.17, SPELL_SFX_GAIN);
      noise(0.40, 'bandpass', 900, 260, 0.014, 0.05, SPELL_SFX_GAIN);
      break;
    case 'meteor': // sky tear, accelerating stone, ground punch, and rubble scatter
      blip(1500, 190, 0.52, 'sine', 0.014, 0, SPELL_SFX_GAIN);
      noise(0.54, 'lowpass', 1200, 95, 0.032, 0.04, SPELL_SFX_GAIN);
      impactThump(185, 0.24, SPELL_SFX_GAIN);
      blip(72, 38, 0.28, 'sawtooth', 0.020, 0.26, SPELL_SFX_GAIN);
      debrisBurst(0.22, 480, 2200, 0.020, 0.27, SPELL_SFX_GAIN);
      break;
    case 'drain': // heartbeat siphon with reversed-feeling droplets and a vein hum
      blip(240, 160, 0.18, 'triangle', 0.014, 0, SPELL_SFX_GAIN);
      arpeggio([820, 690, 540, 390, 260], 'sine', 0.011, 0.070, 0.045, SPELL_SFX_GAIN);
      noise(0.30, 'bandpass', 740, 180, 0.010, 0.06, SPELL_SFX_GAIN);
      blip(150, 92, 0.32, 'sawtooth', 0.012, 0.10, SPELL_SFX_GAIN);
      break;
    case 'orbs': // orbital motor spin-up with alternating satellite glints
      blip(260, 520, 0.22, 'triangle', 0.011, 0, SPELL_SFX_GAIN);
      arpeggio([660, 990, 1320, 990, 1480, 1110], 'sine', 0.009, 0.055, 0.030, SPELL_SFX_GAIN);
      noise(0.16, 'bandpass', 1400, 2400, 0.006, 0.07, SPELL_SFX_GAIN);
      break;
    case 'nova': // choir-like inhale into a radiant pressure ring
      noise(0.18, 'highpass', 1200, 3000, 0.008, 0, SPELL_SFX_GAIN);
      chord([392, 784, 0.42, 'sine', 0.022, 0.02], [523, 1046, 0.40, 'triangle', 0.017, 0.055], [659, 1318, 0.38, 'sine', 0.013, 0.095], SPELL_SFX_GAIN);
      impactThump(260, 0.09, SPELL_SFX_GAIN);
      debrisBurst(0.20, 2200, 4600, 0.008, 0.12, SPELL_SFX_GAIN);
      break;
    case 'firebreath': // dragon exhale: chest rumble, pilot flame, then broad roar
      blip(95, 55, 0.30, 'sawtooth', 0.020, 0, SPELL_SFX_GAIN);
      blip(420, 980, 0.10, 'sawtooth', 0.010, 0.035, SPELL_SFX_GAIN);
      waveBreathSfx('fire', SPELL_SFX_GAIN);
      debrisBurst(0.18, 1200, 3600, 0.011, 0.14, SPELL_SFX_GAIN);
      break;
    case 'icebreath': // cryogenic vent: glass ping, powder hiss, and freezing wave
      chord([1500, 2250, 0.16, 'sine', 0.009, 0], [2400, 3100, 0.13, 'sine', 0.007, 0.055], null, SPELL_SFX_GAIN);
      waveBreathSfx('ice', SPELL_SFX_GAIN);
      debrisBurst(0.18, 4800, 7200, 0.010, 0.15, SPELL_SFX_GAIN);
      break;
    case 'earthbreath': // gravel intake, sub-bass shove, and tumbling stones
      noise(0.18, 'lowpass', 420, 90, 0.018, 0, SPELL_SFX_GAIN);
      waveBreathSfx('earth', SPELL_SFX_GAIN);
      impactThump(88, 0.13, SPELL_SFX_GAIN);
      debrisBurst(0.26, 240, 1100, 0.020, 0.16, SPELL_SFX_GAIN);
      break;
    case 'windbreath': // pressure inhale, slicing gust, and airy whistle tail
      noise(0.18, 'bandpass', 520, 1800, 0.014, 0, SPELL_SFX_GAIN);
      waveBreathSfx('wind', SPELL_SFX_GAIN);
      blip(720, 1220, 0.24, 'sine', 0.008, 0.13, SPELL_SFX_GAIN);
      noise(0.34, 'highpass', 2600, 5200, 0.010, 0.16, SPELL_SFX_GAIN);
      break;
    default:
      blip(700, 320, 0.08, 'triangle', 0.016, 0, SPELL_SFX_GAIN);
  }
  });
}

function sfx(name) {
  const now = performance.now();
  if (sfxLast[name] && now - sfxLast[name] < 50) return; // throttle spam
  sfxLast[name] = now;
  return withAudioCategory(MENU_SFX.has(name) ? 'menu' : 'spell', () => {
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
  });
}
