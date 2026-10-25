#!/usr/bin/env bash
# Video QA for the rendered film: container/color, black/freeze/cut detection,
# loudness, and optional VMAF/SSIM against the source frames.
#
# Usage:
#   bash tools/qa-video.sh out/film.mp4 [public/analysis/analysis.json]
#   bash tools/qa-video.sh out/film.mp4 --ref shots/export/frames --storyboard storyboard.json
#   bash tools/qa-video.sh out/film.mp4 --ref frames --ref-fps 24 --min-vmaf 90
#
# Override binaries if they are not on PATH:
#   FFMPEG=/path/to/ffmpeg FFPROBE=/path/to/ffprobe bash tools/qa-video.sh ...
#
# Exit code 1 on hard failures. Report JSON is written next to the film
# (override with --json).
set -uo pipefail

VIDEO="${1:-}"
if [[ -z "$VIDEO" || "$VIDEO" == "--help" || "$VIDEO" == "-h" ]]; then
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi
shift || true
ANALYSIS=""
if [[ $# -gt 0 && "$1" != --* ]]; then
  ANALYSIS="$1"
  shift
fi

REF=""
STORYBOARD=""
REF_FPS=""
REF_START=1
REF_EXT=""
MIN_VMAF=90
MIN_VMAF_MIN=85
MIN_SSIM=0.98
JSON_PATH=""
SKIP_VMAF=0
SKIP_SSIM=0
STRICT=0
ALLOW_FREEZE=0
BLACK_DUR=0.35
FREEZE_DUR=1.0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="${2:-}"; shift 2 ;;
    --storyboard) STORYBOARD="${2:-}"; shift 2 ;;
    --ref-fps) REF_FPS="${2:-}"; shift 2 ;;
    --ref-start) REF_START="${2:-1}"; shift 2 ;;
    --ref-ext) REF_EXT="${2:-}"; shift 2 ;;
    --min-vmaf) MIN_VMAF="${2:-90}"; shift 2 ;;
    --min-vmaf-min) MIN_VMAF_MIN="${2:-85}"; shift 2 ;;
    --min-ssim) MIN_SSIM="${2:-0.98}"; shift 2 ;;
    --json) JSON_PATH="${2:-}"; shift 2 ;;
    --black-dur) BLACK_DUR="${2:-0.35}"; shift 2 ;;
    --freeze-dur) FREEZE_DUR="${2:-1.0}"; shift 2 ;;
    --skip-vmaf) SKIP_VMAF=1; shift ;;
    --skip-ssim) SKIP_SSIM=1; shift ;;
    --strict) STRICT=1; shift ;;
    --allow-freeze) ALLOW_FREEZE=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ -f "$VIDEO" ]] || { echo "video not found: $VIDEO" >&2; exit 2; }

