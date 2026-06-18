'use strict';

// ===========================================================================
// Enemy spawning, wave director & enemy AI (abilities, movement)
// ===========================================================================

// ---------------------------------------------------------------------------
// Enemies & waves
// ---------------------------------------------------------------------------
// Milestone waves: horde waves swarm you, boss waves end when every boss dies.
// Past wave 20 (endless mode) the milestones repeat on a 5-wave cycle.
const BOSS_WAVES = { 10: 1, 15: 1, 20: 2 };
const HORDE_WAVES = [5, 15];
const ELITE_WAVES = [8, 17];

function bossCountForWave(w) {
  if (BOSS_WAVES[w]) return BOSS_WAVES[w];
  if (w > 20 && w % 5 === 0) return Math.min(4, 2 + Math.floor((w - 25) / 10));
  return 0;
}
const isHordeWave = w => HORDE_WAVES.includes(w) || (w > 20 && w % 5 === 3);
const isEliteWave = w => ELITE_WAVES.includes(w) || (w > 20 && w % 5 === 1);

// Authored enemy-combo waves: hand-picked enemy pairings that synergise, so a
// random spawner still produces waves that feel deliberately designed. Each combo
// replaces the normal pool for that wave and announces itself.
const COMBOS = {
  healer:     { name: 'Healer Pack',    color: '#4ad6c0', pool: [['shaman', 5], ['brute', 6], ['blob', 2]] },
  blink:      { name: 'Blink Swarm',    color: '#ff8ad0', pool: [['imp', 6], ['spark', 7], ['bat', 3]] },
  siege:      { name: 'Siege Line',     color: '#8fa8ff', pool: [['spitter', 6], ['warden', 3], ['caster', 3]] },
  antishield: { name: 'Anti-Shield Wave', color: '#b08aff', pool: [['leech', 5], ['nuller', 4], ['bat', 3]] },
  treasure:   { name: 'Treasure Panic', color: '#ffd454', pool: [['goblin', 5], ['bat', 7], ['blob', 2]], hazardMult: 0.5 },
};
// Fixed combo assignments (only on non-milestone waves). Endless cycles them.
const COMBO_WAVES = { 6: 'treasure', 7: 'healer', 9: 'siege', 11: 'blink', 13: 'antishield' };
const COMBO_CYCLE = ['healer', 'blink', 'siege', 'antishield', 'treasure'];
function comboForWave(w) {
  if (bossCountForWave(w) || isHordeWave(w) || isEliteWave(w)) return null;
  if (COMBO_WAVES[w]) return COMBO_WAVES[w];
  if (w > 20 && w % 5 === 2) return COMBO_CYCLE[Math.floor((w - 22) / 5) % COMBO_CYCLE.length];
  return null;
}

function waveScale(wave) {
  // Wave 1 uses authored base stats (Green Ghost: 5 HP / 3 damage).
  // HP starts a little softer for the first shops, then curves harder in
  // longer runs so mature builds do not outscale enemy health as quickly.
  const w = wave - 1;
  return {
    hp: Math.pow(1.105, w) * (1 + 0.006 * w * w),
    dmg: 1 + 0.055 * w + 0.0016 * w * w,
    spd: (1 + 0.018 * w + 0.0014 * w * w) * 0.95,
  };
}

