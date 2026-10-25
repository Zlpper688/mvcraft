#!/usr/bin/env node
/**
 * Zero-dependency storyboard validator.
 *
 * Usage:
 *   node tools/validate-storyboard.mjs storyboard.json --duration 310.16
 *   node tools/validate-storyboard.mjs storyboard.json --analysis public/analysis/analysis.json
 *   node tools/validate-storyboard.mjs storyboard.json --art art-direction.json --json
 */
import fs from 'node:fs';
import process from 'node:process';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

if (!file) {
  console.error('usage: node tools/validate-storyboard.mjs <storyboard.json> [--duration 310.16] [--analysis analysis.json] [--art art-direction.json] [--json]');
  process.exit(2);
}

let sb;
try {
  sb = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`cannot read ${file}: ${e.message}`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const info = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const EPS = 1e-6;
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const DURATION = Number(flag('duration', sb.duration));
const FPS = Number(flag('fps', sb.fps || 24));
const FRAME = 1 / FPS;

if (!num(DURATION) || DURATION <= 0) err('duration must be a positive number');
if (!num(FPS) || FPS <= 0) err('fps must be a positive number');
if (!Array.isArray(sb.shots) || !sb.shots.length) {
  err('shots must be a non-empty array');
  finish();
}

const ids = new Set();
const shots = sb.shots.map((s, i) => ({ ...s, _i: i }));

for (const s of shots) {
  const where = `shots[${s._i}]${s.id ? ` (${s.id})` : ''}`;
  if (!s.id || typeof s.id !== 'string') err(`${where}: id is required`);
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) err(`${where}: id must be kebab-case`);
  else if (ids.has(s.id)) err(`${where}: duplicate id`);
  else ids.add(s.id);

  if (!s.scene) err(`${where}: scene is required`);
  if (!s.function) err(`${where}: function is required`);
  if (!s.subject) err(`${where}: subject is required`);
  if (!s.event) err(`${where}: event is required`);
  if (!s.transitionIn || !s.transitionIn.type) err(`${where}: transitionIn.type is required`);
  else {
    const tr = s.transitionIn;
    const dur = Number(tr.duration);
    if (!num(dur) || dur < 0) err(`${where}: transitionIn.duration must be >= 0`);
    if (tr.type === 'cut' && dur !== 0) warn(`${where}: cut should have duration 0`);
    if (tr.type !== 'cut' && dur === 0) warn(`${where}: ${tr.type} has duration 0`);
    if (tr.type === 'flash' && dur > 2.0) err(`${where}: flash duration ${dur}s > 2.0s`);
    else if (tr.type === 'flash' && dur > 0.8) warn(`${where}: flash ${dur}s — only for a soft whiteout, not a strobe`);
    if (num(s.start) && s.start - dur / 2 < -0.01 && s._i > 0) err(`${where}: transition starts before 0 (${(s.start - dur / 2).toFixed(3)}s)`);
  }

  if (!num(s.start) || !num(s.end)) {
    err(`${where}: start/end must be numbers`);
    continue;
  }
  if (s.start < 0) err(`${where}: start < 0`);
  if (s.end <= s.start) err(`${where}: end must be > start`);
  const len = s.end - s.start;
  if (len < 1.5) err(`${where}: ${len.toFixed(2)}s < 1.5s minimum`);
  if (len > 25) err(`${where}: ${len.toFixed(2)}s > 25s maximum`);
  else if (len > 16 && !['title', 'breathe'].includes(s.function)) {
    warn(`${where}: very long shot ${len.toFixed(2)}s — confirm there is an internal event`);
  } else if (len > 12) {
    info.push(`${where}: ${len.toFixed(2)}s long take (${s.function})`);
  }
  if (s.start > DURATION + EPS) err(`${where}: starts after film duration`);
  if (s.end > DURATION + 0.05) warn(`${where}: ends ${(s.end - DURATION).toFixed(2)}s after duration`);
}

shots.sort((a, b) => a.start - b.start);

