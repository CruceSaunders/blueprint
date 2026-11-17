#!/bin/bash
# Rebuilds every product image on the page from the neutral demo map, headless (no window, no focus).
#   1. Builds the demo ("Coffee shop" / "How the shop makes money") through the MCP server in a THROWAWAY store
#      from demo/ops.json. Never touches ~/Blueprint. Auto-layout places everything; no viewport is stored, so the
#      app fits the whole map to the window.
#   2. Shoots it at --scale 2. --ui-shot is dev-only, so it runs the app code under the dev Electron binary:
#      the packaged app's app.asar when BLUEPRINT_APP_BIN is set (the release being shown), else ../app.
#   3. Writes public/shots/*.webp and public/og.png.
# Usage: bash scripts/shoot.sh
#   BLUEPRINT_APP_BIN=/path/Blueprint.app/Contents/MacOS/Blueprint  draw and shoot with that packaged app
#   BLUEPRINT_REPO=/path/to/checkout   where app/node_modules (electron) and mcp/node_modules (MCP SDK) live
# Needs: cwebp, node; without BLUEPRINT_APP_BIN also ../app built (dist-electron) and ../mcp built (dist).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
export BLUEPRINT_REPO="${BLUEPRINT_REPO:-$(cd "$HERE/.." && pwd)}"
OUT="$HERE/public/shots"
ELECTRON="$BLUEPRINT_REPO/app/node_modules/.bin/electron"
CALL="$HERE/scripts/mcp-call.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export BLUEPRINT_HOME="$TMP/store"
mkdir -p "$BLUEPRINT_HOME" "$OUT"
V=coffee-shop/how-the-shop-makes-money/overview
SELECT=e-queue-cups   # the selected line: "Long queue prevents Cups sold"

if [ -n "${BLUEPRINT_APP_BIN:-}" ]; then
  APP_CODE="$(cd "$(dirname "$BLUEPRINT_APP_BIN")/../Resources" && pwd)/app.asar"
  app() { "$ELECTRON" "$APP_CODE" "$@" | tail -1; }
else
  app() { (cd "$BLUEPRINT_REPO/app" && "$ELECTRON" . "$@" | tail -1); }
fi

node "$HERE/demo/make-demo.mjs"
node "$CALL" snapshot "{\"projectId\":\"coffee-shop\",\"systemId\":\"how-the-shop-makes-money\",\"visualId\":\"overview\"}" | tail -2

# Whole map (second section + share image). The map is drawn top to bottom, so it is shot narrow (700 CSS px)
# and trimmed to the drawing plus a 24 px margin: 1274x1901 at 2x.
for t in light dark; do
  app --snapshot "$V" --out "$TMP/map-$t.png" --width 700 --scale 2 --theme "$t"
  cwebp -quiet -q 86 -crop 62 62 1274 1901 "$TMP/map-$t.png" -o "$OUT/map-$t.webp"
done

# Desktop hero: the whole map fitted to the window, with the floating detail card open on the selected line.
for t in light dark; do
  app --ui-shot "$TMP/desk-$t.png" --open "$V" --select "$SELECT" --scale 2 --theme "$t" --delay 2500
  cwebp -quiet -q 84 "$TMP/desk-$t.png" -o "$OUT/app-$t.webp"
done

# Phones: one crop of the SAME 2880x1800 capture: the canvas hint, the whole map and its open detail card.
for t in light dark; do
  cwebp -quiet -q 86 -crop 1175 120 1122 1660 "$TMP/desk-$t.png" -o "$OUT/app-canvas-$t.webp"
done

# Share image (1200x630): logo, headline, the demo map.
node "$HERE/scripts/og.mjs" "$TMP/map-light.png" "$HERE/public/og.png"

for f in "$OUT"/*.webp "$HERE/public/og.png"; do printf '%s ' "$(basename "$f")"; sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}'; echo; done
echo "If any size changed, update SHOTS in site.config.ts."
