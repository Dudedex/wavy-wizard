'use strict';

// ===========================================================================
// Arena background (gradient/dust/runes) + element structures + world spawns
// ===========================================================================

// Static arcane starfield/dust — generated once, twinkles in render().
const bgStars = (() => {
  const a = [];
  for (let i = 0; i < 110; i++) a.push({ x: rand(WALL, W - WALL), y: rand(WALL, H - WALL), r: rand(0.5, 1.9), ph: rand(0, Math.PI * 2), sp: rand(0.4, 1.6) });
  return a;
})();

// Per-realm decoration pools, generated once.
const bgFlakes  = Array.from({ length: 80 }, () => ({ x: rand(WALL, W - WALL), y: rand(WALL, H - WALL), r: rand(1.2, 3.2), sp: rand(20, 55), sway: rand(8, 22), ph: rand(0, Math.PI * 2) }));
const bgEmbers  = Array.from({ length: 50 }, () => ({ x: rand(WALL, W - WALL), y: rand(WALL, H - WALL), r: rand(1, 2.6), sp: rand(28, 70), ph: rand(0, Math.PI * 2) }));
const bgMotes   = Array.from({ length: 60 }, () => ({ x: rand(WALL, W - WALL), y: rand(WALL, H - WALL), r: rand(1, 2.4), sp: rand(10, 26), ph: rand(0, Math.PI * 2) }));
const bgSnow    = Array.from({ length: 46 }, () => ({ x: rand(WALL + 20, W - WALL - 20), y: rand(WALL + 20, H - WALL - 20), r: rand(14, 34) }));
const bgPebbles = Array.from({ length: 34 }, () => ({ x: rand(WALL + 20, W - WALL - 20), y: rand(WALL + 20, H - WALL - 20), r: rand(2.5, 6), c: pick(['#7a6038', '#8a6e44', '#5e4a2a']) }));
const bgGrass   = Array.from({ length: 90 }, () => ({ x: rand(WALL + 10, W - WALL - 10), y: rand(WALL + 10, H - WALL - 10), h: rand(8, 18), lean: rand(-3, 3), c: pick(['#3f8a4a', '#4f9e54', '#357a40']) }));

