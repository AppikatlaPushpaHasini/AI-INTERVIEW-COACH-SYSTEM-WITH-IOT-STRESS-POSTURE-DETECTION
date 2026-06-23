const iotStore = require("./iotStore");
const { normalizePayload } = require("./iotSnapshot");
const { DEFAULT_INTERVAL_MS, IoTSimulatorModel } = require("./iotSimulatorModel");

const AUTO_SIM_SOURCE = "esp32-auto-simulator";
const EXTERNAL_SIM_SOURCE = "esp32-simulator";

function normalizeFlag(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return fallback;
}

function isFreshSnapshot(snapshot, graceMs) {
  if (!snapshot || !snapshot.updatedAt) return false;
  return Date.now() - new Date(snapshot.updatedAt).getTime() <= graceMs;
}

function getGraceWindowMs(snapshot, fallbackIntervalMs) {
  const sampleRateMs = Math.max(1000, Number(snapshot && snapshot.sampleRateMs) || fallbackIntervalMs);
  return Math.max(9000, Math.round(sampleRateMs * 2.5));
}

function isRealDeviceActive(snapshot, fallbackIntervalMs) {
  if (!snapshot || !snapshot.updatedAt) return false;
  const source = String(snapshot.source || "").trim().toLowerCase();
  if (!source || source === AUTO_SIM_SOURCE || source === EXTERNAL_SIM_SOURCE) return false;
  return isFreshSnapshot(snapshot, getGraceWindowMs(snapshot, fallbackIntervalMs));
}

function isExternalSimulatorActive(snapshot, fallbackIntervalMs) {
  if (!snapshot || !snapshot.updatedAt) return false;
  const source = String(snapshot.source || "").trim().toLowerCase();
  if (source !== EXTERNAL_SIM_SOURCE) return false;
  return isFreshSnapshot(snapshot, getGraceWindowMs(snapshot, fallbackIntervalMs));
}

function startIoTAutoSimulator(options = {}) {
  const enabled = normalizeFlag(
    options.enabled ?? process.env.IOT_AUTO_SIM_ENABLED,
    false
  );
  const intervalMs = Math.max(
    1000,
    Number(options.intervalMs) || Number(process.env.IOT_AUTO_SIM_INTERVAL_MS) || DEFAULT_INTERVAL_MS
  );

  if (!enabled) {
    return {
      enabled: false,
      intervalMs,
      stop() {}
    };
  }

  const model = new IoTSimulatorModel({
    intervalMs,
    source: AUTO_SIM_SOURCE,
    firmwareVersion: "1.0.0-auto"
  });
  let timer = null;
  let mode = "idle";

  const tick = () => {
    const latest = iotStore.getLatestSnapshot();

    if (isRealDeviceActive(latest, intervalMs)) {
      if (mode !== "real-device") {
        console.log("[iot-auto] Real ESP32 packets detected. Auto simulator paused.");
        mode = "real-device";
      }
      return;
    }

    if (isExternalSimulatorActive(latest, intervalMs)) {
      if (mode !== "external-simulator") {
        console.log("[iot-auto] External simulator detected. Auto simulator standing by.");
        mode = "external-simulator";
      }
      return;
    }

    const snapshot = normalizePayload(model.nextPayload());
    iotStore.saveReading(snapshot);

    if (mode !== "streaming") {
      console.log(`[iot-auto] Streaming fallback IoT packets every ${Math.round(intervalMs / 1000)}s.`);
      mode = "streaming";
    }
  };

  tick();
  timer = setInterval(() => {
    try {
      tick();
    } catch (error) {
      console.error("[iot-auto] Failed to generate fallback packet:", error.message);
    }
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return {
    enabled: true,
    intervalMs,
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }
  };
}

module.exports = {
  startIoTAutoSimulator
};
