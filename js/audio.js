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
const MUSIC_LOOKAHEAD = 0.18;
const MUSIC_MENU_STEP = 0.5;
const MUSIC_GAME_START_STEP = 0.44;
const MUSIC_GAME_END_STEP = 0.18;
const MUSIC_HEARTBEAT_END_STEP = 0.12;
const MUSIC_PATTERN = [
  { root: 146.83, fifth: 220.00, top: 369.99 }, // Dm9-ish
  { root: 130.81, fifth: 196.00, top: 329.63 }, // Cmaj7-ish
  { root: 174.61, fifth: 261.63, top: 440.00 }, // Fmaj9-ish
  { root: 110.00, fifth: 164.81, top: 293.66 }, // Am11-ish
];
const FIGHTER_PATTERN = [
  { root: 98.00, fifth: 146.83, top: 293.66 },
  { root: 116.54, fifth: 174.61, top: 349.23 },
  { root: 87.31, fifth: 130.81, top: 261.63 },
  { root: 130.81, fifth: 196.00, top: 392.00 },
];
const PIRATE_PATTERN = [
  { root: 146.83, fifth: 220.00, top: 293.66 }, // Dm
  { root: 130.81, fifth: 196.00, top: 261.63 }, // C
  { root: 116.54, fifth: 174.61, top: 233.08 }, // Bb
  { root: 110.00, fifth: 164.81, top: 220.00 }, // A
];
const TECHNO_PATTERN = [
  { root: 110.00, fifth: 164.81, top: 440.00 }, // A minor pulse
  { root: 130.81, fifth: 196.00, top: 523.25 }, // C lift
  { root: 98.00, fifth: 146.83, top: 392.00 },  // G pressure
  { root: 146.83, fifth: 220.00, top: 587.33 }, // Dm release
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

function soundtrackMode() {
  if (typeof game === 'undefined' || !game.opt) return 'ambient';
  if (game.opt.soundtrack === 'fighter') return 'fighter';
  if (game.opt.soundtrack === 'pirate') return 'pirate';
  if (game.opt.soundtrack === 'techno') return 'techno';
  return 'ambient';
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
  master.connect(audioCtx.destination);
  return { master, pad, sparkle, spaceWet, timer: null, next: audioCtx.currentTime, nextHeartbeat: 0, step: 0, running: false };
}

function musicLevel() {
  if (muted || pageAudioMuted || typeof game === 'undefined' || !game.opt || game.opt.volume === 0) return 0;
  const base = audioVolume('music');
  // Keep the soundtrack under spell SFX; it should feel present, not busy.
  if (game.state === 'playing') return 0.9 * base;
  if (['paused', 'levelup', 'mastery', 'shop', 'settings'].includes(game.state)) return 0.32 * base;
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
  if (typeof game === 'undefined' || game.state !== 'playing') return MUSIC_MENU_STEP;
  // Ease out so combat tempo ramps noticeably earlier instead of saving the
  // speed-up for only the final seconds.
  const rush = Math.sqrt(roundProgress());
  const mode = soundtrackMode();
  const endStep = mode === 'fighter' ? 0.14 : mode === 'pirate' ? 0.16 : mode === 'techno' ? 0.125 : MUSIC_GAME_END_STEP;
  const startStep = mode === 'fighter' ? 0.32 : mode === 'pirate' ? 0.38 : mode === 'techno' ? 0.25 : MUSIC_GAME_START_STEP;
  const combatStep = startStep + (endStep - startStep) * rush;
  return combatStep + (MUSIC_HEARTBEAT_END_STEP - combatStep) * finalHeartbeat();
}

function scheduleMusicTone(freq, start, dur, type, vol, dest, pan = 0, bend = 1) {
  if (!music || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.25);
  g.gain.setValueAtTime(vol, start + Math.max(0.26, dur - 0.7));
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
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filt).connect(g).connect(music.pad);
  src.start(start); src.stop(start + dur + 0.03);
}


function scheduleHeartbeatPhrase(start, root, gain) {
  if (!music || !audioCtx || gain <= 0) return;
  // Low "dö-dö-dömm-döm, dö dö dömm" phrase under the combat soundtrack.
  const hits = [
    [0.00, root, 0.10, 0.036], [0.12, root, 0.10, 0.030], [0.24, root * 0.75, 0.18, 0.050],
    [0.42, root * 0.9, 0.13, 0.038], [0.68, root, 0.10, 0.030], [0.86, root, 0.10, 0.028],
    [1.04, root * 0.75, 0.22, 0.052],
  ];
  for (const [delay, freq, dur, vol] of hits) scheduleMusicTone(freq, start + delay, dur, 'triangle', vol * gain, music.pad, 0, 0.68);
}


