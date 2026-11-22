#!/usr/bin/env bash
# Собирает www из desktop-версии: empty — пустой альбом, demo — шесть дней с фото.
set -euo pipefail
MODE="${1:-empty}"
cd "$(dirname "$0")"

rm -rf www
mkdir -p www/js www/css www/src
cp ../index.html www/
cp ../css/*.css www/css/
cp ../js/*.js www/js/
cp ../src/logic.mjs ../src/ai.mjs ../src/bundle-web.mjs www/src/
cp web/mobile-shim.mjs www/js/

# В APK ИИ ходит в DeepSeek прямо из WebView (CORS у API открыт).
sed -i "s#connect-src 'none'#connect-src https://api.deepseek.com#" www/index.html

if [ "$MODE" = "demo" ]; then
  cp web/demo-data.js www/js/
  INJECT='<script src="js/demo-data.js"></script>\n<script type="module" src="js/mobile-shim.mjs"></script>'
else
  INJECT='<script type="module" src="js/mobile-shim.mjs"></script>'
fi

# Мост должен появиться до app.js (оба module, порядок в документе сохраняется).
sed -i "s#<script src=\"js/music.js\"></script>#${INJECT}\n<script src=\"js/music.js\"></script>#" www/index.html
echo "www: $MODE"
