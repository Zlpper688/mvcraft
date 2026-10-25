import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSky, addSea, addMoon, addStars,
  addDust, addEnvLights, billboardMoon, updateWater, updateSky, addBokeh
} from './common.js';
import {
  makeEnvelope, makeCrane, makeTextParticles, makePaperScraps, makeGlint, makeRings
} from '../core/objects.js';
import { col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, smoothstep } from '../core/utils.js';

export function createStarsea({ tex }) {
  const scene = createScene({ fog: { color: '#040912', density: .0075 } });
  const camera = createCamera(ASPECT, 40);
  const rig = createRig(camera, { shake: .008, lookShake: .006 });

  const sky = addSky(scene, tex, {
    zenith: '#01030a', horizon: '#071423', glowColor: '#d6e6f6',
    moonDir: [-10, 20, -130], glow: .7, galaxy: .8, ink: .3
  });
  const sea = addSea(scene, tex, {
    size: 620, segments: 140, y: 0,
    uniforms: {
      deep: '#010409', surface: '#081828', horizon: '#040d18', deepTint: '#000204',
      moonColor: '#e3eefa', moonDir: [-10, 20, -130], moonPower: .75,
      ink: .7, glitter: .7, fogDensity: .008, swell: .55, stars: 1.2, starColor: '#cfe0f4'
    }
  });
  const moon = addMoon(scene, tex, { pos: [-10, 20, -130], size: 24, halo: .7 });
  addStars(scene, tex, { count: 2600, radius: 460, color: '#dbe8f7', size: 1.0, seed: 121, opacity: .7 });
  addEnvLights(scene, [-10, 20, -130], {
    moonIntensity: 1.8, hemi: .32, ambient: '#06101c', rimColor: '#4d6d8c', rimIntensity: .5
  });

  const env = makeEnvelope(tex, { scale: 1.3, pageVariant: 1, sealGlyph: '爱' });
  env.position.set(0, 1.5, 0);
  env.rotation.set(-.18, .16, -.04);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffd6a8'), transparent: true, opacity: .16,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(4.6);
  envGlow.position.set(0, 1.65, -.3);
  scene.add(envGlow);

  const craneHolder = new THREE.Group();
  const crane = makeCrane(tex, { scale: 2.2 });
  craneHolder.add(crane);
  scene.add(craneHolder);

  const craneGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffe2bd'), transparent: true, opacity: .14,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  craneGlow.scale.setScalar(6);
  craneHolder.add(craneGlow);

  const particles = makeTextParticles(tex, {
    text: '我爱你', count: 20000, width: 20, seed: 77,
    colorA: '#f4f8ff', colorB: '#f0d6a8'
  });
  particles.position.set(0, 7, 0);
  particles.visible = false;
  scene.add(particles);

  const scraps = makePaperScraps(tex, {
    count: 36, area: [30, 14, 26], center: [0, 4, 0], seed: 131, fall: -.12
  });
  scene.add(scraps);

  const ripples = makeRings(tex, {
    count: 5, center: [0, .03, 0], spread: 2.6, color: '#a9c7de', radius: .9,
    seed: 67, maxOpacity: .12
  });
  scene.add(ripples);

  const glint = makeGlint(tex, '#ffe1b9', 1.5, .26);
  glint.position.set(0, 1.9, .3);
  scene.add(glint);

  const dust = addDust(scene, tex, {
    count: 500, area: [40, 20, 40], center: [0, 7, -6], size: .95,
    opacity: .18, seed: 141, drift: .4, sizeScale: 30
  });
  addBokeh(scene, tex, { count: 8, center: [0, 5, -8], spread: 22, color: '#91b3cd', strength: .5, size: .8 });

  const views = {
    wide: {
      keys: [
        key([0, 15, 34], [0, 3, -8], 42, 0),
        key([-3, 22, 42], [0, 2, -14], 44, .008),
        key([-6, 30, 52], [0, 1.5, -20], 45, .014)
      ]
    },
    dissolve: {
      keys: [
        key([8.5, 3.6, 10.5], [0, 1.7, 0], 33, -.02),
        key([5.2, 2.6, 12.2], [0, 1.7, 0], 32, 0),
        key([-3.4, 3.4, 12.8], [0, 1.7, 0], 31, .018),
        key([-8.2, 4.6, 9.5], [0, 1.7, 0], 32, .03)
      ]
    },
    form: {
      keys: [
        key([0, 7, 29], [0, 6.6, 0], 35, 0),
        key([0, 7.2, 34], [0, 6.8, 0], 34, 0),
        key([0, 7.4, 41], [0, 7, 0], 34, 0)
      ]
    }
  };

  let active = 'wide';
  function setView(v) {
    active = views[v] ? v : 'wide';
    rig.set(views[active].keys);
    const form = active === 'form';
    const dissolve = active === 'dissolve';
    env.visible = !form;
    envGlow.visible = !form;
    glint.visible = !form;
    ripples.visible = !form;
    craneHolder.visible = !form;
    particles.visible = form;
    particles.userData.update(0, 0, 0);
    scraps.visible = dissolve;
  }
  setView('wide');

  const moonDir = new THREE.Vector3(-10, 20, -130).normalize();
  const tmp = new THREE.Vector3();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .8, 2.8);
    updateSky(sky, t);
    updateWater(sea, t, { moonDir, ripple: .35 + pulse * .3, rippleCenter: [0, 0] });
    billboardMoon(moon, camera);
    dust.userData.update(t, energy);
    if (scraps.visible) scraps.userData.update(t);

    if (env.visible) {
      env.position.y = 1.5 + Math.sin(t * .45) * .07;
      env.rotation.x = -.18 + Math.sin(t * .3) * .04;
      env.userData.setGlow(.1 + pulse * .5);
      envGlow.position.set(0, env.position.y + .14, -.3);
      envGlow.material.opacity = .13 + pulse * .1;
      glint.position.set(0, env.position.y + .3, .32);
      glint.material.opacity = .16 + pulse * .2;
      ripples.userData.update(t);
      if (active === 'dissolve') {
        const p = clamp01((t - 260.71) / 8.2);
        const o = 1 - smoothstep(.35, 1, p);
        env.userData.setOpacity(o);
        envGlow.material.opacity *= o;
        glint.material.opacity *= o;
        ripples.userData.update(t);
      } else {
        env.userData.setOpacity(1);
      }
    }

    if (craneHolder.visible) {
      const a = t * .18;
      craneHolder.position.set(Math.cos(a) * 11, 4.6 + Math.sin(t * .35) * 1.2, Math.sin(a) * 8 - 2);
      craneHolder.rotation.y = -a + Math.PI;
      crane.userData.update(t);
      craneGlow.material.opacity = .1 + pulse * .08;
    }

    if (particles.visible) {
      const p = clamp01((t - 270.9) / 5.4);
      const breath = .9 + Math.sin(t * .8) * .05;
      particles.position.y = 7 + Math.sin(t * .4) * .08;
      particles.scale.setScalar(breath);
      particles.userData.update(t, p, clamp01((t - 270.9) / 2.8));
    }

    rig.shake = .006 + energy * .014;
    rig.lookShake = .005 + energy * .008;
    rig.positionBias.y = Math.sin(t * .4) * .014;

    return {
      bloom: .62, bloomRadius: .82, bloomThreshold: .79,
      exposure: 1.0, contrast: 1.05, saturation: 1.0,
      vignette: .42, grain: .021, aberration: .18
    };
  }

  return {
    id: 'starsea', scene, camera, rig, views, setView, update,
    post: { bloom: .62, bloomRadius: .82, bloomThreshold: .79, exposure: 1.0, contrast: 1.05, saturation: 1.0, vignette: .42, grain: .021, aberration: .18 }
  };
}