function spawnEnemy(type, x, y, opts) {
  opts = opts || {};
  const def = ENEMY_TYPES[type];
  const sc = waveScale(game.wave);
  const dangerHp = Math.max(1, game.danger || 0);
  const dangerDmg = Math.max(1, (game.danger || 0) / 2);
  const e = {
    type, name: def.name, r: def.r,
    x, y,
    hp: Math.round(def.hp * sc.hp * dangerHp * (game.debtHpMult || 1)), maxHp: Math.round(def.hp * sc.hp * dangerHp * (game.debtHpMult || 1)),
    spd: def.spd * sc.spd * (game.debtSpdMult || 1), dmg: def.dmg * sc.dmg * dangerDmg,
    color: def.color, gems: def.gems,
    ranged: def.ranged ? { ...def.ranged, t: rand(0.5, def.ranged.cd) } : null,
    splitsInto: def.splitsInto || null,
    elite: !!def.elite, boss: !!def.boss, shy: !!def.shy,
    flee: !!def.flee, drainShield: !!def.drainShield, warden: !!def.warden,
    mirror: !!def.mirror, nuller: !!def.nuller,
    bomber: !!def.bomber, blastR: def.blastR || 0, fuse: def.fuse || 0,
    reflect: 0, fleeT: def.flee ? 13 : 0,
    variant: opts.variant || null,
    slowT: 0, slowAmt: 0, kx: 0, ky: 0, flash: 0, attackCd: 0, orbCd: 0,
    abilityT: rand(2, 4.5), summonT: rand(5, 8), phase: 1,
    windup: 0, pending: null, charging: 0, chargeX: 0, chargeY: 0, chargeSpd: 0,
    wobble: rand(0, Math.PI * 2),
    dead: false,
  };
  // the 'charger' twin trades its radial bursts for melee pressure
  if (e.boss && e.variant === 'charger') e.ranged = null;
  // Bats should threaten charges earlier than other ability users.
  if (type === 'bat' || type === 'yellowbat' || type === 'redbat') e.abilityT = rand(1, 2.5);
  // Danger 10: the Archlich rises pre-shielded.
  if (e.boss && game.danger >= 10) { e.eshield = Math.round(e.maxHp * 0.4); }
  game.enemies.push(e);
}

function queueSpawn(type, opts) {
  const p = game.player;
  let x, y;
  for (let i = 0; i < 12; i++) {
    x = rand(WALL + 40, W - WALL - 40);
    y = rand(WALL + 40, H - WALL - 40);
    if (dist2(x, y, p.x, p.y) > 260 * 260) break;
  }
  game.spawns.push({ x, y, type, t: 0, delay: 0.8, variant: opts && opts.variant });
}

function updateSpawning(dt) {
  const wave = game.wave;
  const bossCount = bossCountForWave(wave);
  const horde = isHordeWave(wave);

  // telegraphed spawns materialize
  for (const s of game.spawns) {
    s.t += dt;
    if (s.t >= s.delay) spawnEnemy(s.type, s.x, s.y, { variant: s.variant });
  }
  game.spawns = game.spawns.filter(s => s.t < s.delay);

  if (bossCount && !game.bossSpawned && game.waveTime > 1) {
    game.bossSpawned = true;
    // twin bosses get distinct identities: one bullets/summons, one charges/zones
    for (let i = 0; i < bossCount; i++) {
      queueSpawn('boss', { variant: bossCount > 1 ? (i % 2 === 0 ? 'bullets' : 'charger') : null });
    }
    addText(W / 2, H / 2 - 80,
      bossCount > 1 ? 'THE ARCHLICH TWINS AWAKEN' : 'THE ARCHLICH AWAKENS', '#aa66ff', 30);
  }

  // elite minibosses arrive at the START of the round (within the first ~10s)
  if (isEliteWave(wave) && !game.eliteSpawned && game.waveTime > 1.5) {
    game.eliteSpawned = true;
    queueSpawn('elite');
    addText(W / 2, H / 2 - 80, 'AN ELITE APPEARS!', '#ff5577', 26);
  } else if (!bossCount && game.danger >= 1 && !game.dangerEliteDone && game.waveTime > 6 &&
             Math.random() < dt * 0.05) {
    game.dangerEliteDone = true;
    queueSpawn('elite');
    addText(W / 2, H / 2 - 80, 'A ROGUE ELITE STALKS YOU!', '#ff5577', 24);
  }

  game.spawnTimer -= dt;
  let interval = Math.max(0.35, 1.35 - wave * 0.045);
  let maxAlive = 10 + wave * 2;
  let batch = 1 + Math.floor(wave / 6);
  if (horde) {
    // swarm pacing: way more, way faster
    interval *= 0.4;
    maxAlive = Math.round(maxAlive * 2.2);
    batch += 2;
  } else if (bossCount) {
    // boss-only waves: slow trickle of adds
    interval = 3.2;
    maxAlive = 14;
  }
  // wave modifiers reshape the spawn rate / cap
  interval /= (game.modSpawnMult || 1);
  maxAlive = Math.round(maxAlive * (game.modSpawnMult || 1));
  // pressure ramps up the longer the wave runs
  const prog = game.waveDur === Infinity
    ? clamp(game.waveTime / 45, 0, 1)
    : clamp(game.waveTime / game.waveDur, 0, 1);
  interval *= 1 - 0.45 * prog;
  maxAlive = Math.round(maxAlive * (1 + 0.7 * prog));
  if (prog > 0.5) batch += 1;

  if (game.spawnTimer <= 0 && liveEnemies().length + game.spawns.length < maxAlive) {
    game.spawnTimer = interval;
    let pool = getWavePool(bossCount ? Math.max(wave, 12) : wave);
    // Authored combo waves replace the pool with a synergistic enemy mix
    const combo = comboForWave(wave);
    if (combo && COMBOS[combo]) pool = COMBOS[combo].pool;
    // Swarm Nest modifier floods the arena with bats and sparks (overrides combos)
    if (game.modSwarm) pool = [['bat', 6], ['yellowbat', 3], ['redbat', 2], ['spark', 6], ['blob', 2]];
    for (let i = 0; i < batch; i++) queueSpawn(weightedPick(pool));
  }
}

