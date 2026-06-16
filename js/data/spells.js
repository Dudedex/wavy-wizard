'use strict';

// ===========================================================================
// Spells, tiers, icons, enchants, variants, elements & tags
// ===========================================================================

const TIER_NAMES  = ['I', 'II', 'III', 'IV'];
const TIER_COLORS = ['#9aa7b8', '#5fb4ff', '#c47bff', '#ffb347'];

const MAX_SPELL_SLOTS = 6;

// Each spell has 4 tiers. Buying a spell you already own upgrades its tier.
const SPELLS = {
  missile: {
    name: 'Magic Missile', icon: '💫', color: '#7be1ff',
    desc: 'Fires a swift homing bolt at the nearest enemy.',
    tiers: [
      { dmg: 14, cd: 0.60, range: 420, price: 14 },
      { dmg: 16, cd: 0.52, range: 450, price: 34 },
      { dmg: 27, cd: 0.45, range: 480, price: 68 },
      { dmg: 44, cd: 0.38, range: 520, price: 120 },
    ],
    lines: t => [`Damage: ${t.dmg}`, `Cooldown: ${t.cd}s`, `Range: ${t.range}`],
  },
  fireball: {
    name: 'Fireball', icon: '🔥', color: '#ff8c42',
    desc: 'Hurls a fireball that explodes in an area.',
    tiers: [
      { dmg: 19, cd: 1.50, range: 420, radius: 70,  price: 18 },
      { dmg: 25, cd: 1.40, range: 440, radius: 82,  price: 42 },
      { dmg: 42, cd: 1.28, range: 470, radius: 96,  price: 85 },
      { dmg: 68, cd: 1.12, range: 500, radius: 112, price: 150 },
    ],
    lines: t => [`Damage: ${t.dmg} (AoE)`, `Radius: ${t.radius}`, `Cooldown: ${t.cd}s`],
  },
  frost: {
    name: 'Frost Shard', icon: '❄️', color: '#a8e6ff',
    desc: 'Piercing ice shard that slows everything it hits.',
    tiers: [
      { dmg: 10, cd: 0.90, range: 460, pierce: 3, slow: 0.35, price: 16 },
      { dmg: 13, cd: 0.80, range: 480, pierce: 4, slow: 0.40, price: 38 },
      { dmg: 21, cd: 0.70, range: 500, pierce: 6, slow: 0.45, price: 75 },
      { dmg: 34, cd: 0.60, range: 540, pierce: 9, slow: 0.50, price: 130 },
    ],
    lines: t => [`Damage: ${t.dmg}`, `Pierces ${t.pierce} enemies`, `Slow: ${Math.round(t.slow * 100)}% for 2s`, `Cooldown: ${t.cd}s`],
  },
  lightning: {
    name: 'Chain Lightning', icon: '⚡', color: '#ffe96b',
    desc: 'Zaps the nearest enemy and arcs to others.',
    tiers: [
      { dmg: 13, cd: 1.30, range: 380, chains: 3, price: 20 },
      { dmg: 17, cd: 1.18, range: 400, chains: 4, price: 46 },
      { dmg: 28, cd: 1.05, range: 430, chains: 5, price: 90 },
      { dmg: 46, cd: 0.90, range: 460, chains: 7, price: 160 },
    ],
    lines: t => [`Damage: ${t.dmg} per hit`, `Chains to ${t.chains} enemies`, `Cooldown: ${t.cd}s`],
  },
  shield: {
    name: 'Arcane Shield', icon: '🛡️', color: '#8fa8ff',
    desc: 'Periodically grants a shield that absorbs damage.',
    tiers: [
      { shield: 16, cd: 6.0, price: 16 },
      { shield: 20, cd: 5.5, price: 40 },
      { shield: 32, cd: 5.0, price: 80 },
      { shield: 50, cd: 4.4, price: 140 },
    ],
    lines: t => [`Shield: ${t.shield} HP`, `Max stack: ${t.shield * 2}`, `Cooldown: ${t.cd}s`],
  },
  poison: {
    name: 'Poison Cloud', icon: '☣️', color: '#9be05a',
    desc: 'Conjures a toxic cloud on enemies that damages over time.',
    tiers: [
      { dps: 8,  cd: 3.5, range: 480, radius: 70,  dur: 3.5, price: 15 },
      { dps: 11, cd: 3.2, range: 500, radius: 82,  dur: 4.0, price: 36 },
      { dps: 18, cd: 3.0, range: 520, radius: 96,  dur: 4.5, price: 72 },
      { dps: 29, cd: 2.7, range: 560, radius: 112, dur: 5.0, price: 125 },
    ],
    lines: t => [`${t.dps} damage / sec`, `Radius: ${t.radius}`, `Lasts ${t.dur}s`, `Cooldown: ${t.cd}s`],
  },
  meteor: {
    name: 'Meteor', icon: '☄️', color: '#ff6b4a',
    desc: 'Calls a meteor onto a random enemy. Huge area damage.',
    tiers: [
      { dmg: 45,  cd: 4.5, radius: 90,  price: 22 },
      { dmg: 62,  cd: 4.1, radius: 102, price: 50 },
      { dmg: 100, cd: 3.7, radius: 116, price: 95 },
      { dmg: 160, cd: 3.3, radius: 132, price: 170 },
    ],
    lines: t => [`Damage: ${t.dmg} (AoE)`, `Radius: ${t.radius}`, `Cooldown: ${t.cd}s`],
  },
  drain: {
    name: 'Life Drain', icon: '🩸', color: '#ff7da0',
    desc: 'Drains life from the nearest enemy, healing you.',
    tiers: [
      { dmg: 12, cd: 1.10, range: 250, heal: 0.30, price: 18 },
      { dmg: 16, cd: 1.00, range: 270, heal: 0.35, price: 42 },
      { dmg: 26, cd: 0.88, range: 290, heal: 0.40, price: 82 },
      { dmg: 42, cd: 0.75, range: 320, heal: 0.50, price: 145 },
    ],
    lines: t => [`Damage: ${t.dmg}`, `Heals ${Math.round(t.heal * 100)}% of damage`, `Range: ${t.range}`, `Cooldown: ${t.cd}s`],
  },
  orbs: {
    name: 'Arcane Orbs', icon: '🪐', color: '#c47bff',
    desc: 'Orbs orbit around you, damaging enemies they touch.',
    tiers: [
      { count: 1, dmg: 13, cd: 0, price: 20 },
      { count: 2, dmg: 15, cd: 0, price: 48 },
      { count: 3, dmg: 21, cd: 0, price: 92 },
      { count: 4, dmg: 32, cd: 0, price: 165 },
    ],
    lines: t => [`${t.count} orbiting orb${t.count > 1 ? 's' : ''}`, `Damage: ${t.dmg} per touch`],
  },
  nova: {
    name: 'Holy Nova', icon: '✨', color: '#fff3b0',
    desc: 'A burst of light around you that damages and knocks back.',
    tiers: [
      { dmg: 24, cd: 4.0, radius: 130, price: 18 },
      { dmg: 31, cd: 3.7, radius: 146, price: 44 },
      { dmg: 52, cd: 3.3, radius: 165, price: 88 },
      { dmg: 84, cd: 2.9, radius: 190, price: 155 },
    ],
    lines: t => [`Damage: ${t.dmg} (AoE)`, `Radius: ${t.radius}`, `Knocks enemies back`, `Cooldown: ${t.cd}s`],
  },
  // Breath spells: a ~90° cone toward the nearest enemy with an elemental aftermath.
  firebreath: {
    name: 'Fire Breath', icon: '🌋', color: '#ff7a3a', breath: 'fire',
    desc: 'Exhale a cone of flame that leaves the ground burning.',
    tiers: [
      { dmg: 16, cd: 1.40, range: 200, price: 20 },
      { dmg: 24, cd: 1.30, range: 215, price: 46 },
      { dmg: 38, cd: 1.20, range: 230, price: 90 },
      { dmg: 60, cd: 1.05, range: 250, price: 160 },
    ],
    lines: t => [`Damage: ${t.dmg} (cone)`, `Leaves burning ground`, `Cooldown: ${t.cd}s`],
  },
  icebreath: {
    name: 'Ice Breath', icon: '🌨️', color: '#a8e6ff', breath: 'ice',
    desc: 'A freezing cone that roots everything it hits for 3s.',
    tiers: [
      { dmg: 12, cd: 1.70, range: 190, price: 20 },
      { dmg: 18, cd: 1.60, range: 205, price: 46 },
      { dmg: 29, cd: 1.45, range: 220, price: 90 },
      { dmg: 46, cd: 1.30, range: 240, price: 160 },
    ],
    lines: t => [`Damage: ${t.dmg} (cone)`, `Roots enemies 3s`, `Cooldown: ${t.cd}s`],
  },
  earthbreath: {
    name: 'Earth Breath', icon: '🪨', color: '#d7b46a', breath: 'earth',
    desc: 'A gritblast cone that hurls enemies back hard.',
    tiers: [
      { dmg: 15, cd: 1.50, range: 200, price: 20 },
      { dmg: 23, cd: 1.40, range: 215, price: 46 },
      { dmg: 36, cd: 1.28, range: 230, price: 90 },
      { dmg: 56, cd: 1.15, range: 250, price: 160 },
    ],
    lines: t => [`Damage: ${t.dmg} (cone)`, `Knocks enemies back`, `Cooldown: ${t.cd}s`],
  },
  windbreath: {
    name: 'Wind Breath', icon: '🌪️', color: '#8be0ff', breath: 'wind',
    desc: 'A gale cone; each enemy hit spawns a roaming tornado.',
    tiers: [
      { dmg: 14, cd: 1.60, range: 200, price: 20 },
      { dmg: 21, cd: 1.50, range: 215, price: 46 },
      { dmg: 33, cd: 1.38, range: 230, price: 90 },
      { dmg: 52, cd: 1.25, range: 250, price: 160 },
    ],
    lines: t => [`Damage: ${t.dmg} (cone)`, `Tornadoes: 5s, 33% dmg`, `Cooldown: ${t.cd}s`],
  },
};

