const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const store = require("../lib/runtimeStore");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

const questionsPath = path.join(__dirname, "..", "data", "questions.json");

function readQuestions() {
  const raw = fs.readFileSync(questionsPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    hr: Array.isArray(parsed.hr) ? parsed.hr : [],
    technical: Array.isArray(parsed.technical) ? parsed.technical : [],
    coding: Array.isArray(parsed.coding) ? parsed.coding : [],
    behaviour: Array.isArray(parsed.behaviour)
      ? parsed.behaviour
      : Array.isArray(parsed.behavioral)
        ? parsed.behavioral
        : []
  };
}

function writeQuestions(data) {
  fs.writeFileSync(questionsPath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeType(type) {
  if (type === "behavioral" || type === "behaviour") return "behaviour";
  return type;
}

function isValidQuestionType(type) {
  return ["hr", "technical", "coding", "behaviour"].includes(type);
}

router.use(auth, requireAdmin);

router.get("/users", async (_req, res) => {
  try {
    const users = await store.listUsers();
    res.json(users);
  } catch (error) {
    console.error("Admin users load error:", error);
    res.status(500).json({ error: "Unable to load users" });
  }
});

router.get("/history", async (_req, res) => {
  try {
    const history = await store.listHistory("desc");
    res.json(history);
  } catch (error) {
    console.error("Admin history load error:", error);
    res.status(500).json({ error: "Unable to load history" });
  }
});

router.get("/questions", (_req, res) => {
  try {
    res.json(readQuestions());
  } catch (error) {
    console.error("Admin question load error:", error);
    res.status(500).json({ error: "Unable to load questions" });
  }
});

router.put("/questions/:type", (req, res) => {
  try {
    const type = normalizeType(req.params.type);
    const items = Array.isArray(req.body.questions) ? req.body.questions : null;

    if (!isValidQuestionType(type)) {
      return res.status(400).json({ error: "Invalid question type" });
    }

    if (!items) {
      return res.status(400).json({ error: "questions must be an array" });
    }

    const cleaned = items
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    const questions = readQuestions();
    questions[type] = cleaned;
    writeQuestions(questions);

    res.json({ message: "Questions updated", type, questions: cleaned });
  } catch (error) {
    console.error("Admin question update error:", error);
    res.status(500).json({ error: "Unable to update questions" });
  }
});

module.exports = router;
