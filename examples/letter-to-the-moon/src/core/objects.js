import * as THREE from 'three';
import { mulberry32, pick, clamp01, lerp, smoothstep, easeOutCubic } from './utils.js';
import {
  createPaperMaterial, createThreadMaterial, createDustMaterial, createBubbleMaterial,
  createStarMaterial, createRainMaterial, createPortalMaterial, col, PALETTE
} from './materials.js';
import { createSpriteMaterial } from './textures.js';
import { TYPE_GLYPHS, CITY_WORDS } from '../data/glyphs.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function makeSprite(tex, { color = '#ffffff', opacity = 1, additive = true, scale = 1, depthTest = true } = {}) {
  const mat = createSpriteMaterial(tex.glow(), color, opacity, additive);
  mat.depthTest = depthTest;
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

export function makeNamedSprite(texture, { color = '#ffffff', opacity = 1, additive = true, scale = 1 } = {}) {
  const mat = createSpriteMaterial(texture, color, opacity, additive);
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

function cylinderBetween(a, b, radius, material, radialSegments = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function triangleGeo(a, b, c, uvA = [0, 0], uvB = [1, 0], uvC = [.5, 1]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([...uvA, ...uvB, ...uvC], 2));
  g.computeVertexNormals();
  return g;
}

function quadGeo(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* Envelope                                                            */
/* ------------------------------------------------------------------ */
export function makeEnvelope(tex, { scale = 1, pageVariant = 0, sealGlyph = '爱' } = {}) {
  const group = new THREE.Group();
  group.name = 'envelope';
  const W = 2.2, H = 1.45, D = .05;

  const sideMat = createPaperMaterial(tex.paper(0), {
    color: '#e4dcc9', roughness: .94, mapRepeat: [1.4, 1]
  });
  const frontMat = createPaperMaterial(tex.envelope(true), { roughness: .91, color: '#fbf6ea' });
  const backMat = createPaperMaterial(tex.envelope(false), { roughness: .91, color: '#f2eadb' });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    [sideMat, sideMat, sideMat, sideMat, frontMat, backMat]
  );
  group.add(body);

  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.03, H * .99),
    createPaperMaterial(tex.page(pageVariant), {
      transparent: true, alphaTest: .04, color: '#f1e9d8', roughness: .96
    })
  );
  inner.position.set(.035, -.01, -D * .6);
  inner.rotation.z = .022;
  group.add(inner);

  const sealMat = new THREE.MeshStandardMaterial({
    color: '#8f241b', roughness: .58, metalness: .05,
    emissive: '#3a0a06', emissiveIntensity: .35
  });
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(.205, .215, .052, 40), sealMat);
  wax.rotation.x = Math.PI / 2;
  wax.position.set(0, .12, D * .5 + .026);
  group.add(wax);

  const sealFace = new THREE.Mesh(
    new THREE.CircleGeometry(.2, 40),
    new THREE.MeshStandardMaterial({
      map: tex.seal(), transparent: true, roughness: .55,
      emissive: '#360906', emissiveIntensity: .25, color: '#f0c2b4'
    })
  );
  sealFace.position.set(0, .12, D * .5 + .054);
  group.add(sealFace);

  const wax2 = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 8), sealMat);
  wax2.scale.set(1, .55, .8);
  wax2.position.set(.17, -.01, D * .5 + .018);
  group.add(wax2);

  const threadMat = new THREE.MeshStandardMaterial({
    color: '#8f2a1c', roughness: .62, metalness: 0, emissive: '#200503', emissiveIntensity: .3
  });
  const threadCurve = new THREE.CatmullRomCurve3([
    V3(.06, .17, D * .5 + .05),
    V3(.42, .28, .08),
    V3(.82, .03, .18),
    V3(1.28, .16, .34),
    V3(1.7, .04, .62)
  ]);
  const thread = new THREE.Mesh(new THREE.TubeGeometry(threadCurve, 48, .012, 4, false), threadMat);
  thread.frustumCulled = false;
  group.add(thread);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
    new THREE.LineBasicMaterial({ color: '#29313c', transparent: true, opacity: .26 })
  );
  group.add(edges);

  // the letter carries its own warm reading light so the paper never dies in a dark shot
  const fill = new THREE.PointLight('#ffd9b2', 2.4, 7, 2);
  fill.position.set(0, .3, 1.25);
  group.add(fill);

  group.scale.setScalar(scale);
  group.rotation.x = -Math.PI / 2;
  group.userData = {
    body, seal: wax, sealFace, thread, frontMat, backMat, sideMat, inner, fill,
    materials: [sideMat, frontMat, backMat, sealMat, sealFace.material, threadMat, inner.material],
    setOpacity(o) {
      for (const m of this.materials) {
        m.transparent = true;
        m.opacity = o;
      }
      inner.material.opacity = o;
      edges.material.opacity = .26 * o;
      fill.intensity = 2.4 * o;
    },
    setGlow(v) {
      sealMat.emissiveIntensity = .35 + v * 2.2;
      sealFace.material.emissiveIntensity = .25 + v * 1.9;
      threadMat.emissiveIntensity = .3 + v * .8;
    }
  };
  return group;
}

/* ------------------------------------------------------------------ */
/* Moon + ring                                                         */
/* ------------------------------------------------------------------ */
export function makeMoon(tex, { size = 60, halo = .62, ring = 0, ringColor = '#cfe1f5', warm = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'moon';

  const haloMat = new THREE.SpriteMaterial({
    map: tex.glow(), color: col(warm ? '#f0e2c6' : '#b9d0e8'),
    transparent: true, opacity: halo * .5, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: false
  });
  const haloA = new THREE.Sprite(haloMat);
  haloA.scale.setScalar(size * 2.5);
  group.add(haloA);

  const haloB = new THREE.Sprite(haloMat.clone());
  haloB.material.color = col(warm ? '#fff4dc' : '#e8f1fb');
  haloB.material.opacity = halo * .32;
  haloB.scale.setScalar(size * 1.42);
  group.add(haloB);

  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: tex.moon(), transparent: true, depthWrite: false,
      toneMapped: false, color: new THREE.Color(1, 1, 1), fog: false
    })
  );
  disc.position.z = .02;
  group.add(disc);

  let ringMesh = null;
  if (ring > 0) {
    const ringMat = new THREE.MeshBasicMaterial({
      map: tex.ringGlow(), color: col(ringColor), transparent: true,
      opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: false, fog: false
    });
    ringMesh = new THREE.Mesh(new THREE.PlaneGeometry(size * ring, size * ring), ringMat);
    ringMesh.position.z = -.15;
    group.add(ringMesh);
    const innerRing = new THREE.Mesh(new THREE.PlaneGeometry(size * ring * .82, size * ring * .82), ringMat.clone());
    innerRing.material.opacity = .26;
    innerRing.position.z = -.1;
    group.add(innerRing);
    group.userData.innerRing = innerRing;
  }

  group.userData = {
    ...group.userData, disc, haloA, haloB, ringMesh,
    billboard(camera) { group.quaternion.copy(camera.quaternion); },
    setOpacity(o) {
      haloA.material.opacity = halo * .5 * o;
      haloB.material.opacity = halo * .32 * o;
      disc.material.opacity = o;
      if (ringMesh) { ringMesh.material.opacity = .75 * o; group.userData.innerRing.material.opacity = .26 * o; }
    }
  };
  return group;
}