// Fusion payoff: every spell's MAX tier (IV) gains a unique "perfected" behavior
// on top of the bigger numbers. Tier III also reads as an upgraded cast visually
// (handled in the renderer via the projectile/effect `tierFx`). These strings are
// shown in the shop fusion preview and spell tooltips.
const PERFECTED = {
  missile:    'Kills split into 2 homing shards',
  fireball:   'Leaves a lingering burning patch',
  frost:      'Freezes the last pierced enemy solid',
  lightning:  'The final target is blasted for bonus AoE',
  shield:     'Overcharged — +50% shield cap',
  poison:     'Cloud grows when an enemy dies inside it',
  meteor:     'Impact leaves a burning crater',
  drain:      'Siphons a second nearby enemy too',
  orbs:       'Orbs grow larger and chill on touch',
  nova:       'Grants a burst of armor on each cast',
  firebreath: 'Bigger, longer-lasting flames',
  icebreath:  'Frozen foes shatter on death',
  earthbreath:'Huge knockback + brief armor',
  windbreath: 'Larger, longer-lived tornadoes',
};
for (const id in SPELLS) SPELLS[id].perfected = PERFECTED[id] || null;

// Spell tags drive build synergies (see synergy items below).
const SPELL_TAGS = {
  missile: ['arcane'], fireball: ['fire'], frost: ['frost'], lightning: ['storm'],
  shield: ['arcane'], poison: ['venom'], meteor: ['fire'], drain: ['holy'],
  orbs: ['arcane'], nova: ['holy'],
  firebreath: ['fire'], icebreath: ['frost'], earthbreath: ['arcane'], windbreath: ['storm'],
};
for (const id in SPELLS) SPELLS[id].tags = SPELL_TAGS[id] || [];

