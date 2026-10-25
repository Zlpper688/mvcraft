import { Engine } from './core/engine.js';
import { FilmOverlay } from './core/overlay.js';
import { TextureLibrary } from './core/textures.js';
import { Analysis, loadAnalysis } from './core/audio.js';
import { loadSubtitleCues } from './data/subtitles.js';
import { DURATION, SHOTS, shotAt, chapterAt } from './data/shots.js';
import { SCENE_BUILDERS } from './scenes/index.js';
import { clamp, clamp01, formatTime, nextFrame, smoothstep } from './core/utils.js';

const params = new URLSearchParams(location.search);
const renderMode = params.get('render') === '1';
const showSubtitles = params.get('subs') !== '0';

const el = (id) => document.getElementById(id);
const ui = {
  stage: el('stage'), stageShell: el('stageShell'), output: el('output'),
  hud: el('hud'), playBtn: el('playBtn'), timeline: el('timeline'),
  fill: el('timelineFill'), ticks: el('timelineTicks'), head: el('playhead'),
  timecode: el('timecode'), chapter: el('chapterLabel'),
  ccBtn: el('ccBtn'), soundBtn: el('soundBtn'), fsBtn: el('fsBtn'),
  start: el('startScreen'), startBtn: el('startBtn'),
  board: el('storyboard'), boardBtn: el('storyboardBtn'), boardClose: el('boardClose'),
  boardList: el('boardList'),
  loading: el('loading'), loadingBar: el('loadingBar'), loadingStatus: el('loadingStatus'),
  error: el('error'), errorMsg: el('errorMsg'),
  toast: el('toast'), sr: el('srSubtitles')
};

if (renderMode) document.body.classList.add('render-mode');

let engine;
let overlay;
let analysis;
let textures;
const scenes = {};
let ready = false;
let assetReport = { mode: 'poem', count: 0 };

const state = {
  t: 0,
  playing: false,
  showSubs: showSubtitles,
  muted: false,
  sceneId: null,
  view: null,
  wall: 0,
  useWallClock: false
};

const audio = new Audio('/audio/song.mp3');
audio.preload = 'auto';
audio.volume = .82;

let toastTimer = 0;
function toast(message, ms = 2600) {
  if (!ui.toast) return;
  ui.toast.textContent = message;
  ui.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), ms);
}

function setLoading(progress, status) {
  if (!ui.loadingBar) return;
  ui.loadingBar.style.transform = `scaleX(${clamp01(progress)})`;
  if (status) ui.loadingStatus.textContent = status;
}

function showError(message) {
  console.error(message);
  if (ui.error) {
    ui.errorMsg.textContent = message;
    ui.error.hidden = false;
  }
  if (ui.loading) ui.loading.classList.add('is-done');
}

function makeDummyAnalysis() {
  const empty = new Float32Array(32);
  return new Analysis({
    duration: DURATION, fps: 30, tempo: 72,
    rms: empty, vocal: empty, flux: empty,
    bands: { sub: empty, low: empty, midlow: empty, mid: empty, high: empty, air: empty },
    onsets: [], silences: []
  });
}

function transitionColor(type, fallback) {
  if (fallback) return fallback;
  if (type === 'ink') return '#040810';
  if (type === 'dip' || type === 'fade') return '#02040a';
  if (type === 'iris') return '#02040a';
  if (type === 'flash') return '#f4efe7';
  return '#02040a';
}

function activeTransition(t) {
  for (const shot of SHOTS) {
    const tr = shot.trans;
    if (!tr || !tr.dur || tr.type === 'cut') continue;
    const a = shot.start - tr.dur * .5;
    const b = shot.start + tr.dur * .5;
    if (t >= a && t <= b) {
      return {
        type: tr.type,
        progress: clamp01((t - a) / Math.max(.0001, b - a)),
        color: transitionColor(tr.type, tr.color),
        center: tr.center || [.5, .5]
      };
    }
  }
  return null;
}

function currentScene(shot) {
  return scenes[shot.scene] || scenes.prologue;
}

function prepareShot(time) {
  const shot = shotAt(time);
  const inst = currentScene(shot);
  const view = inst.views[shot.view] ? shot.view : Object.keys(inst.views)[0];
  if (state.sceneId !== inst.id) {
    state.sceneId = inst.id;
    state.view = null;
  }
  if (state.view !== view) {
    inst.setView(view);
    state.view = view;
  }
  state.sceneInst = inst;
  return { shot, inst };
}

