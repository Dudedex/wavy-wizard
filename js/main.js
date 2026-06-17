'use strict';

// ===========================================================================
// Wavy-Wizards — Brotato-style arena survival with spells instead of weapons.
// Vanilla JS + Canvas, no build step.
// ===========================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const WALL = 26; // arena wall thickness

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function weightedPick(pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let roll = Math.random() * total;
  for (const [v, w] of pairs) { roll -= w; if (roll <= 0) return v; }
  return pairs[pairs.length - 1][0];
}


// ---------------------------------------------------------------------------
// Input & spell hotkeys
// ---------------------------------------------------------------------------
const keys = {};

// one-time cleanup of legacy "browizard-" storage (renamed to "wavywizards-")
try { ['browizard-save', 'browizard-wins', 'browizard-keys', 'browizard-danger', 'browizard-opts'].forEach(k => localStorage.removeItem(k)); } catch (e) { /* private mode */ }

const DEFAULT_SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
let slotKeys = [...DEFAULT_SLOT_KEYS];
try {
  const saved = JSON.parse(localStorage.getItem('wavywizards-keys'));
  if (Array.isArray(saved) && saved.length === MAX_SPELL_SLOTS) slotKeys = saved;
} catch (e) { /* corrupted save, keep defaults */ }

let rebindSlot = null; // slot index currently waiting for a key press
const RESERVED_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyP', 'KeyM', 'Escape', 'Tab'];

function keyLabel(code) {
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Numpad')) return 'N' + code.slice(6);
  if (code === 'Space') return 'SPC';
  return code.slice(0, 4).toUpperCase();
}

function manualCast(slot) {
  const sp = game.player.spells[slot];
  if (!sp || sp.id === 'orbs' || sp.t > 0 || sp.disabled > 0) return;
  if (game.player.stats.concentrator && game.player.moving) return; // only casts while still
  const def = SPELLS[sp.id];
  if (tryCast(sp)) sp.t = def.tiers[sp.tier].cd * game.player.stats.cdMult * (game.modCdMult || 1) * masteryMod(sp.id).cdMult;
}

function toggleAuto(slot) {
  const sp = game.player.spells[slot];
  if (!sp || sp.id === 'orbs') return;
  sp.auto = sp.auto === false;
  addText(game.player.x, game.player.y - 44, `${SPELLS[sp.id].name}: ${sp.auto ? 'AUTO' : 'MANUAL'}`, '#9fb0c8', 14);
}

window.addEventListener('keydown', e => {
  if (rebindSlot !== null) {
    e.preventDefault();
    const taken = slotKeys.includes(e.code) && slotKeys[rebindSlot] !== e.code;
    if (!RESERVED_KEYS.includes(e.code) && !taken) {
      slotKeys[rebindSlot] = e.code;
      try { localStorage.setItem('wavywizards-keys', JSON.stringify(slotKeys)); } catch (err) { /* private mode */ }
    }
    rebindSlot = null;
    renderKeybinds();
    return;
  }
  keys[e.code] = true;
  if (e.code === 'KeyM') { muted = !muted; game.opt.muted = muted; saveOpts(); addText(game.player.x, game.player.y - 40, muted ? 'MUTED' : 'SOUND ON', '#9fb0c8', 14); }
  if (e.code === 'Tab') { game.showMeter = !game.showMeter; e.preventDefault(); }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (game.state === 'playing') {
    const slot = slotKeys.indexOf(e.code);
    if (slot !== -1) {
      if (e.shiftKey) toggleAuto(slot);
      else manualCast(slot);
    }
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ---------------------------------------------------------------------------
// Controller support (Gamepad API): left stick / d-pad moves, face buttons +
// bumpers cast spell slots 1-6, Start pauses, Select toggles the damage meter.
// ---------------------------------------------------------------------------
// Up to two gamepads: index 0 drives P1 (or solo), index 1 drives P2 in co-op.
const padStates = [{ moveX: 0, moveY: 0, last: [] }, { moveX: 0, moveY: 0, last: [] }];
const padState = padStates[0]; // back-compat alias for solo references

function pollGamepad() {
  let pads = [];
  try { pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(g => g && g.connected) : []; }
  catch (e) { return; }
  const dz = v => (Math.abs(v) > 0.22 ? v : 0);
  for (let idx = 0; idx < 2; idx++) {
    const ps = padStates[idx];
    const gp = pads[idx];
    ps.moveX = 0; ps.moveY = 0;
    if (!gp) { ps.last = []; continue; }
    ps.moveX = dz(gp.axes[0] || 0);
    ps.moveY = dz(gp.axes[1] || 0);
    const pressed = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (pressed(14)) ps.moveX = -1;
    if (pressed(15)) ps.moveX = 1;
    if (pressed(12)) ps.moveY = -1;
    if (pressed(13)) ps.moveY = 1;
    const edge = i => pressed(i) && !ps.last[i];
    if (idx === 0) { // pad 1 also handles casting / pause / meter
      if (game.state === 'playing') for (let i = 0; i < 6; i++) if (edge(i)) manualCast(i);
      if (edge(9)) togglePause();
      if (edge(8)) game.showMeter = !game.showMeter;
    }
    ps.last = gp.buttons.map(b => b.pressed);
  }
}
window.addEventListener('blur', () => { if (game.state === 'playing') togglePause(); });

// Hover the in-game damage meter (canvas) to see a spell's full details.
canvas.addEventListener('mousemove', e => {
  const boxes = game.meterBoxes || [];
  if (!boxes.length) { hideTooltip(); return; }
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (W / rect.width);
  const cy = (e.clientY - rect.top) * (H / rect.height);
  const hit = boxes.find(b => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
  if (hit) {
    const sp = game.player.spells.find(s => s.id === hit.id) || { id: hit.id, tier: 0 };
    showTooltip(spellDetailHtml(sp), e.clientX, e.clientY);
  } else hideTooltip();
});
canvas.addEventListener('mouseleave', hideTooltip);

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
// Last Resort variants (bought/upgraded at the altar after it breaks once).
const LAST_RESORT_TYPES = {
  basic:    { name: 'Last Resort',          icon: '✦',  color: '#ffd454', cry: 'NOT TODAY',      desc: 'Survive lethal damage once, clinging to 1 HP.' },
  phoenix:  { name: 'Phoenix Last Resort',  icon: '🔥🕊️', color: '#ff9a3c', cry: 'REBORN!',        desc: 'Revive at 30% HP instead of 1 HP.' },
  vengeful: { name: 'Vengeful Last Resort', icon: '💢', color: '#ff5577', cry: 'VENGEANCE!',     desc: 'The break nova blasts every nearby enemy for heavy damage.' },
  greedy:   { name: 'Greedy Last Resort',   icon: '🪙', color: '#ffd454', cry: 'PAY UP!',        desc: 'Revive and shatter nearby enemies into gems.' },
};

function freshStats() {
  return {
    maxHp: 60, regen: 0, dmgMult: 1, cdMult: 1, crit: 0.03, critMult: 2,
    speedMult: 1, armor: 0, pickup: 80, matMult: 1,
    priceMult: 1, healMult: 1, reclaim: 0,
    rangeMult: 1, rangePerkMult: 1, areaMult: 1, doubleCast: false,
    concentrator: false,
    maxSlots: MAX_SPELL_SLOTS,
    // synergy / positioning item stats
    burnGround: 0, frostAmp: 0, stormCrit: 0, orbSpeed: 0, martyr: 0,
    pointBlank: 0, duelist: 0, panicBell: 0,
    // character-specific
    aura: 0, critHeal: 0, wildEvery: 0,
    // spell-modifying relics
    splitWand: 0, dotCrit: false, echoEvery: 0, gravity: false, brittle: false, stormBattery: false,
    // drawback-driven characters
    gambler: false, summoner: false, collector: false, cursedKing: false, rando: false,
  };
}

// Rando: re-roll the whole spellbook at random each wave. Each spell's tier is
// its persistent mastery level (capped at Tier IV), so a spell you've leveled
// returns at that tier whenever the dice hand it back.
function randomizeRandoSpells() {
  const p = game.player;
  const ids = Object.keys(SPELLS).sort(() => Math.random() - 0.5).slice(0, slotCap());
  p.spells = ids.map(id => ({ id, tier: Math.min(3, game.masteryLvl[id] || 0), t: 0, auto: true }));
}

function freshPlayer(charDef, starterSpell) {
  charDef = charDef || CHARACTERS[0];
  const stats = freshStats();
  charDef.apply(stats);
  return {
    x: W / 2, y: H / 2, r: 16,
    hp: stats.maxHp, shield: 0, shieldCap: 0,
    stats,
    look: charDef.look,
    charName: charDef.name,
    charId: charDef.id,
    spells: [{ id: starterSpell || 'missile', tier: 0, t: 0, auto: true }],
    orbAngle: 0,
    stormCharge: 0, echoCount: 0, // Storm Battery charges / Echo Lens cadence
    invuln: 0, hurtFlash: 0,
    moveX: 0, moveY: 0,
    procs: [], buffs: [], tempDmg: 1, tempSpd: 1,
    items: [], // purchased items, for the shop display { id, n }
    lastResort: true, // once per game, survive lethal damage at 1 HP
    lastResortType: 'basic', // upgraded at the altar after it breaks
    lastResortSacrificed: false, // traded away permanently for power
    inputId: 'both', // which controls drive this body: both | wasd | arrows
    downed: false,
  };
}

// ---------------------------------------------------------------------------
// Couch co-op: a second body (Player 2) sharing the build, gold and shop.
// P1 = WASD (+ pad 1), P2 = arrow keys (+ pad 2). Both auto-cast the shared
// spellbook from their own position; enemies chase the nearest body.
// ---------------------------------------------------------------------------
// A bright contrasting tint for Player 2's robe so the two are easy to tell apart.
function makePlayer2() {
  const p1 = game.player;
  const p2 = freshPlayer(CHARACTERS.find(c => c.id === p1.charId) || CHARACTERS[0], p1.spells[0].id);
  p2.stats = p1.stats;                 // SHARED build (upgrades, gold-bought stats)
  p2.look = { ...p1.look, robe: '#1d7a72', hat: '#125049' }; // teal so P2 reads distinct
  p2.spells = clonePlayerSpells(p1);
  p2.inputId = 'arrows';
  p2.x = W / 2 + 60; p2.y = H / 2;
  return p2;
}

// P2 casts independent COPIES of the shared spells (own cooldown timers).
function clonePlayerSpells(p1) {
  return p1.spells.map(s => ({ id: s.id, tier: s.tier, t: 0, auto: s.auto !== false, enchant: s.enchant, variant: s.variant, fuseBonus: s.fuseBonus || 0 }));
}

// Every controllable body (P1 always; P2 only in co-op).
function allBodies() { return game.coop && game.p2 ? [game.player, game.p2] : [game.player]; }
// Bodies that can still act / be targeted (not downed).
function livePlayers() { return allBodies().filter(b => !b.downed); }
// The closest living body to a point (for enemy targeting & damage).
function nearestPlayer(x, y) {
  let best = null, bd = Infinity;
  for (const b of livePlayers()) { const d = dist2(x, y, b.x, b.y); if (d < bd) { bd = d; best = b; } }
  return best;
}

// Record a bought item for the shop's "owned items" display.
function recordItem(id) {
  const list = game.player.items;
  const e = list.find(it => it.id === id);
  if (e) e.n++; else list.push({ id, n: 1 });
}

const game = {
  state: 'title', // title | playing | paused | levelup | shop | gameover | win
  wave: 1, waveTime: 0, waveDur: 0,
  gold: 0, xp: 0, level: 1, pendingLevelUps: 0, budget: 0,
  kills: 0, rerolls: 0,
  totalDmg: 0, runTime: 0, // cumulative run damage & combat time → overall DPS
  runDmg: {}, goldEarned: 0, bestWave: { wave: 0, dps: 0 }, lastHurtBy: null, // post-run summary
  slowmo: 0, // brief bullet-time (Last Resort break)
  player: freshPlayer(),
  coop: false, p2: null, // couch co-op: second local player
  enemies: [], projectiles: [], enemyProjectiles: [],
  clouds: [], meteors: [], beams: [], novas: [], familiars: [],
  gems: [], particles: [], texts: [], spawns: [],
  spawnTimer: 0, eliteSpawned: false, bossSpawned: false,
  shake: 0,
  dmgMeter: {}, showMeter: true, endless: false, danger: 0,
  zones: [], // telegraphed enemy ground attacks
  walls: [], // Warden barriers that block player movement
  hazardT: 0, // arcane storm timer
  worldEvent: null, worldZones: [], worldEventAt: 0, worldEventPick: null,
  worldTickT: 0, worldSpawnT: 0,
  mapElement: null, // element realm theme for the current wave (waves 1-20)
  realmSchedule: {}, // wave → element realm, decided at run start so the roadmap can show it
  cones: [], tornadoes: [], // breath-spell visuals & wind tornadoes
  structures: [], structIce: 0, // element landmarks + active ice-slow bonus
  worldSpawns: [], // gold magnet + item mine
  fountains: [], fountainsSpawned: 0, fountainAt: 0, fountainMax: 1,
  castQueue: [],
  shopOffers: [],
  prevState: 'playing',
  // wave modifier + its applied multipliers (reset each startWave)
  modifier: null,
  modGemMult: 0, modXpMult: 1, modDmgTaken: 1, modCdMult: 1,
  modSpawnMult: 1, modFountainMult: 1, modHazardMult: 1, modSwarm: false,
  pendingShopDiscount: 0,
  // "Build debt": shop bargains with delayed costs
  debtHpMult: 1, debtSpdMult: 1, // next-wave enemy buffs (reset each wave)
  discountBuys: 0,               // Cursed Discount: N cheaper purchases left
  arcaneLoan: false,             // Arcane Loan: rerolls gamble on dmg/HP
  castCount: 0, // for Nix's every-5th-cast
  opt: {}, // accessibility options (loaded below)
  masteryAcc: {}, masteryLvl: {}, masteryMods: {}, pendingMastery: [],
  elem: { fire: 0, ice: 0, earth: 0, wind: 0 }, // meta-class stacks (cap 3)
};

// Recompute element (meta-class) stacks from the current spellbook, capped at 3.
function recomputeElements() {
  const c = { fire: 0, ice: 0, earth: 0, wind: 0 };
  for (const sp of game.player.spells)
    for (const el of (SPELLS[sp.id].elements || [])) if (c[el] !== undefined) c[el]++;
  for (const k in c) c[k] = Math.min(3, c[k]); // spell contribution caps at 3
  if (game.mapElement && c[game.mapElement] !== undefined) c[game.mapElement] = Math.min(5, c[game.mapElement] + 2);
  game.elem = c;
}

// Spell mastery: a spell levels up (max 5) by scoring kills — shared across every
// copy of that spell id. These are the cumulative kills needed for levels 1–5.
const MASTERY_THRESHOLDS = [18, 45, 83, 132, 195]; // +50% kills to level a spell's mastery
const MASTERY_OPTIONS = [
  { name: 'Empower',  icon: '💪', desc: '+18% damage with this spell', apply: m => m.dmgMult *= 1.18 },
  { name: 'Hasten',   icon: '⏩', desc: '-12% cooldown / +12% rate',   apply: m => { m.cdMult *= 0.88; m.dmgMult *= 1.04; } },
  { name: 'Overload', icon: '⚡', desc: '+30% damage, +10% cooldown',  apply: m => { m.dmgMult *= 1.30; m.cdMult *= 1.10; } },
];
function masteryMod(id) {
  if (!game.masteryMods[id]) game.masteryMods[id] = { dmgMult: 1, cdMult: 1 };
  return game.masteryMods[id];
}

// Accessibility / readability options, persisted.
const OPT_KEY = 'wavywizards-opts';
try { game.opt = JSON.parse(localStorage.getItem(OPT_KEY)) || {}; } catch (e) { game.opt = {}; }
function saveOpts() { try { localStorage.setItem(OPT_KEY, JSON.stringify(game.opt)); } catch (e) { /* private */ } }
muted = !!game.opt.muted; // restore saved mute state
// During waves 1-20 the random element realm sets the backdrop; otherwise the
// player's chosen colour scheme applies.
function currentTheme() {
  if (game.mapElement && ELEMENT_THEMES[game.mapElement]) return ELEMENT_THEMES[game.mapElement];
  return THEMES.find(t => t.id === game.opt.theme) || THEMES[0];
}

const slotCap = () => game.player.stats.maxSlots || MAX_SPELL_SLOTS;

// +20% required XP per level, compounding
const xpNeeded = lvl => Math.round(10 * Math.pow(1.2, lvl - 1));

// ---------------------------------------------------------------------------
// Floating text & particles
// ---------------------------------------------------------------------------
function addText(x, y, str, color, size = 15) {
  game.texts.push({ x, y, str, color, size, t: 0, dur: 0.8 });
}

function burst(x, y, color, n = 10, spd = 160, life = 0.45) {
  if (game.opt.lowFx) n = Math.ceil(n * 0.35); // accessibility: fewer particles
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(spd * 0.3, spd);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: rand(life * 0.5, life), color, r: rand(2, 4.5) });
  }
}

// ---------------------------------------------------------------------------
// Damage handling
// ---------------------------------------------------------------------------
function hitEnemy(e, rawDmg, opts = {}) {
  if (e.dead) return { dmg: 0, crit: false };
  const p = game.player, st = p.stats;
  let dmg = rawDmg * st.dmgMult * (p.tempDmg || 1) * (opts.scale || 1);
  // Frozen Core: slowed enemies take more. Point-Blank Sigil: bonus up close.
  if (st.frostAmp && (e.slowAmt > 0 || opts.slow)) dmg *= 1 + st.frostAmp;
  if (st.pointBlank && dist2(p.x, p.y, e.x, e.y) <= 150 * 150) dmg *= 1 + st.pointBlank;
  let critChance = st.crit;
  if (opts.dot && !st.dotCrit) critChance = 0; // DoT ticks only crit with Burning Ink
  if (st.brittle && (e.slowAmt > 0 || opts.slow)) critChance += 0.35; // Brittle Ice
  let crit = false;
  if (Math.random() < critChance) { dmg *= st.critMult; crit = true; }
  dmg = Math.max(1, Math.round(dmg));
  // boss shield (Danger 10) soaks damage before HP
  if (e.eshield > 0) {
    const soak = Math.min(e.eshield, dmg);
    e.eshield -= soak; dmg -= soak;
  }
  e.hp -= dmg;
  e.flash = 0.1;
  game.totalDmg += dmg; // run-wide total (dmgMeter resets every wave)
  if (opts.source) {
    game.dmgMeter[opts.source] = (game.dmgMeter[opts.source] || 0) + dmg;
    game.runDmg[opts.source] = (game.runDmg[opts.source] || 0) + dmg; // run-wide per-spell total
  }
  if (game.opt.dmgNumbers !== false) addText(e.x + rand(-8, 8), e.y - e.r - 6, String(dmg), crit ? '#ffb347' : '#ffffff', crit ? 19 : 14);
  if (opts.slow) { e.slowT = 2; e.slowAmt = Math.max(e.slowAmt || 0, opts.slow); }
  // Ice meta-class: every hit applies a light chill
  if (game.elem.ice > 0) { e.slowT = Math.max(e.slowT, 1.2); e.slowAmt = Math.max(e.slowAmt || 0, 0.08 * game.elem.ice); }
  // Ice patch landmark: any spell hit slows a little extra while you stand near one
  if (game.structIce && opts.source) {
    e.slowT = Math.max(e.slowT, 1.5);
    e.slowAmt = Math.max(e.slowAmt || 0, (opts.slow || 0) + game.structIce);
  }
  if (crit && st.critHeal) healPlayer(st.critHeal); // Selene
  if (opts.knock) {
    const d = Math.max(1, Math.hypot(e.x - p.x, e.y - p.y));
    e.kx = (e.x - p.x) / d * opts.knock;
    e.ky = (e.y - p.y) / d * opts.knock;
  }
  if (opts.heal) healPlayer(Math.round(dmg * opts.heal), opts.vampiric);
  if (e.hp <= 0) {
    if (opts.source && SPELLS[opts.source]) game.masteryAcc[opts.source] = (game.masteryAcc[opts.source] || 0) + 1; // spell XP per kill
    // Storm Battery: a Chain Lightning kill stores a charge for the next cast
    if (st.stormBattery && opts.source === 'lightning') p.stormCharge = Math.min(3, (p.stormCharge || 0) + 1);
    killEnemy(e, opts.frostbite ? 'frostbite' : null);
  } else sfx('hit');
  return { dmg, crit };
}

// Global incoming-healing multiplier — all HP restoration is at half strength.
const HEAL_FACTOR = 0.5;

function healPlayer(amount, overflowShield) {
  const p = game.player;
  const total = amount * p.stats.healMult * HEAL_FACTOR;
  const before = p.hp;
  p.hp = Math.min(p.stats.maxHp, p.hp + total);
  const got = Math.round(p.hp - before);
  if (got >= 1) { addText(p.x, p.y - p.r - 12, '+' + got, '#7fe08f', 14); sfx('heal'); }
  // Vampiric enchant: overheal becomes a temporary shield (capped).
  if (overflowShield) {
    const spill = total - (p.hp - before);
    if (spill >= 1) {
      const cap = Math.max(p.shieldCap, Math.round(p.stats.maxHp * 0.5));
      p.shieldCap = cap;
      p.shield = Math.min(cap, p.shield + spill);
    }
  }
}

function killEnemy(e, killer) {
  if (e.dead) return;
  e.dead = true;
  game.kills++;
  // a Bomber blows up when destroyed too — drop a short-fused blast zone
  if (e.bomber && !e.detonating) {
    game.zones.push({ x: e.x, y: e.y, radius: e.blastR || 110, t: 0, delay: 0.25, dmg: e.dmg, color: '#ff7a3c' });
  }
  // Perfected Ice Breath: a frozen enemy shatters, harming nearby foes
  if (e.shatter) {
    burst(e.x, e.y, '#cfeeff', 14, 200, 0.4);
    for (const o of game.enemies) {
      if (o.dead || o === e) continue;
      if (dist2(e.x, e.y, o.x, o.y) <= 90 * 90) hitEnemy(o, e.maxHp * 0.1 + 5, { source: 'icebreath' });
    }
  }
  // Perfected Poison Cloud: clouds the enemy died inside swell outward
  for (const c of game.clouds) {
    if (c.grow && dist2(c.x, c.y, e.x, e.y) <= (c.radius + e.r) ** 2) {
      c.radius = Math.min(c.radius + 12, 200);
      c.dur += 0.4;
    }
  }
  burst(e.x, e.y, e.color, e.boss ? 60 : e.elite ? 30 : 10, e.boss ? 320 : 170);
  sfx(e.boss ? 'boom' : 'hit');
  // Frostbite enchant: a slowed enemy shatters, damaging neighbours.
  if (e.slowAmt > 0 && killer === 'frostbite') {
    burst(e.x, e.y, '#a8e6ff', 16, 200, 0.4);
    for (const o of game.enemies) {
      if (o.dead || o === e) continue;
      if (dist2(e.x, e.y, o.x, o.y) <= 80 * 80) hitEnemy(o, e.maxHp * 0.12 + 6, { source: 'frost' });
    }
  }
  // drop gems (wave-modifier bonus on Blood Moon / Treasure)
  let n = e.gems;
  if (game.modGemMult) n = Math.max(e.gems, Math.round(e.gems * game.modGemMult));
  if (e.elite && game.modifier && game.modifier.id === 'treasure') n += 8;
  if (e.flee) n += 6 + Math.floor(game.wave / 3); // Gold Goblin pays out if caught
  for (let i = 0; i < n; i++) {
    game.gems.push({
      x: e.x + rand(-14, 14), y: e.y + rand(-14, 14),
      vx: rand(-60, 60), vy: rand(-60, 60),
      val: 1, t: 0, vacuum: false,
    });
  }
  // occasional health pickup
  if (!e.boss && Math.random() < 0.025) {
    game.gems.push({ x: e.x, y: e.y, vx: 0, vy: 0, val: 0, hp: 10, t: 0, vacuum: false });
  }
  if (e.splitsInto) {
    for (let i = 0; i < 2; i++) spawnEnemy(e.splitsInto, e.x + rand(-16, 16), e.y + rand(-16, 16));
  }
  // Summoner: a kill may raise a temporary familiar that fights for you
  if (game.player.stats.summoner && !e.familiarBorn && game.familiars.length < 6 && Math.random() < 0.5) {
    game.familiars.push({
      x: e.x, y: e.y, t: 0, dur: 9, cd: rand(0.3, 0.8),
      dmg: Math.round(6 + game.wave * 1.6), wobble: rand(0, Math.PI * 2),
    });
    burst(e.x, e.y, '#b89aff', 8, 120, 0.4);
  }
  if (e.boss) game.shake = 18;
}

// Summoner familiars: small allied wisps that home toward enemies and zap them.
function updateFamiliars(dt) {
  const p = game.player;
  for (const f of game.familiars) {
    f.t += dt; f.wobble += dt * 6;
    const tgt = nearestEnemy(f.x, f.y, 360);
    // drift toward a target if there is one, else loiter near the player
    const aimX = tgt ? tgt.x : p.x, aimY = tgt ? tgt.y : p.y;
    const d = Math.max(1, Math.hypot(aimX - f.x, aimY - f.y));
    const spd = tgt ? 180 : 120;
    f.x += (aimX - f.x) / d * spd * dt;
    f.y += (aimY - f.y) / d * spd * dt;
    f.cd -= dt;
    if (tgt && f.cd <= 0 && d < 240) {
      f.cd = 0.7;
      game.beams.push({ pts: [{ x: f.x, y: f.y }, { x: tgt.x, y: tgt.y }], t: 0, dur: 0.18, color: '#b89aff', width: 2 });
      hitEnemy(tgt, f.dmg, { source: 'orbs' });
    }
  }
  game.familiars = game.familiars.filter(f => f.t < f.dur);
}

function nearbyEnemyCount(x, y, radius) {
  let n = 0;
  for (const e of game.enemies) if (!e.dead && dist2(x, y, e.x, e.y) <= radius * radius) n++;
  return n;
}

function damagePlayer(rawDmg, src, target) {
  const p = target || game.player;
  if (p.downed || p.invuln > 0 || game.state !== 'playing') return;
  const st = p.stats;
  if (src) game.lastHurtBy = src; // remember the most recent damage source (cause of death)
  // Duelist Robe: bonus armor when outnumbered is low. Glass Arena: more dmg taken.
  let armor = st.armor + 2 * game.elem.earth + (p.bonusArmor || 0); // Earth meta + temp wards
  if (st.duelist && nearbyEnemyCount(p.x, p.y, 300) < 5) armor += st.duelist;
  let dmg = Math.max(1, Math.round(rawDmg * (game.modDmgTaken || 1) - armor));
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed;
    dmg -= absorbed;
    addText(p.x, p.y - p.r - 12, '-' + absorbed, '#8fa8ff', 14);
  }
  if (dmg > 0) {
    p.hp -= dmg;
    addText(p.x, p.y - p.r - 12, '-' + dmg, '#ff6b6b', 17);
    sfx('hurt');
    if (game.opt.shake !== false) game.shake = Math.max(game.shake, 6);
    p.hurtFlash = 0.25;
    // Martyr's Bell: shorten Holy Nova cooldown. Panic Bell: release a weak nova.
    if (st.martyr) for (const s of p.spells) if (s.id === 'nova') s.t = Math.max(0, s.t - st.martyr);
    if (st.panicBell) {
      const radius = 110;
      for (const e of game.enemies) {
        if (!e.dead && dist2(p.x, p.y, e.x, e.y) <= (radius + e.r) ** 2)
          hitEnemy(e, 10 + game.wave, { knock: 220, source: 'nova' });
      }
      game.novas.push({ x: p.x, y: p.y, t: 0, dur: 0.3, radius, color: '#fff3b0' });
    }
  }
  p.invuln = 0.35;
  if (p.hp <= 0) {
    p.hp = 0;
    // Last Resort: once per game, cheat death in a huge dramatic moment.
    if (p.lastResort) {
      p.lastResort = false;
      const type = p.lastResortType || 'basic';
      // Phoenix revives at 30% HP; the rest cling to 1 HP.
      p.hp = type === 'phoenix' ? Math.max(1, Math.round(p.stats.maxHp * 0.3)) : 1;
      p.invuln = 2.2;
      game.slowmo = 0.5;                 // bullet-time beat
      game.shake = Math.max(game.shake, 18);
      game.enemyProjectiles = [];        // wipe every incoming shot
      addText(p.x, p.y - 52, 'LAST RESORT BROKEN', '#ffd454', 28);
      burst(p.x, p.y, '#ffd454', 50, 420, 0.9);
      // a colossal golden nova
      game.novas.push({ x: p.x, y: p.y, t: 0, dur: 0.6, radius: 280, color: '#ffd454' });
      game.novas.push({ x: p.x, y: p.y, t: 0, dur: 0.45, radius: 180, color: '#fff3b0' });
      for (const e of game.enemies) {
        if (e.dead) continue;
        const within = dist2(p.x, p.y, e.x, e.y) <= 240 * 240;
        if (!within) continue;
        const d = Math.max(1, Math.hypot(e.x - p.x, e.y - p.y));
        e.kx = (e.x - p.x) / d * 620; e.ky = (e.y - p.y) / d * 620; // big shove
        if (type === 'vengeful') hitEnemy(e, 40 + game.wave * 6, { source: 'nova' }); // heavy retaliation
        if (type === 'greedy') { // convert nearby foes into a payday
          for (let i = 0; i < (e.gems || 1) + 2; i++)
            game.gems.push({ x: e.x + rand(-12, 12), y: e.y + rand(-12, 12), vx: rand(-60, 60), vy: rand(-60, 60), val: 1, t: 0, vacuum: false });
          killEnemy(e);
        }
      }
      addText(p.x, p.y - 28, LAST_RESORT_TYPES[type].cry, LAST_RESORT_TYPES[type].color, 18);
      sfx('shield');
      saveRun();
      return;
    }
    // this body goes down; co-op partners can keep fighting until the wave clears
    p.downed = true; p.hp = 0; p.invuln = 0;
    burst(p.x, p.y, '#ff6b6b', 22, 220, 0.5);
    sfx('hurt');
    if (game.coop) addText(p.x, p.y - 30, (p === game.player ? 'P1' : 'P2') + ' DOWN — revives next wave', '#ff6b6b', 18);
    if (livePlayers().length > 0) return; // a teammate is still alive

    // everyone is down — retry the wave, or end the run
    if (game.opt.replayFails) {
      game.deaths = (game.deaths || 0) + 1;
      sfx('hurt');
      const w = game.wave;
      startWave(w);
      reviveAll();
      addText(W / 2, H / 2 - 30, 'WAVE FAILED — RETRYING', '#ff6b6b', 26);
      return;
    }
    sfx('death');
    clearSave(); // the run is over
    const hlId = recordScore(false);
    const dps = game.runTime > 0 ? Math.round(game.totalDmg / game.runTime) : 0;
    setState('gameover');
    document.getElementById('gameover-stats').textContent =
      `Reached wave ${game.wave} — ${game.kills} kills — ${dps} DPS — Level ${game.level}`;
    renderRunSummary('gameover-summary', false);
    document.getElementById('gameover-board').innerHTML = scoreboardHTML(hlId);
  }
}

