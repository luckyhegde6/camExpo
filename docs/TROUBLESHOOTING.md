# ESP32-CAM Troubleshooting

This guide addresses common issues encountered when building and using the ESP32-CAM viewer.

## 1. Failed to connect to ESP32: Timed out waiting for packet header
**Symptom**: Arduino IDE gives this error during the "Uploading..." phase.
**Fix**: 
- Ensure `GPIO 0` is connected to `GND`.
- Ensure you have selected the correct COM port.
- Press the `RST` button on the ESP32-CAM module exactly when the Arduino IDE starts showing `Connecting...`.
- Ensure your TX/RX wires aren't swapped. TX on FTDI goes to RX on ESP32, and RX on FTDI goes to TX on ESP32.

## 2. Camera init failed with error 0x20001 (or similar)
**Symptom**: The Serial Monitor prints a camera initialization failure.
**Fix**:
- **Loose Cable**: The OV2640 camera ribbon cable is likely loose. Gently lift the black tab on the camera connector, push the ribbon cable in firmly, and push the tab down to lock it.
- **Power Issue**: Ensure you are supplying a true 5V. Some USB ports output slightly less, which causes the camera initialization to fail.

## 3. Brownout detector was triggered
**Symptom**: The ESP32 constantly reboots and prints `Brownout detector was triggered` in the Serial Monitor.
**Fix**:
- **Insufficient Power**: The ESP32-CAM requires a lot of power when Wi-Fi and the Camera activate simultaneously. 
- Use a dedicated 5V 2A power supply instead of drawing power directly from your computer's USB port via the FTDI.
- If using an FTDI, ensure the jumper is set to 5V, not 3.3V. The ESP32-CAM expects 5V on the 5V pin.

## 4. Sketch too big / Wrong partition scheme selected
**Symptom**: Code fails to compile, citing memory limitations.
**Fix**: 
- In the Arduino IDE, go to **Tools > Partition Scheme** and select **Huge APP (3MB No OTA/1MB SPIFFS)**. The standard partition is too small for the camera library + BLE.

## 5. BLE Device Not Found by App
**Symptom**: App scans but never sees `ESP32-CAM-SETUP`.
**Fix**:
- Android requires both `Location` and `Nearby Devices` (Bluetooth) permissions to scan for BLE. Ensure these are granted.
- Restart the ESP32-CAM.
- If you are running the app on an Android Emulator, the emulator often does not support BLE passthrough from your host PC. You may need to test on a physical Android device or use a mock BLE server script.
