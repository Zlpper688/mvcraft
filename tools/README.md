# Tools

Zero-npm tools that drive a Chromium browser over CDP, analyze audio, check the
storyboard, export frames, and QA the encoded film. Each file is standalone —
copy the ones you need into your project.

## Requirements

| Need | Version | Notes |
|---|---|---|
| Node | 22+ | global `WebSocket`, no `npm install` |
| Python | 3.10+ | `pip install -r tools/requirements.txt` |
| Browser | Edge or Chrome | auto-discovered; override with `--browser` |
| ffmpeg / ffprobe | 6+ | `FFMPEG=... FFPROBE=...` if not on PATH |
| libvmaf | optional | for VMAF; most full ffmpeg builds include it |

## The page contract

The browser tools need a page that exposes a small deterministic API:

```js
window.__MV = {
  ready: true,                 // after assets + first render
  duration: 310.16,            // seconds
  shots: [{ id, start, end, scene }],
  renderAt(t),                 // synchronous: seek + draw
  capture(type, quality),      // synchronous: returns a data: URL
  scene, camera,               // only needed by probe.mjs
};
```

Rules that make QA trustworthy:

1. `renderAt(t)` is pure: same `t` → same pixels. No `Math.random()` without a
   seeded PRNG; no shader time uniforms except `uTime = t`.
2. `capture()` must render and read back **in the same task** (no `await`
   between render and `toDataURL`).
3. `preserveDrawingBuffer: true` on the renderer, and a fixed backing canvas
   size (e.g. 1920×804). Do not derive export size from the window.
4. Boot failures go to `window.__MV_BOOT_ERROR` so QA reports them instead of
   timing out with an empty canvas.

## Files

| File | What it does |
|---|---|
| `lib/cdp.mjs` | Shared CDP client: chunked string reads, per-call timeouts, socket close/error handling. Copy it along with any browser tool. |
| `analyze_audio.py` | STFT features at 30 fps: bands, RMS, flux, vocal, onsets, tempo, structure, silence. Writes `analysis.json` + plots. |
| `validate-storyboard.mjs` | Zero-dep validator: coverage, durations, transitions, subtitle reading speed, flash limits, onset + beat-grid alignment, art-direction whitelist. |
| `qa-cdp.mjs` | Stills at chosen times (`--times`, `--every`, `--each-shot`, `--sections`), deterministic canvas PNGs and/or page screenshots. Writes a report. |
| `probe.mjs` | Lists what is on screen with coverage/depth/material; `--name` hides an object and reports the pixel-diff bbox to prove identity. |
| `export.mjs` | Deterministic frame export with bench, resume, from/to, atomic writes, and boot/runtime error capture. |
| `qa-video.sh` | Container/color checks, black/freeze/cut detection, loudness/true peak, optional VMAF/SSIM vs. source frames. |
| `contact-sheet.sh` | Frame picks tiled into one JPEG; no ImageMagick. |

## lib/cdp.mjs

The three browser tools share one client instead of each carrying a copy. Two
behaviours matter and are easy to get wrong:

- **Chunked reads.** `readString(expr)` reads `.length` first, then pulls the
  string in 1 MB slices. A single multi-megabyte `Runtime.evaluate` result can
  close the WebSocket.
- **Failure is loud.** The socket's `close`/`error` events reject every pending
  call, and each `send` has a timeout. Without this, a broken socket leaves
  `await` hanging forever — the tool just stops, with no error.

Any tool that returns PNG data URLs must also avoid `img.src = dataURL` for
decoding while `Network.enable` is on: the data URL becomes a network event and
the event payload is large enough to kill the socket (close 1006). In-page
decoding goes `atob → Uint8Array → Blob → createImageBitmap`.

Add `--debug` to `qa-cdp.mjs` to stream browser stderr and per-step timings
when a run stalls.

## Quick start

