#!/usr/bin/env node
/**
 * Visual QA at chosen timestamps: deterministic canvas stills + optional viewport
 * screenshots (to include DOM subtitles) + per-frame luminance stats.
 *
 * Usage:
 *   node tools/qa-cdp.mjs --times 6,44,104.5 --prefix qa
 *   node tools/qa-cdp.mjs --each-shot --prefix animatic
 *   node tools/qa-cdp.mjs --sections public/analysis/analysis.json
 *   node tools/qa-cdp.mjs --every 20 --mode page --out shots/page
 *
 * Requires a page exposing: window.__MV.ready, .duration, .shots,
 * .renderAt(t), .capture(type, quality). No npm packages needed.
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
const scale = Number(getArg('--scale', 1));
const base = getArg('--url', 'http://127.0.0.1:5173/');
const params = getArg('--params', 'render=1&subs=1');
const outDir = path.resolve(getArg('--out', 'shots/qa'));
const prefix = getArg('--prefix', 'qa');
const mode = getArg('--mode', 'app');
const gl = getArg('--gl', 'auto');
const bootTimeout = Number(getArg('--timeout', 180000));
const jsonPath = path.resolve(getArg('--json', path.join(outDir, 'qa-report.json')));
const strict = flag('--strict');
const failOnBlank = flag('--fail-on-blank');
const debug = flag('--debug');
const dbg = (...a) => {
  if (debug) console.log('DBG', ...a);
};
const keepProfile = flag('--keep-profile');
const every = Number(getArg('--every', 0));
const eachShot = flag('--each-shot');
const sectionsFile = getArg('--sections', '');
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
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mvcraft-qa-'));
const port = 9333 + Math.floor(Math.random() * 300);
const glFlags = gl === 'auto' ? [] : ['--use-gl=angle', `--use-angle=${gl}`];
const swGlFlags =
  gl === 'swiftshader'
    ? ['--enable-unsafe-swiftshader']
    : gl === 'auto'
      ? ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
      : ['--ignore-gpu-blocklist'];

const proc = spawn(
  BROWSER,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--remote-debugging-port=${port}`,
    ...glFlags,
    ...swGlFlags,
    '--enable-webgl',
    '--disable-dev-shm-usage',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--mute-audio',
    `--user-data-dir=${profile}`,
    `--window-size=${Math.max(800, W)},${Math.max(600, H + 100)}`,
    '--force-device-scale-factor=1',
    '--disable-features=CalculateNativeWinOcclusion',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);
let browserErr = '';
proc.stderr.on('data', (d) => {
  browserErr += d.toString();
  if (debug) process.stderr.write(d);
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
const warnings = [];
const netFails = [];
const t0 = Date.now();
const report = {
  url: '',
  gl,
  mode,
  viewport: [W, H],
  bootMs: null,
  info: null,
  frames: [],
  exceptions: [],
  consoleErrors: [],
  networkFails: [],
  warnings: [],
  verdict: 'pass',
};

function timeLabel(t) {
  return String(Number(t.toFixed(3))).replace('.', '_');
}

function sampleTimes(info, analysis) {
  const duration = info.duration || 0;
  const shotAt = (t) => {
    const s = (info.shots || []).find((x) => t >= x.start && t < x.end);
    return s ? s.id || s.scene || null : null;
  };
  const make = (t, why) => ({
    t: Math.max(0, Math.min(duration, t)),
    why,
    shot: shotAt(t),
  });
  const out = [];
  const rawTimes = getArg('--times', '');
  if (rawTimes) {
    for (const s of rawTimes.split(',').map(Number)) if (Number.isFinite(s)) out.push(make(s, 'time'));
  }
  if (eachShot) {
    for (const s of info.shots || []) {
      const t = s.start + Math.min(0.5, (s.end - s.start) * 0.4);
      out.push(make(t, `shot:${s.id || s.scene}`));
    }
  }
  if (every > 0 && duration > 0) {
    for (let t = 0; t < duration; t += every) out.push(make(t, 'every'));
  }
  if (analysis) {
    for (const s of analysis.sections || []) out.push(make(s + 0.5, 'section'));
    out.push(make(duration * 0.5, 'mid'));
  }
  if (!out.length) {
    const d = duration || 10;
    for (const f of [0.02, 0.25, 0.5, 0.75, 0.98]) out.push(make(d * f, 'default'));
  }
  const seen = new Set();
  return out
    .sort((a, b) => a.t - b.t)
    .filter((x) => {
      const k = x.t.toFixed(3);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

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
      report.exceptions.push(
        p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception'
      );
    });
    cdp.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') {
        report.consoleErrors.push(
          (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
        );
      }
    });
    cdp.on('Log.entryAdded', (p) => {
      if (p.entry.level === 'error') {
        report.consoleErrors.push(`${p.entry.text} ${p.entry.url || ''}`.trim());
      }
    });
    cdp.on('Network.responseReceived', (p) => {
      if (p.response.status >= 400 && !p.response.url.includes('favicon')) {
        report.networkFails.push(`${p.response.status} ${p.response.url}`);
      }
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: W,
      height: H,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const url = `${base}${base.includes('?') ? '&' : '?'}${params}`;
    report.url = url;
    console.log(`navigate ${url}  ${W}x${H}  mode=${mode} gl=${gl}`);
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
    report.bootMs = Date.now() - bootStart;

    const info = await cdp.eval(`({
      assets: window.__MV.assets,
      duration: window.__MV.duration,
      shots: (window.__MV.shots || []).map(s => ({ id: s.id, start: s.start, end: s.end, scene: s.scene })),
      cw: document.getElementById('output')?.width,
      ch: document.getElementById('output')?.height
    })`);
    report.info = info;
    console.log(
      `boot ${report.bootMs}ms  duration=${info.duration}s  shots=${info.shots.length}  canvas=${info.cw}x${info.ch}`
    );
    if (info.cw && info.ch && (info.cw !== W || info.ch !== H)) {
      warnings.push(`canvas is ${info.cw}x${info.ch}, expected ${W}x${H}`);
    }

    await cdp.eval(`document.fonts.ready.then(() => true)`);

    let analysis = null;
    if (sectionsFile) {
      analysis = JSON.parse(fs.readFileSync(path.resolve(sectionsFile), 'utf8'));
    }
    const samples = sampleTimes(info, analysis);
    console.log(`captures: ${samples.length}`);

    for (let i = 0; i < samples.length; i++) {
      const { t, why, shot } = samples[i];
      dbg(`render start t=${t}`);
      await cdp.eval(`window.__MV.renderAt(${t})`);
      await sleep(120);
      dbg(`render done t=${t}`);

      const frame = { time: t, why, shot, files: {}, stats: null };
      if (mode === 'app' || mode === 'both') {
        dbg(`stats start t=${t}`);
        const stats = await cdp.eval(`(async () => {
          window.__qaShot = window.__MV.capture('image/png', 1);
          // Decode through a Blob, not img.src=dataURL: with Network enabled,
          // a multi-megabyte data URL becomes a network event and kills the
          // CDP socket (1006) before the response is delivered.
          const b64 = window.__qaShot.slice(window.__qaShot.indexOf(',') + 1);
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const w = bmp.width, h = bmp.height;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(bmp, 0, 0);
          bmp.close();
          const d = x.getImageData(0, 0, w, h).data;
          let sum = 0, sum2 = 0, min = 255, max = 0, sat = 0, n = 0;
          const buckets = new Array(16).fill(0);
          for (let p = 0; p < d.length; p += 4 * 41) {
            const l = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
            sum += l; sum2 += l * l; n++;
            if (l < min) min = l;
            if (l > max) max = l;
            sat += Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]);
            buckets[Math.min(15, Math.floor(l / 16))]++;
          }
          const mean = sum / n;
          return {
            width: w, height: h,
            mean: +mean.toFixed(2),
            stddev: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(2),
            min: Math.round(min), max: Math.round(max),
            saturation: +(sat / n).toFixed(2),
            occupiedBuckets: buckets.filter(b => b / n > 0.002).length
          };
        })()`);
        frame.stats = stats;
        dbg(`stats done t=${t}`, stats?.width, stats?.height);
        dbg(`read start t=${t}`);
        const dataUrl = await cdp.readString('window.__qaShot');
        dbg(`read done t=${t} chars=${dataUrl.length}`);
        const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
        const file = path.join(outDir, `${prefix}-${timeLabel(t)}.png`);
        fs.writeFileSync(file, buf);
        frame.files.app = path.relative(process.cwd(), file).replace(/\\/g, '/');
        frame.bytes = buf.length;
      }
      if (mode === 'page' || mode === 'both') {
        const shot = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
          fromSurface: true,
          clip: { x: 0, y: 0, width: W, height: H, scale },
        });
        const file = path.join(outDir, `${prefix}-${timeLabel(t)}-page.png`);
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
        frame.files.page = path.relative(process.cwd(), file).replace(/\\/g, '/');
      }

      const st = frame.stats;
      frame.blank = st ? st.stddev < 1.5 : false;
      frame.uniform = st ? st.occupiedBuckets <= 2 : false;
      if (frame.blank) {
        warnings.push(`t=${t}s is nearly uniform (mean=${st.mean}, stddev=${st.stddev})`);
      }
      report.frames.push(frame);
      console.log(
        `[${i + 1}/${samples.length}] t=${t.toFixed(2)}s ${shot ? shot + ' ' : ''}` +
          (st ? `mean=${st.mean} sd=${st.stddev} sat=${st.saturation} buckets=${st.occupiedBuckets} ` : '') +
          `${(frame.bytes / 1024 || 0).toFixed(0)}KB`
      );
    }

    await cdp.send('Browser.close').catch(() => {});
  } catch (e) {
    errors.push(e.message);
    console.error(`QA FAILED: ${e.message}`);
    if (browserErr) console.error(browserErr.slice(-1200));
    process.exitCode = 1;
  } finally {
    try {
      proc.kill();
    } catch (e) {
      /* ignore */
    }

    report.exceptions.push(...errors);
    report.consoleErrors = [...new Set(report.consoleErrors)].filter(
      (x) => !x.includes('favicon')
    );
    report.networkFails = [...new Set(report.networkFails)].filter((x) => !x.includes('favicon'));
    report.warnings = [...new Set(warnings)];
    const hardFail =
      report.exceptions.length > 0 ||
      report.networkFails.length > 0 ||
      (strict && report.consoleErrors.length > 0) ||
      (failOnBlank && report.frames.some((f) => f.blank));
    if (hardFail) {
      report.verdict = 'fail';
      process.exitCode = 1;
    } else if (report.warnings.length || report.consoleErrors.length) {
      report.verdict = 'warn';
    }
    report.runtimeMs = Date.now() - t0;
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(
      `verdict=${report.verdict}  errors=${report.exceptions.length}  console=${report.consoleErrors.length}  net=${report.networkFails.length}  warnings=${report.warnings.length}`
    );
    console.log(`report ${path.relative(process.cwd(), jsonPath)}`);

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
