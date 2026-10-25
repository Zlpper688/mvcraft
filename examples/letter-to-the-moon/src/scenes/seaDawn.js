import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSky, addSea, addMoon, addStars,
  addEnvLights, addDust, billboardMoon, updateWater, updateSky, addBokeh
} from './common.js';
import { makeThread, makePaperScraps, makeGlint } from '../core/objects.js';
import { col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, smoothstep } from '../core/utils.js';

export function createSeaDawn({ tex }) {
  const scene = createScene({ fog: { color: '#0a1018', density: .0105 } });
  const camera = createCamera(ASPECT, 42);
  const rig = createRig(camera, { shake: .005, lookShake: .004 });

  const sky = addSky(scene, tex, {
    zenith: '#02040a', horizon: '#1a2634', glowColor: '#e8c9a6',
    moonDir: [-40, 6, -160], glow: .35, galaxy: .12, ink: .35
  });
  const sea = addSea(scene, tex, {
    size: 600, segments: 130, y: 0,
    uniforms: {
      deep: '#02060b', surface: '#0b1a26', horizon: '#0a141d', deepTint: '#010305',
      moonColor: '#f0d6b4', moonDir: [-40, 6, -160], moonPower: .38,
      ink: .85, glitter: .28, fogDensity: .012, swell: .6, chop: .4
    }
  });
  const moon = addMoon(scene, tex, { pos: [-40, 6, -160], size: 17, halo: .3, warm: 1 });
  addStars(scene, tex, { count: 700, radius: 420, color: '#c8d5e6', size: .75, seed: 151, opacity: .22 });
  addEnvLights(scene, [-40, 6, -160], {
    moonIntensity: 1.0, hemi: .4, ambient: '#0b141e', rimColor: '#8a6d52', rimIntensity: .5
  });

  const thread = makeThread(tex, [
    [-6, .05, 3], [-2.2, .06, 1.5], [1.8, .05, .2], [6.5, .04, -.6], [12, .035, -.2]
  ], { radius: .0065, colorA: '#471009', colorB: '#a83a26' });
  scene.add(thread);

  const scraps = makePaperScraps(tex, {
    count: 62, area: [40, 22, 34], center: [0, 9, -12], seed: 161, fall: .12
  });
  scene.add(scraps);

  const mist = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glow(), color: col(i % 2 ? '#5b6f80' : '#8a7d6c'), transparent: true,
      opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    s.scale.set(170 + i * 30, 18 + i * 4, 1);
    s.position.set((i - 2) * 60, 1.4 + i * .6, -190 + i * 5);
    mist.add(s);
  }
  scene.add(mist);

  const glow = makeGlint(tex, '#e9c9a2', 3.2, .12);
  glow.position.set(-24, .6, -60);
  scene.add(glow);

  const dust = addDust(scene, tex, {
    count: 260, area: [40, 16, 40], center: [0, 5, -8], size: .8,
    opacity: .12, seed: 171, drift: .3, sizeScale: 26
  });
  addBokeh(scene, tex, { count: 6, center: [0, 3, -10], spread: 18, color: '#b08d6a', strength: .4, size: .8 });

  const views = {
    return: {
      keys: [
        key([0, 9, 38], [0, 3.2, -6], 43, 0),
        key([0, 11, 47], [0, 2.6, -9], 44, .004),
        key([0, 13.5, 56], [0, 2.2, -12], 45, .008)
      ]
    },
    outro: {
      keys: [
        key([0, 9.6, 40], [0, 2.4, -8], 44, .002),
        key([0, 9.2, 37], [0, 2.5, -8], 44, 0),
        key([0, 8.8, 34], [0, 2.6, -8], 43, 0)
      ]
    }
  };

  let active = 'return';
  function setView(v) {
    active = views[v] ? v : 'return';
    rig.set(views[active].keys);
  }
  setView('return');

  const moonDir = new THREE.Vector3(-40, 6, -160).normalize();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, 1.1, 3.2);
    updateSky(sky, t);
    updateWater(sea, t, { moonDir, ripple: .3 + pulse * .25, rippleCenter: [0, 0] });
    billboardMoon(moon, camera);
    scraps.userData.update(t);
    dust.userData.update(t, energy);

    const set = clamp01((t - 280.71) / 24.25);
    moon.position.y = 6 - set * 3.2 + Math.sin(t * .1) * .05;
    moon.scale.setScalar(1 - set * .06);
    moon.userData.setOpacity(1 - set * .25);
    glow.material.opacity = .1 + pulse * .04;
    glow.position.y = .5 + Math.sin(t * .25) * .05;

    thread.userData.update(t, energy, pulse * .3);
    const sink = smoothstep(294.5, 303.5, t);
    thread.position.y = -sink * .55;

    mist.children.forEach((s, i) => {
      s.material.opacity = .025 + .02 * Math.sin(t * .06 + i * 1.7);
    });

    rig.shake = .004 + energy * .008;
    rig.lookShake = .003 + energy * .005;
    rig.positionBias.y = Math.sin(t * .3) * .01;

    return {
      bloom: .46, bloomRadius: .76, bloomThreshold: .84,
      exposure: .9, contrast: 1.07, saturation: .9,
      vignette: .46, grain: .022, aberration: .18
    };
  }

  return {
    id: 'seaDawn', scene, camera, rig, views, setView, update,
    post: { bloom: .46, bloomRadius: .76, bloomThreshold: .84, exposure: .9, contrast: 1.07, saturation: .9, vignette: .46, grain: .022, aberration: .18 }
  };
}
