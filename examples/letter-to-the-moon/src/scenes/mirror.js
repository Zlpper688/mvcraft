import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSky, addSea, addMoon, addStars,
  addDust, addEnvLights, billboardMoon, updateWater, updateSky, addBokeh, updateUnderwater
} from './common.js';
import {
  makeEnvelope, makeSilhouette, makeThread, makeShards, makeGlint
} from '../core/objects.js';
import { createUnderwaterMaterial, makeSky, col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, smoothstep } from '../core/utils.js';

export function createMirror({ tex }) {
  const scene = createScene({ fog: { color: '#04060c', density: .013 } });
  const camera = createCamera(ASPECT, 36);
  const rig = createRig(camera, { shake: .008, lookShake: .006 });

  const sky = addSky(scene, tex, {
    zenith: '#010208', horizon: '#081120', glowColor: '#ccdcef',
    moonDir: [-10, 22, -180], glow: .55, galaxy: .3, ink: .55
  });
  const sea = addSea(scene, tex, {
    size: 480, segments: 150, y: 0,
    uniforms: {
      deep: '#010308', surface: '#07131f', horizon: '#030a12', deepTint: '#000204',
      moonColor: '#dceaf7', moonDir: [-10, 22, -180], moonPower: .55,
      ink: .95, glitter: .16, fogDensity: .011, swell: .28, chop: .22, mirror: 1
    }
  });
  const moon = addMoon(scene, tex, { pos: [-10, 22, -180], size: 30, halo: .55 });
  addStars(scene, tex, { count: 900, radius: 420, color: '#d3e1f2', size: .85, seed: 62, opacity: .38 });
  addEnvLights(scene, [-10, 22, -180], {
    moonIntensity: 1.6, hemi: .24, ambient: '#060c15', rimColor: '#4c6b8c', rimIntensity: .6
  });

  const dome = makeSky({ radius: 400, material: createUnderwaterMaterial({
    top: '#132c42', mid: '#06121e', deep: '#010306',
    glowColor: '#cfe4f4', moonDir: [-.1, 1, -.3], caustic: .7
  }) });
  dome.visible = false;
  scene.add(dome);

  const env = makeEnvelope(tex, { scale: 1.55, pageVariant: 1, sealGlyph: '爱' });
  env.position.set(0, 1.1, 0);
  env.rotation.set(-.16, .1, -.05);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffd2a4'), transparent: true, opacity: .13,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(4.2);
  envGlow.position.set(0, 1.25, -.3);
  scene.add(envGlow);

  const figure = makeSilhouette(tex, { pose: 'stand', scale: 1.65, tint: '#9aaebf', opacity: .88 });
  figure.position.set(-3.6, .02, -4.1);
  figure.rotation.y = .3;
  scene.add(figure);

  const thread = makeThread(tex, [
    [0, .95, 0], [1.1, .5, .8], [2.6, .1, 2.2], [4.6, .04, 3.5]
  ], { radius: .007, colorA: '#4a0e08', colorB: '#b33b27' });
  scene.add(thread);

  const shards = makeShards(tex, { count: 120, center: [0, 3.6, 0], spread: 8, seed: 44, scale: 1.05 });
  shards.visible = false;
  scene.add(shards);

  const glint = makeGlint(tex, '#dcebf6', 1.3, .24);
  glint.position.set(0, 1.3, .4);
  scene.add(glint);

  const dust = addDust(scene, tex, {
    count: 340, area: [22, 10, 22], center: [0, 2, -2], size: .8,
    opacity: .16, seed: 47, drift: .3, sizeScale: 26
  });
  addBokeh(scene, tex, { count: 7, center: [0, 1.6, -4], spread: 12, color: '#7d9cb8', strength: .55, size: .8 });

  const views = {
    glide: {
      keys: [
        key([-9.5, 1.05, 9.5], [0, 1.25, 0], 35, -.015),
        key([-4.8, 1.0, 7.8], [0, 1.2, 0], 33, -.008),
        key([1.2, 1.06, 7.2], [0, 1.25, 0], 32, .006),
        key([6.8, 1.18, 6.4], [0, 1.3, 0], 31, .016),
        key([9.6, 1.3, 5.4], [0, 1.25, 0], 31, .02)
      ]
    },
    enter: {
      keys: [
        key([9.6, 1.5, 5.4], [0, 1.25, 0], 33, .02),
        key([6.4, .2, 4.8], [0, 1.1, 0], 36, .2),
        key([3.4, -1.6, 3.6], [0, 1.0, 0], 40, .34),
        key([1.2, -3.8, 2.2], [0, 1.1, 0], 44, .42),
        key([-.4, -5.4, 1.1], [0, 1.2, 0], 47, .48)
      ]
    },
    shatter: {
      keys: [
        key([0, 2.4, 7.2], [0, 3.2, 0], 38, 0),
        key([1.4, .6, 5.2], [0, 4.2, 0], 42, -.06),
        key([2.8, -2.6, 3.8], [0, 5.2, 0], 46, -.14),
        key([3.4, -6.5, 2.2], [0, 5.6, 0], 50, -.2)
      ]
    }
  };

  let active = 'glide';
  function setView(v) {
    active = views[v] ? v : 'glide';
    rig.set(views[active].keys);
    dome.visible = active !== 'glide';
    figure.visible = active === 'glide';
  }
  setView('glide');

  const moonDir = new THREE.Vector3(-10, 22, -180).normalize();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .7, 2.3);
    updateSky(sky, t);
    updateWater(sea, t, {
      moonDir,
      ripple: .22 + pulse * .2,
      rippleCenter: [env.position.x, env.position.z]
    });
    billboardMoon(moon, camera);
    updateUnderwater(dome, t);
    dust.userData.update(t, energy);

    env.position.y = 1.1 + Math.sin(t * .42) * .06;
    env.rotation.x = -.16 + Math.sin(t * .3) * .03;
    env.rotation.y = .1 + Math.sin(t * .22) * .08;
    env.userData.setGlow(.1 + pulse * .45);
    envGlow.position.set(0, env.position.y + .12, -.3);
    envGlow.material.opacity = .1 + pulse * .08;
    thread.userData.update(t, energy, pulse);
    thread.userData.setCamera(camera);
    glint.position.set(0, env.position.y + .28, .42);
    glint.material.opacity = .13 + pulse * .14;

    figure.position.y = .02 + Math.sin(t * .5) * .015;
    figure.rotation.y = .3 + Math.sin(t * .17) * .05;

    shards.visible = t > 134.04;
    if (shards.visible) {
      shards.userData.update(t, clamp01((t - 134.04) / 8.4), energy);
      env.userData.setOpacity(1 - smoothstep(134.2, 137.2, t));
      envGlow.material.opacity *= 1 - smoothstep(134.1, 136.4, t);
    } else {
      env.userData.setOpacity(1);
    }

    rig.shake = .006 + energy * .02;
    rig.lookShake = .005 + energy * .01;

    return {
      bloom: .55, bloomRadius: .76, bloomThreshold: .82,
      exposure: .93, contrast: 1.08, saturation: .99,
      vignette: .48, grain: .023, aberration: .2
    };
  }

  return {
    id: 'mirror', scene, camera, rig, views, setView, update,
    post: { bloom: .55, bloomRadius: .76, bloomThreshold: .82, exposure: .93, contrast: 1.08, saturation: .99, vignette: .48, grain: .023, aberration: .2 }
  };
}
