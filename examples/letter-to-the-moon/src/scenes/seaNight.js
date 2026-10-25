import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSky, addSea, addMoon, addStars,
  addDust, addEnvLights, billboardMoon, updateWater, updateSky, addBokeh
} from './common.js';
import { makeEnvelope, makeThread, makeRings, makeGlint } from '../core/objects.js';
import { createPaperMaterial, col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, smoothstep } from '../core/utils.js';

export function createSeaNight({ tex }) {
  const scene = createScene({ fog: { color: '#040b16', density: .0125 } });
  const camera = createCamera(ASPECT, 38);
  const rig = createRig(camera, { shake: .016, lookShake: .012 });

  const sky = addSky(scene, tex, {
    zenith: '#010309', horizon: '#061120', glowColor: '#c7d9ee',
    moonDir: [14, 30, -190], glow: .5, galaxy: .24, ink: .62
  });
  const sea = addSea(scene, tex, {
    size: 560, segments: 150, y: 0,
    uniforms: {
      deep: '#010409', surface: '#081827', horizon: '#040c16', deepTint: '#000204',
      moonColor: '#dbe9f7', moonDir: [14, 30, -190], moonPower: .68,
      ink: .82, glitter: .5, fogDensity: .0125, swell: .85
    }
  });
  const moon = addMoon(scene, tex, { pos: [14, 30, -190], size: 34, halo: .62 });
  addStars(scene, tex, { count: 1200, radius: 460, color: '#cfe0f2', size: 1.1, seed: 12, opacity: .5 });
  addEnvLights(scene, [14, 30, -190], {
    moonIntensity: 1.9, hemi: .3, ambient: '#071221', rimColor: '#40607f', rimIntensity: .5
  });

  const env = makeEnvelope(tex, { scale: 1.5, pageVariant: 1, sealGlyph: '爱' });
  env.position.set(0, .34, -1.1);
  env.rotation.set(-Math.PI / 2 + .28, 0, .17);
  scene.add(env);

  const envShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 3.1),
    new THREE.MeshBasicMaterial({
      map: tex.glow(), color: 0x000000, transparent: true, opacity: .55, depthWrite: false
    })
  );
  envShadow.rotation.x = -Math.PI / 2;
  envShadow.position.set(0, .012, -1.1);
  scene.add(envShadow);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffd9b0'), transparent: true, opacity: .1,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(3.4);
  envGlow.position.set(0, .34, -1.1);
  scene.add(envGlow);

  const trail = makeThread(tex, [
    [1.5, .07, -.85], [3.6, .075, -1.6], [5.8, .06, -.8], [8.4, .055, 1.4], [11.5, .05, 4.6]
  ], { radius: .0065, colorA: '#4d0e08', colorB: '#b23a26' });
  scene.add(trail);

  const ripples = makeRings(tex, {
    count: 6, center: [0, .035, -1.1], spread: 2.4, color: '#9fbdd6', radius: .85, seed: 33,
    maxOpacity: .13
  });
  scene.add(ripples);

  const glint = makeGlint(tex, '#dceae8', 1.1, .22);
  glint.position.set(0, .5, -1.1);
  scene.add(glint);

  const scraps = new THREE.Group();
  const scrapMat = createPaperMaterial(tex.page(2), { color: '#e5ddcc', roughness: .95, side: THREE.DoubleSide, transparent: true, opacity: .8 });
  const scrapDefs = [[-4.2, .1, -7, 1.2], [3.8, .1, -9.5, .9], [-6.5, .1, -13, 1.7], [6.7, .1, -17, 1.3]];
  const scrapMeshes = scrapDefs.map(([x, y, z, s], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.5 * s, .34 * s), scrapMat);
    m.rotation.set(-Math.PI / 2, 0, i * 1.7);
    m.position.set(x, y, z);
    scraps.add(m);
    return { m, base: y, phase: i * 2.1, z };
  });
  scene.add(scraps);

  const mist = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glow(), color: col(i % 2 ? '#3d5a78' : '#6a86a2'), transparent: true,
      opacity: .045, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    s.scale.set(150 + i * 30, 16 + i * 3, 1);
    s.position.set((i - 2.5) * 55, 1.2 + i * .5, -210 + i * 4);
    mist.add(s);
  }
  scene.add(mist);

  const dust = addDust(scene, tex, {
    count: 240, area: [30, 8, 30], center: [0, 3.2, -6], size: .85,
    opacity: .16, seed: 15, drift: .4, sizeScale: 30
  });
  addBokeh(scene, tex, { count: 7, center: [0, 1.6, -6], spread: 14, color: '#7f9db8', strength: .5, size: .75 });

  const views = {
    low: {
      keys: [
        key([-8.2, 1.5, 11.5], [.3, .55, -.8], 39, -.012),
        key([-4.6, 1.15, 7.4], [.15, .42, -1.2], 35, -.004),
        key([-1.2, 1.0, 4.7], [0, .36, -1.3], 32, .005),
        key([2.6, 1.22, 3.5], [-.15, .42, -1.1], 30, .015)
      ],
      ease: (t) => t * t * (3 - 2 * t)
    },
    wide: {
      keys: [
        key([-14, 4.2, 18], [-1, 1.6, -6], 38, -.02),
        key([-18, 7.2, 22], [-.5, 2.4, -12], 35, -.01),
        key([-23, 11.5, 27], [0, 3.2, -18], 33, 0)
      ]
    }
  };

  let active = 'low';
  function setView(v) {
    active = views[v] ? v : 'low';
    rig.set(views[active].keys, { ease: views[active].ease });
  }
  setView('low');

  const moonDir = new THREE.Vector3(14, 30, -190).normalize();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .7, 2.4);
    updateSky(sky, t);
    updateWater(sea, t, {
      moonDir,
      ripple: .5 + pulse * .8,
      rippleCenter: [env.position.x, env.position.z]
    });
    billboardMoon(moon, camera);
    dust.userData.update(t, energy);

    const bob = Math.sin(t * .52) * .045 + Math.sin(t * 1.31 + 1.2) * .012;
    env.position.y = .34 + bob;
    env.rotation.x = -Math.PI / 2 + .28 + Math.sin(t * .44 + .6) * .025 + pulse * .008;
    env.rotation.z = .17 + Math.sin(t * .31) * .04;
    env.rotation.y = Math.sin(t * .23) * .06;
    env.userData.setGlow(.12 + pulse * .35);
    envShadow.position.set(env.position.x, .012, env.position.z);
    envShadow.material.opacity = .42 + bob * .8;
    envGlow.position.set(env.position.x, .46 + bob, env.position.z);
    envGlow.material.opacity = .08 + pulse * .08;
    glint.position.y = .6 + bob * 1.5;
    glint.material.opacity = .16 + pulse * .18;

    trail.userData.update(t, energy, pulse);
    trail.position.y = bob * .5;
    ripples.userData.update(t);

    scrapMeshes.forEach((s, i) => {
      s.m.position.y = .08 + Math.sin(t * .6 + s.phase) * .03;
      s.m.rotation.z = i * 1.7 + Math.sin(t * .2 + s.phase) * .12;
    });

    mist.children.forEach((s, i) => {
      s.material.opacity = .03 + .018 * Math.sin(t * .08 + i * 1.3);
      s.position.x += 0;
    });

    rig.shake = .013 + energy * .022;
    rig.lookShake = .009 + energy * .009;
    rig.positionBias.y = Math.sin(t * .5) * .015;
    rig.lookBias.y = Math.sin(t * .42 + 1) * .009;

    return {
      bloom: .52, bloomRadius: .74, bloomThreshold: .84,
      exposure: .94, contrast: 1.07, saturation: 1.0,
      vignette: .44, grain: .022, aberration: .2
    };
  }

  return {
    id: 'seaNight', scene, camera, rig, views, setView, update,
    post: { bloom: .52, bloomRadius: .74, bloomThreshold: .84, exposure: .94, contrast: 1.07, saturation: 1.0, vignette: .44, grain: .022, aberration: .2 }
  };
}
