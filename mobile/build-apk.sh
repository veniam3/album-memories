#!/usr/bin/env bash
# Собирает два debug-APK: пустой альбом и альбом с шестью демо-днями.
# Требует JDK 17 и Android SDK (platform 36, build-tools 36).
set -euo pipefail
cd "$(dirname "$0")"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
mkdir -p dist

build() {
  local mode="$1" id="$2" name="$3" out="$4"
  bash build-www.sh "$mode"
  pnpm exec cap copy android >/dev/null

  sed -i "s/applicationId \"[^\"]*\"/applicationId \"$id\"/" android/app/build.gradle
  sed -i "s#<string name=\"app_name\">[^<]*</string>#<string name=\"app_name\">$name</string>#" android/app/src/main/res/values/strings.xml
  sed -i "s#<string name=\"title_activity_main\">[^<]*</string>#<string name=\"title_activity_main\">$name</string>#" android/app/src/main/res/values/strings.xml

  (cd android && "${GRADLE_BIN:-$HOME/gradle-8.14.3/bin/gradle}" assembleDebug --no-daemon >/dev/null)
  cp android/app/build/outputs/apk/debug/app-debug.apk "dist/$out"
  echo "готово: dist/$out"
}

build empty com.album.memories "O’Upon" album-empty.apk
build demo  com.album.memories.demo "O’Upon Демо" album-demo.apk