// Schedules an ability when its timer runs out (wind-up phase, or instant effect).
function startEnemyAbility(e, p, d) {
  switch (e.type) {
    case 'bat': // purple bat: straight charge after a 1s lane indicator
      if (d > 70 && d < 505) {
        e.windup = 1.0; e.pending = 'batStraight';
        e.chargeX = (p.x - e.x) / d; e.chargeY = (p.y - e.y) / d;
        e.chargeTele = { type: 'line', color: e.color, x1: e.x, y1: e.y, x2: clamp(e.x + e.chargeX * 560, WALL + 20, W - WALL - 20), y2: clamp(e.y + e.chargeY * 560, WALL + 20, H - WALL - 20), t: e.windup };
      }
      else e.abilityT = 0.55;
      break;
    case 'yellowbat': { // yellow bat: zig-zag charge after a 1s path indicator
      if (d > 80 && d < 560) {
        e.windup = 1.0; e.pending = 'batZigzag';
        e.chargeX = (p.x - e.x) / d; e.chargeY = (p.y - e.y) / d;
        const px = -e.chargeY, py = e.chargeX;
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const along = i * 83;
          const side = (i % 2 === 0 ? -1 : 1) * 45;
          pts.push({
            x: clamp(e.x + e.chargeX * along + px * side, WALL + 20, W - WALL - 20),
            y: clamp(e.y + e.chargeY * along + py * side, WALL + 20, H - WALL - 20),
          });
        }
        pts[0] = { x: e.x, y: e.y };
        e.chargeTele = { type: 'zigzag', color: e.color, points: pts, t: e.windup };
      } else e.abilityT = 0.55;
      break;
    }
    case 'redbat': { // red bat: circular charge after a 1s ring indicator
      if (d > 80 && d < 610) {
        e.windup = 1.0; e.pending = 'batCircle';
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        e.chargeCX = p.x; e.chargeCY = p.y; e.chargeRadius = clamp(d, 125, 200);
        e.chargeDir = Math.random() < 0.5 ? -1 : 1;
        e.chargeTele = { type: 'circle', color: e.color, x: p.x, y: p.y, r: e.chargeRadius, a, dir: e.chargeDir, t: e.windup };
      } else e.abilityT = 0.55;
      break;
    }
    case 'brute': { // wind up, then charge in a straight line
      if (d > 90 && d < 460) {
        e.windup = 0.7; e.pending = 'charge';
        e.chargeX = (p.x - e.x) / d; e.chargeY = (p.y - e.y) / d;
        e.chargeTele = { x1: e.x, y1: e.y, x2: clamp(e.x + e.chargeX * 520, WALL + 20, W - WALL - 20), y2: clamp(e.y + e.chargeY * 520, WALL + 20, H - WALL - 20), t: e.windup };
      } else e.abilityT = 1;
      break;
    }
    case 'imp': { // blink teleport near the player
      burst(e.x, e.y, e.color, 10, 140, 0.4);
      const a = rand(0, Math.PI * 2), r = rand(120, 200);
      e.x = clamp(p.x + Math.cos(a) * r, WALL + e.r, W - WALL - e.r);
      e.y = clamp(p.y + Math.sin(a) * r, WALL + e.r, H - WALL - e.r);
      burst(e.x, e.y, e.color, 10, 140, 0.4);
      sfx('frost');
      e.abilityT = rand(3.5, 5.5);
      break;
    }
    case 'shaman': { // heal pulse for nearby allies
      let healedAny = false;
      for (const ally of game.enemies) {
        if (ally.dead || ally === e || ally.hp >= ally.maxHp) continue;
        if (dist2(e.x, e.y, ally.x, ally.y) <= 150 * 150) {
          const amt = Math.max(3, Math.round(ally.maxHp * 0.08));
          ally.hp = Math.min(ally.maxHp, ally.hp + amt);
          addText(ally.x, ally.y - ally.r - 6, '+' + amt, '#7fe08f', 13);
          healedAny = true;
        }
      }
      if (healedAny) {
        game.novas.push({ x: e.x, y: e.y, t: 0, dur: 0.4, radius: 150, color: '#4ad6c0' });
        sfx('heal');
        e.abilityT = 3.2;
      } else {
        // nobody to heal: hurl a curse zone at the player instead
        game.zones.push({
          x: p.x, y: p.y, radius: 85, t: 0, delay: 0.9,
          dmg: Math.round(e.dmg * 2.5), color: '#4ad6c0',
        });
        e.abilityT = 4;
      }
      break;
    }
    case 'elite': { // a small spellbook of telegraphed attacks to dodge
      const spell = d < 200 ? 'slam' : pick(['barrage', 'runes', 'bolts', 'slam']);
      e.windup = 0.8;
      e.pending = null;
      if (spell === 'slam') {
        game.zones.push({ x: e.x, y: e.y, radius: 150, t: 0, delay: 0.8, dmg: e.dmg * 1.2, color: '#ff5577' });
      } else if (spell === 'barrage') {
        // a line of explosions marching from the elite toward the player
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        for (let i = 1; i <= 3; i++) {
          const dist = d * (i / 3);
          game.zones.push({
            x: clamp(e.x + Math.cos(a) * dist, WALL + 30, W - WALL - 30),
            y: clamp(e.y + Math.sin(a) * dist, WALL + 30, H - WALL - 30),
            radius: 80, t: 0, delay: 0.7 + i * 0.25, dmg: e.dmg, color: '#ff5577',
          });
        }
      } else if (spell === 'runes') {
        // a ring of runes around the player — dodge through the gaps
        const base = rand(0, Math.PI * 2);
        for (let i = 0; i < 5; i++) {
          const a = base + (Math.PI * 2 * i) / 5;
          game.zones.push({
            x: clamp(p.x + Math.cos(a) * 110, WALL + 30, W - WALL - 30),
            y: clamp(p.y + Math.sin(a) * 110, WALL + 30, H - WALL - 30),
            radius: 70, t: 0, delay: 1.0, dmg: e.dmg, color: '#ff5577',
          });
        }
      } else {
        e.pending = 'bolts'; // slow radial burst after the wind-up
      }
      e.abilityT = rand(4, 5.5);
      break;
    }
    case 'boss': {
      // Phase 1 (>70%): charge + slam. Phase 2 (35–70%): curse zones + summons.
      // Phase 3 (<35%): faster, arena-wide storm patterns.
      // Twins: 'charger' favours charge+zones, 'bullets' favours summons+storms.
      const phase = e.phase || 1;
      const likesCharge = e.variant !== 'bullets';
      const likesStorm = e.variant !== 'charger';
      if (Math.random() < 0.32) {
        // the Archlich weaves in spells: an arcane fan or a meteor shower
        e.windup = 0.7; e.pending = null;
        if (Math.random() < 0.5) {
          const a0 = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = -3; i <= 3; i++) {
            const a = a0 + i * 0.16;
            game.enemyProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, dmg: e.dmg * 0.7, r: 7, life: 5, color: '#cc88ff' });
          }
          addText(e.x, e.y - e.r - 20, 'ARCANE FAN', '#cc88ff', 14);
        } else {
          for (let i = 0; i < 6; i++) {
            game.zones.push({ x: clamp(p.x + rand(-170, 170), WALL + 40, W - WALL - 40), y: clamp(p.y + rand(-170, 170), WALL + 40, H - WALL - 40), radius: 70, t: 0, delay: 0.9 + i * 0.16, dmg: e.dmg, color: '#ff6b4a' });
          }
          addText(e.x, e.y - e.r - 20, 'METEOR SHOWER', '#ff6b4a', 14);
        }
        e.abilityT = phase >= 3 ? rand(2, 3.2) : phase >= 2 ? rand(3, 4.5) : rand(4, 6);
      } else if (Math.random() < 0.42) {
        // heavier signature mechanics: a shockwave, a rotating spiral, or seekers
        const r = Math.random();
        if (r < 0.34) {
          // expanding shockwave: concentric rings of zones to weave between
          e.windup = 0.6; e.pending = null;
          for (let ring = 1; ring <= 3; ring++) {
            const n = 8 + ring * 2, rad = 70 * ring;
            for (let i = 0; i < n; i++) {
              const a = (Math.PI * 2 * i) / n + ring * 0.3;
              game.zones.push({
                x: clamp(e.x + Math.cos(a) * rad, WALL + 30, W - WALL - 30),
                y: clamp(e.y + Math.sin(a) * rad, WALL + 30, H - WALL - 30),
                radius: 62, t: 0, delay: 0.5 + ring * 0.45, dmg: e.dmg, color: '#ff66aa',
              });
            }
          }
          addText(e.x, e.y - e.r - 20, 'SHOCKWAVE', '#ff66aa', 14);
        } else if (r < 0.67) {
          // rotating spiral barrage (emitted over ~2s by updateEnemies)
          e.spiral = { left: phase >= 3 ? 2.6 : 2.0, t: 0, ang: rand(0, Math.PI * 2) };
          addText(e.x, e.y - e.r - 20, 'SPIRAL', '#cc88ff', 14);
        } else {
          // homing seeker orbs that curve toward the player
          e.windup = 0.5; e.pending = null;
          const count = phase >= 2 ? 5 : 3;
          for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 * i) / count;
            game.enemyProjectiles.push({
              x: e.x + Math.cos(a) * 34, y: e.y + Math.sin(a) * 34,
              vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
              dmg: Math.round(e.dmg * 0.6), r: 9, life: 6, color: '#ff88dd', homing: 2.6,
            });
          }
          addText(e.x, e.y - e.r - 20, 'SEEKERS', '#ff88dd', 14);
        }
        e.abilityT = phase >= 3 ? rand(2, 3.2) : phase >= 2 ? rand(3, 4.5) : rand(4, 6);
      } else if (phase >= 3 && likesStorm && Math.random() < 0.6) {
        // arena storm: a scatter of delayed zones
        e.windup = 0.7; e.pending = null;
        for (let i = 0; i < 5; i++) {
          game.zones.push({
            x: rand(WALL + 60, W - WALL - 60), y: rand(WALL + 60, H - WALL - 60),
            radius: 90, t: 0, delay: 0.8 + rand(0, 0.6), dmg: e.dmg * 1.2, color: '#aa66ff',
          });
        }
      } else if (likesCharge && e.nextMove !== 'slam' && d > 120) {
        e.windup = 0.9; e.pending = 'charge';
        e.chargeX = (p.x - e.x) / d; e.chargeY = (p.y - e.y) / d;
        e.chargeTele = { x1: e.x, y1: e.y, x2: clamp(e.x + e.chargeX * 520, WALL + 20, W - WALL - 20), y2: clamp(e.y + e.chargeY * 520, WALL + 20, H - WALL - 20), t: e.windup };
        e.nextMove = 'slam';
      } else {
        e.windup = 0.9; e.pending = null;
        game.zones.push({ x: p.x, y: p.y, radius: 170, t: 0, delay: 0.9, dmg: e.dmg * 1.3, color: '#aa66ff' });
        if (phase >= 2) // a second creeping curse zone
          game.zones.push({ x: p.x + rand(-120, 120), y: p.y + rand(-120, 120), radius: 110, t: 0, delay: 1.1, dmg: e.dmg, color: '#aa66ff' });
        e.nextMove = 'charge';
      }
      // later phases attack faster
      e.abilityT = phase >= 3 ? rand(2, 3.2) : phase >= 2 ? rand(3, 4.5) : rand(4, 6);
      break;
    }
    case 'warden': { // raise a temporary ward that blocks the player's path
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      game.walls.push({ x: clamp(p.x + Math.cos(a) * 60, WALL + 50, W - WALL - 50),
        y: clamp(p.y + Math.sin(a) * 60, WALL + 50, H - WALL - 50),
        r: 46, t: 0, dur: 4.5 });
      addText(e.x, e.y - e.r - 16, 'WARD!', '#8fa8ff', 15);
      e.abilityT = rand(5, 7);
      break;
    }
    case 'mirror': // brief reflective shell — projectiles bounce back
      e.windup = 0.5; e.pending = null; e.reflect = 1.2;
      e.abilityT = rand(4, 6);
      break;
    case 'nuller': { // silence the player's nearest auto-cast spell
      const auto = game.player.spells.filter(s => s.auto !== false && s.id !== 'orbs' && !(s.disabled > 0));
      if (auto.length) {
        const sp = pick(auto);
        sp.disabled = 4;
        addText(p.x, p.y - 50, `${SPELLS[sp.id].name} silenced!`, '#b08aff', 16);
        game.beams.push({ pts: [{ x: e.x, y: e.y }, { x: p.x, y: p.y }], t: 0, dur: 0.3, color: '#b08aff', width: 3 });
      }
      e.abilityT = rand(5, 7);
      break;
    }
    case 'bomber': // detonation is driven by proximity, not the ability timer
      e.abilityT = 1;
      break;
    default:
      e.abilityT = rand(3, 5); // blobs, sparks, goblins just move
  }
}

