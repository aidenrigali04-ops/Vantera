#!/usr/bin/env bash
# Rebuild the Chrome extension zip served from /vantera-linkedin-extension.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/linkedin-extension"
OUT="$ROOT/apps/web/public/vantera-linkedin-extension.zip"
rm -f "$OUT"
(cd "$SRC" && zip -r "$OUT" . -x "*.DS_Store")
echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
