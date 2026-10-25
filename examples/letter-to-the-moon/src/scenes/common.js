import * as THREE from 'three';
import { CameraRig, orbitKeys } from '../core/camera.js';
import {
  createWaterMaterial, makeWater, createSkyMaterial, makeSky,
  createUnderwaterMaterial, addLights, makeShaft, PALETTE, col
} from '../core/materials.js';
import { makeMoon, makeDust, makeStars } from '../core/objects.js';
import { clamp01, smoothstep } from '../core/utils.js';

export function createScene({ fog = null, bg = '#02040a' } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  if (fog) scene.fog = new THREE.FogExp2(fog.color, fog.density);
  return scene;
}

export function createCamera(aspect, fov = 36) {
  return new THREE.PerspectiveCamera(fov, aspect, .04, 1600);
}

export function createRig(camera, opts = {}) {
  return new CameraRig(camera, { shake: .03, lookShake: .018, ...opts });
}

export function key(p, l, fov = 36, roll = 0) {
  return { p, l, fov, roll };
}

export function addSky(scene, tex, opts = {}, radius = 700) {
  const material = createSkyMaterial(opts);
  const sky = makeSky({ radius, material });
  scene.add(sky);
  return sky;
}

export function addSea(scene, tex, opts = {}) {
  const { size = 520, segments = 130, y = 0, uniforms = {} } = opts;
  const material = createWaterMaterial(uniforms);
  const sea = makeWater({ size, segments, y, material });
  scene.add(sea);
  return sea;
}

export function addMoon(scene, tex, { pos = [0, 40, -220], size = 40, halo = .6, ring = 0, ringColor, warm = 0 } = {}) {
  const moon = makeMoon(tex, { size, halo, ring, ringColor, warm });
  moon.position.set(...pos);
  scene.add(moon);
  return moon;
}

export function addStars(scene, tex, opts = {}) {
  const stars = makeStars(tex, opts);
  scene.add(stars);
  return stars;
}

export function addDust(scene, tex, opts = {}) {
  const dust = makeDust(tex, opts);
  scene.add(dust);
  return dust;
}

export function addShafts(scene, { count = 5, height = 90, width = 16, color = '#bfd6ec', opacity = .3, center = [0, 30, -10], seed = 1, spread = 34 } = {}) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const s = makeShaft({ width: width * (.6 + Math.random() * .8), height, color, opacity, seed: seed + i * 3.1 });
    s.position.set(
      center[0] + (Math.sin(i * 2.3 + seed) * spread),
      center[1] - height * .32,
      center[2] + (Math.cos(i * 1.7 + seed) * spread * .6)
    );
    s.rotation.z = (i % 2 ? 1 : -1) * (.12 + i * .03);
    s.userData.phase = i * 1.7 + seed;
    group.add(s);
  }
  group.userData.update = (t) => {
    group.children.forEach((s, i) => {
      s.material.uniforms.uTime.value = t;
      s.material.uniforms.uOpacity.value = opacity * (.7 + .3 * Math.sin(t * .22 + i * 1.3));
      s.rotation.z += 0;
    });
  };
  scene.add(group);
  return group;
}

export function addEnvLights(scene, moonPos = [0, 40, -200], opts = {}) {
  const dir = new THREE.Vector3(...moonPos).normalize();
  return addLights(scene, {
    moonDir: [dir.x * 80, dir.y * 80, dir.z * 80],
    ...opts
  });
}

export function billboardMoon(moon, camera) {
  if (moon) moon.userData.billboard(camera);
}

export function updateWater(water, t, extra = {}) {
  const u = water.material.uniforms;
  u.uTime.value = t;
  if (extra.moonDir) u.uMoonDir.value.copy(extra.moonDir).normalize();
  if (extra.ripple !== undefined) u.uRipple.value = extra.ripple;
  if (extra.rippleCenter) u.uRippleCenter.value.set(...extra.rippleCenter);
  if (extra.stars !== undefined) u.uStars.value = extra.stars;
}

export function updateSky(sky, t) {
  if (sky?.material?.uniforms?.uTime) sky.material.uniforms.uTime.value = t;
}

export function updateUnderwater(dome, t) {
  if (dome?.material?.uniforms?.uTime) dome.material.uniforms.uTime.value = t;
}

export function orbitView({ center = [0, 0, 0], radius = 30, y = 4, start = 0, end = 1.2, steps = 5, look = [0, 0, 0], fov = 36, roll = 0, ease } = {}) {
  const keys = [];
  const c = new THREE.Vector3(...center);
  for (let i = 0; i < steps; i++) {
    const p = steps === 1 ? 0 : i / (steps - 1);
    const a = start + (end - start) * p;
    const rr = typeof radius === 'function' ? radius(p) : radius;
    const yy = typeof y === 'function' ? y(p) : y;
    const ll = typeof look === 'function' ? look(p) : look;
    keys.push(key(
      [c.x + Math.cos(a) * rr, c.y + yy, c.z + Math.sin(a) * rr],
      ll,
      typeof fov === 'function' ? fov(p) : fov,
      typeof roll === 'function' ? roll(p) : roll
    ));
  }
  return { keys, ease };
}

export function addBokeh(scene, tex, { count = 26, center = [0, 2, -6], spread = 12, color = '#a8c7e2', seed = 4, strength = 1, size = 1 } = {}) {
  const group = new THREE.Group();
  const rnd = (n) => {
    let x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glow(), color: col(color), transparent: true,
      opacity: (.06 + rnd(i) * .12) * strength, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false
    }));
    s.scale.setScalar((1 + rnd(i + 9) * 4) * size);
    s.position.set(
      center[0] + (rnd(i + 1) - .5) * spread,
      center[1] + (rnd(i + 2) - .5) * spread * .7,
      center[2] + (rnd(i + 3) - .5) * spread
    );
    group.add(s);
  }
  scene.add(group);
  return group;
}