// Bring every downed body back to full HP (used between waves / on retry).
function reviveAll() {
  for (const b of allBodies()) { b.downed = false; b.hp = b.stats.maxHp; b.invuln = 1.2; }
  if (game.coop && game.p2) { game.player.x = W / 2 - 60; game.player.y = H / 2; game.p2.x = W / 2 + 60; game.p2.y = H / 2; }
}

// ---------------------------------------------------------------------------
// Spell casting
// ---------------------------------------------------------------------------
function liveEnemies() { return game.enemies.filter(e => !e.dead); }

function nearestEnemy(x, y, maxRange, exclude) {
  let best = null, bestD = (maxRange || 1e9) ** 2;
  for (const e of game.enemies) {
    if (e.dead || (exclude && exclude.has(e))) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// Extra on-hit options granted by a legendary enchant.
function enchHitOpts(ench) {
  const o = {};
  if (ench === 'vampiric') { o.heal = 0.1; o.vampiric = true; }
  if (ench === 'frostbite') { o.slow = 0.3; o.frostbite = true; }
  return o;
}

// Cast wrapper: handles the Echo enchant, Twincaster double cast, and Nix's
// every-5th-cast. Second casts are staggered slightly via the cast queue.
function tryCast(spell) {
  const p = game.player;
  const st = p.stats;
  // Storm Battery: spend a stored charge to empower this cast (+60% damage).
  const charged = st.stormBattery && p.stormCharge > 0;
  const ok = castSpell(spell, charged ? { stormBoost: true } : undefined);
  if (!ok) return false;
  if (charged) { p.stormCharge--; addText(p.x, p.y - 30, '⚡ CHARGED', '#ffe96b', 16); }
  if (st.doubleCast) game.castQueue.push({ spell, t: 0.05 });
  if (st.wildEvery) {
    game.castCount++;
    if (game.castCount % st.wildEvery === 0) game.castQueue.push({ spell, t: 0.05 });
  }
  // Echo Lens relic: every 7th successful cast repeats for free.
  if (st.echoEvery) {
    p.echoCount = (p.echoCount || 0) + 1;
    if (p.echoCount % st.echoEvery === 0) { game.castQueue.push({ spell, t: 0.08 }); addText(p.x, p.y - 30, '🔭 ECHO', '#aef0ff', 16); }
  }
  // Echo enchant: 40% chance to cast again for 60% damage (its own crit roll).
  if (spell.enchant === 'echo' && Math.random() < 0.40) game.castQueue.push({ spell, t: 0.1, dmgScale: 0.6 });
  return true;
}

function castSpell(spell, opts) {
  opts = opts || {};
  const p = game.player;
  const def = SPELLS[spell.id];
  const ench = spell.enchant;
  const st = p.stats;
  let t = def.tiers[spell.tier];
  // Reach scales with rangePerkMult (halved on the Twincaster); the character's
  // own rangeMult applies to every cast. Echo's queued recast lowers damage.
  const rangeF = (ench === 'reach' ? 1 + 0.4 * st.rangePerkMult : 1) * st.rangeMult;
  const radiusF = ench === 'reach' ? 1 + 0.3 * st.rangePerkMult : 1;
  const durF = ench === 'reach' ? 1 + 0.3 * st.rangePerkMult : 1;
  // Concentratos casts only while still and hits 50% harder for it
  const stillBonus = (st.concentrator && !p.moving) ? 1.5 : 1;
  const dscale = (opts.dmgScale || 1) * masteryMod(spell.id).dmgMult * stillBonus
    * (opts.stormBoost ? 1.6 : 1) * (1 + (spell.fuseBonus || 0)); // Collector: fused spells hit harder
  const areaF = st.areaMult || 1; // -25% area on the Concentratos, etc.
  const variant = spell.variant ? VARIANTS[spell.variant] : null;
  const fireF = 1 + 0.12 * game.elem.fire; // Fire meta-class: bigger AoE
  // Fusion payoff: Tier IV (index 3) unlocks a "perfected" behavior; Tier III+
  // (index >= 2) reads as an upgraded cast via tierFx in the renderer.
  const perfected = spell.tier === 3;
  const tierFx = spell.tier;
  if (rangeF !== 1 || radiusF !== 1 || durF !== 1 || dscale !== 1 || variant || fireF !== 1 || areaF !== 1) {
    t = { ...t };
    if (variant && variant.mod) variant.mod(t); // alternate stat profile first
    if (t.range) t.range *= rangeF;
    if (t.radius) t.radius *= radiusF * fireF * areaF;
    if (t.dur) t.dur *= durF;
    if (t.dmg) t.dmg *= dscale;
    if (t.dps) t.dps *= dscale;
  }

  // Breath spells: a ~90° cone toward the nearest enemy with an elemental aftermath
  if (def.breath) {
    const target = nearestEnemy(p.x, p.y, t.range);
    if (!target) return false;
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const half = Math.PI / 4; // ±45° = 90° cone
    const opts = { source: spell.id, ...enchHitOpts(ench) };
    if (def.breath === 'earth') opts.knock = perfected ? 560 : 360; // T4: huge shove
    const hits = coneHit(p.x, p.y, angle, t.range, half, t.dmg, opts, ench === 'splash');
    game.cones.push({ x: p.x, y: p.y, angle, range: t.range, half, color: def.color, t: 0, dur: 0.3, tierFx });
    spellSfx(spell.id);
    if (def.breath === 'fire') {
      // each enemy caught in the cone is left standing in a small burning circle
      // (T4: the flames burn bigger and linger longer)
      for (const e of hits) {
        game.clouds.push({ x: e.x, y: e.y, radius: perfected ? 40 : 26, dps: Math.round(t.dmg * 0.4),
          t: 0, dur: perfected ? 4 : 2.5, tick: 0, source: spell.id, fire: true });
      }
    } else if (def.breath === 'ice') {
      for (const e of hits) { e.slowT = 3; e.slowAmt = 1; if (perfected) e.shatter = true; } // root (T4: shatter on death)
    } else if (def.breath === 'wind') {
      for (const e of hits) { const tor = spawnTornado(e.x, e.y, Math.max(1, Math.round(t.dmg * 0.33))); if (perfected && tor) { tor.r = 46; tor.dur = 8; } }
    } else if (def.breath === 'earth' && perfected) {
      grantArmorBuff(8, 4); // T4 earth breath wards you briefly
    }
    return true;
  }

  switch (spell.id) {
    case 'missile': {
      const target = nearestEnemy(p.x, p.y, t.range);
      if (!target) return false;
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      game.projectiles.push({
        x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
        dmg: t.dmg, r: 5, color: def.color, life: 1.4, homing: target, kind: 'missile', source: 'missile', ench,
        tierFx, perfected,
      });
      spellSfx('missile');
      return true;
    }
    case 'fireball': {
      const target = nearestEnemy(p.x, p.y, t.range);
      if (!target) return false;
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      const fspd = 380 * (variant && variant.projMult ? variant.projMult : 1);
      game.projectiles.push({
        x: p.x, y: p.y, vx: Math.cos(a) * fspd, vy: Math.sin(a) * fspd,
        dmg: t.dmg, r: 9, color: def.color, life: t.range / fspd + 0.1,
        explodeRadius: t.radius, kind: 'fireball', source: 'fireball', ench,
        tierFx, perfected,
      });
      spellSfx('fireball');
      return true;
    }
    case 'frost': {
      const target = nearestEnemy(p.x, p.y, t.range);
      if (!target) return false;
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      game.projectiles.push({
        x: p.x, y: p.y, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440,
        dmg: t.dmg, r: 7, color: def.color, life: t.range / 440 + 0.1,
        pierce: t.pierce, slow: t.slow, hitSet: new Set(), kind: 'frost', source: 'frost', ench,
        tierFx, perfected,
      });
      spellSfx('frost');
      return true;
    }
    case 'lightning': {
      // Forked variant seeds the strike from several initial targets at once.
      const forks = variant && variant.forks ? variant.forks : 1;
      const seed = new Set();
      const initial = [];
      for (let f = 0; f < forks; f++) {
        const tgt = nearestEnemy(p.x, p.y, t.range, seed);
        if (!tgt) break;
        seed.add(tgt); initial.push(tgt);
      }
      if (!initial.length) return false;
      const hitSet = new Set();
      for (const start of initial) {
        const pts = [{ x: p.x, y: p.y }];
        let from = start, chains = t.chains, bonusLeft = 0;
        let lastX = p.x, lastY = p.y;
        for (let i = 0; i < chains && from; i++) {
          if (hitSet.has(from)) { from = nearestEnemy(from.x, from.y, 180, hitSet); continue; }
          hitSet.add(from);
          pts.push({ x: from.x, y: from.y });
          const fx = from.x, fy = from.y;
          lastX = fx; lastY = fy;
          const res = hitEnemy(from, t.dmg, { source: 'lightning', ...enchHitOpts(ench) });
          // Storm Needle: each crit grants an extra chain (capped).
          if (res.crit && st.stormCrit && bonusLeft < st.stormCrit * 3) { chains++; bonusLeft++; }
          if (ench === 'splash') explodeAt(fx, fy, 60, t.dmg * 0.5, def.color, 'lightning', { splash: true });
          from = nearestEnemy(fx, fy, 180, hitSet);
        }
        // Perfected: the final target of each arc detonates in a small burst
        if (perfected && hitSet.size) explodeAt(lastX, lastY, 80, t.dmg * 0.6, def.color, 'lightning', {});
        game.beams.push({ pts, t: 0, dur: 0.22, color: def.color, width: perfected ? 5 : 3 });
      }
      spellSfx('lightning');
      return true;
    }
    case 'shield': {
      const cap = Math.round(t.shield * (perfected ? 3 : 2)); // T4: overcharged cap
      if (p.shield >= cap) return false; // don't waste the cast
      p.shield = Math.min(cap, p.shield + t.shield);
      p.shieldCap = Math.max(p.shieldCap, cap);
      burst(p.x, p.y, def.color, 14, 120, 0.5);
      spellSfx('shield');
      return true;
    }
    case 'poison': {
      const target = nearestEnemy(p.x, p.y, t.range);
      if (!target) return false;
      game.clouds.push({ x: target.x, y: target.y, radius: t.radius, dps: t.dps, t: 0, dur: t.dur, tick: 0, source: 'poison', ench, slow: variant && variant.slow, grow: perfected, tierFx });
      spellSfx('poison');
      return true;
    }
    case 'meteor': {
      const live = liveEnemies();
      if (!live.length) return false;
      const target = pick(live);
      game.meteors.push({
        x: clamp(target.x, WALL + 30, W - WALL - 30),
        y: clamp(target.y, WALL + 30, H - WALL - 30),
        t: 0, delay: 0.9, dmg: t.dmg, radius: t.radius, source: 'meteor', ench, perfected,
      });
      spellSfx('meteor');
      return true;
    }
    case 'drain': {
      const target = nearestEnemy(p.x, p.y, t.range);
      if (!target) return false;
      game.beams.push({ pts: [{ x: p.x, y: p.y }, { x: target.x, y: target.y }], t: 0, dur: 0.3, color: def.color, width: 4 });
      spellSfx('drain');
      hitEnemy(target, t.dmg, {
        heal: t.heal + (ench === 'vampiric' ? 0.1 : 0),
        slow: ench === 'frostbite' ? 0.3 : undefined,
        source: 'drain',
      });
      if (ench === 'splash') explodeAt(target.x, target.y, 70, t.dmg * 0.5, def.color, 'drain', { splash: true });
      // Perfected: siphon a second nearby enemy at reduced strength
      if (perfected) {
        const second = nearestEnemy(target.x, target.y, 220, new Set([target]));
        if (second) {
          game.beams.push({ pts: [{ x: target.x, y: target.y }, { x: second.x, y: second.y }], t: 0, dur: 0.3, color: def.color, width: 3 });
          hitEnemy(second, Math.round(t.dmg * 0.6), { heal: t.heal, source: 'drain' });
        }
      }
      return true;
    }
    case 'nova': {
      const live = liveEnemies();
      let hitAny = false;
      for (const e of live) {
        if (dist2(p.x, p.y, e.x, e.y) <= (t.radius + e.r) ** 2) {
          hitEnemy(e, t.dmg, { knock: 380, source: 'nova', ...enchHitOpts(ench) });
          hitAny = true;
        }
      }
      game.novas.push({ x: p.x, y: p.y, t: 0, dur: 0.35, radius: t.radius, tierFx });
      if (perfected) grantArmorBuff(6, 3); // T4: a burst of armor on each cast
      spellSfx('nova');
      return true; // fire even with no hits — it is also a visual heartbeat
    }
  }
  return false;
}

function updateSpells(dt) {
  const p = game.player;

  // queued second casts (double cast / echo / wild) fire slightly after the first
  for (const q of game.castQueue) {
    q.t -= dt;
    if (q.t <= 0 && p.spells.includes(q.spell)) castSpell(q.spell, { dmgScale: q.dmgScale });
  }
  game.castQueue = game.castQueue.filter(q => q.t > 0);

  let firedThisFrame = 0;
  for (const spell of p.spells) {
    const def = SPELLS[spell.id];
    const t = def.tiers[spell.tier];
    if (spell.disabled > 0) { spell.disabled -= dt; continue; } // Null Mage silence
    if (spell.id === 'orbs') continue; // passive, handled below
    spell.t -= dt;
    if (spell.t <= 0) {
      if (spell.auto === false) { spell.t = 0; continue; } // manual mode: wait for hotkey
      if (p.stats.concentrator && p.moving) { spell.t = 0; continue; } // Concentratos: only casts while still
      if (firedThisFrame > 0) { spell.t = 0.05 * firedThisFrame; continue; } // sequential firing
      if (tryCast(spell)) { spell.t = t.cd * p.stats.cdMult * (game.modCdMult || 1) * masteryMod(spell.id).cdMult; firedThisFrame++; }
      else spell.t = 0.12; // retry shortly if no valid target
    }
  }

  // Brakk's searing aura: steady damage to anything pressed against you
  if (p.stats.aura) {
    p.auraTick = (p.auraTick || 0) - dt;
    if (p.auraTick <= 0) {
      p.auraTick = 0.4;
      const ar = p.r + 46;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (dist2(p.x, p.y, e.x, e.y) <= (ar + e.r) ** 2) hitEnemy(e, p.stats.aura * 0.4, { source: 'orbs' });
      }
      game.novas.push({ x: p.x, y: p.y, t: 0, dur: 0.25, radius: ar, color: '#ff9a5a' });
    }
  }

  // Arcane Orbs: persistent orbiters; each owned copy is its own ring
  const orbSpells = p.spells.filter(s => s.id === 'orbs');
  if (orbSpells.length) {
    p.orbAngle += dt * 2.6 * (1 + (p.stats.orbSpeed || 0));
    const orbR = 8;
    const orbDmgMult = masteryMod('orbs').dmgMult;
    orbSpells.forEach((os, k) => {
      const t = SPELLS.orbs.tiers[os.tier];
      const operf = os.tier === 3; // T4: bigger orbs that chill on touch
      const er = orbR + (operf ? 5 : 0);
      const orbitR = (72 + k * 26) * (os.enchant === 'reach' ? 1.3 : 1);
      const dir = k % 2 === 0 ? 1 : -1; // alternate rings counter-rotate
      for (let i = 0; i < t.count; i++) {
        const a = p.orbAngle * dir + (Math.PI * 2 * i) / t.count;
        const ox = p.x + Math.cos(a) * orbitR;
        const oy = p.y + Math.sin(a) * orbitR;
        for (const e of game.enemies) {
          if (e.dead || (e.orbCd || 0) > 0) continue;
          if (dist2(ox, oy, e.x, e.y) <= (er + e.r) ** 2) {
            hitEnemy(e, t.dmg * orbDmgMult, { knock: 140, source: 'orbs', ...(operf ? { slow: 0.3 } : {}), ...enchHitOpts(os.enchant) });
            if (os.enchant === 'splash') explodeAt(ox, oy, 60, t.dmg * 0.5, '#c47bff', 'orbs', { splash: true });
            e.orbCd = 0.5;
          }
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Entity updates
// ---------------------------------------------------------------------------
function explodeAt(x, y, radius, dmg, color, source, extra, depth) {
  extra = extra || {};
  depth = depth || 0;
  const chainSplash = extra.splash && depth < 3; // Splash enchant: chain on kills
  // Gravity Stone: yank nearby enemies toward the blast centre so more get caught.
  const grav = game.player.stats.gravity && !extra.splash;
  const effRadius = grav ? radius * 1.3 : radius;
  if (grav) {
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > radius * 0.6 && d < radius * 2) {
        const pull = Math.min(d - radius * 0.5, 80);
        e.x += (x - e.x) / Math.max(1, d) * pull;
        e.y += (y - e.y) / Math.max(1, d) * pull;
      }
    }
    game.novas.push({ x, y, t: 0, dur: 0.2, radius: radius * 2, color: '#7b5cff' });
  }
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (dist2(x, y, e.x, e.y) <= (effRadius + e.r) ** 2) {
      const hpBefore = e.hp, ex = e.x, ey = e.y;
      hitEnemy(e, dmg, { source, ...extra });
      // a Splash kill detonates a smaller blast where the enemy fell
      if (chainSplash && hpBefore > 0 && e.dead) {
        explodeAt(ex, ey, radius * 0.8, dmg * 0.6, color, source, extra, depth + 1);
      }
    }
  }
  game.novas.push({ x, y, t: 0, dur: 0.3, radius });
  burst(x, y, color, 22, 260, 0.5);
  if (game.opt.shake !== false) game.shake = Math.max(game.shake, 5);
  sfx('boom');
  // Ember Crown: fire-tagged explosions leave burning ground.
  const st = game.player.stats;
  if (st.burnGround && source && SPELLS[source] && SPELLS[source].tags.includes('fire')) {
    game.clouds.push({ x, y, radius: radius * 0.9, dps: (6 + game.wave) * st.burnGround,
      t: 0, dur: 1.5, tick: 0, source, fire: true });
  }
}

// Hit every live enemy inside a cone (origin x,y; centre angle; ±half radians).
// Returns the enemies hit; `splash` re-detonates on each hit when enchanted.
function coneHit(x, y, angle, range, half, dmg, opts, splash) {
  const hits = [];
  for (const e of game.enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y;
    const d = Math.hypot(dx, dy);
    if (d > range + e.r) continue;
    let a = Math.atan2(dy, dx) - angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    // widen the angular tolerance by the enemy's apparent size so big/near foes count
    if (Math.abs(a) <= half + Math.atan2(e.r, Math.max(20, d))) {
      hitEnemy(e, dmg, opts);
      if (splash && !e.dead) explodeAt(e.x, e.y, 70, dmg * 0.5, '#ffffff', opts.source, { splash: true });
      hits.push(e);
    }
  }
  return hits;
}

// Wind Breath aftermath: a tornado that roams and pulses damage for 5s.
function spawnTornado(x, y, dmg) {
  const tor = { x, y, dmg, r: 32, t: 0, dur: 5, tick: 0, driftA: rand(0, Math.PI * 2), spin: rand(0, Math.PI * 2) };
  game.tornadoes.push(tor);
  return tor;
}

// Perfected Magic Missile: on a kill, fling two weaker homing shards at the
// two nearest other enemies (no further splitting).
function spawnMissileShards(pr, killed) {
  const seed = new Set([killed]);
  for (let i = 0; i < 2; i++) {
    const tgt = nearestEnemy(pr.x, pr.y, 360, seed);
    if (!tgt) break;
    seed.add(tgt);
    const a = Math.atan2(tgt.y - pr.y, tgt.x - pr.x) + rand(-0.2, 0.2);
    game.projectiles.push({
      x: pr.x, y: pr.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
      dmg: Math.max(1, Math.round(pr.dmg * 0.5)), r: 4, color: pr.color, life: 1.1,
      homing: tgt, kind: 'missile', source: 'missile', split: true, tierFx: pr.tierFx,
    });
  }
}

// A short-lived armor ward (used by perfected Holy Nova / Earth Breath).
function grantArmorBuff(amount, dur) {
  const p = game.player;
  p.buffs.push({ name: 'WARDED', dmg: 0, spd: 0, armor: amount, t: dur });
  addText(p.x, p.y - 46, '🛡 WARDED', '#8fa8ff', 16);
}

function updateTornadoes(dt) {
  for (const tor of game.tornadoes) {
    tor.t += dt;
    tor.spin += dt * 7;
    tor.driftA += dt * 1.6;                 // slowly curving wander = a swirl
    const spd = 70;
    tor.x = clamp(tor.x + Math.cos(tor.driftA) * spd * dt, WALL + tor.r, W - WALL - tor.r);
    tor.y = clamp(tor.y + Math.sin(tor.driftA) * spd * dt, WALL + tor.r, H - WALL - tor.r);
    tor.tick -= dt;
    if (tor.tick <= 0) {
      tor.tick = 0.4;
      for (const e of game.enemies) {
        if (!e.dead && dist2(tor.x, tor.y, e.x, e.y) <= (tor.r + e.r) ** 2) hitEnemy(e, tor.dmg, { source: 'windbreath', dot: true });
      }
    }
  }
  game.tornadoes = game.tornadoes.filter(t => t.t < t.dur);
}

function updateProjectiles(dt) {
  const p = game.player;
  for (const pr of game.projectiles) {
    pr.life -= dt;
    if (pr.homing && !pr.homing.dead) {
      const a = Math.atan2(pr.homing.y - pr.y, pr.homing.x - pr.x);
      const spd = Math.hypot(pr.vx, pr.vy);
      const cur = Math.atan2(pr.vy, pr.vx);
      let diff = a - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = clamp(diff, -8 * dt, 8 * dt);
      pr.vx = Math.cos(cur + turn) * spd;
      pr.vy = Math.sin(cur + turn) * spd;
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    // trail
    if (!game.opt.lowFx && Math.random() < 0.5) game.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0, dur: 0.2, color: pr.color, r: pr.r * 0.5 });

    let done = pr.life <= 0 || pr.x < WALL || pr.x > W - WALL || pr.y < WALL || pr.y > H - WALL;

    if (!done) {
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (pr.hitSet && pr.hitSet.has(e)) continue;
        if (dist2(pr.x, pr.y, e.x, e.y) <= (pr.r + e.r) ** 2) {
          // Mirror Imp reflects shots back at you during its shell window
          if (e.reflect > 0 && !pr.reflected) {
            const a = Math.atan2(p.y - pr.y, p.x - pr.x);
            const spd = Math.max(220, Math.hypot(pr.vx, pr.vy));
            game.enemyProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: pr.dmg, r: pr.r + 1, life: 4, color: '#cfe2ff' });
            burst(e.x, e.y, '#cfe2ff', 6, 120, 0.3);
            done = true; break;
          }
          if (pr.kind === 'fireball') {
            explodeAt(pr.x, pr.y, pr.explodeRadius, pr.dmg, pr.color, pr.source, enchHitOpts(pr.ench));
            if (pr.perfected) game.clouds.push({ x: pr.x, y: pr.y, radius: pr.explodeRadius * 0.7, dps: Math.round(pr.dmg * 0.25), t: 0, dur: 3, tick: 0, source: 'fireball', fire: true });
            done = true;
          } else if (pr.kind === 'frost') {
            const opts = { slow: pr.slow, source: pr.source, ...enchHitOpts(pr.ench) };
            opts.slow = Math.max(pr.slow, opts.slow || 0);
            hitEnemy(e, pr.dmg, opts);
            if (pr.ench === 'splash') explodeAt(pr.x, pr.y, 70, pr.dmg * 0.5, pr.color, pr.source, { splash: true });
            pr.hitSet.add(e);
            if (pr.hitSet.size >= pr.pierce) {
              // Perfected: the final pierced enemy is frozen solid
              if (pr.perfected && !e.dead) { e.slowT = 2.5; e.slowAmt = 1; burst(e.x, e.y, '#cfeeff', 10, 140, 0.4); }
              done = true;
            }
          } else {
            const wasAlive = e.hp;
            hitEnemy(e, pr.dmg, { source: pr.source, ...enchHitOpts(pr.ench) });
            if (pr.ench === 'splash') explodeAt(pr.x, pr.y, 70, pr.dmg * 0.5, pr.color, pr.source, { splash: true });
            let didSplit = false;
            // Split Wand: a single-target bolt forks into two shards on hit
            if (p.stats.splitWand && pr.kind === 'missile' && !pr.split) { spawnMissileShards(pr, e); didSplit = true; }
            // Perfected Magic Missile: a kill splits into two homing shards
            if (!didSplit && pr.kind === 'missile' && pr.perfected && !pr.split && wasAlive > 0 && e.dead) spawnMissileShards(pr, e);
            done = true;
          }
          if (done) break;
        }
      }
    } else if (pr.kind === 'fireball' && pr.life <= 0) {
      explodeAt(pr.x, pr.y, pr.explodeRadius, pr.dmg, pr.color, pr.source, enchHitOpts(pr.ench));
      if (pr.perfected) game.clouds.push({ x: pr.x, y: pr.y, radius: pr.explodeRadius * 0.7, dps: Math.round(pr.dmg * 0.25), t: 0, dur: 3, tick: 0, source: 'fireball', fire: true });
    }
    if (done) pr.dead = true;
  }
  game.projectiles = game.projectiles.filter(pr => !pr.dead);
}

