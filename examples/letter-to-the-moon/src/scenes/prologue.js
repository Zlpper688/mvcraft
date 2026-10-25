import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSea, addMoon, addDust,
  addShafts, addEnvLights, billboardMoon, updateWater, addBokeh
} from './common.js';
import { makeInkPlume, makeRings, makeGlint, makeThread } from '../core/objects.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, expPulse, smoothstep } from '../core/utils.js';
import { col } from '../core/materials.js';

const IMPACTS = [3.15, 7.35, 10.6, 12.9, 15.4];

export function createPrologue({ tex }) {
  const scene = createScene({ fog: { color: '#010308', density: .04 } });
  const camera = createCamera(ASPECT, 26);
  const rig = createRig(camera, { shake: .009, lookShake: .008 });

  const light = addEnvLights(scene, [4, 12, -14], {
    moonIntensity: .85, hemi: .18, ambient: '#050c16', rimIntensity: .3
  });

  const sea = addSea(scene, tex, {
    size: 90, segments: 150, y: -1.62,
    uniforms: {
      deep: '#000204', surface: '#040d16', horizon: '#020710', deepTint: '#000103',
      moonColor: '#a9c2d6', moonDir: [.1, .5, -1], moonPower: .4,
      ink: 1, glitter: .2, fogDensity: .12, swell: .22, chop: .34
    }
  });

  const moon = addMoon(scene, tex, { pos: [3, 2.8, -26], size: 4.2, halo: .3 });
  const moonDir = new THREE.Vector3(3, 2.8, -26).normalize();

  const plumeCenter = [
    { p: [0, -1.4, -1.2], at: IMPACTS[0], seed: 8, scale: .55, until: 19.6 },
    { p: [.85, -1.44, -2.25], at: IMPACTS[1], seed: 19, scale: .38, until: 19.6 },
    { p: [-.95, -1.42, -.55], at: IMPACTS[3], seed: 31, scale: .42, until: 19.6 }
  ];
  const plumes = plumeCenter.map((def) => {
    const g = makeInkPlume(tex, { count: 18, seed: def.seed, scale: def.scale });
    g.position.set(...def.p);
    scene.add(g);
    return { ...def, g };
  });

  const rippleGroups = [
    { center: [0, -1.58, -1.2], count: 4, spread: 1.15, radius: .36, from: IMPACTS[0] },
    { center: [.85, -1.58, -2.25], count: 3, spread: .7, radius: .2, from: IMPACTS[1] },
    { center: [-.95, -1.58, -.55], count: 3, spread: .7, radius: .22, from: IMPACTS[3] }
  ].map((def, i) => {
    const g = makeRings(tex, {
      count: def.count, center: def.center, spread: def.spread,
      radius: def.radius, seed: 24 + i * 7, reverse: false, color: '#9fb9cc', maxOpacity: .09
    });
    scene.add(g);
    return { ...def, g };
  });

  const droplet = new THREE.Mesh(
    new THREE.SphereGeometry(.055, 20, 14),
    new THREE.MeshStandardMaterial({
      color: '#cfe3f0', roughness: .04, metalness: .15,
      transparent: true, opacity: .9,
      emissive: '#3d6076', emissiveIntensity: .35
    })
  );
  scene.add(droplet);
  const dropGlow = makeGlint(tex, '#cfe2ee', .55, .3);
  scene.add(dropGlow);

  const dust = addDust(scene, tex, {
    count: 180, area: [8, 3, 8], center: [0, .3, -2],
    size: .75, opacity: .14, sizeScale: 26, drift: .2, seed: 7
  });
  addBokeh(scene, tex, { count: 6, center: [0, 1.2, -8], spread: 9, color: '#7fa0b8', strength: .45, size: .7 });
  const shafts = addShafts(scene, {
    count: 3, height: 34, width: 10, color: '#8aa7bd',
    opacity: .045, center: [0, 3, -12], spread: 26, seed: 4
  });

  const redThreads = new THREE.Group();
  const threadDefs = [
    [[-3.4, .5, -4.4], [-1.2, -.4, -2.8], [.4, -1.1, -1.3]],
    [[3.2, .8, -5], [1.3, -.2, -3.1], [-.2, -1, -1.4]],
    [[4.6, -.2, -7], [2, -.9, -4.2], [.2, -1.35, -1.6]]
  ];
  threadDefs.forEach((pts, i) => {
    const t = makeThread(tex, pts, { radius: .0035 + i * .0012, colorA: '#4a0d08', colorB: '#a83424' });
    t.userData.phase = i;
    redThreads.add(t);
  });
  scene.add(redThreads);

  const views = {
    macro: {
      keys: [
        key([-1.75, 1.55, 3.15], [.1, -1.16, -1.1], 25, -.018),
        key([-.9, 1.05, 3.9], [0, -1.24, -1.2], 23.5, -.006),
        key([.75, .72, 4.15], [0, -1.3, -1.28], 22.5, .012),
        key([2.35, .95, 3.35], [-.06, -1.2, -1.15], 21, .03)
      ]
    }
  };

  let active = 'macro';
  function setView(v) {
    active = views[v] ? v : 'macro';
    rig.set(views[active].keys);
  }
  setView('macro');

  const tmp = new THREE.Vector3();

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .75, 2.2);
    const beat = analysis.beatPulse(t, 5.5);

    updateWater(sea, t, { moonDir, ripple: .7 + energy * .55, rippleCenter: [0, -1.2] });
    moon.userData.billboard(camera);
    dust.userData.update(t, energy);
    shafts.userData.update(t);

    for (const p of plumes) {
      const pgr = clamp01((t - p.at) / 9.5) * .94;
      p.g.visible = t > p.at - .05 && t < p.until;
      p.g.userData.update(t, pgr);
    }
    for (const r of rippleGroups) {
      r.g.visible = t > r.from;
      r.g.userData.update(t - r.from);
    }

    let nextImpact = null;
    for (const it of IMPACTS) {
      if (t < it + .06 && t > it - 1.15) nextImpact = it;
    }
    if (nextImpact !== null) {
      const tau = clamp01((t - (nextImpact - 1.15)) / 1.15);
      const y = -1.32 + 2.2 * (1 - tau) * (1 - tau);
      droplet.visible = true;
      droplet.position.set(.08 * Math.sin(t * 1.7), y, -1.2);
      droplet.scale.set(1, 1 + (1 - tau) * .9, 1);
      dropGlow.position.copy(droplet.position);
      dropGlow.material.opacity = .22 + tau * .45;
      dropGlow.scale.setScalar(.75 + tau * .55);
    } else {
      droplet.visible = false;
      dropGlow.material.opacity = 0;
    }

    let impactGlow = 0;
    for (const it of IMPACTS) {
      const dt = t - it;
      if (dt >= 0 && dt < 3) impactGlow += expPulse(dt, .22) * .5;
    }
    light.key.intensity = .85 + impactGlow * .8;
    light.rim.intensity = .3 + impactGlow * .35;

    const showThreads = smoothstep(13.8, 16.4, t);
    redThreads.visible = showThreads > .005;
    redThreads.children.forEach((th) => {
      th.userData.update(t, energy, pulse);
      th.position.y = (1 - showThreads) * -1.2;
    });

    rig.shake = .006 + energy * .016 + pulse * .006;
    rig.lookShake = .005 + energy * .009;
    rig.positionBias.set(
      Math.sin(t * 2.1) * impactGlow * .012,
      impactGlow * .014 + Math.sin(t * .9) * .006,
      0
    );
    rig.fovBias = pulse * .3;

    const env = { bloom: .5, bloomRadius: .72, bloomThreshold: .88, exposure: .84, contrast: 1.08, saturation: .98, vignette: .56, grain: .026, aberration: .2 };
    return env;
  }

  return {
    id: 'prologue', scene, camera, rig, views, setView, update,
    post: { bloom: .5, bloomRadius: .72, bloomThreshold: .88, exposure: .84, contrast: 1.08, saturation: .98, vignette: .56, grain: .026, aberration: .2 }
  };
}
