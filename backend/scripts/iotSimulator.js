const DEFAULT_TARGET = process.env.IOT_SIM_TARGET || "http://127.0.0.1:5000/api/iot/data";
const { DEFAULT_INTERVAL_MS, IoTSimulatorModel } = require("../lib/iotSimulatorModel");

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function postTelemetry(target, payload) {
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${message ? ` ${message}` : ""}`);
  }

  return response.json();
}

async function main() {
  const target = process.argv[2] || DEFAULT_TARGET;
  const model = new IoTSimulatorModel({
    intervalMs: DEFAULT_INTERVAL_MS,
    source: "esp32-simulator",
    firmwareVersion: "1.0.0-sim"
  });

  console.log(`[iot-sim] Target: ${target}`);
  console.log(`[iot-sim] Interval: ${DEFAULT_INTERVAL_MS}ms`);

  const sendSample = async () => {
    const payload = model.nextPayload();
    const live = await postTelemetry(target, payload);
    const snapshot = live && live.live ? live.live : payload;
    console.log(
      `[iot-sim] ${new Date().toLocaleTimeString()} BPM=${Math.round(snapshot.heartRateBpm || 0)} ` +
      `Move=${round(snapshot.movementScore || 0, 1)} Posture=${snapshot.posture || "--"} Stress=${snapshot.stress || "--"}`
    );
  };

  await sendSample();
  const timer = setInterval(() => {
    sendSample().catch((error) => {
      console.error(`[iot-sim] ${error.message}`);
    });
  }, DEFAULT_INTERVAL_MS);

  const shutdown = () => {
    clearInterval(timer);
    console.log("[iot-sim] Stopped");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(`[iot-sim] Startup failed: ${error.message}`);
  process.exit(1);
});
