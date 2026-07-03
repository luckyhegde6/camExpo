#!/bin/bash
set -euo pipefail

echo "=== Building camExpo Release APK ==="

echo "-> Installing dependencies..."
npm ci

echo "-> Running Expo prebuild..."
npx expo prebuild --clean

echo "-> Building release APK with Gradle..."
cd android
GRADLE_OPTS="-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g" ./gradlew assembleRelease --stacktrace

echo "=== Done ==="
echo "APK: android/app/build/outputs/apk/release/app-release.apk"