export function makeRing(tex, { radius = 20, color = '#d8e8fa', opacity = .7, thickness = .7 } = {}) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex.ringGlow(), color: col(color), transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.4, radius * 2.4), mat);
  mesh.userData.radius = radius;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Red thread bundle                                                   */
/* ------------------------------------------------------------------ */
export function makeThreadBundle(tex, {
  count = 52, minR = 5, maxR = 24, thickness = .016, seed = 11,
  center = [0, 0, 0], vertical = .7, tagCount = 9, tagChars = ['爱', '念', '等', '信', '月', '你'],
  colorA = '#6e1710', colorB = '#e2593f'
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'threads';
  group.position.set(...center);
  const mat = createThreadMaterial({ colorA, colorB });
  const c = V3();
  const curves = [];

  for (let i = 0; i < count; i++) {
    const phi = rnd() * Math.PI * 2;
    const ry = (rnd() * 2 - 1) * vertical;
    const dir = V3(Math.cos(phi) * Math.sqrt(1 - Math.min(.96, ry * ry)), ry, Math.sin(phi) * Math.sqrt(1 - Math.min(.96, ry * ry))).normalize();
    const r = lerp(minR, maxR, Math.pow(rnd(), .7));
    const p0 = c.clone().add(V3((rnd() - .5) * .5, (rnd() - .5) * .4, (rnd() - .5) * .5));
    const side = V3(-dir.z, 0, dir.x);
    const p1 = dir.clone().multiplyScalar(r * (.28 + rnd() * .12))
      .add(side.clone().multiplyScalar((rnd() - .5) * r * .1))
      .add(V3(0, (rnd() - .5) * 2.4, 0));
    const p2 = dir.clone().multiplyScalar(r * (.65 + rnd() * .18))
      .add(side.clone().multiplyScalar((rnd() - .5) * r * .15))
      .add(V3((rnd() - .5) * 1.6, (rnd() - .5) * 3.2, (rnd() - .5) * 1.6));
    const p3 = dir.clone().multiplyScalar(r)
      .add(V3((rnd() - .5) * 2.2, (rnd() - .5) * 2.6, (rnd() - .5) * 2.2));
    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3], false, 'centripetal', .5);
    const geo = new THREE.TubeGeometry(curve, 52, thickness * (.65 + rnd() * .85), 4, false);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const along = new Float32Array(pos.count);
    const phase = new Float32Array(pos.count);
    const adir = new Float32Array(pos.count * 3);
    const ph = rnd();
    for (let j = 0; j < pos.count; j++) {
      along[j] = uv.getX(j);
      phase[j] = ph;
      adir[j * 3] = nrm.getX(j);
      adir[j * 3 + 1] = nrm.getY(j);
      adir[j * 3 + 2] = nrm.getZ(j);
    }
    geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aDir', new THREE.BufferAttribute(adir, 3));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    curves.push({ curve, phase: ph });
  }

  const tags = [];
  for (let i = 0; i < tagCount; i++) {
    const rec = curves[Math.floor(rnd() * curves.length)];
    const at = .45 + rnd() * .38;
    const p = rec.curve.getPoint(at);
    const ch = pick(rnd, tagChars);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(.26, .33),
      new THREE.MeshStandardMaterial({
        map: tex.glyph(ch, { mode: 'tag' }), transparent: true, alphaTest: .05,
        side: THREE.DoubleSide, roughness: .9, color: '#f2ead9'
      })
    );
    tag.position.copy(p).add(V3((rnd() - .5) * .3, -.16 - rnd() * .3, (rnd() - .5) * .3));
    tag.rotation.set((rnd() - .5) * .8, rnd() * Math.PI, (rnd() - .5) * .5);
    tag.userData.phase = rnd() * Math.PI * 2;
    tag.userData.baseRot = tag.rotation.clone();
    group.add(tag);
    tags.push(tag);

    const hanger = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p, tag.position.clone().add(V3(0, .17, 0))]),
      new THREE.LineBasicMaterial({ color: '#b84632', transparent: true, opacity: .5 })
    );
    group.add(hanger);
  }

  group.userData = {
    material: mat,
    tags,
    update(t, energy = .4, pulse = 0) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uEnergy.value = energy;
      mat.uniforms.uPulse.value = pulse;
      for (const tag of tags) {
        tag.rotation.z = tag.userData.baseRot.z + Math.sin(t * 1.1 + tag.userData.phase) * .16;
        tag.rotation.y = tag.userData.baseRot.y + Math.sin(t * .7 + tag.userData.phase * 1.7) * .12;
      }
      group.rotation.y = Math.sin(t * .045) * .035;
    },
    setCamera(camera) {
      mat.uniforms.uCameraPos.value.copy(camera.position);
    }
  };
  return group;
}

