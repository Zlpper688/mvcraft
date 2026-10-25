import * as THREE from 'three';
import { clamp01, easeInOutCubic, lerp, smoothstep } from './utils.js';

const V3 = (p) => p && p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]);

export class CameraRig {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.keys = null;
    this.posCurve = null;
    this.lookCurve = null;
    this.easeFn = opts.ease || easeInOutCubic;
    this.shake = opts.shake ?? .035;
    this.lookShake = opts.lookShake ?? .02;
    this.rollShake = opts.rollShake ?? .0018;
    this.seed = opts.seed ?? 3.1;
    this.fovBias = 0;
    this.rollBias = 0;
    this.positionBias = new THREE.Vector3();
    this.lookBias = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  set(keys, opts = {}) {
    this.keys = keys.map(k => ({
      p: V3(k.p),
      l: V3(k.l || k.look || [0, 0, 0]),
      fov: k.fov ?? 35,
      roll: k.roll ?? 0
    }));
    if (this.keys.length >= 2) {
      this.posCurve = new THREE.CatmullRomCurve3(this.keys.map(k => k.p), false, 'centripetal', .5);
      this.lookCurve = new THREE.CatmullRomCurve3(this.keys.map(k => k.l), false, 'centripetal', .5);
    } else {
      this.posCurve = null;
      this.lookCurve = null;
    }
    if (opts.ease) this.easeFn = opts.ease;
    if (opts.shake !== undefined) this.shake = opts.shake;
    if (opts.lookShake !== undefined) this.lookShake = opts.lookShake;
    if (opts.rollShake !== undefined) this.rollShake = opts.rollShake;
    this.fovBias = 0;
    this.rollBias = 0;
    this.positionBias.set(0, 0, 0);
    this.lookBias.set(0, 0, 0);
    return this;
  }

  update(progress, time = 0, energy = .4) {
    if (!this.keys || !this.keys.length) return;
    const u = this.easeFn(clamp01(progress));
    const n = this.keys.length;
    if (n >= 2 && this.posCurve) {
      this.posCurve.getPoint(u, this._pos);
      this.lookCurve.getPoint(u, this._look);
    } else {
      this._pos.copy(this.keys[0].p);
      this._look.copy(this.keys[0].l);
    }

    const f = u * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const ff = n > 1 ? smoothstep(0, 1, f - i) : 0;
    const fov = lerp(this.keys[Math.max(0, i)].fov, this.keys[Math.min(n - 1, i + 1)].fov, ff);
    const roll = lerp(this.keys[Math.max(0, i)].roll, this.keys[Math.min(n - 1, i + 1)].roll, ff);

    const amp = this.shake * (.55 + energy * .9);
    const t = time + this.seed * 7.3;
    const sx = (Math.sin(t * .73) + Math.sin(t * 1.37 + 1.7) * .45 + Math.sin(t * 2.11 + 4.2) * .16) * amp;
    const sy = (Math.sin(t * .61 + 2.2) + Math.sin(t * 1.19 + 5.1) * .4) * amp * .7;
    const sz = (Math.sin(t * .47 + 4.4) + Math.sin(t * 1.61 + 2.3) * .3) * amp * .5;

    this._pos.add(this.positionBias).add(this._tmp.set(sx, sy, sz));
    const lx = Math.sin(t * .53 + 1.1) * this.lookShake * (.4 + energy);
    const ly = Math.cos(t * .67 + 2.9) * this.lookShake * (.4 + energy);
    this._look.add(this.lookBias).add(this._tmp.set(lx, ly, 0));

    this.camera.position.copy(this._pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._look);
    const rr = roll + this.rollBias + Math.sin(t * .31) * this.rollShake;
    if (rr) this.camera.rotateZ(rr);
    this.camera.fov = fov + this.fovBias;
    this.camera.updateProjectionMatrix();
  }
}

export function orbitKeys({
  center = [0, 0, 0], radius = 8, height = 2, start = 0, end = Math.PI * 1.2,
  steps = 5, look = [0, 0, 0], fov = 38, roll = 0, yWave = 0
} = {}) {
  const keys = [];
  const c = V3(center);
  for (let i = 0; i < steps; i++) {
    const a = lerp(start, end, steps === 1 ? 0 : i / (steps - 1));
    const r = typeof radius === 'function' ? radius(i / (steps - 1)) : radius;
    const h = typeof height === 'function' ? height(i / (steps - 1)) : height;
    keys.push({
      p: [c.x + Math.cos(a) * r, c.y + h + Math.sin(i * .9) * yWave, c.z + Math.sin(a) * r],
      l: Array.isArray(look) ? look : look(i / (steps - 1)),
      fov: typeof fov === 'function' ? fov(i / (steps - 1)) : fov,
      roll: typeof roll === 'function' ? roll(i / (steps - 1)) : roll
    });
  }
  return keys;
}

export function clampFov(fov, min = 10, max = 90) {
  return Math.max(min, Math.min(max, fov));
}
