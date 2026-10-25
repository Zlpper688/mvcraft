import * as THREE from 'three';
import { mulberry32, pick } from './utils.js';
import { TYPE_GLYPHS, LETTER_LINE, LETTER_TO } from '../data/glyphs.js';

const SERIF = '"Noto Serif SC", "Songti SC", "STSong", serif';
const LATIN = '"Cormorant Garamond", "Times New Roman", serif';

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  return { c, ctx };
}

function toTexture(c, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  } else {
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  }
  t.needsUpdate = true;
  return t;
}

function grain(ctx, w, h, rnd, amount = 8, tint = 0) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - .5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n + tint));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function softBlob(ctx, x, y, r, color, alpha = .2) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function basePaper(ctx, w, h, rnd, tone = '#e8e0cf', warm = true) {
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createRadialGradient(w * .34, h * .28, 0, w * .5, h * .5, Math.max(w, h) * .78);
  g.addColorStop(0, warm ? 'rgba(255,252,242,.32)' : 'rgba(240,247,255,.28)');
  g.addColorStop(.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, warm ? 'rgba(92,66,40,.18)' : 'rgba(18,32,54,.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 14; i++) {
    softBlob(ctx, rnd() * w, rnd() * h, (0.04 + rnd() * .14) * w,
      warm ? 'rgba(120,92,58,1)' : 'rgba(50,72,100,1)', .025 + rnd() * .035);
  }

  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w, y = rnd() * h;
    const len = 3 + rnd() * 22;
    const a = (rnd() - .5) * .5 + (rnd() > .8 ? Math.PI / 2 : 0);
    ctx.strokeStyle = rnd() > .5 ? `rgba(255,255,255,${.025 + rnd() * .05})` : `rgba(60,45,30,${.018 + rnd() * .03})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();

  // laid lines, like a fine mould-made sheet
  ctx.save();
  ctx.strokeStyle = 'rgba(80,62,40,.032)';
  ctx.lineWidth = 1;
  const step = Math.max(5, Math.round(w / 130));
  for (let x = 0; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.restore();

  grain(ctx, w, h, rnd, 9, warm ? 2 : -1);
}

function tornEdge(ctx, w, h, rnd, depth = 5) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (let i = 0; i < w; i += 2) {
    const d = depth * rnd() + rnd() * 2;
    ctx.fillRect(i, 0, 2, d);
    ctx.fillRect(i, h - d, 2, d);
  }
  for (let i = 0; i < h; i += 2) {
    const d = depth * rnd() + rnd() * 2;
    ctx.fillRect(0, i, d, 2);
    ctx.fillRect(w - d, i, d, 2);
  }
  ctx.restore();
}

function sealDraw(ctx, cx, cy, r, rnd, color = '#b53a2c', glyph = '爱') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const n = 84;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2;
    const rr = r * (.9 + (rnd() - .5) * .12 + Math.sin(a * 7 + 2.1) * .018);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r);
  g.addColorStop(0, '#d35842');
  g.addColorStop(.5, color);
  g.addColorStop(1, '#7c1f18');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(20,4,2,.55)';
  ctx.shadowBlur = r * .18;
  ctx.shadowOffsetY = r * .08;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.clip();
  for (let i = 0; i < 120; i++) {
    softBlob(ctx, (rnd() - .5) * r * 2, (rnd() - .5) * r * 2, r * (.05 + rnd() * .22),
      rnd() > .5 ? 'rgba(255,170,140,1)' : 'rgba(60,10,6,1)', .04 + rnd() * .08);
  }
  ctx.strokeStyle = 'rgba(70,16,10,.55)';
  ctx.lineWidth = r * .045;
  ctx.strokeRect(-r * .58, -r * .58, r * 1.16, r * 1.16);
  ctx.strokeStyle = 'rgba(255,190,160,.18)';
  ctx.lineWidth = r * .014;
  ctx.strokeRect(-r * .63, -r * .63, r * 1.26, r * 1.26);

  ctx.fillStyle = 'rgba(58,10,7,.72)';
  ctx.font = `600 ${r * .92}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 0, r * .035);
  ctx.fillStyle = 'rgba(255,190,165,.20)';
  ctx.fillText(glyph, -r * .018, r * .005);
  ctx.restore();
}

