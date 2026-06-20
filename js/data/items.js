'use strict';

// ===========================================================================
// Shop items & level-up options
// ===========================================================================

// Passive items sold in the shop (stack freely).
const ITEMS = [
  { id: 'tome',    name: 'Tome of Power',  icon: '📕', desc: '+12% spell damage',            price: 25, apply: s => s.dmgMult += 0.12 },
  { id: 'boots',   name: 'Swift Boots',    icon: '👢', desc: '+10% move speed',              price: 18, apply: s => s.speedMult += 0.10 },
  { id: 'talisman',name: 'Iron Talisman',  icon: '🪬', desc: '+2 armor',                     price: 20, apply: s => s.armor += 2 },
  { id: 'heart',   name: 'Heart Crystal',  icon: '❤️', desc: '+15 max HP',                   price: 18, apply: s => s.maxHp += 15 },
  { id: 'ring',    name: 'Regen Ring',     icon: '💍', desc: '+0.7 HP / sec',                price: 20, apply: s => s.regen += 0.7 },
  { id: 'hourglass',name:'Hourglass',      icon: '⏳', desc: '-7% spell cooldowns',          price: 26, apply: s => s.cdMult *= 0.93 },
  { id: 'clover',  name: 'Lucky Clover',   icon: '🍀', desc: '+8% crit chance',              price: 22, apply: s => s.crit += 0.08 },
  { id: 'magnet',  name: 'Magnet Stone',   icon: '🧲', desc: '+30 pickup range',             price: 14, apply: s => s.pickup += 30 },
  { id: 'idol',    name: 'Greedy Idol',    icon: '🗿', desc: '+20% materials from enemies',  price: 28, apply: s => s.matMult += 0.20 },
  { id: 'wand',    name: 'Crystal Wand',   icon: '🪄', desc: '+6% damage, -3% cooldowns',    price: 32, apply: s => { s.dmgMult += 0.06; s.cdMult *= 0.97; } },
  { id: 'robe',    name: 'Warding Robe',   icon: '🥋', desc: '+10 max HP, +1 armor',         price: 26, apply: s => { s.maxHp += 10; s.armor += 1; } },
  { id: 'skull',   name: 'Cursed Skull',   icon: '💀', desc: '+20% damage, -10 max HP',      price: 30, apply: s => { s.dmgMult += 0.20; s.maxHp = Math.max(10, s.maxHp - 10); } },
  // High-risk, high-reward tradeoffs: the bonus outweighs the downside if you can play around it.
  { id: 'glass',   name: 'Glass Cannon Orb', icon: '🔮', desc: '+25% damage, -2 armor',        price: 30, apply: s => { s.dmgMult += 0.25; s.armor -= 2; } },
  { id: 'anchor',  name: 'Leaden Anchor',  icon: '⚓', desc: '+4 armor, -8% move speed',      price: 28, apply: s => { s.armor += 4; s.speedMult -= 0.08; } },
  { id: 'bloodpact', name: 'Blood Pact',   icon: '🫀', desc: '+1.5 HP/s regen, -15 max HP',   price: 26, apply: s => { s.regen += 1.5; s.maxHp = Math.max(10, s.maxHp - 15); } },
  { id: 'overclock', name: 'Cracked Hourglass', icon: '⌛', desc: '-15% cooldowns, shop prices +10%', price: 34, apply: s => { s.cdMult *= 0.85; s.priceMult += 0.10; } },
  // Chaos items: timed random effects that proc during combat.
  { id: 'berserk', name: 'Berserker Brew', icon: '🍺', desc: 'Every 20s: ENRAGE for 5s — +200% damage but -50% move speed', price: 38,
    proc: { interval: 20, dur: 5, modes: [{ name: 'ENRAGE!', dmg: 2.0, spd: -0.5, color: '#ff5577' }] } },
  { id: 'quicksilver', name: 'Quicksilver Vial', icon: '🧪', desc: 'Every 12s: +35% move speed for 4s', price: 24,
    proc: { interval: 12, dur: 4, modes: [{ name: 'SWIFT!', spd: 0.35, color: '#7be1ff' }] } },
  { id: 'trickster', name: 'Trickster Die', icon: '🎲', desc: 'Every 10s, for 4s: +30% speed, +40% damage, or -25% speed. Feeling lucky?', price: 30,
    proc: { interval: 10, dur: 4, modes: [
      { name: 'HASTE!', spd: 0.3, color: '#7fe08f' },
      { name: 'MIGHT!', dmg: 0.4, color: '#ffb347' },
      { name: 'SLUGGISH…', spd: -0.25, color: '#9aa7b8' },
    ] } },
  // Synergy items: reward committing to a damage type / spell.

  { id: 'duelistglyph', name: 'Duelist Glyph', icon: '🎯', desc: '+20% single-target spell damage', price: 46, apply: s => { s.typeMult.single = (s.typeMult.single || 1) * 1.20; } },
  { id: 'breathfocus', name: 'Dragon Lung', icon: '🐉', desc: '+25% breath spell damage', price: 48, apply: s => { s.typeMult.breath = (s.typeMult.breath || 1) * 1.25; } },
  { id: 'blastprism', name: 'Blast Prism', icon: '💠', desc: '+18% AoE spell damage', price: 50, apply: s => { s.typeMult.aoe = (s.typeMult.aoe || 1) * 1.18; } },
  { id: 'stormcoil', name: 'Storm Coil', icon: '🧲', desc: '+22% chaining and projectile spell damage', price: 44, apply: s => { s.typeMult.projectile = (s.typeMult.projectile || 1) * 1.22; } },
  { id: 'ember',   name: 'Ember Crown',   icon: '👑', tag: 'fire',   desc: '🔥 Fire spells leave burning ground for 1.5s', price: 34, apply: s => s.burnGround += 1 },
  { id: 'fcore',   name: 'Frozen Core',   icon: '🧊', tag: 'frost',  desc: '❄️ Slowed enemies take +15% damage',        price: 34, apply: s => s.frostAmp += 0.15 },
  { id: 'needle',  name: 'Storm Needle',  icon: '📍', tag: 'storm',  desc: '⚡ Chain Lightning gains +1 chain per crit (this cast)', price: 32, apply: s => s.stormCrit += 1 },
  { id: 'lens',    name: 'Orbital Lens',  icon: '🛰️', tag: 'arcane', desc: '🔮 Arcane Orbs rotate +30% faster',          price: 28, apply: s => s.orbSpeed += 0.30 },
  { id: 'bell',    name: "Martyr's Bell", icon: '🔔', tag: 'holy',   desc: '✨ Taking damage cuts Holy Nova cooldown by 1.5s', price: 30, apply: s => s.martyr += 1.5 },
  // Positioning items: reward a distinct play distance.
  { id: 'sigil',   name: 'Point-Blank Sigil', icon: '🎯', desc: '+25% damage to enemies within 150px', price: 32, apply: s => s.pointBlank += 0.25 },
  { id: 'scope',   name: "Coward's Telescope", icon: '🔭', desc: '+25% spell range, -10% move speed',   price: 28, apply: s => { s.rangeMult += 0.25; s.speedMult -= 0.10; } },
  { id: 'duel',    name: 'Duelist Robe',  icon: '🤺', desc: '+3 armor while fewer than 5 enemies are near', price: 26, apply: s => s.duelist += 3 },
  { id: 'panic',   name: 'Panic Bell',    icon: '🛎️', desc: 'When hit, release a weak Holy Nova',       price: 24, apply: s => s.panicBell += 1 },
  // Economy: claws back voided gold at wave end (stacks up to 3 for ~99% recovery)
  { id: 'reclaimer', name: 'Gold Reclaimer', icon: '♻️', desc: '-33% gold voided at wave end (max 3)', price: 30, apply: s => s.reclaim = Math.min(3, (s.reclaim || 0) + 1) },
  // Spell-modifying relics: mutate HOW your spells behave, not just the numbers.
  { id: 'splitwand', name: 'Split Wand',    icon: '🪄', desc: 'Single-target bolts split into 2 shards at 50% damage on hit', price: 34, apply: s => s.splitWand = (s.splitWand || 0) + 1 },
  { id: 'burnink',   name: 'Burning Ink',   icon: '🖋️', desc: 'Damage-over-time effects can crit', price: 30, apply: s => s.dotCrit = true },
  { id: 'echolens',  name: 'Echo Lens',     icon: '🔭', desc: 'Every 7th cast repeats for free', price: 32, apply: s => s.echoEvery = 7 },
  { id: 'gravity',   name: 'Gravity Stone', icon: '🌑', desc: 'AoE blasts pull enemies inward before detonating', price: 32, apply: s => s.gravity = true },
  { id: 'brittle',   name: 'Brittle Ice',   icon: '🧊', desc: 'Slowed/frozen enemies take +35% crit chance', price: 30, apply: s => s.brittle = true },
  { id: 'stormbat',  name: 'Storm Battery', icon: '🔋', desc: 'Chain Lightning kills charge your next cast (+60% dmg)', price: 32, apply: s => s.stormBattery = true },
  // Round-effect gadgets: passively deploy something on a timer during the wave.
  // (`roundEffect.interval` is in seconds; more copies fire proportionally faster.)
  { id: 'decoy',   name: 'Decoy Clown',   icon: '🤡', desc: 'Every 20s a clown decoy appears that taunts enemies and soaks 10 hits', price: 30, roundEffect: { interval: 20, kind: 'decoy' } },
  { id: 'flash',   name: 'Flashbang',     icon: '🧨', desc: 'Every 10s a flashbang drops, detonating after 1s to stun enemies for 3s', price: 28, roundEffect: { interval: 10, kind: 'flash' } },
  { id: 'turret',  name: 'Arcane Turret', icon: '🗼', desc: 'Every 16s deploys a turret that zaps nearby enemies for 12s', price: 34, roundEffect: { interval: 16, kind: 'turret' } },
  { id: 'totem',   name: 'Healing Totem', icon: '🪅', desc: 'Every 22s drops a totem that heals you while you stand near it', price: 30, roundEffect: { interval: 22, kind: 'totem' } },
  { id: 'blackhole', name: 'Black Hole Orb', icon: '🕳️', desc: 'Every 25s a singularity pulls enemies in, then bursts', price: 36, roundEffect: { interval: 25, kind: 'blackhole' } },
  { id: 'mirror',  name: 'Mirror Image',  icon: '👥', desc: 'Every 18s a clone appears that recasts your last spell at half power', price: 34, roundEffect: { interval: 18, kind: 'mirror' } },
  { id: 'banner',  name: 'Banner of Fury', icon: '🚩', desc: 'Every 20s plant a banner that grants +30% damage while you fight near it', price: 32, roundEffect: { interval: 20, kind: 'banner' } },
  { id: 'bubble',  name: 'Time Bubble',   icon: '⏳', desc: 'Every 16s a bubble briefly slows every enemy caught inside it', price: 30, roundEffect: { interval: 16, kind: 'bubble' } },
  // Breath-cone widener: +15° per copy, up to a 180° cone (then it stops appearing)
  { id: 'widecone', name: 'Wide Lens',    icon: '📐', desc: '+15° breath-cone angle (up to 180°)', price: 26, apply: s => s.coneDeg = Math.min(135, (s.coneDeg || 0) + 15) },
];