find_tool() {
  local name="$1" env_val="$2"
  if [[ -n "$env_val" ]]; then
    if [[ -x "$env_val" || "$env_val" == */* || "$env_val" == *\\* ]]; then
      [[ -f "$env_val" ]] && { printf '%s' "$env_val"; return 0; }
    else
      command -v "$env_val" >/dev/null 2>&1 && { command -v "$env_val"; return 0; }
    fi
  fi
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  local c
  for c in \
    "C:/ffmpeg/bin/$name.exe" \
    "C:/Program Files/ffmpeg/bin/$name.exe" \
    "C:/ProgramData/chocolatey/bin/$name.exe" \
    "/opt/homebrew/bin/$name" \
    "/usr/local/bin/$name"; do
    [[ -f "$c" ]] && { printf '%s' "$c"; return 0; }
  done
  local pybin
  if [[ "$name" == "ffmpeg" ]]; then
    pybin=$(ls -1 "$LOCALAPPDATA"/Programs/Python/*/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-*.exe 2>/dev/null | head -1)
    [[ -n "$pybin" ]] && { printf '%s' "$pybin"; return 0; }
  fi
  return 1
}

FFMPEG=$(find_tool ffmpeg "${FFMPEG:-}") || { echo "ffmpeg not found; set FFMPEG=/path/to/ffmpeg" >&2; exit 2; }
FFPROBE=$(find_tool ffprobe "${FFPROBE:-}") || {
  echo "ffprobe not found; set FFPROBE=/path/to/ffprobe" >&2
  echo "hint: ffprobe normally ships with ffmpeg builds (not with pip imageio-ffmpeg)" >&2
  exit 2
}

TMP=".qa-$$"
mkdir -p "$TMP"
cleanup() { [[ "${KEEP_TEMP:-0}" == "1" ]] || rm -rf "$TMP"; }
trap cleanup EXIT
FAIL=0
: > "$TMP/failures.txt"
: > "$TMP/warnings.txt"

fail() { echo "[FAIL] $*"; echo "$*" >> "$TMP/failures.txt"; FAIL=1; }
warn() { echo "[WARN] $*"; echo "$*" >> "$TMP/warnings.txt"; }
info() { echo "[INFO] $*"; }

probe_v() { "$FFPROBE" -v error -select_streams v:0 -show_entries "stream=$1" -of default=nw=1:nk=1 "$VIDEO" 2>/dev/null | head -1 | tr -d '\r'; }
probe_a() { "$FFPROBE" -v error -select_streams a:0 -show_entries "stream=$1" -of default=nw=1:nk=1 "$VIDEO" 2>/dev/null | head -1 | tr -d '\r'; }
probe_f() { "$FFPROBE" -v error -show_entries "format=$1" -of default=nw=1:nk=1 "$VIDEO" 2>/dev/null | head -1 | tr -d '\r'; }
# Some ffprobe builds cannot read still images (stripped demuxers). Fall back to
# ffmpeg's input banner, which always knows the frame size.
set_ref_size() {
  local f="$1" s
  s=$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$f" 2>/dev/null | head -1 | tr -d '\r')
  if [[ ! "$s" =~ ^[0-9]+x[0-9]+$ ]]; then
    s=$("$FFMPEG" -hide_banner -i "$f" 2>&1 | sed -n 's/.*Video: .*[^0-9]\([0-9][0-9]*x[0-9][0-9]*\).*/\1/p' | head -1)
  fi
  [[ "$s" =~ ^([0-9]+)x([0-9]+)$ ]] || return 1
  REF_W="${BASH_REMATCH[1]}"
  REF_H="${BASH_REMATCH[2]}"
}

W=$(probe_v width)
H=$(probe_v height)
VCODEC=$(probe_v codec_name)
PIX_FMT=$(probe_v pix_fmt)
COLOR_RANGE=$(probe_v color_range)
COLOR_SPACE=$(probe_v color_space)
FPS_RAW=$(probe_v avg_frame_rate)
DUR=$(probe_f duration)
SIZE=$(probe_f size)
BITRATE=$(probe_f bit_rate)
ACODEC=$(probe_a codec_name)
ASR=$(probe_a sample_rate)
ACH=$(probe_a channels)
ADUR=$(probe_a duration)

if [[ -z "$DUR" || "$DUR" == "N/A" ]]; then
  echo "cannot read duration (is this a valid video?)" >&2
  exit 2
fi
FPS=$(awk -v r="$FPS_RAW" 'BEGIN { split(r,a,"/"); if (a[2] == 0 || a[2] == "") print "0"; else printf "%.3f", a[1]/a[2] }')
[[ "$FPS" == "0" || -z "$FPS" ]] && FPS=$(probe_v r_frame_rate | awk -F/ '{printf "%.3f", $1/($2?$2:1)}')
FRAMES=$(awk -v d="$DUR" -v f="$FPS" 'BEGIN { printf "%d", d*f }')
NB_FRAMES=$(probe_v nb_frames)
[[ -n "$NB_FRAMES" && "$NB_FRAMES" != "N/A" ]] && FRAMES="$NB_FRAMES"
[[ -z "$JSON_PATH" ]] && JSON_PATH="${VIDEO%.*}.qa.json"
REF_IN=()
REF_W=""
REF_H=""
REF_EXT_ACTUAL=""

echo "=== mvcraft video QA ==="
info "file      $VIDEO"
info "video     ${W}x${H}  ${FPS}fps  ${VCODEC} ${PIX_FMT}  range=${COLOR_RANGE:-?} matrix=${COLOR_SPACE:-?}"
info "audio     ${ACODEC:-none} ${ASR:-?}Hz ${ACH:-?}ch  dur=${ADUR:-?}s"
info "duration  ${DUR}s  ~${FRAMES} frames  $(( ${SIZE:-0} / 1024 / 1024 ))MB"

# --- container / color -------------------------------------------------------
if [[ "$PIX_FMT" == yuvj* ]]; then
  fail "pixel format $PIX_FMT is full-range JPEG-style; convert with scale=in_range=full:out_range=limited and format=yuv420p"
elif [[ "$PIX_FMT" != "yuv420p" && "$PIX_FMT" != "yuv420p10le" ]]; then
  warn "pixel format is $PIX_FMT; delivery spec expects yuv420p"
fi
if [[ "$COLOR_RANGE" != "tv" ]]; then
  warn "color_range=${COLOR_RANGE:-unknown}; tag it with -color_range tv"
fi
if [[ "$COLOR_SPACE" != "bt709" ]]; then
  warn "color_space=${COLOR_SPACE:-unknown}; tag BT.709 explicitly"
fi
if [[ -n "$ADUR" && "$ADUR" != "N/A" ]]; then
  AV_DIFF=$(awk -v v="$DUR" -v a="$ADUR" 'BEGIN { d=v-a; if (d<0) d=-d; printf "%.3f", d }')
  if awk -v d="$AV_DIFF" 'BEGIN { exit !(d > 0.5) }'; then
    fail "video/audio duration differ by ${AV_DIFF}s (use -shortest)"
  elif awk -v d="$AV_DIFF" 'BEGIN { exit !(d > 0.1) }'; then
    warn "video/audio duration differ by ${AV_DIFF}s"
  fi
fi
if [[ -n "$ANALYSIS" ]]; then
  if [[ ! -f "$ANALYSIS" ]]; then
    warn "analysis file not found: $ANALYSIS"
  else
    A_DUR=$(grep -o '"duration"[[:space:]]*:[[:space:]]*[0-9.]*' "$ANALYSIS" | head -1 | grep -o '[0-9.]*$')
    if [[ -n "$A_DUR" ]]; then
      D_DIFF=$(awk -v v="$DUR" -v a="$A_DUR" 'BEGIN { d=v-a; if (d<0) d=-d; printf "%.3f", d }')
      if awk -v d="$D_DIFF" 'BEGIN { exit !(d > 0.5) }'; then
        fail "film duration ${DUR}s differs from analysis ${A_DUR}s by ${D_DIFF}s"
      elif awk -v d="$D_DIFF" 'BEGIN { exit !(d > 0.1) }'; then
        warn "film duration differs from analysis by ${D_DIFF}s"
      else
        info "duration matches analysis (${A_DUR}s)"
      fi
    fi
  fi
fi

# Registered fade/dip/ink transitions may legitimately go to black. The engine
# centers a transition on the incoming shot start (a = start - dur/2).
: > "$TMP/transitions.txt"
if [[ -n "$STORYBOARD" ]]; then
  if [[ ! -f "$STORYBOARD" ]]; then
    warn "storyboard not found: $STORYBOARD"
  else
    node -e '
      const fs = require("fs");
      try {
        const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const rows = [];
        (j.shots || []).forEach((s, i) => {
          const tr = s.transitionIn;
          if (!tr || !["fade", "dip", "ink"].includes(tr.type)) return;
          const d = Number(tr.duration || 0);
          if (!(d > 0)) return;
          const a = Math.max(0, Number(s.start) - (i === 0 ? d : d / 2));
          const b = Number(s.start) + d / 2;
          rows.push([a, b]);
        });
        console.log(rows.map(r => r.map(x => x.toFixed(3)).join(" ")).join("\n"));
      } catch (e) {
        console.error(e.message);
        process.exit(1);
      }
    ' "$STORYBOARD" > "$TMP/transitions.txt" || warn "could not parse storyboard transitions"
    TRANS_N=$(wc -l < "$TMP/transitions.txt" | tr -d ' ')
    [[ "$TRANS_N" -gt 0 ]] && info "registered transitions: ${TRANS_N} (fade/dip/ink)"
  fi
fi

# --- black frames ------------------------------------------------------------
"$FFMPEG" -hide_banner -nostats -i "$VIDEO" -map 0:v:0 -vf "blackdetect=d=${BLACK_DUR}:pix_th=0.10" -an -f null - 2> "$TMP/black.txt"
sed -n 's/.*black_start:\([0-9.]*\) black_end:\([0-9.]*\) black_duration:\([0-9.]*\).*/\1 \2 \3/p' "$TMP/black.txt" > "$TMP/black_segments.txt"
BLACK_ALL=$(wc -l < "$TMP/black_segments.txt" | tr -d ' ')
BLACK_MID=0
while read -r bs be bd; do
  [[ -z "$bs" ]] && continue
  # a fade from/to black at the very start/end is intentional
  if awk -v s="$bs" -v e="$be" -v d="$DUR" 'BEGIN { exit !(s < 1.0 || e > d - 1.0) }'; then
    info "black segment ${bs}-${be}s (edge, ignored)"
    continue
  fi
  registered=0
  if [[ -s "$TMP/transitions.txt" ]]; then
    while read -r ta tb; do
      [[ -z "$ta" ]] && continue
      if awk -v s="$bs" -v e="$be" -v a="$ta" -v b="$tb" 'BEGIN {
        ov = (e < b ? e : b) - (s > a ? s : a);
        if (ov < 0) ov = 0;
        dur = e - s;
        exit !(dur > 0 && ov / dur > 0.6);
      }'; then
        registered=1
        break
      fi
    done < "$TMP/transitions.txt"
  fi
  if [[ $registered -eq 1 ]]; then
    info "black segment ${bs}-${be}s (registered transition, ignored)"
  elif awk -v d="$bd" 'BEGIN { exit !(d > 0.5) }'; then
    fail "black segment ${bs}-${be}s (${bd}s) in the middle and not a registered transition"
    BLACK_MID=$((BLACK_MID + 1))
  else
    info "black segment ${bs}-${be}s (${bd}s, short)"
  fi
