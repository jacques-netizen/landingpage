#!/usr/bin/env bash
# One-time tool setup for a fresh Claude Code cloud session (also usable as the
# environment's setup script). Builds a private Python venv with Pillow (image
# crops, covers, contact sheets) and imageio-ffmpeg (an ffmpeg binary for video
# frames and H.264 transcodes). A venv is used because the system Pillow in
# Claude Code containers can be broken and shadows a normal pip install.
# Chromium and Playwright are preinstalled in Claude Code cloud sessions.
#   Use afterwards:  ~/.mde-venv/bin/python script.py
#   ffmpeg path:     ~/.mde-venv/bin/python -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'
set -e
VENV="${MDE_VENV:-$HOME/.mde-venv}"
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --disable-pip-version-check pillow imageio-ffmpeg
"$VENV/bin/python" -c "from PIL import Image; import imageio_ffmpeg; print('tools ready in $VENV')"
