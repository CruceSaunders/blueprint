#!/bin/bash
# Build Blueprint from source, install it to /Applications, then connect your AI tools (with your consent).
# Usage: ./setup.sh [--no-install] [--no-connect]
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
INSTALL=1; CONNECT=1
for a in "$@"; do
  case "$a" in
    --no-install) INSTALL=0 ;;
    --no-connect) CONNECT=0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || { echo "Blueprint builds on macOS only." >&2; exit 1; }
ARCH="$(uname -m)"
[ "$ARCH" = "arm64" ] || echo "note: release builds target Apple silicon (arm64); building on $ARCH may not work." >&2
command -v node >/dev/null || { echo "Node.js 22 or newer is required to build from source (https://nodejs.org)." >&2; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || { echo "Node.js 22 or newer is required (found $(node -v))." >&2; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm is required: corepack enable pnpm  (or npm i -g pnpm)" >&2; exit 1; }

echo "==> installing dependencies (frozen lockfiles)"
(cd mcp && npm ci)
(cd app && pnpm install --frozen-lockfile)

echo "==> building"
(cd mcp && npm run build)
(cd app && npx tsc --noEmit && npm run build)
(cd app && CSC_IDENTITY_AUTO_DISCOVERY=false npm run package)
BUILT="$(ls -d "$ROOT"/app/release/mac*/Blueprint.app | head -1)"
[ -d "$BUILT" ] || { echo "package output missing" >&2; exit 1; }
echo "built: $BUILT"

APP_BIN="$BUILT/Contents/MacOS/Blueprint"
if [ "$INSTALL" = 1 ]; then
  DEST="/Applications/Blueprint.app"
  if pgrep -x Blueprint >/dev/null; then
    echo "Blueprint is running. Quit it (Blueprint > Quit), then press Return to install, or type s to skip."
    read -r ans
    if [ "$ans" = "s" ]; then INSTALL=0; elif pgrep -x Blueprint >/dev/null; then echo "Still running; not replacing it. Install later with: ditto \"$BUILT\" $DEST" >&2; INSTALL=0; fi
  elif [ -d "$DEST" ]; then
    read -r -p "Replace the existing $DEST? [y/N] " ans
    case "$ans" in y|Y) ;; *) INSTALL=0 ;; esac
  fi
  if [ "$INSTALL" = 1 ]; then
    TMP_DEST="/Applications/.Blueprint.app.installing"
    rm -rf "$TMP_DEST"
    ditto "$BUILT" "$TMP_DEST"
    rm -rf "$DEST"
    mv "$TMP_DEST" "$DEST"
    # Register the blueprint:// link handler with Launch Services (does not launch the app).
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$DEST" || true
    APP_BIN="$DEST/Contents/MacOS/Blueprint"
    echo "installed $DEST"
  fi
fi

if [ "$CONNECT" = 1 ]; then
  echo "==> connecting AI tools. Plan:"
  "$APP_BIN" --connect --dry-run
  read -r -p "Apply this? [y/N] " ans
  case "$ans" in y|Y) "$APP_BIN" --connect ;; *) echo "Skipped. Run later: \"$APP_BIN\" --connect" ;; esac
fi
