'use strict';

// ===========================================================================
// Wavy-Wizards — standalone spell simulation
//
//   node simulate.js [danger]
//
// Headlessly loads the real game engine (no browser, no rendering) and runs a
// BASE CHARACTER with NO PERKS, casting each spell on its own, through 20 waves.
// Prints the predicted total spell damage / DPS / kills per spell.
//
// It works by stubbing the browser APIs the game touches at load time, then
// running every game source file PLUS an appended simulation block in a single
// shared scope (so the engine's top-level `const`s/functions are reachable).
// ===========================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const danger = Number(process.argv[2]) || 0; // optional danger level (default 0 = base)

// ---- the game's script load order (mirrors index.html) --------------------
const FILES = [
  'js/audio.js',
  'js/data/spells.js',
  'js/data/characters.js',
  'js/data/items.js',
  'js/data/enemies.js',
  'js/data/world.js',
  'js/main.js',
  'js/enemies-ai.js',
  'js/shop.js',
  'js/render/shades.js',
  'js/render/wizard.js',
  'js/render/environment.js',
];

// ---- minimal browser stubs ------------------------------------------------
const noop = () => {};
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (p === 'measureText') return () => ({ width: 0 });
    if (p === 'getImageData') return () => ({ data: [] });
    if (p in t) return t[p];
    return noop; // every other ctx member is a harmless no-op (we never render)
  },
  set(t, p, v) { t[p] = v; return true; },
});
function makeEl() {
  return {
    style: { setProperty: noop, getPropertyValue: () => '', removeProperty: noop }, dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, removeChild: noop, remove: noop,
    addEventListener: noop, removeEventListener: noop,
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    querySelector: () => makeEl(), querySelectorAll: () => [],
    getContext: () => ctxStub,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    focus: noop, click: noop,
    width: 1280, height: 720,
    innerHTML: '', textContent: '', value: '', disabled: false, title: '', onclick: null,
  };
}
const store = {};
const sandbox = {
  console,
  Math, Date, JSON, Object, Array, Set, Map, Number, String, Boolean, isNaN, parseInt, parseFloat, performance: { now: () => Date.now() },
  setTimeout: noop, clearTimeout: noop, requestAnimationFrame: noop, cancelAnimationFrame: noop,
  addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }),
  navigator: { getGamepads: () => [] },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { getElementById: () => makeEl(), createElement: () => makeEl(), addEventListener: noop, body: makeEl(), documentElement: makeEl() },
  SIM_DANGER: danger,
};
sandbox.window = sandbox;       // the engine reads window.AudioContext (undefined → audio self-mutes)
sandbox.globalThis = sandbox;

// ---- the appended simulation (runs in the same scope as the engine) -------
const SIM = `
;(function runSpellSim() {
  function basePlayer(spellId) {
    // a character with NO perks (its apply() does nothing) → pure base stats
    var ch = { id: 'base', name: 'Base', look: CHARACTERS[0].look, apply: function () {} };
    var p = freshPlayer(ch, spellId);
    p.spells = [{ id: spellId, tier: 0, t: 0, auto: true }];
    p.invuln = 1e9; // invulnerable so the run always completes
    return p;
  }
  function simSpell(spellId) {
    game.coop = false; game.p2 = null; game.danger = SIM_DANGER; game.mapElement = null;
    game.player = basePlayer(spellId);
    game.masteryLvl = {}; game.masteryMods = {}; game.masteryAcc = {};
    game.totalDmg = 0; game.runDmg = {}; game.kills = 0; game.effectT = {}; game.castQueue = [];
    var dt = 0.15, simTime = 0;
    for (var w = 1; w <= 20; w++) {
      simSetupWave(w);
      var boss = !!bossCountForWave(w);
      var cap = boss ? 30 : Math.min(game.waveDur, 18);
      for (var t = 0; t < cap; t += dt) {
        recomputeElements();
        updateProcs(dt); updateBuffs(dt);
        updateSpells(dt);
        updateProjectiles(dt); updateEnemyProjectiles(dt);
        updateClouds(dt); updateMeteors(dt); updateZones(dt); updateTornadoes(dt);
        updateSpawning(dt); updateEnemies(dt); updateRoundEffects(dt);
        updateFx(dt);
        game.player.invuln = 1e9;
        game.waveTime += dt; simTime += dt;
        if (boss && game.bossSpawned && !game.enemies.some(function (e) { return e.boss; }) &&
            game.spawns.every(function (s) { return s.type !== 'boss'; })) break;
      }
    }
    var total = Math.round(game.runDmg[spellId] || 0);
    return { id: spellId, name: SPELLS[spellId].name, icon: SPELLS[spellId].icon,
             total: total, dps: Math.round(total / Math.max(1, simTime)), kills: game.kills };
  }

  var results = Object.keys(SPELLS).map(simSpell).sort(function (a, b) { return b.total - a.total; });

  console.log('');
  console.log('=== Wavy-Wizards spell simulation ===');
  console.log('Base character (no perks) · Tier I · Danger ' + SIM_DANGER + ' · 20 waves each');
  console.log('');
  console.log('  ' + 'Spell'.padEnd(16) + 'Total dmg'.padStart(11) + 'DPS'.padStart(9) + 'Kills'.padStart(8));
  console.log('  ' + '-'.repeat(43));
  results.forEach(function (r) {
    console.log('  ' + r.name.padEnd(16) + String(r.total).padStart(11) + (r.dps + '/s').padStart(9) + String(r.kills).padStart(8));
  });
  console.log('');
})();
`;

// ---- load engine + sim in one shared scope --------------------------------
let source = '';
for (const f of FILES) source += fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;\n';
source += SIM;

vm.createContext(sandbox);
try {
  vm.runInContext(source, sandbox, { filename: 'wavy-sim-bundle.js' });
} catch (e) {
  console.error('Simulation failed:', e && e.stack ? e.stack : e);
  process.exit(1);
}
