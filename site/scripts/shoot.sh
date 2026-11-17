#!/bin/bash
# Rebuilds every product image on the page from the neutral demo map, headless (no window, no focus).
#   1. Builds the demo ("Coffee shop" / "How the shop makes money") through the MCP server in a THROWAWAY store
#      from demo/ops.json. Never touches ~/Blueprint.
#   2. Shoots it with the DEV app build in ../app (--ui-shot is dev-only), at --scale 2.
#   3. Writes public/shots/*.webp and public/og.png.
# Usage: bash scripts/shoot.sh        Needs: ../app built (dist-electron), ../mcp built (dist), cwebp, node.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
OUT="$HERE/public/shots"
ELECTRON="$REPO/app/node_modules/.bin/electron"
CALL="$REPO/mcp/scripts/call.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export BLUEPRINT_HOME="$TMP/store"
mkdir -p "$BLUEPRINT_HOME" "$OUT"
V=coffee-shop/how-the-shop-makes-money/overview
IDS='"projectId":"coffee-shop","systemId":"how-the-shop-makes-money","visualId":"overview"'
SELECT=e-queue-cups   # the selected line: "Long queue blocks Cups sold"

node "$HERE/demo/make-demo.mjs"
viewport() { node "$CALL" apply "{$IDS,\"ops\":[{\"op\":\"set_viewport\",\"viewport\":{\"x\":$1,\"y\":$2,\"zoom\":$3}}]}" >/dev/null; }
app() { (cd "$REPO/app" && "$ELECTRON" . "$@" | tail -1); }

for t in light dark; do
  # Whole map (second section + share image).
  app --snapshot "$V" --out "$TMP/map-$t.png" --width 1600 --scale 2 --theme "$t"
  cwebp -quiet -q 84 -resize 1600 0 "$TMP/map-$t.png" -o "$OUT/map-$t.webp"
done

# Desktop hero: 0.2.0 floating detail card and single + control. Frame complete price, customers, queue, cups, ×, =.
# The next group starts just beyond the right edge; no card is sliced by the viewport.
viewport 10 270 0.95
for t in light dark; do
  app --ui-shot "$TMP/desk-$t.png" --open "$V" --select "$SELECT" --scale 2 --theme "$t" --delay 2500
  cwebp -quiet -q 84 "$TMP/desk-$t.png" -o "$OUT/app-$t.webp"
done

# Phones: crop the SAME 2880×1800 desktop capture. Keep all three connected cards and the
# whole floating detail card (including shadow) inside the crops, with gutters on every side.
for t in light dark; do
  cwebp -quiet -q 86 -crop 1096 490 1096 450 "$TMP/desk-$t.png" -o "$OUT/app-canvas-$t.webp"
  cwebp -quiet -q 86 -crop 1096 928 696 382 "$TMP/desk-$t.png" -o "$OUT/app-panel-$t.webp"
done

# Share image (1200x630): logo, headline, the demo map.
node "$HERE/scripts/og.mjs" "$TMP/map-light.png" "$HERE/public/og.png"

for f in "$OUT"/*.webp "$HERE/public/og.png"; do printf '%s ' "$(basename "$f")"; sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}'; echo; done
echo "If any size changed, update SHOTS in site.config.ts."
