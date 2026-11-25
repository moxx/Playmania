/**
 * Erzeugt die App-Icons (PWA + Apple Touch Icon + 1024er Store-Icon) per Canvas im Headless-Chromium.
 * Aufruf: npm run icons   (benötigt Playwright: npm i -D playwright && npx playwright install chromium)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

const draw = `
(size) => {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const s = size / 512; x.scale(s, s);
  const bg = x.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, '#5a3aa8'); bg.addColorStop(1, '#1b1035');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 512);
  // Strahlen
  x.save(); x.translate(256, 300);
  for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,201,40,0.08)'; x.beginPath(); x.moveTo(0,0); x.lineTo(-60, -400); x.lineTo(60, -400); x.closePath(); x.fill(); }
  x.restore();
  // Boden + Rampe
  x.fillStyle = '#c98b52'; x.fillRect(0, 400, 512, 112);
  x.fillStyle = '#ff8a1f'; x.beginPath(); x.moveTo(300, 400); x.lineTo(470, 400); x.lineTo(470, 330); x.closePath(); x.fill();
  // Flamme
  const fl = x.createRadialGradient(120, 250, 4, 120, 250, 90); fl.addColorStop(0, 'rgba(255,240,150,1)'); fl.addColorStop(0.4, 'rgba(255,140,0,0.9)'); fl.addColorStop(1, 'rgba(255,60,0,0)');
  x.fillStyle = fl; x.beginPath(); x.ellipse(110, 255, 95, 40, -0.25, 0, Math.PI * 2); x.fill();
  // Auto
  x.save(); x.translate(270, 255); x.rotate(-0.22);
  x.fillStyle = '#c21d2a'; x.beginPath(); x.moveTo(-70, -20); x.quadraticCurveTo(-60, -70, -30, -72); x.lineTo(40, -72); x.quadraticCurveTo(55, -70, 75, -20); x.closePath(); x.fill();
  x.fillStyle = '#bfe8ff'; x.beginPath(); x.moveTo(-52, -22); x.quadraticCurveTo(-45, -58, -25, -60); x.lineTo(35, -60); x.lineTo(58, -22); x.closePath(); x.fill();
  x.fillStyle = '#e8333f'; x.beginPath(); x.roundRect(-130, -25, 260, 62, 18); x.fill();
  x.fillStyle = '#ffffff'; x.fillRect(-120, 0, 240, 9);
  x.fillStyle = '#fff6a8'; x.fillRect(116, -14, 12, 12);
  // Rakete
  x.fillStyle = '#e9edf2'; x.beginPath(); x.roundRect(-70, -112, 100, 34, 16); x.fill();
  x.fillStyle = '#ff4d5e'; x.beginPath(); x.moveTo(28, -112); x.quadraticCurveTo(70, -100, 72, -95); x.quadraticCurveTo(70, -90, 28, -78); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(-60, -112); x.lineTo(-85, -130); x.lineTo(-78, -108); x.fill();
  x.beginPath(); x.moveTo(-60, -78); x.lineTo(-85, -60); x.lineTo(-78, -82); x.fill();
  // Räder
  for (const wx of [-78, 78]) { x.fillStyle = '#1b1b1f'; x.beginPath(); x.arc(wx, 40, 38, 0, Math.PI*2); x.fill(); x.fillStyle = '#c9d0d8'; x.beginPath(); x.arc(wx, 40, 20, 0, Math.PI*2); x.fill(); }
  x.restore();
  // Münzen
  for (const [cx, cy, r] of [[380, 120, 34], [450, 200, 26], [330, 60, 20]]) {
    x.fillStyle = '#b86e00'; x.beginPath(); x.arc(cx, cy + 4, r, 0, Math.PI*2); x.fill();
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI*2); x.fill();
    x.strokeStyle = '#e08f00'; x.lineWidth = r * 0.15; x.beginPath(); x.arc(cx, cy, r * 0.7, 0, Math.PI*2); x.stroke();
  }
  return c.toDataURL('image/png');
}`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['icon-1024.png', 1024]]) {
    const url = await page.evaluate(`(${draw})(${size})`);
    fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', name);
  }
  await browser.close();
})();
