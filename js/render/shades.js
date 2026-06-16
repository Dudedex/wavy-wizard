'use strict';

// ===========================================================================
// Enemy "shades" — distinct little-alien sprites per enemy type
// ===========================================================================

const SHADE_OF = {
  blob: 'ooze', bat: 'flyer', spitter: 'maw', brute: 'hulk', imp: 'horned',
  shaman: 'mystic', spark: 'mote', goblin: 'grin', leech: 'worm', warden: 'sentinel',
  mirror: 'crystal', nuller: 'void', elite: 'ornate', boss: 'overlord',
  bomber: 'bomb', caster: 'void',
};


// Draws a translucent glowing alien shade at the current (scaled) origin.
// R = radius, col = body colour, faceX = -1/1 toward the player.
function drawShade(g, e, R, col, faceX) {
  const style = SHADE_OF[e.type] || 'ooze';
  const fx = faceX * R * 0.12;
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
}
