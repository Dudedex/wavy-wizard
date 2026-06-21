'use strict';

// ===========================================================================
// Playable wizards (the Concentratos, looks, perks)
// ===========================================================================

// Playable wizards. `apply` mutates the starting stats; `look` drives the sprite.
const CHARACTERS = [
  {
    id: 'apprentice', name: 'Aldric', title: 'the Apprentice',
    look: { robe: '#3a55c9', hat: '#2c3f9e', orb: '#7be1ff', trim: '#bfefff', hasHat: true, hasStaff: true },
    perks: ['+15% materials from enemies', 'Shop prices -10%'],
    apply: s => { s.matMult += 0.15; s.priceMult = 0.9; },
  },
  {
    id: 'pyromancer', name: 'Pyra', title: 'the Pyromancer',
    look: { robe: '#b8402e', hat: '#8a2b1d', orb: '#ffb347', trim: '#ffd454', hasHat: true, hasStaff: false },
    perks: ['+30% spell damage', '-15 max HP'],
    apply: s => { s.dmgMult += 0.30; s.maxHp -= 15; },
  },
  {
    id: 'cleric', name: 'Benedict', title: 'the Cleric',
    look: { robe: '#c9c2a8', hat: '#a89e7d', orb: '#ffe96b', trim: '#fff2a8', hasHat: false, hood: true, hasStaff: true },
    perks: ['+25 max HP, +1 HP/s regen', 'All healing +50%', '-15% spell damage'],
    apply: s => { s.maxHp += 25; s.regen += 1; s.healMult = 1.5; s.dmgMult -= 0.15; },
  },
  {
    id: 'warlock', name: 'Vex', title: 'the Warlock',
    look: { robe: '#5a2d7a', hat: '#3d1d54', orb: '#9be05a', trim: '#c47bff', hasHat: true, hasStaff: false, horn: true },
    perks: ['+15% crit chance', 'Crits deal 2.5× damage', '-15 max HP'],
    apply: s => { s.crit += 0.15; s.critMult = 2.5; s.maxHp -= 15; },
  },
  {
    id: 'twincaster', name: 'Lyra', title: 'the Twincaster',
    look: { robe: '#1d7a72', hat: '#125049', orb: '#6be8ff', trim: '#9fffe6', hasHat: false, hasStaff: true, hair: '#2a2a2a' },
    perks: ['Every spell casts twice', 'Spell range -45%', 'Range bonuses are 50% weaker'],
    apply: s => { s.doubleCast = true; s.rangeMult = 0.55; s.rangePerkMult = 0.5; },
  },
  {
    id: 'chronomancer', name: 'Mira', title: 'the Chronomancer',
    look: { robe: '#2f6f8f', hat: '#1d4a60', orb: '#aef0ff', trim: '#dfe7ff', hasHat: true, hasStaff: true },
    perks: ['-20% spell cooldowns', '-10% move speed'],
    apply: s => { s.cdMult *= 0.80; s.speedMult -= 0.10; },
  },
  {
    id: 'geomancer', name: 'Odo', title: 'the Geomancer',
    look: { robe: '#7a5a32', hat: '#5a3f1e', orb: '#d7b46a', trim: '#e3c98a', hasHat: false, hasStaff: true, bald: true },
    perks: ['+5 armor', '-40 pickup range'],
    apply: s => { s.armor += 5; s.pickup = Math.max(20, s.pickup - 40); },
  },
  {
    id: 'moonwitch', name: 'Selene', title: 'the Moon Witch',
    look: { robe: '#3a3a6e', hat: '#26264a', orb: '#dfe7ff', trim: '#f4d7ff', hasHat: true, hasStaff: false, hair: '#caa6e0' },
    perks: ['Crits heal 1 HP', '+8% crit chance', '-10% spell damage'],
    apply: s => { s.critHeal = 1; s.crit += 0.08; s.dmgMult -= 0.10; },
  },
  {
    id: 'battlemage', name: 'Brakk', title: 'the Battle Mage',
    look: { robe: '#8a3a2a', hat: '#5a241a', orb: '#ff9a5a', trim: '#ffc07a', hasHat: false, hasStaff: false, bald: true },
    perks: ['Searing aura damages nearby enemies', '+2 armor', 'Only 4 spell slots'],
    apply: s => { s.aura = 8; s.armor += 2; s.maxSlots = 4; },
  },
  {
    id: 'wildmage', name: 'Nix', title: 'the Wild Mage',
    look: { robe: '#6e2d7a', hat: '#46194f', orb: '#ff7be1', trim: '#ffa8f0', hasHat: true, hasStaff: false },
    perks: ['Every 5th cast fires an extra time', '+10% spell damage', '+5% crit'],
    apply: s => { s.wildEvery = 5; s.dmgMult += 0.10; s.crit += 0.05; },
  },
  {
    id: 'concentratos', name: 'Stilo', title: 'the Concentratos',
    look: { robe: '#2a3a6a', hat: '#1d2a4a', orb: '#aef0ff', trim: '#dfe7ff', hasHat: false, hood: true, hasStaff: true },
    perks: ['Casts only while standing still (+50% damage)', '+25% move speed while moving', '-25% range & area on everything'],
    apply: s => { s.concentrator = true; s.rangeMult -= 0.25; s.areaMult -= 0.25; },
  },
  // --- Drawback-driven wizards: each rebuilds the run around a weird constraint ---
  {
    id: 'gambler', name: 'Fortuna', title: 'the Gambler',
    look: { robe: '#3a7a4a', hat: '#235031', orb: '#ffe96b', trim: '#fff2a8', hasHat: true, hasStaff: false },
    perks: ['Shop prices swing wildly (±)', 'Items have a 40% chance to apply twice', '-10 max HP'],
    apply: s => { s.gambler = true; s.maxHp -= 10; },
  },
  {
    id: 'summoner', name: 'Morwen', title: 'the Summoner',
    look: { robe: '#4a2d7a', hat: '#2f1d54', orb: '#b89aff', trim: '#d8c8ff', hasHat: false, hood: true, hasStaff: true },
    perks: ['Kills summon a temporary familiar that fights for you', '-25% spell damage'],
    apply: s => { s.summoner = true; s.dmgMult -= 0.25; },
  },
  {
    id: 'hermit', name: 'Cyrus', title: 'the Hermit',
    look: { robe: '#6a5a3a', hat: '#473c24', orb: '#d7c46a', trim: '#efe0a0', hasHat: false, hood: true, hasStaff: true, bald: true },
    perks: ['Only 3 spell slots', '+60% spell damage'],
    apply: s => { s.maxSlots = 3; s.dmgMult += 0.60; },
  },
  {
    id: 'collector', name: 'Quill', title: 'the Collector',
    look: { robe: '#2d5a7a', hat: '#1d3d54', orb: '#8be0ff', trim: '#d8f6ff', hasHat: true, hasStaff: true },
    perks: ['Each fusion makes that spell +15% stronger', 'Manual fusion costs gold', '+10% materials'],
    apply: s => { s.collector = true; s.matMult += 0.10; },
  },
  {
    id: 'rando', name: 'Rando', title: 'the Unpredictable',
    look: { robe: '#7a5aa8', hat: '#4a3070', orb: '#ff7be1', trim: '#ffa8f0', hasHat: true, hasStaff: true },
    perks: ['Cannot buy spells — items only', 'Every wave his whole spellbook is re-rolled at random', 'Each spell\'s tier = its mastery level, and persists'],
    apply: s => { s.rando = true; },
  },
  {
    id: 'cursedking', name: 'Mordred', title: 'the Cursed King',
    look: { robe: '#7a2d3a', hat: '#541d28', orb: '#ff6b6b', trim: '#ffd454', hasHat: true, hasStaff: true, horn: true },
    perks: ['+40% spell damage', 'Lose 8 max HP each wave unless you bought a relic last shop'],
    apply: s => { s.cursedKing = true; s.dmgMult += 0.40; },
  },
];

