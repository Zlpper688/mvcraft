#!/usr/bin/env node
/**
 * Screen-space probe: what is actually visible, how big, and does hiding it
 * change the frame? Answers "my subject is missing / too small / covered".
 *
 * Usage:
 *   node tools/probe.mjs --at 44 --list
 *   node tools/probe.mjs --at 44 --name lantern
 *   node tools/probe.mjs --at 44 --name lantern --json shots/probe/lantern.json
 *
 * Requires a page exposing: window.__MV.renderAt(t), .capture(), .scene, .camera.
 * The diff test requires deterministic rendering (same t -> same pixels).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { CDP } from './lib/cdp.mjs';

const args = process.argv.slice(2);
const getArg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const flag = (k) => args.includes(k);

const W = Number(getArg('--w', 1920));
const H = Number(getArg('--h', 804));
const base = getArg('--url', 'http://127.0.0.1:5173/');
const params = getArg('--params', 'render=1&subs=1');
const at = Number(getArg('--at', -1));
const targetName = getArg('--name', '');
const outDir = path.resolve(getArg('--out', 'shots/probe'));
const prefix = getArg('--prefix', 'probe');
const topN = Number(getArg('--top', 25));
const gl = getArg('--gl', 'auto');
const bootTimeout = Number(getArg('--timeout', 180000));
const jsonPath = path.resolve(getArg('--json', path.join(outDir, `${prefix}.json`)));
const keepProfile = flag('--keep-profile');
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const override = getArg('--browser', '');
  if (override) {
    if (!fs.existsSync(override)) throw new Error(`browser not found: ${override}`);
    return override;
  }
  const candidates =
    process.platform === 'win32'
      ? [
          'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
          'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
          'C:/Program Files/Google/Chrome/Application/chrome.exe',
          'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge',
          ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('no Chromium browser found; pass --browser <path>');
}

const BROWSER = findBrowser();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mvcraft-probe-'));
const port = 9633 + Math.floor(Math.random() * 300);
const proc = spawn(
  BROWSER,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--remote-debugging-port=${port}`,
    ...(gl === 'auto' ? [] : ['--use-gl=angle', `--use-angle=${gl}`]),
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--disable-dev-shm-usage',
    '--mute-audio',
    `--user-data-dir=${profile}`,
    `--window-size=${Math.max(800, W)},${Math.max(600, H + 100)}`,
    '--force-device-scale-factor=1',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);
let browserErr = '';
proc.stderr.on('data', (d) => {
  browserErr += d.toString();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 160) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch (e) {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error(`CDP endpoint not ready: ${url}\n${browserErr.slice(-2000)}`);
}

const report = {
  url: '',
  at: null,
  canvas: [W, H],
  target: targetName || null,
  objects: [],
  lights: [],
  targetDetail: null,
  diff: null,
  warnings: [],
  errors: [],
};

const sceneExpr = (time, name) => `(async () => {
  const MV = window.__MV;
  if (!MV) throw new Error('probe requires window.__MV');
  const T = ${time};
  const TARGET = ${JSON.stringify(name)};
  MV.renderAt(T);
  const scene = MV.scene;
  const camera = MV.camera;
  if (!scene || !camera) throw new Error('probe requires window.__MV.scene and window.__MV.camera after renderAt(t)');
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const out = document.getElementById('output');
  const W = out ? out.width : ${W};
  const H = out ? out.height : ${H};

  const chainVisible = (o) => {
    let x = o;
    while (x) { if (x.visible === false) return false; x = x.parent; }
    return true;
  };
  const describeMat = (o) => {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return null;
    return {
      type: m.type,
      color: m.color ? '#' + m.color.getHexString() : null,
      map: !!(m.map || m.alphaMap || m.emissiveMap),
      transparent: !!m.transparent,
      opacity: m.opacity === undefined ? null : +m.opacity.toFixed(2),
      side: m.side,
      wireframe: !!m.wireframe,
      emissive: m.emissive ? '#' + m.emissive.getHexString() : null,
      vertexColors: !!m.vertexColors
    };
  };
  const project = (o) => {
    if (!o.geometry) return null;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb) return null;
    const min = bb.min, max = bb.max;
    let minX = 2, minY = 2, maxX = -2, maxY = -2, behind = false;
    for (let i = 0; i < 8; i++) {
      const v = min.clone().set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
      v.applyMatrix4(o.matrixWorld);
      const view = v.clone().applyMatrix4(camera.matrixWorldInverse);
      if (view.z >= 0) behind = true;
      v.project(camera);
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
    const x0 = Math.max(-1, minX), x1 = Math.min(1, maxX);
    const y0 = Math.max(-1, minY), y1 = Math.min(1, maxY);
    const coverage = Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / 4;
    const wc = min.clone().set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2).applyMatrix4(o.matrixWorld);
    const center = { x: ((minX + maxX) / 2 + 1) / 2 * W, y: (1 - (minY + maxY) / 2) / 2 * H };
    return {
      coverage: +coverage.toFixed(4),
      onScreen: !behind && maxX >= -1 && minX <= 1 && maxY >= -1 && minY <= 1,
      behind,
      screenBox: {
        x: +(((x0 + 1) / 2) * W).toFixed(1),
        y: +(((1 - y1) / 2) * H).toFixed(1),
        w: +(((x1 - x0) / 2) * W).toFixed(1),
        h: +(((y1 - y0) / 2) * H).toFixed(1)
      },
      center: { x: +center.x.toFixed(1), y: +center.y.toFixed(1) },
      distance: +camera.position.distanceTo(wc).toFixed(2)
    };
  };

  const all = [];
  scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isSprite || o.isLine)) return;
    const p = project(o);
    const pos = o.getWorldPosition(o.position.clone());
    all.push({
      name: o.name || '(unnamed)',
      uuid: o.uuid,
      type: o.type,
      visible: o.visible,
      chainVisible: chainVisible(o),
      frustumCulled: o.frustumCulled,
      renderOrder: o.renderOrder,
      verts: o.geometry?.attributes?.position?.count ?? 0,
      tris: o.geometry?.index ? Math.round(o.geometry.index.count / 3) : Math.round((o.geometry?.attributes?.position?.count || 0) / 3),
      position: [ +pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2) ],
      parent: o.parent?.name || o.parent?.type || null,
      material: describeMat(o),
      screen: p
    });
  });
  const meshes = all.length;
  const onScreen = all.filter((o) => o.screen && o.screen.onScreen && o.screen.coverage > 0);
  onScreen.sort((a, b) => b.screen.coverage - a.screen.coverage);

  const lights = [];
  scene.traverse((o) => {
    if (!o.isLight) return;
    const pos = o.getWorldPosition(o.position.clone());
    lights.push({
      name: o.name || '(unnamed)',
      type: o.type,
      intensity: o.intensity,
      visible: o.visible,
      chainVisible: chainVisible(o),
      position: [ +pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2) ],
      distance: o.distance ?? null
    });
  });

  let targetDetail = null;
  let diff = null;
  if (TARGET) {
    const lower = TARGET.toLowerCase();
    let targetObj = null;
    scene.traverse((o) => {
      if (targetObj) return;
      if (o.name === TARGET || o.uuid === TARGET) targetObj = o;
    });
    if (!targetObj) {
      scene.traverse((o) => {
        if (targetObj) return;
        if (o.name && o.name.toLowerCase().includes(lower)) targetObj = o;
      });
    }
    if (!targetObj) {
      const nearLights = lights.filter((l) => l.name === TARGET || l.name.toLowerCase().includes(lower));
      if (nearLights.length) {
        throw new Error('target "' + TARGET + '" is a ' + nearLights[0].type + ', not a renderable. ' +
          'Hiding a light does not test the object you see; name a Mesh or Group.');
      }
      throw new Error('no object named "' + TARGET + '". Names on screen: ' +
        onScreen.slice(0, 20).map((o) => o.name).join(', '));
    }
    const renderables = [];
    targetObj.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isSprite || o.isLine) renderables.push(o);
    });
    if (!renderables.length) {
      throw new Error('target "' + TARGET + '" is a ' + targetObj.type + ' with no renderable children. ' +
        'Hiding it does not test what you see; name a Mesh or Group.');
    }
    let coverage = 0;
    let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
    let onScreenTarget = false;
    let targetDistance = 0;
    for (const r of renderables) {
      r.updateMatrixWorld(true);
      const p = project(r);
      if (!p) continue;
      coverage += p.coverage;
      onScreenTarget = onScreenTarget || p.onScreen;
      targetDistance = Math.max(targetDistance, p.distance);
      ux0 = Math.min(ux0, p.screenBox.x);
      uy0 = Math.min(uy0, p.screenBox.y);
      ux1 = Math.max(ux1, p.screenBox.x + p.screenBox.w);
      uy1 = Math.max(uy1, p.screenBox.y + p.screenBox.h);
    }
    targetDetail = {
      name: targetObj.name || '(unnamed)',
      uuid: targetObj.uuid,
      type: targetObj.type,
      renderables: renderables.length,
      visible: targetObj.visible,
      chainVisible: chainVisible(targetObj),
      parent: targetObj.parent ? (targetObj.parent.name || targetObj.parent.type) : null,
      screen: {
        coverage: +Math.min(1, coverage).toFixed(4),
        onScreen: onScreenTarget,
        screenBox: {
          x: +ux0.toFixed(1),
          y: +uy0.toFixed(1),
          w: +(ux1 - ux0).toFixed(1),
          h: +(uy1 - uy0).toFixed(1)
        },
        center: { x: +((ux0 + ux1) / 2).toFixed(1), y: +((uy0 + uy1) / 2).toFixed(1) },
        distance: +targetDistance.toFixed(2)
      }
    };
    if (!targetDetail.chainVisible) {
      const hiddenBy = (() => {
        let x = targetObj;
        const chain = [];
        while (x) { if (x.visible === false) chain.push(x.name || x.type); x = x.parent; }
        return chain;
      })();
      targetDetail.hiddenBy = hiddenBy;
    }

    const obj = targetObj;

    const grab = async () => {
      MV.renderAt(T);
      const url = MV.capture('image/png', 1);
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, c.width, c.height);
    };
    const compare = (a, b, makeImage) => {
      const A = a.data, B = b.data;
      let changed = 0, sum = 0, minX = a.width, minY = a.height, maxX = -1, maxY = -1;
      const diffData = makeImage ? new ImageData(a.width, a.height) : null;
      for (let i = 0; i < A.length; i += 4) {
        const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
        if (d > 8) {
          changed++;
          sum += d;
          const p = i / 4;
          const x = p % a.width;
          const y = (p / a.width) | 0;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        if (diffData) {
          if (d > 8) {
            diffData.data[i] = 255; diffData.data[i + 1] = 40; diffData.data[i + 2] = 60; diffData.data[i + 3] = 255;
          } else {
            diffData.data[i] = B[i] * 0.22; diffData.data[i + 1] = B[i + 1] * 0.22; diffData.data[i + 2] = B[i + 2] * 0.22; diffData.data[i + 3] = 255;
          }
        }
      }
      let diffUrl = null;
      if (diffData) {
        const dc = document.createElement('canvas');
        dc.width = a.width; dc.height = a.height;
        dc.getContext('2d').putImageData(diffData, 0, 0);
        diffUrl = dc.toDataURL('image/png');
      }
      return {
        changedRatio: +(changed / (a.width * a.height)).toFixed(5),
        meanAbsDiff: changed ? +(sum / changed).toFixed(2) : 0,
        changedPixels: changed,
        bbox: maxX >= minX ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
        diffUrl
      };
    };

    const a = await grab();
    const a2 = await grab();
    const noise = compare(a, a2, false);
    const prev = obj ? obj.visible : null;
    let b;
    try {
      if (!obj) throw new Error('target mesh not reachable by uuid');
      obj.visible = false;
      b = await grab();
    } finally {
      if (obj && prev !== null) obj.visible = prev;
    }
    const d = compare(a, b, true);
    const diffUrl = d.diffUrl;
    delete d.diffUrl;
    diff = {
      ...d,
      baselineNoiseRatio: noise.changedRatio,
      deterministic: noise.changedRatio < 0.002,
      hiddenUuid: obj ? obj.uuid : null
    };
    if (diffUrl) window.__probeDiff = diffUrl;
  }

  return {
    time: T,
    meshes,
    onScreenCount: onScreen.length,
    objects: onScreen.slice(0, ${topN}),
    lights,
    targetDetail,
    diff
  };
})()`;

(async () => {
  let cdp;
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
    const list = await getJson(`http://127.0.0.1:${port}/json`);
    const page = list.find((t) => t.type === 'page');
    if (!page) throw new Error('no page target');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await sleep(200);

    cdp.on('Runtime.exceptionThrown', (p) => {
      report.errors.push(
        p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception'
      );
    });
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') {
        report.errors.push((p.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
      }
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: W,
      height: H,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const url = `${base}${base.includes('?') ? '&' : '?'}${params}`;
    report.url = url;
    console.log(`navigate ${url}`);
    await cdp.send('Page.navigate', { url });

    const bootStart = Date.now();
    let booted = false;
    while (Date.now() - bootStart < bootTimeout) {
      await sleep(500);
      const s = await cdp
        .eval(`({ ready: !!window.__MV && window.__MV.ready, err: window.__MV_BOOT_ERROR || null })`)
        .catch(() => null);
      if (s?.err) throw new Error(`boot error: ${s.err}`);
      if (s?.ready) {
        booted = true;
        break;
      }
    }
    if (!booted) throw new Error('boot timeout');
    console.log(`boot ${Date.now() - bootStart}ms`);

    const duration = await cdp.eval(`window.__MV.duration`);
    const t = at >= 0 ? at : duration * 0.5;
    report.at = t;
    console.log(`probe t=${t}s`);

    const data = await cdp.eval(sceneExpr(t, targetName));
    report.objects = data.objects;
    report.lights = data.lights;
    report.targetDetail = data.targetDetail;
    report.diff = data.diff;
    report.meshes = data.meshes;
    report.onScreenCount = data.onScreenCount;

    console.log(
      `meshes=${data.meshes} onScreen=${data.onScreenCount} lights=${data.lights.length}  (coverage = % of canvas)`
    );
    for (const o of data.objects) {
      const c = o.screen;
      console.log(
        `  ${(c.coverage * 100).toFixed(2).padStart(7)}%  ${String(o.type).padEnd(9)} ` +
          `${o.chainVisible ? 'visible' : 'HIDDEN '}  ${o.name}  ` +
          `box=${c.screenBox.w}x${c.screenBox.h}@${c.screenBox.x},${c.screenBox.y} ` +
          `d=${c.distance} tris=${o.tris} ${o.material?.color || ''}`
      );
    }
    if (data.targetDetail) {
      const td = data.targetDetail;
      console.log(`\ntarget "${td.name}" (${td.type}) coverage=${(td.screen.coverage * 100).toFixed(2)}%`);
      console.log(`  parent=${td.parent} visible=${td.chainVisible} frustumCulled=${td.frustumCulled}`);
      console.log(`  material=${JSON.stringify(td.material)}`);
      if (td.hiddenBy?.length) console.log(`  HIDDEN BY: ${td.hiddenBy.join(' > ')}`);
      if (td.otherMatches?.length) console.log(`  also matched: ${td.otherMatches.join(', ')}`);
      if (data.diff) {
        console.log(
          `  hide-diff=${(data.diff.changedRatio * 100).toFixed(2)}% of frame, ` +
            `noise=${(data.diff.baselineNoiseRatio * 100).toFixed(3)}% deterministic=${data.diff.deterministic}`
        );
        if (data.diff.bbox) {
          const b = data.diff.bbox;
          console.log(`  changed bbox=${b.w}x${b.h}@${b.x},${b.y} (screen ${W}x${H})`);
          report.warnings.push('diff bbox should match the projected screenBox; if not, the wrong object was hidden');
        }
        if (data.diff.changedRatio < 0.0002) {
          report.warnings.push('hiding the target changed almost nothing: occluded, transparent, or not drawn');
        }
        if (!data.diff.deterministic) {
          report.warnings.push('baseline noise is high: renderAt(t) is not deterministic, diff results are unreliable');
        }
        const diffUrl = await cdp.readString('window.__probeDiff').catch(() => '');
        if (diffUrl) {
          const buf = Buffer.from(diffUrl.slice(diffUrl.indexOf(',') + 1), 'base64');
          const file = path.join(outDir, `${prefix}-${(td.name || 'target').replace(/[^\w.-]+/g, '_')}-diff.png`);
          fs.writeFileSync(file, buf);
          report.diffFile = path.relative(process.cwd(), file).replace(/\\/g, '/');
          console.log(`  diff image ${report.diffFile}`);
        }
      }
    }

    report.errors = [...new Set(report.errors.filter((x) => !x.includes('favicon')))];
    await cdp.send('Browser.close').catch(() => {});
  } catch (e) {
    report.errors.push(e.message);
    console.error(`PROBE FAILED: ${e.message}`);
    process.exitCode = 1;
  } finally {
    try {
      proc.kill();
    } catch (e) {
      /* ignore */
    }
    report.warnings = [...new Set(report.warnings)];
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\nreport ${path.relative(process.cwd(), jsonPath)}`);
    setTimeout(() => {
      if (!keepProfile) {
        try {
          fs.rmSync(profile, { recursive: true, force: true });
        } catch (e) {
          /* ignore */
        }
      }
      process.exit(process.exitCode || 0);
    }, 800);
  }
})();
