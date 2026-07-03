# camExpo — ESP32-CAM Viewer

React Native (Expo) app that streams MJPEG from an ESP32-CAM over LAN. Full camera controls, capture/save to gallery, geolocation tagging, and recording.

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

## ESP32-CAM Setup

1. Open `esp32-cam-firmware/esp32-cam-firmware.ino` in Arduino IDE
2. Install ESP32 board package (2.x) via Board Manager
3. Select board: **AI Thinker ESP32-CAM**
4. Partition scheme: **Huge APP (3MB No OTA/1MB SPIFFS)**
5. Set your WiFi credentials at top of the file
6. Flash with `Tools > Upload Speed: 115200`

The camera will appear at the IP printed in the Serial Monitor (115200 baud).

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

Discovery flow: try manual IP → test subnet scan → fallback to common subnets. On emulator (`10.0.2.x`), uses server-side API route `/api/discover` that scans LAN from the dev host.

## Features

- **Controls**: flash, mirror, flip, quality (6–15), resolution (UXGA/SVGA/VGA/CIF), digital zoom
- **Capture**: saves JPEG to device gallery with geolocation tag
- **Recording**: captures frames at 1fps, saves individually to gallery
- **Overlay**: timestamp and GPS coordinates on stream
- **Connection modes**: manual IP entry, subnet scan, BLE provisioning (standalone AP mode)
- **Stream URL**: `http://{ip}:81/stream` refreshable on tap

## Build APK

```bash
# Local
npx expo run:android
# or for release
cd android && gradlew assembleRelease
# APK at: android/app/build/outputs/apk/release/app-release.apk

# EAS cloud
eas build -p android --profile production
```

## CI/CD

GitHub Actions builds a release APK on push (any branch) and creates a GitHub Release with the APK attached when a version tag (`v*`) is pushed.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| No stream / black screen | Wrong IP / different subnet | Use Scan button or enter IP manually |
| Frame Buffer Overflow (FB-OVF) | Camera init before WiFi stable | Flash updated firmware (init after WiFi) |
| Emulator can't find camera | NAT network isolation | Use server-side scan (auto-detected) |
| App crashes on open | Missing permissions | Run `expo prebuild` then rebuild |
| Slow stream | High quality setting | Lower JPEG quality slider |

## Firmware Details

- `esp_http_server` (ESP-IDF) handles concurrent HTTP connections in FreeRTOS tasks
- Port 80: `/status`, `/control?var=X&val=Y`, `/capture`
- Port 81: `/stream` (multipart/x-mixed-replace)
- Camera init runs after WiFi connects, XCLK at 10MHz, `CAMERA_GRAB_LATEST`, PSRAM preferred
- mDNS: `esp32cam.local`
- Fallback to AP mode (`ESP32-CAM-AP`, `192.168.4.1`) with BLE provisioning if WiFi fails

## License

MIT
