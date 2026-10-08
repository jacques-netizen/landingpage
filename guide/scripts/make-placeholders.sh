#!/usr/bin/env bash
# Builds the clearly marked placeholder videos used until the real films exist.
# Source clips are the campaign videos already shown on maisondelites.com.
# Usage: scripts/make-placeholders.sh <dir with source mp4s>
set -euo pipefail
SRC="${1:?source dir}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/media/placeholder"
mkdir -p "$OUT"
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
W=540; H=960
TAG="drawtext=fontfile=$FONT:text='PLACEHOLDER':fontcolor=white@0.35:fontsize=44:x=(w-tw)/2:y=h*0.42"

# Cut one vertical segment from a clip, scaled and cropped to 9:16.
seg() { # in start dur out
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$1" -an \
    -vf "scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,setsar=1,fps=30" \
    -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p "$4"
}

TMP="$(mktemp -d)"
seg "$SRC/walmart-campaign-compressed.mp4" 2 5 "$TMP/a.mp4"
seg "$SRC/wale-video.mp4" 10 5 "$TMP/b.mp4"
seg "$SRC/ssstik.io_kojo.blak_1791327285057.mp4" 3 5 "$TMP/c.mp4"
seg "$SRC/mannywellz-video.mp4" 4 5 "$TMP/d.mp4"
seg "$SRC/ssstik.io_paulamericanclips_1791327535130.mp4" 5 5 "$TMP/e.mp4"
seg "$SRC/walmart-campaign-compressed.mp4" 30 5 "$TMP/f.mp4"

concat() { # out label inputs...
  local out="$1" label="$2"; shift 2
  local list="$TMP/list.txt"; : > "$list"
  for f in "$@"; do echo "file '$f'" >> "$list"; done
  ffmpeg -v error -y -f concat -safe 0 -i "$list" -an \
    -vf "$TAG,drawtext=fontfile=$FONT:text='$label':fontcolor=white@0.35:fontsize=20:x=(w-tw)/2:y=h*0.42+56" \
    -c:v libx264 -preset veryfast -crf 31 -pix_fmt yuv420p -movflags +faststart "$out"
  ffmpeg -v error -y -ss 0.5 -i "$out" -frames:v 1 -q:v 5 "${out%.mp4}.jpg"
}

concat "$OUT/cold_open.mp4" "V0 cold open" "$TMP/a.mp4" "$TMP/b.mp4" "$TMP/c.mp4" "$TMP/d.mp4"
concat "$OUT/chapter1.mp4" "V1 founder film" "$TMP/b.mp4" "$TMP/a.mp4" "$TMP/e.mp4" "$TMP/f.mp4"
concat "$OUT/chapter2.mp4" "V2 proof" "$TMP/a.mp4" "$TMP/c.mp4" "$TMP/d.mp4"
concat "$OUT/result_clipper.mp4" "V4a result clipper" "$TMP/e.mp4" "$TMP/c.mp4"
concat "$OUT/result_creator.mp4" "V4b result creator" "$TMP/d.mp4" "$TMP/b.mp4"
concat "$OUT/result_brand.mp4" "V4c result brand" "$TMP/f.mp4" "$TMP/a.mp4"
rm -rf "$TMP"
ls -la "$OUT"