function updateEnemyProjectiles(dt) {
  for (const pr of game.enemyProjectiles) {
    pr.life -= dt;
    // homing shots curve toward the nearest body while keeping a constant speed
    if (pr.homing > 0) {
      pr.homing -= dt;
      const tgt = nearestPlayer(pr.x, pr.y) || game.player;
      const sp = Math.hypot(pr.vx, pr.vy) || 1;
      const hd = Math.max(1, Math.hypot(tgt.x - pr.x, tgt.y - pr.y));
      const turn = Math.min(1, 3.2 * dt);
      let vx = pr.vx + ((tgt.x - pr.x) / hd * sp - pr.vx) * turn;
      let vy = pr.vy + ((tgt.y - pr.y) / hd * sp - pr.vy) * turn;
      const nsp = Math.hypot(vx, vy) || 1;
      pr.vx = vx / nsp * sp; pr.vy = vy / nsp * sp;
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.life <= 0 || pr.x < WALL || pr.x > W - WALL || pr.y < WALL || pr.y > H - WALL) { pr.dead = true; continue; }
    for (const b of livePlayers()) {
      if (dist2(pr.x, pr.y, b.x, b.y) <= (pr.r + b.r) ** 2) {
        damagePlayer(pr.dmg, 'enemy spellfire', b);
        pr.dead = true;
        break;
      }
    }
  }
  game.enemyProjectiles = game.enemyProjectiles.filter(pr => !pr.dead);
}

function updateClouds(dt) {
  for (const c of game.clouds) {
    c.t += dt;
    c.tick -= dt;
    if (c.tick <= 0) {
      c.tick = 0.25;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (dist2(c.x, c.y, e.x, e.y) <= (c.radius + e.r) ** 2) {
          hitEnemy(e, c.dps * 0.25, { source: c.source, slow: c.slow, dot: true, ...enchHitOpts(c.ench) });
        }
      }
    }
  }
  game.clouds = game.clouds.filter(c => c.t < c.dur);
}

// ---------------------------------------------------------------------------
// Chaos item procs: timed random effects (enrage, haste, …) that temporarily
// modify damage and movement speed.
// ---------------------------------------------------------------------------
function addProcItem(itemId) {
  const item = ITEMS.find(it => it.id === itemId);
  if (!item || !item.proc) return;
  game.player.procs.push({ itemId, t: item.proc.interval * rand(0.5, 1), active: null });
}

function updateProcs(dt) {
  const p = game.player;
  let dmg = 1, spd = 1;
  for (const pr of p.procs) {
    const def = ITEMS.find(it => it.id === pr.itemId).proc;
    if (pr.active) {
      pr.active.t -= dt;
      if (pr.active.t <= 0) pr.active = null;
      else { dmg += pr.active.mode.dmg || 0; spd += pr.active.mode.spd || 0; }
    } else {
      pr.t -= dt;
      if (pr.t <= 0) {
        pr.t = def.interval;
        const mode = pick(def.modes);
        pr.active = { mode, t: def.dur };
        addText(p.x, p.y - 46, mode.name, mode.color || '#fff', 18);
        burst(p.x, p.y, mode.color || '#fff', 14, 150, 0.5);
        sfx('level');
        dmg += mode.dmg || 0; spd += mode.spd || 0;
      }
    }
  }
  p.tempDmg = Math.max(0.1, dmg);
  p.tempSpd = Math.max(0.1, spd);
}

// ---------------------------------------------------------------------------
// Fountains: consumable shrines that heal 25% max HP and sometimes gift a spell
// ---------------------------------------------------------------------------
function spawnFountain() {
  const p = game.player;
  let x, y;
  for (let i = 0; i < 12; i++) {
    x = rand(WALL + 70, W - WALL - 70);
    y = rand(WALL + 70, H - WALL - 70);
    if (dist2(x, y, p.x, p.y) > 220 * 220) break;
  }
  // Danger 9+ tilts the odds toward the risky Chaos fountain.
  let type = pick(FOUNTAIN_TYPES);
  if (game.danger >= 7.5 && Math.random() < 0.35) type = FOUNTAIN_TYPES.find(f => f.id === 'chaos');
  game.fountains.push({ x, y, t: 0, used: false, ft: type });
  addText(x, y - 34, type.name + '!', type.color, 16);
  burst(x, y, type.color, 14, 140, 0.5);
  sfx('shield');
}

