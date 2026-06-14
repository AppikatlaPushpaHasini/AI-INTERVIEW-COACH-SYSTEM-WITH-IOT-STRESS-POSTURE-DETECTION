# PrepGenie

PrepGenie is an interview practice platform with:

- multi-user login and registration
- live mock interview analysis
- dashboard and report views
- admin management for users, session history, questions, and support inbox
- ESP32 IoT integration for pulse and MPU6050 telemetry

## Product Areas

- `frontend/`
  Static product UI for login, dashboard, interview, reports, admin, and help.
- `backend/`
  Express server, auth routes, admin routes, history storage, IoT ingestion, and support APIs.
- `iot/`
  ESP32 firmware and wiring guides for the Pulse Sensor + MPU6050 setup.
- `docs/`
  Product-facing documentation and deployment notes.

## Local Run

1. Install dependencies:
   `npm install`
2. Start the app server:
   `npm start`
3. Open `http://localhost:5000/`.
4. Optional for a fake live feed without hardware:
   `npm run iot:sim`

## Default Backend

- Local API: `http://localhost:5000/api`
- Local app: `http://localhost:5000/`
- Health check: `http://localhost:5000/api/health`

## IoT Setup

Use:

- [esp32_advanced.ino](c:/Users/hasin/OneDrive/Desktop/trial%20pro/iot/esp32_advanced/esp32_advanced.ino)
- [esp32_basic.ino](c:/Users/hasin/OneDrive/Desktop/trial%20pro/iot/esp32_basic/esp32_basic.ino)
- [wiring.md](c:/Users/hasin/OneDrive/Desktop/trial%20pro/iot/docs/wiring.md)

## Documentation

- [Folder Guide](c:/Users/hasin/OneDrive/Desktop/trial%20pro/docs/FOLDER-GUIDE.md)
- [Product Notes](c:/Users/hasin/OneDrive/Desktop/trial%20pro/docs/PRODUCT.md)
- [Deployment Notes](c:/Users/hasin/OneDrive/Desktop/trial%20pro/docs/DEPLOYMENT.md)

## Current Status

The project is structured and usable as a realistic final-year/startup-style prototype. The remaining real-world dependency is physical validation of the ESP32 hardware path on your network.
