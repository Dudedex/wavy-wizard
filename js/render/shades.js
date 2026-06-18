'use strict';

// ===========================================================================
// Enemy "shades" — distinct little-alien sprites per enemy type
// ===========================================================================


const SHADE_OF = {
  blob: 'ooze', bat: 'flyer', yellowbat: 'flyer', redbat: 'flyer', spitter: 'maw', brute: 'hulk', imp: 'horned',
  shaman: 'mystic', spark: 'mote', goblin: 'grin', leech: 'worm', warden: 'sentinel',
  mirror: 'crystal', nuller: 'void', lazeye: 'crystal', elite: 'ornate', boss: 'overlord',
  bomber: 'bomb', caster: 'void',
};

function alphaColor(col, alpha) {
  if (col[0] === '#' && (col.length === 7 || col.length === 4)) {
    const full = col.length === 4 ? '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3] : col;
    const n = parseInt(full.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return col.startsWith('rgb(') ? col.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`) : col;
}

function drawEnemyAssetParticles(g, e, R, col, faceX) {
  const t = e.wobble || 0;
  const seed = (e.x * 0.017 + e.y * 0.013) || 0;
  const moving = Math.hypot(e.vx || 0, e.vy || 0);
  const drift = moving > 8 ? -faceX : 0;
  const count = e.boss ? 14 : e.elite ? 10 : 5;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const phase = (t * (0.7 + i * 0.09) + seed + i * 1.73) % (Math.PI * 2);
    const orbit = R * (0.7 + (i % 4) * 0.18);
    const x = Math.cos(phase) * orbit * 0.75 + drift * R * (0.25 + (i % 3) * 0.2);
    const y = Math.sin(phase * 1.35) * orbit * 0.42 + R * 0.4;
    const a = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(phase));
    g.fillStyle = alphaColor(col, a);
    g.beginPath(); g.arc(x, y, Math.max(1.2, R * (0.045 + (i % 2) * 0.025)), 0, Math.PI * 2); g.fill();
  }
  g.restore();
}


function drawAssetDetails(g, e, R, col, faceX) {
  const t = e.wobble || 0;
  const bob = Math.sin(t * 1.3) * R * 0.05;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = alphaColor('#ffffff', 0.28);
  g.lineWidth = Math.max(1, R * 0.07);
  if (e.ranged) {
    // pulsating throat/orb for projectile enemies
    g.fillStyle = alphaColor('#fff6a8', 0.35 + 0.25 * Math.sin(t * 2));
    g.beginPath(); g.arc(faceX * R * 0.42, R * 0.18 + bob, R * 0.16, 0, Math.PI * 2); g.fill();
  }
  if (e.flee) {
    // loot satchel for goblins
    g.fillStyle = '#8a5a2e';
    g.beginPath(); g.ellipse(-faceX * R * 0.7, R * 0.45, R * 0.24, R * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd454'; g.fillRect(-faceX * R * 0.78, R * 0.28, R * 0.16, R * 0.1);
  }
  if (e.drainShield) {
    g.strokeStyle = alphaColor('#7be0c0', 0.65);
    for (let i = -1; i <= 1; i += 2) {
      g.beginPath(); g.moveTo(i * R * 0.45, -R * 0.45); g.quadraticCurveTo(i * R * 0.7, bob, i * R * 0.4, R * 0.65); g.stroke();
    }
  }
  if (e.warden) {
    g.strokeStyle = alphaColor('#cfe2ff', 0.75);
    g.beginPath(); g.arc(0, 0, R * (0.72 + 0.05 * Math.sin(t * 2)), 0, Math.PI * 2); g.stroke();
  }
  if (e.mirror) {
    g.fillStyle = alphaColor('#ffffff', 0.45);
    g.beginPath(); g.moveTo(-R * 0.45, -R * 0.55); g.lineTo(-R * 0.1, -R * 0.82); g.lineTo(-R * 0.25, -R * 0.2); g.closePath(); g.fill();
  }
  if (e.nuller) {
    g.strokeStyle = alphaColor('#b08aff', 0.7);
    g.beginPath(); g.arc(0, 0, R * 0.82, t, t + Math.PI * 1.35); g.stroke();
  }
  g.restore();
}

function drawAssetRim(g, R, col) {
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = Math.max(1, R * 0.06);
  g.beginPath(); g.arc(-R * 0.25, -R * 0.25, R * 0.55, Math.PI * 1.08, Math.PI * 1.72); g.stroke();
  g.strokeStyle = col;
}


// Draws a translucent glowing alien shade at the current (scaled) origin.
// R = radius, col = body colour, faceX = -1/1 toward the player.
function drawShade(g, e, R, col, faceX) {
  const style = SHADE_OF[e.type] || 'ooze';
  const fx = faceX * R * 0.12;
  drawEnemyAssetParticles(g, e, R, col, faceX);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // glowing alien eye (dark socket + bright core)
  const eye = (x, y, rx, ry) => {
    g.fillStyle = '#0a0f14';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(195,245,255,0.95)';
    g.beginPath(); g.ellipse(x - rx * 0.25, y - ry * 0.25, rx * 0.5, ry * 0.55, 0, 0, Math.PI * 2); g.fill();
  };
  const body = (drawPath) => {
    g.shadowColor = col; g.shadowBlur = Math.min(16, R * 0.7);
    g.globalAlpha = 0.92;
    g.fillStyle = col;
    drawPath();
    g.fill();
    g.shadowBlur = 0; g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    g.stroke();
  };

  switch (style) {
    case 'ooze': { // round drippy blob, two big eyes, antenna
      body(() => {
        g.beginPath();
        g.moveTo(-R, R * 0.1);
        g.quadraticCurveTo(-R, -R, 0, -R);
        g.quadraticCurveTo(R, -R, R, R * 0.1);
        g.quadraticCurveTo(R, R * 0.95, R * 0.5, R * 0.78);
        g.quadraticCurveTo(R * 0.25, R * 1.05, 0, R * 0.8);
        g.quadraticCurveTo(-R * 0.25, R * 1.05, -R * 0.5, R * 0.78);
        g.quadraticCurveTo(-R, R * 0.95, -R, R * 0.1);
        g.closePath();
      });
      g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -R); g.lineTo(R * 0.18, -R * 1.45); g.stroke();
      g.fillStyle = col; g.beginPath(); g.arc(R * 0.18, -R * 1.5, R * 0.13, 0, 7); g.fill();
      eye(-R * 0.34 + fx, -R * 0.12, R * 0.22, R * 0.3);
      eye(R * 0.34 + fx, -R * 0.12, R * 0.22, R * 0.3);
      break;
    }
    case 'flyer': { // small body + two flapping wings + one eye
      const flap = Math.sin(e.wobble * 2) * R * 0.5;
      body(() => {
        g.beginPath();
        g.moveTo(0, -R * 0.4);
        g.quadraticCurveTo(-R * 1.5, -R * 0.2 - flap, -R * 1.7, R * 0.3 - flap * 0.4);
        g.quadraticCurveTo(-R * 0.7, R * 0.1, -R * 0.4, R * 0.5);
        g.quadraticCurveTo(0, R, R * 0.4, R * 0.5);
        g.quadraticCurveTo(R * 0.7, R * 0.1, R * 1.7, R * 0.3 - flap * 0.4);
        g.quadraticCurveTo(R * 1.5, -R * 0.2 - flap, 0, -R * 0.4);
        g.closePath();
      });
      eye(fx, R * 0.05, R * 0.28, R * 0.34);
      break;
    }
    case 'maw': { // bulbous head, gaping mouth, three eyes
      body(() => { g.beginPath(); g.ellipse(0, -R * 0.1, R, R * 0.95, 0, 0, Math.PI * 2); g.closePath(); });
      g.fillStyle = '#160a0a';
      g.beginPath(); g.ellipse(fx, R * 0.5, R * 0.4, R * 0.3, 0, 0, Math.PI * 2); g.fill();
      eye(-R * 0.4 + fx, -R * 0.25, R * 0.16, R * 0.2);
      eye(R * 0.4 + fx, -R * 0.25, R * 0.16, R * 0.2);
      eye(fx, -R * 0.5, R * 0.16, R * 0.2);
      break;
    }
    case 'hulk': { // wide bulky brute with heavy brow + stubby arms
      body(() => {
        g.beginPath();
        g.moveTo(-R, R * 0.7);
        g.quadraticCurveTo(-R * 1.1, -R * 0.6, -R * 0.5, -R * 0.85);
        g.quadraticCurveTo(0, -R, R * 0.5, -R * 0.85);
        g.quadraticCurveTo(R * 1.1, -R * 0.6, R, R * 0.7);
        g.quadraticCurveTo(0, R, -R, R * 0.7);
        g.closePath();
      });
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 6;
      g.beginPath(); g.ellipse(-R * 0.95, R * 0.2, R * 0.28, R * 0.4, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(R * 0.95, R * 0.2, R * 0.28, R * 0.4, 0, 0, 7); g.fill();
      g.shadowBlur = 0;
      // heavy brow
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(-R * 0.6, -R * 0.45, R * 1.2, R * 0.18);
      eye(-R * 0.32 + fx, -R * 0.12, R * 0.17, R * 0.18);
      eye(R * 0.32 + fx, -R * 0.12, R * 0.17, R * 0.18);
      break;
    }
    case 'horned': { // teardrop imp with two horns + slanted eyes
      body(() => {
        g.beginPath();
        g.moveTo(0, -R);
        g.quadraticCurveTo(R, -R * 0.5, R * 0.8, R * 0.4);
        g.quadraticCurveTo(R * 0.5, R, 0, R);
        g.quadraticCurveTo(-R * 0.5, R, -R * 0.8, R * 0.4);
        g.quadraticCurveTo(-R, -R * 0.5, 0, -R);
        g.closePath();
      });
      g.fillStyle = col; g.beginPath();
      g.moveTo(-R * 0.55, -R * 0.6); g.lineTo(-R * 0.9, -R * 1.2); g.lineTo(-R * 0.25, -R * 0.75); g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(R * 0.55, -R * 0.6); g.lineTo(R * 0.9, -R * 1.2); g.lineTo(R * 0.25, -R * 0.75); g.closePath(); g.fill();
      g.fillStyle = '#0a0f14';
      g.beginPath(); g.moveTo(-R * 0.5 + fx, -R * 0.1); g.lineTo(-R * 0.1 + fx, R * 0.05); g.lineTo(-R * 0.45 + fx, R * 0.2); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(R * 0.5 + fx, -R * 0.1); g.lineTo(R * 0.1 + fx, R * 0.05); g.lineTo(R * 0.45 + fx, R * 0.2); g.closePath(); g.fill();
      break;
    }
    case 'mystic': { // tall wispy shade with a floating halo
      body(() => {
        g.beginPath();
        g.moveTo(0, -R * 1.1);
        g.quadraticCurveTo(R * 0.8, -R * 0.3, R * 0.6, R * 0.6);
        g.quadraticCurveTo(R * 0.3, R * 1.1, 0, R * 0.85);
        g.quadraticCurveTo(-R * 0.3, R * 1.1, -R * 0.6, R * 0.6);
        g.quadraticCurveTo(-R * 0.8, -R * 0.3, 0, -R * 1.1);
        g.closePath();
      });
      g.strokeStyle = 'rgba(190,255,235,0.85)'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(0, -R * 1.25, R * 0.5, R * 0.18, 0, 0, Math.PI * 2); g.stroke();
      eye(-R * 0.22 + fx, -R * 0.35, R * 0.15, R * 0.26);
      eye(R * 0.22 + fx, -R * 0.35, R * 0.15, R * 0.26);
      break;
    }
    case 'mote': { // tiny darting diamond with one eye + spark
      body(() => {
        g.beginPath();
        g.moveTo(0, -R); g.lineTo(R, 0); g.lineTo(0, R); g.lineTo(-R, 0); g.closePath();
      });
      eye(fx, 0, R * 0.4, R * 0.4);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.arc(-R * 1.1, R * 0.2, R * 0.18, 0, 7); g.fill();
      break;
    }
    case 'grin': { // round shade with a huge toothy grin + shifty eyes
      body(() => { g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.closePath(); });
      g.fillStyle = '#160a0a';
      g.beginPath(); g.arc(fx, R * 0.25, R * 0.6, 0.1 * Math.PI, 0.9 * Math.PI); g.closePath(); g.fill();
      g.strokeStyle = col; g.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(fx + i * R * 0.22, R * 0.25); g.lineTo(fx + i * R * 0.22, R * 0.62); g.stroke(); }
      eye(-R * 0.35 + fx, -R * 0.25, R * 0.18, R * 0.22);
      eye(R * 0.35 + fx, -R * 0.25, R * 0.18, R * 0.22);
      break;
    }
    case 'worm': { // segmented creeper with a suction maw
      const seg = (cy, rr) => { g.beginPath(); g.ellipse(0, cy, rr, rr * 0.7, 0, 0, Math.PI * 2); g.closePath(); };
      body(() => seg(R * 0.6, R * 0.85));
      body(() => seg(-R * 0.05, R * 0.9));
      body(() => seg(-R * 0.7, R * 0.8));
      g.fillStyle = '#160a14';
      g.beginPath(); g.arc(0, -R * 0.85, R * 0.32, 0, Math.PI * 2); g.fill();
      eye(-R * 0.28 + fx, -R * 0.85, R * 0.1, R * 0.12);
      eye(R * 0.28 + fx, -R * 0.85, R * 0.1, R * 0.12);
      break;
    }
    case 'sentinel': { // armoured hexagon with a central shield-eye
      body(() => {
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const fn = i ? 'lineTo' : 'moveTo'; g[fn](Math.cos(a) * R, Math.sin(a) * R); }
        g.closePath();
      });
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-R * 0.7, 0); g.lineTo(R * 0.7, 0); g.stroke();
      eye(fx, 0, R * 0.34, R * 0.4);
      break;
    }
    case 'crystal': { // faceted reflective gem alien
      body(() => {
        g.beginPath();
        g.moveTo(0, -R); g.lineTo(R * 0.85, -R * 0.2); g.lineTo(R * 0.55, R); g.lineTo(-R * 0.55, R); g.lineTo(-R * 0.85, -R * 0.2); g.closePath();
      });
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -R); g.lineTo(0, R); g.moveTo(-R * 0.85, -R * 0.2); g.lineTo(R * 0.85, -R * 0.2); g.stroke();
      eye(-R * 0.3 + fx, 0, R * 0.15, R * 0.22);
      eye(R * 0.3 + fx, 0, R * 0.15, R * 0.22);
      break;
    }
    case 'void': { // hooded cloak with a single void eye
      body(() => {
        g.beginPath();
        g.moveTo(0, -R * 1.05);
        g.quadraticCurveTo(R * 0.9, -R * 0.7, R * 0.7, R);
        g.quadraticCurveTo(0, R * 0.7, -R * 0.7, R);
        g.quadraticCurveTo(-R * 0.9, -R * 0.7, 0, -R * 1.05);
        g.closePath();
      });
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath(); g.ellipse(fx, -R * 0.1, R * 0.5, R * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(200,150,255,0.95)'; g.shadowColor = '#b08aff'; g.shadowBlur = 10;
      g.beginPath(); g.arc(fx, -R * 0.15, R * 0.18, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      break;
    }
    case 'ornate': { // elite — crested body with extra eyes
      body(() => { g.beginPath(); g.ellipse(0, 0, R, R, 0, 0, Math.PI * 2); g.closePath(); });
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * R * 0.3, -R * 0.85); g.lineTo(i * R * 0.3, -R * 1.3); g.stroke(); }
      g.shadowBlur = 0;
      eye(-R * 0.4 + fx, -R * 0.1, R * 0.18, R * 0.24);
      eye(R * 0.4 + fx, -R * 0.1, R * 0.18, R * 0.24);
      eye(fx, R * 0.35, R * 0.16, R * 0.2);
      break;
    }
    case 'bomb': { // round bomb body, lit fuse on top, panicky eyes
      // fuse spark pulses faster as it readies to blow (while winding up)
      const lit = e.windup > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(e.wobble * 6)) : 0.5;
      body(() => { g.beginPath(); g.arc(0, R * 0.12, R, 0, Math.PI * 2); g.closePath(); });
      // fuse stem
      g.strokeStyle = '#6a4a30'; g.lineWidth = Math.max(2, R * 0.13);
      g.beginPath(); g.moveTo(0, -R * 0.85); g.quadraticCurveTo(R * 0.4, -R * 1.25, R * 0.2, -R * 1.5); g.stroke();
      // fuse spark
      g.fillStyle = `rgba(255,${Math.round(140 + 80 * lit)},60,${0.7 + 0.3 * lit})`;
      g.shadowColor = '#ffae3c'; g.shadowBlur = R * lit;
      g.beginPath(); g.arc(R * 0.2, -R * 1.55, R * 0.22 * (0.7 + 0.5 * lit), 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      eye(-R * 0.32 + fx, R * 0.05, R * 0.18, R * 0.2);
      eye(R * 0.32 + fx, R * 0.05, R * 0.18, R * 0.2);
      break;
    }
    case 'overlord': { // boss — grand multi-eyed horror with tendrils
      const t = e.wobble;
      g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 8;
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(i * R * 0.35, R * 0.6);
        g.quadraticCurveTo(i * R * 0.45 + Math.sin(t + i) * R * 0.2, R * 1.1, i * R * 0.4, R * 1.4);
        g.stroke();
      }
      g.shadowBlur = 0;
      body(() => { g.beginPath(); g.ellipse(0, -R * 0.1, R, R * 1.05, 0, 0, Math.PI * 2); g.closePath(); });
      // central great eye + ring of small eyes
      eye(fx, -R * 0.1, R * 0.32, R * 0.4);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; eye(Math.cos(a) * R * 0.6 + fx, Math.sin(a) * R * 0.6 - R * 0.1, R * 0.1, R * 0.12); }
      break;
    }
    default: {
      body(() => { g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.closePath(); });
      eye(-R * 0.3 + fx, -R * 0.15, R * 0.2, R * 0.26);
      eye(R * 0.3 + fx, -R * 0.15, R * 0.2, R * 0.26);
    }
  }
  drawAssetDetails(g, e, R, col, faceX);
  drawAssetRim(g, R, col);
}