function renderFrame(time) {
  if (!engine || !overlay) return;
  const t = clamp(time, 0, DURATION);
  state.t = t;
  const { shot, inst } = prepareShot(t);
  const progress = clamp01((t - shot.start) / Math.max(.0001, shot.end - shot.start));
  const energy = analysis ? analysis.at(t) : 0;
  inst.rig.update(progress, t, energy);
  let post = inst.post || {};
  if (inst.update) {
    const p = inst.update(t, t - shot.start, shot, analysis);
    if (p) post = p;
  }
  const tr = activeTransition(t);
  engine.render(inst.scene, inst.camera, t, { ...post, transition: tr });
  engine.drawOverlay((ctx, W, H) => {
    overlay.draw(ctx, W, H, t, {
      showSubs: state.showSubs,
      fade: 1,
      minimal: false
    });
  });
}

let lastUiSecond = -1;
function updateUI(force = false) {
  const t = state.t;
  const pct = clamp01(t / DURATION);
  if (ui.fill) ui.fill.style.width = `${pct * 100}%`;
  if (ui.head) ui.head.style.left = `${pct * 100}%`;
  if (ui.timeline) ui.timeline.setAttribute('aria-valuenow', String(Math.round(t)));
  const sec = Math.floor(t);
  if (force || sec !== lastUiSecond) {
    lastUiSecond = sec;
    if (ui.timecode) ui.timecode.textContent = `${formatTime(t)} / ${formatTime(DURATION)}`;
    if (ui.chapter) ui.chapter.textContent = chapterAt(t);
    const cue = state.showSubs ? findCue(t) : null;
    if (ui.sr) ui.sr.textContent = cue ? cue.cn : '';
  }
  if (ui.playBtn) {
    ui.playBtn.setAttribute('aria-label', state.playing ? '暂停' : '播放');
    document.body.classList.toggle('is-playing', state.playing);
  }
  markBoardCurrent(shotAt(t).id);
}

function findCue(t) {
  if (!overlay) return null;
  return overlay.cues.find(c => t >= c.start && t <= c.end) || null;
}

/* ---------------- transport ---------------- */
function syncAudioTo(t) {
  if (!audio || state.useWallClock) return;
  try {
    if (audio.readyState >= 1 && Math.abs(audio.currentTime - t) > .08) audio.currentTime = t;
  } catch (e) { /* ignored */ }
}

function play() {
  if (state.t >= DURATION - .04) state.t = 0;
  state.playing = true;
  state.wall = performance.now() - state.t * 1000;
  if (!state.useWallClock) {
    syncAudioTo(state.t);
    const p = audio.play();
    if (p && p.catch) {
      p.catch(() => {
        state.useWallClock = true;
        toast('音频未能播放，画面继续');
      });
    }
  }
  state.lastFrame = 0;
  updateUI(true);
  showHUD();
}

function pause() {
  state.playing = false;
  try { audio.pause(); } catch (e) {}
  updateUI(true);
  showHUD(true);
}

function togglePlay() {
  if (state.playing) pause();
  else play();
}

function seek(t, { render = true } = {}) {
  state.t = clamp(t, 0, DURATION);
  state.wall = performance.now() - state.t * 1000;
  syncAudioTo(state.t);
  if (render) renderFrame(state.t);
  updateUI(true);
}

function nudge(dt) {
  seek(state.t + dt);
}

function stepShot(dir) {
  const shot = shotAt(state.t);
  let i = SHOTS.indexOf(shot);
  if (dir > 0 && state.t - shot.start > 1.2) i += 1;
  if (dir < 0 && state.t - shot.start < 2.2) i -= 1;
  i = Math.max(0, Math.min(SHOTS.length - 1, i));
  seek(SHOTS[i].start + .04);
}

/* ---------------- HUD ---------------- */
let hideTimer = 0;
function showHUD(force = false) {
  if (!ui.hud) return;
  ui.hud.classList.remove('is-hidden');
  clearTimeout(hideTimer);
  if (state.playing && !force) {
    hideTimer = setTimeout(() => {
      if (state.playing && !ui.board.classList.contains('is-open')) ui.hud.classList.add('is-hidden');
    }, 3200);
  }
}

function buildTicks() {
  if (!ui.ticks) return;
  for (const shot of SHOTS) {
    if (shot.start <= 0) continue;
    const tick = document.createElement('i');
    tick.className = 'timeline__tick';
    tick.style.left = `${(shot.start / DURATION) * 100}%`;
    ui.ticks.appendChild(tick);
  }
}

