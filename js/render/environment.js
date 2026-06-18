'use strict';

// ===========================================================================
// Arena background (gradient/dust/runes) + element structures + world spawns
// ===========================================================================

// Per-realm decoration pools, generated once.
const bgFlakes  = Array.from({ length: 80 }, () => ({ x: rand(WALL, W - WALL), y: rand(WALL, H - WALL), r: rand(1.2, 3.2), sp: rand(20, 55), sway: rand(8, 22), ph: rand(0, Math.PI * 2) }));
const bgEmbers  = Array.from({ length: 50 }, () => ({ x: rand(WALL, W - WALL), y: rand(WALL, H - WALL), r: rand(1, 2.6), sp: rand(28, 70), ph: rand(0, Math.PI * 2) }));
const bgMotes   = Array.from({ length: 60 }, () => ({ x: rand(WALL, W - WALL), y: rand(WALL, H - WALL), r: rand(1, 2.4), sp: rand(10, 26), ph: rand(0, Math.PI * 2) }));
const bgSnow    = Array.from({ length: 46 }, () => ({ x: rand(WALL + 20, W - WALL - 20), y: rand(WALL + 20, H - WALL - 20), r: rand(14, 34) }));
const bgPebbles = Array.from({ length: 34 }, () => ({ x: rand(WALL + 20, W - WALL - 20), y: rand(WALL + 20, H - WALL - 20), r: rand(2.5, 6), c: pick(['#7a6038', '#8a6e44', '#5e4a2a']) }));
const bgGrass   = Array.from({ length: 90 }, () => ({ x: rand(WALL + 10, W - WALL - 10), y: rand(WALL + 10, H - WALL - 10), h: rand(8, 18), lean: rand(-3, 3), c: pick(['#3f8a4a', '#4f9e54', '#357a40']) }));
const bgTrees   = Array.from({ length: 18 }, () => ({ x: rand(WALL + 30, W - WALL - 30), y: rand(WALL + 30, H - WALL - 30), s: rand(0.7, 1.25), ph: rand(0, Math.PI * 2), c: pick(['#2f7a3a', '#3f8a4a', '#286833']) }));
const bgRoots   = Array.from({ length: 24 }, () => ({ x: rand(WALL + 20, W - WALL - 20), y: rand(WALL + 20, H - WALL - 20), len: rand(28, 72), a: rand(-0.8, 0.8), c: pick(['#5a3f22', '#6a4a28', '#3f3020']) }));


function drawGroundTree(g, x, y, s, leaf, alpha = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.globalAlpha *= alpha;
  g.lineCap = 'round';
  // soft shadow anchors the tree to the floor
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.ellipse(0, 18, 20, 7, 0, 0, Math.PI * 2); g.fill();
  // tapered trunk
  const bark = g.createLinearGradient(-6, -12, 8, 24);
  bark.addColorStop(0, '#8a6137'); bark.addColorStop(1, '#3f2718');
  g.fillStyle = bark;
  g.beginPath();
  g.moveTo(-5, 18); g.quadraticCurveTo(-7, 2, -3, -16);
  g.quadraticCurveTo(1, -20, 5, -16);
  g.quadraticCurveTo(7, 2, 5, 18);
  g.closePath(); g.fill();
  // branches
  g.strokeStyle = '#5a351f'; g.lineWidth = 3;
  for (const [sx, sy, ex, ey] of [[-2,-9,-15,-22],[2,-12,16,-25],[0,-4,13,-10],[-1,0,-14,-7]]) {
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2, sy - 4, ex, ey); g.stroke();
  }
  // clustered leafy canopy rather than one blob
  g.shadowColor = leaf; g.shadowBlur = 8;
  const clumps = [[0,-30,18],[-16,-22,14],[16,-23,15],[-7,-40,13],[10,-39,12],[0,-17,15]];
  for (const [cx, cy, r] of clumps) {
    g.fillStyle = leaf;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.arc(cx - r * 0.25, cy - r * 0.35, r * 0.35, 0, Math.PI * 2); g.fill();
  }
  g.shadowBlur = 0;
  // roots
  g.strokeStyle = 'rgba(74,48,28,0.85)'; g.lineWidth = 2;
  for (const dir of [-1, 1]) {
    g.beginPath(); g.moveTo(dir * 2, 15); g.quadraticCurveTo(dir * 12, 20, dir * 24, 17); g.stroke();
  }
  g.restore();
}


function drawSnowDrift(g, x, y, r, alpha = 1) {
  g.save();
  g.globalAlpha *= alpha;
  const grad = g.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.1, x, y, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.65, 'rgba(230,242,255,0.62)');
  grad.addColorStop(1, 'rgba(170,195,215,0.16)');
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
  g.beginPath(); g.arc(x - r * 0.1, y - r * 0.05, r * 0.55, Math.PI * 1.08, Math.PI * 1.78); g.stroke();
  g.restore();
}

