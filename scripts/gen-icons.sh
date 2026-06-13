#!/usr/bin/env bash
#
# Regenerate the app icons from assets/icon.svg (a mirror of the README logo,
# docs/assets/logo.svg). Produces:
#   assets/icon.icns  — macOS app bundle icon (forge.config.ts packagerConfig.icon)
#   assets/icon.ico   — Windows installer icon (MakerSquirrel)
#   assets/icon.png   — 1024px master, used for the dev dock icon + Linux
#
# Requires: rsvg-convert (librsvg), iconutil (macOS), magick (ImageMagick).
#   brew install librsvg imagemagick
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="assets/icon.svg"
ICONSET="assets/icon.iconset"

command -v rsvg-convert >/dev/null || { echo "need rsvg-convert (brew install librsvg)"; exit 1; }
command -v iconutil     >/dev/null || { echo "need iconutil (macOS only)"; exit 1; }
command -v magick       >/dev/null || { echo "need magick (brew install imagemagick)"; exit 1; }

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# macOS .icns: each Retina pair the iconset format expects.
render() { rsvg-convert -w "$1" -h "$1" "$SRC" -o "$2"; }
render 16   "$ICONSET/icon_16x16.png"
render 32   "$ICONSET/icon_16x16@2x.png"
render 32   "$ICONSET/icon_32x32.png"
render 64   "$ICONSET/icon_32x32@2x.png"
render 128  "$ICONSET/icon_128x128.png"
render 256  "$ICONSET/icon_128x128@2x.png"
render 256  "$ICONSET/icon_256x256.png"
render 512  "$ICONSET/icon_256x256@2x.png"
render 512  "$ICONSET/icon_512x512.png"
render 1024 "$ICONSET/icon_512x512@2x.png"
iconutil -c icns "$ICONSET" -o assets/icon.icns

# 1024px master (dev dock icon + Linux).
render 1024 assets/icon.png

# Windows .ico (multi-resolution).
tmp=$(mktemp -d)
for s in 16 24 32 48 64 128 256; do render "$s" "$tmp/icon_$s.png"; done
magick "$tmp"/icon_16.png "$tmp"/icon_24.png "$tmp"/icon_32.png \
       "$tmp"/icon_48.png "$tmp"/icon_64.png "$tmp"/icon_128.png \
       "$tmp"/icon_256.png assets/icon.ico
rm -rf "$tmp" "$ICONSET"

echo "wrote assets/icon.icns, assets/icon.ico, assets/icon.png"
