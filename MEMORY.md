# Project Memory
This document tracks core technical decisions, libraries used, and context for the ESP32-CAM Viewer App.

## Technical Decisions
- **Framework**: React Native with Expo.
- **Platform Focus**: Android and Web. No iOS per user request.
- **Build System**: Expo Prebuild / EAS Build for generating standalone APKs. Bypassing Google Play.
- **Hardware Integration**:
  - **Dual Connection Modes**:
    - **Network IP Mode**: Direct stream and control over local network/Wi-Fi router using the camera's local IP address or hostname.
    - **Standalone AP Mode**: Direct peer-to-peer stream and control via the camera's self-hosted Wi-Fi hotspot (`ESP32-CAM-AP` on default IP `192.168.4.1`) when internet or local routers are unavailable.
  - **Bluetooth Low Energy (BLE)**: Used for provisioning local Wi-Fi router credentials to the ESP32-CAM during Standalone mode.
  - **Camera Controls (Port 80 HTTP Server)**: Controls flashlight LED (GPIO 4), stream resolution changes, status syncing, and photo capture via REST requests.
  - **Camera Streaming (Port 81 HTTP Server)**: High-speed MJPEG stream format rendered live in a `react-native-webview`.
- **Dependencies**:
  - `react-native-ble-plx` for BLE (Requires native linking, Expo Prebuild).
  - `expo-network` for IP/network discovery.
  - `react-native-webview` for MJPEG viewing.

## Constraints
- **Emulator Constraints**: The Android Emulator does not have direct pass-through access to the host's physical Bluetooth hardware in most setups. A mocked BLE service may be necessary to test full end-to-end functionality on the emulator.
- **Network Routing**: Standalone mode requires the client mobile device to disconnect from standard internet Wi-Fi and connect directly to the ESP32-CAM's Access Point.