function grantTempBuff(name, dmg, spd, dur, color) {
  game.player.buffs.push({ name, dmg: dmg || 0, spd: spd || 0, t: dur });
  addText(game.player.x, game.player.y - 46, name, color || '#fff', 18);
}

function consumeFountain(f) {
  const p = game.player;
  f.used = true;
  burst(f.x, f.y, f.ft.color, 26, 220, 0.6);
  switch (f.ft.id) {
    case 'heal':
      healPlayer(Math.round(p.stats.maxHp * 0.25 * (game.modFountainMult || 1)));
      break;
    case 'power':
      grantTempBuff('POWER!', 0.30, 0, 10, '#ffb347');
      break;
    case 'spell':
      if (p.spells.length < slotCap()) {
        const id = pick(Object.keys(SPELLS));
        p.spells.push({ id, tier: 0, t: 0, auto: true, temp: true });
        addText(f.x, f.y - 28, `A borrowed ${SPELLS[id].name}!`, '#c47bff', 16);
      } else { game.gold += 15; addText(f.x, f.y - 28, 'Spellbook full — +15 gold', '#ffd454', 15); }
      break;
    case 'greed': {
      const g = 15 + game.wave * 2;
      game.gold += g;
      addText(f.x, f.y - 28, `+${g} gold — but an AMBUSH!`, '#ffd454', 16);
      const pool = getWavePool(game.wave);
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        game.spawns.push({ x: clamp(f.x + Math.cos(a) * 70, WALL + 40, W - WALL - 40),
          y: clamp(f.y + Math.sin(a) * 70, WALL + 40, H - WALL - 40),
          type: weightedPick(pool), t: 0, delay: 0.5 });
      }
      break;
    }
    case 'chaos': {
      const roll = Math.random();
      if (roll < 0.55) { grantTempBuff('BLESSED!', 0.6, 0.2, 8, '#ffd454'); healPlayer(Math.round(p.stats.maxHp * 0.2)); }
      else if (roll < 0.8) { grantTempBuff('CURSED…', -0.3, -0.25, 6, '#ff5577'); }
      else { game.gold += 30; grantTempBuff('LUCKY!', 0.3, 0, 6, '#7fe08f'); }
      break;
    }
  }
  sfx('level');
}

function updateFountains(dt) {
  // one per wave, two from wave 10; the second bubbles up later in the wave
  if (game.fountainsSpawned < game.fountainMax &&
      game.waveTime >= game.fountainAt * (game.fountainsSpawned + 1)) {
    game.fountainsSpawned++;
    spawnFountain();
  }
  const p = game.player;
  for (const f of game.fountains) {
    f.t += dt;
    // sparkling water droplets
    if (game.opt.lowFx !== true && Math.random() < dt * 6) {
      game.particles.push({
        x: f.x + rand(-10, 10), y: f.y + rand(-8, 2),
        vx: rand(-15, 15), vy: rand(-55, -25),
        t: 0, dur: rand(0.4, 0.8), color: f.ft.color, r: rand(1.5, 3),
      });
    }
    // must stand in the fountain and drain it for 2 seconds
    if (!f.used && dist2(f.x, f.y, p.x, p.y) <= (p.r + 20) ** 2) {
      f.drain = (f.drain || 0) + dt;
      if (f.drain >= 2) consumeFountain(f);
    } else {
      f.drain = Math.max(0, (f.drain || 0) - dt * 1.5); // refill slowly if you step away
    }
  }
  game.fountains = game.fountains.filter(f => !f.used);
}

// Element landmarks: standing near one grants a small element-themed bonus.
// Run after procs/buffs so it layers on the current tempDmg / tempSpd.
function updateStructures(dt) {
  const p = game.player;
  game.structIce = 0;
  let near = null;
  for (const s of game.structures) {
    s.active = dist2(s.x, s.y, p.x, p.y) <= s.r * s.r;
    if (s.active) near = s;
  }
  if (near) {
    switch (near.type) {
      case 'earth': p.hp = Math.min(p.stats.maxHp, p.hp + 0.5 * dt * p.stats.healMult * HEAL_FACTOR); break; // +0.5 HP/s
      case 'fire':  p.tempDmg *= 1.10; break;                                                   // +10% spell damage
      case 'ice':   game.structIce = 0.05; break;                                               // +5% slow on ice hits
      case 'wind':  p.structWind = 3; break;                                                     // refresh 3s speed buff
    }
  }
  if (p.structWind > 0) { p.structWind -= dt; p.tempSpd += 0.25; } // wind boost lingers 3s
}

// Gold Magnet (pulls gold gems to it while you stand on it) and Item Mine
// (channel 5s for a random item).
function grantMineItem(ws) {
  const it = pick(ITEMS); // items only, never spells
  if (it.apply) it.apply(game.player.stats);
  if (it.proc) addProcItem(it.id);
  recordItem(it.id);
  game.player.hp = Math.min(game.player.hp, game.player.stats.maxHp);
  addText(ws.x, ws.y - 30, `Mined: ${it.icon} ${it.name}!`, '#ffd454', 17);
  burst(ws.x, ws.y, '#ffd454', 26, 220, 0.6);
  sfx('level');
}

function updateWorldSpawns(dt) {
  const p = game.player;
  for (const ws of game.worldSpawns) {
    ws.t += dt;
    const on = dist2(ws.x, ws.y, p.x, p.y) <= (ws.r + p.r) ** 2;
    ws.active = on;
    if (ws.kind === 'magnet') {
      if (on) { // drag every gold gem toward the magnet (≈ whole map in 8s)
        const spd = 175;
        for (const g of game.gems) {
          if (g.hp) continue; // gold only, not health pickups
          const d = Math.max(1, Math.hypot(ws.x - g.x, ws.y - g.y));
          g.x += (ws.x - g.x) / d * spd * dt;
          g.y += (ws.y - g.y) / d * spd * dt;
        }
      }
    } else if (ws.kind === 'mine') {
      if (on) {
        ws.prog += dt;
        if (ws.prog >= 5) { grantMineItem(ws); ws.used = true; }
      } else {
        ws.prog = Math.max(0, ws.prog - dt * 0.5); // slowly lose progress if you step off
      }
    }
  }
  game.worldSpawns = game.worldSpawns.filter(ws => !ws.used);
}

// Temporary timed buffs (fountains, etc.); fold into tempDmg / tempSpd.
function updateBuffs(dt) {
  const p = game.player;
  p.bonusArmor = 0;
  if (!p.buffs || !p.buffs.length) return;
  for (const b of p.buffs) b.t -= dt;
  p.buffs = p.buffs.filter(b => b.t > 0);
  let bonusArmor = 0;
  for (const b of p.buffs) { p.tempDmg += b.dmg; p.tempSpd += b.spd; bonusArmor += b.armor || 0; }
  p.bonusArmor = bonusArmor;
}

// From wave 3 on, arcane storms periodically telegraph AoE zones around the
// player that must be dodged. More and faster on later waves.
function updateHazards(dt) {
  if (game.wave < 3) return;
  game.hazardT -= dt;
  if (game.hazardT > 0) return;
  // Danger 3+ and the Storm Surge modifier make storms more frequent.
  let mult = (game.modHazardMult || 1) * (game.comboHazard || 1); // Treasure Panic spikes storms
  if (game.danger >= 0.25) mult *= 0.8;
  game.hazardT = Math.max(2.5, (rand(5.5, 8.5) - game.wave * 0.12) * mult);
  const p = game.player;
  const n = 1 + Math.floor(game.wave / 8);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), r = i === 0 ? rand(0, 60) : rand(60, 180);
    game.zones.push({
      x: clamp(p.x + Math.cos(a) * r, WALL + 40, W - WALL - 40),
      y: clamp(p.y + Math.sin(a) * r, WALL + 40, H - WALL - 40),
      radius: rand(75, 100), t: 0, delay: 1.2,
      dmg: Math.round((8 + game.wave * 1.4) * (1 + (game.danger || 0))), color: '#ff44aa',
    });
  }
}

function updateWalls(dt) {
  for (const w of game.walls) w.t += dt;
  game.walls = game.walls.filter(w => w.t < w.dur);
}

// Push the player out of any active Warden ward (blocks movement).
function pushOutOfWalls(p) {
  p = p || game.player;
  for (const w of game.walls) {
    const dx = p.x - w.x, dy = p.y - w.y;
    const min = w.r + p.r;
    const d = Math.hypot(dx, dy);
    if (d < min) {
      // if dead-centre (d≈0), eject in a fixed direction so we never trap
      const nx = d > 0.0001 ? dx / d : 1, ny = d > 0.0001 ? dy / d : 0;
      p.x = w.x + nx * min;
      p.y = w.y + ny * min;
    }
  }
  p.x = clamp(p.x, WALL + p.r, W - WALL - p.r);
  p.y = clamp(p.y, WALL + p.r, H - WALL - p.r);
}

// ---------------------------------------------------------------------------
// World events: persistent, shape-varied environmental hazards that damage the
// player AND enemies until the wave ends.
// ---------------------------------------------------------------------------
function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy || 1;
  let tt = ((px - x1) * dx + (py - y1) * dy) / L2;
  tt = clamp(tt, 0, 1);
  return Math.hypot(px - (x1 + tt * dx), py - (y1 + tt * dy));
}

function inWorldZone(z, x, y, rad) {
  rad = rad || 0;
  if (z.shape === 'circle') return dist2(z.x, z.y, x, y) <= (z.r + rad) ** 2;
  if (z.shape === 'band') {
    if (Math.abs(y - z.pos) > z.width / 2 + rad) return false;
    if (z.gaps) for (const g of z.gaps) if (Math.abs(x - g.x) <= g.w / 2 - rad) return false; // safe gap
    return true;
  }
}

