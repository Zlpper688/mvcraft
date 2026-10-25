import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, orbitView, addMoon, addDust,
  addStars, addEnvLights, billboardMoon, addBokeh
} from './common.js';
import { makeEnvelope, makeThreadBundle, makeGlint } from '../core/objects.js';
import { col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01 } from '../core/utils.js';

export function createThreads({ tex }) {
  const scene = createScene({ fog: { color: '#060509', density: .0095 } });
  const camera = createCamera(ASPECT, 34);
  const rig = createRig(camera, { shake: .012, lookShake: .01 });

  addEnvLights(scene, [0, 24, -50], {
    moonIntensity: 1.5, hemi: .22, ambient: '#0a0a12', rimColor: '#5a3a3a', rimIntensity: .4
  });

  const moon = addMoon(scene, tex, { pos: [4, 22, -62], size: 16, halo: .5, warm: 1 });
  addStars(scene, tex, { count: 900, radius: 300, color: '#d7e2f2', size: .9, seed: 41, opacity: .4 });

  const bundle = makeThreadBundle(tex, {
    count: 44, minR: 4.2, maxR: 26, thickness: .011, seed: 17,
    center: [0, 1.2, -2], vertical: .85, tagCount: 11,
    colorA: '#4a0d08', colorB: '#b93c2a'
  });
  scene.add(bundle);

  const env = makeEnvelope(tex, { scale: 1.75, pageVariant: 1, sealGlyph: '爱' });
  env.position.set(0, 1.3, 0);
  env.rotation.set(-.08, .14, -.03);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffcf9e'), transparent: true, opacity: .16,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(5.2);
  envGlow.position.set(0, 1.35, -.25);
  scene.add(envGlow);

  const glint = makeGlint(tex, '#ffd8ad', 1.6, .3);
  glint.position.set(0, 1.5, .35);
  scene.add(glint);

  const dust = addDust(scene, tex, {
    count: 650, area: [36, 26, 34], center: [0, 4, -4], size: 1.0,
    opacity: .2, seed: 26, drift: .5, sizeScale: 34
  });
  addBokeh(scene, tex, { count: 10, center: [0, 4, -6], spread: 20, color: '#b27a62', strength: .5, size: .8 });

  const views = {
    orbit: {
      ...orbitView({
        center: [0, 2.3, -1], radius: (p) => 33 - p * 6, y: (p) => 7.5 - p * 3.4,
        start: .55, end: 2.15, steps: 6, look: [0, 2.4, 0], fov: 28,
        roll: (p) => -.015 + p * .03
      })
    },
    dive: {
      keys: [
        key([0, 6.4, 31], [0, 2.2, 0], 30, .01),
        key([0, 3.4, 20], [0, 1.8, 0], 34, 0),
        key([0, 1.9, 10], [0, 1.5, 0], 40, -.01),
        key([0, 1.5, 4.4], [0, 1.36, 0], 46, .01),
        key([0, 1.38, 1.35], [0, 1.33, 0], 52, 0)
      ]
    }
  };

  let active = 'orbit';
  function setView(v) {
    active = views[v] ? v : 'orbit';
    rig.set(views[active].keys);
  }
  setView('orbit');

  const moonDir = new THREE.Vector3(4, 22, -62).normalize();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .55, 1.9);
    const beat = analysis.beatPulse(t, 4.5);

    billboardMoon(moon, camera);
    dust.userData.update(t, energy);
    bundle.userData.update(t, energy, pulse);
    bundle.userData.setCamera(camera);
    bundle.rotation.y = t * .012;
    // the last dive frames should slowly settle in front of the seal
    const settle = active === 'dive' ? clamp01((local - 8) / 6) : 0;
    env.rotation.y = .14 + Math.sin(t * .21) * .05 + settle * .04;
    env.rotation.x = -.08 + Math.sin(t * .27) * .025;
    env.rotation.z = -.03 + Math.sin(t * .19) * .02;
    env.position.y = 1.3 + Math.sin(t * .44) * .045;
    env.userData.setGlow(.12 + pulse * .7);
    envGlow.position.set(env.position.x, env.position.y + .08, env.position.z - .25);
    envGlow.material.opacity = .14 + pulse * .16;
    glint.position.set(0, env.position.y + .28, .55);
    glint.material.opacity = .2 + pulse * .32;

    rig.shake = .008 + energy * .022 + beat * .004;
    rig.lookShake = .006 + energy * .01;

    return {
      bloom: .58, bloomRadius: .76, bloomThreshold: .8,
      exposure: 1.0, contrast: 1.07, saturation: 1.02,
      vignette: .44, grain: .023, aberration: .2
    };
  }

  return {
    id: 'threads', scene, camera, rig, views, setView, update,
    post: { bloom: .58, bloomRadius: .76, bloomThreshold: .8, exposure: 1.0, contrast: 1.07, saturation: 1.02, vignette: .44, grain: .023, aberration: .2 }
  };
}