export function makeThread(tex, points, { radius = .014, colorA = '#6b1710', colorB = '#dd553c' } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? V3(...p) : p.clone()));
  const geo = new THREE.TubeGeometry(curve, 80, radius, 4, false);
  const pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv;
  const along = new Float32Array(pos.count), phase = new Float32Array(pos.count), adir = new Float32Array(pos.count * 3);
  for (let j = 0; j < pos.count; j++) {
    along[j] = uv.getX(j); phase[j] = .5;
    adir[j * 3] = nrm.getX(j); adir[j * 3 + 1] = nrm.getY(j); adir[j * 3 + 2] = nrm.getZ(j);
  }
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aDir', new THREE.BufferAttribute(adir, 3));
  const mat = createThreadMaterial({ colorA, colorB });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.curve = curve;
  mesh.userData.material = mat;
  mesh.userData.update = (t, energy = .4, pulse = 0) => {
    mat.uniforms.uTime.value = t;
    mat.uniforms.uEnergy.value = energy;
    mat.uniforms.uPulse.value = pulse;
  };
  mesh.userData.setCamera = (camera) => {
    mat.uniforms.uCameraPos.value.copy(camera.position);
  };
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Paper fish                                                          */
/* ------------------------------------------------------------------ */
function buildFish(tex, variant, matScale = 1) {
  const mat = createPaperMaterial(tex.fish(variant), {
    color: '#f2eddf', roughness: .88, transparent: true, opacity: .95,
    emissive: '#0b1b24', emissiveIntensity: .35
  });
  const group = new THREE.Group();

  const bodyGeo = quadGeo(
    [0, 0, .78], [-.2, 0, .06], [0, 0, -.72], [.2, 0, .06]
  );
  const body = new THREE.Mesh(bodyGeo, mat);
  group.add(body);

  const spineMat = new THREE.MeshBasicMaterial({ color: '#1b2a33', transparent: true, opacity: .35 });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.012, .006, 1.45, 4), spineMat);
  spine.rotation.x = Math.PI / 2;
  spine.position.z = .02;
  group.add(spine);

  const makeWing = (side) => {
    const pivot = new THREE.Group();
    pivot.position.x = side * .08;
    const s = side;
    const g = new THREE.BufferGeometry();
    const a = [0, 0, .28], b = [s * 1.18, .18, -.02], c = [s * .32, 0, -.56], d = [s * .66, .08, .16];
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      ...a, ...b, ...d,
      ...b, ...c, ...d
    ], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([
      0, 1, 1, .55, .5, .9,
      1, .55, 1, 0, .5, .9
    ], 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    pivot.add(m);
    group.add(pivot);
    return pivot;
  };
  const wingL = makeWing(-1);
  const wingR = makeWing(1);

  const tailPivot = new THREE.Group();
  tailPivot.position.z = -.62;
  const tail = new THREE.Mesh(triangleGeo([0, 0, 0], [-.24, 0, -.7], [.24, 0, -.7]), mat);
  tailPivot.add(tail);
  group.add(tailPivot);

  const tags = new THREE.Group();
  group.add(tags);
  group.scale.setScalar(matScale);
  group.userData = { mat, wingL, wingR, tailPivot, body, variant };
  return group;
}

export function makeFishSchool(tex, {
  count = 13, center = [0, 0, 0], seed = 21, spread = 10, hero = 2
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'fish-school';
  group.position.set(...center);
  const fishes = [];
  for (let i = 0; i < count; i++) {
    const big = i < hero;
    const variant = i % 3;
    const mesh = buildFish(tex, variant, big ? 1.55 + rnd() * .6 : .5 + rnd() * .72);
    const params = {
      rx: big ? 3.4 + rnd() * 1.8 : 2.4 + rnd() * spread,
      ry: 1.2 + rnd() * spread * .55,
      rz: 2.4 + rnd() * spread,
      phase: rnd() * Math.PI * 2,
      speed: (big ? .15 : .22) + rnd() * .26,
      dir: rnd() > .22 ? 1 : -1,
      yOff: (rnd() - .5) * 3.4,
      flap: 1.7 + rnd() * 1.7,
      bank: (rnd() - .5) * .6,
      size: mesh.scale.x
    };
    const p = new THREE.Vector3(
      Math.cos(params.phase) * params.rx,
      params.yOff,
      Math.sin(params.phase) * params.rz
    );
    mesh.position.copy(p);
    group.add(mesh);
    fishes.push({ mesh, ...params });
  }

  const dummy = new THREE.Vector3();
  const next = new THREE.Vector3();
  group.userData = {
    fishes,
    update(t, energy = .4) {
      for (const f of fishes) {
        const a = f.phase + t * f.speed * f.dir;
        dummy.set(Math.cos(a) * f.rx, f.yOff + Math.sin(a * 1.7 + f.phase) * f.ry * .34, Math.sin(a) * f.rz);
        const a2 = a + .03 * f.dir;
        next.set(Math.cos(a2) * f.rx, f.yOff + Math.sin(a2 * 1.7 + f.phase) * f.ry * .34, Math.sin(a2) * f.rz);
        f.mesh.position.copy(dummy);
        f.mesh.lookAt(group.localToWorld(next.clone()));
        f.mesh.rotateZ(f.bank + Math.sin(a * 1.3) * .22);
        const flap = Math.sin(t * f.flap + f.phase) * (.32 + energy * .18);
        f.mesh.userData.wingL.rotation.z = flap;
        f.mesh.userData.wingR.rotation.z = -flap;
        f.mesh.userData.tailPivot.rotation.y = Math.sin(t * f.flap * .7 + f.phase) * .35;
      }
    }
  };
  return group;
}

/* ------------------------------------------------------------------ */
/* Origami crane                                                       */
/* ------------------------------------------------------------------ */
export function makeCrane(tex, { scale = 1 } = {}) {
  const group = new THREE.Group();
  group.name = 'crane';
  const light = new THREE.MeshStandardMaterial({
    map: tex.paper(1), color: '#f7f4ec', roughness: .88, metalness: 0, side: THREE.DoubleSide,
    flatShading: true, emissive: '#16202c', emissiveIntensity: .35
  });
  const shade = new THREE.MeshStandardMaterial({
    map: tex.paper(2), color: '#dfe4e8', roughness: .92, metalness: 0, side: THREE.DoubleSide,
    flatShading: true, emissive: '#101a25', emissiveIntensity: .3
  });

  const body = new THREE.Mesh(quadGeo(
    [0, 0, .9], [-.28, .1, 0], [0, 0, -.78], [.28, .1, 0]
  ), light);
  group.add(body);

  const belly = new THREE.Mesh(quadGeo(
    [0, 0, .85], [.28, .1, 0], [0, -.18, -.2], [-.28, .1, 0]
  ), shade);
  group.add(belly);

  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * .1, .06, .02);
    const root = [0, 0, .34], tip = [side * 2.1, 1.12, -.2];
    const mid = [side * 1.02, .52, .25], back = [side * .36, .03, -.6];
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      ...root, ...mid, ...tip,
      ...root, ...tip, ...back,
      ...root, ...back, ...mid
    ], 3));
    wingGeo.setAttribute('uv', new THREE.Float32BufferAttribute([
      .1, .9, .5, .55, 1, .8,
      .1, .9, 1, .8, .5, .2,
      .1, .9, .5, .2, .5, .55
    ], 2));
    wingGeo.computeVertexNormals();
    const wing = new THREE.Mesh(wingGeo, side < 0 ? shade : light);
    pivot.add(wing);
    group.add(pivot);
    wings.push({ pivot, side });
  }

  const neck = new THREE.Mesh(quadGeo(
    [0, .02, .7], [.12, .02, .74], [0, .68, 1.58], [-.12, .02, .74]
  ), light);
  group.add(neck);
  const head = new THREE.Mesh(triangleGeo(
    [0, .68, 1.58], [0, .5, 1.38], [0, .74, 1.92]
  ), shade);
  group.add(head);

  const tail = new THREE.Mesh(quadGeo(
    [0, .02, -.7], [.28, .02, -.82], [0, .62, -1.4], [-.28, .02, -.82]
  ), light);
  group.add(tail);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(group.children[0].geometry),
    new THREE.LineBasicMaterial({ color: '#7b8794', transparent: true, opacity: .18 })
  );
  group.add(edges);

  group.scale.setScalar(scale);
  group.userData = {
    wings,
    update(t) {
      const f = Math.sin(t * 2.15) * .42 + .12;
      for (const w of wings) w.pivot.rotation.z = -w.side * f;
      group.rotation.z = Math.sin(t * .8) * .05;
    }
  };
  return group;
}

