---
name: trial-reel-variants
description: "Use when Jacques sends a video and asks for trial reel versions (or 'more' versions) so Instagram trial reels won't flag it as the same video: mirrored, zoomed, sped up, regraded copies that look the same to a viewer."
---

# Trial reel variants

Make several versions of one video that look the same to a viewer but differ in mirror, framing, speed, color, grain, frame rate and metadata, so Instagram trial reels accepts each one as new.

This is the quick re-encode job. For new edits of a talking-head reel (new hook, new opening visual, micro cut) use the `talking-head-reel-editor` skill instead.

## Where the files are
- Footage lives on Jacques's Mac. Work in the folder he shares through Remote Control (Claude desktop app: Settings, Claude Code, Remote Control). If no folder is attached, call `list_computer_folders` then `request_computer_folder`.
- Render on the Mac when it has ffmpeg (`which ffmpeg`; if missing, ask before `brew install ffmpeg`). Copy `render.sh` and `sheet.sh` from this folder into `<his folder>/_toolkit/trial-variants/` the first time.
- Otherwise copy the source into the scratchpad here, render, and write results back (30MB per file; split with `-c copy -f segment` and join on the Mac with ffmpeg concat if larger).
- Outputs go in `<his folder>/trials/` and are sent with SendUserFile.

## Defaults
- A new video gets 4 versions (v1 to v4). "more" means 4 more of the LAST video sent (v5 to v8, then v9 to v12).
- Keep the source resolution (1080x1920 stays 1080x1920; 1280x720 stays 1280x720; a 4:3 source like 1112x834 becomes 1080x810). `render.sh` does this.
- Name files `<theme>_trial_v<N>.mp4` (e.g. paris_trial_v1, miami_trial_v5), where theme is the location or subject.
- Strip all metadata, re-encode H.264 CRF 18 `-preset veryfast`, AAC 192k, 48kHz, `+faststart`.
- Render one version per command (each takes about 1 to 3 minutes; keep each call under the tool timeout).

## Step 1: Inspect before rendering
1. ffprobe: duration, resolution, fps.
2. Find cuts: `ffmpeg -i IN -vf "select='gt(scene,0.3)',metadata=print:file=-" -an -f null - | grep pts_time`. No cuts means one continuous take.
3. Contact sheet: `bash sheet.sh IN sheet.jpg 18` (timestamps burned in, 6 wide) and look at it. Zoom in (crop) on anything that might be text.

## Step 2: Decide what must NOT be mirrored (most important rule)
- Any readable real text or logo must never appear mirrored: game titles, brand names, product boxes, signs, captions burned into the video. Flipped text looks weird.
- Check EVERY shot, not just the obvious one. (Mistake made before: missed a second text shot at 3.7s to 5.5s.)
- Burned-in captions or a talking head with on-screen text across the whole video: do not mirror that video at all; use only the unmirrored presets (v2, v4, v6, v8, v10, v12) or set flip to 0 in a custom PRESET.
- Video with cuts: leave the text shots unmirrored by splitting at the cut frames (trim by start_frame/end_frame, hflip only the other segments, concat).
- One continuous take with text near the end: find a moment that hides the switch (e.g. an object bursting and filling the frame), look at it frame by frame, and pass that frame number as the 4th argument to `render.sh` so it switches from mirrored to normal there. Tell Jacques the exact moment and that a small jump may be visible there, so he can check it.
- Blurry or AI-gibberish text (shop signs, bus displays) can be mirrored; mention it in the reply.
- Mention mirroring side effects: a car driver moving sides, a taxi driver on the wrong side, items switching hands, a parting switching sides.

## Step 3: Render
```bash
bash render.sh IN OUT VERSION [UNMIRROR_FROM_FRAME]
# e.g. bash render.sh in.mp4 trials/paris_trial_v1.mp4 1
#      bash render.sh in.mp4 trials/paris_trial_v3.mp4 3 142   # mirrored until source frame 142
# custom combo past v12:
#      PRESET='1|0.90|iw*0.04|ih*0.03|1.02|eq=saturation=1.06,noise=alls=3:allf=t|25' bash render.sh in.mp4 out.mp4 13
```
Set `FFMPEG` / `FFPROBE` env vars if ffmpeg is not on PATH.