done < "$TMP/black_segments.txt"
info "black segments: ${BLACK_ALL} total, ${BLACK_MID} unexplained mid-film"
if [[ $BLACK_MID -gt 0 && -z "$STORYBOARD" ]]; then
  warn "pass --storyboard storyboard.json so registered fade/dip transitions are not false alarms"
fi

# --- freeze ------------------------------------------------------------------
"$FFMPEG" -hide_banner -nostats -i "$VIDEO" -map 0:v:0 -vf "freezedetect=n=-60dB:d=${FREEZE_DUR}" -an -f null - 2> "$TMP/freeze.txt"
awk '
  /freeze_start/ { s=$NF }
  /freeze_duration/ { d=$NF }
  /freeze_end/ { printf "%.3f %.3f %.3f\n", s, $NF, d; s=""; d="" }
  END { if (s != "" && d != "") printf "%.3f %.3f %.3f\n", s, s+d, d }
' "$TMP/freeze.txt" > "$TMP/freeze_segments.txt"
FREEZE_N=$(wc -l < "$TMP/freeze_segments.txt" | tr -d ' ')
while read -r fs fe fd; do
  [[ -z "$fs" ]] && continue
  if awk -v d="$fd" 'BEGIN { exit !(d > 1.0) }'; then
    if [[ $ALLOW_FREEZE -eq 1 ]]; then
      warn "freeze ${fs}-${fe}s (${fd}s) allowed by --allow-freeze"
    else
      fail "freeze ${fs}-${fe}s (${fd}s) — moving grain/vignette or a real animation is missing"
    fi
  else
    warn "freeze ${fs}-${fe}s (${fd}s)"
  fi
