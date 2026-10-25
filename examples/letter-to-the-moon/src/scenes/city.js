import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSea, addMoon, addDust, addStars,
  addEnvLights, billboardMoon, updateWater, addBokeh
} from './common.js';
import {
  makeEnvelope, makeGlyphSlab, makeThread, makePaperScraps, makeGlint
} from '../core/objects.js';
import { col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, mulberry32, smoothstep } from '../core/utils.js';

const CHARS = ['爱', '念', '月', '海', '信', '你', '我', '等', '风', '雨', '夜', '光', '远', '字', '潮', '心'];

export function createCity({ tex }) {
  const scene = createScene({ fog: { color: '#050a13', density: .021 } });
  const camera = createCamera(ASPECT, 42);
  const rig = createRig(camera, { shake: .014, lookShake: .01 });

  const sea = addSea(scene, tex, {
    size: 220, segments: 120, y: -.5,
    uniforms: {
      deep: '#010307', surface: '#061019', horizon: '#030911', deepTint: '#000203',
      moonColor: '#b9cfe2', moonDir: [0, 20, -100], moonPower: .45,
      ink: 1, glitter: .22, fogDensity: .028, swell: .3, chop: .3
    }
  });
  const moon = addMoon(scene, tex, { pos: [0, 19, -104], size: 26, halo: .55 });
  addStars(scene, tex, { count: 700, radius: 300, color: '#c8d9ec', size: .8, seed: 77, opacity: .35 });
  addEnvLights(scene, [0, 20, -100], {
    moonIntensity: 1.5, hemi: .3, ambient: '#070e18', rimColor: '#476480', rimIntensity: .6
  });

  const rnd = mulberry32(9021);
  const steles = [];
  for (let i = 0; i < 24; i++) {
    const side = i % 2 ? 1 : -1;
    const row = Math.floor(i / 2);
    const z = 14 - row * 6.4 + (rnd() - .5) * 2.2;
    const x = side * (8.5 + rnd() * 5.5);
    const h = 13 + rnd() * 19;
    const w = 4.6 + rnd() * 2.6;
    const ch = CHARS[Math.floor(rnd() * CHARS.length)];
    const slab = makeGlyphSlab(tex, {
      char: ch, w, h, d: 2.2 + rnd() * 1.4, color: '#9db4c8', stone: '#0c1420',
      seed: 20 + i, glow: .1 + rnd() * .12, seal: rnd() > .7
    });
    slab.position.set(x, h / 2 - .5, z);
    slab.rotation.y = -side * (.06 + rnd() * .16) + (rnd() - .5) * .08;
    scene.add(slab);
    steles.push({ slab, baseZ: z });
  }

  const gate = makeGlyphSlab(tex, {
    char: '爱', w: 23, h: 36, d: 4, color: '#b9cede', stone: '#060b12',
    seed: 3, glow: .3, seal: true
  });
  gate.position.set(0, 12, -66);
  gate.rotation.y = 0;
  scene.add(gate);

  const gateGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#d9e7f3'), transparent: true, opacity: .26,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  gateGlow.scale.setScalar(46);
  gateGlow.position.set(0, 14, -69);
  scene.add(gateGlow);

  const guide = makeThread(tex, [
    [0, 5.5, 18], [2.2, 5.2, 8], [-1.8, 5.6, -3], [2.6, 5.1, -16], [-1.2, 5.8, -30],
    [1.4, 5.4, -44], [0, 6.2, -56]
  ], { radius: .01, colorA: '#4a0d08', colorB: '#b83a28' });
  scene.add(guide);

  const env = makeEnvelope(tex, { scale: 1.08, pageVariant: 1, sealGlyph: '爱' });
  env.rotation.set(-.14, .1, .05);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffd4a4'), transparent: true, opacity: .16,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(3.6);
  scene.add(envGlow);

  const glint = makeGlint(tex, '#e2d4b8', 1.3, .26);
  scene.add(glint);

  const scraps = makePaperScraps(tex, {
    count: 46, area: [26, 20, 50], center: [0, 10, -22], seed: 88, fall: .25
  });
  scene.add(scraps);

  const dust = addDust(scene, tex, {
    count: 700, area: [30, 26, 60], center: [0, 9, -22], size: 1.0,
    opacity: .2, seed: 67, drift: .8, sizeScale: 34
  });
  addBokeh(scene, tex, { count: 8, center: [0, 8, -20], spread: 24, color: '#7797b2', strength: .5, size: .8 });

  const views = {
    fly: {
      keys: [
        key([0, 6.2, 27], [0, 6.2, 6], 42, -.01),
        key([1.2, 6.4, 16], [0, 6.4, -4], 41, .01),
        key([-.8, 6.8, 4], [0, 6.8, -16], 40, .018),
        key([1.6, 6.4, -8], [0, 7.4, -32], 40, .008),
        key([0, 6.8, -16], [0, 8.8, -48], 42, -.006)
      ]
    },
    plunge: {
      keys: [
        key([0, 6.6, -6], [0, 9.2, -52], 42, 0),
        key([.6, 6.2, -24], [0, 10.6, -58], 47, -.03),
        key([.2, 4.8, -40], [0, 11.2, -63], 53, -.07),
        key([0, 2.6, -50], [0, 10.4, -66], 59, -.1)
      ]
    }
  };

  let active = 'fly';
  function setView(v) {
    active = views[v] ? v : 'fly';
    rig.set(views[active].keys);
    guide.visible = active === 'fly';
  }
  setView('fly');

  const moonDir = new THREE.Vector3(0, 19, -104).normalize();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .6, 2);
    const beat = analysis.beatPulse(t, 5);
    updateWater(sea, t, { moonDir, ripple: .5 + pulse * .5 });
    billboardMoon(moon, camera);
    scraps.userData.update(t);
    dust.userData.update(t, energy);
    guide.userData.update(t, energy, pulse);
    guide.userData.setCamera(camera);

    const flight = clamp01((t - 164.04) / 16);
    const z = 17 - flight * 72;
    const x = Math.sin(t * .22) * 2.4;
    env.position.set(x, 5.7 + Math.sin(t * .5) * .14, z);
    env.rotation.set(-.14 + Math.sin(t * .4) * .04, .1 + Math.sin(t * .26) * .1, .05 + Math.sin(t * .33) * .04);
    env.userData.setGlow(.1 + pulse * .5);
    envGlow.position.set(x, env.position.y + .1, z - .3);
    envGlow.material.opacity = .13 + pulse * .1;
    glint.position.set(x, env.position.y + .35, z + .3);
    glint.material.opacity = .16 + pulse * .2;

    const fade = smoothstep(175.2, 177.8, t);
    env.userData.setOpacity(1 - fade * .9);
    envGlow.material.opacity *= 1 - fade;
    glint.material.opacity *= 1 - fade;

    gateGlow.material.opacity = .2 + pulse * .12;
    steles.forEach((s) => {
      s.slab.rotation.z = Math.sin(t * .18 + s.baseZ) * .003;
    });

    rig.shake = .01 + energy * .022;
    rig.lookShake = .008 + energy * .012;
    rig.positionBias.x = Math.sin(t * .6) * .05;
    rig.fovBias = pulse * .5;

    return {
      bloom: .56, bloomRadius: .78, bloomThreshold: .8,
      exposure: .93, contrast: 1.08, saturation: .98,
      vignette: .46, grain: .024, aberration: .22
    };
  }

  return {
    id: 'city', scene, camera, rig, views, setView, update,
    post: { bloom: .56, bloomRadius: .78, bloomThreshold: .8, exposure: .93, contrast: 1.08, saturation: .98, vignette: .46, grain: .024, aberration: .22 }
  };
}
