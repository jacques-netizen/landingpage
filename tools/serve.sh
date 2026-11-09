#!/usr/bin/env bash
# Serve the repo as static files on http://localhost:8765 (for checking pages and making PDFs).
# Usage: bash tools/serve.sh   (run from anywhere; stop with: kill $(lsof -t -i:8765))
cd "$(dirname "$0")/.." && exec python3 -m http.server 8765
