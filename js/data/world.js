'use strict';

// ===========================================================================
// Danger levels, colour themes, element realms, wave modifiers, fountains, world events
// ===========================================================================

// Danger levels: enemy HP & damage modifier, chosen before each run.
// Materials compensate: +50% gold per gem per +100% danger.
const DANGER_LEVELS = [
  { mod: 0,     name: 'Danger 1',  desc: 'The intended experience' },
  { mod: 0.10,  name: 'Danger 2',  desc: '+10% enemy HP & damage · +5% materials' },
  { mod: 0.25,  name: 'Danger 3',  desc: '+25% enemy HP & damage · +13% materials' },
  { mod: 0.50,  name: 'Danger 4',  desc: '+50% enemy HP & damage · +25% materials' },
  { mod: 1.00,  name: 'Danger 5',  desc: '+100% enemy HP & damage · +50% materials' },
  { mod: 1.50,  name: 'Danger 6',  desc: '+150% enemy HP & damage · +75% materials' },
  { mod: 3.00,  name: 'Danger 7',  desc: '+300% enemy HP & damage · +150% materials' },
  { mod: 5.00,  name: 'Danger 8',  desc: '+500% enemy HP & damage · +250% materials' },
  { mod: 7.50,  name: 'Danger 9',  desc: '+750% enemy HP & damage · +375% materials' },
  { mod: 10.00, name: 'Danger 10', desc: '+1000% enemy HP & damage · +500% materials' },
];

// Arena colour schemes (canvas background / grid / walls), chosen in Settings.
const THEMES = [
  { id: 'midnight', name: 'Midnight', bg: '#0d1020', grid: 'rgba(80,110,180,0.08)',  wall: '#2a3a58' },
  { id: 'dusk',     name: 'Dusk',     bg: '#1a1020', grid: 'rgba(180,110,150,0.09)', wall: '#4a2a48' },
  { id: 'forest',   name: 'Forest',   bg: '#0c1410', grid: 'rgba(90,170,110,0.09)',  wall: '#2a4a38' },
  { id: 'ember',    name: 'Ember',    bg: '#160d0a', grid: 'rgba(210,120,80,0.09)',  wall: '#5a2f22' },
  { id: 'mono',     name: 'High Contrast', bg: '#05060a', grid: 'rgba(255,255,255,0.12)', wall: '#9aa7b8' },
];

// Element map themes (waves 1-20): a random realm sets the backdrop and grants
// +2 to that element's meta stack. Keyed by element id.
const ELEMENT_THEMES = {
  fire:  { id: 'fire',  name: 'Fire Realm',  icon: '🔥', bg: '#1a0c08', grid: 'rgba(255,120,60,0.10)',  wall: '#7a3a22' },
  ice:   { id: 'ice',   name: 'Frozen Realm',icon: '❄️', bg: '#aec6da', grid: 'rgba(120,160,200,0.18)', wall: '#5a7da0' },
  earth: { id: 'earth', name: 'Earthen Realm',icon: '⛰️', bg: '#2a2113', grid: 'rgba(190,160,90,0.12)',  wall: '#6a5630' },
  wind:  { id: 'wind',  name: 'Windswept Realm',icon: '🌀', bg: '#0a1414', grid: 'rgba(120,230,210,0.10)', wall: '#2a6a60' },
};

// Wave modifiers: one rolls every 3rd non-boss wave to shake up the rhythm.
const WAVE_MODIFIERS = [
  { id: 'bloodmoon', name: 'Blood Moon',   icon: '🌑', desc: 'More enemies — but more gems',          color: '#ff5577' },
  { id: 'drought',   name: 'Mana Drought', icon: '🌵', desc: '+20% cooldowns now, -25% shop prices after', color: '#c47bff' },
  { id: 'glass',     name: 'Glass Arena',  icon: '🔷', desc: 'Enemies deal +30% damage, fountains heal double', color: '#7be1ff' },
  { id: 'swarm',     name: 'Swarm Nest',   icon: '🐝', desc: 'Endless bats and sparks',               color: '#ffb347' },
  { id: 'treasure',  name: 'Treasure Wave',icon: '💎', desc: 'Fewer enemies, but they drip gold',     color: '#ffd454' },
  { id: 'storm',     name: 'Storm Surge',  icon: '🌩️', desc: 'More arcane storms, +50% XP',           color: '#8be0ff' },
];

// World events: from wave 5, a 33% chance per round to erupt mid-wave. Each
// spawns persistent, shape-varied danger zones that pulse damage to player AND
// enemies until the wave ends. Behaviour lives in main.js (updateWorld).
const WORLD_EVENTS = [
  { id: 'quake',   name: 'The earth is rumbling',       icon: '🪨', color: '#c98a3a' },
  { id: 'storm',   name: 'A thunderstorm is approaching', icon: '⛈️', color: '#ffe96b' },
  { id: 'volcano', name: 'A volcano erupted',           icon: '🌋', color: '#ff6b4a' },
  { id: 'tide',    name: 'A tide is rising',            icon: '🌊', color: '#4aa8ff' },
];

// Fountain flavours — risk/reward shrines.
const FOUNTAIN_TYPES = [
  { id: 'heal',  name: 'Healing Fountain', color: '#6be8ff', desc: 'Heal 25% max HP' },
  { id: 'power', name: 'Power Fountain',   color: '#ffb347', desc: '+30% damage for 10s' },
  { id: 'spell', name: 'Spell Fountain',   color: '#c47bff', desc: 'A free spell for the rest of the wave' },
  { id: 'greed', name: 'Greed Fountain',   color: '#ffd454', desc: 'Gold now — but an ambush erupts' },
  { id: 'chaos', name: 'Chaos Fountain',   color: '#ff5577', desc: 'A strong blessing… or a curse' },
];