// Decorates the arena to match the active realm/theme: hot embers (fire),
// snow drifts + flurries (ice/winter), drifting dust + pebbles (earth),
// grass tufts (forest), airy streaks (wind).
function drawRealmDecor(th) {
  const now = performance.now() / 1000;
  const lowFx = game.opt.lowFx;
  const aw = W - WALL * 2, ah = H - WALL * 2;
  const id = th.id;
  ctx.save();
  if (id === 'fire' || id === 'ember') {
    ctx.globalAlpha = 0.10 + 0.03 * Math.sin(now * 1.5); // pulsing heat wash
    ctx.fillStyle = '#ff5a1e'; ctx.fillRect(WALL, WALL, aw, ah);
    ctx.globalAlpha = 1;
    if (!lowFx) for (const e of bgEmbers) { // rising embers
      const y = WALL + ((e.y - WALL - now * e.sp) % ah + ah) % ah;
      const x = e.x + Math.sin(now * 1.3 + e.ph) * 10;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(now * 3 + e.ph);
      ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ff6b2a'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(x, y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if (id === 'ice') {
    // snow lying on the ground
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#f3f8ff';
    for (const s of bgSnow) { ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (!lowFx) for (const f of bgFlakes) { // falling flurries
      const y = WALL + ((f.y - WALL + now * f.sp) % ah + ah) % ah;
      const x = f.x + Math.sin(now * 0.8 + f.ph) * f.sway;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (id === 'earth') {
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#9a7a44'; ctx.fillRect(WALL, WALL, aw, ah); // dusty wash
    ctx.globalAlpha = 1;
    for (const p of bgPebbles) { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    if (!lowFx) for (const m of bgMotes) { // drifting dust motes
      const x = WALL + ((m.x - WALL + now * m.sp) % aw + aw) % aw;
      const y = m.y + Math.sin(now * 0.6 + m.ph) * 8;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now + m.ph);
      ctx.fillStyle = '#d8c08a'; ctx.beginPath(); ctx.arc(x, y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (id === 'forest') {
    ctx.globalAlpha = 0.10; ctx.fillStyle = '#2f7a3a'; ctx.fillRect(WALL, WALL, aw, ah); // green wash
    ctx.globalAlpha = 0.85; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const g of bgGrass) { // little grass blades swaying
      const sway = Math.sin(now * 1.2 + g.x * 0.03) * 2;
      ctx.strokeStyle = g.c;
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.quadraticCurveTo(g.x + g.lean + sway, g.y - g.h * 0.6, g.x + g.lean * 2 + sway, g.y - g.h); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (id === 'wind') {
    if (!lowFx) { ctx.globalAlpha = 0.16; ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 1.5;
      for (const m of bgMotes) {
        const x = WALL + ((m.x - WALL + now * (m.sp + 50)) % aw + aw) % aw;
        ctx.beginPath(); ctx.moveTo(x, m.y); ctx.lineTo(x + 18, m.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}


function drawRealmDepth(th, now) {
  const aw = W - WALL * 2, ah = H - WALL * 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = game.opt.lowFx ? 0.08 : 0.14;
  ctx.strokeStyle = th.wall;
  ctx.lineWidth = 1.25;
  for (let i = 0; i < 7; i++) {
    const y = WALL + ((i * 97 + now * (10 + i * 3)) % ah);
    ctx.beginPath();
    ctx.moveTo(WALL, y);
    for (let x = WALL; x <= W - WALL; x += 48) {
      ctx.lineTo(x, y + Math.sin(now * 0.8 + i + x * 0.012) * 8);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = game.opt.lowFx ? 0.05 : 0.10;
  ctx.font = '20px serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 10; i++) {
    const x = WALL + ((i * 131 + now * 12) % aw);
    const y = WALL + ((i * 73 + Math.sin(now + i) * 18) % ah);
    ctx.fillText(i % 2 ? '✧' : '◇', x, y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Themed arena backdrop: gradient vignette, twinkling dust, slow arcane runes.
function drawBackground() {
  const th = currentTheme();
  ctx.fillStyle = th.bg;
  ctx.fillRect(-30, -30, W + 60, H + 60);

  // soft central glow + darker edges for depth
  const cx = W / 2, cy = H / 2;
  const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, Math.max(W, H) * 0.62);
  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const now = performance.now() / 1000;

  // twinkling dust (skipped on low-fx)
  if (!game.opt.lowFx) {
    for (const s of bgStars) {
      const tw = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(now * s.sp + s.ph));
      ctx.globalAlpha = tw;
      ctx.fillStyle = th.wall;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  // faint slowly-rotating arcane runes behind the action
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = th.wall;
  ctx.lineWidth = 2;
  ctx.rotate(now * 0.04);
  ctx.beginPath(); ctx.arc(0, 0, 220, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 150, Math.sin(a) * 150);
    ctx.lineTo(Math.cos(a) * 220, Math.sin(a) * 220);
    ctx.stroke();
  }
  ctx.rotate(-now * 0.10);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    ctx[fn](Math.cos(a) * 95, Math.sin(a) * 95);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;

  // grid
  ctx.strokeStyle = th.grid;
  ctx.lineWidth = 1;
  for (let x = WALL; x <= W - WALL; x += 64) { ctx.beginPath(); ctx.moveTo(x, WALL); ctx.lineTo(x, H - WALL); ctx.stroke(); }
  for (let y = WALL; y <= H - WALL; y += 64) { ctx.beginPath(); ctx.moveTo(WALL, y); ctx.lineTo(W - WALL, y); ctx.stroke(); }

  drawRealmDepth(th, now);

  // realm-flavoured decoration (embers, snow, dust, grass, …)
  drawRealmDecor(th);

  // walls
  ctx.strokeStyle = th.wall;
  ctx.lineWidth = 4;
  ctx.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);
}

// Draws an element landmark on the ground + a proximity ring (brighter when active).
function drawStructure(s) {
  const g = ctx;
  const et = ELEMENT_THEMES[s.type];
  const pulse = 0.5 + Math.sin(performance.now() / 400 + s.ph) * 0.5;
  // bonus aura ring
  g.globalAlpha = s.active ? 0.30 + pulse * 0.25 : 0.12;
  g.fillStyle = et.wall;
  g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = s.active ? 0.9 : 0.5;
  g.strokeStyle = et.wall;
  g.lineWidth = s.active ? 3 : 1.5;
  g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;

  g.save();
  g.translate(s.x, s.y);
  if (s.type === 'earth') { // a little tree
    g.fillStyle = '#6a4a28';
    g.fillRect(-4, 0, 8, 20);
    g.fillStyle = '#3f8a4a';
    g.beginPath(); g.arc(0, -8, 18, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(-12, 2, 12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(12, 2, 12, 0, Math.PI * 2); g.fill();
  } else if (s.type === 'fire') { // a campfire
    g.strokeStyle = '#6a4a28'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-12, 16); g.lineTo(12, 10); g.moveTo(-12, 10); g.lineTo(12, 16); g.stroke();
    const f = 0.6 + Math.sin(performance.now() / 90 + s.ph) * 0.4;
    g.fillStyle = '#ff8c2a'; g.shadowColor = '#ff8c2a'; g.shadowBlur = 16 * f;
    g.beginPath(); g.moveTo(-9, 8); g.quadraticCurveTo(-4, -16 * f, 0, -20 * f); g.quadraticCurveTo(4, -16 * f, 9, 8); g.closePath(); g.fill();
    g.fillStyle = '#ffe96b';
    g.beginPath(); g.moveTo(-4, 8); g.quadraticCurveTo(0, -8 * f, 4, 8); g.closePath(); g.fill();
    g.shadowBlur = 0;
  } else if (s.type === 'wind') { // a wind cloud with a swirl
    g.fillStyle = 'rgba(190,235,255,0.85)';
    g.beginPath(); g.arc(-12, 2, 12, 0, Math.PI * 2); g.arc(2, -4, 15, 0, Math.PI * 2); g.arc(16, 3, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#bfe8ff'; g.lineWidth = 2;
    const sp = performance.now() / 500 + s.ph;
    g.beginPath();
    for (let i = 0; i <= 16; i++) { const a = sp + i * 0.45; const rr = i * 0.9; const px = Math.cos(a) * rr, py = 14 + Math.sin(a) * rr * 0.5; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  } else { // ice patch — frosty shards on the ground
    g.fillStyle = 'rgba(150,225,255,0.55)';
    g.beginPath();
    g.moveTo(0, -16); g.lineTo(12, -4); g.lineTo(16, 10); g.lineTo(0, 16); g.lineTo(-16, 8); g.lineTo(-13, -6); g.closePath();
    g.fill();
    g.strokeStyle = '#eaffff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(0, 16); g.moveTo(-16, 8); g.lineTo(16, 10); g.stroke();
  }
  g.restore();

  // bonus glyph floating above
  g.globalAlpha = s.active ? 1 : 0.7;
  g.font = 'bold 13px "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillStyle = et.wall;
  const tag = s.type === 'earth' ? '💚 regen' : s.type === 'fire' ? '🔥 +dmg' : s.type === 'wind' ? '💨 speed' : '❄ slow';
  g.fillText(tag, s.x, s.y - s.r - 6);
  g.globalAlpha = 1;
}


// Draws a Gold Magnet or Item Mine world spawn + its activation state.
function drawWorldSpawn(ws) {
  const g = ctx;
  const pulse = 0.5 + Math.sin(performance.now() / 300 + ws.t) * 0.5;
  // activation circle (small — you must stand right on it)
  g.globalAlpha = ws.active ? 0.35 + pulse * 0.25 : 0.16;
  g.fillStyle = ws.kind === 'magnet' ? '#ffd454' : '#c47bff';
  g.beginPath(); g.arc(ws.x, ws.y, ws.r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = ws.active ? 0.9 : 0.55;
  g.strokeStyle = ws.kind === 'magnet' ? '#ffd454' : '#c47bff';
  g.lineWidth = ws.active ? 3 : 1.5;
  g.beginPath(); g.arc(ws.x, ws.y, ws.r, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;

  g.save();
  g.translate(ws.x, ws.y);
  if (ws.kind === 'magnet') {
    // horseshoe magnet
    g.lineWidth = 7; g.lineCap = 'butt';
    g.strokeStyle = '#d44';
    g.beginPath(); g.arc(0, -2, 9, Math.PI, 0); g.stroke();
    g.strokeStyle = '#d44';
    g.beginPath(); g.moveTo(-9, -2); g.lineTo(-9, 8); g.moveTo(9, -2); g.lineTo(9, 8); g.stroke();
    g.strokeStyle = '#cfe2ff';
    g.beginPath(); g.moveTo(-9, 8); g.lineTo(-9, 12); g.moveTo(9, 8); g.lineTo(9, 12); g.stroke();
    if (ws.active) { // pull field arcs
      g.strokeStyle = `rgba(255,212,84,${0.4 + pulse * 0.4})`; g.lineWidth = 2;
      for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(0, 0, ws.r + k * 12, -0.6, 0.6); g.stroke(); }
    }
  } else {
    // ore/crystal mine node
    g.fillStyle = '#c47bff'; g.shadowColor = '#c47bff'; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(10, -2); g.lineTo(6, 12); g.lineTo(-6, 12); g.lineTo(-10, -2); g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12); g.moveTo(-10, -2); g.lineTo(10, -2); g.stroke();
  }
  g.restore();

  // channel progress ring for the mine (hold 5s)
  if (ws.kind === 'mine' && ws.prog > 0) {
    g.strokeStyle = '#c47bff'; g.lineWidth = 3;
    g.beginPath(); g.arc(ws.x, ws.y, ws.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(ws.prog / 5, 0, 1)); g.stroke();
  }

  // label
  g.globalAlpha = ws.active ? 1 : 0.7;
  g.fillStyle = ws.kind === 'magnet' ? '#ffd454' : '#d9b9ff';
  g.font = 'bold 12px "Segoe UI", sans-serif'; g.textAlign = 'center';
  g.fillText(ws.kind === 'magnet' ? '🧲 gold magnet' : '⛏ item mine', ws.x, ws.y - ws.r - 8);
  g.globalAlpha = 1;
}


