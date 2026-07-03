# Project: camExpo — ESP32-CAM Viewer

## Overview
React Native (Expo) app that streams MJPEG from an ESP32-CAM over LAN, with full sensor controls (flash, mirror, flip, quality, resolution, zoom), photo capture/save to device gallery, geolocation tagging, and timestamp overlay. ESP32 firmware uses ESP-IDF `esp_http_server`.

## Project Structure
- `src/screens/StreamScreen.tsx` — main stream UI + all controls
- `src/screens/DiscoveryScreen.tsx` — IP entry, subnet scanning, BLE provisioning
- `src/screens/ModeSelectionScreen.tsx` — Network IP vs Standalone AP picker
- `src/services/NetworkDiscovery.ts` — subnet scanner with emulator detection
- `src/app/api/discover+api.ts` — server-side LAN scan via `os.networkInterfaces()`
- `src/app/index.tsx` — root screen router
- `esp32-cam-firmware/esp32-cam-firmware.ino` — complete ESP32 firmware
- `app.json` — permissions & Expo config

## Firmware (ESP32-CAM)
- Uses `esp_http_server` (ESP-IDF) NOT Arduino WebServer
- Port 80: `/status` (JSON), `/control?var=X&val=Y`, `/capture` (JPEG)
- Port 81: `/stream` (MJPEG chunked)
- Camera init runs AFTER WiFi connects to prevent FB-OVF
- `CAMERA_GRAB_LATEST` mode + `drainCameraFrames()` to clear residual frames
- BLE provisioning under `#ifndef WIFI_SSID` guard

## Network
- ESP32 at `192.168.0.x` (WiFi: WIFISSID)
- Subnet scanning: 20 concurrent, 2s timeout, parallel on all subnets
- Emulator (`10.0.2.x`) falls back to server-side scan via `/api/discover`
- Firmware mDNS: `esp32cam.local`

## Behavioral Rules
1. Think before coding — state assumptions, ask if unclear
2. Simplicity first — no abstractions for single-use code
3. Surgical changes — touch only what the task requires
4. Goal-driven — define success criteria, loop until verified
5. Match existing patterns (file structure, imports, types)

## Tool Chain
- `npx expo start` — dev server
- `npx expo run:android` — native build to device
- `cd android && gradlew assembleRelease` — standalone APK
- `eas build -p android --profile production` — EAS cloud build