/* ------------------------------------------------------------------ */
/* Umbrella                                                            */
/* ------------------------------------------------------------------ */
export function makeUmbrella(tex, { scale = 1, color = '#b83a2b', lantern = true } = {}) {
  const group = new THREE.Group();
  group.name = 'umbrella';
  const R = 2.45;
  const canopyMat = new THREE.MeshStandardMaterial({
    map: tex.paper(0), color: col(color), roughness: .82, metalness: .02,
    side: THREE.DoubleSide, transparent: true, opacity: .96,
    emissive: '#250604', emissiveIntensity: .28
  });
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(R, .72, 32, 2, true), canopyMat);
  canopy.position.y = .18;
  group.add(canopy);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R, .018, 6, 48),
    new THREE.MeshStandardMaterial({ color: '#6e1710', roughness: .5, metalness: .1 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -.18;
  group.add(rim);

  const ribMat = new THREE.MeshStandardMaterial({ color: '#4c1711', roughness: .58, metalness: .12 });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const tip = V3(Math.cos(a) * R * .985, -.17, Math.sin(a) * R * .985);
    const top = V3(0, .52, 0);
    group.add(cylinderBetween(top, tip, .009, ribMat, 4));
  }

  const poleMat = new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: .5, metalness: .2 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.024, .03, 4.6, 8), poleMat);
  pole.position.y = -1.7;
  group.add(pole);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.18, .026, 6, 20, Math.PI * 1.15), poleMat);
  hook.position.set(.16, -3.98, 0);
  hook.rotation.z = Math.PI * .15;
  group.add(hook);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .09, 16),
    new THREE.MeshStandardMaterial({ color: '#c8a96b', roughness: .35, metalness: .7 }));
  collar.position.y = -.42;
  group.add(collar);

  let glow = null;
  let light = null;
  if (lantern) {
    glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glow(), color: col('#ffcb86'), transparent: true, opacity: .36,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    glow.scale.setScalar(3.4);
    glow.position.set(0, -.55, 0);
    group.add(glow);

    light = new THREE.PointLight(col('#ffbd7a'), 18, 13, 2);
    light.position.set(0, -.5, 0);
    group.add(light);
  }

  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(.28, .36),
    new THREE.MeshStandardMaterial({
      map: tex.glyph('雨', { mode: 'tag' }), transparent: true, alphaTest: .05,
      side: THREE.DoubleSide, roughness: .9, color: '#f2ead9'
    })
  );
  tag.position.set(R * .66, -.55, R * .36);
  tag.rotation.y = -.4;
  group.add(tag);

  group.scale.setScalar(scale);
  group.userData = { canopy, rim, glow, light, tag };
  return group;
}

/* ------------------------------------------------------------------ */
/* Paper figure                                                        */
/* ------------------------------------------------------------------ */
export function makeSilhouette(tex, { pose = 'stand', scale = 1.8, tint = '#d7dfe6', opacity = .94 } = {}) {
  const group = new THREE.Group();
  group.name = 'silhouette';
  const mat = new THREE.MeshStandardMaterial({
    color: col(tint), roughness: .96, metalness: 0, side: THREE.DoubleSide,
    emissive: '#263746', emissiveIntensity: .22, transparent: true, opacity
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#141d28', roughness: .98, side: THREE.DoubleSide,
    emissive: '#0a121c', emissiveIntensity: .2
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 14), mat);
  head.scale.set(1, 1.12, .72);
  head.position.y = 2.12;
  group.add(head);

  const hairShape = new THREE.Shape();
  hairShape.moveTo(-.19, 2.27);
  hairShape.bezierCurveTo(-.26, 2.16, -.23, 1.86, -.18, 1.72);
  hairShape.lineTo(.18, 1.72);
  hairShape.bezierCurveTo(.23, 1.86, .26, 2.16, .19, 2.27);
  hairShape.bezierCurveTo(.09, 2.36, -.09, 2.36, -.19, 2.27);
  const hair = new THREE.Mesh(new THREE.ShapeGeometry(hairShape), darkMat);
  hair.position.set(0, 0, -.135);
  group.add(hair);

  const coat = new THREE.Shape();
  coat.moveTo(-.17, 1.88);
  coat.bezierCurveTo(-.32, 1.8, -.4, 1.62, -.42, 1.36);
  coat.lineTo(-.36, .58);
  coat.bezierCurveTo(-.44, .4, -.48, .24, -.44, .18);
  coat.lineTo(.44, .18);
  coat.bezierCurveTo(.48, .24, .44, .4, .36, .58);
  coat.lineTo(.42, 1.36);
  coat.bezierCurveTo(.4, 1.62, .32, 1.8, .17, 1.88);
  coat.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(coat, { depth: .025, bevelEnabled: false }), mat);
  body.position.z = -.012;
  group.add(body);

  const legMat = mat;
  const legL = new THREE.Mesh(triangleGeo([-.16, .22, 0], [-.02, .22, 0], [-.1, 0, 0]), legMat);
  const legR = new THREE.Mesh(triangleGeo([.16, .22, 0], [.02, .22, 0], [.1, 0, 0]), legMat);
  group.add(legL, legR);

  const armDown = new THREE.Mesh(triangleGeo([-.32, 1.72, .01], [-.25, 1.66, .01], [-.4, .9, .01]), mat);
  group.add(armDown);

  if (pose === 'hold') {
    const armUp = new THREE.Mesh(triangleGeo([.3, 1.74, .01], [.38, 1.82, .01], [.76, 2.12, .01]), mat);
    group.add(armUp);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), mat);
    hand.position.set(.78, 2.14, 0);
    group.add(hand);
  } else {
    const armR = new THREE.Mesh(triangleGeo([.32, 1.72, .01], [.25, 1.66, .01], [.4, .9, .01]), mat);
    group.add(armR);
  }

  group.scale.setScalar(scale);
  group.userData = { mat, pose, head };
  return group;
}

