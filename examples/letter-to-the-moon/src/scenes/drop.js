import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addDust, addEnvLights, addBokeh
} from './common.js';
import {
  makeEnvelope, makeThread, makeRings, makeGlint
} from '../core/objects.js';
import { col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, smoothstep } from '../core/utils.js';

export function createDrop({ tex }) {
  const scene = createScene({ fog: { color: '#020306', density: .055 } });
  const camera = createCamera(ASPECT, 22);
  const rig = createRig(camera, { shake: .004, lookShake: .003 });

  addEnvLights(scene, [-2, 6, -8], {
    moonIntensity: .8, hemi: .12, ambient: '#060a10', rimColor: '#4c6078', rimIntensity: .3
  });

  const thread = makeThread(tex, [
    [-4.6, .42, -.4], [-1.8, .5, -.1], [0, .52, 0], [1.9, .5, .1], [4.8, .4, .4]
  ], { radius: .0075, colorA: '#420c07', colorB: '#a63222' });
  scene.add(thread);

  const beadMat = new THREE.MeshStandardMaterial({
    color: '#d9ecf4', roughness: .03, metalness: .1,
    transparent: true, opacity: .92,
    emissive: '#4e7c94', emissiveIntensity: .7
  });
  const bead = new THREE.Mesh(new THREE.SphereGeometry(.1, 32, 22), beadMat);
  bead.position.set(0, 1.2, 0);
  scene.add(bead);

  const beadGlow = makeGlint(tex, '#cfe6f2', .48, .3);
  scene.add(beadGlow);

  const contact = makeRings(tex, {
    count: 3, center: [0, .5, 0], spread: .45, color: '#a8c4d8', radius: .34,
    seed: 81, reverse: false, maxOpacity: .12
  });
  scene.add(contact);

  const env = makeEnvelope(tex, { scale: 2.1, pageVariant: 1, sealGlyph: '念' });
  env.position.set(.45, .4, -7.5);
  env.rotation.set(.1, .42, -.08);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#e3c49c'), transparent: true, opacity: .07,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(6.5);
  envGlow.position.set(.45, .6, -8);
  scene.add(envGlow);

  const dust = addDust(scene, tex, {
    count: 110, area: [6, 3.2, 5], center: [0, 1, 0], size: .55,
    opacity: .13, seed: 55, drift: .15, sizeScale: 22
  });
  addBokeh(scene, tex, { count: 5, center: [.6, 1.2, -5], spread: 5, color: '#9f8574', strength: .5, size: .9 });

  const views = {
    hold: {
      keys: [
        key([.72, 1.5, 3.5], [0, .98, 0], 22, -.008),
        key([.6, 1.44, 3.15], [0, .95, 0], 21, -.004),
        key([.44, 1.36, 2.75], [0, .9, 0], 20, .004),
        key([.3, 1.3, 2.45], [0, .87, 0], 19, .01)
      ]
    }
  };

  let active = 'hold';
  function setView(v) {
    active = views[v] ? v : 'hold';
    rig.set(views[active].keys);
  }
  setView('hold');

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, 1.2, 3);

    thread.userData.update(t, energy, pulse * .4);
    thread.userData.setCamera(camera);
    dust.userData.update(t, energy);

    const fall = smoothstep(0, 5.2, local);
    const tremble = Math.sin(t * 2.6) * .0025 + Math.sin(t * 5.7) * .0012;
    bead.position.set(tremble * 3, 1.3 - fall * .7, tremble * 2);
    bead.scale.set(1, 1 + fall * .22, 1);
    beadGlow.position.copy(bead.position);
    beadGlow.material.opacity = .22 + pulse * .14;
    beadGlow.scale.setScalar(.42 + pulse * .08);

    const touch = clamp01((local - 5.1) / 1.15);
    contact.visible = touch > .001;
    contact.userData.update((t - 109.2) * .9);
    contact.position.copy(bead.position);
    contact.position.y = .5;
    contact.scale.setScalar(.7 + touch * .6);

    env.position.y = .4 + Math.sin(t * .35) * .02;
    env.userData.setGlow(.04 + pulse * .1);
    envGlow.material.opacity = .05 + pulse * .03;

    rig.shake = .004 + pulse * .006;
    rig.lookShake = .003 + pulse * .004;

    return {
      bloom: .6, bloomRadius: .78, bloomThreshold: .78,
      exposure: 1.0, contrast: 1.1, saturation: .94,
      vignette: .5, grain: .026, aberration: .24
    };
  }

  return {
    id: 'drop', scene, camera, rig, views, setView, update,
    post: { bloom: .6, bloomRadius: .78, bloomThreshold: .78, exposure: 1.0, contrast: 1.1, saturation: .94, vignette: .5, grain: .026, aberration: .24 }
  };
}
