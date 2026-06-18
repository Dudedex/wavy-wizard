'use strict';

// ===========================================================================
// Wizard character sprite (hats / hoods / staff / hair variations)
// ===========================================================================


function wizardAlpha(col, alpha) {
  if (col && col[0] === '#' && col.length === 7) {
    const n = parseInt(col.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return col || `rgba(255,255,255,${alpha})`;
}

function drawWizardAura(g, look, face, time, hurt) {
  const orb = look.orb || '#aef0ff';
  const robe = hurt ? '#ff5577' : (look.robe || '#3a55c9');
  const pulse = 0.5 + Math.sin(time * 4.5) * 0.5;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = wizardAlpha(orb, 0.20 + pulse * 0.18);
  g.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const a = time * (0.9 + i * 0.2) + i * 2.1;
    const rx = 11 + i * 3;
    const ry = 18 + i * 2;
    g.beginPath();
    g.ellipse(Math.cos(a) * 1.5, -4 + Math.sin(a * 1.4) * 1.2, rx, ry, a * 0.25, Math.PI * 0.12, Math.PI * 1.18);
    g.stroke();
  }
  g.fillStyle = wizardAlpha(orb, 0.18 + pulse * 0.22);
  for (let i = 0; i < 4; i++) {
    const a = time * 1.7 + i * Math.PI * 0.5;
    g.beginPath();
    g.arc(Math.cos(a) * 14 - face * 2, -8 + Math.sin(a * 1.2) * 18, 1.2 + pulse * 0.9, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = wizardAlpha(robe, 0.20);
  g.beginPath(); g.ellipse(0, 17, 14 + pulse * 3, 4.5, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawWizardClothDetails(g, look, face, time) {
  const orb = look.orb || '#aef0ff';
  const sway = Math.sin(time * 5) * 1.2;
  g.save();
  g.strokeStyle = wizardAlpha(orb, 0.32);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(face * -5, -4);
  g.quadraticCurveTo(face * (sway - 1), 3, face * -3, 13);
  g.stroke();
  g.beginPath();
  g.moveTo(face * 5, -4);
  g.quadraticCurveTo(face * (3 + sway), 4, face * 4, 13);
  g.stroke();
  g.fillStyle = wizardAlpha(orb, 0.75);
  g.font = '7px sans-serif';
  g.textAlign = 'center';
  g.fillText('✦', face * -4, 7);
  g.restore();
}

function drawWizardSprite(g, look, face, time, hurt) {
  look = look || CHARACTERS[0].look;
  const pulse = 0.6 + Math.sin(time * 5) * 0.4;
  const hasStaff = look.hasStaff !== false;
  const hasHat = look.hasHat !== false;

  drawWizardAura(g, look, face, time, hurt);

  // staff (behind body): wooden stick with a glowing orb
  if (hasStaff) {
    const sx2 = face * 15;
    g.strokeStyle = '#8a5a2e';
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(sx2 - face * 2, 14);
    g.lineTo(sx2 + face * 2, -17);
    g.stroke();
    g.fillStyle = look.orb;
    g.shadowColor = look.orb; g.shadowBlur = 8 + pulse * 8;
    g.beginPath(); g.arc(sx2 + face * 2, -19, 4.5, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }

  // robe: bell shape with wavy hem
  g.fillStyle = hurt ? '#a04060' : look.robe;
  g.beginPath();
  g.moveTo(-12, 15);
  g.quadraticCurveTo(-11, -2, -7, -7);
  g.lineTo(7, -7);
  g.quadraticCurveTo(11, -2, 12, 15);
  g.quadraticCurveTo(8, 12.5, 4, 15);
  g.quadraticCurveTo(0, 12.5, -4, 15);
  g.quadraticCurveTo(-8, 12.5, -12, 15);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  g.stroke();
  drawWizardClothDetails(g, look, face, time);

  // belt
  g.fillStyle = '#ffd454';
  g.fillRect(-9, 1, 18, 3);

  // head
  g.fillStyle = hurt ? '#ffb0a0' : '#f2c9a0';
  g.beginPath(); g.arc(0, -11, 7, 0, Math.PI * 2); g.fill();

  // facial hair / hair (varies the silhouette)
  if (look.hair) {
    g.fillStyle = look.hair;
    g.beginPath();
    g.moveTo(-7, -10);
    g.quadraticCurveTo(-8, -19, 0, -19);
    g.quadraticCurveTo(8, -19, 7, -10);
    g.quadraticCurveTo(0, -14, -7, -10);
    g.closePath(); g.fill();
    g.fillRect(-8, -13, 2.4, 9); g.fillRect(5.6, -13, 2.4, 9); // side locks
  } else if (look.bald) {
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.ellipse(-2, -13, 2.6, 1.5, 0, 0, Math.PI * 2); g.fill(); // shine
  } else {
    g.fillStyle = '#e9edf5'; // classic beard
    g.beginPath(); g.moveTo(-6, -10); g.quadraticCurveTo(0, 1, 6, -10); g.closePath(); g.fill();
  }

  // eyes (look toward facing)
  g.fillStyle = '#101418';
  g.beginPath(); g.arc(-2.5 + face * 1.5, -12, 1.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(2.5 + face * 1.5, -12, 1.4, 0, Math.PI * 2); g.fill();

  if (hasHat) {
    // wide brim + bent cone hat
    g.fillStyle = look.hat;
    g.beginPath(); g.ellipse(0, -16, 13, 3.6, 0, 0, Math.PI * 2); g.fill();
    g.beginPath();
    g.moveTo(-8, -16);
    g.quadraticCurveTo(-3, -30, face * 7, -33);
    g.quadraticCurveTo(face * 9, -33.5, face * 8, -31);
    g.quadraticCurveTo(face * 4, -26, 8, -16);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#ffd454'; g.fillRect(-7, -19, 14, 2.5);
    g.font = '8px sans-serif'; g.textAlign = 'center'; g.fillText('★', face * 2, -24);
  } else if (look.hood) {
    // a cowl framing the face
    g.fillStyle = look.hat;
    g.beginPath();
    g.moveTo(-9, -8);
    g.quadraticCurveTo(-12, -23, 0, -24);
    g.quadraticCurveTo(12, -23, 9, -8);
    g.quadraticCurveTo(0, -14, -9, -8);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5; g.stroke();
  }

  if (look.horn) {
    g.fillStyle = '#241626';
    g.beginPath(); g.moveTo(-6, -15); g.lineTo(-10, -24); g.lineTo(-3, -17); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(6, -15); g.lineTo(10, -24); g.lineTo(3, -17); g.closePath(); g.fill();
  }

  // hand-cast wisp for staffless wizards
  if (!hasStaff) {
    g.fillStyle = look.orb;
    g.shadowColor = look.orb; g.shadowBlur = 8 + pulse * 8;
    g.beginPath(); g.arc(face * 11, -2, 4, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }
}