done < "$TMP/freeze_segments.txt"
info "freeze segments: ${FREEZE_N}"

# --- scene cuts --------------------------------------------------------------
"$FFMPEG" -hide_banner -nostats -i "$VIDEO" -map 0:v:0 -vf "scdet=threshold=10" -an -f null - 2> "$TMP/scd.txt"
sed -n 's/.*lavfi.scd.score: *\([0-9.]*\).*lavfi.scd.time: *\([0-9.]*\).*/\2 \1/p' "$TMP/scd.txt" > "$TMP/cuts.txt"
CUTS=$(wc -l < "$TMP/cuts.txt" | tr -d ' ')
info "scene cuts detected: ${CUTS}"
sort -k2 -nr "$TMP/cuts.txt" | head -5 | awk '{ printf "  cut t=%.2fs score=%s\n", $1, $2 }'

# --- loudness ----------------------------------------------------------------
LUFS=""
TP=""
LRA=""
if [[ -n "$ACODEC" ]]; then
  "$FFMPEG" -hide_banner -nostats -i "$VIDEO" -map 0:a:0 -af "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json" -f null - 2> "$TMP/loud.txt"
  LUFS=$(sed -n 's/.*"input_i"[[:space:]]*:[[:space:]]*"\([-0-9.]*\)".*/\1/p' "$TMP/loud.txt" | tail -1 | tr -d '\r')
  TP=$(sed -n 's/.*"input_tp"[[:space:]]*:[[:space:]]*"\([-0-9.]*\)".*/\1/p' "$TMP/loud.txt" | tail -1 | tr -d '\r')
  LRA=$(sed -n 's/.*"input_lra"[[:space:]]*:[[:space:]]*"\([-0-9.]*\)".*/\1/p' "$TMP/loud.txt" | tail -1 | tr -d '\r')
  if [[ -n "$LUFS" ]]; then
    info "loudness  ${LUFS} LUFS  true peak ${TP} dBTP  LRA ${LRA} LU"
    if awk -v i="$LUFS" 'BEGIN { exit !(i > -12 || i < -16) }'; then
      fail "integrated loudness ${LUFS} LUFS outside -16..-12 (target -14 ±1)"
    elif awk -v i="$LUFS" 'BEGIN { exit !(i > -13 || i < -15) }'; then
      warn "integrated loudness ${LUFS} LUFS outside -15..-13 (target -14 ±1)"
    fi
    if [[ -n "$TP" ]]; then
      if awk -v p="$TP" 'BEGIN { exit !(p > -0.5) }'; then
        fail "true peak ${TP} dBTP is too close to 0; leave at least 1 dB"
      elif awk -v p="$TP" 'BEGIN { exit !(p > -1.0) }'; then
        warn "true peak ${TP} dBTP above -1 dBTP"
      fi
    fi
    if [[ -n "$LRA" ]] && awk -v l="$LRA" 'BEGIN { exit !(l < 3 || l > 20) }'; then
      warn "LRA ${LRA} LU is unusual (3-15 expected for a song)"
    fi
  else
    warn "loudnorm did not produce a measurement"
  fi
