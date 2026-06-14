const router = require("express").Router();
const iotStore = require("../lib/iotStore");
const { emptySnapshot, normalizePayload } = require("../lib/iotSnapshot");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

router.post("/data", (req, res) => {
  try {
    const snapshot = normalizePayload(req.body);
    iotStore.saveReading(snapshot);
    res.status(201).json({
      message: "IoT data received",
      live: snapshot
    });
  } catch (error) {
    console.error("IoT ingest error:", error);
    res.status(400).json({ error: "Invalid IoT payload" });
  }
});

router.get("/data", (_req, res) => {
  res.json(iotStore.getLatestSnapshot() || emptySnapshot());
});

router.get("/recent", (req, res) => {
  const limit = clamp(Number(req.query.limit) || 20, 1, 240);
  res.json(iotStore.listReadings(limit));
});

router.get("/summary", (req, res) => {
  const limit = clamp(Number(req.query.limit) || 30, 1, 240);
  const summary = iotStore.getSummary(limit);
  res.json(summary.live ? summary : { ...summary, live: emptySnapshot() });
});

module.exports = router;
