import { clamp, clamp01, hash1, lerp } from './utils.js';

export class Analysis {
  constructor(raw) {
    this.raw = raw;
    this.duration = raw.duration;
    this.fps = raw.fps;
    this.bands = raw.bands;
    this.rms = raw.rms;
    this.flux = raw.flux;
    this.vocal = raw.vocal;
    this.onsets = raw.onsets || [];
    this.silences = raw.silences || [];
    this.tempo = raw.tempo || 72;
    this.beat = 60 / this.tempo;
    this.beatPhase = 0.71;
    this._n = this.rms.length;
    this._lastOnset = new Float32Array(this._n);
    for (let i = 0; i < this._n; i++) this._lastOnset[i] = -99;
    for (const o of this.onsets) {
      const i = Math.round(o.t * this.fps);
      if (i >= 0 && i < this._n) this._lastOnset[i] = o.t;
    }
    let last = -99;
    for (let i = 0; i < this._n; i++) {
      if (this._lastOnset[i] > last) last = this._lastOnset[i];
      else this._lastOnset[i] = last;
    }
    this._onsetTimes = this.onsets.map(o => o.t);
  }

  _sample(arr, t) {
    const x = clamp(t, 0, this.duration) * this.fps;
    const i = Math.floor(x);
    const j = Math.min(this._n - 1, i + 1);
    const f = x - i;
    const a = arr[i] ?? 0, b = arr[j] ?? a;
    return lerp(a, b, f);
  }

  band(name, t) { return this._sample(this.bands[name] || this.rms, t); }
  get energy() { return this.rms; }
  at(t) { return this._sample(this.rms, t); }
  vocalAt(t) { return this._sample(this.vocal, t); }
  fluxAt(t) { return this._sample(this.flux, t); }
  getAir(t) { return this.band('air', t); }

  bass(t) { return this.band('low', t) * .65 + this.band('sub', t) * .35; }
  mid(t) { return this.band('midlow', t) * .45 + this.band('mid', t) * .55; }
  high(t) { return this.band('high', t) * .65 + this.band('air', t) * .35; }

  // sum of recent onsets, deterministic; used for light/particle pulses
  pulse(t, decay = .6, window = 1.8) {
    let sum = 0;
    const times = this._onsetTimes;
    let lo = 0, hi = times.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    for (let i = idx; i >= 0; i--) {
      const dt = t - times[i];
      if (dt > window) break;
      const s = this.onsets[i].s || .5;
      sum += Math.exp(-dt / decay) * s;
    }
    return clamp01(sum * .55);
  }

  lastOnset(t) {
    const x = Math.floor(clamp(t, 0, this.duration) * this.fps);
    return this._lastOnset[x] ?? -99;
  }

  beatPhaseAt(t) {
    return ((t - this.beatPhase) / this.beat + 4) % 1;
  }

  beatPulse(t, sharpness = 6) {
    const p = this.beatPhaseAt(t);
    return Math.exp(-p * sharpness);
  }

  barPhaseAt(t) {
    return ((t - this.beatPhase) / (this.beat * 4) + 4) % 1;
  }

  // slow section energy with a small lookahead so scenes can breathe before a hit
  mood(t) {
    return clamp01(this.at(t) * .55 + this.bass(t) * .25 + this.high(t) * .2);
  }

  phraseIndex(t) {
    let n = 0;
    for (const o of this.onsets) if (o.t <= t) n++;
    return n;
  }

  randomAt(seed, t) {
    return hash1(Math.floor(t * 7 + seed * 19.7));
  }
}

export async function loadAnalysis(url = '/analysis/analysis.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error('analysis.json missing');
  const raw = await r.json();
  return new Analysis(raw);
}
