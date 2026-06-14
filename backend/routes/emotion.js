const router = require("express").Router();
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

function sendFallbackEmotion(res) {
  res.json({
    emotion: "neutral",
    source: "fallback",
    detail: "Python emotion dependencies are unavailable, so a neutral fallback was returned."
  });
}

router.post("/", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Audio file is required" });
  }

  const filePath = req.file.path;
  const scriptPath = path.join(process.cwd(), "backend", "emotion_model.py");

  exec(`python "${scriptPath}" "${filePath}"`, (err, stdout, stderr) => {
    fs.unlink(filePath, () => {});
    const emotion = String(stdout || "").trim().toLowerCase();

    if (err || !emotion || emotion.startsWith("error:")) {
      console.warn("Emotion analysis fallback:", err?.message || stderr || emotion || "unknown failure");
      sendFallbackEmotion(res);
      return;
    }

    res.json({
      emotion,
      source: "python"
    });
  });
});

module.exports = router;
