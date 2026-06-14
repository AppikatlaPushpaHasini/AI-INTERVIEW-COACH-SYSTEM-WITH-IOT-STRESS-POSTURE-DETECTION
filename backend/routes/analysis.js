const router = require("express").Router();

function normalizeRound(value) {
  const round = String(value || "").trim().toLowerCase();
  if (round === "behavioral" || round === "behavior") return "behaviour";
  return ["hr", "technical", "coding", "behaviour"].includes(round) ? round : "general";
}

function buildRoundFeedback(answer, round, question, score) {
  const lowered = answer.toLowerCase();
  const feedback = [];

  if (round === "hr") {
    if (!/(role|company|career|team|growth|responsible)/i.test(lowered)) {
      feedback.push("Connect the answer more clearly to the role and your career direction");
    }
    if (!/(learned|improved|adapted|strength|challenge)/i.test(lowered)) {
      feedback.push("Show what you learned or improved from the experience");
    }
  }

  if (round === "technical") {
    if (!/(because|means|works|architecture|api|database|system|reason)/i.test(lowered)) {
      feedback.push("Explain the technical reasoning, not only the final definition");
    }
    if (!/(example|project|implementation|real)/i.test(lowered)) {
      feedback.push("Add one practical implementation or project example");
    }
  }

  if (round === "coding") {
    if (!/(time complexity|space complexity|o\(|optimal|tradeoff)/i.test(lowered)) {
      feedback.push("Mention time or space complexity to make the solution interview-ready");
    }
    if (!/(step|first|then|loop|function|array|edge case|condition)/i.test(lowered)) {
      feedback.push("Walk through the solution step by step with one edge case");
    }
  }

  if (round === "behaviour") {
    if (!/(situation|task|action|result|learned|outcome)/i.test(lowered)) {
      feedback.push("Use a clearer STAR structure with situation, action, result, and learning");
    }
    if (!/(team|manager|client|member|stakeholder)/i.test(lowered)) {
      feedback.push("Include who was involved so the story feels more realistic");
    }
  }

  if (/stress|pressure|conflict|failure|challenge/i.test(question) && !/(handled|resolved|lesson|improved|calm|plan)/i.test(lowered)) {
    feedback.push("Explain how you handled the situation and what changed after your action");
  }

  if (score >= 80 && !feedback.length) {
    feedback.push("Strong answer. Keep the structure and ending just as clear in the next round");
  }

  return feedback;
}

function buildSuggestion(round, score) {
  if (round === "hr") {
    return score < 60
      ? "Make the answer more role-focused and show what you learned"
      : "Good HR answer. Keep it personal, relevant, and concise";
  }

  if (round === "technical") {
    return score < 60
      ? "Explain the concept, why it matters, and one real implementation example"
      : "Good technical answer. Keep linking theory to real systems";
  }

  if (round === "coding") {
    return score < 60
      ? "State the approach, complexity, and edge cases more clearly"
      : "Good coding explanation. Keep the algorithm and tradeoffs easy to follow";
  }

  if (round === "behaviour") {
    return score < 60
      ? "Use a clearer STAR flow and make the result measurable"
      : "Good behavioural answer. Keep the outcome and lesson concrete";
  }

  return score < 50 ? "Improve clarity and confidence" : "Good answer";
}

router.post("/", (req, res) => {
  const answer = String(req.body.answer || "").trim();
  const question = String(req.body.question || "").trim();
  const round = normalizeRound(req.body.round);

  if (!answer) {
    return res.status(400).json({
      error: "Answer is required",
      score: 0,
      feedback: ["Answer is required"],
      suggestion: "Provide an answer before analysis."
    });
  }

  const normalizedAnswer = answer.toLowerCase();
  const words = normalizedAnswer.split(/\s+/).filter(Boolean);
  let score = 0;
  const feedback = [];

  if (normalizedAnswer.length > 50) score += 20;
  else feedback.push("Answer is too short");

  if (words.length >= 30) score += 20;
  else feedback.push("Add a little more depth");

  if (/(example|for example|for instance|project|experience)/i.test(normalizedAnswer)) score += 20;
  else feedback.push("Add examples");

  if (/(team|client|result|impact|user|delivered|built|solved|managed)/i.test(normalizedAnswer)) score += 20;
  else feedback.push("Show the impact of your work or actions");

  if (/\bi\b/.test(normalizedAnswer)) score += 10;
  if (/(learned|improved|resolved|implemented|optimized)/i.test(normalizedAnswer)) score += 10;

  score = Math.min(100, score);

  for (const item of buildRoundFeedback(answer, round, question, score)) {
    if (!feedback.includes(item)) feedback.push(item);
  }

  res.json({
    score,
    feedback,
    suggestion: buildSuggestion(round, score)
  });
});

module.exports = router;
