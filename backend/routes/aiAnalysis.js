const router = require("express").Router();

router.post("/", (req, res) => {
  const answer = String(req.body.answer || "").trim();
  const question = String(req.body.question || "").trim();

  if (!answer) {
    return res.status(400).json({
      error: "Answer is required",
      score: 0,
      confidence: 0,
      feedback: ["Provide an answer before requesting AI analysis."],
      model: "AI Evaluation v2"
    });
  }

  const loweredAnswer = answer.toLowerCase();
  const loweredQuestion = question.toLowerCase();
  let score = 0;
  const feedback = [];

  if (loweredAnswer.includes("experience")) score += 20;
  if (loweredAnswer.includes("project")) score += 20;
  if (loweredQuestion && loweredAnswer.includes(loweredQuestion.split(" ")[0])) score += 10;
  if (answer.length > 80) score += 20;
  if (answer.split(/\s+/).length > 25) score += 20;

  const confidence = Math.min(100, answer.length);

  if (score < 50) {
    feedback.push("Try structuring answer (STAR method)");
    feedback.push("Add real-world examples");
  } else {
    feedback.push("Answer shows useful detail and structure");
  }

  res.json({
    score,
    confidence,
    feedback,
    model: "AI Evaluation v2"
  });
});

module.exports = router;
