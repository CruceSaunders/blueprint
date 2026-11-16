#!/bin/bash
# Placeholder app icon: plain rounded square with a node-and-line glyph. Lead replaces build/icon.icns later.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
cat > "$TMP/icon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#1f2a44"/>
  <path d="M330 380 C 480 380, 540 640, 694 640" stroke="#8fb0ff" stroke-width="34" fill="none" stroke-linecap="round"/>
  <rect x="210" y="300" width="240" height="160" rx="36" fill="#ffffff"/>
  <rect x="574" y="560" width="240" height="160" rx="36" fill="#8fb0ff"/>
</svg>
SVG
qlmanage -t -s 1024 -o "$TMP" "$TMP/icon.svg" >/dev/null 2>&1
SET="$TMP/icon.iconset"; mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$TMP/icon.svg.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$TMP/icon.svg.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o build/icon.icns
rm -rf "$TMP"
echo "wrote build/icon.icns"