// Fires when a wind-up finishes.
function triggerEnemyAbility(e, p, d) {
  if (e.pending === 'lunge') {
    e.kx = (p.x - e.x) / d * 460;
    e.ky = (p.y - e.y) / d * 460;
    e.abilityT = rand(3, 4.5);
  } else if (e.pending === 'batStraight' || e.pending === 'batZigzag' || e.pending === 'batCircle') {
    e.charging = e.pending === 'batCircle' ? 1.1 : e.pending === 'batZigzag' ? 0.75 : 0.5;
    e.chargeMode = e.pending;
    e.chargeElapsed = 0;
    e.chargeSpd = e.pending === 'batCircle' ? 560 : e.pending === 'batZigzag' ? 625 : 720;
    e.abilityT = rand(2.25, 3.4);
  } else if (e.pending === 'charge') {
    e.charging = 0.55;
    e.chargeSpd = Math.max(320, e.spd * 5);
    if (e.boss) sfx('boom');
  } else if (e.pending === 'bolts') {
    // slow, dodgeable radial burst
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rand(-0.05, 0.05);
      game.enemyProjectiles.push({
        x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130,
        dmg: e.dmg * 0.8, r: 6, life: 6, color: '#ff5577',
      });
    }
    sfx('zap');
  } else if (e.pending === 'detonate') {
    // the queued blast zone (pushed when the fuse lit) handles the damage & boom;
    // the bomber just pops in a shower of sparks.
    burst(e.x, e.y, e.color, 24, 240, 0.45);
    e.dead = true;
  }
  e.pending = null;
}

