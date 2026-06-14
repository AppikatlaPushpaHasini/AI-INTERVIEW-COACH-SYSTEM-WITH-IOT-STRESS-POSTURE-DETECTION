const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const filePath = path.join(dataDir, "iot.local.json");
const MAX_READINGS = 240;
const MIN_ONLINE_WINDOW_MS = 20 * 1000;

function getOnlineWindowMs(snapshot) {
  const sampleRateMs = Number(snapshot && snapshot.sampleRateMs);
  if (Number.isFinite(sampleRateMs) && sampleRateMs > 0) {
    return Math.max(MIN_ONLINE_WINDOW_MS, Math.round(sampleRateMs * 2.5));
  }
  return MIN_ONLINE_WINDOW_MS;
}

function ensureStoreFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      JSON.stringify({ latest: null, readings: [] }, null, 2),
      "utf8"
    );
  }
}

function readStore() {
  ensureStoreFile();

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      latest: parsed && typeof parsed === "object" ? parsed.latest || null : null,
      readings: Array.isArray(parsed && parsed.readings) ? parsed.readings : []
    };
  } catch (_error) {
    return { latest: null, readings: [] };
  }
}

function writeStore(data) {
  ensureStoreFile();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function isOnline(snapshot) {
  if (!snapshot || !snapshot.updatedAt) return false;
  return Date.now() - new Date(snapshot.updatedAt).getTime() <= getOnlineWindowMs(snapshot);
}

function saveReading(snapshot) {
  const store = readStore();
  const readings = [...store.readings, snapshot].slice(-MAX_READINGS);
  const next = {
    latest: snapshot,
    readings
  };

  writeStore(next);
  return next;
}

function getLatestSnapshot() {
  const store = readStore();
  if (!store.latest) return null;
  return {
    ...store.latest,
    connected: isOnline(store.latest)
  };
}

function listReadings(limit = 60) {
  const store = readStore();
  return store.readings.slice(-Math.max(1, Math.min(240, Number(limit) || 60)));
}

function average(values) {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function getSummary(limit = 60) {
  const readings = listReadings(limit);
  const latest = getLatestSnapshot();
  const heartRates = readings
    .map((item) => Number(item.heartRateBpm))
    .filter((value) => Number.isFinite(value) && value > 0);
  const temperatures = readings
    .map((item) => Number(item.temperatureC))
    .filter((value) => Number.isFinite(value));
  const movementScores = readings
    .map((item) => Number(item.movementScore))
    .filter((value) => Number.isFinite(value));
  const fallEvents = readings.filter((item) => item.fallDetected).length;

  return {
    live: latest,
    stats: {
      readingCount: readings.length,
      online: Boolean(latest && latest.connected),
      lastSeenAt: latest ? latest.updatedAt : null,
      avgHeartRateBpm: average(heartRates),
      minHeartRateBpm: heartRates.length ? Math.min(...heartRates) : null,
      maxHeartRateBpm: heartRates.length ? Math.max(...heartRates) : null,
      avgTemperatureC: average(temperatures),
      avgMovementScore: average(movementScores),
      fallEvents
    },
    recent: readings
  };
}

module.exports = {
  saveReading,
  getLatestSnapshot,
  listReadings,
  getSummary,
  isOnline
};