function scheduleFighterStep() {
  if (!music || muted || pageAudioMuted || audioVolume() <= 0) return;
  const barStep = music.step % 16;
  const chord = FIGHTER_PATTERN[Math.floor(barStep / 4) % FIGHTER_PATTERN.length];
  const t = music.next;
  const inCombat = typeof game !== 'undefined' && game.state === 'playing';
  const urgency = inCombat ? roundProgress() : 0;
  const step = currentMusicStep();
  const bass = [chord.root * 0.5, chord.root * 0.5, chord.fifth * 0.5, chord.root * 0.75][barStep % 4];
  scheduleMusicTone(bass, t, 0.16, 'square', 0.030 + urgency * 0.018, music.pad, -0.1, 0.78);
  if (barStep % 2 === 1) scheduleCombatNoise(t + 0.03, 0.13, 0.016 + urgency * 0.012);
  if (inCombat && barStep % 4 === 0) scheduleHeartbeatPhrase(t + 0.02, chord.root * 0.5, 0.26 + finalHeartbeat() * 0.9);
  if ([1, 3].includes(barStep % 4)) {
    const hook = [chord.top, chord.fifth * 1.5, chord.top * 0.75, chord.fifth][Math.floor(barStep / 4) % 4];
    scheduleMusicTone(hook, t + step * 0.45, 0.18, 'triangle', 0.012 + urgency * 0.004, music.sparkle, 0.35, 0.94);
  }
  if (barStep % 8 === 0) {
    scheduleMusicTone(chord.root, t, step * 7.5, 'sawtooth', 0.012, music.pad, -0.35, 1.002);
    scheduleMusicTone(chord.fifth, t + 0.04, step * 7, 'triangle', 0.010, music.pad, 0.25, 0.998);
  }
  music.next += step;
  music.step++;
}