if (shots.length) {
  if (Math.abs(shots[0].start) > FRAME) err(`first shot starts at ${shots[0].start}, expected 0`);
  for (let i = 1; i < shots.length; i++) {
    const prev = shots[i - 1];
    const cur = shots[i];
    const gap = cur.start - prev.end;
    if (Math.abs(gap) > FRAME) {
      if (gap > 0) err(`gap ${gap.toFixed(3)}s between ${prev.id} and ${cur.id} (no coverage)`);
      else err(`overlap ${(-gap).toFixed(3)}s between ${prev.id} and ${cur.id}`);
    }
  }
  const last = shots[shots.length - 1];
  if (Math.abs(last.end - DURATION) > 0.05) {
    err(`last shot ends at ${last.end.toFixed(3)}, film duration is ${DURATION.toFixed(3)}`);
  }

  const counts = {};
  for (const s of shots) counts[s.scene] = (counts[s.scene] || 0) + 1;
  info.push(`${shots.length} shots across ${Object.keys(counts).length} scenes`);
  const reused = Object.entries(counts).filter(([, n]) => n > 1);
  if (reused.length) info.push(`reused scenes: ${reused.map(([k, n]) => `${k}×${n}`).join(', ')}`);

  let sameFn = 1;
  let sameScene = 1;
  for (let i = 1; i < shots.length; i++) {
    sameFn = shots[i].function === shots[i - 1].function ? sameFn + 1 : 1;
    sameScene = shots[i].scene === shots[i - 1].scene ? sameScene + 1 : 1;
    if (sameFn >= 3) warn(`${shots[i - 2].id} → ${shots[i].id}: three consecutive "${shots[i].function}" shots`);
    if (sameScene >= 4) warn(`scene "${shots[i].scene}" has 4+ consecutive shots — consider a new angle or scene`);
  }

  const flashes = shots.filter((s) => s.transitionIn?.type === 'flash');
  if (flashes.length > 6) err(`${flashes.length} flash transitions; keep <= 6 per film`);
  info.push(`transitions: ${shots.map((s) => s.transitionIn?.type).filter((t) => t && t !== 'cut').length} non-cut`);
}

const shotsMissing = shots.filter((s) => !s.shot);
if (shotsMissing.length) warn(`${shotsMissing.length} shots have no camera description ("shot")`);

if (Array.isArray(sb.sections) && sb.sections.length) {
  sb.sections.sort((a, b) => a.start - b.start);
  if (Math.abs(sb.sections[0].start) > FRAME) warn('first section does not start at 0');
  for (let i = 1; i < sb.sections.length; i++) {
    const gap = sb.sections[i].start - sb.sections[i - 1].end;
    if (Math.abs(gap) > 0.5) warn(`section gap/overlap ${gap.toFixed(2)}s near ${sb.sections[i].name}`);
  }
  const last = sb.sections[sb.sections.length - 1];
  if (Math.abs(last.end - DURATION) > 0.5) warn(`last section ends at ${last.end}, film duration ${DURATION}`);
  for (const sec of sb.sections) {
    if (sec.energy < 0 || sec.energy > 1) err(`section "${sec.name}": energy must be 0..1`);
  }
}

if (Array.isArray(sb.subtitles)) {
  const subs = [...sb.subtitles].sort((a, b) => a.start - b.start);
  let lastEnd = -1;
  let covered = 0;
  for (const [i, c] of subs.entries()) {
    const label = c.id || `subtitle[${i}]`;
    if (!c.cn || typeof c.cn !== 'string') err(`${label}: cn text is required`);
    if (!num(c.start) || !num(c.end) || c.end <= c.start) {
      err(`${label}: invalid start/end`);
      continue;
    }
    if (c.start < 0 || c.end > DURATION + 0.05) err(`${label}: outside film (${c.start}–${c.end})`);
    const len = c.end - c.start;
    if (len < 1.2) err(`${label}: ${len.toFixed(2)}s < 1.2s minimum`);
    if (len > 10) err(`${label}: ${len.toFixed(2)}s > 10s maximum`);
    else if (len > 7.5) warn(`${label}: ${len.toFixed(2)}s > 7.5s — split the line`);
    if (c.start < lastEnd + 0.3) warn(`${label}: gap to previous cue < 0.3s`);
    lastEnd = Math.max(lastEnd, c.end);
    covered += len;
    const chars = [...String(c.cn)].filter((ch) => !/\s/.test(ch)).length;
    const cps = chars / len;
    if (cps > 4.5) err(`${label}: ${cps.toFixed(1)} chars/s > 4.5 reading speed`);
    else if (cps > 4.0) warn(`${label}: ${cps.toFixed(1)} chars/s is fast`);
    const lineMax = Number(flag('line-max', 18));
    if (chars > lineMax) warn(`${label}: ${chars} chars in one line (>${lineMax})`);
    if (c.en && String(c.en).length > 48) warn(`${label}: english line > 48 chars`);
  }
  if (subs.length) {
    info.push(`${subs.length} subtitle cues, ${(covered / DURATION * 100).toFixed(1)}% of runtime covered`);
    const density = subs.length / (DURATION / 60);
    if (density > 8) warn(`${density.toFixed(1)} cues/min — may feel like karaoke`);
  } else {
    info.push('no subtitles declared');
  }
}

