const router = require("express").Router();
const auth = require("../middleware/auth");
const { isAdminEmail } = require("../middleware/admin");
const store = require("../lib/runtimeStore");
const iotStore = require("../lib/iotStore");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeRound(value) {
  const round = normalizeText(value).toLowerCase();
  if (round === "behavioral") return "behaviour";
  return ["hr", "technical", "coding", "behaviour", "general", "latest"].includes(round)
    ? round
    : "general";
}

function normalizeStress(value) {
  const stress = normalizeText(value).toLowerCase();
  if (stress === "high") return "High";
  if (stress === "moderate") return "Moderate";
  if (stress === "calm") return "Calm";
  if (stress === "unknown") return "Unknown";
  return "";
}

function normalizePosture(value) {
  const posture = normalizeText(value).toLowerCase();
  if (posture === "checking") return "Checking";
  if (posture === "guided") return "Guided";
  if (posture === "good") return "Good";
  if (posture === "adjust") return "Adjust";
  if (posture === "unavailable") return "Unavailable";
  return "";
}

function matchesAuthenticatedUser(item, user) {
  const userEmail = normalizeText(user && user.email).toLowerCase();
  const userId = normalizeText(user && user.id);
  const itemEmail = normalizeText(item && item.userEmail).toLowerCase();
  const itemId = normalizeText(item && item.userId);

  if (userEmail && itemEmail) {
    return userEmail === itemEmail;
  }

  if (userId && itemId) {
    return userId === itemId;
  }

  return false;
}

function displayNameForLeaderboard(session) {
  const username = normalizeText(session && session.username);
  if (username) return username;

  const email = normalizeText(session && session.userEmail).toLowerCase();
  if (email.includes("@")) return email.split("@")[0];

  return "Anonymous User";
}

function buildLeaderboard(sessions) {
  const grouped = new Map();

  for (const session of Array.isArray(sessions) ? sessions : []) {
    const emailKey = normalizeText(session && session.userEmail).toLowerCase();
    const idKey = normalizeText(session && session.userId);
    const usernameKey = normalizeText(session && session.username).toLowerCase();
    const key = emailKey || idKey || usernameKey;

    if (!key) continue;

    const score = Math.max(0, Math.min(100, Number(session && session.score) || 0));
    const existing = grouped.get(key) || {
      username: displayNameForLeaderboard(session),
      scores: [],
      rounds: new Set(),
      lastDate: session && session.date ? session.date : null,
      bestScore: 0
    };

    existing.scores.push(score);
    existing.bestScore = Math.max(existing.bestScore, score);
    existing.rounds.add(normalizeRound(session && session.round));
    existing.lastDate = session && session.date ? session.date : existing.lastDate;

    if (normalizeText(session && session.username)) {
      existing.username = normalizeText(session.username);
    }

    grouped.set(key, existing);
  }

  return Array.from(grouped.values())
    .map((item) => {
      const averageScore = item.scores.length
        ? Math.round(item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length)
        : 0;
      const consistency = item.scores.length > 1
        ? Math.max(0, 100 - (Math.max(...item.scores) - Math.min(...item.scores)) * 2)
        : averageScore;

      return {
        username: item.username,
        averageScore,
        bestScore: item.bestScore,
        sessions: item.scores.length,
        consistency,
        rounds: Array.from(item.rounds).filter((round) => round && round !== "general"),
        lastDate: item.lastDate
      };
    })
    .sort((left, right) => {
      if (right.averageScore !== left.averageScore) return right.averageScore - left.averageScore;
      if (right.bestScore !== left.bestScore) return right.bestScore - left.bestScore;
      return right.sessions - left.sessions;
    })
    .slice(0, 8);
}

router.get("/secure", auth, (_req, res) => {
  res.json({ message: "Protected route accessed" });
});

router.post("/save", auth, async (req, res) => {
  try {
    const authenticatedEmail = normalizeText(req.user && req.user.email).toLowerCase();
    const authenticatedUserId = normalizeText(req.user && req.user.id);
    const authenticatedUser = authenticatedEmail
      ? await store.findUserByEmail(authenticatedEmail)
      : null;
    const feedback = Array.isArray(req.body.feedback)
      ? req.body.feedback.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    const latestSensorSnapshot =
      req.body.sensorSnapshot && typeof req.body.sensorSnapshot === "object"
        ? req.body.sensorSnapshot
        : iotStore.getLatestSnapshot();

    const payload = {
      sessionId: normalizeText(req.body.sessionId) || `session-${Date.now()}`,
      userId: authenticatedUserId || normalizeText(authenticatedUser && authenticatedUser._id) || normalizeText(req.body.userId),
      userEmail: authenticatedEmail || normalizeText(req.body.userEmail).toLowerCase(),
      username: normalizeText((authenticatedUser && authenticatedUser.username) || req.body.username),
      score: Math.max(0, Math.min(100, Number(req.body.score) || 0)),
      feedback,
      suggestion: normalizeText(req.body.suggestion),
      round: normalizeRound(req.body.round),
      question: normalizeText(req.body.question),
      answer: normalizeText(req.body.answer),
      stress: normalizeStress(req.body.stress),
      stressDetail: normalizeText(req.body.stressDetail),
      posture: normalizePosture(req.body.posture),
      postureDetail: normalizeText(req.body.postureDetail),
      emotion: normalizeText(req.body.emotion),
      emotionDetail: normalizeText(req.body.emotionDetail),
      voiceEmotion: normalizeText(req.body.voiceEmotion),
      voiceEmotionDetail: normalizeText(req.body.voiceEmotionDetail),
      voiceEmotionSource: normalizeText(req.body.voiceEmotionSource),
      analysisSource: normalizeText(req.body.analysisSource) || "unknown",
      sensorSnapshot: latestSensorSnapshot || null,
      durationSeconds: Math.max(0, Number(req.body.durationSeconds) || 0),
      date: req.body.date || new Date()
    };

    const saved = await store.createHistory(payload);
    res.status(201).json({ message: "Saved successfully", session: saved });
  } catch (error) {
    console.error("History save error:", error);
    res.status(500).json({ error: "Unable to save session" });
  }
});

router.get("/leaderboard", auth, async (_req, res) => {
  try {
    const sessions = await store.listHistory("asc");
    res.json(buildLeaderboard(sessions));
  } catch (error) {
    console.error("Leaderboard load error:", error);
    res.status(500).json({ error: "Unable to load leaderboard" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const sessions = await store.listHistory("asc");

    if (isAdminEmail(req.user && req.user.email)) {
      res.json(sessions);
      return;
    }

    res.json(sessions.filter((item) => matchesAuthenticatedUser(item, req.user)));
  } catch (error) {
    console.error("History load error:", error);
    res.status(500).json({ error: "Unable to load sessions" });
  }
});

module.exports = router;
