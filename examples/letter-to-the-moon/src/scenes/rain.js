import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, orbitView, addSea, addMoon, addDust,
  addEnvLights, billboardMoon, updateWater, addBokeh
} from './common.js';
import {
  makeUmbrella, makeEnvelope, makeSilhouette, makeRain, makeRings, makeThread, makeGlint
} from '../core/objects.js';
import { col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01 } from '../core/utils.js';

export function createRain({ tex }) {
  const scene = createScene({ fog: { color: '#04080f', density: .018 } });
  const camera = createCamera(ASPECT, 38);
  const rig = createRig(camera, { shake: .012, lookShake: .009 });

  const sea = addSea(scene, tex, {
    size: 260, segments: 130, y: 0,
    uniforms: {
      deep: '#010307', surface: '#071420', horizon: '#040b13', deepTint: '#000204',
      moonColor: '#b8cde0', moonDir: [-14, 18, -80], moonPower: .38,
      ink: .95, glitter: .28, fogDensity: .02, swell: .4, chop: .4
    }
  });
  const moon = addMoon(scene, tex, { pos: [-14, 18, -80], size: 10, halo: .3, warm: 1 });
  addEnvLights(scene, [-14, 18, -80], {
    moonIntensity: .9, hemi: .25, ambient: '#070d16', rimColor: '#44627f', rimIntensity: .5
  });

  const umbrella = makeUmbrella(tex, { scale: 1.5, color: '#a83427', lantern: true });
  umbrella.position.set(0, 4.6, 0);
  umbrella.rotation.z = .06;
  umbrella.userData.light.intensity = 12;
  scene.add(umbrella);

  const env = makeEnvelope(tex, { scale: .82, pageVariant: 1, sealGlyph: '念' });
  env.position.set(0, 1.8, .35);
  env.rotation.set(-.2, .18, -.05);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffd5a6'), transparent: true, opacity: .12,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(3.4);
  envGlow.position.set(0, 1.95, .1);
  scene.add(envGlow);

  const handleThread = makeThread(tex, [
    [0, 2.6, .1], [.4, 3.4, .05], [.08, 4.25, 0], [.15, 5.1, 0]
  ], { radius: .006, colorA: '#3f0b07', colorB: '#9c2f20' });
  scene.add(handleThread);

  const figure = makeSilhouette(tex, { pose: 'stand', scale: 2.15, tint: '#8fa2b4', opacity: .82 });
  figure.position.set(-8.4, .02, -10.5);
  figure.rotation.y = .18;
  scene.add(figure);

  const rain = makeRain(tex, {
    count: 2600, color: '#b4d2ea', opacity: .26, height: 26, speed: -7.2,
    area: [44, 26, 38], center: [0, 10, 0], seed: 17, length: 1
  });
  scene.add(rain);

  const ripples = makeRings(tex, {
    count: 10, center: [0, .03, 0], spread: 6, color: '#9dbdd6', radius: 1.2,
    seed: 58, reverse: true, maxOpacity: .14
  });
  scene.add(ripples);

  const glint = makeGlint(tex, '#ffd3a2', 1.4, .3);
  glint.position.set(0, 2.2, .3);
  scene.add(glint);

  const dust = addDust(scene, tex, {
    count: 220, area: [26, 12, 26], center: [0, 4, -2], size: .8,
    opacity: .14, seed: 63, drift: .5, sizeScale: 26
  });
  addBokeh(scene, tex, { count: 7, center: [0, 3, -5], spread: 14, color: '#c68f6a', strength: .45, size: .75 });

  const views = {
    orbit: {
      ...orbitView({
        center: [0, 2.2, 0], radius: (p) => 7.8 + p * 2.2, y: (p) => 2.3 + p * 1.4,
        start: .4, end: 2.0, steps: 5, look: [0, 2.6, 0], fov: 34,
        roll: (p) => -.02 + p * .04
      })
    },
    wide: {
      keys: [
        key([0, 2.2, 17], [0, 2.9, 0], 40, .01),
        key([1.1, 2.7, 20.5], [0, 3.1, -1], 42, .008),
        key([2.0, 3.3, 24], [0, 3.2, -2], 43, .004)
      ]
    }
  };

  let active = 'orbit';
  function setView(v) {
    active = views[v] ? v : 'orbit';
    rig.set(views[active].keys);
  }
  setView('orbit');

  const moonDir = new THREE.Vector3(-14, 18, -80).normalize();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .6, 2.2);
    const beat = analysis.beatPulse(t, 5);
    updateWater(sea, t, {
      moonDir,
      ripple: .3 + pulse * .4,
      rippleCenter: [0, 0]
    });
    billboardMoon(moon, camera);
    rain.userData.update(t);
    dust.userData.update(t, energy);
    ripples.userData.update(t);

    umbrella.position.y = 4.6 + Math.sin(t * .5) * .07;
    umbrella.rotation.z = .06 + Math.sin(t * .3) * .018;
    umbrella.rotation.y = Math.sin(t * .21) * .05;

    env.position.y = 1.8 + Math.sin(t * .58 + 1) * .05;
    env.rotation.y = .18 + Math.sin(t * .25) * .07;
    env.userData.setGlow(.1 + pulse * .5);
    envGlow.position.set(0, env.position.y + .12, .1);
    envGlow.material.opacity = .1 + pulse * .08;
    glint.position.set(0, env.position.y + .32, .42);
    glint.material.opacity = .16 + pulse * .16;
    handleThread.userData.update(t, energy, pulse);
    figure.rotation.y = .18 + Math.sin(t * .16) * .04;

    if (active === 'wide') {
      const crowd = 1 + Math.max(0, Math.sin(t * .55)) * .7;
      rain.material.uniforms.uOpacity.value = .26 * crowd;
    } else {
      rain.material.uniforms.uOpacity.value = .26;
    }

    rig.shake = .009 + energy * .022;
    rig.lookShake = .007 + energy * .01;
    rig.positionBias.y = Math.sin(t * .7) * .012;

    return {
      bloom: .56, bloomRadius: .78, bloomThreshold: .8,
      exposure: .92, contrast: 1.07, saturation: .9,
      vignette: .48, grain: .024, aberration: .22
    };
  }

  return {
    id: 'rain', scene, camera, rig, views, setView, update,
    post: { bloom: .56, bloomRadius: .78, bloomThreshold: .8, exposure: .92, contrast: 1.07, saturation: .9, vignette: .48, grain: .024, aberration: .22 }
  };
}