const analysisPath = flag('analysis');
if (analysisPath) {
  try {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    const onsets = (analysis.onsets || []).map((o) => o.t);
    const cuts = shots.slice(1).map((s) => s.start);
    if (onsets.length && cuts.length) {
      const nearOnset = (t) => onsets.some((o) => Math.abs(o - t) < 0.08);
      const near = cuts.filter(nearOnset).length;
      const onsetRatio = near / cuts.length;
      info.push(`cut alignment: ${(onsetRatio * 100).toFixed(0)}% within 80ms of an onset (${near}/${cuts.length})`);
      let beatRatio = null;
      let nearBeat = () => false;
      const tempo = Number(analysis.tempo);
      if (tempo >= 30 && tempo <= 240) {
        const beat = 60 / tempo;
        let best = { n: -1, phase: 0 };
        for (let phase = 0; phase < beat; phase += 0.005) {
          const n = cuts.filter((t) => {
            const k = Math.round((t - phase) / beat);
            return Math.abs(t - (k * beat + phase)) < 0.08;
          }).length;
          if (n > best.n) best = { n, phase };
        }
        nearBeat = (t) => {
          const k = Math.round((t - best.phase) / beat);
          return Math.abs(t - (k * beat + best.phase)) < 0.08;
        };
        beatRatio = best.n / cuts.length;
        info.push(
          `beat alignment: ${(beatRatio * 100).toFixed(0)}% within 80ms of a ${tempo.toFixed(0)} BPM grid ` +
            `(offset ${best.phase.toFixed(2)}s, ${best.n}/${cuts.length})`
        );
      }
      // The documented rule is "onset OR beat grid", so judge the union, not the better of two.
      const unionNear = cuts.filter((t) => nearOnset(t) || nearBeat(t)).length;
      const unionRatio = unionNear / cuts.length;
      if (beatRatio !== null) {
        info.push(`cut alignment (onset ∪ beat): ${(unionRatio * 100).toFixed(0)}% (${unionNear}/${cuts.length})`);
      }
      const bestRatio = Math.max(onsetRatio, beatRatio ?? 0, unionRatio);
      if (bestRatio < 0.35) {
        warn(`cut alignment ${(bestRatio * 100).toFixed(0)}% is low; check cut points against onsets or the beat grid`);
      } else if (bestRatio < 0.6 && onsetRatio < 0.4) {
        info.push('cut alignment below 0.6 — acceptable for slow songs, reconsider for rhythmic ones');
      }
    }
    if (num(analysis.duration) && Math.abs(analysis.duration - DURATION) > 0.2) {
      warn(`analysis duration ${analysis.duration}s vs storyboard ${DURATION}s`);
    }
  } catch (e) {
    warn(`cannot read analysis: ${e.message}`);
  }
}

const artPath = flag('art');
if (artPath) {
  try {
    const art = JSON.parse(fs.readFileSync(artPath, 'utf8'));
    const allowed = new Set(art.transitions || []);
    for (const s of shots) {
      const t = s.transitionIn?.type;
      if (t && allowed.size && !allowed.has(t)) {
        err(`${s.id}: transition "${t}" not declared in art-direction.transitions`);
      }
    }
    const forbidden = art.forbidden || [];
    if (forbidden.length) info.push(`art direction forbids: ${forbidden.join(', ')}`);
  } catch (e) {
    warn(`cannot read art direction: ${e.message}`);
  }
}

const wantJson = has('json');
finish();

function finish() {
  if (wantJson) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings, info }, null, 2));
  } else {
    for (const m of info) console.log(`· ${m}`);
    for (const m of warnings) console.log(`! ${m}`);
    for (const m of errors) console.log(`✗ ${m}`);
    const verdict = errors.length ? 'FAIL' : warnings.length ? 'PASS (warnings)' : 'PASS';
    console.log(`\n${verdict}: ${errors.length} error(s), ${warnings.length} warning(s)`);
  }
  process.exit(errors.length ? 1 : 0);
}
