# Folder Guide

## Root

- `package.json`: app scripts and dependencies
- `.env`: local environment values
- `README.md`: project overview

## frontend

- `index.html`: login and registration entry page
- `dashboard.html`: member dashboard
- `interview.html`: live interview workspace
- `report.html`: report and PDF export
- `admin.html`: restricted admin portal
- `help.html`: owner support desk
- `js/`: client-side behavior and API integrations
- `assets/`: brand assets

## backend

- `server.js`: backend entry
- `routes/`: auth, admin, history, questions, analysis, help, IoT
- `lib/`: local JSON storage and helper logic
- `models/`: mongoose models
- `data/`: local file-backed persistence

## iot

- `esp32_advanced/`: real ESP32 firmware for backend posting
- `basic/`: serial hardware validation sketch
- `docs/`: wiring and hardware notes

## uploads

Generated runtime files used by parts of the app. These are ignored in source control for cleaner project hygiene.