// Horizontal segments of a tide band, skipping its safe gaps (for rendering).
function bandSegments(z) {
  const segs = []; let cur = WALL;
  for (const g of (z.gaps || []).slice().sort((a, b) => a.x - b.x)) {
    const s = g.x - g.w / 2, e = g.x + g.w / 2;
    if (s > cur) segs.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (cur < W - WALL) segs.push([cur, W - WALL]);
  return segs;
  if (z.shape === 'fissure') return pointSegDist(x, y, z.x1, z.y1, z.x2, z.y2) <= z.width / 2 + rad;
  return false;
}

function worldDmg() {
  return Math.max(1, Math.round((5 + game.wave * 0.8) * (1 + (game.danger || 0) * 0.3)));
}

function triggerWorldEvent() {
  const ev = game.worldEventPick;
  game.worldEvent = ev;
  game.worldZones = [];
  game.worldSpawnT = 0;
  const dmg = worldDmg();
  addText(W / 2, H / 2 - 80, ev.name + '!', ev.color, 30);
  game.shake = Math.max(game.shake, 10);
  sfx('boom');
  const ws = 1 + game.wave * 0.04; // hazards grow with the wave
  switch (ev.id) {
    case 'quake': { // many cracking fissure lines criss-crossing the arena
      const n = 5 + Math.floor(game.wave / 5);
      for (let i = 0; i < n; i++) {
        const horiz = Math.random() < 0.5;
        const off = rand(WALL + 60, (horiz ? H : W) - WALL - 60);
        game.worldZones.push(horiz
          ? { shape: 'fissure', x1: WALL, y1: off, x2: W - WALL, y2: off + rand(-90, 90), width: 58 * ws, warn: 1.2, t: 0, dmg }
          : { shape: 'fissure', x1: off, y1: WALL, x2: off + rand(-90, 90), y2: H - WALL, width: 58 * ws, warn: 1.2, t: 0, dmg });
      }
      break;
    }
    case 'tide': { // wide bands sweeping the arena, each with safe gap(s) to pass through
      const gaps = () => {
        const n = 1 + (Math.random() < 0.5 ? 1 : 0);
        const g = [];
        for (let i = 0; i < n; i++) g.push({ x: rand(WALL + 120, W - WALL - 120), w: rand(110, 150) });
        return g;
      };
      game.worldZones.push({ shape: 'band', pos: H - WALL - 60, width: 200 * ws, dir: -1, spd: 105, warn: 1.2, t: 0, dmg, gaps: gaps() });
      if (game.wave >= 12) game.worldZones.push({ shape: 'band', pos: WALL + 60, width: 170 * ws, dir: 1, spd: 90, warn: 1.4, t: 0, dmg, gaps: gaps() });
      break;
    }
    // 'storm' and 'volcano' spawn their zones over time in updateWorld
  }
}

function updateWorld(dt) {
  const p = game.player;
  // fire the scheduled event once we reach mid-round
  if (!game.worldEvent && game.waveTime >= game.worldEventAt) triggerWorldEvent();
  if (!game.worldEvent) return;
  const ev = game.worldEvent, dmg = worldDmg();

  // ongoing zone spawning / movement per event
  const ws = 1 + game.wave * 0.04;
  if (ev.id === 'storm') {
    // wandering lightning strikes that warn, zap, then relocate
    const cap = 6 + Math.floor(game.wave / 5);
    game.worldSpawnT -= dt;
    if (game.worldZones.length < cap && game.worldSpawnT <= 0) {
      game.worldSpawnT = 0.6;
      game.worldZones.push({ shape: 'circle', x: rand(WALL + 60, W - WALL - 60), y: rand(WALL + 60, H - WALL - 60),
        r: rand(80, 120) * ws, warn: 0.8, t: 0, dmg, life: rand(2.5, 4) });
    }
    for (const z of game.worldZones) {
      z.life -= dt;
      if (z.life <= 0) { z.x = rand(WALL + 60, W - WALL - 60); z.y = rand(WALL + 60, H - WALL - 60); z.t = 0; z.warn = 0.7; z.life = rand(2.5, 4); }
    }
  } else if (ev.id === 'volcano') {
    // lava pools that erupt over time and linger for the rest of the round
    const cap = 12 + Math.floor(game.wave / 3);
    game.worldSpawnT -= dt;
    if (game.worldZones.length < cap && game.worldSpawnT <= 0) {
      game.worldSpawnT = rand(1.1, 1.9);
      game.worldZones.push({ shape: 'circle', x: rand(WALL + 50, W - WALL - 50), y: rand(WALL + 50, H - WALL - 50),
        r: rand(70, 105) * ws, warn: 1.0, t: 0, dmg });
    }
  } else if (ev.id === 'tide') {
    const z = game.worldZones[0];
    if (z) {
      z.pos += z.dir * z.spd * dt;
      if (z.pos < WALL + 60) { z.pos = WALL + 60; z.dir = 1; }
      if (z.pos > H - WALL - 60) { z.pos = H - WALL - 60; z.dir = -1; }
    }
  }

  // advance warn timers
  for (const z of game.worldZones) z.t += dt;

  // pulsing damage on a tick — hits the player and every enemy in an active zone
  game.worldTickT -= dt;
  const tick = game.worldTickT <= 0;
  if (tick) game.worldTickT = 0.4;
  for (const z of game.worldZones) {
    if (z.t < z.warn) continue; // still telegraphing
    if (!tick) continue;
    for (const b of livePlayers()) if (inWorldZone(z, b.x, b.y, b.r)) damagePlayer(z.dmg, 'the raging arena', b);
    for (const e of game.enemies) {
      if (!e.dead && inWorldZone(z, e.x, e.y, e.r)) hitEnemy(e, z.dmg);
    }
  }
}

function updateZones(dt) {
  for (const z of game.zones) {
    z.t += dt;
    if (z.t >= z.delay && !z.done) {
      z.done = true;
      for (const b of livePlayers()) if (dist2(z.x, z.y, b.x, b.y) <= z.radius * z.radius) damagePlayer(z.dmg, 'a telegraphed blast', b);
      game.novas.push({ x: z.x, y: z.y, t: 0, dur: 0.3, radius: z.radius, color: z.color });
      burst(z.x, z.y, z.color, 20, 240, 0.45);
      game.shake = Math.max(game.shake, 6);
      sfx('boom');
    }
  }
  game.zones = game.zones.filter(z => !z.done);
}

function updateMeteors(dt) {
  for (const m of game.meteors) {
    m.t += dt;
    if (m.t >= m.delay && !m.done) {
      m.done = true;
      explodeAt(m.x, m.y, m.radius, m.dmg, '#ff6b4a', m.source, enchHitOpts(m.ench));
      // Perfected Meteor: a burning crater lingers where it struck
      if (m.perfected) game.clouds.push({ x: m.x, y: m.y, radius: m.radius * 0.75, dps: Math.round(m.dmg * 0.18), t: 0, dur: 3.5, tick: 0, source: 'meteor', fire: true });
    }
  }
  game.meteors = game.meteors.filter(m => !m.done);
}


// ---------------------------------------------------------------------------
// Gems / pickups
// ---------------------------------------------------------------------------
function updateGems(dt) {
  for (const g of game.gems) {
    g.t += dt;
    const p = nearestPlayer(g.x, g.y) || game.player; // either body can vacuum/collect
    const pickupR = p.stats.pickup;
    const d = Math.max(1, Math.hypot(p.x - g.x, p.y - g.y));
    if (g.vacuum || d < pickupR) {
      // fly in a straight line to the character
      const spd = g.vacuum ? 950 : 520;
      g.x += (p.x - g.x) / d * spd * dt;
      g.y += (p.y - g.y) / d * spd * dt;
      g.vx = 0; g.vy = 0;
    } else {
      g.vx *= Math.pow(0.05, dt);
      g.vy *= Math.pow(0.05, dt);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    if (d < p.r + 8) {
      g.dead = true;
      if (g.hp) {
        p.hp = Math.min(p.stats.maxHp, p.hp + Math.round(g.hp * p.stats.healMult * HEAL_FACTOR));
      } else {
        // fractional gold accumulates so percentage bonuses always pay out;
        // higher danger yields +50% materials per +100% enemy power
        let v = g.val * p.stats.matMult * (1 + (game.danger || 0) * 0.5);
        // budget pool: each point doubles the next collected coin
        if (game.budget >= 1) { v *= 2; game.budget -= 1; addText(g.x, g.y - 8, '×2', '#ffd454', 12); }
        game.goldFrac = (game.goldFrac || 0) + v;
        const whole = Math.floor(game.goldFrac);
        if (whole > 0) { game.gold += whole; game.goldEarned += whole; game.goldFrac -= whole; }
        game.xpFrac = (game.xpFrac || 0) + (game.modXpMult || 1);
        const xw = Math.floor(game.xpFrac);
        if (xw > 0) { game.xp += xw; game.xpFrac -= xw; }
        sfx('pickup');
        if (game.xp >= xpNeeded(game.level)) {
          game.xp -= xpNeeded(game.level);
          game.level++;
          game.pendingLevelUps++;
          addText(p.x, p.y - 34, 'LEVEL UP!', '#ffe96b', 20);
          sfx('level');
        }
      }
    }
  }
  game.gems = game.gems.filter(g => !g.dead);
}

// ---------------------------------------------------------------------------
// Wave lifecycle
// ---------------------------------------------------------------------------
function startWave(n) {
  game.wave = n;
  // Cursed King: bleeds max HP each new wave unless a relic was bought last shop.
  const p0 = game.player;
  if (n > 1 && p0 && p0.stats.cursedKing && !p0.boughtRelic) {
    p0.stats.maxHp = Math.max(20, p0.stats.maxHp - 8);
    p0.hp = Math.min(p0.hp, p0.stats.maxHp);
    addText(p0.x, p0.y - 50, 'THE CURSE DEEPENS · −8 MAX HP', '#ff5577', 18);
  }
  game.waveTime = 0;
  game.waveDur = bossCountForWave(n) ? Infinity : Math.min(60, 16 + n * 2) + 10;
  game.spawnTimer = 0.5;
  game.eliteSpawned = false;
  game.bossSpawned = false;
  game.rerolls = 0;
  game.enemies = [];
  game.projectiles = [];
  game.enemyProjectiles = [];
  game.clouds = [];
  game.meteors = [];
  game.beams = [];
  game.novas = [];
  game.familiars = [];
  game.spawns = [];
  game.zones = [];
  game.walls = [];
  game.cones = [];
  game.tornadoes = [];
  game.structures = [];
  game.structIce = 0;
  game.worldSpawns = [];
  game.dmgMeter = {};
  game.hazardT = 5; // grace period before the first arcane storm
  game.castQueue = [];
  game.fountains = [];
  game.fountainsSpawned = 0;
  game.fountainAt = rand(7, 14);
  // not every wave gets a fountain; a second one is rarer and only from wave 10
  game.fountainMax = (Math.random() < 0.6 ? 1 : 0) + (n >= 10 && Math.random() < 0.35 ? 1 : 0);
  game.dangerEliteDone = false;
  game.castCount = 0;

  // the element realm for each wave is decided up-front (see realmSchedule, built
  // in beginRun) so the roadmap can reveal it in advance; endless waves drop back
  // to the player's chosen colour scheme.
  game.mapElement = n <= 20 ? (game.realmSchedule[n] || pick(['fire', 'ice', 'earth', 'wind'])) : null;
  // scatter 5 element landmarks that give a small bonus when you stand near them;
  // keep them clear of the spawn point and spaced apart so they never overlap.
  if (game.mapElement) {
    const sep = 160; // min distance between landmark centres
    for (let i = 0; i < 5; i++) {
      let best = null;
      for (let k = 0; k < 40; k++) {
        const x = rand(WALL + 80, W - WALL - 80), y = rand(WALL + 80, H - WALL - 80);
        if (dist2(x, y, W / 2, H / 2) <= 170 * 170) continue;
        if (game.structures.every(o => dist2(x, y, o.x, o.y) >= sep * sep)) { best = { x, y }; break; }
        if (!best) best = { x, y }; // fallback if a perfectly-spaced spot is hard to find
      }
      if (best) game.structures.push({ x: best.x, y: best.y, type: game.mapElement, r: 74, ph: rand(0, Math.PI * 2) });
    }
  }
  // a Gold Magnet and/or Item Mine may spawn (not guaranteed each wave)
  for (const kind of ['magnet', 'mine']) {
    if (Math.random() >= 0.4) continue; // ~40% chance each
    let x = W / 2, y = H / 2;
    for (let k = 0; k < 20; k++) {
      x = rand(WALL + 90, W - WALL - 90); y = rand(WALL + 90, H - WALL - 90);
      if (dist2(x, y, W / 2, H / 2) > 200 * 200 && game.worldSpawns.every(o => dist2(x, y, o.x, o.y) > 200 * 200)) break;
    }
    game.worldSpawns.push({ kind, x, y, r: kind === 'magnet' ? 24 : 28, prog: 0, t: 0 });
  }

  // schedule a possible world event mid-round (wave 5+, 33% chance)
  game.worldEvent = null;
  game.worldZones = [];
  game.worldEventPick = null;
  game.worldTickT = 0;
  game.worldSpawnT = 0;
  if (n >= 5 && Math.random() < 0.33) {
    game.worldEventPick = pick(WORLD_EVENTS);
    const mid = game.waveDur === Infinity ? 22 : game.waveDur * 0.45;
    game.worldEventAt = mid + rand(-3, 3);
  } else {
    game.worldEventAt = Infinity;
  }

  // roll a wave modifier on every 3rd non-boss, non-horde wave (from wave 3)
  game.modifier = null;
  game.modGemMult = 0; game.modXpMult = 1; game.modDmgTaken = 1; game.modCdMult = 1;
  game.modSpawnMult = 1; game.modFountainMult = 1; game.modHazardMult = 1; game.modSwarm = false;
  game.pendingShopDiscount = 0; // cleared each wave; the drought sets it for the next shop
  if (n >= 3 && n % 3 === 0 && !bossCountForWave(n) && !isHordeWave(n)) {
    const m = pick(WAVE_MODIFIERS);
    game.modifier = m;
    switch (m.id) {
      case 'bloodmoon': game.modSpawnMult = 1.4; game.modGemMult = 1.4; break;
      case 'drought':   game.modCdMult = 1.2; game.pendingShopDiscount = 0.25; break;
      case 'glass':     game.modDmgTaken = 1.3; game.modFountainMult = 2; break;
      case 'swarm':     game.modSwarm = true; game.modSpawnMult = 1.2; break;
      case 'treasure':  game.modSpawnMult = 0.5; game.modGemMult = 2.5; break;
      case 'storm':     game.modHazardMult = 0.6; game.modXpMult = 1.5; break;
    }
  }

  const p = game.player;
  p.buffs = [];
  p.structWind = 0;
  p.spells = p.spells.filter(s => !s.temp); // borrowed (fountain) spells expire
  if (p.stats.rando) randomizeRandoSpells(); // Rando: a fresh random spellbook each wave
  p.x = W / 2; p.y = H / 2;
  for (const s of p.spells) s.t = 0;
  // co-op: resync P2's shared spellbook, revive & reposition both bodies
  if (game.coop && game.p2) {
    game.p2.spells = clonePlayerSpells(p);
    game.p2.buffs = []; game.p2.procs = [];
    p.x = W / 2 - 60; game.p2.x = W / 2 + 60; game.p2.y = H / 2;
    reviveAll();
  }
  setState('playing');
  addText(W / 2, H / 2 - 60, n === 20 ? 'FINAL WAVE' : 'WAVE ' + n, '#8be0ff', 30);
  if (HORDE_WAVES.includes(n)) addText(W / 2, H / 2 - 26, 'THE HORDE COMES!', '#ff8a5a', 22);
  // Authored combo wave: announce it and let it intensify hazards if it wants
  const combo = comboForWave(n);
  game.comboHazard = 1;
  if (combo && COMBOS[combo]) {
    const c = COMBOS[combo];
    addText(W / 2, H / 2 - 26, c.name.toUpperCase() + '!', c.color, 22);
    if (c.hazardMult) game.comboHazard = c.hazardMult;
  }
  if (game.modifier) addText(W / 2, H / 2 - 26, `${game.modifier.icon} ${game.modifier.name}: ${game.modifier.desc}`, game.modifier.color, 18);
  if (game.mapElement) {
    const mt = ELEMENT_THEMES[game.mapElement];
    addText(W / 2, H / 2 + 8, `${mt.icon} ${mt.name} — ${ELEMENTS[game.mapElement].name} +2`, mt.wall, 18);
  }
}

function endWave() {
  const p = game.player;
  // next-wave debts only apply to the wave that just ran — clear them now
  game.debtHpMult = 1; game.debtSpdMult = 1;
  // record this wave's DPS for the post-run "highest DPS wave" stat
  const waveDmg = Object.values(game.dmgMeter).reduce((a, b) => a + b, 0);
  const waveDps = waveDmg / Math.max(1, game.waveTime);
  if (waveDps > (game.bestWave.dps || 0)) game.bestWave = { wave: game.wave, dps: Math.round(waveDps) };
  // uncollected coins are NOT auto-grabbed. 33% is banked now, 33% becomes
  // doubling "budget" for the next coins you pick up, 34% is voided — and the
  // Gold Reclaimer item claws back 33% of the void per copy (up to 3).
  const coins = game.gems.filter(g => !g.hp).length;
  const coinValue = p.stats.matMult * (1 + (game.danger || 0) * 0.5);
  const banked = Math.floor(coins * 0.33);
  const toBudget = Math.floor(coins * 0.33);
  let voided = coins - banked - toBudget;
  const reclaimPct = Math.min(1, 0.33 * (p.stats.reclaim || 0));
  const reclaimed = Math.floor(voided * reclaimPct);
  voided -= reclaimed;
  const banks = Math.round((banked + reclaimed) * coinValue);
  game.gold += banks; game.goldEarned += banks;
  game.budget = (game.budget || 0) + toBudget;

  for (const e of game.enemies) burst(e.x, e.y, e.color, 6, 120, 0.35);
  game.gems = [];
  game.enemies = [];
  game.enemyProjectiles = [];
  game.spawns = [];
  const bonus = 8 + game.wave;
  game.gold += bonus; game.goldEarned += bonus;
  game.player.hp = game.player.stats.maxHp; // full heal between waves
  addText(p.x, p.y - 64, `Wave clear! +${bonus} gold`, '#ffd454', 18);
  if (coins > 0) addText(p.x, p.y - 44, `Banked ${banked} · Budget +${toBudget} · Voided ${voided}`, '#9fb0c8', 14);

  afterWaveCollected();
}

function afterWaveCollected() {
  if (game.wave === 20 && !game.endless) {
    sfx('win');
    recordWin(game.player.charId);
    const hlId = recordScore(true);
    const dps = game.runTime > 0 ? Math.round(game.totalDmg / game.runTime) : 0;
    saveRun(); // keep the checkpoint in case they continue into endless
    setState('win');
    document.getElementById('win-stats').textContent =
      `The Archlich twins are dust. ${game.kills} kills — ${dps} DPS — Level ${game.level} — ${game.gold} gold to spare`;
    renderRunSummary('win-summary', true);
    document.getElementById('win-board').innerHTML = scoreboardHTML(hlId);
    return;
  }
  checkMastery();
  if (game.pendingMastery.length) showMastery();
  else if (game.pendingLevelUps > 0) showLevelUp();
  else openShop();
}

// Detect spells that crossed a new mastery threshold (cumulative run damage).
function checkMastery() {
  for (const id in game.masteryAcc) {
    if (!SPELLS[id] || !game.player.spells.some(s => s.id === id)) continue;
    let lvl = game.masteryLvl[id] || 0;
    while (lvl < MASTERY_THRESHOLDS.length && game.masteryAcc[id] >= MASTERY_THRESHOLDS[lvl]) {
      game.pendingMastery.push(id); lvl++;
    }
    game.masteryLvl[id] = lvl;
  }
}

function afterMasteryDone() {
  if (game.pendingLevelUps > 0) showLevelUp();
  else openShop();
}

function showMastery() {
  const id = game.pendingMastery[0];
  if (!id) { afterMasteryDone(); return; }
  const def = SPELLS[id];
  setState('mastery');
  const lvl = game.masteryLvl[id] || 1;
  const stars = `<span style="color:#ffd454">${'★'.repeat(lvl)}</span><span style="color:#4a5a78">${'☆'.repeat(5 - lvl)}</span>`;
  document.getElementById('mastery-sub').innerHTML = `${def.icon} ${def.name} — Mastery ${stars} — choose a mastery`;
  const row = document.getElementById('mastery-choices');
  row.innerHTML = '';
  for (const opt of MASTERY_OPTIONS) {
    const card = document.createElement('div');
    card.className = 'card choice';
    card.innerHTML = `<div class="icon">${opt.icon}</div><div class="name">${opt.name}</div><div class="desc">${def.icon} ${def.name}<br>${signColor(opt.desc)}</div>`;
    card.onclick = () => {
      opt.apply(masteryMod(id));
      game.pendingMastery.shift();
      sfx('level');
      saveRun();
      if (game.pendingMastery.length) showMastery();
      else afterMasteryDone();
    };
    row.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// State / overlays
// ---------------------------------------------------------------------------
const overlays = ['title', 'charselect', 'spellselect', 'settings', 'levelup', 'mastery', 'shop', 'pause', 'gameover', 'win'];

// Accessibility / readability toggles, shown on the settings screen.
const SETTINGS = [
  { key: 'lowFx',      label: 'Reduce particle density' },
  { key: 'bigTele',    label: 'Bigger enemy telegraphs' },
  { key: 'hiContrast', label: 'High-contrast enemy shots' },
  { key: 'bossNames',  label: 'Show boss attack names' },
  { key: 'shake',      label: 'Screen shake', invert: true },
  { key: 'dmgNumbers', label: 'Floating damage numbers', invert: true },
];

const VOLUME_STEPS = [0, 0.25, 0.5, 1];

function renderSettings() {
  const el = document.getElementById('settings-list');
  el.innerHTML = '';
  const section = title => { const h = document.createElement('h3'); h.textContent = title; el.appendChild(h); };
  const row = (label, btnText, on, onClick) => {
    const r = document.createElement('div'); r.className = 'bind-row';
    r.innerHTML = `<span class="bind-name">${label}</span>`;
    const b = document.createElement('button');
    b.className = 'key-btn' + (on ? ' on' : '');
    b.textContent = btnText; b.onclick = onClick;
    r.appendChild(b); el.appendChild(r);
  };

  // --- Audio ---
  section('Audio');
  const vol = game.opt.volume !== undefined ? game.opt.volume : 1;
  row('Volume', vol <= 0 ? 'Off' : Math.round(vol * 100) + '%', vol > 0, () => {
    let idx = VOLUME_STEPS.indexOf(vol); if (idx === -1) idx = VOLUME_STEPS.length - 1;
    game.opt.volume = VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length];
    saveOpts(); sfx('buy'); renderSettings();
  });
  row('Mute all (M)', muted ? 'MUTED' : 'ON', !muted, () => {
    muted = !muted; game.opt.muted = muted; saveOpts(); renderSettings();
  });

  // --- Colour scheme ---
  section('Colour scheme');
  const tr = document.createElement('div'); tr.className = 'theme-row';
  for (const th of THEMES) {
    const b = document.createElement('button');
    b.className = 'theme-btn' + ((game.opt.theme || 'midnight') === th.id ? ' on' : '');
    b.style.background = th.bg; b.style.borderColor = th.wall;
    b.title = th.name; b.textContent = th.name;
    b.onclick = () => { game.opt.theme = th.id; saveOpts(); renderSettings(); };
    tr.appendChild(b);
  }
  el.appendChild(tr);

  // --- Gameplay ---
  section('Gameplay');
  row('Replay failed waves', game.opt.replayFails ? 'ON' : 'OFF', !!game.opt.replayFails, () => {
    game.opt.replayFails = !game.opt.replayFails; saveOpts(); renderSettings();
  });

  // --- Readability ---
  section('Readability');
  for (const s of SETTINGS) {
    const on = s.invert ? game.opt[s.key] !== false : !!game.opt[s.key];
    row(s.label, on ? 'ON' : 'OFF', on, () => { game.opt[s.key] = !on; saveOpts(); renderSettings(); });
  }
}

function setState(s) {
  game.state = s;
  for (const id of overlays) {
    document.getElementById(id).classList.toggle('visible', id === s);
  }
  if (s === 'title') renderTitleScoreboard();
}

function togglePause() {
  if (game.state === 'playing') {
    setState('paused');
    document.getElementById('pause').classList.add('visible');
    rebindSlot = null;
    renderKeybinds();
    renderWaveOverview('pause-overview', game.wave);
  } else if (game.state === 'paused') {
    setState('playing');
  }
}

function renderKeybinds() {
  const el = document.getElementById('keybinds');
  if (!el) return;
  let html = '<h3>Spell Hotkeys</h3>';
  for (let i = 0; i < MAX_SPELL_SLOTS; i++) {
    const sp = game.player.spells[i];
    const def = sp ? SPELLS[sp.id] : null;
    let name = def ? `${def.icon} ${spellName(sp)}` : '<i>empty slot</i>';
    if (sp && sp.id === 'orbs') name += ' <i>(passive)</i>';
    else if (sp && sp.auto === false) name += ' <i>(manual)</i>';
    const label = rebindSlot === i ? 'press a key…' : keyLabel(slotKeys[i]);
    html += `<div class="bind-row">
      <span class="bind-name">${name}</span>
      <button class="key-btn${rebindSlot === i ? ' listening' : ''}" data-slot="${i}">${label}</button>
    </div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.key-btn').forEach(b => {
    b.onclick = () => { rebindSlot = +b.dataset.slot; renderKeybinds(); };
  });
}

// ---------------------------------------------------------------------------
// Persistence: run checkpoints (between waves) + per-wizard win records
// ---------------------------------------------------------------------------
const SAVE_KEY = 'wavywizards-save';
const WINS_KEY = 'wavywizards-wins';

function saveRun() {
  const p = game.player;
  const data = {
    wave: game.wave, gold: game.gold, xp: game.xp, level: game.level,
    pendingLevelUps: game.pendingLevelUps, kills: game.kills, endless: game.endless,
    danger: game.danger || 0, budget: game.budget || 0,
    totalDmg: game.totalDmg || 0, runTime: game.runTime || 0,
    runDmg: game.runDmg || {}, goldEarned: game.goldEarned || 0, bestWave: game.bestWave || { wave: 0, dps: 0 },
    debtHpMult: game.debtHpMult || 1, debtSpdMult: game.debtSpdMult || 1, discountBuys: game.discountBuys || 0, arcaneLoan: !!game.arcaneLoan,
    realmSchedule: game.realmSchedule || {},
    charId: p.charId, hp: p.hp,
    stats: p.stats,
    spells: p.spells.map(s => ({ id: s.id, tier: s.tier, auto: s.auto !== false, enchant: s.enchant || null, variant: s.variant || null, fuseBonus: s.fuseBonus || 0 })),
    procItems: p.procs.map(pr => pr.itemId),
    items: p.items,
    lastResort: p.lastResort,
    lastResortType: p.lastResortType || 'basic',
    lastResortSacrificed: !!p.lastResortSacrificed,
    masteryAcc: game.masteryAcc, masteryLvl: game.masteryLvl, masteryMods: game.masteryMods,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
}

function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    return d && d.wave >= 1 && Array.isArray(d.spells) && d.spells.length ? d : null;
  } catch (e) { return null; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* private mode */ }
}

// Resumes a saved run at the shop after its last completed wave.
function resumeRun() {
  const d = loadSave();
  if (!d) return;
  selectedChar = CHARACTERS.find(c => c.id === d.charId) || CHARACTERS[0];
  game.player = freshPlayer(selectedChar, d.spells[0].id);
  const p = game.player;
  Object.assign(p.stats, d.stats);
  p.spells = d.spells.map(s => ({ id: s.id, tier: s.tier, t: 0, auto: s.auto !== false, enchant: s.enchant || undefined, variant: s.variant || undefined, fuseBonus: s.fuseBonus || 0 }));
  for (const id of d.procItems || []) addProcItem(id);
  p.items = Array.isArray(d.items) ? d.items : [];
  p.lastResort = d.lastResort !== false;
  p.lastResortType = d.lastResortType || 'basic';
  p.lastResortSacrificed = !!d.lastResortSacrificed;
  game.masteryAcc = d.masteryAcc || {};
  game.masteryLvl = d.masteryLvl || {};
  game.masteryMods = d.masteryMods || {};
  game.pendingMastery = [];
  p.hp = Math.min(d.hp || p.stats.maxHp, p.stats.maxHp);
  game.gold = d.gold; game.xp = d.xp; game.level = d.level; game.budget = d.budget || 0;
  game.pendingLevelUps = d.pendingLevelUps || 0;
  game.kills = d.kills || 0;
  game.totalDmg = d.totalDmg || 0; game.runTime = d.runTime || 0;
  game.runDmg = d.runDmg || {}; game.goldEarned = d.goldEarned || 0; game.bestWave = d.bestWave || { wave: 0, dps: 0 };
  game.debtHpMult = d.debtHpMult || 1; game.debtSpdMult = d.debtSpdMult || 1; game.discountBuys = d.discountBuys || 0; game.arcaneLoan = !!d.arcaneLoan;
  game.realmSchedule = d.realmSchedule && Object.keys(d.realmSchedule).length ? d.realmSchedule : (() => { const s = {}; for (let w = 1; w <= 20; w++) s[w] = pick(['fire', 'ice', 'earth', 'wind']); return s; })();
  game.wave = d.wave;
  game.endless = !!d.endless || d.wave >= 20;
  game.danger = d.danger || 0;
  game.shopOffers = [];
  game.player.inputId = game.coop ? 'wasd' : 'both';
  game.p2 = game.coop ? makePlayer2() : null;
  if (game.pendingLevelUps > 0) showLevelUp();
  else openShop();
}

function getWins() {
  try { return JSON.parse(localStorage.getItem(WINS_KEY)) || []; } catch (e) { return []; }
}

function recordWin(charId) {
  const wins = getWins();
  if (!wins.includes(charId)) {
    wins.push(charId);
    try { localStorage.setItem(WINS_KEY, JSON.stringify(wins)); } catch (e) { /* private mode */ }
  }
}

// ---------------------------------------------------------------------------
// Highscore scoreboard — ranks runs by overall DPS and enemies killed
// ---------------------------------------------------------------------------
const SCORES_KEY = 'wavywizards-scores';

function loadScores() {
  try { const s = JSON.parse(localStorage.getItem(SCORES_KEY)); return Array.isArray(s) ? s : []; }
  catch (e) { return []; }
}

// Combined score: overall DPS + kills (+ a nudge for waves cleared & victory).
function computeScore(dps, kills, wave, won) {
  return Math.round(dps + kills * 3 + wave * 25 + (won ? 500 : 0));
}

// Snapshots the just-finished run, stores it in the top-10 board, returns its id.
function recordScore(won) {
  const dps = game.runTime > 0 ? game.totalDmg / game.runTime : 0;
  const char = (game.player && game.player.charId) || '?';
  const entry = {
    id: Date.now() + '-' + Math.floor(Math.random() * 1e6),
    score: computeScore(dps, game.kills, game.wave, won),
    dps: Math.round(dps), kills: game.kills, wave: game.wave,
    char, won: !!won, endless: !!game.endless, date: Date.now(),
  };
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, 10);
  try { localStorage.setItem(SCORES_KEY, JSON.stringify(top)); } catch (e) { /* private mode */ }
  return top.some(s => s.id === entry.id) ? entry.id : null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

// Builds the leaderboard table HTML; highlightId glows the row for this run.
function scoreboardHTML(highlightId) {
  const scores = loadScores();
  if (!scores.length) return '<p class="sb-empty">No runs recorded yet — survive and set the first score!</p>';
  let rows = '';
  scores.forEach((s, i) => {
    const charDef = CHARACTERS.find(c => c.id === s.char);
    const who = charDef ? charDef.name : s.char;
    const rank = MEDALS[i] || (i + 1);
    const hl = s.id === highlightId ? ' class="sb-hl"' : '';
    const flag = s.won ? ' 🏆' : '';
    rows += `<tr${hl}><td class="sb-rank">${rank}</td><td class="sb-score">${s.score}</td>` +
      `<td>${s.dps}</td><td>${s.kills}</td><td>W${s.wave}${flag}</td><td class="sb-who">${who}</td></tr>`;
  });
  return `<table class="scoreboard"><thead><tr>` +
    `<th></th><th>Score</th><th>DPS</th><th>Kills</th><th>Wave</th><th>Wizard</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTitleScoreboard() {
  const el = document.getElementById('scoreboard');
  if (!el) return;
  const scores = loadScores();
  el.style.display = scores.length ? '' : 'none';
  if (!scores.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h3>🏆 Leaderboard</h3>${scoreboardHTML()}`;
}

// ---------------------------------------------------------------------------
// Post-run build summary — a memorable recap shown on death / victory
// ---------------------------------------------------------------------------
const ELEM_ADJECTIVE = { fire: 'Volcanic', ice: 'Glacial', earth: 'Seismic', wind: 'Tempest' };
const SPELL_NOUN = {
  missile: 'Barrage', fireball: 'Inferno', frost: 'Frostfall', lightning: 'Storm',
  shield: 'Bulwark', poison: 'Miasma', meteor: 'Cataclysm', drain: 'Famine',
  orbs: 'Orb Dance', nova: 'Radiance', firebreath: 'Dragonbreath', icebreath: 'Coldsnap',
  earthbreath: 'Avalanche', windbreath: 'Cyclone',
};

// Generates a flavourful build title, e.g. "Volcanic Orb Dance".
function buildTitle(element, topSpellId) {
  const adj = (element && ELEM_ADJECTIVE[element]) || 'Arcane';
  const noun = (topSpellId && SPELL_NOUN[topSpellId]) || 'Wizardry';
  return `${adj} ${noun}`;
}

// One actionable improvement hint based on how the run ended.
function buildHint(sum, won) {
  const s = game.player.stats;
  if (won) return 'Flawless run — try a higher Danger level or a drawback wizard next.';
  const c = sum.cause || '';
  if (c === 'enemy spellfire') return 'Enemy projectiles caught you — keep moving and weave between shots.';
  if (c === 'a telegraphed blast') return 'Dashed red zones telegraph before they hit — step out of them in time.';
  if (c === 'the raging arena') return 'World hazards sweep the arena mid-wave — reposition early when one starts.';
  // contact death (cause is an enemy name)
  if (c) {
    if (s.armor + 2 * game.elem.earth <= 1) return `Low armor made contact damage lethal — grab armor, or kite the ${c}.`;
    if (s.maxHp <= 60) return `Fragile build — a few Heart Crystals would have survived the ${c}.`;
    return `The ${c} closed the distance — kite more, or add knockback/slows.`;
  }
  if (game.player.spells.length < 3) return 'A thin spellbook left gaps — more spells means more coverage.';
  return 'Fuse spells to Tier IV and stack an element for a stronger run.';
}

function computeRunSummary(won) {
  const p = game.player;
  const dmgEntries = Object.entries(game.runDmg).filter(([id, v]) => SPELLS[id] && v > 0).sort((a, b) => b[1] - a[1]);
  const topId = dmgEntries[0] ? dmgEntries[0][0] : (p.spells[0] && p.spells[0].id);
  const topSpell = topId && SPELLS[topId] ? SPELLS[topId] : null;
  // most valuable item = highest total gold sunk into it (price × copies)
  let topItem = null, topVal = -1;
  for (const it of (p.items || [])) {
    const def = ITEMS.find(i => i.id === it.id);
    if (!def) continue;
    const val = def.price * it.n;
    if (val > topVal) { topVal = val; topItem = def; }
  }
  // favourite element: run damage mapped through each spell's elements
  const elemDmg = { fire: 0, ice: 0, earth: 0, wind: 0 };
  for (const [id, v] of dmgEntries) for (const el of (SPELLS[id].elements || [])) if (elemDmg[el] !== undefined) elemDmg[el] += v;
  const favEntry = Object.entries(elemDmg).sort((a, b) => b[1] - a[1]).filter(e => e[1] > 0)[0];
  const favElement = favEntry ? favEntry[0] : null;
  const dps = game.runTime > 0 ? Math.round(game.totalDmg / game.runTime) : 0;
  const sum = {
    topSpell, topItem, goldEarned: Math.round(game.goldEarned || 0), favElement,
    bestWave: game.bestWave || { wave: 0, dps: 0 }, cause: game.lastHurtBy, dps,
    kills: game.kills, wave: game.wave, won: !!won,
  };
  sum.title = buildTitle(favElement, topId);
  sum.hint = buildHint(sum, won);
  return sum;
}

// Renders the build summary into a target element.
function renderRunSummary(targetId, won) {
  const el = document.getElementById(targetId);
  if (!el) return null;
  const s = computeRunSummary(won);
  const fav = s.favElement ? `<span style="color:${ELEMENTS[s.favElement].color}">${ELEMENTS[s.favElement].icon} ${ELEMENTS[s.favElement].name}</span>` : '—';
  const rows = [
    ['Top spell', s.topSpell ? `${s.topSpell.icon} ${s.topSpell.name}` : '—'],
    ['Best item', s.topItem ? `${s.topItem.icon} ${s.topItem.name}` : '—'],
    ['Gold earned', `💰 ${s.goldEarned}`],
    ['Favourite element', fav],
    ['Best wave DPS', s.bestWave.dps ? `${s.bestWave.dps}/s (wave ${s.bestWave.wave})` : '—'],
    ['Overall DPS', `${s.dps}/s`],
    ['Enemies slain', s.kills],
  ];
  if (!won) rows.push(['Felled by', s.cause || 'the arena']);
  el.innerHTML =
    `<div class="rs-title">“${s.title}”</div>` +
    `<div class="rs-grid">${rows.map(([k, v]) => `<div class="rs-k">${k}</div><div class="rs-v">${v}</div>`).join('')}</div>` +
    `<div class="rs-hint">💡 ${s.hint}</div>`;
  return s;
}

// Draws a self-contained shareable PNG card and triggers a download.
function downloadShareCard(won) {
  const s = computeRunSummary(won);
  const cv = document.createElement('canvas');
  cv.width = 620; cv.height = 360;
  const g = cv.getContext('2d');
  // background
  const bg = g.createLinearGradient(0, 0, 620, 360);
  bg.addColorStop(0, won ? '#2a2410' : '#1a1020');
  bg.addColorStop(1, '#0b0f1c');
  g.fillStyle = bg; g.fillRect(0, 0, 620, 360);
  g.strokeStyle = won ? '#ffd454' : '#ff6b6b'; g.lineWidth = 3; g.strokeRect(6, 6, 608, 348);
  g.textAlign = 'center';
  g.fillStyle = won ? '#ffd454' : '#ff6b6b';
  g.font = 'bold 30px sans-serif';
  g.fillText(won ? '★ VICTORY ★' : 'DEFEAT', 310, 52);
  g.fillStyle = '#eaf2ff'; g.font = 'italic bold 24px sans-serif';
  g.fillText(`“${s.title}”`, 310, 92);
  g.fillStyle = '#9fb0c8'; g.font = '14px sans-serif';
  g.fillText('Wavy-Wizards', 310, 116);
  // stat lines
  g.textAlign = 'left'; g.font = '17px sans-serif';
  const lines = [
    ['Wave reached', `${s.wave}${s.won ? ' — cleared!' : ''}`],
    ['Enemies slain', `${s.kills}`],
    ['Overall DPS', `${s.dps}/s`],
    ['Best wave DPS', s.bestWave.dps ? `${s.bestWave.dps}/s (W${s.bestWave.wave})` : '—'],
    ['Top spell', s.topSpell ? s.topSpell.name : '—'],
    ['Gold earned', `${s.goldEarned}`],
  ];
  lines.forEach((ln, i) => {
    const y = 156 + i * 30;
    g.fillStyle = '#9fb0c8'; g.fillText(ln[0], 40, y);
    g.fillStyle = '#eaf2ff'; g.textAlign = 'right'; g.fillText(ln[1], 580, y); g.textAlign = 'left';
  });
  g.fillStyle = won ? '#ffd454' : '#ff9aae'; g.font = '13px sans-serif'; g.textAlign = 'center';
  g.fillText(s.hint, 310, 344);
  // trigger download
  const a = document.createElement('a');
  a.download = `wavy-wizards-${won ? 'victory' : 'defeat'}-w${s.wave}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
  sfx('buy');
}

function updateResumeButton() {
  const d = loadSave();
  const btn = document.getElementById('btn-resume');
  if (d) {
    const c = CHARACTERS.find(ch => ch.id === d.charId) || CHARACTERS[0];
    btn.style.display = '';
    btn.textContent = `Resume Run — ${c.name}, after wave ${d.wave}`;
  } else {
    btn.style.display = 'none';
  }
}

let selectedChar = CHARACTERS[0];

let dangerLevel = 0;
try { dangerLevel = clamp(parseInt(localStorage.getItem('wavywizards-danger'), 10) || 0, 0, DANGER_LEVELS.length - 1); } catch (e) { /* defaults */ }

function renderDangerSelect() {
  const el = document.getElementById('danger-select');
  el.innerHTML = '<span class="danger-label">☠ Danger level</span>';
  DANGER_LEVELS.forEach((d, i) => {
    const btn = document.createElement('button');
    btn.className = 'danger-btn' + (i === dangerLevel ? ' on' : '');
    btn.textContent = d.mod === 0 ? '0%' : `+${Math.round(d.mod * 100)}%`;
    btn.title = `${d.name} — ${d.desc}`;
    btn.onclick = () => {
      dangerLevel = i;
      try { localStorage.setItem('wavywizards-danger', String(i)); } catch (e) { /* private mode */ }
      renderDangerSelect();
    };
    el.appendChild(btn);
  });
}

function renderCharDetail(c) {
  const won = getWins().includes(c.id);
  document.getElementById('char-detail').innerHTML =
    `<div class="cd-name">${c.name}${won ? ' 👑' : ''} <span class="cd-title">— ${c.title}</span></div>
     <div class="stat-lines">${signColor(c.perks.join('<br>'))}</div>
     ${won ? '<div class="won-badge">Archlich slain</div>' : ''}`;
}

function showCharSelect() {
  setState('charselect');
  if (!CHARACTERS.includes(selectedChar)) selectedChar = CHARACTERS[0];
  const row = document.getElementById('char-avatars');
  row.innerHTML = '';
  for (const c of CHARACTERS) {
    const tile = document.createElement('div');
    tile.className = 'char-avatar' + (c === selectedChar ? ' sel' : '');
    const cv = document.createElement('canvas');
    cv.width = 72; cv.height = 86;
    const g = cv.getContext('2d');
    g.translate(36, 60);
    g.scale(1.55, 1.55);
    drawWizardSprite(g, c.look, 1, 0, false);
    tile.appendChild(cv);
    const nm = document.createElement('div');
    nm.className = 'ca-name';
    nm.innerHTML = c.name + (getWins().includes(c.id) ? ' 👑' : '');
    tile.appendChild(nm);
    const select = () => {
      selectedChar = c;
      row.querySelectorAll('.char-avatar').forEach(t => t.classList.remove('sel'));
      tile.classList.add('sel');
      renderCharDetail(c);
    };
    tile.onclick = select;
    tile.onmouseenter = () => renderCharDetail(c);
    tile.onmouseleave = () => renderCharDetail(selectedChar);
    row.appendChild(tile);
  }
  renderCharDetail(selectedChar);
}

function renderStartOptions() {
  const el = document.getElementById('start-options');
  if (!el) return;
  const on = !!game.opt.replayFails;
  el.innerHTML = `<button id="opt-replay" class="danger-btn${on ? ' on' : ''}">↻ Replay failed waves: ${on ? 'ON' : 'OFF'}</button>`;
  document.getElementById('opt-replay').onclick = () => {
    game.opt.replayFails = !game.opt.replayFails; saveOpts(); renderStartOptions();
  };
}

function showSpellSelect() {
  setState('spellselect');
  renderDangerSelect();
  renderStartOptions();
  const row = document.getElementById('spell-cards');
  row.innerHTML = '';
  for (const [id, def] of Object.entries(SPELLS)) {
    const t = def.tiers[0];
    const card = document.createElement('div');
    card.className = 'card choice compact';
    card.innerHTML = `<div class="icon">${def.icon}</div>
      <div class="name">${def.name}</div>
      <div class="stat-lines">${def.lines(t).join('<br>')}</div>`;
    card.onclick = () => { sfx('buy'); beginRun(id); };
    row.appendChild(card);
  }
}

function beginRun(starterSpell) {
  game.player = freshPlayer(selectedChar, starterSpell);
  game.gold = 0; game.xp = 0; game.level = 1; game.budget = 0;
  game.pendingLevelUps = 0; game.kills = 0;
  game.totalDmg = 0; game.runTime = 0;
  game.runDmg = {}; game.goldEarned = 0; game.bestWave = { wave: 0, dps: 0 }; game.lastHurtBy = null;
  game.debtHpMult = 1; game.debtSpdMult = 1; game.discountBuys = 0; game.arcaneLoan = false;
  game.gems = []; game.particles = []; game.texts = [];
  game.shopOffers = [];
  game.endless = false;
  game.danger = DANGER_LEVELS[dangerLevel].mod;
  game.masteryAcc = {}; game.masteryLvl = {}; game.masteryMods = {}; game.pendingMastery = [];
  // decide each wave's element realm up-front so the roadmap reveals it in advance
  game.realmSchedule = {};
  for (let w = 1; w <= 20; w++) game.realmSchedule[w] = pick(['fire', 'ice', 'earth', 'wind']);
  game.player.inputId = game.coop ? 'wasd' : 'both';
  game.p2 = game.coop ? makePlayer2() : null;
  clearSave(); // a fresh run replaces any old checkpoint
  startWave(1);
}

// ---------------------------------------------------------------------------
// Level-up UI
// ---------------------------------------------------------------------------
function showLevelUp() {
  setState('levelup');
  const remaining = game.pendingLevelUps;
  document.getElementById('levelup-count').textContent =
    remaining > 1 ? `${remaining} upgrades to pick` : 'Pick an upgrade';
  const row = document.getElementById('levelup-choices');
  row.innerHTML = '';
  const opts = [...LEVELUP_OPTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const opt of opts) {
    const card = document.createElement('div');
    card.className = 'card choice';
    card.innerHTML = `<div class="icon">${opt.icon}</div><div class="name">${opt.name}</div><div class="desc">${signColor(opt.desc)}</div>`;
    card.onclick = () => {
      opt.apply(game.player.stats, game.player);
      game.player.hp = Math.min(game.player.hp, game.player.stats.maxHp);
      game.pendingLevelUps--;
      sfx('buy');
      saveRun();
      if (game.pendingLevelUps > 0) showLevelUp();
      else openShop();
    };
    row.appendChild(card);
  }
}

// ---------------------------------------------------------------------------

document.getElementById('btn-reroll').onclick = () => {
  const p = game.player;
  // Arcane Loan: rerolling is forbidden while dangerously frail
  if (game.arcaneLoan && p.stats.maxHp < 6) return;
  const cost = rerollCost();
  if (game.gold < cost) return;
  game.gold -= cost;
  game.rerolls++;
  // Arcane Loan: each reroll gambles on a damage boost / max-HP toll
  if (game.arcaneLoan) {
    if (Math.random() < 0.5) p.stats.dmgMult += 0.03;
    if (Math.random() < 0.10) { p.stats.maxHp = Math.max(1, p.stats.maxHp - 5); p.hp = Math.min(p.hp, p.stats.maxHp); }
  }
  generateShop();
  sfx('buy');
  renderShop();
  saveRun();
};
document.getElementById('btn-resume').onclick = resumeRun;
let settingsReturn = 'title';
function openSettings(from) { settingsReturn = from || 'title'; setState('settings'); renderSettings(); }
document.getElementById('btn-char-start').onclick = () => {
  sfx('buy');
  // Rando has no starting-spell choice — his book is rolled each wave
  if (selectedChar && selectedChar.id === 'rando') beginRun('missile');
  else showSpellSelect();
};
document.getElementById('btn-settings').onclick = () => openSettings('title');
document.getElementById('btn-pause-settings').onclick = () => openSettings('paused');
document.getElementById('btn-settings-back').onclick = () => {
  if (settingsReturn === 'paused') { setState('paused'); renderKeybinds(); }
  else setState('title');
};
document.getElementById('btn-next-wave').onclick = () => startWave(game.wave + 1);
document.getElementById('btn-coop').onclick = () => {
  game.coop = !game.coop;
  document.getElementById('btn-coop').textContent = game.coop ? '👥 Players: 2 (Co-op)' : '👥 Players: 1 (Solo)';
  document.getElementById('coop-hint').style.display = game.coop ? '' : 'none';
  sfx('buy');
};
document.getElementById('btn-start').onclick = showCharSelect;
document.getElementById('btn-retry').onclick = showCharSelect;
document.getElementById('btn-again').onclick = showCharSelect;
document.getElementById('btn-share-win').onclick = () => downloadShareCard(true);
document.getElementById('btn-share-death').onclick = () => downloadShareCard(false);
document.getElementById('btn-continue').onclick = () => {
  // the win is already banked — endless mode just keeps the run going
  game.endless = true;
  if (game.pendingLevelUps > 0) showLevelUp();
  else openShop();
};

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------
// Reads a body's movement vector from its assigned controls (keys + gamepad).
function bodyInputVec(p) {
  let dx = 0, dy = 0;
  const id = p.inputId;
  if (id === 'both' || id === 'wasd') {
    if (keys.KeyW) dy -= 1; if (keys.KeyS) dy += 1; if (keys.KeyA) dx -= 1; if (keys.KeyD) dx += 1;
  }
  if (id === 'both' || id === 'arrows') {
    if (keys.ArrowUp) dy -= 1; if (keys.ArrowDown) dy += 1; if (keys.ArrowLeft) dx -= 1; if (keys.ArrowRight) dx += 1;
  }
  const pad = padStates[id === 'arrows' ? 1 : 0];
  if (pad && (pad.moveX || pad.moveY)) { dx += pad.moveX; dy += pad.moveY; }
  return { dx, dy };
}

function updatePlayer(dt) {
  for (const p of allBodies()) {
    if (p.downed) { p.moving = false; continue; }
    updateBody(dt, p);
  }
}

function updateBody(dt, p) {
  let { dx, dy } = bodyInputVec(p);
  p.moving = !!(dx || dy);
  if (dx || dy) {
    const len = Math.max(1, Math.hypot(dx, dy));
    const windMult = 1 + 0.05 * game.elem.wind; // Wind meta-class: +move speed
    const concMult = p.stats.concentrator ? 1.25 : 1; // Concentratos: faster on the move
    const spd = 210 * p.stats.speedMult * (p.tempSpd || 1) * windMult * concMult;
    p.x += (dx / len) * spd * dt;
    p.y += (dy / len) * spd * dt;
    p.moveX = dx / len;
    if (dx) p.face = Math.sign(dx);
    p.walkT = (p.walkT || 0) + dt * 11;
  }
  p.x = clamp(p.x, WALL + p.r, W - WALL - p.r);
  p.y = clamp(p.y, WALL + p.r, H - WALL - p.r);
  if (game.walls.length) pushOutOfWalls(p);
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  const regen = (p.stats.regen + 0.3 * game.elem.earth) * HEAL_FACTOR; // Earth meta-class: +regen
  if (regen > 0 && p.hp < p.stats.maxHp) {
    p.regenAcc = (p.regenAcc || 0) + regen * dt;
    if (p.regenAcc >= 1) {
      const whole = Math.floor(p.regenAcc);
      p.regenAcc -= whole;
      p.hp = Math.min(p.stats.maxHp, p.hp + whole);
    }
  }
}

function updateFx(dt) {
  for (const pt of game.particles) { pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.95; pt.vy *= 0.95; }
  game.particles = game.particles.filter(pt => pt.t < pt.dur);
  for (const tx of game.texts) { tx.t += dt; tx.y -= 32 * dt; }
  game.texts = game.texts.filter(tx => tx.t < tx.dur);
  for (const b of game.beams) b.t += dt;
  game.beams = game.beams.filter(b => b.t < b.dur);
  for (const n of game.novas) n.t += dt;
  game.novas = game.novas.filter(n => n.t < n.dur);
  for (const c of game.cones) c.t += dt;
  game.cones = game.cones.filter(c => c.t < c.dur);
  game.shake = Math.max(0, game.shake - dt * 30);
}

let lastTime = performance.now();
function frame(now) {
  let dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  pollGamepad();

  if (game.state === 'playing') {
    // Last Resort bullet-time: everything runs at 30% speed for a brief beat.
    if (game.slowmo > 0) { game.slowmo -= dt; dt *= 0.3; }
    game.waveTime += dt;
    game.runTime += dt;
    recomputeElements();
    updatePlayer(dt);
    updateProcs(dt);
    updateBuffs(dt);
    updateStructures(dt);
    // co-op: the second body shares the global buff/ward multipliers
    if (game.coop && game.p2) { game.p2.tempDmg = game.player.tempDmg; game.p2.tempSpd = game.player.tempSpd; game.p2.bonusArmor = game.player.bonusArmor; }
    // each living body auto-casts the shared spellbook from its own position
    for (const pl of livePlayers()) { const save = game.player; game.player = pl; updateSpells(dt); game.player = save; }
    updateProjectiles(dt);
    updateEnemyProjectiles(dt);
    updateClouds(dt);
    updateMeteors(dt);
    updateFountains(dt);
    updateHazards(dt);
    updateZones(dt);
    updateWalls(dt);
    updateWorld(dt);
    updateTornadoes(dt);
    updateWorldSpawns(dt);
    updateSpawning(dt);
    updateEnemies(dt);
    updateFamiliars(dt);
    updateGems(dt);
    updateFx(dt);

    const bossesDead = bossCountForWave(game.wave) > 0 && game.bossSpawned &&
      game.spawns.every(s => s.type !== 'boss') && !game.enemies.some(e => e.boss);
    if (game.waveTime >= game.waveDur || bossesDead) endWave();
  } else if (game.state === 'waveend') {
    updateGems(dt);
    updateFx(dt);
    game.waveEndTimer -= dt;
    if (game.waveEndTimer <= 0 && game.gems.length === 0) afterWaveCollected();
    else if (game.waveEndTimer <= -2) { game.gems = []; afterWaveCollected(); } // safety
  } else {
    updateFx(dt);
  }

  render();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

// Draws an ACTIVE world-event hazard zone themed to its event: lava pools for
// the volcano, crackling lightning for the storm, rolling water for the tide,
// and rubble + falling rocks for the earthquake. (Telegraphs stay red/dashed.)
function drawWorldHazard(z, id, pulse, ts) {
  const now = performance.now();
  const lowFx = game.opt.lowFx;
  if (z.shape === 'circle' && id === 'volcano') {
    const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
    g.addColorStop(0, 'rgba(255,225,130,0.9)');
    g.addColorStop(0.45, 'rgba(255,120,40,0.72)');
    g.addColorStop(1, 'rgba(150,30,10,0.55)');
    ctx.fillStyle = g; ctx.shadowColor = '#ff6b2a'; ctx.shadowBlur = lowFx ? 0 : 18;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (!lowFx) for (let i = 0; i < 5; i++) { // bubbling magma blisters
      const a = (i / 5) * Math.PI * 2 + now / 700;
      const rr = z.r * (0.25 + 0.55 * ((i * 7 % 10) / 10));
      const bs = 3 + 3 * Math.abs(Math.sin(now / 300 + i));
      ctx.fillStyle = 'rgba(255,235,150,0.9)';
      ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, bs, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,20,10,0.9)'; ctx.lineWidth = 3 * ts; // cooled crust rim
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
  } else if (z.shape === 'circle' && id === 'storm') {
    ctx.globalAlpha = 0.16 + pulse * 0.12; ctx.fillStyle = '#3a3a6a';
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const flick = 0.5 + 0.5 * Math.sin(now / 55 + z.x); // crackling bolt across the cell
    ctx.strokeStyle = `rgba(255,245,150,${flick})`;
    ctx.shadowColor = '#fff7a0'; ctx.shadowBlur = lowFx ? 0 : 12; ctx.lineWidth = 2.5 * ts;
    ctx.beginPath(); ctx.moveTo(z.x + rand(-z.r * 0.3, z.r * 0.3), z.y - z.r);
    const segs = 5;
    for (let i = 1; i <= segs; i++) ctx.lineTo(z.x + rand(-z.r * 0.5, z.r * 0.5), z.y - z.r + 2 * z.r * (i / segs));
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,233,107,0.8)'; ctx.lineWidth = 2.5 * ts;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
  } else if (z.shape === 'band') { // tide: rolling water with crests
    const top = z.pos - z.width / 2;
    for (const [a, b] of bandSegments(z)) {
      const grd = ctx.createLinearGradient(0, top, 0, top + z.width);
      grd.addColorStop(0, 'rgba(80,170,255,0.28)');
      grd.addColorStop(0.5, 'rgba(40,120,230,0.46)');
      grd.addColorStop(1, 'rgba(80,170,255,0.28)');
      ctx.fillStyle = grd; ctx.fillRect(a, top, b - a, z.width);
      ctx.strokeStyle = 'rgba(205,238,255,0.7)'; ctx.lineWidth = 2;
      const rows = lowFx ? 1 : 3;
      for (let row = 0; row < rows; row++) {
        const yy = top + z.width * (0.3 + row * 0.22);
        ctx.beginPath();
        for (let xx = a; xx <= b; xx += 12) {
          const yo = Math.sin(xx / 22 + now / 220 + row) * 5;
          if (xx === a) ctx.moveTo(xx, yy + yo); else ctx.lineTo(xx, yy + yo);
        }
        ctx.stroke();
      }
    }
  } else if (z.shape === 'fissure') { // earthquake: cracked ground + tumbling rocks
    ctx.strokeStyle = 'rgba(60,40,24,0.88)'; ctx.lineWidth = z.width;
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,140,60,0.8)'; ctx.lineWidth = Math.max(2, z.width * 0.2); // glowing seam
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
    const len = Math.max(1, Math.hypot(z.x2 - z.x1, z.y2 - z.y1));
    const nx = -(z.y2 - z.y1) / len, ny = (z.x2 - z.x1) / len; // unit normal
    const n = Math.floor(len / 70);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const px = z.x1 + (z.x2 - z.x1) * t, py = z.y1 + (z.y2 - z.y1) * t;
      const fall = Math.sin(now / 300 + i) * 0.5 + 0.5; // rocks tumble toward the crack
      const side = i % 2 === 0 ? 1 : -1;
      ctx.fillStyle = '#8a6a44';
      ctx.beginPath(); ctx.arc(px + nx * side * (1 - fall) * 24, py + ny * side * (1 - fall) * 24, 5 + (i % 2) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
}

// A downed co-op body: a faded ghost + "DOWN" marker until the next wave revives it.
function drawDownedBody(p) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.translate(p.x, p.y);
  drawWizardSprite(ctx, p.look, p.face || 1, performance.now() / 1000, false);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('💀 DOWN', p.x, p.y - 40);
}


function drawSpellProjectileAsset(g, pr, time) {
  const tf = pr.tierFx || 0;
  const speed = Math.max(1, Math.hypot(pr.vx || 0, pr.vy || 0));
  const ang = Math.atan2(pr.vy || 0, pr.vx || 1);
  const pulse = 0.5 + Math.sin(time * 10 + pr.x * 0.01) * 0.5;
  g.save();
  g.translate(pr.x, pr.y);
  g.rotate(ang);
  const tail = Math.min(42, speed * 0.055 + pr.r * 2.5);
  const grad = g.createLinearGradient(-tail, 0, pr.r, 0);
  grad.addColorStop(0, pr.color + '00');
  grad.addColorStop(0.55, pr.color + '66');
  grad.addColorStop(1, pr.color + 'dd');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(-tail * 0.35, 0, tail * 0.65, pr.r * (pr.kind === 'frost' ? 0.45 : 0.75), 0, 0, Math.PI * 2);
  g.fill();
  if (pr.kind === 'frost') {
    g.strokeStyle = 'rgba(230,250,255,0.85)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-pr.r * 1.6, 0); g.lineTo(pr.r * 1.4, 0); g.moveTo(0, -pr.r); g.lineTo(pr.r * 1.3, 0); g.lineTo(0, pr.r); g.stroke();
  } else if (pr.kind === 'fireball') {
    g.fillStyle = 'rgba(255,225,110,0.45)';
    g.beginPath(); g.arc(-pr.r * 0.25, 0, pr.r * (0.55 + pulse * 0.25), 0, Math.PI * 2); g.fill();
  } else {
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(0, 0, pr.r * (1.2 + pulse * 0.25), 0, Math.PI * 2); g.stroke();
  }
  if (tf >= 3) {
    g.strokeStyle = 'rgba(255,212,84,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, pr.r + 4 + pulse * 2, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = pr.color;
  g.shadowColor = pr.color; g.shadowBlur = tf >= 2 ? 18 : 10;
  g.beginPath(); g.arc(0, 0, pr.r + (tf >= 2 ? 1.5 : 0), 0, Math.PI * 2); g.fill();
  if (tf >= 2) {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(-pr.r * 0.25, -pr.r * 0.25, pr.r * 0.45, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (game.shake > 0) {
    ctx.translate(rand(-game.shake, game.shake) * 0.5, rand(-game.shake, game.shake) * 0.5);
  }

  // themed atmospheric background (gradient, dust, runes, grid, walls)
  drawBackground();

  // ground clouds — poison (green) or Ember Crown burning ground (orange)
  for (const c of game.clouds) {
    const fade = c.t < 0.3 ? c.t / 0.3 : c.t > c.dur - 0.5 ? (c.dur - c.t) / 0.5 : 1;
    if (c.fire) {
      ctx.fillStyle = `rgba(255, 140, 60, ${0.18 * fade})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255, 170, 70, ${0.55 * fade})`;
    } else {
      ctx.fillStyle = `rgba(120, 200, 60, ${0.16 * fade})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(155, 224, 90, ${0.5 * fade})`;
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // enemy danger zones — hostile: pulsing DASHED ring + warning sign.
  // (friendly effects — your clouds, meteors, novas — use solid outlines.)
  const teleScale = game.opt.bigTele ? 1.5 : 1;
  for (const z of game.zones) {
    const prog = z.t / z.delay;
    const pulse = 0.5 + Math.sin(performance.now() / 90) * 0.5;
    ctx.setLineDash([10, 7]);
    ctx.globalAlpha = 0.5 + prog * 0.3 + pulse * 0.2;
    ctx.strokeStyle = '#ff3344';
    ctx.lineWidth = 3.5 * teleScale;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.12 + prog * 0.22;
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.radius * prog, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.65 + pulse * 0.35;
    ctx.fillStyle = '#ff5566';
    ctx.font = `bold ${Math.round((18 + prog * 8) * teleScale)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠', z.x, z.y + 7);
    ctx.globalAlpha = 1;
  }

  // world-event hazards — they DAMAGE you, so they share the hostile language:
  // a red border (dashed while telegraphing) + ⚠, with a faint element tint fill.
  if (game.worldEvent) {
    const evc = game.worldEvent.color;
    const HRED = '#ff3344';
    const ts = game.opt.bigTele ? 1.4 : 1;
    for (const z of game.worldZones) {
      const warning = z.t < z.warn;
      const pulse = 0.5 + Math.sin(performance.now() / 110) * 0.5;
      // centre point for the ⚠ marker
      let cx = z.x, cy = z.y;
      if (z.shape === 'band') cy = z.pos;
      else if (z.shape === 'fissure') { cx = (z.x1 + z.x2) / 2; cy = (z.y1 + z.y2) / 2; }
      ctx.save();
      ctx.lineCap = 'round';
      if (warning) {
        // telegraph: faint event tint + red dashed hostile outline (unchanged language)
        ctx.setLineDash([10, 7]);
        ctx.globalAlpha = 0.10; ctx.fillStyle = evc;
        if (z.shape === 'circle') { ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill(); }
        else if (z.shape === 'band') { for (const [a, b] of bandSegments(z)) ctx.fillRect(a, z.pos - z.width / 2, b - a, z.width); }
        else if (z.shape === 'fissure') { ctx.lineWidth = z.width; ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke(); }
        ctx.globalAlpha = 0.5 + pulse * 0.3; ctx.strokeStyle = HRED; ctx.lineWidth = 3.5 * ts;
        if (z.shape === 'circle') { ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke(); }
        else if (z.shape === 'band') { for (const [a, b] of bandSegments(z)) ctx.strokeRect(a, z.pos - z.width / 2, b - a, z.width); }
        else if (z.shape === 'fissure') { ctx.lineWidth = 4 * ts; ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke(); }
        ctx.setLineDash([]);
      } else {
        // active: draw the hazard themed to its event
        drawWorldHazard(z, game.worldEvent.id, pulse, ts);
      }
      // ⚠ danger marker
      ctx.globalAlpha = 0.7 + pulse * 0.3;
      ctx.fillStyle = '#ff5566';
      ctx.font = `bold ${Math.round(16 * ts)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⚠', cx, cy + 6);
      // mark safe gaps in a tide band with a green "✓ SAFE"
      if (z.shape === 'band' && z.gaps) {
        ctx.fillStyle = '#7fe08f';
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        for (const g of z.gaps) ctx.fillText('✓ safe', g.x, z.pos + 4);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // meteor telegraphs (friendly: solid cyan ring — safe for you to stand in)
  for (const m of game.meteors) {
    const prog = m.t / m.delay;
    ctx.strokeStyle = `rgba(123, 225, 255, ${0.5 + prog * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255, 107, 74, ${0.12 + prog * 0.2})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.radius * prog, 0, Math.PI * 2); ctx.fill();
    // falling rock
    const fy = m.y - (1 - prog) * 420;
    ctx.fillStyle = '#ff8c5a';
    ctx.beginPath(); ctx.arc(m.x + (1 - prog) * 60, fy, 10, 0, Math.PI * 2); ctx.fill();
  }

  // element landmarks (drawn on the ground, under the action)
  for (const s of game.structures) drawStructure(s);

  // Warden wards — solid barriers that block your movement
  for (const w of game.walls) {
    const fade = w.t > w.dur - 0.6 ? (w.dur - w.t) / 0.6 : 1;
    ctx.fillStyle = `rgba(143, 168, 255, ${0.16 * fade})`;
    ctx.strokeStyle = `rgba(170, 195, 255, ${0.7 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // hatch marks for a "solid wall" read
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#aac3ff';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛬', w.x, w.y + 5);
    ctx.globalAlpha = 1;
  }

  // fountains
  for (const f of game.fountains) {
    const pulse = 0.5 + Math.sin(f.t * 3) * 0.5;
    // stone basin
    ctx.fillStyle = '#2a3550';
    ctx.strokeStyle = '#5a6a88';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, 20, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // glowing water
    ctx.fillStyle = `rgba(107, 232, 255, ${0.5 + pulse * 0.3})`;
    ctx.shadowColor = '#6be8ff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, 13, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // bubbling spout
    ctx.fillStyle = `rgba(107, 232, 255, ${0.6 + pulse * 0.4})`;
    ctx.beginPath(); ctx.arc(f.x, f.y - 10 - pulse * 5, 3.5, 0, Math.PI * 2); ctx.fill();
    // drain progress (must hold for 2s)
    if (f.drain > 0) {
      ctx.strokeStyle = '#6be8ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(f.drain / 2, 0, 1)); ctx.stroke();
      ctx.fillStyle = '#bdf3ff'; ctx.font = 'bold 10px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('draining…', f.x, f.y - 28);
    }
  }

  // gold magnet + item mine world spawns
  for (const ws of game.worldSpawns) drawWorldSpawn(ws);

  // spawn telegraphs
  for (const s of game.spawns) {
    const prog = s.t / s.delay;
    ctx.strokeStyle = `rgba(255, 80, 100, ${0.25 + prog * 0.55})`;
    ctx.lineWidth = 2;
    const r = 16 * (1 - prog * 0.4);
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x - r * 0.6, s.y); ctx.lineTo(s.x + r * 0.6, s.y);
    ctx.moveTo(s.x, s.y - r * 0.6); ctx.lineTo(s.x, s.y + r * 0.6); ctx.stroke();
  }

  // gems
  for (const g of game.gems) {
    if (g.hp) {
      ctx.fillStyle = '#ff6b8a';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', g.x, g.y + 6);
    } else {
      const tw = Math.sin(g.t * 8) * 0.5 + 0.5;
      ctx.fillStyle = '#4be08a';
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = `rgba(200, 255, 220, ${0.3 + tw * 0.4})`;
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
  }

  // enemies
  for (const e of game.enemies) {
    const wob = Math.sin(e.wobble) * 0.08 + 1;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(wob, 2 - wob);
    // alien "shade" body
    let col = e.flash > 0 ? '#ffffff' : e.color;
    if (e.slowAmt > 0 && e.flash <= 0) col = blendColor(e.color, '#7fd4ff', 0.45);
    const faceX = Math.sign(game.player.x - e.x) || 1;
    drawShade(ctx, e, e.r, col, faceX);
    if (e.elite || e.boss) {
      ctx.fillStyle = '#ffd454';
      ctx.font = `${e.boss ? 30 : 20}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('👑', 0, -e.r - 12);
    }
    ctx.restore();
    // Mirror Imp reflective shell
    if (e.reflect > 0) {
      ctx.strokeStyle = `rgba(200, 226, 255, ${0.6 + Math.sin(performance.now() / 50) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, Math.PI * 2); ctx.stroke();
    }
    // enemy shield (Danger 10 boss) — cyan ring
    if (e.eshield > 0) {
      ctx.strokeStyle = 'rgba(143, 200, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2); ctx.stroke();
    }
    // wind-up telegraph: pulsing ring means an attack is coming
    if (e.windup > 0) {
      const ts = game.opt.bigTele ? 1.5 : 1;
      ctx.strokeStyle = `rgba(255, 230, 120, ${0.5 + Math.sin(e.wobble * 4) * 0.3})`;
      ctx.lineWidth = 3 * ts;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffe96b';
      ctx.font = `bold ${Math.round(16 * ts)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      // boss attack names (accessibility), otherwise just a "!"
      let label = '!';
      if (e.boss && game.opt.bossNames) label = e.pending === 'charge' ? 'CHARGE' : 'SLAM';
      ctx.fillText(label, e.x, e.y - e.r - 14);
    }
    // hp bar for tough enemies
    if ((e.elite || e.boss || e.maxHp > 50) && e.hp < e.maxHp) {
      const bw = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 10, bw, 4);
      ctx.fillStyle = e.boss ? '#aa66ff' : '#ff5577';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 10, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
  }

  // players — both bodies in co-op
  if (game.state !== 'gameover') for (const p of allBodies()) {
    if (p.downed) { drawDownedBody(p); continue; }
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    // shield bubble
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(143, 168, 255, 0.8)';
      ctx.fillStyle = 'rgba(143, 168, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, p.r + 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // --- wizard sprite ---
    const face = p.face || 1;
    const bob = p.moving ? Math.sin(p.walkT || 0) * 1.6 : 0;
    ctx.translate(0, bob);
    drawWizardSprite(ctx, p.look, face, performance.now() / 1000, p.hurtFlash > 0);
    ctx.restore();

    // green health bar above the character
    {
      const bw2 = 44, bh2 = 6, bx2 = p.x - bw2 / 2, by2 = p.y - 46 + bob;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx2 - 1, by2 - 1, bw2 + 2, bh2 + 2);
      ctx.fillStyle = '#2a3550';
      ctx.fillRect(bx2, by2, bw2, bh2);
      ctx.fillStyle = '#46d96a';
      ctx.fillRect(bx2, by2, bw2 * clamp(p.hp / p.stats.maxHp, 0, 1), bh2);
      if (p.shield > 0 && p.shieldCap > 0) {
        ctx.fillStyle = 'rgba(143, 168, 255, 0.9)';
        ctx.fillRect(bx2, by2 - 4, bw2 * clamp(p.shield / p.shieldCap, 0, 1), 3);
      }
    }

    // owned spells arranged in a ring around the wizard, indicating each spell
    {
      const n = p.spells.length;
      const ringR = p.r + 22;
      for (let i = 0; i < n; i++) {
        const sp = p.spells[i];
        const def = SPELLS[sp.id];
        const a = -Math.PI / 2 + (Math.PI * 2 * i) / n;
        const bx = p.x + Math.cos(a) * ringR, by = p.y + Math.sin(a) * ringR;
        const tdef = def.tiers[sp.tier];
        const ready = !(tdef.cd > 0 && sp.t > 0) && !(sp.disabled > 0);
        // badge
        ctx.globalAlpha = ready ? 1 : 0.45;
        ctx.fillStyle = '#0c1326';
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // cooldown sweep
        if (tdef.cd > 0 && sp.t > 0) {
          const frac = clamp(sp.t / (tdef.cd * p.stats.cdMult * masteryMod(sp.id).cdMult), 0, 1);
          ctx.fillStyle = def.color + '55';
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, 8.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.closePath(); ctx.fill();
        }
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(def.icon, bx, by + 3.5);
        ctx.globalAlpha = 1;
      }
    }

    // arcane orbs (one ring per owned copy)
    p.spells.filter(s => s.id === 'orbs').forEach((os, k) => {
      const t = SPELLS.orbs.tiers[os.tier];
      const orbitR = (72 + k * 26) * (os.enchant === 'reach' ? 1.3 : 1);
      const dir = k % 2 === 0 ? 1 : -1;
      for (let i = 0; i < t.count; i++) {
        const a = p.orbAngle * dir + (Math.PI * 2 * i) / t.count;
        const ox = p.x + Math.cos(a) * orbitR, oy = p.y + Math.sin(a) * orbitR;
        ctx.fillStyle = '#c47bff';
        ctx.shadowColor = '#c47bff'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(ox, oy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(ox - 2, oy - 2, 3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  // Summoner familiars — little allied wisps
  for (const f of game.familiars) {
    const fade = f.t > f.dur - 1 ? Math.max(0.2, f.dur - f.t) : 1;
    const r = 7 + Math.sin(f.wobble) * 1.5;
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#b89aff'; ctx.shadowColor = '#b89aff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(f.x - 2, f.y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  // player spell projectiles — animated spell assets with tails, cores, and tier halos
  const spellNow = performance.now() / 1000;
  for (const pr of game.projectiles) drawSpellProjectileAsset(ctx, pr, spellNow);
  for (const pr of game.enemyProjectiles) {
    const hc = game.opt.hiContrast;
    const rr = hc ? pr.r + 2 : pr.r;
    if (hc) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; }
    ctx.fillStyle = hc ? '#ff2d6b' : pr.color;
    ctx.shadowColor = hc ? '#ff2d6b' : pr.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, rr, 0, Math.PI * 2); ctx.fill();
    if (hc) ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // beams (lightning / drain)
  for (const b of game.beams) {
    const alpha = 1 - b.t / b.dur;
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = b.width;
    ctx.shadowColor = b.color; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < b.pts.length; i++) {
      const a = b.pts[i - 1], c = b.pts[i];
      const mx = (a.x + c.x) / 2 + rand(-10, 10);
      const my = (a.y + c.y) / 2 + rand(-10, 10);
      ctx.quadraticCurveTo(mx, my, c.x, c.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // breath cones — a fading wedge in the cast direction
  for (const c of game.cones) {
    const fade = 1 - c.t / c.dur;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    const g2 = ctx.createLinearGradient(0, 0, c.range, 0);
    g2.addColorStop(0, c.color + 'cc');
    g2.addColorStop(1, c.color + '00');
    ctx.globalAlpha = fade;
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, c.range, -c.half, c.half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // wind tornadoes — swirling funnels
  for (const tor of game.tornadoes) {
    const fade = tor.t > tor.dur - 0.6 ? (tor.dur - tor.t) / 0.6 : 1;
    ctx.save();
    ctx.translate(tor.x, tor.y);
    ctx.globalAlpha = (0.5 + 0.3 * Math.sin(tor.spin * 2)) * fade;
    ctx.strokeStyle = '#bfe8ff';
    ctx.lineWidth = 2.5;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const ar = tor.spin + k * 2.1 + s * 0.5;
        const rr = tor.r * (s / 12);
        const px = Math.cos(ar) * rr, py = (s / 12 - 0.5) * tor.r * 1.4;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // nova rings (player nova, explosions, heal pulses, slams)
  for (const n of game.novas) {
    const prog = n.t / n.dur;
    ctx.globalAlpha = 1 - prog;
    ctx.strokeStyle = n.color || '#fff3b0';
    ctx.lineWidth = 5 * (1 - prog) + 1;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.radius * prog, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // particles
  for (const pt of game.particles) {
    ctx.globalAlpha = 1 - pt.t / pt.dur;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // floating texts
  for (const tx of game.texts) {
    ctx.globalAlpha = 1 - (tx.t / tx.dur) ** 2;
    ctx.fillStyle = tx.color;
    ctx.font = `bold ${tx.size}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(tx.str, tx.x, tx.y);
    ctx.fillText(tx.str, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  if (game.state === 'playing' || game.state === 'waveend' || game.state === 'paused') drawHUD();
}

// Draws the wizard at the current origin (~34px wide, y from -34 to +15).

function blendColor(hex1, hex2, t) {
  const p1 = parseInt(hex1.slice(1), 16), p2 = parseInt(hex2.slice(1), 16);
  const r = Math.round(((p1 >> 16) & 255) * (1 - t) + ((p2 >> 16) & 255) * t);
  const g = Math.round(((p1 >> 8) & 255) * (1 - t) + ((p2 >> 8) & 255) * t);
  const b = Math.round((p1 & 255) * (1 - t) + (p2 & 255) * t);
  return `rgb(${r},${g},${b})`;
}

function drawHUD() {
  const p = game.player;
  const s = p.stats;

  // HP bar
  const bw = 240, bh = 22, bx = 36, by = 34;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#43222a';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#e0455a';
  ctx.fillRect(bx, by, bw * clamp(p.hp / s.maxHp, 0, 1), bh);
  if (p.shield > 0 && p.shieldCap > 0) {
    ctx.fillStyle = 'rgba(143, 168, 255, 0.85)';
    ctx.fillRect(bx, by - 7, bw * clamp(p.shield / p.shieldCap, 0, 1), 5);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${game.coop ? 'P1  ' : ''}${Math.ceil(p.hp)} / ${Math.round(s.maxHp)}`, bx + bw / 2, by + 16);

  // co-op: a compact second HP bar for Player 2
  if (game.coop && game.p2) {
    const p2 = game.p2, b2y = by + bh + 22;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 2, b2y - 2, bw + 4, 16);
    ctx.fillStyle = '#143b36'; ctx.fillRect(bx, b2y, bw, 12);
    ctx.fillStyle = p2.downed ? '#555' : '#2ad6b0';
    ctx.fillRect(bx, b2y, bw * clamp(p2.hp / p2.stats.maxHp, 0, 1), 12);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p2.downed ? 'P2 — DOWN (revives next wave)' : `P2  ${Math.ceil(p2.hp)} / ${Math.round(p2.stats.maxHp)}`, bx + bw / 2, b2y + 10);
  }

  // XP bar
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 2, by + bh + 6, bw + 4, 10);
  ctx.fillStyle = '#3aa05c';
  ctx.fillRect(bx, by + bh + 8, (bw) * clamp(game.xp / xpNeeded(game.level), 0, 1), 6);
  ctx.fillStyle = '#9fb0c8';
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Lv ${game.level}`, bx + bw + 10, by + bh + 15);
  // Last Resort indicator
  if (p.lastResort) {
    ctx.fillStyle = '#ffd454';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillText('✦ Last Resort', bx, by + bh + 30);
  }

  // gold
  ctx.fillStyle = '#ffd454';
  ctx.font = 'bold 22px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`💰 ${game.gold}`, W - 40, 52);

  // wave + timer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8be0ff';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillText(
    game.wave === 20 ? 'FINAL WAVE'
      : bossCountForWave(game.wave) ? `WAVE ${game.wave} — BOSS`
      : `WAVE ${game.wave}`, W / 2, 44);
  if (game.danger > 0) {
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillText(`☠ +${Math.round(game.danger * 100)}%`, W / 2 + 130, 44);
  }
  // wave modifier banner
  if (game.modifier) {
    ctx.fillStyle = game.modifier.color;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${game.modifier.icon} ${game.modifier.name}`, W / 2, 100);
  }
  // world-event banner (pulses for urgency)
  if (game.worldEvent) {
    const pl = 0.6 + Math.sin(performance.now() / 200) * 0.4;
    ctx.globalAlpha = pl;
    ctx.fillStyle = game.worldEvent.color;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${game.worldEvent.icon} ${game.worldEvent.name}`, W / 2, game.modifier ? 120 : 100);
    ctx.globalAlpha = 1;
  }
  // active temp buffs (fountains, etc.)
  if (p.buffs && p.buffs.length) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    p.buffs.forEach((b, i) => {
      ctx.fillStyle = b.dmg < 0 || b.spd < 0 ? '#ff7d9c' : '#7fe08f';
      ctx.fillText(`${b.name} ${b.t.toFixed(1)}s`, W / 2, 120 + i * 16);
    });
  }
  if (game.waveDur !== Infinity) {
    const remain = Math.max(0, game.waveDur - game.waveTime);
    ctx.fillStyle = remain < 5 ? '#ffd454' : '#dfe7f2';
    ctx.font = 'bold 34px "Segoe UI", sans-serif';
    ctx.fillText(Math.ceil(remain), W / 2, 80);
  } else {
    // combined boss hp bar (covers twin bosses on wave 20)
    const bosses = game.enemies.filter(e => e.boss);
    if (bosses.length) {
      const hp = bosses.reduce((a, b) => a + b.hp, 0);
      const mhp = bosses.reduce((a, b) => a + b.maxHp, 0);
      const bbw = 420;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W / 2 - bbw / 2 - 2, 56, bbw + 4, 16);
      ctx.fillStyle = '#aa66ff';
      ctx.fillRect(W / 2 - bbw / 2, 58, bbw * clamp(hp / mhp, 0, 1), 12);
    }
  }

  // (the bottom-left spell hotbar was removed — spells live in the shop/spellbook)

  // damage meter: per-spell totals + DPS, overall total + DPS
  game.meterBoxes = [];
  if (game.showMeter) {
    const entries = Object.entries(game.dmgMeter)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    if (entries.length) {
      const t = Math.max(1, game.waveTime);
      const total = entries.reduce((acc, [, v]) => acc + v, 0);
      const max = entries[0][1];
      const mw = 235, rowH = 21, mx = W - mw - 36, my = 76;
      const mh = 42 + entries.length * rowH;
      ctx.fillStyle = 'rgba(10, 14, 28, 0.72)';
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = '#2a3a58';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mx, my, mw, mh);
      ctx.fillStyle = '#8be0ff';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('DAMAGE THIS WAVE', mx + 8, my + 15);
      ctx.fillStyle = '#5a6a88';
      ctx.textAlign = 'right';
      ctx.fillText('[Tab]', mx + mw - 8, my + 15);
      entries.forEach(([id, v], i) => {
        const y = my + 22 + i * rowH;
        const def = SPELLS[id];
        game.meterBoxes.push({ x: mx, y: y, w: mw, h: rowH, id });
        ctx.fillStyle = def.color + '44';
        ctx.fillRect(mx + 26, y + 3, (mw - 105) * (v / max), rowH - 7);
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText(def.icon, mx + 7, y + 15);
        ctx.fillStyle = def.color;
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillText(`${formatNum(v)} · ${formatNum(v / t)}/s`, mx + 30, y + 14);
        ctx.fillStyle = '#9fb0c8';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round((v / total) * 100) + '%', mx + mw - 8, y + 14);
      });
      // overall row
      const ty = my + 22 + entries.length * rowH;
      ctx.strokeStyle = '#2a3a58';
      ctx.beginPath(); ctx.moveTo(mx + 6, ty + 1); ctx.lineTo(mx + mw - 6, ty + 1); ctx.stroke();
      ctx.fillStyle = '#ffd454';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('TOTAL', mx + 8, ty + 15);
      ctx.textAlign = 'right';
      ctx.fillText(`${formatNum(total)} · ${formatNum(total / t)}/s`, mx + mw - 8, ty + 15);
    }
  }
}

function formatNum(n) {
  return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
}

// Colour signed numbers in effect text by whether they HELP (green) or HURT (red),
// not just by sign — for "lower is better" stats (cooldown, prices) a minus is good.
// Only the number and its sign are coloured. Decided per comma-separated clause.
function signColor(text) {
  return String(text).split(/(,)/).map(part => {
    if (part === ',') return part;
    const lowerIsBetter = /cooldown|\bcd\b|price/i.test(part);
    return part.replace(/([+−\-])(\d+(?:\.\d+)?%?)/g, (full, sign, num) => {
      const neg = sign === '-' || sign === '−';
      const good = lowerIsBetter ? neg : !neg;
      return `<span style="color:${good ? '#7fe08f' : '#ff6b6b'}">${sign}${num}</span>`;
    });
  }).join('');
}

// Rough single-target DPS for the shop fusion comparison.
function dpsEstimate(t) {
  if (t.cd && t.dmg) return Math.round(t.dmg / t.cd);
  if (t.dps) return t.dps; // poison is already per-second
  if (t.dmg && !t.cd) return t.dmg * 3; // passive orbs ~3 touches/s
  return 0;
}

// ---------------------------------------------------------------------------
// Hover tooltip: full damage details for a spell (used in shop & HUD meter)
// ---------------------------------------------------------------------------
const tooltipEl = document.getElementById('tooltip');

function hideTooltip() { tooltipEl.classList.remove('show'); }

function showTooltip(html, clientX, clientY) {
  tooltipEl.innerHTML = html;
  tooltipEl.classList.add('show');
  const wrap = document.getElementById('game-wrap').getBoundingClientRect();
  const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
  let x = clientX - wrap.left + 16, y = clientY - wrap.top + 16;
  if (x + tw > wrap.width) x = clientX - wrap.left - tw - 16;
  if (y + th > wrap.height) y = wrap.height - th - 8;
  tooltipEl.style.left = Math.max(4, x) + 'px';
  tooltipEl.style.top = Math.max(4, y) + 'px';
}

// Full damage breakdown for a spell instance (sp may carry tier/variant/enchant).
function spellDetailHtml(sp) {
  const def = SPELLS[sp.id];
  const s = game.player.stats;
  const t = displayTier(sp.id, sp.tier, sp.variant);
  const mm = masteryMod(sp.id);
  const fireF = 1 + 0.12 * game.elem.fire;
  const dmgMult = s.dmgMult * mm.dmgMult;           // shop preview: tempDmg = 1
  const crit = s.crit, critMult = s.critMult;
  const critAvg = 1 + crit * (critMult - 1);
  const effCd = t.cd ? t.cd * s.cdMult * mm.cdMult : 0;
  const rangeF = (sp.enchant === 'reach' ? 1 + 0.4 * s.rangePerkMult : 1) * s.rangeMult;
  const radiusF = (sp.enchant === 'reach' ? 1 + 0.3 * s.rangePerkMult : 1) * fireF;

  const row = (k, v) => `<div class="tt-row"><span>${k}</span><span>${v}</span></div>`;
  let h = `<div class="tt-title">${def.icon} ${spellName(sp)} · T${TIER_NAMES[sp.tier]}</div>`;

  if (t.dmg) {
    const base = Math.round(t.dmg);
    const eff = Math.round(t.dmg * dmgMult);
    h += row('Damage / hit', `${base} → <b class="up">${eff}</b>`);
    h += row('Avg w/ crit', Math.round(eff * critAvg));
  }
  if (t.dps) {
    h += row('Damage / sec', `${Math.round(t.dps)} → <b class="up">${Math.round(t.dps * dmgMult)}</b>`);
    if (t.dur) h += row('Duration', t.dur.toFixed(1) + 's');
  }
  if (effCd) {
    h += row('Cooldown', effCd.toFixed(2) + 's');
    const avgHit = Math.round(t.dmg * dmgMult) * critAvg;
    if (t.dmg) h += row('~Single-target DPS', Math.round(avgHit / effCd));
  } else if (sp.id === 'orbs' && t.dmg) {
    h += row('~DPS (per orb)', Math.round(t.dmg * dmgMult * critAvg * 2));
    h += row('Orbs', t.count);
  }
  h += row('Crit', `${Math.round(crit * 100)}% × ${critMult}`);
  if (t.radius) h += row('AoE radius', Math.round(t.radius * radiusF));
  if (t.range) h += row('Range', Math.round(t.range * rangeF));
  if (t.pierce) h += row('Pierces', t.pierce);
  if (t.chains) h += row('Chains', t.chains + (sp.variant === 'forked' ? ' ×2 forks' : ''));
  if (t.slow) h += row('Slow', Math.round(t.slow * 100) + '%');
  if (t.heal) h += row('Lifesteal', Math.round(t.heal * 100) + '%');
  if (t.shield) h += row('Shield', t.shield + ' (max ' + t.shield * 2 + ')');

  // this-wave contribution from the damage meter
  const dealt = game.dmgMeter[sp.id];
  if (dealt > 0) {
    const total = Object.values(game.dmgMeter).reduce((a, b) => a + b, 0);
    const tt = Math.max(1, game.waveTime);
    h += `<div class="tt-sec">This wave: <b>${formatNum(dealt)}</b> dmg · ${formatNum(dealt / tt)}/s · ${Math.round(dealt / total * 100)}% of total</div>`;
  }

  // modifiers in play
  const extras = [];
  // spell level (kills) + progress to the next mastery level
  const lvl = game.masteryLvl[sp.id] || 0;
  const kills = game.masteryAcc[sp.id] || 0;
  let lvlLine = `Mastery Lv ${lvl}/5 · ${kills} kills`;
  if (lvl < MASTERY_THRESHOLDS.length) lvlLine += ` (next at ${MASTERY_THRESHOLDS[lvl]})`;
  extras.push(lvlLine);
  if (mm.dmgMult !== 1 || mm.cdMult !== 1) extras.push(`Mastery bonus: +${Math.round((mm.dmgMult - 1) * 100)}% dmg / ${Math.round((1 - mm.cdMult) * 100)}% cd`);
  if (sp.enchant) extras.push(`⭐ ${ENCHANTS[sp.enchant].name}: ${ENCHANTS[sp.enchant].desc}`);
  const els = (def.elements || []).filter(e => game.elem[e] > 0).map(e => `${ELEMENTS[e].icon}${game.elem[e]}`);
  if (els.length) extras.push('Elements: ' + els.join(' '));
  if (extras.length) h += `<div class="tt-sec">${extras.join('<br>')}</div>`;
  return h;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
setState('title');
updateResumeButton();
requestAnimationFrame(frame);
