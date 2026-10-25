import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addDust, addShafts, addEnvLights,
  addBokeh, updateUnderwater
} from './common.js';
import {
  makeEnvelope, makeBubbles, makeGlyphSlab, makePaperScraps, makeGlint
} from '../core/objects.js';
import { createUnderwaterMaterial, makeSky, col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, mulberry32 } from '../core/utils.js';

const CHARS = ['爱', '念', '月', '海', '信', '你', '我', '等', '夜', '光'];

export function createDescent({ tex }) {
  const scene = createScene({ fog: { color: '#02060b', density: .028 } });
  const camera = createCamera(ASPECT, 40);
  const rig = createRig(camera, { shake: .02, lookShake: .016 });

  const dome = makeSky({ radius: 300, material: createUnderwaterMaterial({
    top: '#1c3b54', mid: '#071725', deep: '#010305',
    glowColor: '#cfe4f4', moonDir: [.05, 1, -.1], caustic: 1
  }) });
  scene.add(dome);

  addEnvLights(scene, [0, 40, -10], {
    moonIntensity: 1.4, hemi: .5, ambient: '#07131d', rimColor: '#4d7796', rimIntensity: .7
  });

  const shafts = addShafts(scene, {
    count: 7, height: 120, width: 20, color: '#a9cde2',
    opacity: .12, center: [0, 40, -8], spread: 34, seed: 21
  });

  const bubbles = makeBubbles(tex, {
    count: 520, spread: 17, height: 52, center: [0, 4, -2],
    size: 1.1, opacity: .3, seed: 33, rise: .9, color: '#c4e2f2'
  });
  scene.add(bubbles);

  const dust = addDust(scene, tex, {
    count: 700, area: [26, 46, 26], center: [0, 4, -2], size: .9,
    opacity: .18, seed: 91, drift: 1.2, sizeScale: 30
  });
  addBokeh(scene, tex, { count: 12, center: [0, 4, -3], spread: 18, color: '#7fa8c4', strength: .6, size: .85 });

  const slabs = [];
  const rnd = mulberry32(445);
  for (let i = 0; i < 10; i++) {
    const ch = CHARS[i % CHARS.length];
    const slab = makeGlyphSlab(tex, {
      char: ch, w: 1.6 + rnd() * 2.2, h: 3.6 + rnd() * 5, d: .8,
      color: '#89a5ba', stone: '#08111b', seed: 40 + i, glow: .08
    });
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * 10;
    slab.position.set(Math.cos(a) * r, -10 + rnd() * 28, Math.sin(a) * r - 3);
    slab.rotation.set(rnd() * 2, rnd() * 6, rnd() * 2);
    slab.userData.baseY = slab.position.y;
    slab.userData.spin = [(rnd() - .5) * .2, (rnd() - .5) * .3, (rnd() - .5) * .2];
    slab.userData.phase = rnd() * 9;
    scene.add(slab);
    slabs.push(slab);
  }

  const scraps = makePaperScraps(tex, {
    count: 42, area: [20, 30, 20], center: [0, 4, -2], seed: 93, fall: -.35
  });
  scene.add(scraps);

  const env = makeEnvelope(tex, { scale: 1.6, pageVariant: 2, sealGlyph: '爱' });
  env.rotation.set(.1, .3, -.06);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#d5e6f3'), transparent: true, opacity: .15,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(5);
  scene.add(envGlow);

  const glint = makeGlint(tex, '#d8ecf8', 1.4, .25);
  scene.add(glint);

  const views = {
    fall: {
      keys: [
        key([0, 28, 13], [0, 10, -3], 40, 0),
        key([.6, 20, 9], [0, 3, -2], 44, .16),
        key([-.5, 11, 5], [0, -3, -1], 48, .7),
        key([.4, 2, 1], [0, -7, 0], 52, 1.9),
        key([0, -5, -1], [0, 2, -1], 50, 3.05)
      ]
    }
  };

  let active = 'fall';
  function setView(v) {
    active = views[v] ? v : 'fall';
    rig.set(views[active].keys);
  }
  setView('fall');

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .5, 1.8);
    updateUnderwater(dome, t);
    bubbles.userData.update(t);
    dust.userData.update(t, energy);
    shafts.userData.update(t);
    scraps.userData.update(t);

    slabs.forEach((s, i) => {
      s.rotation.x += 0;
      s.rotation.x = Math.sin(t * .2 + s.userData.phase) * .5;
      s.rotation.z = Math.sin(t * .16 + i) * .4;
      s.position.y = s.userData.baseY + Math.sin(t * .3 + i) * .6;
    });

    const fall = clamp01((t - 180.2) / 14.8);
    env.position.set(
      Math.sin(t * .4) * .5,
      12 - fall * 18 + Math.sin(t * .7) * .2,
      3 - fall * 6
    );
    env.rotation.set(.1 + Math.sin(t * .6) * .18 + fall * .4, .3 + Math.sin(t * .3) * .6 + fall * 1.4, -.06 + Math.cos(t * .5) * .14);
    env.userData.setGlow(.08 + pulse * .35);
    envGlow.position.copy(env.position);
    envGlow.position.z -= .2;
    envGlow.material.opacity = .1 + pulse * .08;
    glint.position.set(env.position.x, env.position.y + .3, env.position.z + .2);
    glint.material.opacity = .12 + pulse * .14;

    rig.shake = .014 + energy * .03;
    rig.lookShake = .012 + energy * .016;
    rig.positionBias.set(Math.sin(t * .9) * .06, Math.cos(t * .8) * .04, 0);
    rig.fovBias = pulse * .8;

    return {
      bloom: .58, bloomRadius: .8, bloomThreshold: .8,
      exposure: .96, contrast: 1.06, saturation: .96,
      vignette: .46, grain: .026, aberration: .24
    };
  }

  return {
    id: 'descent', scene, camera, rig, views, setView, update,
    post: { bloom: .58, bloomRadius: .8, bloomThreshold: .8, exposure: .96, contrast: 1.06, saturation: .96, vignette: .46, grain: .026, aberration: .24 }
  };
}
