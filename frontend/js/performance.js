(function () {
  const PERFORMANCE_API_URL = window.PrepGenieConfig?.API_BASE || "http://localhost:5000/api";
  const historyHelpers = window.PrepGenieHistory;

  function parseFeedback(feedback) {
    return historyHelpers?.parseFeedback?.(feedback) || [];
  }

  function getCurrentUser() {
    return historyHelpers?.getCurrentUser?.() || null;
  }

  function normalizeHistory(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
      score: Number(item.score) || 0,
      feedback: parseFeedback(item.feedback),
      suggestion: item.suggestion || "",
      round: item.round || "general",
      stress: item.stress || "Calm",
      posture: item.posture || "Checking",
      date: item.date || new Date(Date.now() - index * 60000).toISOString(),
      userId: item.userId || "",
      userEmail: item.userEmail || "",
      username: item.username || ""
    }));
  }

  function filterForCurrentUser(history) {
    const currentUser = getCurrentUser();
    if (!currentUser) return history;

    const currentEmail = String(currentUser.email || "").trim().toLowerCase();
    const currentId = String(currentUser.id || currentUser._id || "").trim();

    return history.filter((item) => {
      const itemEmail = String(item.userEmail || "").trim().toLowerCase();
      const itemId = String(item.userId || "").trim();
      if (currentEmail && itemEmail) return itemEmail === currentEmail;
      if (currentId && itemId) return itemId === currentId;
      if (currentEmail || currentId) return false;
      return true;
    });
  }

  function readLocalHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem("reportHistory")) || [];
      const history = filterForCurrentUser(normalizeHistory(stored));
      return historyHelpers?.dedupeHistory?.(history) || history;
    } catch (error) {
      console.error("Performance local history error:", error);
      return [];
    }
  }

  async function fetchBackendHistory() {
    if (!getCurrentUser()) return [];

    try {
      const data = window.PrepGenieConfig?.fetchApiJson
        ? await window.PrepGenieConfig.fetchApiJson("/history", {}, { timeoutMs: 6000 })
          : await fetch(`${PERFORMANCE_API_URL}/history`).then((response) => {
            if (!response.ok) throw new Error("History API unavailable");
            return response.json();
          });
      const history = filterForCurrentUser(normalizeHistory(data));
      return historyHelpers?.dedupeHistory?.(history) || history;
    } catch (error) {
      return [];
    }
  }

  async function loadPerformanceData() {
    const backendHistory = await fetchBackendHistory();
    const localHistory = readLocalHistory();
    const history = backendHistory.length ? backendHistory : localHistory;
    return history
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-20);
  }

  function averageScore(history) {
    if (!history.length) return 0;
    return Math.round(history.reduce((sum, item) => sum + item.score, 0) / history.length);
  }

  function bestScore(history) {
    if (!history.length) return 0;
    return Math.max(...history.map((item) => Number(item.score) || 0));
  }

  function latestScore(history) {
    if (!history.length) return 0;
    return Number(history[history.length - 1].score) || 0;
  }

  function improvementDelta(history) {
    if (history.length < 2) return 0;
    return (Number(history[history.length - 1].score) || 0) - (Number(history[0].score) || 0);
  }

  function consistencyScore(history) {
    if (history.length < 2) return 100;
    const scores = history.map((item) => Number(item.score) || 0);
    const avg = averageScore(history);
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    const deviation = Math.sqrt(variance);
    return Math.max(0, Math.min(100, Math.round(100 - deviation * 2.2)));
  }

  function repeatedPattern(history, matcher) {
    return history.flatMap((item) => item.feedback).filter((line) => matcher.test(String(line))).length;
  }

  function roundLabel(round) {
    const labels = {
      hr: "HR",
      technical: "Technical",
      coding: "Coding",
      behaviour: "Behaviour"
    };
    return labels[String(round || "").toLowerCase()] || "General";
  }

  function getRoundAverages(history) {
    const groups = history.reduce((acc, item) => {
      const key = String(item.round || "general").toLowerCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(Number(item.score) || 0);
      return acc;
    }, {});

    return Object.entries(groups)
      .map(([round, scores]) => ({
        round,
        average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
        sessions: scores.length
      }))
      .sort((a, b) => b.average - a.average);
  }

  function findFocusArea(history) {
    const shortCount = repeatedPattern(history, /short/i);
    const exampleCount = repeatedPattern(history, /example/i);
    const structureCount = repeatedPattern(history, /structure|step|explain|reason/i);
    const highStressCount = history.filter((item) => String(item.stress).toLowerCase() === "high").length;
    const postureAdjustCount = history.filter((item) => String(item.posture).toLowerCase() === "adjust").length;

    const focusAreas = [
      {
        key: "Answer depth",
        score: shortCount * 2,
        message: "Several sessions show short answers. Expand answers with context, action, and result."
      },
      {
        key: "Examples",
        score: exampleCount * 2,
        message: "Your sessions repeatedly ask for stronger examples. Bring in one real project or outcome."
      },
      {
        key: "Structure",
        score: structureCount,
        message: "Session feedback points to answer structure. Use a clear opening, explanation, and closing takeaway."
      },
      {
        key: "Stress control",
        score: highStressCount * 2,
        message: "High stress appeared in multiple sessions. Slow down and keep answers in smaller speaking blocks."
      },
      {
        key: "Posture stability",
        score: postureAdjustCount,
        message: "Your camera sessions suggest posture drift. Sit upright and stay centered during answers."
      }
    ].sort((a, b) => b.score - a.score);

    return focusAreas[0] && focusAreas[0].score > 0
      ? focusAreas[0]
      : {
          key: "Consistency",
          score: 0,
          message: "Your recent sessions are balanced. Keep repeating the structure that is already working."
        };
  }

  function buildPerformanceNarrative(history) {
    if (!history.length) {
      return "Complete an interview session to unlock a real performance summary.";
    }

    const latest = history[history.length - 1];
    const avg = averageScore(history);
    const latestValue = latestScore(history);
    const delta = improvementDelta(history);
    const consistency = consistencyScore(history);
    const roundAverages = getRoundAverages(history);
    const strongestRound = roundAverages[0];
    const weakestRound = roundAverages[roundAverages.length - 1];
    const focusArea = findFocusArea(history);
    const highStressCount = history.filter((item) => String(item.stress).toLowerCase() === "high").length;

    if (history.length === 1) {
      return `This summary is based on your latest ${roundLabel(latest.round)} session. Score is ${latestValue}%, and your next focus is ${focusArea.key.toLowerCase()}.`;
    }

    if (latestValue >= 80 && avg >= 75 && consistency >= 80) {
      return `Your recent sessions show strong performance. ${roundLabel(strongestRound.round)} is your strongest round at ${strongestRound.average}%, and consistency is holding at ${consistency}%.`;
    }

    if (delta >= 10) {
      return `Your latest sessions are improving by ${delta} points overall. ${roundLabel(strongestRound.round)} is currently leading, while ${focusArea.key.toLowerCase()} is the next area to tighten.`;
    }

    if (highStressCount >= 2) {
      return `Your content is developing, but delivery pressure is affecting multiple sessions. Focus on stress control first, especially in ${roundLabel(weakestRound.round)} answers.`;
    }

    if (strongestRound && weakestRound && strongestRound.round !== weakestRound.round) {
      return `${roundLabel(strongestRound.round)} is your strongest round at ${strongestRound.average}%, while ${roundLabel(weakestRound.round)} is trailing at ${weakestRound.average}%. ${focusArea.message}`;
    }

    return focusArea.message;
  }

  function buildSummary(history) {
    return buildPerformanceNarrative(history);
  }

  function renderPerformance(history) {
    const averageEl = document.getElementById("performanceAverage");
    const bestEl = document.getElementById("performanceBest");
    const sessionsEl = document.getElementById("performanceSessions");
    const consistencyEl = document.getElementById("performanceConsistency");
    const summaryEl = document.getElementById("performanceSummary");

    if (!averageEl || !bestEl || !sessionsEl || !consistencyEl || !summaryEl) {
      return;
    }

    averageEl.textContent = `${averageScore(history)}%`;
    bestEl.textContent = `${bestScore(history)}%`;
    sessionsEl.textContent = String(history.length);
    consistencyEl.textContent = `${consistencyScore(history)}%`;
    summaryEl.textContent = buildSummary(history);
  }

  async function refresh() {
    const history = await loadPerformanceData();
    renderPerformance(history);
    return history;
  }

  window.PrepGeniePerformance = { refresh };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh);
  } else {
    refresh();
  }
})();

