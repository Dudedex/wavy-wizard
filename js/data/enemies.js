'use strict';

// ===========================================================================
// Enemy archetypes & per-wave spawn pool
// ===========================================================================

// Enemy archetypes. hp/dmg get scaled up per wave in main.js.
const ENEMY_TYPES = {
  blob:    { name: 'Green Ghost', r: 14, hp: 5,   spd: 82,  dmg: 3,  color: '#6ecb5a', gems: 1 },
  bat:     { name: 'Purple Bat', r: 10, hp: 18,  spd: 150, dmg: 4,  color: '#b07bff', gems: 1 },
  yellowbat: { name: 'Yellow Bat', r: 10, hp: 23, spd: 142, dmg: 5, color: '#ffd454', gems: 1 },
  redbat:  { name: 'Red Bat', r: 11, hp: 30, spd: 136, dmg: 6, color: '#ff5577', gems: 2 },
  spitter: { name: 'Spitter', r: 13, hp: 18,  spd: 55,  dmg: 5,  color: '#e8d44d', gems: 2,
             ranged: { range: 280, cd: 1.8, projSpd: 190, dmg: 6 } },
  brute:   { name: 'Brute',   r: 24, hp: 55,  spd: 58,  dmg: 15, color: '#e06a5a', gems: 3 },
  imp:     { name: 'Imp',     r: 12, hp: 22,  spd: 88,  dmg: 6,  color: '#ff8ad0', gems: 2, splitsInto: 'spark' },
  shaman:  { name: 'Shaman',  r: 14, hp: 24,  spd: 60,  dmg: 4,  color: '#4ad6c0', gems: 3, shy: true },
  spark:   { name: 'Spark',   r: 7,  hp: 5,   spd: 155, dmg: 3,  color: '#ffc2ea', gems: 1 },
  // Counter-enemies — used sparingly to punish specific player habits.
  goblin:  { name: 'Gold Goblin', r: 11, hp: 16, spd: 122, dmg: 0,  color: '#ffd454', gems: 1,  flee: true },
  leech:   { name: 'Leech',   r: 12, hp: 28,  spd: 96,  dmg: 5,  color: '#7be0c0', gems: 2,  drainShield: true },
  warden:  { name: 'Warden',  r: 20, hp: 95,  spd: 40,  dmg: 8,  color: '#8fa8ff', gems: 3,  warden: true },
  mirror:  { name: 'Mirror Imp', r: 13, hp: 30, spd: 80, dmg: 6,  color: '#cfe2ff', gems: 2,  mirror: true },
  nuller:  { name: 'Null Mage', r: 14, hp: 30, spd: 58,  dmg: 4,  color: '#b08aff', gems: 3,  shy: true, nuller: true },
  // Bomber rushes in and detonates a blast at close range (and when killed).
  bomber:  { name: 'Bomber',   r: 15, hp: 24,  spd: 104, dmg: 16, color: '#ff7a3c', gems: 2,  bomber: true, blastR: 120, fuse: 0.8 },
  // Hexer is a fragile back-line caster — keeps its distance and lobs hex bolts.
  caster:  { name: 'Hexer',    r: 13, hp: 28,  spd: 52,  dmg: 4,  color: '#c77bff', gems: 3,  shy: true,
             ranged: { range: 330, cd: 1.55, projSpd: 205, dmg: 7 } },
  elite:   { name: 'Elite',   r: 32, hp: 260, spd: 112,  dmg: 20, color: '#ff5577', gems: 15, elite: true },
  boss:    { name: 'Archlich',r: 46, hp: 2200, spd: 70,  dmg: 26, color: '#aa66ff', gems: 60, boss: true,
             ranged: { range: 9999, cd: 2.45, projSpd: 190, dmg: 10 } },
};

// Which enemies appear from which wave, with spawn weights.
function getWavePool(wave) {
  const pool = [['blob', 10]];
  if (wave >= 2)  pool.push(['bat', 5 + wave * 0.55]);
  if (wave >= 5)  pool.push(['yellowbat', 2 + wave * 0.35]);
  if (wave >= 9)  pool.push(['redbat', 1.5 + wave * 0.25]);
  // Shooters ramp hard in later waves: spitters get much more common past wave 10,
  // and Hexers join the back line from wave 13 so the arena fills with projectiles.
  if (wave >= 4)  pool.push(['spitter', 3 + wave * 0.7 + Math.max(0, wave - 10) * 0.7]);
  if (wave >= 13) pool.push(['caster', 3 + (wave - 13) * 0.8]);
  if (wave >= 6)  pool.push(['brute', 2 + wave * 0.6]);
  if (wave >= 7)  pool.push(['shaman', 1.5 + wave * 0.2]);
  if (wave >= 7)  pool.push(['bomber', 2 + wave * 0.3]);
  if (wave >= 8)  pool.push(['imp', 3 + wave * 0.4]);
  // counter-enemies appear rarely, as occasional "moments"
  if (wave >= 4)  pool.push(['goblin', 1.2]);
  if (wave >= 6)  pool.push(['leech', 1.5]);
  if (wave >= 9)  pool.push(['warden', 1.4]);
  if (wave >= 11) pool.push(['mirror', 1.4]);
  if (wave >= 12) pool.push(['nuller', 1.3]);
  return pool;
}
