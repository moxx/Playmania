import * as THREE from 'three';

/** Prozedurale Canvas-Texturen für die 3D-Welt (keine Bilddateien nötig). */

const cache = new Map<string, THREE.Texture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, opts: { repeat?: boolean; srgb?: boolean } = {}): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Holzdielen (kachelbar, 1 Kachel = 4×4 Einheiten) */
export function woodFloor(): THREE.Texture {
  return canvasTexture(
    'wood',
    1024,
    1024,
    (ctx) => {
      const r = rng(11);
      const rows = 8;
      const rh = 1024 / rows;
      for (let i = 0; i < rows; i++) {
        let x = -r() * 400;
        while (x < 1024) {
          const len = 380 + r() * 360;
          const base = [196, 140, 86].map((v) => v + (r() - 0.5) * 34);
          const g = ctx.createLinearGradient(0, i * rh, 0, (i + 1) * rh);
          g.addColorStop(0, `rgb(${base[0] + 10},${base[1] + 8},${base[2] + 6})`);
          g.addColorStop(1, `rgb(${base[0] - 12},${base[1] - 10},${base[2] - 8})`);
          ctx.fillStyle = g;
          ctx.fillRect(x, i * rh, len, rh);
          // Maserung
          ctx.strokeStyle = 'rgba(90,50,20,0.18)';
          ctx.lineWidth = 2;
          for (let k = 0; k < 5; k++) {
            const y = i * rh + 10 + r() * (rh - 20);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 14, x + len * 0.6, y + (r() - 0.5) * 14, x + len, y + (r() - 0.5) * 8);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(60,30,10,0.55)';
          ctx.fillRect(x, i * rh, 3, rh);
          x += len;
        }
        ctx.fillStyle = 'rgba(60,30,10,0.6)';
        ctx.fillRect(0, i * rh, 1024, 3);
      }
    },
    { repeat: true },
  );
}

/** Kinderzimmer-Tapete mit Sternen */
export function wallpaperKids(): THREE.Texture {
  return canvasTexture(
    'wall-kids',
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#a9dcf5';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#b9e4f8';
      for (let x = 0; x < 512; x += 128) ctx.fillRect(x, 0, 64, 512);
      const star = (x: number, y: number, r: number, col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? r * 0.45 : r;
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      };
      const r = rng(5);
      for (let i = 0; i < 14; i++) star(r() * 512, r() * 512, 10 + r() * 12, i % 3 ? 'rgba(255,255,255,0.75)' : 'rgba(255,236,150,0.85)');
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.arc(r() * 512, r() * 512, 3 + r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { repeat: true },
  );
}

/** Münz-Prägung (P) */
export function coinFace(): THREE.Texture {
  return canvasTexture('coin', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(100, 90, 10, 128, 128, 128);
    g.addColorStop(0, '#fff3a6');
    g.addColorStop(0.55, '#ffcf33');
    g.addColorStop(1, '#e79a00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#d48600';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(128, 128, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#cf8200';
    ctx.font = 'bold 130px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 128, 136);
  });
}

/** Buchstabe für Bauklötze */
export function letterTile(letter: string, color: string): THREE.Texture {
  return canvasTexture(`letter-${letter}-${color}`, 256, 256, (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 14;
    ctx.strokeRect(20, 20, 216, 216);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 170px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 128, 140);
  });
}

/** Pfeile für Boost-Rampen (wiederholt sich in x) */
export function boostArrows(): THREE.Texture {
  return canvasTexture(
    'arrows',
    256,
    128,
    (ctx) => {
      ctx.fillStyle = '#ff8a1f';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#fff36b';
      for (const x of [40, 168]) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x + 50, 64);
        ctx.lineTo(x, 108);
        ctx.lineTo(x + 22, 64);
        ctx.closePath();
        ctx.fill();
      }
    },
    { repeat: true },
  );
}

/** Lineal (für normale Rampen) */
export function rulerTex(): THREE.Texture {
  return canvasTexture(
    'ruler',
    512,
    64,
    (ctx) => {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(0, 0, 512, 64);
      ctx.strokeStyle = '#6b4a00';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 50; i++) {
        const x = 6 + i * 10;
        const l = i % 10 === 0 ? 30 : i % 5 === 0 ? 20 : 12;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, l);
        ctx.stroke();
      }
      ctx.fillStyle = '#6b4a00';
      ctx.font = 'bold 18px sans-serif';
      for (let i = 0; i < 5; i++) ctx.fillText(String(i + 1), 4 + i * 100 + 100 - 6, 52);
    },
    { repeat: true },
  );
}

