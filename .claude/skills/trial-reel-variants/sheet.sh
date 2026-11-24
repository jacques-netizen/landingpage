#!/usr/bin/env bash
# Contact sheet: N frames (default 18) with timestamps, tiled 6 wide.
# usage: bash sheet.sh IN OUT.jpg [N]
set -euo pipefail
IN="$1"; OUT="$2"; N="${3:-18}"
FF="${FFMPEG:-ffmpeg}"; FP="${FFPROBE:-ffprobe}"
D=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$IN")
R=$(awk -v n="$N" -v d="$D" 'BEGIN{printf "%.4f", n/d}')
ROWS=$(( (N+5)/6 ))
"$FF" -v error -y -i "$IN" -vf "fps=$R,scale=360:-2,drawtext=text='%{pts\:hms}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6,tile=6x$ROWS" -frames:v 1 "$OUT" && echo "sheet $OUT"
