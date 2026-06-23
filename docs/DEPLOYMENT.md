# Deployment Notes

## Recommended Host Setup

Deploy this project as a Node.js web service, not as only static frontend files.

- build command: `npm install`
- start command: `npm start`
- app URL: open the deployed service root, for example `https://your-app.onrender.com/`
- health check: `https://your-app.onrender.com/api/health`

Required environment variables:

- `MONGO_URI`: your MongoDB Atlas connection string
- `JWT_SECRET`: a long random secret for login tokens
- `ADMIN_EMAIL`: the email that should receive admin access

Optional environment variables:

- `PORT`: most hosts set this automatically
- `SUPPORT_SMTP_HOST`, `SUPPORT_SMTP_PORT`, `SUPPORT_SMTP_USER`, `SUPPORT_SMTP_PASS`
- `SUPPORT_FROM_EMAIL`, `SUPPORT_TO_EMAIL`

## Backend

- run with `npm start`
- local default port is `5000`
- health endpoint: `/api/health`
- the same server now also serves the frontend at `/`

## Frontend

Open the app directly from the backend server when testing locally:

- `http://localhost:5000/`

For hosted deployments, the simplest setup is to let the Express backend serve the frontend from the same deployed domain. If you deploy `frontend/` separately on a static host, set the API origin in the browser once:

`localStorage.setItem("prepgenieApiOrigin", "https://YOUR-BACKEND-DOMAIN"); location.reload();`

## Mobile Access

- keep phone and backend machine on the same Wi-Fi
- open the frontend using the computer LAN IP, for example `http://YOUR_COMPUTER_IP:5000/`
- keep API origin pointing to the machine running the backend

## ESP32

- set `BACKEND_URL` in the advanced sketch to the machine LAN IP
- do not use `localhost` inside the ESP32 firmware
- verify sensors first with the basic sketch
