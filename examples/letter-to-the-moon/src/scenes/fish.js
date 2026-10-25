import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSky, addDust, addShafts,
  addEnvLights, updateUnderwater, addBokeh
} from './common.js';
import {
  makeEnvelope, makeFishSchool, makeBubbles, makeThread, makeGlint
} from '../core/objects.js';
import { createUnderwaterMaterial, makeSky, col } from '../core/materials.js';
import { TYPE_GLYPHS } from '../data/glyphs.js';
import { ASPECT } from '../data/shots.js';
import { mulberry32, pick } from '../core/utils.js';

export function createFish({ tex }) {
  const scene = createScene({ fog: { color: '#030b14', density: .02 } });
  const camera = createCamera(ASPECT, 36);
  const rig = createRig(camera, { shake: .025, lookShake: .02 });

  const domeMat = createUnderwaterMaterial({
    top: '#1b3b56', mid: '#071726', deep: '#010408',
    glowColor: '#d3e7f7', moonDir: [.2, 1, -.2], caustic: 1
  });
  const dome = makeSky({ radius: 520, material: domeMat });
  scene.add(dome);

  addEnvLights(scene, [10, 60, 18], {
    moonIntensity: 1.8, hemi: .7, ambient: '#0a1b28',
    rimColor: '#507a9a', rimIntensity: .9, accentColor: '#4f7896',
    accentPos: [0, 4, -5], accentIntensity: 16, accentDistance: 20
  });

  const shafts = addShafts(scene, {
    count: 7, height: 130, width: 22, color: '#9dbcD4',
    opacity: .09, center: [0, 40, -16], spread: 48, seed: 8
  });

  const env = makeEnvelope(tex, { scale: 1.15, pageVariant: 2, sealGlyph: '爱' });
  env.position.set(0, .1, -.4);
  env.rotation.set(.05, .12, -.06);
  scene.add(env);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#9fc6e2'), transparent: true, opacity: .1,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  halo.scale.setScalar(4.6);
  halo.position.set(0, .2, -1.2);
  scene.add(halo);

  const school = makeFishSchool(tex, { count: 15, center: [0, 0, 0], spread: 12, hero: 2, seed: 27 });
  scene.add(school);

  const bubbles = makeBubbles(tex, {
    count: 240, spread: 24, height: 34, center: [0, 2, 0],
    size: .95, opacity: .2, seed: 19, rise: .5
  });
  scene.add(bubbles);

  const dust = addDust(scene, tex, {
    count: 280, area: [32, 22, 34], center: [0, 1, 0],
    size: .9, opacity: .16, seed: 21, drift: .7, sizeScale: 30
  });
  addBokeh(scene, tex, { count: 8, center: [0, 1, -4], spread: 18, color: '#7ea3c0', strength: .55, size: .8 });

  const glyphs = new THREE.Group();
  const rnd = mulberry32(91);
  const glyphSprites = [];
  for (let i = 0; i < 16; i++) {
    const ch = pick(rnd, TYPE_GLYPHS);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glyph(ch, { mode: 'glow', color: '#8db4cc' }),
      transparent: true, opacity: .08 + rnd() * .09,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    const a = rnd() * Math.PI * 2;
    const r = 9 + rnd() * 20;
    spr.position.set(Math.cos(a) * r, (rnd() - .5) * 13, Math.sin(a) * r);
    spr.scale.setScalar(.5 + rnd() * 1.3);
    spr.userData = { a, r, y: spr.position.y, speed: .03 + rnd() * .05, base: spr.material.opacity };
    glyphs.add(spr);
    glyphSprites.push(spr);
  }
  scene.add(glyphs);

  const threads = new THREE.Group();
  [
    [[-16, 8, -12], [-6, 3, -6], [3, -3.5, -2], [15, -6, 4]],
    [[14, 10, -14], [6, 5, -8], [-2, 1.5, -3], [-14, -2, 2]]
  ].forEach((pts, i) => {
    const th = makeThread(tex, pts, { radius: .006, colorA: '#4d100a', colorB: '#ad3423' });
    th.userData.phase = i;
    threads.add(th);
  });
  scene.add(threads);

  const glint = makeGlint(tex, '#e5d3b4', 1.15, .2);
  glint.position.set(0, .55, 0);
  scene.add(glint);

  const views = {
    track: {
      keys: [
        key([-15, 2.6, 15.5], [0, 0, 0], 36, .015),
        key([-8, .4, 14.2], [0, .2, 0], 34, .005),
        key([1, 1.9, 13.4], [0, .1, 0], 32, -.01),
        key([9, .2, 11.4], [0, -.3, 0], 30, -.022),
        key([13, 1.4, 8.6], [0, .1, -.4], 30, -.012)
      ]
    },
    close: {
      keys: [
        key([-4.2, 1.1, 3.4], [0, .15, 0], 31, -.02),
        key([-2.3, .1, 4.9], [0, .05, 0], 30, -.008),
        key([.6, 1.4, 5.1], [0, .2, 0], 29, .006),
        key([3.4, .2, 3.9], [0, .05, 0], 28, .02),
        key([4.4, 1.2, 1.7], [0, .2, 0], 28, .03)
      ]
    }
  };

  let active = 'track';
  function setView(v) {
    active = views[v] ? v : 'track';
    rig.set(views[active].keys);
  }
  setView('track');

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const bass = analysis.bass(t);
    const pulse = analysis.pulse(t, .55, 1.9);
    const beat = analysis.beatPulse(t, 5);

    updateUnderwater(dome, t);
    dust.userData.update(t, energy);
    bubbles.userData.update(t);
    shafts.userData.update(t);

    env.position.y = .1 + Math.sin(t * .42) * .16;
    env.rotation.x = .05 + Math.sin(t * .31) * .05;
    env.rotation.y = .12 + Math.sin(t * .2 + .5) * .12;
    env.rotation.z = -.06 + Math.sin(t * .26) * .05;
    env.userData.setGlow(.1 + pulse * .65);
    halo.position.set(env.position.x, env.position.y, env.position.z - .8);
    halo.material.opacity = .075 + pulse * .06;
    glint.position.set(0, env.position.y + .4, 0);
    glint.material.opacity = .12 + pulse * .15;

    school.userData.update(t, energy * .8 + .2);
    threads.children.forEach((th) => th.userData.update(t, energy, pulse));
    glyphs.rotation.y = t * .012;

    glyphSprites.forEach((s, i) => {
      const u = s.userData;
      const a = u.a + t * u.speed;
      s.position.x = Math.cos(a) * u.r;
      s.position.z = Math.sin(a) * u.r;
      s.position.y = u.y + Math.sin(t * .35 + i) * .5;
      s.material.opacity = u.base * (.45 + .55 * (0.5 + 0.5 * Math.sin(t * .8 + i * 1.7)));
    });

    rig.shake = .016 + energy * .03;
    rig.lookShake = .012 + energy * .014;
    rig.positionBias.set(
      Math.sin(t * .7) * .05,
      Math.sin(t * .9 + 1) * .035 + beat * .015,
      0
    );
    rig.lookBias.set(0, Math.sin(t * .55) * .04, 0);
    rig.fovBias = pulse * .55;

    return {
      bloom: .54, bloomRadius: .76, bloomThreshold: .84,
      exposure: .95, contrast: 1.06, saturation: 1.0,
      vignette: .47, grain: .023, aberration: .18
    };
  }

  return {
    id: 'fish', scene, camera, rig, views, setView, update,
    post: { bloom: .54, bloomRadius: .76, bloomThreshold: .84, exposure: .95, contrast: 1.06, saturation: 1.0, vignette: .47, grain: .023, aberration: .18 }
  };
}