const TAG_COLORS = {
  fire: '#ff8c42', frost: '#a8e6ff', arcane: '#c47bff',
  holy: '#fff3b0', storm: '#ffe96b', venom: '#9be05a',
};

// Spell meta-classes (elements). Owning spells of an element stacks a bonus,
// capped at 3 spells. A spell can belong to more than one element.
const ELEMENTS = {
  fire:  { name: 'Fire',  icon: '🔥', color: '#ff8c42', desc: '+12% AoE size per stack' },
  ice:   { name: 'Ice',   icon: '❄️', color: '#a8e6ff', desc: 'your hits slow enemies (8%/stack)' },
  earth: { name: 'Earth', icon: '⛰️', color: '#d7b46a', desc: '+2 armor & +0.3 HP/s per stack' },
  wind:  { name: 'Wind',  icon: '🌀', color: '#8be0ff', desc: '+5% move speed per stack' },
};
const SPELL_ELEMENTS = {
  missile: ['wind'],
  fireball: ['fire'],
  frost: ['ice'],
  lightning: ['wind'],
  shield: ['earth'],
  poison: ['earth'],
  meteor: ['fire', 'earth'],
  drain: ['ice'],
  orbs: ['wind'],
  nova: ['fire', 'wind'],
  firebreath: ['fire'],
  icebreath: ['ice'],
  earthbreath: ['earth'],
  windbreath: ['wind'],
};
for (const id in SPELLS) SPELLS[id].elements = SPELL_ELEMENTS[id] || [];

