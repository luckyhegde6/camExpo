# Learning Loop

## Log

### 2026-07-03: FB-OVF (Frame Buffer Overflow) Fix

**Problem**: ESP32-CAM boot log showed `FB-OVF` errors, camera failed to initialize, no stream available.

**Root cause**: Camera sensor started capturing frames immediately on `esp_camera_init()` while WiFi was still connecting. The 10-second WiFi delay caused 200+ frames (at 20fps) to accumulate in the limited frame buffer, triggering FB-OVF.

**Fix**: Moved `esp_camera_init()` AFTER `WiFi.begin()` succeeds. Added `drainCameraFrames()` to clear residual DMA frames. Switched to `CAMERA_GRAB_LATEST` mode. Also replaced Arduino `WebServer` with `esp_http_server` for proper concurrent connection handling.

**Verification**: Firmware compiles, camera init succeeds after WiFi connects, stream starts without FB-OVF.

### 2026-07-03: Emulator Cannot Reach LAN IPs

**Problem**: Android emulator on `10.0.2.x` NAT could not reach ESP32 at `192.168.0.8`, even on the host's LAN.

**Root cause**: Android emulator uses NAT networking by default, isolating it from the host's LAN segment.

**Fix**: Added `10.0.2.x` detection in `NetworkDiscovery.ts`. When detected, falls back to server-side scan via Expo API route `/api/discover`, which runs on the host machine and scans LAN directly using Node.js `os.networkInterfaces()` + HTTP probes.

### 2026-07-03: Arduino WebServer Blocking

**Problem**: ESP32 stream would hang after a few seconds, camera became unresponsive.

**Root cause**: Arduino `WebServer` runs in `loop()`, single-threaded. The MJPEG streaming loop blocked `loop()` from handling control requests or serving `/status`.

**Fix**: Replaced with ESP-IDF `esp_http_server`, which runs HTTP handlers in separate FreeRTOS tasks. Stream, control, and status all run concurrently without blocking.

### 2026-07-07: App Crash on Emulator (BleManager)

**Problem**: App crashed immediately on startup in Expo Go emulator with `BleManager is not a constructor`.

**Root cause**: `BleService.ts` had a module-level `new BleManager()` that executed at import time. The BLE native module isn't available in Expo Go, causing a crash before any screen rendered.

**Fix**: Made `BleManager` initialization lazy via `ensureManager()` method. Null-guard all BLE operations. The app now loads without BLE and only uses BLE features when in standalone AP mode.

### 2026-07-07: App Crash on Emulator (MediaLibrary)

**Problem**: App crashed at import time in Expo Go because `expo-media-library` uses native modules not available in Expo Go.

**Root cause**: Top-level `import * as MediaLibrary from 'expo-media-library'` executed at module load time, and Expo Go doesn't bundle the `ExpoMediaLibraryNext` native module.

**Fix**: Replaced top-level import with lazy `getMediaLibrary()` function using `require()` in a try-catch. All call sites null-check before using the module.
