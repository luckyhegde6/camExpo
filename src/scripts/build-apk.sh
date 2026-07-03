#!/bin/bash
set -euo pipefail

echo "=== Building camExpo Release APK ==="

echo "-> Installing dependencies..."
npm ci

echo "-> Running Expo prebuild..."
npx expo prebuild

echo "-> Building release APK with Gradle..."
cd android
./gradlew assembleRelease

echo "=== Done ==="
echo "APK: android/app/build/outputs/apk/release/app-release.apk"
