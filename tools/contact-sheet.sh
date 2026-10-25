#!/usr/bin/env bash
# Build a contact sheet from a video at chosen timestamps (no ImageMagick).
#
# Usage:
#   bash tools/contact-sheet.sh out/film.mp4 0.5,19.5,44.5,74.5 out/contact.jpg
#   bash tools/contact-sheet.sh out/film.mp4 --every 20 out/animatic.jpg
#   bash tools/contact-sheet.sh out/film.mp4 --count 16 --cols 4 --label out/animatic.jpg
#
# Options:
#   --every <sec>   sample every N seconds
#   --count <n>     sample n evenly spaced frames (default 12 if no times)
#   --cols <n>      columns in the sheet (default 5)
#   --width <px>    width of each tile (default 480)
#   --quality <n>   JPEG quality 2-31 (default 3; lower is better)
#   --label         burn the timestamp into each tile
#
# Set FFMPEG=/path/to/ffmpeg if it is not on PATH.
set -uo pipefail

FFMPEG="${FFMPEG:-ffmpeg}"
POS=()
EVERY=""
COUNT=""
COLS=5
WIDTH=480
QUALITY=3
LABEL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --every) EVERY="${2:-}"; shift 2 ;;
    --count) COUNT="${2:-}"; shift 2 ;;
    --cols) COLS="${2:-5}"; shift 2 ;;
    --width) WIDTH="${2:-480}"; shift 2 ;;
    --quality) QUALITY="${2:-3}"; shift 2 ;;
    --label) LABEL=1; shift ;;
    --help|-h) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --*) echo "unknown option: $1" >&2; exit 2 ;;
    *) POS+=("$1"); shift ;;
  esac
done

VIDEO="${POS[0]:-}"
TIMES="${POS[1]:-}"
OUT="${POS[2]:-}"
if [[ -z "$VIDEO" ]]; then
  echo "usage: bash tools/contact-sheet.sh <video> [times] <out.jpg> [options]" >&2
  exit 2
fi
if [[ ! -f "$VIDEO" ]]; then
  echo "video not found: $VIDEO" >&2; exit 2
fi

if ! command -v "$FFMPEG" >/dev/null 2>&1 && [[ ! -f "$FFMPEG" ]]; then
  for c in "C:/ffmpeg/bin/ffmpeg.exe" "C:/Program Files/ffmpeg/bin/ffmpeg.exe" "C:/ProgramData/chocolatey/bin/ffmpeg.exe"; do
    [[ -f "$c" ]] && { FFMPEG="$c"; break; }
  done
fi
if ! command -v "$FFMPEG" >/dev/null 2>&1 && [[ ! -f "$FFMPEG" ]]; then
  echo "ffmpeg not found; set FFMPEG=/path/to/ffmpeg" >&2; exit 2
fi

# Duration is only needed for --every/--count/default sampling.
DUR=""
if [[ -z "$TIMES" || -n "$EVERY" || -n "$COUNT" ]]; then
  RAW=$("$FFMPEG" -hide_banner -i "$VIDEO" 2>&1 | sed -n 's/.*Duration: \([0-9][0-9:.]*\).*/\1/p' | head -1)
  DUR=$(awk -v t="$RAW" 'BEGIN {
    n = split(t, a, ":"); if (n == 3) printf "%.3f", a[1]*3600 + a[2]*60 + a[3];
    else if (n == 2) printf "%.3f", a[1]*60 + a[2];
  }')
  if [[ -z "$DUR" ]]; then
    echo "cannot read duration; pass explicit times instead" >&2; exit 2
  fi
fi

generate_times() {
  local mode="$1" value="$2" dur="$3"
  awk -v m="$mode" -v v="$value" -v d="$dur" 'BEGIN {
    if (m == "every") {
      if (v <= 0) v = 5;
      n = 0;
      for (t = 0.5; t < d - 0.25; t += v) { printf "%s%.2f", (n++ ? "," : ""), t; }
      if (n == 0) printf "0.5";
    } else {
      n = (v > 0) ? v : 12;
      for (i = 0; i < n; i++) {
        t = (n == 1) ? d / 2 : 0.5 + (d - 1.0) * i / (n - 1);
        printf "%s%.2f", (i ? "," : ""), t;
      }
    }
  }'
}

if [[ -n "$COUNT" ]]; then
  TIMES=$(generate_times count "$COUNT" "$DUR")