### The 12 presets (flip, crop, x, y, speed, grade, fps)
| v | flip | crop | x | y | speed | grade | fps |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 0.95 | (iw-ow)/2 | (ih-oh)/2 | 1.03 | eq=saturation=1.08:contrast=1.03:brightness=0.01,noise=alls=3:allf=t | 24 |
| 2 | 0 | 0.92 | iw*0.03 | ih*0.02 | 0.97 | colorbalance=rs=0.04:bs=-0.04:rm=0.03:bm=-0.03,eq=saturation=1.05,vignette=PI/5,noise=alls=2:allf=t | 24 |
| 3 | 1 | 0.94 | iw*0.06 | ih*0.04 | 1.05 | colorbalance=rs=-0.03:bs=0.04:bm=0.02,eq=contrast=1.05:brightness=-0.01,unsharp=5:5:0.6,noise=alls=3:allf=t | 25 |
| 4 | 0 | 0.90 | (iw-ow)/2 | (ih-oh)/2 | 1.02 | eq=saturation=0.92:contrast=1.08:gamma=0.97,noise=alls=5:allf=t | 30 |
| 5 | 1 | 0.91 | iw*0.02 | ih*0.07 | 0.98 | colorbalance=rh=0.03:bh=-0.02:bs=0.03,eq=saturation=1.12:gamma=1.03,noise=alls=4:allf=t | 24 |
| 6 | 0 | 0.93 | iw*0.07 | ih*0.01 | 1.04 | rotate=0.8*PI/180:ow=iw:oh=ih,crop=iw*0.97:ih*0.97,scale=W:H,colorbalance=rs=-0.02:gs=0.02:bs=0.03,eq=contrast=1.06:saturation=0.97,noise=alls=3:allf=t | 30 |
| 7 | 1 | 0.89 | (iw-ow)/2 | ih*0.03 | 0.96 | colorbalance=rm=0.04:gm=0.01:bm=-0.04,eq=contrast=0.97:brightness=0.02:saturation=1.03,vignette=PI/4,noise=alls=2:allf=t | 25 |
| 8 | 0 | 0.95 | iw*0.01 | ih*0.05 | 1.06 | rotate=-0.7*PI/180:ow=iw:oh=ih,crop=iw*0.97:ih*0.97,scale=W:H,eq=saturation=1.15:contrast=1.04:gamma=0.98,unsharp=3:3:0.4,noise=alls=4:allf=t | 24 |
| 9 | 1 | 0.88 | iw*0.10 | ih*0.05 | 1.01 | colorbalance=rs=0.02:gs=-0.01:bh=0.03,eq=contrast=1.04:saturation=1.10:brightness=-0.015,noise=alls=3:allf=t | 30 |
| 10 | 0 | 0.94 | 0 | 0 | 0.99 | rotate=-1.0*PI/180:ow=iw:oh=ih,crop=iw*0.96:ih*0.96,scale=W:H,colorbalance=rm=0.03:bm=0.03:gm=-0.02,eq=saturation=1.06:gamma=1.02,vignette=PI/6,noise=alls=4:allf=t | 25 |
| 11 | 1 | 0.93 | 0 | ih*0.07 | 1.07 | rotate=0.6*PI/180:ow=iw:oh=ih,crop=iw*0.97:ih*0.97,scale=W:H,colorbalance=rs=-0.04:bs=0.05:rh=0.02,eq=contrast=1.07:saturation=0.95,noise=alls=2:allf=t | 24 |
| 12 | 0 | 0.87 | iw*0.05 | ih*0.10 | 0.95 | colorbalance=rh=0.04:gh=0.02:bs=-0.03,eq=saturation=1.18:contrast=1.02:brightness=0.02,unsharp=3:3:0.5,noise=alls=5:allf=t | 30 |

(W:H = the output size; `render.sh` fills it in.) Past v12, invent new combinations in the same small ranges: zoom 5 to 13%, speed 0.95 to 1.07, tilt under 1°, mild color shifts, keep half the versions mirrored.

Vertical reels: the crop x/y offsets can cut captions or the top of the head. If the subject or burned-in text sits near an edge, use a centered crop ((iw-ow)/2, (ih-oh)/2) for that version and say so.

## Step 4: Check before sending
- ffprobe each output: duration, size, fps.
- Contact sheet of 2 frames per version (including the text shot or the final frame) and look at it: protected text must read correctly in every version.
- Tilted versions (v6, v8, v10, v11): crop the corners and confirm there are no black wedges (v2, v7, v10 darken the corners on purpose with a vignette; that is fine).
- For a mid-shot mirror switch, look at the frames around the switch.

## Step 5: Reply
Send all files with SendUserFile, then reply briefly:
- One numbered line per version: mirrored or not, zoom and direction, speed, grade, fps, duration.
- Mention the resolution once and that metadata is stripped.
- "Choices I made without asking": how many versions, what is or isn't mirrored and why, any visible side effects (backwards text, driver side, a jump at a switch point).
- No em dashes or dashes in the text. No extra advice.
