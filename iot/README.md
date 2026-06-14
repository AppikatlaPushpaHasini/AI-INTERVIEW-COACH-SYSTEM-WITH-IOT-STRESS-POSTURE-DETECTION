# PrepGenie IoT Setup

These are the primary files you should use for your hardware:

- `iot/esp32_advanced/esp32_advanced.ino`
- `iot/esp32_basic/esp32_basic.ino`
- `iot/docs/wiring.md`

Use `esp32_advanced.ino` as the real firmware for:

- `ESP32`
- `Pulse Sensor`
- `MPU6050`
- `Breadboard`
- `Jumper Wires`
- `USB Cable`

## What Each File Is For

- `esp32_advanced/esp32_advanced.ino`
  Main firmware. Reads the pulse sensor and MPU6050, builds a realistic JSON packet, and posts it to the backend at `/api/iot/data`.
- `esp32_basic/esp32_basic.ino`
  Hardware test sketch. Use this first to confirm the pulse signal and MPU6050 values appear in Serial Monitor before switching to Wi-Fi upload mode.
- `docs/wiring.md`
  Clean wiring and upload guide for your board and sensors.

## Backend Flow

The firmware sends live sensor packets to:

- `POST /api/iot/data`

The backend stores:

- latest live snapshot
- recent sensor readings
- calculated summary stats

The frontend reads this live data in:

- `interview.html`
- `dashboard.html`
- `report.html`
- `admin.html`

## Before You Upload

Open `iot/esp32_advanced/esp32_advanced.ino` and set:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `BACKEND_URL`

Example:

`http://192.168.1.10:5000/api/iot/data`

Use your computer's LAN IP address, not `localhost`, and keep the ESP32 on the same Wi-Fi as the backend server.

## Real-World Notes

- Pulse readings are only realistic when the finger contact is steady.
- MPU6050 posture and movement values are only useful if the board is mounted in one consistent orientation.
- This setup is suitable for project/demo telemetry, not medical diagnosis.

## Recommended Use Order

1. Upload `esp32_basic/esp32_basic.ino` and verify the raw sensor values in Serial Monitor.
2. Start the backend server on port `5000`.
3. Upload `esp32_advanced.ino`.
4. Open the Admin Portal, Dashboard, Report, or Interview page and verify the live IoT values update.