elif [[ -n "$EVERY" ]]; then
  TIMES=$(generate_times every "$EVERY" "$DUR")
elif [[ -z "$TIMES" ]]; then
  TIMES=$(generate_times count "" "$DUR")
fi
[[ -z "$OUT" ]] && OUT="${VIDEO%.*}.contact.jpg"

TMP=".contact-$$"
mkdir -p "$TMP" "$(dirname "$OUT")"
cleanup() { [[ "${KEEP_TEMP:-0}" == "1" ]] || rm -rf "$TMP"; }
trap cleanup EXIT

FONT=""
for f in "C:/Windows/Fonts/consola.ttf" "C:/Windows/Fonts/arial.ttf" \
         "/System/Library/Fonts/Supplemental/Arial.ttf" \
         "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" \
         "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"; do
  [[ -f "$f" ]] && { FONT="$f"; break; }
done
FONTSIZE=$(( WIDTH / 28 > 14 ? WIDTH / 28 : 14 ))

# Probe drawtext once; fall back to unlabeled tiles if the build lacks it.
USE_LABEL=$LABEL
if [[ $USE_LABEL -eq 1 ]]; then
  if [[ -z "$FONT" ]]; then
    echo "[WARN] no font found; labels disabled" >&2
    USE_LABEL=0
  else
    # a relative path avoids Windows drive-letter escaping in filter options
    cp "$FONT" "$TMP/font.ttf" && FONT="$TMP/font.ttf"
    "$FFMPEG" -hide_banner -loglevel error -y -f lavfi -i "color=c=black:s=64x64:d=1" \
      -vf "drawtext=fontfile=${FONT}:text='0.0s':fontsize=12:fontcolor=white" \
      -frames:v 1 "$TMP/label-test.jpg" >/dev/null 2>&1
    if [[ ! -s "$TMP/label-test.jpg" ]]; then
      echo "[WARN] drawtext unavailable in this ffmpeg build; labels disabled" >&2
      USE_LABEL=0
    fi
  fi
fi

IFS=',' read -r -a LIST <<< "$TIMES"
N=${#LIST[@]}
ROWS=$(( (N + COLS - 1) / COLS ))
echo "contact sheet: ${N} frames, ${COLS}x${ROWS}, tile width ${WIDTH}px"

idx=0
for t in "${LIST[@]}"; do
  t=$(echo "$t" | tr -d ' ')
  [[ -z "$t" ]] && continue
  idx=$((idx + 1))
  NUM=$(printf '%03d' "$idx")
  VF="scale=${WIDTH}:-2:flags=lanczos"
  if [[ $USE_LABEL -eq 1 ]]; then
    VF="${VF},drawtext=fontfile=${FONT}:text='${t}s':x=12:y=h-${FONTSIZE}-12:fontsize=${FONTSIZE}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6"
  fi
  if ! "$FFMPEG" -hide_banner -loglevel error -y -ss "$t" -i "$VIDEO" -frames:v 1 -vf "$VF" -q:v 2 "$TMP/f${NUM}.jpg" 2> "$TMP/f${NUM}.err"; then
    echo "[WARN] failed at t=${t}s: $(tail -1 "$TMP/f${NUM}.err")" >&2
    idx=$((idx - 1))
  fi
done
N=$idx
if [[ $N -eq 0 ]]; then
  echo "no frames extracted" >&2; exit 1
fi
ROWS=$(( (N + COLS - 1) / COLS ))
# pad the final row by repeating the last frame so tile always completes
TOTAL=$((ROWS * COLS))
LAST=$(printf '%03d' "$N")
while [[ $N -lt $TOTAL ]]; do
  N=$((N + 1))
  cp "$TMP/f${LAST}.jpg" "$TMP/f$(printf '%03d' "$N").jpg"
done

QARGS=()
case "$OUT" in
  *.jpg|*.jpeg|*.JPG|*.JPEG) QARGS=(-q:v "$QUALITY") ;;
esac

"$FFMPEG" -hide_banner -loglevel error -y -framerate 1 -i "$TMP/f%03d.jpg" \
  -vf "tile=${COLS}x${ROWS}:padding=8:margin=8:color=0x0b1026" \
  -frames:v 1 "${QARGS[@]}" "$OUT"
if [[ ! -s "$OUT" ]]; then
  echo "failed to write contact sheet" >&2; exit 1
fi
echo "wrote $OUT  ($(( $(wc -c < "$OUT") / 1024 ))KB)"
