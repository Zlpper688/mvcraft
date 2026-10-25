#!/usr/bin/env python3
"""Analyze a song into a music map for mvcraft.

Usage:
  python tools/analyze_audio.py --input song.mp3 --out public/analysis --fps 30
  python tools/analyze_audio.py --input song.flac --no-plots

Outputs:
  analysis.json   duration, fps, tempo, bands, rms, vocal, flux, onsets, sections, silences
  features.png    stacked feature curves (optional)
  waveform.png    waveform + section candidates (optional)
  spectrogram.png log-frequency spectrogram (optional)

Requires: numpy, soundfile, Pillow (optional, for plots)
"""
import argparse
import json
import math
import os
import sys

import numpy as np


def db(x):
    return 20 * np.log10(np.maximum(x, 1e-9))


def norm(x, lo=3.0, hi=99.0):
    a, b = np.percentile(x, lo), np.percentile(x, hi)
    return np.clip((x - a) / (b - a + 1e-9), 0, 1)


def load_audio(path):
    import soundfile as sf

    data, sr = sf.read(path, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    return data, mono, sr


def frame_features(mono, sr, fps, win=4096):
    hop = max(1, int(round(sr / fps)))
    pad = np.pad(mono, (0, win + hop))
    nframes = int(math.floor((len(mono) - 1) / hop)) + 1
    window = np.hanning(win).astype(np.float32)
    freqs = np.fft.rfftfreq(win, 1 / sr)
    band_defs = {
        "sub": (20, 90),
        "low": (90, 250),
        "midlow": (250, 800),
        "mid": (800, 2500),
        "high": (2500, 7000),
        "air": (7000, min(12000, sr / 2 - 1)),
    }
    band_idx = {k: (freqs >= lo) & (freqs < hi) for k, (lo, hi) in band_defs.items()}
    vocal_idx = (freqs >= 300) & (freqs <= 3400)
    cent_idx = (freqs >= 60) & (freqs <= min(12000, sr / 2 - 1))

    rms = np.zeros(nframes)
    bands = {k: np.zeros(nframes) for k in band_defs}
    centroid = np.zeros(nframes)
    flatness = np.zeros(nframes)
    flux = np.zeros(nframes)
    vocal = np.zeros(nframes)
    prev_mag = None
    for i in range(nframes):
        seg = pad[i * hop : i * hop + win] * window
        mag = np.abs(np.fft.rfft(seg))
        p = mag * mag
        rms[i] = np.sqrt(np.mean(seg * seg))
        for k, idx in band_idx.items():
            bands[k][i] = np.sqrt(np.mean(p[idx])) if np.any(idx) else 0.0
        vocal[i] = np.sqrt(np.mean(p[vocal_idx]))
        centroid[i] = np.sum(freqs[cent_idx] * p[cent_idx]) / (np.sum(p[cent_idx]) + 1e-12)
        flatness[i] = np.exp(np.mean(np.log(mag + 1e-8))) / (np.mean(mag) + 1e-8)
        if prev_mag is not None:
            flux[i] = np.sum(np.maximum(0, mag - prev_mag))
        prev_mag = mag
    return nframes, hop, band_defs, rms, bands, centroid, flatness, flux, vocal


def find_silences(rms, fps, db_threshold=-50.0, min_duration=0.2):
    silent = rms < 10 ** (db_threshold / 20)
    runs = []
    start = None
    for i, s in enumerate(silent):
        if s and start is None:
            start = i
        elif not s and start is not None:
            runs.append((start / fps, i / fps))
            start = None
    if start is not None:
        runs.append((start / fps, len(silent) / fps))
    return [(round(a, 2), round(b, 2)) for a, b in runs if b - a >= min_duration]


def find_onsets(flux_n, fps, threshold_percentile=96.0, min_gap=0.16):
    th = np.percentile(flux_n, threshold_percentile)
    onsets = []
    for i in range(1, len(flux_n) - 1):
        if flux_n[i] > th and flux_n[i] >= flux_n[i - 1] and flux_n[i] > flux_n[i + 1]:
            t = i / fps
            if not onsets or t - onsets[-1]["t"] > min_gap:
                onsets.append({"t": round(t, 3), "s": round(float(flux_n[i]), 3)})
    return onsets


def estimate_tempo(flux_n, fps):
    f = flux_n - np.mean(flux_n)
    f = f / (np.std(f) + 1e-9)
    ac = np.correlate(f, f, mode="full")[len(f) - 1 :]
    ac = ac / (ac[0] + 1e-9)
    lags = np.arange(len(ac)) / fps
    valid = (lags > 0.3) & (lags < 1.6)
    if not np.any(valid):
        return 0.0, 0.0
    idx = np.argmax(ac[valid]) + np.argmax(valid)
    return float(60 / lags[idx]), float(ac[idx])


def structure_novelty(bands, band_defs, centroid, flatness, rms, fps, pool_seconds=0.5):
    pool = max(1, int(round(fps * pool_seconds)))
    nframes = len(rms)
    npool = nframes // pool
    if npool < 8:
        return [], []
    feat = []
    for p in range(npool):
        sl = slice(p * pool, (p + 1) * pool)
        v = [float(np.mean(np.log10(bands[k][sl] + 1e-8))) for k in band_defs]
        v += [float(np.mean(centroid[sl])), float(np.mean(flatness[sl])), float(np.mean(rms[sl]))]
        feat.append(v)
    feat = np.array(feat)
    feat = (feat - feat.mean(axis=0)) / (feat.std(axis=0) + 1e-9)
    sim = feat @ feat.T
    sim = sim / (np.linalg.norm(feat, axis=1)[:, None] * np.linalg.norm(feat, axis=1)[None, :] + 1e-9)
    k = min(12, max(2, len(sim) // 4))
    kernel = np.ones((2 * k, 2 * k))
    kernel[:k, :k] = -1
    kernel[k:, k:] = -1
    nov = np.array(
        [
            np.sum(sim[max(0, i - k) : i + k, max(0, i - k) : i + k] * kernel)
            if k <= i < len(sim) - k
            else 0
            for i in range(len(sim))
        ]
    )
    nov = (nov - nov.min()) / (nov.max() - nov.min() + 1e-9)
    novs = np.convolve(nov, np.ones(3) / 3, mode="same")
    peaks = []
    for i in range(2, len(novs) - 2):
        if novs[i] > 0.35 and novs[i] >= novs[i - 1] and novs[i] > novs[i + 1]:
            if not peaks or (i - peaks[-1][0]) * pool_seconds > 6:
                peaks.append((i, float(novs[i])))
    return [round(i * pool_seconds, 1) for i, _ in peaks], peaks


def write_plots(out_dir, dur, nframes, fps, rows, peaks, pool_seconds, silences, mono, sr, win=2048):
    try:
        from PIL import Image, ImageDraw
    except Exception as e:  # pragma: no cover
        print(f"skip plots: {e}")
        return

    W, H = 2000, 1000
    img = Image.new("RGB", (W, H), (11, 16, 38))
    d = ImageDraw.Draw(img)
    top, gap, rowh = 30, 8, 84
    for name, vals, col in rows:
        pts = []
        for x in range(W):
            idx = min(nframes - 1, int(x / W * nframes))
            y = top + rowh - int(vals[idx] * (rowh - 4))
            pts.append((x, y))
        d.line(pts, fill=col, width=2)
        d.text((8, top + 4), name, fill=col)
        top += rowh + gap
    for t in range(0, int(dur) + 1, 10):
        x = int(t / dur * W)
        d.line([(x, 24), (x, H - 20)], fill=(40, 50, 80), width=1)
        d.text((x + 3, H - 18), f"{t // 60}:{t % 60:02d}", fill=(130, 140, 170))
    for i, _ in peaks:
        x = int(i * pool_seconds / dur * W)
        d.line([(x, 24), (x, H - 30)], fill=(210, 70, 70), width=2)
    for a, b in silences:
        xa, xb = int(a / dur * W), int(b / dur * W)
        d.rectangle([xa, 24, xb, H - 30], outline=(255, 220, 120), width=1)
    img.save(os.path.join(out_dir, "features.png"))

    # waveform
    W2, H2 = 2000, 300
    wimg = Image.new("RGB", (W2, H2), (11, 16, 38))
    wd = ImageDraw.Draw(wimg)
    step = max(1, len(mono) // W2)
    for x in range(W2):
        seg = mono[x * step : (x + 1) * step]
        if len(seg) == 0:
            continue
        lo, hi = float(seg.min()), float(seg.max())
        y0 = int((1 - hi) * H2 / 2)
        y1 = int((1 - lo) * H2 / 2)
        wd.line([(x, y0), (x, max(y0 + 1, y1))], fill=(180, 200, 230))
    for i, _ in peaks:
        x = int(i * pool_seconds / dur * W2)
        wd.line([(x, 0), (x, H2)], fill=(210, 70, 70), width=1)
    wimg.save(os.path.join(out_dir, "waveform.png"))

    # spectrogram (log frequency, subsampled)
    try:
        hop = max(1, int(sr / fps))
        n = min(nframes, 1200)
        cols = []
        window = np.hanning(win)
        freqs = np.fft.rfftfreq(win, 1 / sr)
        log_edges = np.geomspace(40, min(12000, sr / 2 - 1), 160)
        for i in range(n):
            start = i * hop
            seg = mono[start : start + win]
            if len(seg) < win:
                seg = np.pad(seg, (0, win - len(seg)))
            mag = np.abs(np.fft.rfft(seg * window))
            vals = []
            for j in range(len(log_edges) - 1):
                idx = (freqs >= log_edges[j]) & (freqs < log_edges[j + 1])
                vals.append(np.mean(mag[idx]) if np.any(idx) else 0)
            cols.append(vals)
        spec = np.array(cols).T
        spec = np.log10(spec + 1e-8)
        spec = (spec - spec.min()) / (spec.max() - spec.min() + 1e-9)
        simg = Image.fromarray((spec[::-1] * 255).astype(np.uint8)).resize((W, H2), Image.BILINEAR)
        simg.save(os.path.join(out_dir, "spectrogram.png"))
    except Exception as e:  # pragma: no cover
        print(f"skip spectrogram: {e}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="audio file (mp3/flac/wav/m4a)")
    ap.add_argument("--out", default="public/analysis", help="output directory")
    ap.add_argument("--fps", type=float, default=30.0, help="analysis frame rate")
    ap.add_argument("--no-plots", action="store_true")
    ap.add_argument("--silence-db", type=float, default=-50.0)
    ap.add_argument("--json-only", action="store_true", help="print JSON to stdout instead of writing")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        sys.exit(f"input not found: {args.input}")
    os.makedirs(args.out, exist_ok=True)

    print(f"loading {args.input}")
    data, mono, sr = load_audio(args.input)
    dur = len(mono) / sr
    peak = float(np.max(np.abs(data)))
    print(f"duration {dur:.3f}s  sr={sr}  channels={data.shape[1]}  peak={peak:.4f}")
    print(f"clipped samples (>0.999): {int(np.sum(np.abs(data) > 0.999))}  dc={float(mono.mean()):.6f}")
    if data.shape[1] == 2:
        corr = float(np.corrcoef(data[:, 0], data[:, 1])[0, 1])
        print(f"stereo correlation: {corr:.4f}")

    nframes, hop, band_defs, rms, bands, centroid, flatness, flux, vocal = frame_features(
        mono, sr, args.fps
    )
    print("analysis frames", nframes)

    rms_n = norm(db(rms), 2, 99.5)
    bands_n = {k: norm(np.log10(v + 1e-8)) for k, v in bands.items()}
    cent_n = np.clip(centroid / 4000, 0, 1)
    flat_n = norm(flatness)
    flux_n = norm(flux)
    vocal_n = norm(np.log10(vocal + 1e-8))

    silences = find_silences(rms, args.fps, args.silence_db)
    print("silence runs:", silences)

    onsets = find_onsets(flux_n, args.fps)
    print(f"onsets: {len(onsets)}")

    tempo, ac = estimate_tempo(flux_n, args.fps)
    print(f"tempo candidate: {tempo:.1f} BPM (ac {ac:.3f})")

    sections, peaks = structure_novelty(bands, band_defs, centroid, flatness, rms, args.fps)
    print("structure candidates:", sections)

    def arr(x, nd=3):
        return [round(float(v), nd) for v in x]

    out = {
        "duration": round(dur, 3),
        "fps": args.fps,
        "bands": {k: arr(v) for k, v in bands_n.items()},
        "rms": arr(rms_n),
        "centroid": arr(cent_n),
        "flatness": arr(flat_n),
        "flux": arr(flux_n),
        "vocal": arr(vocal_n),
        "onsets": onsets,
        "sections": sections,
        "silences": silences,
        "tempo": round(tempo, 2),
    }

    if not args.json_only:
        path = os.path.join(args.out, "analysis.json")
        with open(path, "w", encoding="utf-8") as fp:
            json.dump(out, fp, ensure_ascii=False, separators=(",", ":"))
        print(f"wrote {path} ({os.path.getsize(path) // 1024} KB)")
        if not args.no_plots:
            rows = [
                ("sub", bands_n["sub"], (90, 120, 220)),
                ("low", bands_n["low"], (70, 160, 220)),
                ("midlow", bands_n["midlow"], (90, 200, 180)),
                ("mid", bands_n["mid"], (210, 190, 120)),
                ("high", bands_n["high"], (226, 120, 90)),
                ("air", bands_n["air"], (210, 90, 140)),
                ("rms", rms_n, (240, 240, 240)),
                ("vocal", vocal_n, (255, 200, 90)),
                ("flux", flux_n, (160, 160, 220)),
            ]
            write_plots(
                args.out, dur, nframes, args.fps, rows, peaks, 0.5, silences, mono, sr
            )
            print("wrote features.png / waveform.png / spectrogram.png")
    else:
        print(json.dumps(out, ensure_ascii=False))

    print("\n  time   rms  low  mid high vocal  flat  cent  flux")
    for t in range(0, int(dur), 5):
        i = min(nframes - 1, int(t * args.fps))
        print(
            f"{t // 60}:{t % 60:02d}  {rms_n[i]:.2f} {bands_n['low'][i]:.2f} "
            f"{bands_n['midlow'][i]:.2f} {bands_n['mid'][i]:.2f} {bands_n['high'][i]:.2f} "
            f"{vocal_n[i]:.2f} {flat_n[i]:.2f} {cent_n[i]:.2f} {flux_n[i]:.2f}"
        )


if __name__ == "__main__":
    main()
