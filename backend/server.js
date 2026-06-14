require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const store = require("./lib/runtimeStore");
const { startIoTAutoSimulator } = require("./lib/iotAutoSimulator");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env["MongoDB Atlas"] ||
  "mongodb://127.0.0.1:27017/ai_interview";
const projectRoot = path.join(__dirname, "..");
const frontendDir = path.join(projectRoot, "frontend");
const uploadsDir = path.join(projectRoot, "uploads");

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    dbState: mongoose.connection.readyState,
    storageMode: store.getStorageMode()
  });
});

app.use("/api/questions", require("./routes/questions"));
app.use("/api/history", require("./routes/history"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/analysis", require("./routes/analysis"));
app.use("/api/iot", require("./routes/iot"));
app.use("/api/ai", require("./routes/aiAnalysis"));
app.use("/api/emotion", require("./routes/emotion"));
app.use("/api/help", require("./routes/help"));

app.use("/frontend", express.static(frontendDir));
app.use("/uploads", express.static(uploadsDir));

app.get("/", (_req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("DB Connected");
  } catch (err) {
    console.warn("Mongo connection unavailable. Falling back to local JSON storage.");
    console.warn(err.message || err);
  }

  app.listen(PORT, () => {
    const autoSim = startIoTAutoSimulator();
    console.log(`Server running on port ${PORT} using ${store.getStorageMode()} storage`);
    if (autoSim.enabled) {
      console.log(`IoT fallback simulator ready at ${Math.round(autoSim.intervalMs / 1000)}s intervals`);
    }
  });
}

startServer();
