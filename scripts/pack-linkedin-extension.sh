#!/usr/bin/env bash
# Optional: local zip for dev testing (not linked in the Vantera UI — users use Chrome Web Store).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/linkedin-extension"
OUT="$ROOT/apps/web/public/vantera-linkedin-extension.zip"
rm -f "$OUT"
(cd "$SRC" && zip -r "$OUT" . -x "*.DS_Store")
echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