```bash
# 1. analyze the song
python tools/analyze_audio.py --input song.mp3 --out public/analysis --fps 30

# 2. validate the cut before building
node tools/validate-storyboard.mjs storyboard.json --duration 310.16 \
  --analysis public/analysis/analysis.json --art art-direction.json

# 3. look at one frame per shot (animatic)
node tools/qa-cdp.mjs --each-shot --prefix animatic

# 4. diagnose a missing/covered subject
node tools/probe.mjs --at 44 --list
node tools/probe.mjs --at 44 --name lantern

# 5. measure the render before committing to the full export
node tools/export.mjs --fps 24 --gl d3d11 --bench-only
node tools/export.mjs --fps 24 --gl d3d11 --quality .96

# 6. QA the film
bash tools/qa-video.sh out/film.mp4 public/analysis/analysis.json --storyboard storyboard.json
bash tools/qa-video.sh out/film.mp4 --ref shots/export/frames --ref-fps 24 --storyboard storyboard.json
bash tools/contact-sheet.sh out/film.mp4 --count 16 --label out/contact.jpg
```

## qa-cdp.mjs

```bash
node tools/qa-cdp.mjs --times 6,44,104.5 --prefix qa
node tools/qa-cdp.mjs --sections public/analysis/analysis.json
node tools/qa-cdp.mjs --every 20 --mode page --out shots/page
node tools/qa-cdp.mjs --each-shot --url http://127.0.0.1:5173 --w 1920 --h 804
```

- `--mode app` (default) captures the canvas via `__MV.capture` — exact export
  pixels, no DOM subtitles.
- `--mode page` uses `Page.captureScreenshot` — includes DOM subtitles and UI.
- `--mode both` writes both files per timestamp.
- `--fail-on-blank` turns near-uniform frames into a failure (useful in CI,
  but intentional black fades will trip it).
- Exit 1 on boot errors, exceptions, failed requests, and `--strict` console
  errors.

Report: `shots/qa/qa-report.json` with boot time, canvas size, per-frame
luminance/saturation/bucket stats, and errors.

## probe.mjs

`--list` prints a table sorted by screen coverage:

```
  12.43%  Mesh      visible  moon-ring   box=820x430@550,180 d=42.1 tris=1536 #E7EDF5
   0.31%  Points    visible  dust        box=1920x800@0,2 d=18.0 tris=0 #C8A96B
```

Coverage is the clipped projected bounding box area divided by the canvas.
`tris=0` on Points/Lines is normal.

`--name` performs an identity test: render, hide the target, render again, and
diff the pixels. The target can be a Mesh/Sprite/Points/Line **or a Group** —
for a group, probe aggregates every descendant renderable's screen box and
hides the whole group (so a letter made of body + seal + thread is tested as
one subject). It fails loudly when the name resolves to a `PointLight` (or any
non-renderable) instead of silently "finding" the wrong thing. Outputs:

- `diff.changedRatio` — how much of the frame the object actually contributes
- `diff.bbox` — where the change happened, in pixels; compare with the
  projected `screenBox` to catch a wrong match
- `baselineNoiseRatio` — non-determinism check (two renders of the same frame)
- `*-diff.png` — changed pixels in red over a dimmed plate

If `changedRatio < 0.0002`, the object is occluded, fully transparent, or not
drawn. If `deterministic=false`, fix the scene's randomness before trusting any
visual diff.

## export.mjs

```bash
node tools/export.mjs --fps 24 --gl d3d11 --bench-only
node tools/export.mjs --fps 24 --gl d3d11 --from 0 --to 30 --out shots/test
node tools/export.mjs --fps 24 --gl swiftshader --resume
```

- `--bench 12` measures real capture time and prints an ETA.
- `--gl d3d11` uses the GPU (fast, Windows); `--gl swiftshader` is portable and
  slow. Always benchmark before a full run.
- `--format image/png` is lossless but much slower and larger; JPEG q0.96 is
  the normal choice.
- The exporter warms up every scene once before timing, so shader compilation
  is not attributed to the first frames.
- Frames are written atomically (`*.tmp` then rename), so `--resume` is safe.

## qa-video.sh

