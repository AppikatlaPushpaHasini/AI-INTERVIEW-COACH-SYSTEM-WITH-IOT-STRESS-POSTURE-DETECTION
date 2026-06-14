# Deployment Notes

## Backend

- run with `npm start`
- default port is `5000`
- health endpoint: `/api/health`
- the same server now also serves the frontend at `/`

## Frontend

Open the app directly from the backend server when testing locally:

- `http://localhost:5000/`

For hosted deployments, you can still serve `frontend/` as static files from any web server.

## Mobile Access

- keep phone and backend machine on the same Wi-Fi
- open the frontend using the computer LAN IP, for example `http://YOUR_COMPUTER_IP:5000/`
- keep API origin pointing to the machine running the backend

## ESP32

- set `BACKEND_URL` in the advanced sketch to the machine LAN IP
- do not use `localhost` inside the ESP32 firmware
- verify sensors first with the basic sketch