function postMark(ctx, x, y, r, rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(42,54,66,.34)';
  ctx.lineWidth = Math.max(1.2, r * .022);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, r * (.5 + i * .13), -.5 + i * .24, .6 + i * .24);
    ctx.stroke();
  }
  ctx.font = `500 ${r * .15}px ${LATIN}`;
  ctx.fillStyle = 'rgba(42,54,66,.4)';
  ctx.textAlign = 'center';
  ctx.fillText('BY SEA', 0, -r * .18);
  ctx.fillText('POST', 0, r * .28);
  ctx.strokeStyle = 'rgba(42,54,66,.24)';
  ctx.lineWidth = r * .018;
  for (let i = 0; i < 5; i++) {
    const yy = r * (.72 + i * .09);
    ctx.beginPath(); ctx.moveTo(-r * 1.25, yy); ctx.lineTo(r * 1.1, yy - r * .05); ctx.stroke();
  }
  ctx.restore();
}

function drawGlyphColumns(ctx, w, h, rnd, { alpha = .2, color = '30,38,46', cols = 4, fontScale = .055 } = {}) {
  const fs = h * fontScale;
  ctx.save();
  ctx.font = `400 ${fs}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${color},${alpha})`;
  const cw = w / (cols + .5);
  for (let c = 0; c < cols; c++) {
    const x = cw * (c + .8);
    const n = 10 + Math.floor(rnd() * 7);
    const top = h * .12 + rnd() * h * .1;
    for (let i = 0; i < n; i++) {
      if (rnd() < .08) continue;
      const ch = pick(rnd, TYPE_GLYPHS);
      ctx.fillText(ch, x, top + i * fs * 1.42 + rnd() * fs * .15);
    }
  }
  ctx.restore();
}

export class TextureLibrary {
  constructor() {
    this.cache = new Map();
    this.rnd = mulberry32(0x51f20d);
  }

  _get(key, build) {
    if (this.cache.has(key)) return this.cache.get(key);
    const v = build();
    this.cache.set(key, v);
    return v;
  }

  paper(variant = 0) {
    return this._get(`paper${variant}`, () => {
      const rnd = mulberry32(311 + variant * 97);
      const size = 512;
      const { c, ctx } = canvas2d(size, size);
      basePaper(ctx, size, size, rnd, variant === 2 ? '#dfe5e8' : '#e8e0cf', variant !== 2);
      tornEdge(ctx, size, size, rnd, 4);
      return toTexture(c, { repeat: true });
    });
  }

  page(variant = 0) {
    return this._get(`page${variant}`, () => {
      const rnd = mulberry32(811 + variant * 143);
      const w = 640, h = 900;
      const { c, ctx } = canvas2d(w, h);
      basePaper(ctx, w, h, rnd, variant === 2 ? '#dfe3e4' : '#e9e2d2', variant !== 2);
      ctx.strokeStyle = 'rgba(60,70,78,.08)';
      ctx.lineWidth = 1;
      const gap = h * .085;
      for (let y = h * .17; y < h * .86; y += gap) {
        ctx.beginPath(); ctx.moveTo(w * .09, y); ctx.lineTo(w * .91, y); ctx.stroke();
      }
      drawGlyphColumns(ctx, w, h, rnd, {
        alpha: .22, cols: 3 + (variant % 2), fontScale: .05,
        color: variant === 1 ? '24,44,62' : '34,38,42'
      });
      if (variant === 1) sealDraw(ctx, w * .83, h * .88, w * .045, rnd, '#a83a2d', '念');
      if (variant === 2) sealDraw(ctx, w * .18, h * .855, w * .038, rnd, '#b54535', '信');
      ctx.strokeStyle = 'rgba(120,96,60,.2)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(w * .055, h * .045, w * .89, h * .91);
      tornEdge(ctx, w, h, rnd, 6);
      return toTexture(c);
    });
  }