```bash
bash tools/qa-video.sh out/film.mp4 public/analysis/analysis.json \
  --storyboard storyboard.json
bash tools/qa-video.sh out/film.mp4 --ref shots/export/frames --ref-fps 24 \
  --storyboard storyboard.json --min-vmaf 90 --min-vmaf-min 85 \
  --json out/qa-report.json
```

Checks and defaults:

| Check | Failure |
|---|---|
| `yuvj*` / full-range / missing BT.709 tags | fail / warn |
| black segment > 0.5 s away from the first/last second | fail unless it overlaps a registered `fade`/`dip`/`ink` transition from `--storyboard` |
| freeze > 1 s | fail (use `--allow-freeze` for a deliberate still) |
| integrated loudness outside -16..-12 LUFS | fail (warn outside -15..-13) |
| true peak > -0.5 dBTP | fail (warn > -1.0) |
| video/audio duration differ > 0.5 s | fail |
| VMAF mean < 90 or min < 85 (JPEG source) | fail |
| SSIM < 0.98 | fail |

VMAF/SSIM need `--ref`: a directory of `000001.jpg` frames or a reference
video. Without it, the tool still runs all temporal/audio checks.

`qa-video.sh` covers container/color, black/freeze/cut, loudness and encode
fidelity. It does **not** replace the manual photosensitivity/block/blur passes
or looking at the film.

`--ref` accepts a frame directory (`000001.jpg`, …) or a reference video.
If sizes differ, the film is scaled to the reference before measuring. VMAF
needs a reference; without one the tool still checks everything else.

The report is written to `<video>.qa.json` unless `--json` is passed. Exit code
is 1 on hard failures and 0 otherwise (warnings do not fail unless `--strict`).

Note: `node` is used only to parse the libvmaf JSON; there are no npm packages.

## contact-sheet.sh

```bash
bash tools/contact-sheet.sh out/film.mp4 0.5,19.5,44.5,74.5 out/contact.jpg
bash tools/contact-sheet.sh out/film.mp4 --every 20 --cols 4 --label out/animatic.jpg
bash tools/contact-sheet.sh out/film.mp4 --count 16 --width 640 out/animatic.jpg
```

Tiles are scaled to a uniform width, padded on a dark background, and the last
row is padded by repeating the last frame. `--label` burns `12.5s`-style
timestamps into the tiles; if the ffmpeg build lacks `drawtext`, labels are
disabled with a warning.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Tool stops mid-run, no error, process alive | CDP socket was closed by an oversized message (usually a large PNG data URL) and the old client had no `close` handler. Use `lib/cdp.mjs`; keep the chunked `readString`; decode via `createImageBitmap`, not `img.src`. |
| `CDP endpoint not ready` | Port blocked by security software, or the browser path is wrong. Try `--browser "C:/.../msedge.exe"`. |
| Boot timeout, blank canvas | Check `window.__MV_BOOT_ERROR`; a failed font/audio fetch can block boot. Run the page normally once. |
| Canvas size warning | The app sizes the canvas from the window. Fix the export canvas size in code, not with flags. |
| Screenshot is black but export is fine | Headless GPU/SwiftShader issue; try `--gl swiftshader`, or use `--mode app`. |
| VMAF runs forever | Use JPEG source frames, not PNG; reduce resolution with `scale` before libvmaf; test on 10 s first. |
| VMAF ≈ 1 / SSIM ≈ 0.75 | Only one reference still was fed instead of the sequence. Use `%06d` with `-start_number`, or pass a reference video. |
| `-vf blackdetect` flags 27 segments | Intentional transitions and fades. Pass `--storyboard` to whitelist `fade`/`dip`/`ink` windows; only unexplained mid-film >0.5 s fails. |
| ffmpeg not found | `FFMPEG="C:/ffmpeg/bin/ffmpeg.exe" bash tools/qa-video.sh ...`; pip `imageio-ffmpeg` ships ffmpeg but **not** ffprobe. |
| drawtext missing | Gyan "essentials" builds sometimes omit it; contact sheets still work without `--label`. |