else
  warn "no audio stream"
fi

# --- VMAF / SSIM -------------------------------------------------------------
VMAF_MEAN=""
VMAF_MIN=""
VMAF_HARM=""
SSIM=""
if [[ -n "$REF" && $SKIP_VMAF -eq 0 ]]; then
  if [[ -d "$REF" ]]; then
    FIRST=$(ls "$REF"/$(printf '%06d' "$REF_START").* 2>/dev/null | head -1)
    if [[ -z "$FIRST" ]]; then
      fail "no reference frames like $(printf '%06d' "$REF_START").* in $REF (use --ref-start/--ref-ext)"
    else
      REF_EXT_ACTUAL="${REF_EXT:-${FIRST##*.}}"
      REF_IN=(-framerate "${REF_FPS:-$FPS}" -start_number "$REF_START" -i "$REF/%06d.${REF_EXT_ACTUAL}")
      set_ref_size "$FIRST" || fail "cannot read reference frame size: $FIRST"
    fi
  elif [[ -f "$REF" ]]; then
    REF_IN=(-i "$REF")
    set_ref_size "$REF" || fail "cannot read reference size: $REF"
  else
    fail "reference not found: $REF"
  fi
fi

if [[ ${#REF_IN[@]} -gt 0 && -n "$REF_W" ]]; then
  VMAF_LOG="$TMP/vmaf.json"
  if [[ "$W" != "$REF_W" || "$H" != "$REF_H" ]]; then
    warn "reference is ${REF_W}x${REF_H}, film is ${W}x${H}; scaling film for metrics"
    FILTER_V="[0:v]setpts=PTS-STARTPTS,scale=${REF_W}:${REF_H}:flags=bicubic,format=yuv420p[d];[1:v]setpts=PTS-STARTPTS,format=yuv420p[r];[d][r]libvmaf=log_fmt=json:log_path=${VMAF_LOG}:n_threads=4"
    FILTER_S="[0:v]setpts=PTS-STARTPTS,scale=${REF_W}:${REF_H}:flags=bicubic,format=yuv420p[d];[1:v]setpts=PTS-STARTPTS,format=yuv420p[r];[d][r]ssim"
  else
    FILTER_V="[0:v]setpts=PTS-STARTPTS,format=yuv420p[d];[1:v]setpts=PTS-STARTPTS,format=yuv420p[r];[d][r]libvmaf=log_fmt=json:log_path=${VMAF_LOG}:n_threads=4"
    FILTER_S="[0:v]setpts=PTS-STARTPTS,format=yuv420p[d];[1:v]setpts=PTS-STARTPTS,format=yuv420p[r];[d][r]ssim"
  fi
  info "VMAF pass (may take a while)..."
  if "$FFMPEG" -hide_banner -nostats -i "$VIDEO" "${REF_IN[@]}" -lavfi "$FILTER_V" -f null - 2> "$TMP/vmaf_err.txt"; then
    VMAF_LINE=$(node -e '
      const fs = require("fs");
      try {
        const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const v = j.pooled_metrics && j.pooled_metrics.vmaf;
        if (!v) process.exit(2);
        const n = Array.isArray(j.frames) ? j.frames.length : 0;
        console.log([v.mean, v.min, v.harmonic_mean].map(x => Number(x).toFixed(2)).join(" ") + " " + n);
      } catch (e) { process.exit(2); }
    ' "$VMAF_LOG" 2>/dev/null)
    if [[ -n "$VMAF_LINE" ]]; then
      read -r VMAF_MEAN VMAF_MIN VMAF_HARM VMAF_FRAMES <<< "$VMAF_LINE"
      info "VMAF      mean ${VMAF_MEAN}  min ${VMAF_MIN}  harmonic ${VMAF_HARM}  frames ${VMAF_FRAMES}"
      if [[ -n "$VMAF_FRAMES" && "$VMAF_FRAMES" -gt 0 ]]; then
        VMAF_SKIP=$(awk -v a="$VMAF_FRAMES" -v b="$FRAMES" 'BEGIN { d=a-b; if (d<0) d=-d; printf "%d", d }')
        if [[ "$VMAF_SKIP" -gt 2 ]]; then
          warn "VMAF compared ${VMAF_FRAMES} frames, expected ~${FRAMES}; check --ref-fps/--ref-start"
        fi
      fi
      if awk -v v="$VMAF_MEAN" -v t="$MIN_VMAF" 'BEGIN { exit !(v < t) }'; then
        fail "VMAF mean ${VMAF_MEAN} < ${MIN_VMAF}"
      fi
      if awk -v v="$VMAF_MIN" -v t="$MIN_VMAF_MIN" 'BEGIN { exit !(v < t) }'; then
        fail "VMAF min ${VMAF_MIN} < ${MIN_VMAF_MIN}"
      fi
    else
      warn "VMAF ran but the log could not be parsed (see $TMP/vmaf_err.txt)"
    fi
  else
    warn "VMAF failed; last lines:"
    tail -5 "$TMP/vmaf_err.txt" | sed 's/^/  /'
  fi
  if [[ $SKIP_SSIM -eq 0 ]]; then
    info "SSIM pass..."
    if "$FFMPEG" -hide_banner -nostats -i "$VIDEO" "${REF_IN[@]}" -lavfi "$FILTER_S" -f null - 2> "$TMP/ssim_err.txt"; then
      SSIM=$(sed -n 's/.*All:\([0-9.]*\).*/\1/p' "$TMP/ssim_err.txt" | tail -1 | tr -d '\r')
      if [[ -n "$SSIM" ]]; then
        info "SSIM      ${SSIM}"
        if awk -v s="$SSIM" -v t="$MIN_SSIM" 'BEGIN { exit !(s < t) }'; then
          fail "SSIM ${SSIM} < ${MIN_SSIM}"
        fi
      else
        warn "SSIM ran but could not be parsed"
      fi
    else
      warn "SSIM failed"
    fi
  fi
fi

# --- report ------------------------------------------------------------------
json_array() {
  awk 'BEGIN { printf "[" } {
    gsub(/\\/, "\\\\"); gsub(/"/, "\\\"");
    if (NR > 1) printf ",";
    printf "\"%s\"", $0;
  } END { printf "]" }' "$1"
}
json_segments() {
  awk 'BEGIN { s="" } {
    if (s != "") s = s ",";
    s = s sprintf("{\"start\":%.3f,\"end\":%.3f,\"duration\":%.3f}", $1, $2, $3);
  } END { printf "%s", s }' "$1"
}
json_cuts() {
  sort -k2 -nr "$1" | head -10 | awk 'BEGIN { s="" } {
    if (s != "") s = s ",";
    s = s sprintf("{\"time\":%.3f,\"score\":%.2f}", $1, $2);
  } END { printf "%s", s }'
}
json_ranges() {
  awk 'BEGIN { s="" } {
    if (s != "") s = s ",";
    s = s sprintf("[%.3f,%.3f]", $1, $2);
  } END { printf "%s", s }' "$1"
}
jnum() { [[ -n "$1" ]] && printf '%s' "$1" || printf 'null'; }
jstr() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

