import Phaser from 'phaser';
import { CARS, type CarDef } from './cars';

/** Auflösungsfaktor für gezeichnete Texturen (scharf bei Zoom/Retina) */
export const TEX_K = 3;

/** Logische Texturgröße der Auto-Karosserie, Ursprung in der Mitte */
export const CAR_TEX = { w: 180, h: 110 };

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * TEX_K), Math.ceil(h * TEX_K));
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(TEX_K, TEX_K);
  draw(ctx);
  ctx.restore();
  tex.refresh();
}

const css = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const shade = (c: number, f: number) => {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Seitenansicht des Autos (ohne Räder), nach rechts fahrend */
export function drawCarBody(ctx: CanvasRenderingContext2D, c: CarDef): void {
  const top = -c.bodyH / 2;
  const bot = c.bodyH / 2;
  const hw = c.bodyW / 2;
  const outline = css(shade(c.color, -0.55));
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;

  // Kabine
  ctx.beginPath();
  if (c.style === 'pickup') {
    ctx.moveTo(c.cabBack, top + 2);
    ctx.lineTo(c.cabBack, top - c.cabH + 4);
    ctx.quadraticCurveTo(c.cabBack, top - c.cabH, c.cabBack + 6, top - c.cabH);
    ctx.lineTo(c.cabFront - 4, top - c.cabH);
    ctx.lineTo(c.cabFront + 12, top + 2);
  } else {
    ctx.moveTo(c.cabBack - 10, top + 2);
    ctx.quadraticCurveTo(c.cabBack - 2, top - c.cabH + 2, c.cabBack + 10, top - c.cabH);
    ctx.lineTo(c.cabFront - 4, top - c.cabH);
    ctx.quadraticCurveTo(c.cabFront + 2, top - c.cabH + 1, c.cabFront + 16, top + 2);
  }
  ctx.closePath();
  ctx.fillStyle = css(shade(c.color, -0.08));
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.stroke();

  // Fenster
  ctx.beginPath();
  if (c.style === 'pickup') {
    ctx.moveTo(c.cabBack + 5, top);
    ctx.lineTo(c.cabBack + 5, top - c.cabH + 6);
    ctx.lineTo(c.cabFront - 6, top - c.cabH + 6);
    ctx.lineTo(c.cabFront + 6, top);
  } else {
    ctx.moveTo(c.cabBack - 2, top);
    ctx.quadraticCurveTo(c.cabBack + 4, top - c.cabH + 6, c.cabBack + 12, top - c.cabH + 5);
    ctx.lineTo(c.cabFront - 5, top - c.cabH + 5);
    ctx.lineTo(c.cabFront + 8, top);
  }
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, top - c.cabH, 0, top);
  wg.addColorStop(0, '#d9f4ff');
  wg.addColorStop(1, '#6fb9e0');
  ctx.fillStyle = wg;
  ctx.fill();
  ctx.strokeStyle = css(0x1d3c55, 0.8);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Fenstersteg
  if (c.style !== 'pickup') {
    const mid = (c.cabBack + c.cabFront) / 2 - 2;
    ctx.fillStyle = css(shade(c.color, -0.15));
    ctx.fillRect(mid, top - c.cabH + 4, 4, c.cabH - 4);
  }
  // Fenster-Glanz
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.cabFront - 2, top - c.cabH + 9);
  ctx.lineTo(c.cabFront + 3, top - 3);
  ctx.stroke();

  // Unterbau
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-hw + 6, bot);
  ctx.lineTo(hw - 8, bot);
  ctx.quadraticCurveTo(hw + 1, bot - 1, hw, bot - 9);
  ctx.lineTo(hw - 2, top + 8);
  ctx.quadraticCurveTo(hw - 6, top + 1, hw - 18, top);
  ctx.lineTo(-hw + 6, top + 1);
  ctx.quadraticCurveTo(-hw, top + 2, -hw, top + 8);
  ctx.lineTo(-hw, bot - 6);
  ctx.quadraticCurveTo(-hw, bot, -hw + 6, bot);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, top, 0, bot);
  bg.addColorStop(0, css(shade(c.color, 0.25)));
  bg.addColorStop(0.45, css(c.color));
  bg.addColorStop(1, css(shade(c.color, -0.3)));
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.stroke();

  // Pickup-Ladefläche
  if (c.style === 'pickup') {
    ctx.fillStyle = css(shade(c.color, -0.35));
    roundRectPath(ctx, -hw + 6, top - 5, c.cabBack + hw - 10, 7, 3);
    ctx.fill();
  }

  // Zierstreifen
  ctx.fillStyle = css(c.accent, 0.95);
  ctx.beginPath();
  ctx.moveTo(-hw + 4, top + c.bodyH * 0.38);
  ctx.lineTo(hw - 6, top + c.bodyH * 0.3);
  ctx.lineTo(hw - 6, top + c.bodyH * 0.3 + 4);
  ctx.lineTo(-hw + 4, top + c.bodyH * 0.38 + 4);
  ctx.closePath();
  ctx.fill();

  // Radkästen – nur innerhalb der bereits gezeichneten Karosserie (source-atop),
  // damit bei eingefederten Rädern keine harten Kanten sichtbar werden
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = css(shade(c.color, -0.7));
  for (const ax of c.axles) {
    ctx.beginPath();
    ctx.arc(ax, c.axleY, c.wheelR + 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Scheinwerfer / Rücklicht
  ctx.fillStyle = '#fff6a8';
  roundRectPath(ctx, hw - 7, top + 5, 6, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#ff3b3b';
  roundRectPath(ctx, -hw, top + 5, 5, 6, 2);
  ctx.fill();

  // Glanzlicht
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-hw + 10, top + 4);
  ctx.lineTo(hw - 24, top + 3);
  ctx.stroke();

  // Startnummer (Matchbox-Look)
  if (c.style === 'sport') {
    const nx = (c.axles[0] + c.axles[1]) / 2 - 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(nx, top + c.bodyH * 0.55, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.id === 'blitz' ? '7' : '1', nx, top + c.bodyH * 0.55 + 0.5);
  }
}

export function drawWheel(ctx: CanvasRenderingContext2D, r: number, monster: boolean): void {
  ctx.fillStyle = '#1b1b1f';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (monster) {
    ctx.fillStyle = '#2c2c33';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(r - 5, -3, 6, 6);
      ctx.restore();
    }
  }
  ctx.fillStyle = '#3a3a42';
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
  ctx.fill();
  const hub = r * 0.58;
  const hg = ctx.createRadialGradient(-hub * 0.3, -hub * 0.3, 1, 0, 0, hub);
  hg.addColorStop(0, '#ffffff');
  hg.addColorStop(1, '#9aa3ad');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, hub, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5d646d';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
    ctx.lineTo(Math.cos(a) * hub * 0.92, Math.sin(a) * hub * 0.92);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff4d5e';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Rakete (zeigt nach rechts, Düse links) – logisch 70×30 */
export function drawRocket(ctx: CanvasRenderingContext2D): void {
  ctx.lineJoin = 'round';
  // Flossen
  ctx.fillStyle = '#ff4d5e';
  ctx.strokeStyle = '#7a1520';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, -5);
  ctx.lineTo(-33, -14);
  ctx.lineTo(-30, -5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-22, 5);
  ctx.lineTo(-33, 14);
  ctx.lineTo(-30, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Düse
  ctx.fillStyle = '#555c66';
  ctx.beginPath();
  ctx.moveTo(-26, -5);
  ctx.lineTo(-33, -7);
  ctx.lineTo(-33, 7);
  ctx.lineTo(-26, 5);
  ctx.closePath();
  ctx.fill();
  // Körper
  const g = ctx.createLinearGradient(0, -8, 0, 8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#d7dde6');
  g.addColorStop(1, '#98a2b0');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#3d4450';
  roundRectPath(ctx, -27, -8, 42, 16, 7);
  ctx.fill();
  ctx.stroke();
  // Spitze
  ctx.fillStyle = '#ff4d5e';
  ctx.beginPath();
  ctx.moveTo(14, -8);
  ctx.quadraticCurveTo(30, -6, 34, 0);
  ctx.quadraticCurveTo(30, 6, 14, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Bullauge
  ctx.fillStyle = '#38b6ff';
  ctx.strokeStyle = '#3d4450';
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function makeRacerTextures(scene: Phaser.Scene): void {
  for (const c of CARS) {
    canvasTex(scene, `car-${c.id}`, CAR_TEX.w, CAR_TEX.h, (ctx) => {
      ctx.translate(CAR_TEX.w / 2, CAR_TEX.h / 2 + 10);
      drawCarBody(ctx, c);
    });
    const d = c.wheelR * 2 + 2;
    canvasTex(scene, `wheel-${c.id}`, d, d, (ctx) => {
      ctx.translate(d / 2, d / 2);
      drawWheel(ctx, c.wheelR, c.style === 'monster');
    });
  }
  canvasTex(scene, 'rocket', 70, 32, (ctx) => {
    ctx.translate(35, 16);
    drawRocket(ctx);
  });
  canvasTex(scene, 'coin', 40, 40, (ctx) => {
    ctx.translate(20, 20);
    ctx.fillStyle = '#b86e00';
    ctx.beginPath();
    ctx.arc(0, 1.5, 17, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 17);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(0.5, '#ffd23f');
    g.addColorStop(1, '#f2a500');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d98a00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e08f00';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 0, 1);
  });
  canvasTex(scene, 'ring', 120, 120, (ctx) => {
    ctx.translate(60, 60);
    for (const [w, col] of [
      [14, 'rgba(56,182,255,0.25)'],
      [9, '#38b6ff'],
      [4, '#c9f0ff'],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 50, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  canvasTex(scene, 'soft', 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  canvasTex(scene, 'star', 24, 24, (ctx) => {
    ctx.translate(12, 12);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4.5 : 11;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  canvasTex(scene, 'confetti', 10, 6, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 10, 6);
  });
}