  envelope(front = true) {
    return this._get(front ? 'envFront' : 'envBack', () => {
      const rnd = mulberry32(front ? 4411 : 4412);
      const w = 1024, h = 672;
      const { c, ctx } = canvas2d(w, h);
      basePaper(ctx, w, h, rnd, '#e7dfce', true);
      if (front) {
        ctx.strokeStyle = 'rgba(120,103,80,.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h * .1); ctx.lineTo(w * .5, h * .62); ctx.lineTo(w, h * .1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, h * .9); ctx.lineTo(w * .5, h * .62); ctx.lineTo(w, h * .9);
        ctx.strokeStyle = 'rgba(120,103,80,.18)';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120,103,80,.16)';
        ctx.beginPath(); ctx.moveTo(w * .04, h * .08); ctx.lineTo(w * .96, h * .08); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w * .04, h * .92); ctx.lineTo(w * .96, h * .92); ctx.stroke();

        ctx.save();
        ctx.translate(w * .68, h * .35);
        ctx.font = `400 ${h * .055}px ${LATIN}`;
        ctx.fillStyle = 'rgba(28,38,48,.68)';
        ctx.letterSpacing = `${h * .012}px`;
        ctx.fillText(LETTER_TO, 0, 0);
        ctx.font = `italic 400 ${h * .034}px ${LATIN}`;
        ctx.fillStyle = 'rgba(28,38,48,.38)';
        ctx.fillText('the quiet side of the sea', 0, h * .075);
        ctx.strokeStyle = 'rgba(40,50,58,.26)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, h * .14 + i * h * .05);
          ctx.lineTo(w * (.17 + (i === 2 ? -.04 : .02)), h * .14 + i * h * .05);
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.font = `300 ${h * .085}px ${SERIF}`;
        ctx.fillStyle = 'rgba(26,34,44,.74)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const chars = LETTER_LINE.split('');
        for (let i = 0; i < chars.length; i++) {
          ctx.fillText(chars[i], w * .38, h * .24 + i * h * .098);
        }
        ctx.restore();

        postMark(ctx, w * .18, h * .76, h * .105, rnd);

        ctx.save();
        ctx.strokeStyle = 'rgba(150,120,70,.34)';
        ctx.lineWidth = 3;
        ctx.strokeRect(w * .035, h * .045, w * .93, h * .91);
        ctx.strokeStyle = 'rgba(150,120,70,.16)';
        ctx.lineWidth = 1;
        ctx.strokeRect(w * .045, h * .06, w * .91, h * .88);
        ctx.restore();

        ctx.save();
        ctx.font = `italic 400 ${h * .026}px ${LATIN}`;
        ctx.fillStyle = 'rgba(40,50,58,.34)';
        ctx.fillText('sealed with red, sent by water', w * .5, h * .885);
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(110,93,70,.3)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(w * .5, h * .72); ctx.lineTo(w, 0);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(110,93,70,.15)';
        ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w * .5, h * .72); ctx.lineTo(w, h); ctx.stroke();
        ctx.save();
        ctx.globalAlpha = .5;
        drawGlyphColumns(ctx, w, h, rnd, { alpha: .12, cols: 2, fontScale: .035 });
        ctx.restore();
        ctx.save();
        ctx.translate(w * .5, h * .62);
        ctx.rotate(-.02);
        ctx.font = `400 ${h * .03}px ${LATIN}`;
        ctx.fillStyle = 'rgba(28,38,48,.46)';
        ctx.textAlign = 'center';
        ctx.letterSpacing = `${h * .01}px`;
        ctx.fillText('A LETTER TO THE MOON', 0, 0);
        ctx.restore();
        postMark(ctx, w * .78, h * .22, h * .09, rnd);
      }
      tornEdge(ctx, w, h, rnd, 4);
      return toTexture(c);
    });
  }

  seal() {
    return this._get('seal', () => {
      const rnd = mulberry32(9917);
      const s = 512;
      const { c, ctx } = canvas2d(s, s);
      ctx.clearRect(0, 0, s, s);
      sealDraw(ctx, s / 2, s / 2, s * .43, rnd, '#b23a2b', '爱');
      return toTexture(c);
    });
  }

  sealSmall(char = '爱', color = '#b23a2b') {
    return this._get(`seal-${char}-${color}`, () => {
      const rnd = mulberry32(7001 + char.charCodeAt(0));
      const s = 256;
      const { c, ctx } = canvas2d(s, s);
      sealDraw(ctx, s / 2, s / 2, s * .43, rnd, color, char);
      return toTexture(c);
    });
  }

  moon() {
    return this._get('moon', () => {
      const rnd = mulberry32(0xC0FFEE);
      const s = 1024, ctr = s / 2, R = s * .465;
      const { c, ctx } = canvas2d(s, s);
      ctx.save();
      ctx.beginPath(); ctx.arc(ctr, ctr, R, 0, Math.PI * 2); ctx.clip();
      const g = ctx.createRadialGradient(ctr - R * .22, ctr - R * .3, R * .05, ctr, ctr, R * 1.05);
      g.addColorStop(0, '#fffdf7');
      g.addColorStop(.38, '#f3f3ee');
      g.addColorStop(.78, '#d8dfe7');
      g.addColorStop(1, '#aebccd');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);

      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * .92;
        const x = ctr + Math.cos(a) * d, y = ctr + Math.sin(a) * d;
        softBlob(ctx, x, y, R * (.08 + rnd() * .26), rnd() > .4 ? 'rgba(132,151,173,1)' : 'rgba(178,189,202,1)', .10 + rnd() * .16);
      }
      for (let i = 0; i < 230; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * .96;
        const x = ctr + Math.cos(a) * d, y = ctr + Math.sin(a) * d;
        const cr = R * (.004 + Math.pow(rnd(), 2.4) * .055);
        const gg = ctx.createRadialGradient(x - cr * .25, y - cr * .25, cr * .1, x, y, cr);
        gg.addColorStop(0, 'rgba(255,255,250,.6)');
        gg.addColorStop(.38, 'rgba(178,190,203,.36)');
        gg.addColorStop(.8, 'rgba(110,130,153,.32)');
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,252,.30)';
        ctx.lineWidth = Math.max(.7, cr * .06);
        ctx.beginPath(); ctx.arc(x, y, cr * .92, Math.PI * 1.03, Math.PI * 1.88); ctx.stroke();
      }
      // faint ink-wash maria, hand-painted feel
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2, d = R * (.15 + rnd() * .55);
        const x = ctr + Math.cos(a) * d, y = ctr + Math.sin(a) * d;
        ctx.save();
        ctx.globalAlpha = .05 + rnd() * .06;
        ctx.fillStyle = '#4f6680';
        ctx.beginPath();
        const n = 18, rr = R * (.1 + rnd() * .15);
        for (let j = 0; j <= n; j++) {
          const aa = j / n * Math.PI * 2;
          const rr2 = rr * (.7 + rnd() * .5);
          const px = x + Math.cos(aa) * rr2 * (1.3 + rnd() * .4);
          const py = y + Math.sin(aa) * rr2;
          if (!j) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      grain(ctx, s, s, rnd, 7, 1);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      const mask = ctx.createRadialGradient(ctr, ctr, R * .955, ctr, ctr, R);
      mask.addColorStop(0, 'rgba(0,0,0,1)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mask;
      ctx.fillRect(0, 0, s, s);
      ctx.restore();

      return toTexture(c);
    });
  }

  glow() {
    return this._get('glow', () => {
      const s = 256;
      const { c, ctx } = canvas2d(s, s);
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(.12, 'rgba(255,255,255,.92)');
      g.addColorStop(.32, 'rgba(255,255,255,.36)');
      g.addColorStop(.62, 'rgba(255,255,255,.08)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      return toTexture(c);
    });
  }

  ringGlow() {
    return this._get('ringGlow', () => {
      const s = 512;
      const { c, ctx } = canvas2d(s, s);
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(.62, 'rgba(0,0,0,0)');
      g.addColorStop(.74, 'rgba(255,255,255,.10)');
      g.addColorStop(.865, 'rgba(255,255,255,.85)');
      g.addColorStop(.895, 'rgba(255,255,255,1)');
      g.addColorStop(.93, 'rgba(255,255,255,.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      return toTexture(c);
    });
  }

  inkCloud() {
    return this._get('inkCloud', () => {
      const rnd = mulberry32(7719);
      const s = 320;
      const { c, ctx } = canvas2d(s, s);
      for (let i = 0; i < 46; i++) {
        const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), .6) * s * .3;
        const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
        softBlob(ctx, x, y, s * (.08 + rnd() * .24), 'rgba(255,255,255,1)', .05 + rnd() * .10);
      }
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * .5);
      g.addColorStop(0, 'rgba(255,255,255,.16)');
      g.addColorStop(.55, 'rgba(255,255,255,.06)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      grain(ctx, s, s, rnd, 16, 0);
      ctx.globalCompositeOperation = 'destination-in';
      const mask = ctx.createRadialGradient(s / 2, s / 2, s * .12, s / 2, s / 2, s * .5);
      mask.addColorStop(0, 'rgba(0,0,0,1)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mask;
      ctx.fillRect(0, 0, s, s);
      return toTexture(c);
    });
  }

  glyph(char, opts = {}) {
    const { mode = 'stone', color = 'rgba(214,226,240,.86)', sub = '' } = opts;
    const key = `glyph-${char}-${mode}-${color}-${sub}`;
    return this._get(key, () => {
      const rnd = mulberry32(1009 + char.charCodeAt(0) * 31 + mode.length * 17);
      if (mode === 'glow' || mode === 'ink') {
        const s = 512;
        const { c, ctx } = canvas2d(s, s);
        if (mode === 'ink') {
          ctx.clearRect(0, 0, s, s);
        }
        ctx.save();
        ctx.font = `400 ${s * .72}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (mode === 'glow') {
          ctx.shadowColor = color;
          ctx.shadowBlur = s * .045;
          ctx.fillStyle = color;
          ctx.fillText(char, s / 2, s * .52);
          ctx.shadowBlur = s * .13;
          ctx.globalAlpha = .5;
          ctx.fillText(char, s / 2, s * .52);
        } else {
          ctx.fillStyle = color;
          ctx.fillText(char, s / 2, s * .52);
        }
        ctx.restore();
        return toTexture(c);
      }

      if (mode === 'tag') {
        const w = 256, h = 320;
        const { c, ctx } = canvas2d(w, h);
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(w * .12, h * .06);
        ctx.lineTo(w * .88, h * .06);
        ctx.lineTo(w * .92, h * .9);
        ctx.lineTo(w * .5, h * .97);
        ctx.lineTo(w * .08, h * .9);
        ctx.closePath();
        ctx.clip();
        basePaper(ctx, w, h, rnd, '#e7dfcf', true);
        ctx.strokeStyle = 'rgba(120,98,70,.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * .09, h * .08, w * .82, h * .8);
        ctx.font = `400 ${h * .4}px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(34,42,52,.72)';
        ctx.fillText(char, w * .5, h * .53);
        ctx.beginPath(); ctx.arc(w * .5, h * .105, w * .025, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(90,70,50,.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        return toTexture(c);
      }

      const w = 512, h = 720;
      const { c, ctx } = canvas2d(w, h);
      basePaper(ctx, w, h, rnd, '#101724', false);
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(26,36,52,.32)');
      g.addColorStop(.5, 'rgba(8,13,22,.3)');
      g.addColorStop(1, 'rgba(2,4,8,.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(150,170,190,.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * .055, h * .04, w * .89, h * .92);
      ctx.strokeStyle = 'rgba(201,69,53,.34)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * .82, h * .055); ctx.lineTo(w * .94, h * .055); ctx.lineTo(w * .94, h * .16);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `400 ${w * .64}px ${SERIF}`;
      ctx.fillStyle = 'rgba(8,12,18,.7)';
      ctx.fillText(char, w * .515, h * .475);
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(150,180,210,.22)';
      ctx.shadowBlur = 18;
      ctx.fillText(char, w * .5, h * .465);
      ctx.shadowBlur = 0;
      ctx.font = `italic 400 ${w * .055}px ${LATIN}`;
      ctx.fillStyle = 'rgba(180,198,216,.30)';
      const annotations = ['A WORD FOR THE SEA', 'I / II / III', 'THE MOON REMEMBERS', 'INK · TIDE · LIGHT'];
      ctx.fillText(sub || annotations[Math.floor(rnd() * annotations.length)], w * .5, h * .86);
      ctx.strokeStyle = 'rgba(170,190,210,.13)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w * .2, h * .8); ctx.lineTo(w * .8, h * .8); ctx.stroke();
      ctx.restore();
      grain(ctx, w, h, rnd, 10, -1);
      return toTexture(c);
    });
  }

  fish(variant = 0) {
    return this._get(`fish${variant}`, () => {
      const rnd = mulberry32(3389 + variant * 71);
      const w = 512, h = 512;
      const { c, ctx } = canvas2d(w, h);
      basePaper(ctx, w, h, rnd, variant === 2 ? '#dfe8ec' : '#e9e3d5', variant !== 2);
      ctx.save();
      ctx.globalAlpha = .26;
      ctx.font = `400 ${w * .2}px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(26,46,62,.8)';
      ctx.fillText(pick(rnd, ['鱼', '海', '远', '游', '月']), w * .5, h * .56);
      ctx.restore();
      for (let i = 0; i < 10; i++) {
        softBlob(ctx, rnd() * w, rnd() * h, w * (.03 + rnd() * .14),
          variant === 1 ? 'rgba(52,84,112,1)' : 'rgba(40,70,80,1)', .04 + rnd() * .06);
      }
      ctx.strokeStyle = 'rgba(60,80,92,.22)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(0, h * (.18 + i * .08));
        ctx.bezierCurveTo(w * .35, h * (.12 + i * .08), w * .6, h * (.26 + i * .07), w, h * (.16 + i * .08));
        ctx.stroke();
      }
      return toTexture(c);
    });
  }

  shard() {
    return this._get('shard', () => {
      const rnd = mulberry32(6161);
      const s = 256;
      const { c, ctx } = canvas2d(s, s);
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, 'rgba(220,236,248,.5)');
      g.addColorStop(.45, 'rgba(120,152,180,.12)');
      g.addColorStop(1, 'rgba(240,248,255,.36)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(235,246,255,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s * .1, s * .8); ctx.lineTo(s * .55, s * .12); ctx.lineTo(s * .9, s * .3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180,210,235,.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath(); ctx.moveTo(rnd() * s, 0); ctx.lineTo(rnd() * s, s); ctx.stroke();
      }
      return toTexture(c);
    });
  }

  lantern() {
    return this._get('lantern', () => {
      const rnd = mulberry32(2222);
      const w = 256, h = 384;
      const { c, ctx } = canvas2d(w, h);
      basePaper(ctx, w, h, rnd, '#d9c08a', true);
      ctx.strokeStyle = 'rgba(120,80,40,.2)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < w; x += w / 9) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.font = `400 ${w * .42}px ${SERIF}`;
      ctx.fillStyle = 'rgba(90,40,26,.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('灯', w / 2, h / 2);
      return toTexture(c);
    });
  }

  textMask(text, { font = `400 580px ${SERIF}`, width = 2048, height = 768, lineGap = 0 } = {}) {
    const key = `textmask-${text}-${font}`;
    return this._get(key, () => {
      const { c, ctx } = canvas2d(width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = `${width * .035}px`;
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, width / 2, height / 2 + (i - (lines.length - 1) / 2) * (height / (lines.length + .8) + lineGap));
      });
      const data = ctx.getImageData(0, 0, width, height).data;
      return { data, width, height };
    });
  }
}

export function createSpriteMaterial(tex, color = '#ffffff', opacity = 1, additive = true) {
  return new THREE.SpriteMaterial({
    map: tex,
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false
  });
}