VERDICT="pass"
[[ -s "$TMP/warnings.txt" ]] && VERDICT="warn"
[[ $FAIL -eq 1 ]] && VERDICT="fail"
mkdir -p "$(dirname "$JSON_PATH")"
cat > "$JSON_PATH" <<EOF
{
  "film": "$(jstr "$VIDEO")",
  "duration": $(jnum "$DUR"),
  "frames": $(jnum "$FRAMES"),
  "fps": $(jnum "$FPS"),
  "resolution": [$(jnum "$W"), $(jnum "$H")],
  "video": { "codec": "$(jstr "$VCODEC")", "pixFmt": "$(jstr "$PIX_FMT")", "colorRange": "$(jstr "$COLOR_RANGE")", "colorSpace": "$(jstr "$COLOR_SPACE")", "bitrate": $(jnum "$BITRATE") },
  "audio": { "codec": "$(jstr "$ACODEC")", "sampleRate": $(jnum "$ASR"), "channels": $(jnum "$ACH"), "duration": $(jnum "$ADUR") },
  "loudness": { "lufs": $(jnum "$LUFS"), "truePeak": $(jnum "$TP"), "lra": $(jnum "$LRA") },
  "storyboard": "$(jstr "$STORYBOARD")",
  "temporal": {
    "blackSegments": [$(json_segments "$TMP/black_segments.txt")],
    "freezeSegments": [$(json_segments "$TMP/freeze_segments.txt")],
    "registeredTransitions": [$(json_ranges "$TMP/transitions.txt")],
    "sceneCuts": $(jnum "$CUTS"),
    "topCuts": [$(json_cuts "$TMP/cuts.txt")]
  },
  "encode": { "vmafMean": $(jnum "$VMAF_MEAN"), "vmafMin": $(jnum "$VMAF_MIN"), "vmafHarmonic": $(jnum "$VMAF_HARM"), "ssim": $(jnum "$SSIM") },
  "failures": $(json_array "$TMP/failures.txt"),
  "warnings": $(json_array "$TMP/warnings.txt"),
  "verdict": "$VERDICT"
}
EOF

echo
if [[ $FAIL -eq 1 ]]; then
  echo "VERDICT: FAIL"
  sed 's/^/  - /' "$TMP/failures.txt"
elif [[ -s "$TMP/warnings.txt" ]]; then
  echo "VERDICT: WARN"
  sed 's/^/  - /' "$TMP/warnings.txt"
else
  echo "VERDICT: PASS"
fi
echo "report: $JSON_PATH"
exit $FAIL