function schedulePirateStep() {
  if (!music || muted || pageAudioMuted || audioVolume() <= 0) return;
  const barStep = music.step % 24;
  const chord = PIRATE_PATTERN[Math.floor(barStep / 6) % PIRATE_PATTERN.length];
  const t = music.next;
  const inCombat = typeof game !== 'undefined' && game.state === 'playing';
  const urgency = inCombat ? roundProgress() : 0;
  const step = currentMusicStep();
  const beat = barStep % 6;
  const drumGain = 0.020 + urgency * 0.014;
  if ([0, 3].includes(beat)) scheduleMusicTone(chord.root * 0.5, t, 0.18, 'triangle', 0.036 + urgency * 0.016, music.pad, -0.12, 0.7);
  if ([2, 5].includes(beat)) scheduleCombatNoise(t + 0.025, 0.12, drumGain);
  const shanty = [chord.root, chord.fifth, chord.top, chord.fifth, chord.root * 1.5, chord.fifth][beat];
  if (inCombat || [0, 3].includes(beat)) scheduleMusicTone(shanty, t + step * 0.28, 0.20, 'triangle', 0.014 + urgency * 0.004, music.sparkle, beat < 3 ? -0.28 : 0.28, 1.006);
  if (barStep % 6 === 0) {
    scheduleMusicTone(chord.root, t, step * 5.6, 'sawtooth', 0.012, music.pad, -0.25, 1.001);
    scheduleMusicTone(chord.fifth, t + 0.06, step * 5.2, 'triangle', 0.010, music.pad, 0.22, 0.998);
  }
  if (inCombat && barStep % 12 === 0) scheduleHeartbeatPhrase(t + step * 0.15, chord.root * 0.5, 0.22 + finalHeartbeat() * 0.75);
  music.next += step;
  music.step++;
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
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  let out = g;
  if (audioCtx.createStereoPanner) { const p = audioCtx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  src.connect(filt).connect(g); out.connect(music.sparkle);
  src.start(start); src.stop(start + dur + 0.02);
}

function scheduleTechnoStep() {
  if (!music || muted || pageAudioMuted || audioVolume() <= 0) return;
  const barStep = music.step % 32;
  const chord = TECHNO_PATTERN[Math.floor(barStep / 8) % TECHNO_PATTERN.length];
  const t = music.next;
  const inCombat = typeof game !== 'undefined' && game.state === 'playing';
  const urgency = inCombat ? roundProgress() : 0;
  const step = currentMusicStep();
  const beat = barStep % 4;
  const cutoffBend = 0.58 + urgency * 0.16;

  // Four-on-the-floor synth kick with a rubbery offbeat bass stab.
  if (beat === 0) {
    scheduleMusicTone(chord.root * 0.5, t, 0.18, 'sine', 0.050 + urgency * 0.018, music.pad, -0.05, 0.42);
    scheduleCombatNoise(t + 0.012, 0.055, 0.018 + urgency * 0.01);
  }
  if (beat === 2) scheduleCombatNoise(t + 0.018, 0.10, 0.014 + urgency * 0.008);
  if (beat === 1 || beat === 3) scheduleMusicTone(chord.fifth * 0.5, t + step * 0.18, 0.12, 'square', 0.024 + urgency * 0.010, music.pad, 0.10, cutoffBend);

  scheduleTechnoHat(t + step * 0.48, 0.045, 0.010 + urgency * 0.006, beat % 2 ? 0.35 : -0.35);
  if (inCombat && barStep % 2 === 1) scheduleTechnoHat(t + step * 0.18, 0.035, 0.006 + urgency * 0.004, Math.random() * 1.0 - 0.5);

  if (barStep % 8 === 0) {
    scheduleMusicTone(chord.root, t, step * 7.6, 'sawtooth', 0.015, music.pad, -0.28, 1.001);
    scheduleMusicTone(chord.fifth, t + 0.025, step * 7.4, 'triangle', 0.010, music.pad, 0.24, 0.999);
  }
  if ([3, 7].includes(barStep % 8)) {
    const riff = [chord.top, chord.top * 0.75, chord.fifth * 2, chord.top * 1.125][Math.floor(barStep / 8) % 4];
    scheduleMusicTone(riff, t + step * 0.25, 0.10, 'square', 0.010 + urgency * 0.005, music.sparkle, 0.42, 1.012);
  }
  if (inCombat && barStep % 16 === 0) scheduleHeartbeatPhrase(t + step * 0.08, chord.root * 0.5, 0.18 + finalHeartbeat() * 0.65);

  music.next += step;
  music.step++;
}

function scheduleMusicStep() {
  if (soundtrackMode() === 'techno') { scheduleTechnoStep(); return; }
  if (soundtrackMode() === 'fighter') { scheduleFighterStep(); return; }
  if (soundtrackMode() === 'pirate') { schedulePirateStep(); return; }
  if (!music || muted || pageAudioMuted || audioVolume() <= 0) return;
  const barStep = music.step % 32;
  const chord = MUSIC_PATTERN[Math.floor(barStep / 8) % MUSIC_PATTERN.length];
  const t = music.next;
  if (barStep % 8 === 0) {
    scheduleMusicTone(chord.root, t, game.state === 'playing' ? 3.0 : 4.4, 'sine', 0.055, music.pad, -0.22, 1.004);
    scheduleMusicTone(chord.fifth, t + 0.08, game.state === 'playing' ? 2.8 : 4.2, 'triangle', 0.034, music.pad, 0.18, 0.997);
    scheduleMusicTone(chord.top, t + 0.18, game.state === 'playing' ? 2.5 : 3.8, 'sine', 0.022, music.pad, 0.38, 1.002);
  }
  const inCombat = typeof game !== 'undefined' && game.state === 'playing';
  const urgency = inCombat ? roundProgress() : 0;
  if (inCombat) {
    const heartbeat = finalHeartbeat();
    const pulse = chord.root * 0.5;
    scheduleMusicTone(pulse, t, 0.20, 'triangle', 0.030 + urgency * 0.016, music.pad, -0.05, 0.72);
    if (barStep % 2 === 1) scheduleCombatNoise(t + 0.04, 0.16, 0.018 + urgency * 0.010);
    if (urgency > 0.65 && barStep % 2 === 0) scheduleMusicTone(chord.root, t + currentMusicStep() * 0.48, 0.12, 'triangle', 0.012, music.pad, 0.08, 0.86);
    if (t >= (music.nextHeartbeat || 0)) {
      scheduleHeartbeatPhrase(t, pulse, 0.34 + heartbeat * 1.1);
      music.nextHeartbeat = t + 2.15 - heartbeat * 1.45;
    }
  }
  if ([2, 5].includes(barStep % 8)) {
    const note = [chord.root, chord.fifth, chord.top, chord.root * 2][Math.floor(Math.random() * 4)];
    scheduleMusicTone(note, t + 0.03, inCombat ? 0.8 : 1.15, 'sine', inCombat ? 0.010 : 0.014, music.sparkle, Math.random() * 1.2 - 0.6, 1.01);
  }
  if (!inCombat && barStep % 4 === 3) scheduleMusicNoise(t + 0.12, 1.1, 0.014, Math.random() * 1.2 - 0.6);
  if (inCombat && [1, 3, 6].includes(barStep % 8)) {
    const driftNotes = [chord.root * 1.5, chord.fifth * 1.5, chord.top, chord.root * 2];
    const drift = driftNotes[Math.floor(Math.random() * driftNotes.length)];
    scheduleMusicTone(drift, t + 0.02, 0.50 - urgency * 0.12, 'sine', 0.008 + urgency * 0.003, music.sparkle, Math.random() * 1.4 - 0.7, 1.012);
    if (urgency > 0.55) scheduleMusicTone(drift * 0.75, t + 0.16, 0.32, 'triangle', 0.005, music.sparkle, Math.random() * 1.2 - 0.6, 0.99);
  }
  music.next += currentMusicStep();
  music.step++;
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
  o.connect(g).connect(audioCtx.destination);
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
