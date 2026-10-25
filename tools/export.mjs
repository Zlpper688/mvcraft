#!/usr/bin/env node
/**
 * Deterministic offline frame exporter for mvcraft.
 * Drives Edge/Chrome over CDP; no puppeteer dependency.
 *
 * Usage:
 *   node tools/export.mjs --fps 24 --gl d3d11
 *   node tools/export.mjs --fps 24 --gl swiftshader --bench-only
 *   node tools/export.mjs --resume
 *   node tools/export.mjs --from 120 --to 140 --out shots/test
 *
 * Requires: Node 22+ (global WebSocket), a Chromium browser, and a page exposing:
 *   window.__MV.ready, .duration, .shots, .renderAt(t), .capture(type, quality)
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

const fps = Number(getArg('--fps', 24));
const W = Number(getArg('--w', 1920));
const H = Number(getArg('--h', 804));
const base = getArg('--url', 'http://127.0.0.1:5173/');
const params = getArg('--params', 'render=1&subs=1');
const outDir = path.resolve(getArg('--out', 'shots/export/frames'));
const quality = Number(getArg('--quality', 0.96));
const format = getArg('--format', 'image/jpeg');
const gl = getArg('--gl', 'swiftshader');
const bench = Number(getArg('--bench', 0));
const benchOnly = flag('--bench-only');
const resume = flag('--resume');
const fromT = Number(getArg('--from', 0));
const toT = Number(getArg('--to', 0));
const bootTimeout = Number(getArg('--timeout', 180000));
const keepProfile = flag('--keep-profile');

const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const override = getArg('--browser', '');
  if (override) {
    if (!fs.existsSync(override)) throw new Error(`browser not found: ${override}`);
    return override;
  }
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge'
    );
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('no Chromium browser found; pass --browser <path>');
}

const BROWSER = findBrowser();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mvcraft-export-'));
const port = 9600 + Math.floor(Math.random() * 300);

const proc = spawn(
  BROWSER,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--remote-debugging-port=${port}`,
    '--use-gl=angle',
    `--use-angle=${gl}`,
    ...(gl === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist']),
    '--enable-webgl',
    '--disable-dev-shm-usage',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--mute-audio',
    `--user-data-dir=${profile}`,
    `--window-size=${W},${H + 100}`,
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

const errors = [];
const started = Date.now();
const logPath = path.resolve(getArg('--log', path.join(outDir, '..', 'render-log.txt')));
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(msg);
  fs.appendFileSync(logPath, line + '\n');
};

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
      errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception');
    });
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') errors.push((p.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
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
    log(`navigate ${url} fps=${fps} size=${W}x${H} format=${format} q=${quality} gl=${gl}`);
    await cdp.send('Page.navigate', { url });

    const t0 = Date.now();
    let booted = false;
    while (Date.now() - t0 < bootTimeout) {
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

    const info = await cdp.eval(`({
      assets: window.__MV.assets,
      duration: window.__MV.duration,
      cw: document.getElementById('output')?.width,
      ch: document.getElementById('output')?.height
    })`);
    log(`info ${JSON.stringify(info)}`);
    if (info.cw && info.ch && (info.cw !== W || info.ch !== H)) {
      log(`WARNING: canvas is ${info.cw}x${info.ch}, expected ${W}x${H}`);
    }

    await cdp.eval(`document.fonts.ready.then(() => true)`);
    const scenes = await cdp.eval(`[...new Set(window.__MV.shots.map(s => s.scene))].map(id => {
      const shot = window.__MV.shots.find(s => s.scene === id);
      return shot.start + (shot.end - shot.start) * .5;
    })`);
    for (const t of scenes) await cdp.eval(`window.__MV.renderAt(${t})`);

    const duration = info.duration;
    const startT = Math.max(0, fromT);
    const endT = toT > 0 ? Math.min(duration, toT) : duration;
    const first = Math.ceil(startT * fps);
    const lastExclusive = Math.ceil(endT * fps);
    const total = lastExclusive - first;

    if (bench > 0 || benchOnly) {
      const n = bench > 0 ? bench : 8;
      const times = [];
      for (let i = 0; i < n; i++) times.push(startT + (endT - startT) * (i / Math.max(1, n - 1)));
      const durs = [];
      for (const t of times) {
        const b = Date.now();
        await cdp.eval(
          `window.__payload = (window.__MV.renderAt(${t}), window.__MV.capture('${format}', ${quality}))`
        );
        const shot = await cdp.readString('window.__payload');
        const bytes = Math.round(((shot.length - shot.indexOf(',') - 1) * 3) / 4);
        durs.push(Date.now() - b);
        log(`bench t=${t.toFixed(2)} ${Date.now() - b}ms ${(bytes / 1024).toFixed(0)}KB`);
      }
      const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
      log(`bench avg=${avg.toFixed(0)}ms frames=${total} eta=${((total * avg) / 60000).toFixed(1)}min`);
    }

    if (benchOnly) return;

    let done = 0;
    for (let i = first; i < lastExclusive; i++) {
      const t = i / fps;
      const name = `${String(i + 1).padStart(6, '0')}.${ext}`;
      const p = path.join(outDir, name);
      if (resume && fs.existsSync(p) && fs.statSync(p).size > 1000) {
        done++;
        continue;
      }
      const b = Date.now();
      await cdp.eval(
        `window.__payload = (window.__MV.renderAt(${t}), window.__MV.capture('${format}', ${quality}))`
      );
      const dataUrl = await cdp.readString('window.__payload');
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        throw new Error(`capture returned non-data URL at t=${t}`);
      }
      const comma = dataUrl.indexOf(',');
      const buf = Buffer.from(dataUrl.slice(comma + 1), 'base64');
      const tmp = p + '.tmp';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, p);
      done++;
      if (done % 25 === 0 || done === total) {
        const elapsed = (Date.now() - started) / 1000;
        const per = elapsed / done;
        const left = (total - done) * per;
        log(
          `[${done}/${total}] t=${t.toFixed(2)} ${Date.now() - b}ms ${(buf.length / 1024).toFixed(0)}KB ` +
            `elapsed=${(elapsed / 60).toFixed(1)}min eta=${(left / 60).toFixed(1)}min`
        );
      }
      if (errors.length) throw new Error(`runtime error: ${errors[errors.length - 1]}`);
    }
    log(`done frames=${done} dir=${outDir} errors=${errors.length}`);
    await cdp.send('Browser.close').catch(() => {});
  } catch (e) {
    log(`EXPORT FAILED: ${e.message}`);
    process.exitCode = 1;
  } finally {
    try {
      proc.kill();
    } catch (e) {
      /* ignore */
    }
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