let seeking = false;
function timelineSeek(clientX) {
  const r = ui.timeline.getBoundingClientRect();
  if (!r.width) return;
  seek(clamp01((clientX - r.left) / r.width) * DURATION);
}
function bindTransport() {
  if (ui.timeline) {
    ui.timeline.addEventListener('pointerdown', (e) => {
      seeking = true;
      ui.timeline.setPointerCapture(e.pointerId);
      timelineSeek(e.clientX);
      showHUD(true);
    });
    ui.timeline.addEventListener('pointermove', (e) => { if (seeking) timelineSeek(e.clientX); });
    const end = () => { seeking = false; };
    ui.timeline.addEventListener('pointerup', end);
    ui.timeline.addEventListener('pointercancel', end);
  }
  ui.playBtn?.addEventListener('click', togglePlay);
  ui.soundBtn?.addEventListener('click', () => {
    state.muted = !state.muted;
    audio.muted = state.muted;
    ui.soundBtn.classList.toggle('is-on', !state.muted);
    ui.soundBtn.classList.toggle('is-off', state.muted);
    ui.soundBtn.setAttribute('aria-label', state.muted ? '取消静音' : '静音');
    toast(state.muted ? '已静音' : '声音开启');
  });
  ui.ccBtn?.addEventListener('click', () => {
    state.showSubs = !state.showSubs;
    ui.ccBtn.classList.toggle('is-on', state.showSubs);
    toast(state.showSubs ? '字幕开启' : '字幕关闭');
    renderFrame(state.t);
  });
  ui.fsBtn?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await ui.stageShell.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) { toast('当前浏览器不支持全屏'); }
  });
  ui.boardBtn?.addEventListener('click', () => openBoard());
  ui.boardClose?.addEventListener('click', () => closeBoard());
  ui.startBtn?.addEventListener('click', () => {
    ui.start.classList.add('is-gone');
    seek(0);
    play();
    setTimeout(() => { ui.start.setAttribute('aria-hidden', 'true'); }, 1200);
  });
  ui.stage?.addEventListener('dblclick', () => {
    if (!renderMode) ui.fsBtn.click();
  });
}

function buildBoard() {
  if (!ui.boardList) return;
  ui.boardList.innerHTML = '';
  SHOTS.forEach((shot, i) => {
    const li = document.createElement('li');
    li.className = 'board__row';
    li.dataset.shot = shot.id;
    li.tabIndex = 0;
    li.innerHTML = `
      <span class="board__time">${formatTime(shot.start)}</span>
      <div>
        <p class="board__title">${String(i + 1).padStart(2, '0')} · ${shot.name} <span style="opacity:.35;font-size:10px;letter-spacing:.2em">${shot.nameEn}</span></p>
        <p class="board__desc">${shot.desc}</p>
        <p class="board__cam">${shot.cam}</p>
      </div>`;
    const go = () => {
      seek(shot.start + .03);
      closeBoard();
      if (!state.playing) showHUD(true);
    };
    li.addEventListener('click', go);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    ui.boardList.appendChild(li);
  });
}

let boardCurrent = null;
function markBoardCurrent(id) {
  if (!ui.boardList || boardCurrent === id) return;
  boardCurrent = id;
  ui.boardList.querySelectorAll('.board__row').forEach((row) => {
    row.classList.toggle('is-current', row.dataset.shot === id);
  });
}

function openBoard() {
  ui.board.classList.add('is-open');
  ui.board.setAttribute('aria-hidden', 'false');
  showHUD(true);
}
function closeBoard() {
  ui.board.classList.remove('is-open');
  ui.board.setAttribute('aria-hidden', 'true');
  showHUD();
}

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    switch (e.code) {
      case 'Space': e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': e.preventDefault(); nudge(e.shiftKey ? 10 : 5); break;
      case 'ArrowLeft': e.preventDefault(); nudge(e.shiftKey ? -10 : -5); break;
      case 'ArrowUp': e.preventDefault(); stepShot(-1); break;
      case 'ArrowDown': e.preventDefault(); stepShot(1); break;
      case 'KeyM': ui.soundBtn.click(); break;
      case 'KeyC': ui.ccBtn.click(); break;
      case 'KeyB': ui.board.classList.contains('is-open') ? closeBoard() : openBoard(); break;
      case 'KeyF': ui.fsBtn.click(); break;
      case 'Home': e.preventDefault(); seek(0); break;
      case 'End': e.preventDefault(); seek(DURATION - .1); break;
      case 'Escape': if (ui.board.classList.contains('is-open')) closeBoard(); break;
    }
  });
  window.addEventListener('mousemove', () => showHUD());
  window.addEventListener('touchstart', () => showHUD(), { passive: true });
}

/* ---------------- audio events ---------------- */
audio.addEventListener('ended', () => {
  state.t = DURATION;
  renderFrame(DURATION - .01);
  pause();
  showHUD(true);
});
audio.addEventListener('error', () => {
  state.useWallClock = true;
  toast('音频无法加载，画面使用独立时钟');
});

