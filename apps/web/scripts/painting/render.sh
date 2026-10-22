#!/usr/bin/env bash
# Renders scripts/painting/painting.html to public/landing/painting.webp.
#
# Headless Chrome paints the canvas and screenshots it at its native size
# (2200x1400); ffmpeg encodes the PNG as WebP. Re-run after editing
# painting.html; never hand-edit the image.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
web="$(cd "$here/../.." && pwd)"
out="$web/public/landing/painting.webp"

chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$chrome" ]; then
  echo "Chrome not found at: $chrome (set CHROME=/path/to/chrome)" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Chrome can exit non-zero after the screenshot is written (its teardown
# watchdog on macOS), so judge the run by the file, not the exit code.
"$chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=2200,1400 \
  --virtual-time-budget=60000 \
  --screenshot="$tmp/painting.png" "file://$here/painting.html" >/dev/null 2>&1 || true
if [ ! -s "$tmp/painting.png" ]; then
  echo "Chrome did not write the screenshot" >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"
# Quality 72: brush texture is noisy by nature, so higher settings buy bytes
# the eye can't see.
ffmpeg -loglevel error -y -i "$tmp/painting.png" -c:v libwebp -quality 72 -compression_level 6 "$out"
echo "Wrote $out ($(du -h "$out" | cut -f1))"