/* ------------------------------------------------------------------ */
/* Glyph slabs / city                                                  */
/* ------------------------------------------------------------------ */
export function makeGlyphSlab(tex, {
  char = '爱', w = 6, h = 18, d = 3, color = '#a9bdcd', stone = '#16202d', seed = 1,
  glow = .22, seal = false
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const stoneMat = createPaperMaterial(tex.paper(2), {
    color: col(stone), roughness: 1, metalness: 0, mapRepeat: [1.6, 3]
  });
  const sideMat = new THREE.MeshStandardMaterial({ color: col('#0b1220'), roughness: 1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
  group.add(box);

  const glyphH = Math.min(h * .72, w * 1.42);
  const glyphW = glyphH / 1.406;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(glyphW, glyphH),
    new THREE.MeshBasicMaterial({
      map: tex.glyph(char, { mode: 'ink', color }),
      transparent: true, opacity: .55, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false
    })
  );
  face.position.set(0, h * .04, d / 2 + .012);
  group.add(face);

  const glowFace = new THREE.Mesh(
    new THREE.PlaneGeometry(glyphW * 1.08, glyphH * 1.08),
    new THREE.MeshBasicMaterial({
      map: tex.glyph(char, { mode: 'glow', color }),
      transparent: true, opacity: glow, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    })
  );
  glowFace.position.set(0, h * .04, d / 2 + .02);
  group.add(glowFace);

  const trim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: '#3c5368', transparent: true, opacity: .24 })
  );
  group.add(trim);

  if (seal) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(w * .16, w * .16),
      new THREE.MeshBasicMaterial({
        map: tex.sealSmall(pick(rnd, ['爱', '信', '月'])),
        transparent: true, opacity: .48, depthWrite: false, toneMapped: false
      })
    );
    s.position.set(w * .28, -h * .32, d / 2 + .014);
    group.add(s);
  }

  group.rotation.y = (rnd() - .5) * .12;
  group.rotation.z = (rnd() - .5) * .035;
  group.userData = { box, face, glowFace, char };
  return group;
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */
export function makeDust(tex, {
  count = 1300, area = [26, 14, 26], center = [0, 3, 0], color = '#bcd4ea',
  size = 1.6, opacity = .48, seed = 3, sizeScale = 48, drift = .8
} = {}) {
  const rnd = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = center[0] + (rnd() - .5) * area[0];
    positions[i * 3 + 1] = center[1] + (rnd() - .5) * area[1];
    positions[i * 3 + 2] = center[2] + (rnd() - .5) * area[2];
    seeds[i] = rnd();
    sizes[i] = size * (.35 + rnd() * 1.8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const mat = createDustMaterial({ color, opacity, sizeScale });
  mat.uniforms.uDrift.value = drift;
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  points.userData = {
    material: mat,
    update(t, energy = .4) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uEnergy.value = energy;
    }
  };
  return points;
}

