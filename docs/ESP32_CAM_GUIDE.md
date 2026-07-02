# ESP32-CAM Guide

## Hardware Required
1. **ESP32-CAM Module** (AI-Thinker model)
2. **FTDI Programmer** (USB to TTL serial converter)
3. Jumper wires
4. A stable 5V 2A power supply (optional but highly recommended to avoid brownouts)

## Wiring the FTDI Programmer to the ESP32-CAM
Because the ESP32-CAM does not have a micro-USB port built in, you must use an FTDI programmer to upload the code.

| FTDI Programmer | ESP32-CAM |
|-----------------|-----------|
| 5V              | 5V        |
| GND             | GND       |
| TX              | U0RX      |
| RX              | U0TX      |
| **GPIO 0**      | **GND** (IMPORTANT: Connect this before plugging in USB) |

## Flashing Instructions
1. Download and install the [Arduino IDE](https://www.arduino.cc/en/software).
2. Go to **File > Preferences** and add the following URL to the "Additional Boards Manager URLs":
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Go to **Tools > Board > Boards Manager**, search for `esp32` by Espressif Systems, and install it.
4. Open the `esp32-cam-firmware.ino` file in the Arduino IDE.
5. Under **Tools**, select the following settings:
   - **Board**: AI Thinker ESP32-CAM
   - **Flash Frequency**: 80MHz
   - **Flash Mode**: QIO
   - **Partition Scheme**: Huge APP (3MB No OTA/1MB SPIFFS) - *Crucial for the camera library to fit!*
   - **Port**: Select the COM port of your FTDI programmer.
6. Connect `GPIO 0` to `GND` on the ESP32-CAM.
7. Connect the FTDI programmer to your computer via USB.
8. Press the **RST** (Reset) button on the ESP32-CAM once.
9. Click the **Upload** button in the Arduino IDE.
10. Once the upload says "Done uploading", **disconnect `GPIO 0` from `GND`**.
11. Press the **RST** button again to run the uploaded code.

## Post-Flashing
After flashing and resetting without `GPIO 0` grounded, open the Serial Monitor at `115200` baud. You should see it start the BLE service `ESP32-CAM-SETUP`.

You can now use the mobile app to pair and send Wi-Fi credentials!
