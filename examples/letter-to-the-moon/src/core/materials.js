import * as THREE from 'three';
import {
  WATER_VERT, WATER_FRAG, SKY_VERT, SKY_FRAG, UNDERWATER_VERT, UNDERWATER_FRAG,
  SHAFT_VERT, SHAFT_FRAG, THREAD_VERT, THREAD_FRAG, DUST_VERT, BUBBLE_VERT,
  PARTICLE_FRAG, STAR_VERT, PORTAL_VERT, PORTAL_FRAG
} from './shaders.js';

export const PALETTE = {
  ink: '#03050b',
  ink2: '#060a16',
  night: '#0a1328',
  moon: '#e7edf5',
  paper: '#e8e0cf',
  red: '#c94535',
  gold: '#c8a96b',
  mist: '#5c7c9e',
  deep: '#040a14',
  horizon: '#0d1a2e'
};

export const col = (hex) => new THREE.Color(hex);

export function createPaperMaterial(map, opts = {}) {
  const {
    color = '#ffffff', roughness = .9, metalness = 0, side = THREE.DoubleSide,
    transparent = false, opacity = 1, emissive = '#000000', emissiveIntensity = 0,
    alphaTest = 0, depthWrite = true, mapRepeat = null
  } = opts;
  let tex = map;
  if (tex && mapRepeat) {
    tex = tex.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(mapRepeat[0], mapRepeat[1]);
  }
  return new THREE.MeshStandardMaterial({
    map: tex || null,
    color: col(color),
    roughness, metalness, side, transparent, opacity,
    emissive: col(emissive), emissiveIntensity, alphaTest, depthWrite
  });
}

export function createWaterMaterial(opts = {}) {
  const defaults = {
    deep: PALETTE.deep,
    surface: '#0d2038',
    horizon: '#0b1626',
    deepTint: '#01040a',
    moonColor: '#dfe9f8',
    moonDir: [0, .24, -1],
    moonPower: 1,
    ink: .65,
    glitter: 1,
    fogDensity: .012,
    stars: 0,
    starColor: '#dbe8ff',
    swell: 1,
    chop: 1,
    flow: [0, 0]
  };
  const o = { ...defaults, ...opts };
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: col(o.deep) },
    uSurface: { value: col(o.surface) },
    uHorizon: { value: col(o.horizon) },
    uDeepTint: { value: col(o.deepTint) },
    uMoonColor: { value: col(o.moonColor) },
    uMoonDir: { value: new THREE.Vector3(...o.moonDir).normalize() },
    uMoonPower: { value: o.moonPower },
    uInk: { value: o.ink },
    uGlitter: { value: o.glitter },
    uFogDensity: { value: o.fogDensity },
    uStars: { value: o.stars },
    uStarColor: { value: col(o.starColor) },
    uSwell: { value: o.swell },
    uChop: { value: o.chop },
    uFlow: { value: new THREE.Vector2(...o.flow) },
    uRipple: { value: 0 },
    uRippleCenter: { value: new THREE.Vector2() },
    uMirror: { value: 0 }
  };
  return new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms,
    side: THREE.DoubleSide,
    transparent: false,
    fog: false
  });
}

export function makeWater({ size = 420, segments = 110, y = 0, material } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material || createWaterMaterial());
  mesh.position.y = y;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

export function createSkyMaterial(opts = {}) {
  const o = {
    zenith: '#03060e',
    horizon: '#0b1728',
    glowColor: '#cfdceb',
    moonDir: [0, .25, -1],
    glow: 1,
    galaxy: .5,
    ink: .55,
    ...opts
  };
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uZenith: { value: col(o.zenith) },
      uHorizon: { value: col(o.horizon) },
      uGlowColor: { value: col(o.glowColor) },
      uMoonDir: { value: new THREE.Vector3(...o.moonDir).normalize() },
      uGlow: { value: o.glow },
      uGalaxy: { value: o.galaxy },
      uInk: { value: o.ink },
      uTime: { value: 0 }
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
}

export function makeSky({ radius = 600, material } = {}) {
  const geo = new THREE.SphereGeometry(radius, 48, 28);
  const mesh = new THREE.Mesh(geo, material || createSkyMaterial());
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  return mesh;
}

