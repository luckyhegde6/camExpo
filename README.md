# camExpo — ESP32-CAM Viewer

[![Build](https://github.com/luckyhegde6/camExpo/actions/workflows/build-apk.yml/badge.svg)](https://github.com/luckyhegde6/camExpo/actions/workflows/build-apk.yml)
[![Release](https://img.shields.io/github/v/release/luckyhegde6/camExpo?logo=github)](https://github.com/luckyhegde6/camExpo/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/luckyhegde6/camExpo/total?logo=github)](https://github.com/luckyhegde6/camExpo/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Android-brightgreen?logo=android)](https://github.com/luckyhegde6/camExpo/releases/latest)

React Native (Expo) app that streams MJPEG from an ESP32-CAM over LAN. Full camera controls, capture/save to gallery, geolocation tagging, and recording.

[⬇️ Download Latest APK](https://github.com/luckyhegde6/camExpo/releases/latest)

## Screenshots

| Mode Selection | IP Discovery | Stream & Controls |
|---|---|---|
| ![Mode Selection](docs/assets/screenshots/mode-selection.png) | ![Discovery](docs/assets/screenshots/discovery.png) | ![Stream](docs/assets/screenshots/stream.png) |

## Requirements

- Node.js 20+
- JDK 17
- Android Studio (SDK 34)
- ESP32-CAM (AI-Thinker) with PSRAM

## Quick Start

```bash
npm install
npx expo start
```

On Android, scan the QR code with Expo Go, or run `npx expo run:android` for a native build.

### Run the APK

1. Download the APK from [GitHub Releases](https://github.com/luckyhegde6/camExpo/releases/latest)
2. Transfer it to your Android device (or use `adb install app-release.apk`)
3. On first launch, grant **Location**, **Camera**, and **Storage** permissions when prompted
4. Enter your ESP32-CAM's IP address or tap **Scan** to discover cameras on your LAN

> **Emulator**: The app works in Android emulators (tested on Pixel 7 API 34). Use the Scan button — server-side discovery auto-detects emulator NAT (`10.0.2.x`).

## ESP32-CAM Integration

Full reference: [docs/ESP32_CAM_GUIDE.md](docs/ESP32_CAM_GUIDE.md) — covers pinout, wiring, schematic, flashing, control commands, and troubleshooting.

### What's in the Guide

| Section | Description |
|---------|-------------|
| Hardware | Board components, schematic overview, power specs |
| Pinout | Full GPIO table with safety guide, camera connector mapping |
| Wiring | FTDI diagram + MB programmer, connection table |
| Flashing | Board config, step-by-step, power consumption, troubleshooting |
| Firmware | Architecture diagram (port 80/81), endpoint reference |
| Controls | Flash, resolution, image adjustment, flip/mirror, effects |
| Status | JSON endpoint response format |
| BLE | Provisioning flow for AP mode |

### Quick Flash

1. Open `esp32-cam-firmware/esp32-cam-firmware.ino` in Arduino IDE
2. Board: **AI Thinker ESP32-CAM**, Partition: **Huge APP (3MB No OTA/1MB SPIFFS)**
3. Set your WiFi credentials at top of file
4. Hold GPIO 0 low, reset, upload
5. Find IP via Serial Monitor (115200 baud)

## Architecture

```
App                          ESP32-CAM
┌──────────────┐            ┌──────────────────┐
│ StreamScreen │──port 81──▶│ /stream (MJPEG)  │
│ Discovery    │──port 80──▶│ /status (JSON)   │
│              │──port 80──▶│ /control?var=X   │
│              │──port 80──▶│ /capture (JPEG)  │
└──────────────┘            └──────────────────┘
```

Discovery: manual IP → subnet scan → common subnets. Emulator (`10.0.2.x`) uses server-side `/api/discover`.

## Features

- **Controls**: flash, mirror, flip, quality (6–15), resolution (UXGA/SVGA/VGA/CIF), digital zoom
- **Capture**: saves JPEG to device gallery with geolocation tag
- **Recording**: captures frames at 1fps, saves individually to gallery
- **Overlay**: timestamp and GPS coordinates on stream
- **Connection modes**: manual IP entry, subnet scan, BLE provisioning (standalone AP mode)

## Build APK

```bash
npx expo run:android                                    # dev build to device
cd android && gradlew assembleRelease                   # release APK
eas build -p android --profile production               # EAS cloud build
```

APK at: `android/app/build/outputs/apk/release/app-release.apk`

Install via ADB: `adb install android/app/build/outputs/apk/release/app-release.apk`

## CI/CD

GitHub Actions builds on every push and uploads the APK as an artifact. Two ways to create a release:

1. **Manual workflow**: `gh workflow run "Build APK" --ref main -f version=1.0.0` — creates a **draft** release
2. **Tag push**: `git tag v1.0.0 && git push origin v1.0.0` — creates a **published** release automatically

> Push-only builds produce artifacts (not releases). Download from the workflow run page → Artifacts → `app-release-apk`.

## Firmware Details

- `esp_http_server` (ESP-IDF) handles concurrent HTTP connections in FreeRTOS tasks
- Port 80: `/status`, `/control?var=X&val=Y`, `/capture`
- Port 81: `/stream` (multipart/x-mixed-replace)
- Camera init runs after WiFi connects, XCLK at 10MHz, `CAMERA_GRAB_LATEST`, PSRAM preferred
- mDNS: `esp32cam.local`
- Fallback to AP mode (`ESP32-CAM-AP`, `192.168.4.1`) with BLE provisioning

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| No stream / black screen | Wrong IP | Use Scan button or check router |
| FB-OVF at boot | Camera init before WiFi stable | Flash current firmware |
| Emulator can't find camera | NAT isolation | Auto-detected, uses server-side scan |
| App crashes on open | Missing permissions | Run `expo prebuild` then rebuild |
| Slow stream | High quality setting | Lower JPEG quality slider |

## Repository Structure

```
camExpo/
├── esp32-cam-firmware/       # ESP32 firmware (esp_http_server)
│   └── esp32-cam-firmware.ino
├── src/
│   ├── screens/              # ModeSelection, Discovery, Stream
│   ├── services/             # NetworkDiscovery, BleService
│   ├── app/                  # Expo Router (index, layout, API routes)
│   └── components/           # Tab bar, themed components
├── docs/
│   ├── ESP32_CAM_GUIDE.md    # Full integration guide
│   └── assets/screenshots/   # App screenshots
├── .github/workflows/        # CI/CD: build-apk.yml
└── app.json                  # Expo config + permissions
```

## License

MIT
