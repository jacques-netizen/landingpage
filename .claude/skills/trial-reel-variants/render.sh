#!/usr/bin/env bash
# Render one trial-reel variant.
# usage: bash render.sh IN OUT VERSION [UNMIRROR_FROM_FRAME]
#   VERSION 1..12 picks a preset row (see SKILL.md).
#   UNMIRROR_FROM_FRAME: optional. Mirrored versions switch back to normal from this
#   frame on (continuous take with readable text near the end).
# Keeps the source resolution (odd sizes rounded down to even; 4:3 sources scaled to 1080 wide).
set -euo pipefail
IN="$1"; OUT="$2"; V="$3"; SW="${4:-}"
FF="${FFMPEG:-ffmpeg}"; FP="${FFPROBE:-ffprobe}"

read -r SW_ SH_ < <("$FP" -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$IN" | tr x ' ')
W=$SW_; H=$SH_
# 4:3 sources (e.g. 1112x834) become 1080 wide
R1000=$((W*1000/H)); if [ $R1000 -ge 1320 ] && [ $R1000 -le 1350 ]; then H=$((1080*H/W)); W=1080; fi
W=$((W/2*2)); H=$((H/2*2))
HAS_AUDIO=$("$FP" -v error -select_streams a -show_entries stream=index -of csv=p=0 "$IN" | head -1)

# flip|crop|x|y|speed|grade|fps
case "$V" in
 1) P="1|0.95|(iw-ow)/2|(ih-oh)/2|1.03|eq=saturation=1.08:contrast=1.03:brightness=0.01,noise=alls=3:allf=t|24";;
 2) P="0|0.92|iw*0.03|ih*0.02|0.97|colorbalance=rs=0.04:bs=-0.04:rm=0.03:bm=-0.03,eq=saturation=1.05,vignette=PI/5,noise=alls=2:allf=t|24";;
 3) P="1|0.94|iw*0.06|ih*0.04|1.05|colorbalance=rs=-0.03:bs=0.04:bm=0.02,eq=contrast=1.05:brightness=-0.01,unsharp=5:5:0.6,noise=alls=3:allf=t|25";;
 4) P="0|0.90|(iw-ow)/2|(ih-oh)/2|1.02|eq=saturation=0.92:contrast=1.08:gamma=0.97,noise=alls=5:allf=t|30";;
 5) P="1|0.91|iw*0.02|ih*0.07|0.98|colorbalance=rh=0.03:bh=-0.02:bs=0.03,eq=saturation=1.12:gamma=1.03,noise=alls=4:allf=t|24";;
 6) P="0|0.93|iw*0.07|ih*0.01|1.04|rotate=0.8*PI/180:ow=iw:oh=ih,crop=iw*0.97:ih*0.97,scale=$W:$H,colorbalance=rs=-0.02:gs=0.02:bs=0.03,eq=contrast=1.06:saturation=0.97,noise=alls=3:allf=t|30";;
 7) P="1|0.89|(iw-ow)/2|ih*0.03|0.96|colorbalance=rm=0.04:gm=0.01:bm=-0.04,eq=contrast=0.97:brightness=0.02:saturation=1.03,vignette=PI/4,noise=alls=2:allf=t|25";;
 8) P="0|0.95|iw*0.01|ih*0.05|1.06|rotate=-0.7*PI/180:ow=iw:oh=ih,crop=iw*0.97:ih*0.97,scale=$W:$H,eq=saturation=1.15:contrast=1.04:gamma=0.98,unsharp=3:3:0.4,noise=alls=4:allf=t|24";;
 9) P="1|0.88|iw*0.10|ih*0.05|1.01|colorbalance=rs=0.02:gs=-0.01:bh=0.03,eq=contrast=1.04:saturation=1.10:brightness=-0.015,noise=alls=3:allf=t|30";;
10) P="0|0.94|0|0|0.99|rotate=-1.0*PI/180:ow=iw:oh=ih,crop=iw*0.96:ih*0.96,scale=$W:$H,colorbalance=rm=0.03:bm=0.03:gm=-0.02,eq=saturation=1.06:gamma=1.02,vignette=PI/6,noise=alls=4:allf=t|25";;
11) P="1|0.93|0|ih*0.07|1.07|rotate=0.6*PI/180:ow=iw:oh=ih,crop=iw*0.97:ih*0.97,scale=$W:$H,colorbalance=rs=-0.04:bs=0.05:rh=0.02,eq=contrast=1.07:saturation=0.95,noise=alls=2:allf=t|24";;
12) P="0|0.87|iw*0.05|ih*0.10|0.95|colorbalance=rh=0.04:gh=0.02:bs=-0.03,eq=saturation=1.18:contrast=1.02:brightness=0.02,unsharp=3:3:0.5,noise=alls=5:allf=t|30";;
 *) [ -n "${PRESET:-}" ] || { echo "version $V: set PRESET='flip|crop|x|y|speed|grade|fps'"; exit 1; }; P="$PRESET";;
esac
IFS='|' read -r FLIP CROP X Y SPEED GRADE FPS <<<"$P"

if [ "$FLIP" = 1 ]; then FL=hflip; else FL=null; fi
POST="crop=iw*$CROP:ih*$CROP:$X:$Y,scale=$W:$H,setsar=1,$GRADE,setpts=PTS/$SPEED,fps=$FPS,format=yuv420p"
if [ -n "$SW" ] && [ "$FLIP" = 1 ]; then
  VF="[0:v]split=2[a][b];[a]trim=start_frame=0:end_frame=$SW,setpts=PTS-STARTPTS,hflip[a1];[b]trim=start_frame=$SW,setpts=PTS-STARTPTS[b1];[a1][b1]concat=n=2:v=1:a=0,$POST[v]"
else
  VF="[0:v]$FL,$POST[v]"
fi
if [ -n "$HAS_AUDIO" ]; then
  FC="$VF;[0:a]atempo=$SPEED,aresample=48000[au]"; AM=(-map "[au]" -c:a aac -b:a 192k -ar 48000)
else
  FC="$VF"; AM=()
fi
"$FF" -v error -y -i "$IN" -filter_complex "$FC" -map "[v]" "${AM[@]}" \
  -map_metadata -1 -map_chapters -1 -fflags +bitexact -c:v libx264 -crf 18 -preset veryfast \
  -movflags +faststart "$OUT" && echo "done $OUT (${W}x${H}, ${SPEED}x, ${FPS}fps, flip=$FLIP)"
