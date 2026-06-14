# ESP32 Wiring Guide

## Hardware

- ESP32 board
- Pulse Sensor
- MPU6050
- Breadboard
- Jumper wires
- USB cable

## Pulse Sensor Wiring

- `VCC` -> `3V3`
- `GND` -> `GND`
- `SIGNAL` -> `GPIO34`

## MPU6050 Wiring

- `VCC` -> `3V3`
- `GND` -> `GND`
- `SDA` -> `GPIO21`
- `SCL` -> `GPIO22`
- `AD0` -> `GND`

## Upload Notes

- Select the correct ESP32 board in Arduino IDE.
- Install the ESP32 board package if it is not already installed.
- Keep the Serial Monitor at `115200`.
- Test with `iot/esp32_basic/esp32_basic.ino` first.
- Then upload `iot/esp32_advanced/esp32_advanced.ino` for backend integration.

## Backend URL

Set `BACKEND_URL` inside the advanced sketch like this:

`http://YOUR_COMPUTER_IP:5000/api/iot/data`

Do not use `localhost` inside the ESP32 sketch.
