# Emulator Testing & Screenshot Capture

## Purpose
Run the Expo app on an Android emulator, navigate through screens, capture screenshots, and save them for documentation.

## Prerequisites
- Android Studio with an AVD configured (e.g., Pixel 7 API 34)
- SDK platform-tools in PATH (`adb`)
- Expo project with `npx expo start` working
- Emulator system image installed (e.g., `system-images;android-34;google_apis;x86_64`)

## Workflow

### 1. Check Available AVDs
```bash
emulator -list-avds
```
Lists all configured Android Virtual Devices (e.g., `Pixel_7_API_34`).

### 2. Create Screenshots Directory
```bash
mkdir -p docs/assets/screenshots
```

### 3. Start Emulator (headless)
```bash
START /B "" emulator -avd Pixel_7_API_34 -no-boot-anim -no-audio -no-window -no-snapshot -memory 2048
```
- `-no-window`: runs without GUI (headless CI)
- `-no-boot-anim`: skips boot animation
- `-no-snapshot`: forces cold boot
- `-memory 2048`: allocates 2GB RAM

### 4. Wait for Boot
```bash
adb wait-for-device
```
Then poll until `sys.boot_completed`:
```bash
adb shell getprop sys.boot_completed
```
Returns `1` when fully booted.

### 5. Verify Device
```bash
adb devices
```
Should show `emulator-5554 device`.

### 6. Start Expo Dev Server
```bash
START /B "" cmd /c "npx expo start > %TEMP%\expo-server.log 2>&1"
```
Check log for Metro bundler URL (default `http://localhost:8081`).

### 7. Wait for Metro Ready
Poll `http://localhost:8081/status` or check the log file:
```bash
type "%TEMP%\expo-server.log" | findstr "Metro"
```

### 8. Open App on Emulator
```bash
adb shell am start -a android.intent.action.VIEW -d "exp://192.168.0.6:8081"
```
Replace IP with the host machine's LAN IP where Expo server is running.

### 9. Handle Import-Time Crashes
Some native modules crash at import time in Expo Go:
- **`react-native-ble-plx`**: Wrap `BleManager` constructor in lazy init with try-catch
- **`expo-media-library`**: Replace top-level `import *` with lazy `require()` in try-catch getter

### 10. Navigate & Capture Screenshots

Wait 5–10 seconds for each screen to render after navigation.

**Mode Selection Screen** (default landing):
```bash
ping -n 6 127.0.0.1 >nul
adb exec-out screencap -p > "docs/assets/screenshots/mode-selection.png"
```

**Discovery Screen** (tap "Network Mode" card):
```bash
adb shell input tap 540 900
ping -n 3 127.0.0.1 >nul
adb exec-out screencap -p > "docs/assets/screenshots/discovery.png"
```

**Scanning/Stream Screen**:
```bash
# Tap "Scan Network" button
adb shell input tap 540 1400
ping -n 5 127.0.0.1 >nul
adb exec-out screencap -p > "docs/assets/screenshots/stream.png"
```

### 11. Verify Screenshots
```bash
dir docs/assets/screenshots/
```
Valid PNG files should be 100–500 KB depending on screen content.

### 12. Reference in Docs

**README.md** — screenshots table:
```markdown
| Mode Selection | IP Discovery | Stream & Controls |
|---|---|---|
| ![Mode Selection](docs/assets/screenshots/mode-selection.png) | ![Discovery](docs/assets/screenshots/discovery.png) | ![Stream](docs/assets/screenshots/stream.png) |
```

**ESP32_CAM_GUIDE.md** — inline screenshots:
```markdown
![Mode Selection](assets/screenshots/mode-selection.png)
*Caption describing the screen*
```

### 13. Cleanup
```bash
adb emu kill   # stop emulator
taskkill /f /im node.exe   # stop Expo server
```

## Tap Coordinates Reference (1080×2400 display)

| Element | X | Y |
|---------|---|---|
| Back / Change Mode | 200 | 100 |
| Network Mode card | 540 | 900 |
| IPv4 input field | 540 | 500 |
| Connect to Stream | 540 | 600 |
| Scan Network | 540 | 700 |

Adjust Y values based on actual layout padding. Use `adb shell uiautomator dump` to get precise coordinates.

## Common Issues

| Problem | Fix |
|---------|-----|
| Emulator not found | Run `emulator -list-avds` first to verify AVD exists |
| App crash on open | Check for native module imports that fail in Expo Go |
| Blank screen on emulator | Check Metro bundler log for JS errors |
| Screenshot all black | Emulator still booting - wait for `sys.boot_completed=1` |
| "Cannot find module" | Run `npm install` and restart Expo server |
| Tap not working | Coordinates may differ - adjust using `uiautomator dump` |
