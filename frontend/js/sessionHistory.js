(function initPrepGenieHistoryHelpers() {
  const ROUND_ORDER = ["hr", "technical", "coding", "behaviour"];
  const ROUND_LABELS = {
    hr: "HR Round",
    technical: "Technical Round",
    coding: "Coding Round",
    behaviour: "Behaviour Round",
    general: "General Session",
    latest: "Latest Session"
  };

  function parseFeedback(feedback) {
    if (Array.isArray(feedback)) {
      return feedback.map((item) => String(item || "").trim()).filter(Boolean);
    }

    if (typeof feedback === "string" && feedback.trim()) {
      return [feedback.trim()];
    }

    return [];
  }

  function normalizeRound(round) {
    const value = String(round || "").trim().toLowerCase();
    if (value === "behavioral" || value === "behavior") return "behaviour";
    if (ROUND_ORDER.includes(value) || value === "general" || value === "latest") {
      return value;
    }

    return "general";
  }

  function roundLabel(round) {
    return ROUND_LABELS[normalizeRound(round)] || "General Session";
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser")) || null;
    } catch (_error) {
      return null;
    }
  }

  function normalizeDate(value, fallbackTime) {
    const parsed = new Date(value || fallbackTime || Date.now());
    if (Number.isNaN(parsed.getTime())) {
      return new Date(fallbackTime || Date.now()).toISOString();
    }

    return parsed.toISOString();
  }

  function normalizeHistory(items) {
    const source = Array.isArray(items) ? items : [];

    return source.map((item, index) => ({
      sessionId: String(item?.sessionId || "").trim(),
      userId: String(item?.userId || "").trim(),
      userEmail: String(item?.userEmail || "").trim().toLowerCase(),
      username: String(item?.username || "").trim(),
      score: Number(item?.score) || 0,
      feedback: parseFeedback(item?.feedback),
      suggestion: String(item?.suggestion || "").trim(),
      round: normalizeRound(item?.round),
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
      stress: String(item?.stress || "").trim() || "Calm",
      stressDetail: String(item?.stressDetail || "").trim(),
      posture: String(item?.posture || "").trim() || "Checking",
      postureDetail: String(item?.postureDetail || "").trim(),
      emotion: String(item?.emotion || "").trim(),
      emotionDetail: String(item?.emotionDetail || "").trim(),
      voiceEmotion: String(item?.voiceEmotion || "").trim(),
      voiceEmotionDetail: String(item?.voiceEmotionDetail || "").trim(),
      voiceEmotionSource: String(item?.voiceEmotionSource || "").trim(),
      analysisSource: String(item?.analysisSource || "").trim(),
      sensorSnapshot: item?.sensorSnapshot || null,
      durationSeconds: Math.max(0, Number(item?.durationSeconds) || 0),
      date: normalizeDate(item?.date, Date.now() - index * 60000)
    }));
  }

  function filterForCurrentUser(history, user = getCurrentUser()) {
    if (!user) return history;

    const currentEmail = String(user.email || "").trim().toLowerCase();
    const currentId = String(user.id || user._id || "").trim();

    return history.filter((item) => {
      const itemEmail = String(item.userEmail || "").trim().toLowerCase();
      const itemId = String(item.userId || "").trim();

      if (currentEmail && itemEmail) {
        return itemEmail === currentEmail;
      }

      if (currentId && itemId) {
        return itemId === currentId;
      }

      if (currentEmail || currentId) {
        return false;
      }

      return true;
    });
  }

  function sortHistory(history, order = "asc") {
    const direction = String(order || "asc").toLowerCase() === "desc" ? -1 : 1;

    return [...(Array.isArray(history) ? history : [])].sort((left, right) => {
      return (new Date(left.date || 0) - new Date(right.date || 0)) * direction;
    });
  }

  function dedupeHistory(history) {
    const seen = new Set();
    const deduped = [];

    for (const item of Array.isArray(history) ? history : []) {
      const key = String(item?.sessionId || "").trim() || JSON.stringify([
        item?.userEmail || "",
        item?.round || "",
        item?.question || "",
        item?.answer || "",
        item?.date || ""
      ]);

      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    return deduped;
  }

  function formatSessionDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown date";

    return parsed.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function formatSessionTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown time";

    return parsed.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  window.PrepGenieHistory = {
    ROUND_ORDER,
    parseFeedback,
    normalizeRound,
    roundLabel,
    getCurrentUser,
    normalizeHistory,
    filterForCurrentUser,
    sortHistory,
    dedupeHistory,
    formatSessionDate,
    formatSessionTime
  };
})();
