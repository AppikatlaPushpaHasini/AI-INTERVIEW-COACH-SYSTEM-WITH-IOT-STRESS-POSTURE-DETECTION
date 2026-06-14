const router = require("express").Router();
const fs = require("fs");
const path = require("path");

const questionsPath = path.join(__dirname, "..", "data", "questions.json");
const QUESTION_TYPE_ALIASES = {
  behavioral: "behaviour",
  behaviour: "behaviour",
  hr: "hr",
  technical: "technical",
  coding: "coding"
};

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
  return QUESTION_TYPE_ALIASES[type] || type;
}

function isValidQuestionType(type) {
  return ["hr", "technical", "coding", "behaviour"].includes(type);
}

router.get("/", (_req, res) => {
  try {
    res.json(readQuestions());
  } catch (error) {
    console.error("Question load error:", error);
    res.status(500).json({ error: "Unable to load questions" });
  }
});

router.get("/:type", (req, res) => {
  try {
    const questions = readQuestions();
    const type = normalizeType(req.params.type);

    if (!isValidQuestionType(type)) {
      return res.status(404).json({ error: "Question type not found" });
    }

    res.json(questions[type]);
  } catch (error) {
    console.error("Question set load error:", error);
    res.status(500).json({ error: "Unable to load question set" });
  }
});

router.put("/:type", (req, res) => {
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
    console.error("Question update error:", error);
    res.status(500).json({ error: "Unable to update questions" });
  }
});

module.exports = router;