export function checker(): THREE.Texture {
  return canvasTexture(
    'checker',
    128,
    128,
    (ctx) => {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#1d1d1d' : '#ffffff';
          ctx.fillRect(i * 32, j * 32, 32, 32);
        }
    },
    { repeat: true },
  );
}

/** Text-Schild (transparent) */
export function label(text: string, color = '#ffffff', stroke = '#3b2478'): THREE.Texture {
  return canvasTexture(`label-${text}-${color}`, 512, 160, (ctx) => {
    ctx.font = 'bold 110px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 22;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, 256, 84);
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 84);
  });
}

/** Buchrücken mit Titelstreifen */
export function bookSpine(color: string, seed: number): THREE.Texture {
  return canvasTexture(`spine-${color}-${seed}`, 512, 64, (ctx) => {
    const r = rng(seed);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 6, 512, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 52, 512, 6);
    ctx.fillStyle = 'rgba(255,224,138,0.95)';
    const x = 80 + r() * 200;
    ctx.fillRect(x, 20, 120 + r() * 80, 24);
    ctx.fillRect(30, 18, 10, 28);
    ctx.fillRect(472, 18, 10, 28);
  });
}

export function pages(): THREE.Texture {
  return canvasTexture(
    'pages',
    256,
    64,
    (ctx) => {
      ctx.fillStyle = '#fbf3df';
      ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = 'rgba(150,120,80,0.25)';
      for (let y = 2; y < 64; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
    },
    { repeat: true },
  );
}

/** Bettdecken-Stoff (für Hügel) */
export function blanket(): THREE.Texture {
  return canvasTexture(
    'blanket',
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#4e9cf0';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let y = 32; y < 256; y += 64)
        for (let x = 32 + ((y / 64) % 2) * 32; x < 256; x += 64) {
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.fill();
        }
    },
    { repeat: true },
  );
}

/** Weiche Partikel */
export function softDot(): THREE.Texture {
  return canvasTexture('soft', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function starTex(): THREE.Texture {
  return canvasTexture('star', 64, 64, (ctx) => {
    ctx.translate(32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 12 : 30;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
}

/** Himmel fürs Fenster */
export function sky(): THREE.Texture {
  return canvasTexture('sky', 256, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#5fbaf5');
    g.addColorStop(1, '#d9f2ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.arc(190, 60, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of [[60, 110, 22], [85, 100, 28], [110, 112, 20]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7ed957';
    ctx.beginPath();
    ctx.ellipse(128, 260, 180, 60, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Weltraum-Poster */
export function posterRocket(): THREE.Texture {
  return canvasTexture('poster', 256, 360, (ctx) => {
    ctx.fillStyle = '#1b1035';
    ctx.fillRect(0, 0, 256, 360);
    const r = rng(3);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) ctx.fillRect(r() * 256, r() * 360, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(128, 170, 32, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4d5e';
    ctx.beginPath();
    ctx.moveTo(96, 120);
    ctx.lineTo(160, 120);
    ctx.lineTo(128, 70);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(98, 220);
    ctx.lineTo(70, 270);
    ctx.lineTo(100, 262);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(158, 220);
    ctx.lineTo(186, 270);
    ctx.lineTo(156, 262);
    ctx.fill();
    ctx.fillStyle = '#38b6ff';
    ctx.beginPath();
    ctx.arc(128, 160, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffc928';
    ctx.beginPath();
    ctx.moveTo(108, 262);
    ctx.lineTo(148, 262);
    ctx.lineTo(128, 320);
    ctx.fill();
  });
}

/** Radfelge (Speichen) */
export function rimTex(): THREE.Texture {
  return canvasTexture('rim', 128, 128, (ctx) => {
    ctx.fillStyle = '#1b1b1f';
    ctx.fillRect(0, 0, 128, 128);
    const g = ctx.createRadialGradient(50, 50, 4, 64, 64, 50);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#9aa3ad');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5d646d';
    ctx.lineWidth = 7;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.lineTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff4d5e';
    ctx.beginPath();
    ctx.arc(64, 64, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}
