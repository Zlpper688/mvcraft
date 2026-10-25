import * as THREE from 'three';
import {
  createScene, createCamera, createRig, key, addSky, addSea, addMoon, addStars,
  addDust, addEnvLights, billboardMoon, updateWater, updateSky, addBokeh, updateUnderwater
} from './common.js';
import {
  makeEnvelope, makeCrane, makeJellyfish, makeBubbles, makePortal, makeGlyphRing,
  makeGlint, makeLantern
} from '../core/objects.js';
import { createUnderwaterMaterial, makeSky, col } from '../core/materials.js';
import { ASPECT } from '../data/shots.js';
import { clamp01, smoothstep } from '../core/utils.js';

const MOON = [0, 30, -150];

export function createMoongate({ tex }) {
  const scene = createScene({ fog: { color: '#040b14', density: .0095 } });
  const camera = createCamera(ASPECT, 40);
  const rig = createRig(camera, { shake: .012, lookShake: .009 });

  const sky = addSky(scene, tex, {
    zenith: '#01030a', horizon: '#081525', glowColor: '#d6e5f4',
    moonDir: MOON, glow: .8, galaxy: .4, ink: .5
  });
  const sea = addSea(scene, tex, {
    size: 520, segments: 140, y: 0,
    uniforms: {
      deep: '#010409', surface: '#0a1c2d', horizon: '#050f1a', deepTint: '#000204',
      moonColor: '#e4f0fb', moonDir: MOON, moonPower: .85,
      ink: .8, glitter: .6, fogDensity: .011, swell: .7
    }
  });
  const moon = addMoon(scene, tex, { pos: MOON, size: 56, halo: .9, ring: 2.9, ringColor: '#c6dcf0' });
  addStars(scene, tex, { count: 1500, radius: 440, color: '#d3e3f4', size: .9, seed: 101, opacity: .5 });
  addEnvLights(scene, MOON, {
    moonIntensity: 2.2, hemi: .35, ambient: '#071322', rimColor: '#4f7396', rimIntensity: .6
  });

  const dome = makeSky({ radius: 380, material: createUnderwaterMaterial({
    top: '#1d3d55', mid: '#061522', deep: '#010306',
    glowColor: '#d4eaf8', moonDir: [0, 1, -.3], caustic: 1
  }) });
  dome.visible = false;
  scene.add(dome);

  const jellies = makeJellyfish(tex, {
    count: 7, center: [0, 9, -12], spread: 26, color: '#9fd2e8', seed: 31, scale: 1.25
  });
  jellies.visible = false;
  scene.add(jellies);

  const bubbles = makeBubbles(tex, {
    count: 380, spread: 22, height: 40, center: [0, 8, -6],
    size: 1.05, opacity: .26, seed: 19, rise: .65
  });
  bubbles.visible = false;
  scene.add(bubbles);

  const surfaceGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#a8cde6'), transparent: true, opacity: .09,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  surfaceGlow.scale.set(60, 14, 1);
  surfaceGlow.position.set(0, .2, -20);
  surfaceGlow.visible = false;
  scene.add(surfaceGlow);

  const lanterns = new THREE.Group();
  [[-13, 7, -8], [11, 4, -16], [16, 12, -28]].forEach((p, i) => {
    const l = makeLantern(tex, { scale: .8, color: '#ffc78e' });
    l.position.set(...p);
    l.userData.light.intensity = 7;
    l.userData.phase = i * 2.1;
    lanterns.add(l);
  });
  lanterns.visible = false;
  scene.add(lanterns);

  const env = makeEnvelope(tex, { scale: 1.35, pageVariant: 1, sealGlyph: '爱' });
  env.rotation.set(-.1, .2, -.04);
  scene.add(env);

  const envGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffd4a4'), transparent: true, opacity: .15,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  envGlow.scale.setScalar(4.2);
  scene.add(envGlow);

  const craneHolder = new THREE.Group();
  const crane = makeCrane(tex, { scale: 4.2 });
  craneHolder.add(crane);
  craneHolder.visible = false;
  scene.add(craneHolder);

  const craneGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#ffe3c0'), transparent: true, opacity: .19,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  craneGlow.scale.setScalar(10);
  craneHolder.add(craneGlow);

  const portal = makePortal(tex, { radius: 21, colorA: '#9dc7e9', colorB: '#fff4dc' });
  portal.position.set(...MOON);
  portal.visible = false;
  scene.add(portal);

  const glyphRing = makeGlyphRing(tex, {
    radius: 27, count: 30, size: 4.4, color: '#dceaf7', opacity: .5, seed: 9, axis: 'z'
  });
  glyphRing.position.set(...MOON);
  glyphRing.visible = false;
  scene.add(glyphRing);

  const portalGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col('#fff0d4'), transparent: true, opacity: .32,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  portalGlow.scale.setScalar(72);
  portalGlow.position.set(MOON[0], MOON[1], MOON[2] + 1);
  portalGlow.visible = false;
  scene.add(portalGlow);

  const glint = makeGlint(tex, '#ffe0b6', 1.8, .28);
  scene.add(glint);

  const dust = addDust(scene, tex, {
    count: 600, area: [40, 24, 40], center: [0, 8, -12], size: .95,
    opacity: .18, seed: 111, drift: .5, sizeScale: 30
  });
  addBokeh(scene, tex, { count: 9, center: [0, 6, -10], spread: 20, color: '#8fb3cc', strength: .55, size: .8 });

  const views = {
    under: {
      keys: [
        key([0, -6.6, 19], [0, 5.5, -6], 40, -.01),
        key([.6, -5.4, 16.5], [0, 7.2, -8], 42, .01),
        key([-.6, -4.2, 14], [0, 9.2, -9], 44, .02),
        key([.4, -2.8, 11.5], [0, 10.8, -10], 46, .012)
      ]
    },
    flight: {
      keys: [
        key([0, 3.2, 34], [0, 14, -40], 40, 0),
        key([8, 6.5, 26], [0, 18, -70], 38, -.01),
        key([14, 9.5, 16], [0, 22, -100], 36, .008),
        key([6, 13, 8], [0, 26, -128], 35, .016),
        key([-4, 17, 2], [0, 29, -148], 34, .008)
      ]
    },
    portal: {
      keys: [
        key([0, 26, -92], [0, 30, -150], 42, 0),
        key([1.4, 27.4, -110], [0, 30, -150], 48, .01),
        key([-.8, 28.8, -127], [0, 30, -150], 56, -.01),
        key([.4, 29.6, -141], [0, 30, -150], 66, .006),
        key([0, 30, -149.2], [0, 30, -150], 78, 0)
      ]
    }
  };

  let active = 'under';
  function setView(v) {
    active = views[v] ? v : 'under';
    rig.set(views[active].keys);
    const under = active === 'under';
    dome.visible = under;
    jellies.visible = under;
    bubbles.visible = under;
    surfaceGlow.visible = under;
    lanterns.visible = under;
    env.visible = under;
    envGlow.visible = under;
    craneHolder.visible = active === 'flight';
    portal.visible = active === 'portal';
    glyphRing.visible = active === 'portal';
    portalGlow.visible = active === 'portal';
    moon.visible = active !== 'portal';
  }
  setView('under');

  const moonDir = new THREE.Vector3(...MOON).normalize();
  const craneTarget = new THREE.Vector3(...MOON);

  function update(t, local, shot, analysis) {
    const energy = analysis.at(t);
    const pulse = analysis.pulse(t, .6, 2.1);
    updateSky(sky, t);
    updateWater(sea, t, { moonDir, ripple: .4 + pulse * .45 });
    billboardMoon(moon, camera);
    updateUnderwater(dome, t);
    dust.userData.update(t, energy);
    if (jellies.visible) jellies.userData.update(t);
    if (bubbles.visible) bubbles.userData.update(t);

    if (active === 'under') {
      const rise = clamp01((t - 195) / 14.77);
      env.position.set(Math.sin(t * .4) * .4, -5.6 + rise * 5.4, 10.5 - rise * 2.5);
      const dx = camera.position.x - env.position.x;
      const dy = camera.position.y - env.position.y;
      const dz = camera.position.z - env.position.z;
      const yaw = Math.atan2(dx, dz);
      const pitch = Math.asin(Math.max(-1, Math.min(1, -dy / Math.hypot(dx, dy, dz))));
      env.rotation.set(
        pitch + Math.sin(t * .3) * .04,
        yaw + Math.sin(t * .25) * .08,
        Math.sin(t * .3) * .03
      );
      env.userData.setGlow(.1 + pulse * .5);
      envGlow.position.set(env.position.x, env.position.y + .1, env.position.z - .3);
      envGlow.material.opacity = .12 + pulse * .09;
      glint.position.set(env.position.x, env.position.y + .4, env.position.z + .2);
      glint.material.opacity = .15 + pulse * .2;
      lanterns.children.forEach((l, i) => {
        l.position.y += Math.sin(t * .5 + i * 2.1) * .002;
        l.userData.light.intensity = 6 + Math.sin(t * 1.2 + i) * 1.4;
      });
      surfaceGlow.material.opacity = .07 + pulse * .05;
    } else {
      const fly = clamp01((t - 209.77) / 14.27);
      const eased = 1 - Math.pow(1 - fly, 1.6);
      craneHolder.position.set(
        Math.sin(t * .35) * 5,
        8 + eased * 21,
        10 - eased * 128
      );
      craneHolder.lookAt(craneTarget);
      crane.userData.update(t);
      craneGlow.material.opacity = .16 + pulse * .1;
      craneGlow.position.set(0, 0, 0);
      glint.position.set(craneHolder.position.x, craneHolder.position.y, craneHolder.position.z);
      glint.material.opacity = active === 'portal' ? 0 : .2 + pulse * .2;
    }

    if (active === 'portal') {
      const rush = clamp01((t - 224.04) / 16.67);
      portal.userData.update(t, .8 + rush * .2);
      glyphRing.rotation.z = t * .08;
      portalGlow.material.opacity = .14 + rush * .12;
      portalGlow.scale.setScalar(60 + rush * 8);
    }

    rig.shake = .009 + energy * .024;
    rig.lookShake = .007 + energy * .012;
    rig.positionBias.set(Math.sin(t * .6) * .04, Math.sin(t * .5) * .03, 0);

    const portalBoost = active === 'portal' ? smoothstep(224.04, 240.4, t) : 0;
    return {
      bloom: .58 + portalBoost * .08, bloomRadius: .8, bloomThreshold: .8 - portalBoost * .05,
      exposure: .96 + portalBoost * .12, contrast: 1.06, saturation: 1.0,
      vignette: .44, grain: .023, aberration: .22 + portalBoost * .3
    };
  }

  return {
    id: 'moongate', scene, camera, rig, views, setView, update,
    post: { bloom: .58, bloomRadius: .8, bloomThreshold: .8, exposure: .96, contrast: 1.06, saturation: 1.0, vignette: .44, grain: .023, aberration: .22 }
  };
}