function updateEnemies(dt) {
  for (const e of game.enemies) {
    if (e.dead) continue;
    const p = nearestPlayer(e.x, e.y) || game.player; // chase/attack the closest body (co-op)
    e.flash = Math.max(0, e.flash - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    e.orbCd = Math.max(0, (e.orbCd || 0) - dt);
    e.slowT = Math.max(0, e.slowT - dt);
    if (e.slowT === 0) e.slowAmt = 0;
    e.reflect = Math.max(0, (e.reflect || 0) - dt);
    e.wobble += dt * 6;

    // Gold Goblin flees the arena if you can't catch it (no reward)
    if (e.flee) {
      e.fleeT -= dt;
      if (e.fleeT <= 0) { e.dead = true; burst(e.x, e.y, e.color, 10, 160, 0.4); addText(e.x, e.y - e.r - 10, 'escaped!', '#ffd454', 14); continue; }
    }

    const slowFactor = 1 - (e.slowAmt || 0);
    const d = Math.max(1, Math.hypot(p.x - e.x, p.y - e.y));

    // Bomber: once you get within range it plants and lights a fuse, then the
    // telegraphed blast zone detonates. It roots while fusing (windup).
    if (e.bomber && !e.detonating && e.windup <= 0 && d < e.blastR) {
      e.detonating = true;
      e.windup = e.fuse || 0.75; e.pending = 'detonate';
      game.zones.push({ x: e.x, y: e.y, radius: e.blastR, t: 0, delay: e.fuse || 0.75, dmg: e.dmg, color: '#ff7a3c' });
      addText(e.x, e.y - e.r - 12, 'FUSE!', '#ff7a3c', 14);
      sfx('zap');
    }

    // ability state machine
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) triggerEnemyAbility(e, p, d);
    } else if (e.charging > 0) {
      e.charging -= dt;
      if (e.charging <= 0) {
        e.chargeMode = null;
        e.abilityT = e.type === 'bat' || e.type === 'yellowbat' || e.type === 'redbat' ? rand(2.25, 3.4) : e.boss ? rand(3, 4.5) : rand(5, 7);
      }
    } else {
      e.abilityT -= dt;
      if (e.abilityT <= 0) startEnemyAbility(e, p, d);
    }

    // bosses advance through phases as their HP drops
    if (e.boss) {
      const frac = e.hp / e.maxHp;
      const ph = frac > 0.7 ? 1 : frac > 0.35 ? 2 : 3;
      if (ph !== e.phase) {
        e.phase = ph;
        game.shake = Math.max(game.shake, 10);
        addText(e.x, e.y - e.r - 24, ph === 3 ? 'ENRAGED!' : 'PHASE ' + ph, '#aa66ff', 18);
      }
    }

    // elites and the boss summon reinforcements
    if (e.elite || e.boss) {
      e.summonT -= dt;
      if (e.summonT <= 0) {
        // phase 2+ bosses summon faster, especially the 'bullets' twin
        e.summonT = e.boss ? (e.phase >= 2 ? 5 : 8) * (e.variant === 'bullets' ? 0.7 : 1) : 11;
        const type = e.boss ? 'imp' : 'blob';
        const count = e.boss ? 3 : 2;
        for (let i = 0; i < count; i++) {
          game.spawns.push({
            x: clamp(e.x + rand(-90, 90), WALL + 40, W - WALL - 40),
            y: clamp(e.y + rand(-90, 90), WALL + 40, H - WALL - 40),
            type, t: 0, delay: 0.8,
          });
        }
        addText(e.x, e.y - e.r - 20, 'SUMMON!', e.boss ? '#aa66ff' : '#ff5577', 16);
      }
    }

    // boss spiral barrage: a rotating fan of bolts emitted over a short window
    if (e.spiral) {
      e.spiral.left -= dt; e.spiral.t -= dt;
      if (e.spiral.t <= 0) {
        e.spiral.t = 0.1;
        e.spiral.ang += 0.42;
        for (let k = 0; k < 3; k++) {
          const a = e.spiral.ang + k * (Math.PI * 2 / 3);
          game.enemyProjectiles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175,
            dmg: Math.round(e.dmg * 0.5), r: 6, life: 5, color: '#cc88ff',
          });
        }
        sfx('zap');
      }
      if (e.spiral.left <= 0) e.spiral = null;
    }

    let mx = (p.x - e.x) / d, my = (p.y - e.y) / d;
    let spd = e.spd;
    let packCount = 0;
    for (const ally of game.enemies) if (!ally.dead && dist2(e.x, e.y, ally.x, ally.y) <= 115 * 115) packCount++;
    e.bloodhungry = packCount > 5;
    e.packCount = packCount;
    if (e.bloodhungry) spd *= 1.15;

    // spitters keep shooting distance, shamans hide behind the horde
    if ((e.ranged && !e.boss && d < e.ranged.range * 0.6) || (e.shy && d < 250)) { mx = -mx; my = -my; }
    if (e.flee) { mx = -mx; my = -my; } // Gold Goblin always runs away
    if (e.windup > 0) { mx = 0; my = 0; } // rooted while winding up
    if (e.charging > 0) {
      e.chargeElapsed = (e.chargeElapsed || 0) + dt;
      if (e.chargeMode === 'batZigzag') {
        const side = Math.sin(e.chargeElapsed * 24) * 0.95;
        mx = e.chargeX - e.chargeY * side;
        my = e.chargeY + e.chargeX * side;
        const mag = Math.max(0.001, Math.hypot(mx, my));
        mx /= mag; my /= mag; spd = e.chargeSpd;
      } else if (e.chargeMode === 'batCircle') {
        const cx = e.chargeCX || p.x, cy = e.chargeCY || p.y;
        const rx = e.x - cx, ry = e.y - cy;
        const rd = Math.max(1, Math.hypot(rx, ry));
        const radial = ((e.chargeRadius || 120) - rd) / Math.max(e.chargeRadius || 120, 1);
        mx = (-ry / rd) * (e.chargeDir || 1) + (rx / rd) * radial * 1.6;
        my = (rx / rd) * (e.chargeDir || 1) + (ry / rd) * radial * 1.6;
        const mag = Math.max(0.001, Math.hypot(mx, my));
        mx /= mag; my /= mag; spd = e.chargeSpd;
      } else {
        mx = e.chargeX; my = e.chargeY; spd = e.chargeSpd;
      }
    }

    const oldX = e.x, oldY = e.y;
    e.x += (mx * spd * slowFactor + e.kx) * dt;
    e.y += (my * spd * slowFactor + e.ky) * dt;
    e.kx *= Math.pow(0.02, dt); // knockback decay
    e.ky *= Math.pow(0.02, dt);
    e.x = clamp(e.x, WALL + e.r, W - WALL - e.r);
    e.y = clamp(e.y, WALL + e.r, H - WALL - e.r);
    e.vx = (e.x - oldX) / Math.max(dt, 0.0001);
    e.vy = (e.y - oldY) / Math.max(dt, 0.0001);

    // Lightweight movement particles give the procedural enemy assets a real
    // animated footprint without requiring external sprite sheets.
    if (!game.opt.lowFx && Math.hypot(e.vx, e.vy) > 25 && Math.random() < dt * (e.boss ? 18 : e.elite ? 12 : 7)) {
      const back = Math.atan2(-e.vy, -e.vx) + rand(-0.55, 0.55);
      game.particles.push({
        x: e.x + Math.cos(back) * e.r * 0.65,
        y: e.y + Math.sin(back) * e.r * 0.65,
        vx: Math.cos(back) * rand(10, 55),
        vy: Math.sin(back) * rand(10, 55),
        t: 0, dur: rand(0.18, 0.42), color: e.color, r: rand(1.2, Math.max(2, e.r * 0.16)),
      });
    }

    // ranged attack
    if (e.ranged) {
      e.ranged.t -= dt;
      if (e.ranged.t <= 0 && d < e.ranged.range) {
        e.ranged.t = e.ranged.cd;
        if (e.boss) {
          // radial burst
          const n = 14;
          for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 * i) / n + rand(-0.1, 0.1);
            game.enemyProjectiles.push({
              x: e.x, y: e.y, vx: Math.cos(a) * e.ranged.projSpd, vy: Math.sin(a) * e.ranged.projSpd,
              dmg: e.ranged.dmg, r: 7, life: 5, color: '#cc88ff',
            });
          }
          sfx('zap');
        } else {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          // veteran spitters fire a three-shot spread
          const spread = game.wave >= 8 ? [-0.34, 0, 0.34] : [-0.18, 0, 0.18];
          for (const off of spread) {
            game.enemyProjectiles.push({
              x: e.x, y: e.y, vx: Math.cos(a + off) * e.ranged.projSpd, vy: Math.sin(a + off) * e.ranged.projSpd,
              dmg: e.ranged.dmg, r: 5, life: 4, color: '#ffe96b',
            });
          }
        }
      }
    }

    // contact damage (goblins deal none — they only flee)
    if (e.dmg > 0 && e.attackCd <= 0 && d < e.r + p.r + 2) {
      // Leech feeds on your shield first, punishing shield-stacking
      if (e.drainShield && p.shield > 0) {
        const steal = Math.min(p.shield, 10 + game.wave);
        p.shield -= steal;
        e.hp = Math.min(e.maxHp, e.hp + steal);
        addText(p.x, p.y - p.r - 12, '-' + steal + '🛡', '#7be0c0', 14);
        p.invuln = 0.35;
      } else {
        damagePlayer(e.dmg, e.name, p);
      }
      e.attackCd = 0.9;
      const kd = Math.max(1, d);
      e.kx -= (p.x - e.x) / kd * 120;
      e.ky -= (p.y - e.y) / kd * 120;
    }
  }
  game.enemies = game.enemies.filter(e => !e.dead);
}
