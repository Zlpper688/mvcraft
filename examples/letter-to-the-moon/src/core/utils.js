export const PI2 = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const clamp01 = x => clamp(x, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (x - a) / (b - a || 1);
export const remap = (x, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, x)));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a || 1)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = clamp01((x - a) / (b - a || 1)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const mix = lerp;

export const easeInOutSine = t => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
export const easeInOutCubic = t => { t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeInOutQuint = t => { t = clamp01(t); return t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2; };
export const easeOutCubic = t => 1 - Math.pow(1 - clamp01(t), 3);
export const easeOutQuint = t => 1 - Math.pow(1 - clamp01(t), 5);
export const easeInCubic = t => Math.pow(clamp01(t), 3);
export const easeOutExpo = t => { t = clamp01(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
export const easeInOutExpo = t => {
  t = clamp01(t);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
};

export const envelope = (t, start, end, fadeIn = .8, fadeOut = 1) => {
  if (t < start || t > end) return 0;
  const a = fadeIn > 0 ? smoothstep(start, start + fadeIn, t) : 1;
  const b = fadeOut > 0 ? 1 - smoothstep(end - fadeOut, end, t) : 1;
  return Math.min(a, b);
};

export const expPulse = (dt, decay) => dt < 0 ? 0 : Math.exp(-dt / Math.max(.0001, decay));

export const fract = x => x - Math.floor(x);

export function hash1(n) {
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return fract(n);
}

export function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}

export function fbm1(x, oct = 4) {
  let v = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * noise1(x * f + i * 19.1); f *= 2.03; a *= .5; }
  return v;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rnd, a, b) => a + (b - a) * rnd();
export const pick = (rnd, arr) => arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))];

export const formatTime = (t, withHours = false) => {
  t = Math.max(0, t || 0);
  const h = Math.floor(t / 3600);
  const m = Math.floor(t / 60) % 60;
  const s = Math.floor(t % 60);
  if (withHours) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const nextFrame = () => new Promise(r => requestAnimationFrame(r));
export const idle = (ms = 0) => new Promise(r => setTimeout(r, ms));

export function weightedPick(rnd, entries) {
  let sum = 0;
  for (const e of entries) sum += e.w;
  let x = rnd() * sum;
  for (const e of entries) { x -= e.w; if (x <= 0) return e.v; }
  return entries[entries.length - 1].v;
}

export function smoothArray(arr, radius = 2) {
  if (radius <= 0) return arr;
  const out = new Float32Array(arr.length);
  let sum = 0, count = 0;
  for (let i = 0; i < arr.length; i++) {
    out[i] = arr[i];
  }
  for (let i = 0; i < arr.length; i++) {
    sum = 0; count = 0;
    for (let j = -radius; j <= radius; j++) {
      const k = i + j;
      if (k >= 0 && k < arr.length) { sum += arr[k]; count++; }
    }
    out[i] = sum / count;
  }
  return out;
}

export function fitCameraDistance(objectHeight, cameraFovDeg, frameHeightFraction = .7) {
  const vFov = cameraFovDeg * Math.PI / 180;
  return (objectHeight / frameHeightFraction) / (2 * Math.tan(vFov / 2));
}
