#!/usr/bin/env bash
# Перекрашивает иконку Android в стиль альбома (крафт + бумажная карточка + сердце).
set -euo pipefail
cd "$(dirname "$0")/android/app/src/main/res"

FULL="${1:-/tmp/opencode/album-icon.svg}"
FG="${2:-/tmp/opencode/album-icon-fg.svg}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

rsvg-convert -w 512 -h 512 "$FULL" -o "$TMP/full.png"
rsvg-convert -w 432 -h 432 "$FG" -o "$TMP/fg.png"

for spec in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  dir="mipmap-${spec%%:*}"
  rest="${spec#*:}"
  icon="${rest%%:*}"
  fg="${rest#*:}"
  magick "$TMP/full.png" -resize "${icon}x${icon}" "$dir/ic_launcher.png"
  cp "$dir/ic_launcher.png" "$dir/ic_launcher_round.png"
  magick "$TMP/fg.png" -resize "${fg}x${fg}" "$dir/ic_launcher_foreground.png"
done

cat > values/ic_launcher_background.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#d6bd97</color>
</resources>
XML

echo "иконки обновлены"