function drawSnowflake(g, x, y, r, rot = 0, alpha = 1) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.globalAlpha *= alpha;
  g.strokeStyle = 'rgba(245,252,255,0.88)';
  g.lineWidth = Math.max(1, r * 0.12);
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const x2 = Math.cos(a) * r, y2 = Math.sin(a) * r;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(x2, y2); g.stroke();
    const bx = Math.cos(a) * r * 0.55, by = Math.sin(a) * r * 0.55;
    for (const side of [-1, 1]) {
      const aa = a + side * Math.PI * 0.78;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(aa) * r * 0.22, by + Math.sin(aa) * r * 0.22); g.stroke();
    }
  }
  g.restore();
}

function drawFireplace(g, flamePulse = 1) {
  g.save();
  // stone hearth
  g.fillStyle = 'rgba(0,0,0,0.24)';
  g.beginPath(); g.ellipse(0, 18, 30, 8, 0, 0, Math.PI * 2); g.fill();
  const stones = [[-22,13,8],[-12,17,7],[0,18,8],[13,17,7],[23,13,8]];
  for (const [x, y, r] of stones) {
    g.fillStyle = '#5a5147'; g.strokeStyle = '#2d261f'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // crossed logs with ember cuts
  g.lineCap = 'round';
  g.strokeStyle = '#6a3d21'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(-18, 11); g.lineTo(18, 4); g.moveTo(-18, 4); g.lineTo(18, 12); g.stroke();
  g.strokeStyle = '#b46a32'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-10, 9); g.lineTo(8, 6); g.moveTo(-8, 5); g.lineTo(11, 10); g.stroke();
  // layered flames
  g.shadowColor = '#ff7a2a'; g.shadowBlur = 18 * flamePulse;
  g.fillStyle = '#ff5a1f';
  g.beginPath();
  g.moveTo(-13, 9); g.quadraticCurveTo(-7, -14 * flamePulse, 0, -24 * flamePulse); g.quadraticCurveTo(10, -10 * flamePulse, 13, 9); g.closePath(); g.fill();
  g.fillStyle = '#ffb347';
  g.beginPath();
  g.moveTo(-7, 10); g.quadraticCurveTo(-2, -8 * flamePulse, 4, -17 * flamePulse); g.quadraticCurveTo(8, -5 * flamePulse, 7, 10); g.closePath(); g.fill();
  g.fillStyle = '#ffe96b';
  g.beginPath(); g.moveTo(-3, 9); g.quadraticCurveTo(1, -4 * flamePulse, 3, 9); g.closePath(); g.fill();
  g.shadowBlur = 0;
  // sparks
  g.fillStyle = 'rgba(255,220,120,0.85)';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-12 + i * 8, -12 - Math.sin(flamePulse + i) * 5, 1.5, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function drawNaturalTerrain(th) {
  const now = performance.now() / 1000;
  const aw = W - WALL * 2, ah = H - WALL * 2;
  const id = th.id;
  ctx.save();
  ctx.beginPath(); ctx.rect(WALL, WALL, aw, ah); ctx.clip();

  if (id === 'forest') {
    ctx.fillStyle = '#102016'; ctx.fillRect(WALL, WALL, aw, ah);
    ctx.globalAlpha = 0.42; ctx.fillStyle = '#183522';
    for (let y = WALL; y < H - WALL; y += 44) {
      ctx.beginPath();
      ctx.moveTo(WALL, y);
      for (let x = WALL; x <= W - WALL; x += 36) ctx.lineTo(x, y + Math.sin(x * 0.018 + y * 0.04) * 7);
      ctx.lineTo(W - WALL, y + 44); ctx.lineTo(WALL, y + 44); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 0.82;
    for (const tr of bgTrees) drawGroundTree(ctx, tr.x, tr.y, tr.s * 0.58, tr.c, 0.45);
    ctx.globalAlpha = 1;
  } else if (id === 'earth') {
    ctx.fillStyle = '#2b2114'; ctx.fillRect(WALL, WALL, aw, ah);
    for (const r of bgRoots) {
      ctx.strokeStyle = r.c; ctx.globalAlpha = 0.32; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(r.x, r.y); ctx.quadraticCurveTo(r.x + Math.cos(r.a) * r.len * 0.45, r.y + Math.sin(r.a) * r.len * 0.2, r.x + Math.cos(r.a) * r.len, r.y + Math.sin(r.a) * r.len * 0.35); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (id === 'ice') {
    const grad = ctx.createLinearGradient(WALL, WALL, W - WALL, H - WALL);
    grad.addColorStop(0, '#c8d6df'); grad.addColorStop(1, '#7f8f9d');
    ctx.fillStyle = grad; ctx.fillRect(WALL, WALL, aw, ah);
    for (const s of bgSnow) drawSnowDrift(ctx, s.x, s.y, s.r, 0.24);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const x = WALL + (i * 83) % aw, y = WALL + (i * 47) % ah; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 50, y + Math.sin(i) * 22); ctx.stroke(); }
  } else if (id === 'fire' || id === 'ember') {
    ctx.fillStyle = '#1a0c08'; ctx.fillRect(WALL, WALL, aw, ah);
    // Soft heat stains only; no angular marks behind the element logo.
    for (let i = 0; i < 14; i++) {
      const x = WALL + ((i * 83 + now * 4) % aw), y = WALL + ((i * 47) % ah);
      const r = 34 + (i % 4) * 10;
      const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
      grad.addColorStop(0, i % 3 ? 'rgba(120,54,28,0.13)' : 'rgba(255,86,34,0.10)');
      grad.addColorStop(1, 'rgba(255,86,34,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (id === 'wind') {
    ctx.fillStyle = '#0b1b1a'; ctx.fillRect(WALL, WALL, aw, ah);
    ctx.strokeStyle = 'rgba(139,224,255,0.13)'; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const y = WALL + i * 46; ctx.beginPath(); ctx.moveTo(WALL, y); ctx.bezierCurveTo(W * 0.28, y - 26, W * 0.58, y + 30, W - WALL, y); ctx.stroke(); }
  } else {
    ctx.fillStyle = th.bg; ctx.fillRect(WALL, WALL, aw, ah);
    ctx.globalAlpha = 0.2; ctx.fillStyle = th.wall;
    for (let i = 0; i < 28; i++) { const x = WALL + (i * 47) % aw, y = WALL + (i * 61) % ah; ctx.beginPath(); ctx.ellipse(x, y, 18, 5, i, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

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
    ctx.globalAlpha = 0.055 + 0.018 * Math.sin(now * 1.5); // pulsing heat wash
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
    // snow lying on the ground as soft layered drifts
    for (const s of bgSnow) drawSnowDrift(ctx, s.x, s.y, s.r, 0.30);
    if (!lowFx) for (const f of bgFlakes) { // falling detailed snowflakes
      const y = WALL + ((f.y - WALL + now * f.sp) % ah + ah) % ah;
      const x = f.x + Math.sin(now * 0.8 + f.ph) * f.sway;
      drawSnowflake(ctx, x, y, f.r * 2.1, now + f.ph, 0.42);
    }
  } else if (id === 'earth') {
    ctx.globalAlpha = 0.045; ctx.fillStyle = '#9a7a44'; ctx.fillRect(WALL, WALL, aw, ah); // dusty wash
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
    ctx.globalAlpha = 0.055; ctx.fillStyle = '#2f7a3a'; ctx.fillRect(WALL, WALL, aw, ah); // green wash
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


function drawElementMapLogo(th, cx, cy, now) {
  const id = th.id;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(now * 0.025);
  ctx.globalAlpha = game.opt.lowFx ? 0.055 : 0.075;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = id === 'earth' ? 'rgba(210,218,210,0.9)' : th.wall;
  ctx.fillStyle = id === 'earth' ? 'rgba(210,218,210,0.18)' : th.wall;
  ctx.lineWidth = 5;

  if (id === 'earth' || id === 'forest') {
    // light gray grass crest for earth/forest maps
    ctx.strokeStyle = 'rgba(212,220,212,0.82)';
    for (let i = -3; i <= 3; i++) {
      const x = i * 18;
      ctx.beginPath();
      ctx.moveTo(x, 70);
      ctx.quadraticCurveTo(x + i * 4, 20, x + Math.sin(i) * 16, -62);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 72, 72, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  } else if (id === 'fire' || id === 'ember') {
    // flame sigil
    ctx.fillStyle = 'rgba(255,110,46,0.20)';
    ctx.strokeStyle = 'rgba(255,170,70,0.72)';
    ctx.beginPath();
    ctx.moveTo(0, 78);
    ctx.quadraticCurveTo(-62, 16, -15, -28);
    ctx.quadraticCurveTo(4, -52, 0, -86);
    ctx.quadraticCurveTo(64, -34, 48, 24);
    ctx.quadraticCurveTo(38, 58, 0, 78);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 52); ctx.quadraticCurveTo(-20, 15, 12, -35); ctx.quadraticCurveTo(28, 5, 0, 52); ctx.stroke();
  } else if (id === 'ice') {
    // snowflake sigil
    ctx.strokeStyle = 'rgba(225,250,255,0.45)';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 88, Math.sin(a) * 88); ctx.stroke();
      const bx = Math.cos(a) * 48, by = Math.sin(a) * 48;
      for (const side of [-1, 1]) {
        const aa = a + side * 0.78;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(aa) * 26, by + Math.sin(aa) * 26); ctx.stroke();
      }
    }
  } else if (id === 'wind') {
    // airy spiral gust
    ctx.strokeStyle = 'rgba(190,235,255,0.72)';
    ctx.beginPath();
    for (let i = 0; i <= 44; i++) {
      const a = i * 0.35;
      const r = 8 + i * 1.9;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.55;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (const y of [-46, 48]) { ctx.beginPath(); ctx.moveTo(-88, y); ctx.bezierCurveTo(-20, y - 24, 28, y + 22, 92, y - 6); ctx.stroke(); }
  } else {
    ctx.globalAlpha = game.opt.lowFx ? 0.045 : 0.065;
    ctx.beginPath(); ctx.arc(0, 0, 88, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -76); ctx.lineTo(66, 38); ctx.lineTo(-66, 38); ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}


// Themed arena backdrop: natural terrain, a single element logo, and realm assets.
function drawBackground() {
  const th = currentTheme();
  ctx.fillStyle = th.bg;
  ctx.fillRect(-30, -30, W + 60, H + 60);
  drawNaturalTerrain(th);

  // soft central glow + darker edges for depth
  const cx = W / 2, cy = H / 2;
  const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, Math.max(W, H) * 0.62);
  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const now = performance.now() / 1000;

  // Keep the map clean: only the element logo overlays the natural terrain.
  drawElementMapLogo(th, cx, cy, now);

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
  if (s.type === 'earth') { // a detailed living tree landmark
    drawGroundTree(g, 0, 0, 0.92, '#3f8a4a', 1);
  } else if (s.type === 'fire') { // stone fireplace / campfire landmark
    const f = 0.72 + Math.sin(performance.now() / 90 + s.ph) * 0.28;
    drawFireplace(g, f);
  } else if (s.type === 'wind') { // a wind cloud with a swirl
    g.fillStyle = 'rgba(190,235,255,0.85)';
    g.beginPath(); g.arc(-12, 2, 12, 0, Math.PI * 2); g.arc(2, -4, 15, 0, Math.PI * 2); g.arc(16, 3, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#bfe8ff'; g.lineWidth = 2;
    const sp = performance.now() / 500 + s.ph;
    g.beginPath();
    for (let i = 0; i <= 16; i++) { const a = sp + i * 0.45; const rr = i * 0.9; const px = Math.cos(a) * rr, py = 14 + Math.sin(a) * rr * 0.5; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  } else { // ice patch — frosty shards on the ground
    g.fillStyle = 'rgba(150,225,255,0.30)';
    g.beginPath();
    g.moveTo(0, -16); g.lineTo(12, -4); g.lineTo(16, 10); g.lineTo(0, 16); g.lineTo(-16, 8); g.lineTo(-13, -6); g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(234,255,255,0.55)'; g.lineWidth = 1.5;
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
  g.fillStyle = ws.kind === 'magnet' ? '#ffd454' : '#b8792f';
  g.beginPath(); g.arc(ws.x, ws.y, ws.r, 0, Math.PI * 2); g.fill();
  g.globalAlpha = ws.active ? 0.9 : 0.55;
  g.strokeStyle = ws.kind === 'magnet' ? '#ffd454' : '#ffd454';
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
    // treasure chest item event
    g.shadowColor = '#ffd454'; g.shadowBlur = ws.active ? 14 : 8;
    g.fillStyle = '#7a431d';
    g.strokeStyle = '#ffd454';
    g.lineWidth = 2;
    g.beginPath(); g.rect(-16, -6, 32, 20); g.fill(); g.stroke();
    g.fillStyle = '#b8792f';
    g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(-13, -14, 0, -14); g.quadraticCurveTo(13, -14, 16, 0); g.closePath(); g.fill(); g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255, 232, 160, 0.85)';
    g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.moveTo(-7, -13); g.lineTo(-7, 14); g.moveTo(7, -13); g.lineTo(7, 14); g.stroke();
    g.fillStyle = '#ffe96b';
    g.fillRect(-4, 1, 8, 7);
    g.strokeStyle = '#5a3218'; g.lineWidth = 1;
    g.strokeRect(-4, 1, 8, 7);
  }
  g.restore();

  // channel progress ring for the mine (hold 3.35s)
  if (ws.kind === 'mine' && ws.prog > 0) {
    g.strokeStyle = '#ffd454'; g.lineWidth = 3;
    g.beginPath(); g.arc(ws.x, ws.y, ws.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(ws.prog / 3.35, 0, 1)); g.stroke();
  }

  // No floating label; icon art communicates the pickup/mine role.
}