export function makeBubbles(tex, {
  count = 500, spread = 26, height = 32, center = [0, 0, 0], color = '#c9e6f2',
  size = 1.4, opacity = .4, seed = 5, rise = .55
} = {}) {
  const rnd = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * spread;
    positions[i * 3] = center[0] + Math.cos(a) * r;
    positions[i * 3 + 1] = center[1] + (rnd() - .5) * height;
    positions[i * 3 + 2] = center[2] + Math.sin(a) * r;
    seeds[i] = rnd();
    sizes[i] = size * (.35 + Math.pow(rnd(), 2) * 2.3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const mat = createBubbleMaterial({ color, opacity });
  mat.uniforms.uRise.value = rise;
  mat.uniforms.uSpread.value = height;
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  points.userData = {
    material: mat,
    update(t) { mat.uniforms.uTime.value = t; }
  };
  return points;
}

export function makeStars(tex, {
  count = 2400, radius = 340, color = '#dfeaff', size = 1, seed = 9,
  hemisphere = true, opacity = 1
} = {}) {
  const rnd = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rnd(), v = rnd();
    const theta = u * Math.PI * 2;
    const phi = hemisphere ? Math.acos(v * .98) : Math.acos(v * 2 - 1);
    const r = radius * (.75 + rnd() * .25);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    seeds[i] = rnd();
    sizes[i] = size * (.4 + Math.pow(rnd(), 3) * 3.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const mat = createStarMaterial({ color, opacity, sizeScale: 1 });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 4;
  points.userData = {
    material: mat,
    update(t, energy = .4) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uEnergy.value = energy;
      mat.uniforms.uOpacity.value = opacity * (.8 + energy * .3);
    }
  };
  return points;
}

export function makeRain(tex, {
  count = 2200, color = '#b9d6ef', opacity = .3, height = 26, speed = 7,
  area = [50, 26, 40], center = [0, 6, 0], seed = 17, length = 1
} = {}) {
  const rnd = mulberry32(seed);
  const positions = new Float32Array(count * 2 * 3);
  const seeds = new Float32Array(count * 2);
  const ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = center[0] + (rnd() - .5) * area[0];
    const y = center[1] + (rnd() - .5) * area[1];
    const z = center[2] + (rnd() - .5) * area[2];
    const s = rnd();
    for (let k = 0; k < 2; k++) {
      positions[(i * 2 + k) * 3] = x;
      positions[(i * 2 + k) * 3 + 1] = y;
      positions[(i * 2 + k) * 3 + 2] = z;
      seeds[i * 2 + k] = s;
      ends[i * 2 + k] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const mat = createRainMaterial({ color, opacity, height, speed });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 6;
  lines.userData = {
    material: mat,
    update(t) { mat.uniforms.uTime.value = t; },
    setOpacity(o) { mat.uniforms.uOpacity.value = o; }
  };
  return lines;
}

export function makeRings(tex, {
  count = 12, center = [0, .02, 0], spread = 18, color = '#b7d2e8', seed = 22,
  reverse = true, radius = 1, maxOpacity = .22
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.position.set(...center);
  const items = [];
  const geo = new THREE.RingGeometry(.96, 1, 64);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: col(color), transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((rnd() - .5) * spread, 0, (rnd() - .5) * spread);
    const phase = rnd();
    const dur = 3.4 + rnd() * 3.2;
    group.add(m);
    items.push({ m, mat, phase, dur, max: radius * (1.2 + rnd() * 2.8) });
  }
  group.userData = {
    update(t) {
      for (const it of items) {
        const p = ((t / it.dur + it.phase) % 1);
        const q = reverse ? 1 - p : p;
        const s = it.max * (reverse ? (.15 + q * .9) : (.15 + q * .95));
        it.m.scale.setScalar(Math.max(.01, s));
        it.mat.opacity = Math.sin(p * Math.PI) * maxOpacity;
      }
    }
  };
  return group;
}

export function makeShards(tex, {
  count = 120, center = [0, 4.5, 0], spread = 7, seed = 44, scale = 1
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.position.set(...center);
  const shards = [];
  const glassMap = tex.shard();
  for (let i = 0; i < count; i++) {
    const n = 3 + Math.floor(rnd() * 2);
    const pts = [];
    const baseR = (.25 + Math.pow(rnd(), 1.8) * 1.7) * scale;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + rnd() * .6;
      const r = baseR * (.45 + rnd() * .8);
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * (.7 + rnd() * .8)));
    }
    const shape = new THREE.Shape(pts);
    const geo = new THREE.ShapeGeometry(shape);
    const bright = rnd() > .82;
    const mat = new THREE.MeshStandardMaterial({
      map: glassMap, color: col(bright ? '#eaf6ff' : '#aac6dd'),
      transparent: true, opacity: .32 + rnd() * .3,
      roughness: .06, metalness: .25, side: THREE.DoubleSide,
      emissive: col(bright ? '#d9ecff' : '#4e7898'), emissiveIntensity: bright ? .8 : .22,
      depthWrite: false
    });
    if (bright) mat.blending = THREE.AdditiveBlending;
    const m = new THREE.Mesh(geo, mat);
    m.position.set((rnd() - .5) * spread * 1.6, (rnd() - .5) * spread * .4, (rnd() - .5) * spread);
    m.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    const baseRot = m.rotation.clone();
    const baseOpacity = mat.opacity;
    const dir = new THREE.Vector3(
      (rnd() - .5) * 1.4,
      .35 + rnd() * 1.35,
      (rnd() - .5) * 1.4
    ).normalize();
    const speed = .8 + Math.pow(rnd(), 1.4) * 5.2;
    group.add(m);
    shards.push({
      m, mat,
      base: m.position.clone(),
      baseRot, baseOpacity,
      dir, speed,
      spin: new THREE.Vector3((rnd() - .5) * 2.4, (rnd() - .5) * 2.4, (rnd() - .5) * 2.4),
      phase: rnd() * Math.PI * 2
    });
  }
  group.userData = {
    shards,
    update(t, progress = 1, energy = .5) {
      for (const s of shards) {
        const p = clamp01(progress);
        const accel = p * p * (1.2 + energy);
        s.m.position.copy(s.base).addScaledVector(s.dir, s.speed * accel * 4.2);
        s.m.position.y += Math.sin(t * 1.1 + s.phase) * .12;
        s.m.rotation.set(
          s.baseRot.x + s.spin.x * t * .35,
          s.baseRot.y + s.spin.y * t * .42,
          s.baseRot.z + s.spin.z * t * .28
        );
        s.mat.opacity = s.baseOpacity * (1 - smoothstep(.55, 1, p) * .72);
      }
    }
  };
  return group;
}