// Legendary enchantments — build-defining. Equip one per spell, up to 3 spells.
const ENCHANTS = {
  splash:    { name: 'Splash',    icon: '💥', desc: 'Hits explode for 50% damage — explosions chain on kills' },
  reach:     { name: 'Reach',     icon: '🔭', desc: '+40% range, +30% area, +30% zone duration' },
  vampiric:  { name: 'Vampiric',  icon: '🩸', desc: 'Heal 10% of damage — overheal becomes shield' },
  echo:      { name: 'Echo',      icon: '🔁', desc: '40% to cast again (60% damage, crits on its own)' },
  frostbite: { name: 'Frostbite', icon: '❄️', desc: 'Slow 30% — slowed enemies shatter on death' },
};

// Rare spell variants: an alternate stat profile of a base spell, occasionally
// offered in the shop. `mod(t)` mutates a cloned tier; extra flags drive behavior.
const VARIANTS = {
  rapid:  { spell: 'missile',  name: 'Rapid Magic Missile', desc: 'Much faster cadence, weaker bolts', mod: t => { t.dmg = Math.round(t.dmg * 0.6); t.cd *= 0.45; } },
  heavy:  { spell: 'fireball', name: 'Heavy Fireball', desc: 'Hits much harder, slow projectile', mod: t => { t.dmg = Math.round(t.dmg * 1.6); t.cd *= 1.15; }, projMult: 0.55 },
  giant:  { spell: 'nova',     name: 'Giant Nova', desc: 'Far bigger blast, longer cooldown', mod: t => { t.radius = Math.round(t.radius * 1.5); t.cd *= 1.5; } },
  venom:  { spell: 'poison',   name: 'Venom Cloud', desc: 'Its toxin also slows enemies', slow: 0.25 },
  forked: { spell: 'lightning',name: 'Forked Lightning', desc: 'Strikes two targets, fewer chains', mod: t => { t.chains = Math.max(1, t.chains - 2); }, forks: 2 },
};