/* ---------------- boot ---------------- */
async function boot() {
  try {
    const test = document.createElement('canvas');
    if (!test.getContext('webgl2')) {
      throw new Error('当前浏览器或显卡未启用 WebGL2。请使用最新的 Chrome / Edge，并开启硬件加速。');
    }
    setLoading(.04, '正在铺开宣纸');

    textures = new TextureLibrary();
    overlay = new FilmOverlay([]);

    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('300 112px "Noto Serif SC"', '我爱你一封没有寄出的信穿过墨海与月光'),
        document.fonts.load('400 64px "Noto Serif SC"', '见字如面潮汐'),
        document.fonts.load('400 20px "Cormorant Garamond"', 'A LETTER TO THE MOON'),
        document.fonts.load('italic 400 18px "Cormorant Garamond"', 'The moon is the only address I know.')
      ]).catch(() => {});
    }
    await document.fonts.ready.catch(() => {});
    setLoading(.1, '正在研墨');

    try {
      analysis = await loadAnalysis('/analysis/analysis.json');
    } catch (e) {
      console.warn('analysis missing, fallback silence curve', e);
      analysis = makeDummyAnalysis();
    }
    setLoading(.16, '正在读取潮汐');

    const subs = await loadSubtitleCues();
    assetReport = { mode: subs.mode, count: subs.cues.length };
    overlay = new FilmOverlay(subs.cues);
    setLoading(.22, '正在排版诗行');

    engine = new Engine(ui.output);
    setLoading(.3, '正在铺开宣纸');

    const builders = Object.entries(SCENE_BUILDERS);
    for (let i = 0; i < builders.length; i++) {
      const [id, build] = builders[i];
      setLoading(.3 + (i / Math.max(1, builders.length)) * .58, `正在布置场景 · ${id}`);
      await nextFrame();
      try {
        scenes[id] = build({ tex: textures, analysis, aspect: 1920 / 804 });
      } catch (e) {
        console.error(`scene "${id}" failed`, e);
        throw new Error(`场景 ${id} 构建失败：${e.message}`);
      }
    }
    if (!scenes.prologue) throw new Error('主场景未能初始化。');

    setLoading(.94, '正在校准月光');
    await nextFrame();
    buildTicks();
    buildBoard();
    bindTransport();
    bindKeys();

    if (renderMode) {
      setLoading(1, '就绪');
      const t = params.has('t') ? Number(params.get('t')) : 0;
      seek(Number.isFinite(t) ? t : 0);
      ready = true;
      exposeApi();
    } else {
      // poster frame behind the start screen
      seek(6.2);
      requestAnimationFrame(() => {
        ui.loading.classList.add('is-done');
        ready = true;
        exposeApi();
      });
    }
    state.ready = true;
  } catch (e) {
    console.error(e);
    window.__MV_BOOT_ERROR = e.message || String(e);
    showError(e.message || String(e));
    ready = true;
    exposeApi();
  }
}

let rafId = 0;
let lastTs = 0;
function tick(now) {
  rafId = requestAnimationFrame(tick);
  if (!state.playing) return;
  let t;
  if (!state.useWallClock && audio.readyState >= 2 && !audio.paused && audio.currentTime > 0) {
    t = audio.currentTime;
    if (Math.abs(t - state.t) > 1.2) {
      // tab was suspended or audio drifted; follow the audio master clock
      state.wall = now - t * 1000;
    }
  } else {
    t = (now - state.wall) / 1000;
  }
  if (t >= DURATION) {
    state.t = DURATION;
    renderFrame(DURATION - .01);
    updateUI();
    pause();
    return;
  }
  if (t < 0) t = 0;
  state.t = t;
  renderFrame(t);
  updateUI();
}

function exposeApi() {
  window.__MV = {
    duration: DURATION,
    shots: SHOTS,
    scenes,
    engine,
    get scene() { return state.sceneInst ? state.sceneInst.scene : null; },
    get camera() { return state.sceneInst ? state.sceneInst.camera : null; },
    get ready() { return ready; },
    get assets() { return assetReport; },
    getTime: () => state.t,
    seek: (t) => { pause(); seek(t); return state.t; },
    renderAt: (t) => { state.playing = false; renderFrame(t); updateUI(true); return state.t; },
    pause,
    play: () => { if (renderMode) return; play(); },
    capture: (type = 'image/png', q = .96) => engine.captureFrame(type, q),
    isPlaying: () => state.playing
  };
}

audio.load();
boot().then(() => {
  if (!rafId) rafId = requestAnimationFrame(tick);
});