export function makeJellyfish(tex, {
  count = 5, center = [0, 16, -8], spread = 20, color = '#9fd2e8', seed = 31, scale = 1
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.position.set(...center);
  const jellies = [];
  const bellGeo = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * .6);

  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vP;
        void main() {
          vUv = uv; vP = position;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uPhase;
        varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vP;
        void main() {
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.2);
          float ribs = .55 + .45 * sin(vUv.x * 38.0);
          float pulse = .5 + .5 * sin(uTime * 1.4 + uPhase);
          float a = (.08 + fres * .55) * ribs * uOpacity * (.85 + pulse * .25);
          a *= smoothstep(1.0, .55, vUv.y);
          vec3 c = uColor * (1.0 + fres * .9);
          gl_FragColor = vec4(c, a);
        }
      `,
      uniforms: {
        uColor: { value: col(color) },
        uTime: { value: 0 },
        uOpacity: { value: .75 },
        uPhase: { value: rnd() * 9 }
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const bell = new THREE.Mesh(bellGeo, mat);
    bell.scale.set(1, .74, 1);
    g.add(bell);

    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glow(), color: col(color), transparent: true, opacity: .35,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    core.scale.setScalar(1.8);
    g.add(core);

    const tentacles = [];
    const lineMat = new THREE.LineBasicMaterial({
      color: col(color), transparent: true, opacity: .28,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + rnd() * .3;
      const pts = [];
      const N = 18;
      for (let j = 0; j < N; j++) {
        const q = j / (N - 1);
        pts.push(new THREE.Vector3(Math.cos(a) * .85 * (1 - q * .3), -.1 - q * (1.8 + rnd() * 1.6), Math.sin(a) * .85 * (1 - q * .3)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, lineMat);
      g.add(line);
      tentacles.push({ line, a, len: 1.8 + rnd() * 1.8, phase: rnd() * 9 });
    }

    const base = new THREE.Vector3(
      (rnd() - .5) * spread,
      (rnd() - .5) * spread * .55,
      (rnd() - .5) * spread * .7
    );
    const sc = .5 + rnd() * 1.1;
    g.scale.setScalar(sc * scale);
    g.position.copy(base);
    group.add(g);
    jellies.push({ g, mat, core, tentacles, base, phase: rnd() * 9, speed: .18 + rnd() * .25, sc });
  }

  group.userData = {
    update(t) {
      for (const j of jellies) {
        j.g.position.x = j.base.x + Math.sin(t * j.speed + j.phase) * 1.4;
        j.g.position.y = j.base.y + Math.sin(t * j.speed * .7 + j.phase * 1.7) * .9;
        j.g.position.z = j.base.z + Math.cos(t * j.speed * .8 + j.phase) * 1.1;
        j.g.rotation.y = t * .08 + j.phase;
        j.mat.uniforms.uTime.value = t;
        const pulse = 1 + Math.sin(t * 1.4 + j.phase) * .06;
        j.g.scale.set(j.sc * pulse, j.sc * (2 - pulse) * .98, j.sc * pulse);
        for (const tt of j.tentacles) {
          const pos = tt.line.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const q = i / (pos.count - 1);
            const wig = Math.sin(t * 1.2 + tt.phase + q * 5.2) * .16 * q;
            pos.setX(i, Math.cos(tt.a) * .85 * (1 - q * .3) + Math.cos(tt.a + 1.57) * wig);
            pos.setZ(i, Math.sin(tt.a) * .85 * (1 - q * .3) + Math.sin(tt.a + 1.57) * wig);
            pos.setY(i, -.1 - q * tt.len);
          }
          pos.needsUpdate = true;
        }
        j.core.material.opacity = .28 + Math.sin(t * 1.3 + j.phase) * .1;
      }
    }
  };
  return group;
}

export function makePaperScraps(tex, {
  count = 42, area = [30, 18, 24], center = [0, 6, 0], seed = 61, fall = .3
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  group.position.set(...center);
  const items = [];
  const mats = [0, 1, 2].map(v => new THREE.MeshStandardMaterial({
    map: tex.paper(v), color: '#e8e2d4', roughness: .95, side: THREE.DoubleSide,
    transparent: true, opacity: .78
  }));
  for (let i = 0; i < count; i++) {
    const w = .18 + rnd() * .55;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (.4 + rnd() * .8)), mats[i % 3]);
    const base = new THREE.Vector3(
      (rnd() - .5) * area[0],
      (rnd() - .5) * area[1],
      (rnd() - .5) * area[2]
    );
    m.position.copy(base);
    m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
    group.add(m);
    items.push({
      m, base,
      baseRot: m.rotation.clone(),
      amp: .4 + rnd() * 1.8,
      speed: fall * (.4 + rnd() * 1.2),
      phase: rnd() * 9,
      spin: (rnd() - .5) * .8
    });
  }
  group.userData = {
    update(t) {
      for (const it of items) {
        const y = it.base.y - ((t * it.speed + it.phase) % area[1]);
        it.m.position.y = y + area[1] * .5;
        it.m.position.x = it.base.x + Math.sin(t * .4 + it.phase) * it.amp;
        it.m.position.z = it.base.z + Math.cos(t * .3 + it.phase) * it.amp * .7;
        it.m.rotation.set(
          it.baseRot.x + t * it.spin * .22,
          it.baseRot.y + t * it.spin * .3,
          it.baseRot.z + t * it.spin * .17
        );
      }
    }
  };
  return group;
}

export function makePortal(tex, { radius = 18, colorA = '#7aa8d0', colorB = '#ffe0b8' } = {}) {
  const mat = createPortalMaterial({ colorA, colorB });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  mesh.userData = {
    material: mat,
    update(t, opacity = 1) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOpacity.value = opacity;
    }
  };
  return mesh;
}

export function makeGlyphRing(tex, {
  radius = 20, count = 26, size = 3, chars = TYPE_GLYPHS, color = '#d7e6f5',
  opacity = .7, seed = 2, axis = 'z'
} = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const mats = new Map();
  for (let i = 0; i < count; i++) {
    const ch = chars[i % chars.length];
    let mat = mats.get(ch);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        map: tex.glyph(ch, { mode: 'glow', color }),
        transparent: true, opacity, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false
      });
      mats.set(ch, mat);
    }
    const a = i / count * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    if (axis === 'z') {
      m.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      m.lookAt(0, 0, 0);
      m.rotateZ((rnd() - .5) * .3);
    } else {
      m.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      m.rotation.y = -a + Math.PI / 2;
    }
    group.add(m);
  }
  group.userData = { mats, radius };
  return group;
}

export function makeLantern(tex, { scale = 1, color = '#ffbd7a' } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(.28, .34, .82, 16, 1, true),
    new THREE.MeshStandardMaterial({
      map: tex.lantern(), color: '#f2d9a2', roughness: .85,
      emissive: '#c8833e', emissiveIntensity: 1.1, side: THREE.DoubleSide
    })
  );
  group.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, .08, 16),
    new THREE.MeshStandardMaterial({ color: '#3a2416', roughness: .7 }));
  top.position.y = .45;
  group.add(top);
  const bottom = top.clone(); bottom.position.y = -.45;
  group.add(bottom);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col(color), transparent: true, opacity: .55,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  glow.scale.setScalar(3.2);
  group.add(glow);
  const light = new THREE.PointLight(col(color), 22, 16, 2);
  group.add(light);
  group.scale.setScalar(scale);
  group.userData = { glow, light, body };
  return group;
}

/* ------------------------------------------------------------------ */
/* Ink plume                                                           */
/* ------------------------------------------------------------------ */
export function makeInkPlume(tex, { count = 34, seed = 8, scale = 1 } = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const puffs = [];
  const inkTex = tex.inkCloud();
  for (let i = 0; i < count; i++) {
    const dark = new THREE.Sprite(new THREE.SpriteMaterial({
      map: inkTex, color: col('#182d46'), transparent: true, opacity: .0,
      depthWrite: false, blending: THREE.NormalBlending, toneMapped: false
    }));
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), .55);
    const dir = new THREE.Vector3(Math.cos(a) * r, .2 + rnd() * .9, Math.sin(a) * r);
    const sz = (.7 + rnd() * 1.9) * scale;
    dark.scale.setScalar(sz);
    dark.userData = { dir, sz, speed: .45 + rnd() * 1.3, rot: (rnd() - .5) * .4, phase: rnd() };
    group.add(dark);
    puffs.push(dark);

    if (i % 2 === 0) {
      const lit = new THREE.Sprite(new THREE.SpriteMaterial({
        map: inkTex, color: col('#7ea3c4'), transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
      }));
      lit.scale.setScalar(sz * 1.12);
      lit.userData = { dir: dir.clone().multiplyScalar(.9), sz: sz * 1.12, speed: .4 + rnd() * 1.1, rot: (rnd() - .5) * .4, phase: rnd() + .3 };
      group.add(lit);
      puffs.push(lit);
    }
  }

  const tendrils = [];
  const tendrilMat = new THREE.MeshBasicMaterial({
    color: col('#16283a'), transparent: true, opacity: .0,
    blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide
  });
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const R = .5 + rnd() * 1.7;
    const pts = [];
    for (let j = 0; j < 5; j++) {
      const q = j / 4;
      const aa = a + q * (1.2 + rnd());
      pts.push(V3(Math.cos(aa) * R * q, .05 + Math.sin(q * Math.PI) * (rnd() * .9) - q * .3, Math.sin(aa) * R * q));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, .004 + rnd() * .008, 3, false), tendrilMat);
    mesh.userData = { phase: rnd() };
    group.add(mesh);
    tendrils.push(mesh);
  }

  group.userData = {
    puffs, tendrils, inkTex,
    update(t, progress = 1) {
      const p = clamp01(progress);
      const ease = 1 - Math.pow(1 - p, 2.2);
      for (const s of puffs) {
        const u = s.userData;
        const local = clamp01((p - u.phase * .25) / .75);
        const grow = (1 - Math.pow(1 - local, 2)) * u.speed;
        s.position.copy(u.dir).multiplyScalar(grow * 3.4);
        s.position.y += Math.sin(t * .6 + u.phase * 8) * .18 * ease;
        s.scale.setScalar(u.sz * (.5 + ease * 1.6));
        s.material.opacity = Math.sin(local * Math.PI) * (s.material.blending === THREE.AdditiveBlending ? .055 : .26) + local * .03;
        s.material.rotation = u.rot * ease + t * .015;
      }
      for (const m of tendrils) {
        m.material.opacity = Math.sin(p * Math.PI) * .16;
        m.scale.setScalar(.35 + ease * 1.5);
      }
    }
  };
  return group;
}

/* ------------------------------------------------------------------ */
/* Particle text                                                       */
/* ------------------------------------------------------------------ */
export function makeTextParticles(tex, {
  text = '我爱你', count = 26000, width = 28, seed = 77,
  colorA = '#f2f7ff', colorB = '#f0d5a5'
} = {}) {
  const rnd = mulberry32(seed);
  const mask = tex.textMask(text, { font: '400 560px "Noto Serif SC", serif', width: 2048, height: 768 });
  const { data, width: mw, height: mh } = mask;
  const candidates = [];
  const step = 2;
  for (let y = 0; y < mh; y += step) {
    for (let x = 0; x < mw; x += step) {
      const a = data[(y * mw + x) * 4 + 3];
      if (a > 120) candidates.push([x, y]);
    }
  }
  const height = width * (mh / mw);
  const targets = new Float32Array(count * 3);
  const starts = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const pt = candidates[Math.floor(rnd() * candidates.length)];
    const x = ((pt[0] / mw) - .5) * width + (rnd() - .5) * .045;
    const y = -((pt[1] / mh) - .5) * height + (rnd() - .5) * .045;
    const z = (rnd() - .5) * .55;
    targets[i * 3] = x;
    targets[i * 3 + 1] = y;
    targets[i * 3 + 2] = z;
    const ang = rnd() * Math.PI * 2, rad = 8 + Math.pow(rnd(), .6) * 30;
    starts[i * 3] = Math.cos(ang) * rad + (rnd() - .5) * 9;
    starts[i * 3 + 1] = (rnd() - .5) * 18;
    starts[i * 3 + 2] = Math.sin(ang) * rad - 4;
    seeds[i] = rnd();
    sizes[i] = .7 + Math.pow(rnd(), 3) * 2.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(targets, 3));
  geo.setAttribute('aStart', new THREE.BufferAttribute(starts, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      attribute vec3 aStart;
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uProgress;
      uniform float uPixelRatio;
      uniform float uSizeScale;
      varying float vAlpha;
      varying float vSeed;
      void main() {
        float p = clamp((uProgress - (1.0 - aSeed) * .10) / .90, 0.0, 1.0);
        p = p * p * (3.0 - 2.0 * p);
        float stray = step(.955, aSeed);
        p *= (1.0 - stray * .35);
        vec3 pos = mix(aStart, position, p);
        float drift = (1.0 - p) * 1.2 + .08;
        pos.x += sin(uTime * (.35 + aSeed * .5) + aSeed * 30.0) * drift;
        pos.y += cos(uTime * (.28 + aSeed * .4) + aSeed * 18.0) * drift * .6;
        pos.z += sin(uTime * (.22 + aSeed * .3) + aSeed * 11.0) * drift * .8;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vAlpha = (.3 + .7 * aSeed) * (p * .92 + .08) * (0.65 + 0.35 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0));
        vSeed = aSeed;
        gl_PointSize = aSize * uSizeScale * uPixelRatio / max(8.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;
      varying float vAlpha;
      varying float vSeed;
      void main() {
        vec2 c = gl_PointCoord - .5;
        float d = length(c);
        float a = smoothstep(.5, .04, d) * vAlpha * uOpacity;
        vec3 col = mix(uColorA, uColorB, smoothstep(.55, 1.0, vSeed));
        gl_FragColor = vec4(col, a);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: 68 },
      uOpacity: { value: 1 },
      uColorA: { value: col(colorA) },
      uColorB: { value: col(colorB) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 7;
  points.userData = {
    material: mat,
    update(t, progress, opacity = 1) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uProgress.value = progress;
      mat.uniforms.uOpacity.value = opacity;
    }
  };
  return points;
}

/* ------------------------------------------------------------------ */
/* Light glints                                                        */
/* ------------------------------------------------------------------ */
export function makeGlint(tex, color = '#ffffff', scale = 6, opacity = .6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow(), color: col(color), transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }));
  s.scale.setScalar(scale);
  return s;
}

export { V3, quadGeo, triangleGeo };
