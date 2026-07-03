# Project Memory

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP server | `esp_http_server` (ESP-IDF) | Handles concurrent connections in FreeRTOS tasks, eliminates stream blocking, fixes FB-OVF at architectural level |
| Camera init timing | After WiFi connects | Prevents sensor running during 10s WiFi delay, eliminates FB-OVF during boot |
| Frame grab mode | `CAMERA_GRAB_LATEST` | Drops stale frames instead of queueing them, prevents buffer overflow during streaming |
| Stream port | 81 (separate from control port 80) | Avoids head-of-line blocking, stream can be independently refreshed |
| Network discovery | Subnet scan (20 concurrent, 2s timeout) | Works without mDNS/BLE, finds camera on any subnet |
| Emulator fallback | Server-side API `/api/discover` | Host machine scans LAN via `os.networkInterfaces()`, bypasses emulator NAT |
| APK distribution | GitHub Releases | Simpler than Google Play, free, no review process |
| Routing | Expo Router file-based | Convention over configuration, auto-types |
| BLE | `react-native-ble-plx` | Only used in standalone AP mode for WiFi credential provisioning |

## Directory Map

```
camExpo/
├── esp32-cam-firmware/
│   └── esp32-cam-firmware.ino    # Complete ESP32 firmware
├── src/
│   ├── app/
│   │   ├── _layout.tsx           # Root layout (theme + splash)
│   │   ├── index.tsx             # Screen router
│   │   └── api/
│   │       └── discover+api.ts   # Server-side LAN scan
│   ├── screens/
│   │   ├── StreamScreen.tsx      # Stream + controls
│   │   ├── DiscoveryScreen.tsx   # IP entry + scan + BLE
│   │   └── ModeSelectionScreen.tsx
│   ├── services/
│   │   └── NetworkDiscovery.ts   # Subnet scanner
│   ├── components/
│   │   ├── app-tabs.tsx          # Native tab bar
│   │   └── app-tabs.web.tsx      # Web tab bar
│   └── ...
├── app.json                      # Expo config + permissions
└── package.json
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `react-native-webview` | MJPEG stream display |
| `@react-native-community/slider` | Quality/zoom sliders |
| `expo-location` | GPS geotagging |
| `expo-media-library` | Save photos to device |
| `expo-file-system` | Download captures to cache |
| `expo-camera` | Camera permissions |
| `react-native-ble-plx` | BLE provisioning |
| `expo-network` | Device IP detection |

## Firmware Command Reference

`http://{ip}/control?var={name}&val={value}`

| var | val range | Description |
|-----|-----------|-------------|
| flash | 0/1 | Flash LED on/off |
| framesize | 0–10 | Resolution (10=UXGA, 7=SVGA, 6=VGA, 5=CIF) |
| quality | 6–15 | JPEG quality (lower = smaller) |
| hmirror | 0/1 | Horizontal mirror |
| vflip | 0/1 | Vertical flip |
| brightness | -2 to 2 | Image brightness |
| contrast | -2 to 2 | Image contrast |
| saturation | -2 to 2 | Color saturation |
| sharpness | -3 to 3 | Sharpness level |
| ae_level | -3 to 3 | Auto exposure level |
| awb | 0/1 | Auto white balance |
| agc | 0/1 | Auto gain control |
| aec | 0/1 | Auto exposure control |
| special_effect | 0–6 | Effect mode |
| wb_mode | 0–4 | White balance preset |

## Status Endpoint Example

`GET http://{ip}/status` returns:
```json
{"flash":false,"framesize":7,"quality":10,"brightness":0,"contrast":0,
 "saturation":0,"sharpness":0,"hmirror":0,"vflip":0,"ae_level":0,
 "awb":1,"agc":1,"aec":1,"special_effect":0,"wb_mode":0}
```

## Network Details

- ESP32 SSID: `WIFISSID`
- ESP32 Password: `WIFIPASSWORD`
- Static IP: `192.168.0.x`
- mDNS: `esp32cam.local` (may not resolve on all networks)