// Level-up choices (pick 1 of 3 per level). Deliberately modest — spells carry the run.
const LEVELUP_OPTIONS = [
  { name: 'Power',      icon: '🔥', desc: '+6% spell damage',  apply: s => s.dmgMult += 0.06 },
  { name: 'Vitality',   icon: '❤️', desc: '+6 max HP (and heal 6)', apply: (s, p) => { s.maxHp += 6; p.hp = Math.min(s.maxHp, p.hp + 6); } },
  { name: 'Haste',      icon: '⏳', desc: '-4% spell cooldowns', apply: s => s.cdMult *= 0.96 },
  { name: 'Swiftness',  icon: '👢', desc: '+5% move speed',    apply: s => s.speedMult += 0.05 },
  { name: 'Toughness',  icon: '🛡️', desc: '+1 armor',          apply: s => s.armor += 1 },
  { name: 'Precision',  icon: '🎯', desc: '+4% crit chance',   apply: s => s.crit += 0.04 },
  { name: 'Mending',    icon: '💚', desc: '+0.45 HP / sec',    apply: s => s.regen += 0.45 },
  { name: 'Greed',      icon: '🧲', desc: '+15 pickup range, +8% materials', apply: s => { s.pickup += 15; s.matMult += 0.08; } },
];

const MIGHTY_LEVELUP_OPTIONS = [
  { name: 'Mighty Power',      icon: '🔥', desc: '+30% spell damage',  apply: s => s.dmgMult += 0.30 },
  { name: 'Mighty Vitality',   icon: '❤️', desc: '+30 max HP (and heal 30)', apply: (s, p) => { s.maxHp += 30; p.hp = Math.min(s.maxHp, p.hp + 30); } },
  { name: 'Mighty Haste',      icon: '⏳', desc: '-20% spell cooldowns', apply: s => s.cdMult *= 0.80 },
  { name: 'Mighty Swiftness',  icon: '👢', desc: '+25% move speed',    apply: s => s.speedMult += 0.25 },
  { name: 'Mighty Toughness',  icon: '🛡️', desc: '+5 armor',          apply: s => s.armor += 5 },
  { name: 'Mighty Precision',  icon: '🎯', desc: '+20% crit chance',   apply: s => s.crit += 0.20 },
  { name: 'Mighty Mending',    icon: '💚', desc: '+2.25 HP / sec',     apply: s => s.regen += 2.25 },
  { name: 'Mighty Greed',      icon: '🧲', desc: '+75 pickup range, +40% materials', apply: s => { s.pickup += 75; s.matMult += 0.40; } },
];
