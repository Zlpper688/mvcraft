import { CREDITS, FILM_TITLE } from '../data/subtitles.js';
import { clamp01, smoothstep } from './utils.js';

const SERIF = '"Noto Serif SC", "Songti SC", "STSong", serif';
const LATIN = '"Cormorant Garamond", "Times New Roman", serif';
const DW = 1920, DH = 804;

const OPEN = { start: 4.35, end: 14.1 };
const FINAL = { start: 299.9, end: 304.45 };
const END_MARK = { start: 306.2, end: 309.75 };

function alphaEnvelope(t, a, b, fadeIn, fadeOut) {
  if (t < a || t > b) return 0;
  const i = smoothstep(a, a + fadeIn, t);
  const o = 1 - smoothstep(b - fadeOut, b, t);
  return Math.min(i, o);
}

function drawTracked(ctx, text, cx, y, { tracking = 0, font, color, alpha = 1, baseline = 'alphabetic' }) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.textBaseline = baseline;
  ctx.textAlign = 'left';
  const chars = Array.from(text);
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let x = cx - total / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y);
    x += widths[i] + tracking;
  }
  ctx.restore();
  return total;
}

function drawLetterSpaced(ctx, text, cx, y, { size = 12, spacing = '0.3em', font = LATIN, color = '#fff', alpha = 1, style = '' }) {
  ctx.save();
  ctx.font = `${style} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing;
  ctx.fillText(text, cx, y);
  ctx.restore();
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export class FilmOverlay {
  constructor(cues = []) {
    this.cues = cues;
    this._lastCue = null;
  }

  draw(ctx, W, H, t, { showSubs = true, fade = 1, minimal = false } = {}) {
    if (fade <= .002) return;
    const s = H / DH;
    ctx.save();
    ctx.scale(s, s);
    ctx.globalAlpha = fade;
    ctx.textRendering = 'geometricPrecision';

    if (!minimal) this._prologueMark(ctx, t);
    if (showSubs) this._subtitle(ctx, t);
    this._openingTitle(ctx, W / s, t);
    this._finalTitle(ctx, W / s, t);
    this._endMark(ctx, W / s, H / s, t);

    ctx.restore();
  }

  _prologueMark(ctx, t) {
    const a = alphaEnvelope(t, 1.2, 18.6, 2.4, 2.2) * .26;
    if (a <= .001) return;
    const x = DW - 86, y0 = 148;
    const chars = ['墨', '潮', '·', '月', '信'];
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.font = `300 12px ${SERIF}`;
    ctx.fillStyle = '#dfe8f2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, y0 + i * 30);
    }
    ctx.strokeStyle = 'rgba(201,69,53,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 10, y0 + 5 * 30 - 4);
    ctx.lineTo(x + 10, y0 + 5 * 30 - 4);
    ctx.stroke();
    ctx.restore();
  }

  _openingTitle(ctx, W, t) {
    const a = alphaEnvelope(t, OPEN.start, OPEN.end, 2.3, 2.6);
    if (a <= .001) return;
    const cx = W / 2;
    const p = clamp01((t - OPEN.start) / 3.2);

    ctx.save();
    ctx.globalAlpha *= a;

    const kickerA = smoothstep(0, .35, p);
    drawLetterSpaced(ctx, 'WANG FEI   ·   潜流   ·   2009', cx, 226,
      { size: 11, spacing: '.42em', font: SERIF, color: 'rgba(226,235,245,.60)', alpha: kickerA });

    const ruleP = smoothstep(.08, .7, p);
    ctx.save();
    ctx.strokeStyle = `rgba(222,233,245,${.30 * ruleP})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 126 * ruleP, 266);
    ctx.lineTo(cx + 126 * ruleP, 266);
    ctx.stroke();
    ctx.fillStyle = `rgba(201,69,53,${.92 * ruleP})`;
    ctx.beginPath();
    ctx.arc(cx, 266, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const titleText = FILM_TITLE.cn;
    const chars = Array.from(titleText);
    ctx.save();
    ctx.font = `300 112px ${SERIF}`;
    ctx.fillStyle = '#F1F6FB';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const track = 34;
    const widths = chars.map(c => ctx.measureText(c).width);
    const total = widths.reduce((x, y) => x + y, 0) + track * (chars.length - 1);
    let x = cx - total / 2;
    for (let i = 0; i < chars.length; i++) {
      const q = clamp01((p - i * .11) / .55);
      const e = 1 - Math.pow(1 - q, 3);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.shadowColor = 'rgba(175,200,228,.35)';
      ctx.shadowBlur = 42;
      ctx.fillText(chars[i], x, 392 + (1 - e) * 16);
      ctx.restore();
      x += widths[i] + track;
    }
    ctx.restore();

    drawLetterSpaced(ctx, FILM_TITLE.subtitle, cx, 452,
      { size: 19, spacing: '.52em', font: LATIN, color: 'rgba(230,238,247,.76)', alpha: smoothstep(.35, .95, p) });
    drawTracked(ctx, FILM_TITLE.en, cx, 494,
      { tracking: 7.2, font: `400 13px ${SERIF}`, color: 'rgba(220,231,243,.46)', alpha: smoothstep(.45, 1, p) });
    drawTracked(ctx, '一封没有寄出的信，穿过墨海与月光。', cx, 534,
      { tracking: 4.2, font: `300 14px ${SERIF}`, color: 'rgba(222,232,244,.48)', alpha: smoothstep(.55, 1, p) });

    ctx.restore();
  }

  _subtitle(ctx, t) {
    let cue = null;
    for (let i = 0; i < this.cues.length; i++) {
      const c = this.cues[i];
      if (t >= c.start && t <= c.end) { cue = c; break; }
    }
    if (!cue) return;
    const fadeIn = Math.min(.8, (cue.end - cue.start) * .25);
    const fadeOut = Math.min(1.1, (cue.end - cue.start) * .3);
    const a = alphaEnvelope(t, cue.start, cue.end, fadeIn, fadeOut);
    if (a <= .001) return;
    const p = smoothstep(cue.start, cue.start + fadeIn, t);
    const cx = DW / 2;
    const isLong = Array.from(cue.cn || '').length > 14;
    const cnSize = isLong ? 27 : 31;
    const yCn = DH - 126;
    const yEn = DH - 99;

    ctx.save();
    ctx.globalAlpha *= a;

    const lum = this._regionLum(ctx, cx - 480, yCn - 86, 960, 132);
    const plate = smoothstep(.32, .66, lum) * .8;
    if (plate > .01) {
      ctx.save();
      ctx.translate(cx, yCn - 16);
      ctx.scale(1, .26);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 540);
      g.addColorStop(0, `rgba(6,10,16,${(.6 * plate).toFixed(3)})`);
      g.addColorStop(.55, `rgba(6,10,16,${(.34 * plate).toFixed(3)})`);
      g.addColorStop(1, 'rgba(6,10,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-540, -540, 1080, 1080);
      ctx.restore();
    }

    ctx.save();
    ctx.font = `400 ${cnSize}px ${SERIF}`;
    ctx.shadowColor = 'rgba(0,0,0,.92)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(244,248,252,.96)';
    ctx.translate(cx, yCn + (1 - p) * 8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${isLong ? 3.4 : 4.4}px`;
    ctx.strokeStyle = 'rgba(8,12,18,.34)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(cue.cn, 0, 0);
    ctx.fillText(cue.cn, 0, 0);
    ctx.restore();

    if (cue.en) {
      ctx.save();
      ctx.font = `italic 400 16px ${LATIN}`;
      ctx.shadowColor = 'rgba(0,0,0,.9)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = 'rgba(205,220,236,.70)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
      const maxW = DW * .72;
      let text = cue.en;
      if (ctx.measureText(text).width > maxW) {
        ctx.font = `italic 400 14px ${LATIN}`;
      }
      ctx.fillText(text, cx, yEn + (1 - p) * 5);
      ctx.restore();
    }
    ctx.restore();
  }

  _regionLum(ctx, x, y, w, h) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const sx = Math.max(0, Math.min(cw - 1, Math.round(x)));
    const sy = Math.max(0, Math.min(ch - 1, Math.round(y)));
    const sw = Math.max(1, Math.min(cw - sx, Math.round(w)));
    const sh = Math.max(1, Math.min(ch - sy, Math.round(h)));
    if (!this._probe) {
      this._probe = document.createElement('canvas');
      this._probe.width = 32;
      this._probe.height = 8;
      this._pctx = this._probe.getContext('2d', { willReadFrequently: true });
    }
    this._pctx.clearRect(0, 0, 32, 8);
    this._pctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, 32, 8);
    const d = this._pctx.getImageData(0, 0, 32, 8).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) * (d[i + 3] / 255);
    }
    return sum / (d.length / 4) / 255;
  }

  _finalTitle(ctx, W, t) {
    const a = alphaEnvelope(t, FINAL.start, FINAL.end, 1.5, 1.2);
    if (a <= .001) return;
    const p = clamp01((t - FINAL.start) / 2.2);
    const cx = W / 2;
    ctx.save();
    ctx.globalAlpha *= a;

    const chars = Array.from(FILM_TITLE.cn);
    ctx.font = `300 94px ${SERIF}`;
    const track = 28;
    const widths = chars.map(c => ctx.measureText(c).width);
    const total = widths.reduce((x, y) => x + y, 0) + track * (chars.length - 1);
    let x = cx - total / 2;
    ctx.fillStyle = '#F3F7FC';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < chars.length; i++) {
      const q = clamp01((p - i * .09) / .6);
      const e = 1 - Math.pow(1 - q, 3);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 34;
      ctx.fillText(chars[i], x, 322 + (1 - e) * 10);
      ctx.restore();
      x += widths[i] + track;
    }

    drawLetterSpaced(ctx, FILM_TITLE.subtitle, cx, 378,
      { size: 17, spacing: '.5em', font: LATIN, color: 'rgba(228,237,247,.68)', alpha: smoothstep(.2, .8, p) });

    ctx.save();
    ctx.strokeStyle = 'rgba(201,69,53,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const rw = 84 * smoothstep(.15, .75, p);
    ctx.moveTo(cx - rw, 408);
    ctx.lineTo(cx + rw, 408);
    ctx.stroke();
    ctx.restore();

    const creditA = smoothstep(.35, .95, p);
    ctx.save();
    ctx.globalAlpha *= creditA;
    ctx.textAlign = 'center';
    ctx.font = `400 12.5px ${SERIF}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2.6px';
    ctx.fillStyle = 'rgba(220,231,243,.62)';
    ctx.fillText('曲 张亚东　·　词 萧玮　·　唱 王菲　·　收录《潜流》 2009', cx, 454);
    ctx.fillStyle = 'rgba(196,211,226,.42)';
    ctx.font = `300 11px ${SERIF}`;
    ctx.fillText('视觉  程序生成影像习作　·　字幕  原创诗行', cx, 480);
    ctx.fillStyle = 'rgba(196,211,226,.30)';
    ctx.font = `400 10px ${SERIF}`;
    ctx.fillText('A LETTER TO THE MOON', cx, 510);
    ctx.restore();

    ctx.restore();
  }

  _endMark(ctx, W, H, t) {
    const a = alphaEnvelope(t, END_MARK.start, END_MARK.end, 1.2, 1.2);
    if (a <= .001) return;
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = 'rgba(201,69,53,.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 48, cy - 36);
    ctx.lineTo(cx + 48, cy - 36);
    ctx.stroke();
    drawTracked(ctx, '我爱你', cx, cy + 10, {
      tracking: 16, font: `300 32px ${SERIF}`, color: 'rgba(234,241,248,.8)'
    });
    drawLetterSpaced(ctx, 'A LETTER TO THE MOON', cx, cy + 54,
      { size: 10.5, spacing: '.5em', font: LATIN, color: 'rgba(196,211,228,.4)' });
    ctx.restore();
  }
}

export { CREDITS };