export function createUnderwaterMaterial(opts = {}) {
  const o = {
    top: '#1a3550',
    mid: '#08182b',
    deep: '#010409',
    glowColor: '#cfe2f5',
    moonDir: [0, 1, -.25],
    caustic: 1,
    ...opts
  };
  return new THREE.ShaderMaterial({
    vertexShader: UNDERWATER_VERT,
    fragmentShader: UNDERWATER_FRAG,
    uniforms: {
      uTop: { value: col(o.top) },
      uMid: { value: col(o.mid) },
      uDeep: { value: col(o.deep) },
      uGlowColor: { value: col(o.glowColor) },
      uMoonDir: { value: new THREE.Vector3(...o.moonDir).normalize() },
      uTime: { value: 0 },
      uCaustic: { value: o.caustic }
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
}

export function createShaftMaterial({ color = '#c8dcf0', opacity = .5, soft = .7, seed = 0 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT,
    fragmentShader: SHAFT_FRAG,
    uniforms: {
      uColor: { value: col(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uSoft: { value: soft }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

export function makeShaft({ width = 14, height = 90, color = '#c8dcf0', opacity = .32, seed = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(width, height);
  const mesh = new THREE.Mesh(geo, createShaftMaterial({ color, opacity, seed }));
  mesh.renderOrder = 2;
  return mesh;
}

export function createThreadMaterial(opts = {}) {
  const o = {
    colorA: '#7c1d12',
    colorB: '#e0593f',
    glow: '#ffa080',
    ...opts
  };
  return new THREE.ShaderMaterial({
    vertexShader: THREAD_VERT,
    fragmentShader: THREAD_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: .4 },
      uPulse: { value: 0 },
      uColorA: { value: col(o.colorA) },
      uColorB: { value: col(o.colorB) },
      uGlowColor: { value: col(o.glow) },
      uCameraPos: { value: new THREE.Vector3() }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

export function createDustMaterial({ color = '#b9cfe6', opacity = .55, sizeScale = 55, soft = 1 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: sizeScale },
      uEnergy: { value: .4 },
      uDrift: { value: .8 },
      uRise: { value: 0 },
      uColor: { value: col(color) },
      uOpacity: { value: opacity },
      uSoft: { value: soft }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function createBubbleMaterial({ color = '#c8e2f0', opacity = .45, sizeScale = 55 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: BUBBLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: sizeScale },
      uRise: { value: .5 },
      uSpread: { value: 30 },
      uColor: { value: col(color) },
      uOpacity: { value: opacity },
      uSoft: { value: 1 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function createStarMaterial({ color = '#dce9ff', sizeScale = 1, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: sizeScale },
      uColor: { value: col(color) },
      uOpacity: { value: opacity },
      uSoft: { value: 1 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function createRainMaterial({ color = '#bfd8ef', opacity = .34, height = 22, speed = 7.5 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aEnd;
      uniform float uTime;
      uniform float uHeight;
      uniform float uSpeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float baseY = mod(p.y + uTime * uSpeed * (.45 + aSeed * 1.15) + aSeed * 173.0, uHeight) - uHeight * .55;
        p.y = baseY + aEnd * (.45 + aSeed * 1.6);
        p.x += sin(uTime * .35 + aSeed * 18.0) * .18 + aEnd * .03;
        float edge = smoothstep(uHeight * .5, uHeight * .38, p.y) * smoothstep(-uHeight * .55, -uHeight * .44, p.y);
        vAlpha = (.20 + aSeed * .8) * edge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha * uOpacity);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: height },
      uSpeed: { value: speed },
      uColor: { value: col(color) },
      uOpacity: { value: opacity }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

export function createPortalMaterial({ colorA = '#79a4c8', colorB = '#f6d7b0', opacity = .8 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: PORTAL_VERT,
    fragmentShader: PORTAL_FRAG,
    uniforms: {
      uColorA: { value: col(colorA) },
      uColorB: { value: col(colorB) },
      uTime: { value: 0 },
      uOpacity: { value: opacity }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

export function addLights(scene, opts = {}) {
  const {
    moonColor = '#dfe9f6', moonIntensity = 2.2, moonDir = [8, 18, -12],
    ambient = '#0b1524', ground = '#020308', hemi = .55,
    rimColor = '#54749a', rimIntensity = .8,
    accentColor = null, accentPos = [0, 2, 0], accentIntensity = 26, accentDistance = 22
  } = opts;

  const hemiLight = new THREE.HemisphereLight(col(ambient), col(ground), hemi);
  scene.add(hemiLight);

  const key = new THREE.DirectionalLight(col(moonColor), moonIntensity);
  key.position.set(...moonDir);
  scene.add(key);

  const rim = new THREE.DirectionalLight(col(rimColor), rimIntensity);
  rim.position.set(-moonDir[0] * .6, moonDir[1] * .4, -moonDir[2] * .8);
  scene.add(rim);

  if (accentColor) {
    const p = new THREE.PointLight(col(accentColor), accentIntensity, accentDistance, 2);
    p.position.set(...accentPos);
    scene.add(p);
  }
  return { hemiLight, key, rim };
}
