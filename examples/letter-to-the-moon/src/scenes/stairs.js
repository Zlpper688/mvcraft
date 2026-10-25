import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addMoon, addDust, addShafts,
  addEnvLights, billboardMoon, addBokeh
} from './common.js';
import { makeEnvelope, makeThread, makePaperScraps, makeGlint, V3 } from '../core/objects.js';
import { createPaperMaterial, col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, mulberry32, easeInOutCubic } from '../core/utils.js';

const EP0 = .08, EP1 = .86;
const epAt = (t) => EP0 + clamp01((t - 60.2) / 13.8) * (EP1 - EP0);
const FOLLOW_LEAD = .035;
const FOLLOW_RADIUS = 14.2;

function spiralPoint(p, radius = 5.4, y0 = -2.4, rise = .44) {
  const a = p * Math.PI * 4.6;
  return {
    a,
    p: V3(Math.cos(a) * radius, y0 + p * rise * 46, Math.sin(a) * radius)
  };
}

export function createStairs({ tex }) {
  const scene = createScene({ fog: { color: '#050a12', density: .015 } });
  const camera = createCamera(ASPECT, 40);
  const rig = createRig(camera, { shake: .01, lookShake: .008 });

  addEnvLights(scene, [-8, 30, -20], {
    moonIntensity: 1.4, hemi: .3, ambient: '#08111c', rimColor: '#54708e', rimIntensity: .5
  });

  const moon = addMoon(scene, tex, { pos: [-2, 25.5, -24], size: 7.5, halo: .75, ring: 1.7, ringColor: '#bcd4e8' });
  const moonDir = new THREE.Vector3(-2, 25.5, -24).normalize();

  const stepMat = createPaperMaterial(tex.paper(0), {
    color: '#ded7c6', roughness: .93, metalness: 0, mapRepeat: [1.1, .7]
  });
  const stepDark = createPaperMaterial(tex.paper(2), {
    color: '#8e9aa4', roughness: .96, mapRepeat: [1.1, .7]
  });
  const steps = [];
  const COUNT = 46;
  for (let i = 0; i < COUNT; i++) {
    const sp = spiralPoint(i / (COUNT - 1));
    const w = 2.5 + Math.sin(i * 1.7) * .35;
    const geo = new THREE.BoxGeometry(w, .075, 1.5);
    const m = new THREE.Mesh(geo, i % 7 === 0 ? stepDark : stepMat);
    m.position.copy(sp.p);
    m.rotation.y = -sp.a + Math.PI / 2;
    m.rotation.x = (i % 5) * .004;
    m.rotation.z = Math.sin(i * 2.1) * .01;
    m.userData.baseRot = m.rotation.clone();
    m.userData.phase = i * .7;
    scene.add(m);
    steps.push(m);
  }

  const railPts = [];
  for (let i = 0; i <= 60; i++) {
    const sp = spiralPoint(i / 60, 6.45);
    railPts.push([sp.p.x, sp.p.y + 1.15, sp.p.z]);
  }
  const rail = makeThread(tex, railPts, { radius: .012, colorA: '#4e0f09', colorB: '#c1452f' });
  scene.add(rail);

  const env = makeEnvelope(tex, { scale: 1.15, pageVariant: 1, sealGlyph: '爱' });
  env.rotation.set(-.12, .55, .06);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffd9b2'), transparent: true, opacity: .12,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(3.2);
  scene.add(envGlow);

  addShafts(scene, {
    count: 4, height: 80, width: 14, color: '#a7c2d8',
    opacity: .09, center: [0, 26, -8], spread: 22, seed: 12
  });

  const scraps = makePaperScraps(tex, {
    count: 34, area: [12, 16, 12], center: [0, 10, 0], seed: 71, fall: .18
  });
  scene.add(scraps);

  const dust = addDust(scene, tex, {
    count: 420, area: [22, 24, 20], center: [0, 9, 0], size: 1.0,
    opacity: .2, seed: 33, drift: .5, sizeScale: 34
  });
  addBokeh(scene, tex, { count: 9, center: [0, 9, -8], spread: 16, color: '#88a8c2', strength: .6, size: .8 });

  const glint = makeGlint(tex, '#dcebf6', 1.2, .24);
  scene.add(glint);

  const views = {
    wide: {
      ease: easeInOutCubic,
      keys: [
        key([15.5, 3.4, 17], [0, 7, 0], 43, -.02),
        key([13, 7.5, 15.5], [0, 10, 0], 40, -.01),
        key([10, 12.5, 14], [0, 13, 0], 37, .005)
      ]
    },
    follow: {
      ease: (p) => p,
      keys: Array.from({ length: 13 }, (_, i) => {
        const f = i / 12;
        const ep = epAt(67.7 + f * 6.34);
        const cam = spiralPoint(ep - FOLLOW_LEAD, FOLLOW_RADIUS);
        const look = spiralPoint(ep);
        return key(
          [cam.p.x, cam.p.y + 1.8, cam.p.z],
          [look.p.x, look.p.y + 1.9, look.p.z],
          36 - f * 3,
          .014 - f * .032
        );
      })
    }
  };

  let active = 'wide';
  function setView(v) {
    active = views[v] ? v : 'wide';
    const vw = views[active];
    rig.set(vw.keys, vw.ease ? { ease: vw.ease } : {});
  }
  setView('wide');

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .7, 2.2);
    billboardMoon(moon, camera);
    scraps.userData.update(t);
    dust.userData.update(t, energy);

    steps.forEach((m, i) => {
      const b = m.userData.baseRot;
      m.rotation.x = b.x + Math.sin(t * .5 + m.userData.phase) * .008;
      m.rotation.z = b.z + Math.sin(t * .37 + i * .6) * .012;
    });

    const asc = clamp01((t - 60.2) / 13.8);
    const ep = .08 + asc * .78;
    const sp = spiralPoint(ep);
    env.position.set(sp.p.x, sp.p.y + 1.5 + Math.sin(t * .5) * .12, sp.p.z);
    if (active === 'follow') {
      const camP = spiralPoint(epAt(t) - FOLLOW_LEAD, FOLLOW_RADIUS).p;
      const dx = camP.x - env.position.x;
      const dz = camP.z - env.position.z;
      env.rotation.set(-.2 + Math.sin(t * .3) * .03, Math.atan2(dx, dz) + .16, .04 + Math.sin(t * .25) * .02);
    } else {
      env.rotation.set(-.12 + Math.sin(t * .35) * .04, -sp.a + .55, .06 + Math.sin(t * .3) * .05);
    }
    env.userData.setGlow(.1 + pulse * .4);
    envGlow.position.set(env.position.x, env.position.y + .12, env.position.z);
    envGlow.material.opacity = .09 + pulse * .08;

    glint.position.set(env.position.x, env.position.y + .35, env.position.z);
    glint.material.opacity = .16 + pulse * .16;

    rail.userData.update(t, energy, pulse);

    rig.shake = .007 + energy * .015;
    rig.lookShake = .006 + energy * .008;

    return {
      bloom: .55, bloomRadius: .74, bloomThreshold: .82,
      exposure: .94, contrast: 1.06, saturation: 1.0,
      vignette: .44, grain: .022, aberration: .2
    };
  }

  return {
    id: 'stairs', scene, camera, rig, views, setView, update,
    post: { bloom: .55, bloomRadius: .74, bloomThreshold: .82, exposure: .94, contrast: 1.06, saturation: 1.0, vignette: .44, grain: .022, aberration: .2 }
  };
}
