import * as THREE from 'three';
import { createScene, createCamera, createRig, key } from './common.js';
import { makeThread } from '../core/objects.js';
import { ASPECT } from '../data/shots.js';
import { smoothstep } from '../core/utils.js';

export function createEnd({ tex }) {
  const scene = createScene({ bg: '#000000' });
  const camera = createCamera(ASPECT, 30);
  const rig = createRig(camera, { shake: 0, lookShake: 0 });

  const thread = makeThread(tex, [
    [-7, .35, 0], [-3, .22, .2], [0, .08, .1], [3, -.06, 0], [7, -.3, -.2]
  ], { radius: .007, colorA: '#240604', colorB: '#5c180f' });
  scene.add(thread);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: new THREE.Color('#5c1a10'), transparent: true, opacity: .05,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  glow.scale.setScalar(4);
  glow.position.set(0, .05, 0);
  scene.add(glow);

  const views = { black: { keys: [key([0, .35, 9], [0, 0, 0], 30, 0)] } };
  function setView(v) {
    rig.set(views.black.keys);
  }
  setView('black');

  function update(t, local, shot, analysis) {
    const sink = smoothstep(304.97, 310.16, t);
    thread.position.set(Math.sin(t * .2) * .08, -.35 * sink, 0);
    thread.userData.update(t, .1, 0);
    glow.material.opacity = .05 * (1 - sink * .7);
    glow.position.y = thread.position.y + .05;
    return {
      bloom: .28, bloomRadius: .7, bloomThreshold: .9,
      exposure: .52, contrast: 1.12, saturation: .9,
      vignette: .82, grain: .03, aberration: .12
    };
  }

  return {
    id: 'end', scene, camera, rig, views, setView, update,
    post: { bloom: .28, bloomRadius: .7, bloomThreshold: .9, exposure: .52, contrast: 1.12, saturation: .9, vignette: .82, grain: .03, aberration: .12 }
  };
}
