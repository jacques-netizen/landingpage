#!/usr/bin/env bash
# Builds the six films from the campaign clips already shown on
# maisondelites.com: vertical, clean, no watermark. With MUSIC set to an audio
# file, the track is laid under every film (faded in and out, trimmed to the
# film). Without it the films are silent.
# Usage: MUSIC=/path/track.mp3 scripts/make-films.sh <dir with source mp4s>
set -euo pipefail
SRC="${1:?source dir}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/media/films"
mkdir -p "$OUT"
W=720; H=1280
MUSIC="${MUSIC:-}"

# Cut one vertical segment from a clip, scaled and cropped to 9:16.
seg() { # in start dur out
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$1" -an \
    -vf "scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,setsar=1,fps=30" \
    -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "$4"
}

TMP="$(mktemp -d)"
seg "$SRC/walmart-campaign-compressed.mp4" 2 5 "$TMP/a.mp4"
seg "$SRC/wale-video.mp4" 10 5 "$TMP/b.mp4"
seg "$SRC/ssstik.io_kojo.blak_1791327285057.mp4" 3 5 "$TMP/c.mp4"
seg "$SRC/mannywellz-video.mp4" 4 5 "$TMP/d.mp4"
seg "$SRC/ssstik.io_paulamericanclips_1791327535130.mp4" 5 5 "$TMP/e.mp4"
seg "$SRC/walmart-campaign-compressed.mp4" 30 5 "$TMP/f.mp4"

film() { # out inputs...
  local out="$1"; shift
  local list="$TMP/list.txt"; : > "$list"
  for f in "$@"; do echo "file '$f'" >> "$list"; done
  local silent="$TMP/silent.mp4"
  ffmpeg -v error -y -f concat -safe 0 -i "$list" -an -c:v libx264 -preset medium -crf 25 -pix_fmt yuv420p -movflags +faststart "$silent"
  if [ -n "$MUSIC" ]; then
    local dur
    dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$silent")"
    # Music under the film: level to about -18 LUFS, fade in 1s, fade out 2s, cut at the film's end.
    ffmpeg -v error -y -i "$silent" -stream_loop -1 -i "$MUSIC" -shortest \
      -filter_complex "[1:a]loudnorm=I=-18:TP=-1.5:LRA=11,afade=t=in:st=0:d=1,afade=t=out:st=$(echo "$dur - 2" | bc):d=2[a]" \
      -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k -t "$dur" -movflags +faststart "$out"
  else
    cp "$silent" "$out"
  fi
  ffmpeg -v error -y -ss 0.5 -i "$out" -frames:v 1 -q:v 4 "${out%.mp4}.jpg"
}

film "$OUT/cold_open.mp4" "$TMP/a.mp4" "$TMP/b.mp4" "$TMP/c.mp4" "$TMP/d.mp4"
film "$OUT/chapter1.mp4" "$TMP/b.mp4" "$TMP/a.mp4" "$TMP/e.mp4" "$TMP/f.mp4"
film "$OUT/chapter2.mp4" "$TMP/a.mp4" "$TMP/c.mp4" "$TMP/d.mp4"
film "$OUT/result_clipper.mp4" "$TMP/e.mp4" "$TMP/c.mp4"
film "$OUT/result_creator.mp4" "$TMP/d.mp4" "$TMP/b.mp4"
film "$OUT/result_brand.mp4" "$TMP/f.mp4" "$TMP/a.mp4"
rm -rf "$TMP"
ls -la "$OUT"
