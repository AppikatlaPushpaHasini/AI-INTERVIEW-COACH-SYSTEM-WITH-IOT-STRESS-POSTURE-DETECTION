const mongoose = require("mongoose");

const allowedRounds = ["hr", "technical", "coding", "behaviour", "general", "latest"];
const allowedStress = ["Calm", "Moderate", "High", "Unknown", ""];
const allowedPosture = ["Checking", "Guided", "Good", "Adjust", "Unavailable", ""];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

const HistorySchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      set: cleanText,
      index: true
    },
    userId: { type: String, default: "", set: cleanText },
    userEmail: { type: String, default: "", set: normalizeEmail },
    username: { type: String, default: "", set: cleanText },
    score: { type: Number, default: 0, min: 0, max: 100 },
    feedback: { type: [String], default: [] },
    suggestion: { type: String, default: "", set: cleanText },
    round: { type: String, default: "general", enum: allowedRounds },
    question: { type: String, default: "", set: cleanText },
    answer: { type: String, default: "", set: cleanText },
    stress: { type: String, default: "", enum: allowedStress },
    stressDetail: { type: String, default: "", set: cleanText },
    posture: { type: String, default: "", enum: allowedPosture },
    postureDetail: { type: String, default: "", set: cleanText },
    emotion: { type: String, default: "", set: cleanText },
    emotionDetail: { type: String, default: "", set: cleanText },
    voiceEmotion: { type: String, default: "", set: cleanText },
    voiceEmotionDetail: { type: String, default: "", set: cleanText },
    voiceEmotionSource: { type: String, default: "", set: cleanText },
    analysisSource: { type: String, default: "unknown", set: cleanText },
    sensorSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    durationSeconds: { type: Number, default: 0, min: 0 },
    date: { type: Date, default: Date.now }
  },
  {
    versionKey: false,
    timestamps: true
  }
);

HistorySchema.index({ userEmail: 1, date: -1 });
HistorySchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("History", HistorySchema);
