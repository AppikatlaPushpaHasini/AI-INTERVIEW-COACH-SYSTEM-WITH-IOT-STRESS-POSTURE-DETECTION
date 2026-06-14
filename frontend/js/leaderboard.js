const LEADERBOARD_API_URL = window.PrepGenieConfig?.API_BASE || "http://localhost:5000/api";

(function initPrepGenieLeaderboard() {
  const container = document.getElementById("leaderboardList");
  if (!container) return;

  function parseFeedback(feedback) {
    if (Array.isArray(feedback)) return feedback;
    if (typeof feedback === "string" && feedback.trim()) return [feedback];
    return [];
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser")) || null;
    } catch (error) {
      return null;
    }
  }

  function readLocalHistory() {
    try {
      const currentUser = getCurrentUser();
      const stored = JSON.parse(localStorage.getItem("reportHistory")) || [];
      const history = stored.map((item, index) => ({
        userId: currentUser?.id || "local-user",
        userEmail: currentUser?.email || "local@prepgenie.app",
        username: currentUser?.username || currentUser?.email || "Current User",
        score: Number(item.score) || 0,
        round: item.round || "general",
        feedback: parseFeedback(item.feedback),
        suggestion: item.suggestion || "",
        stress: item.stress || localStorage.getItem("lastStress") || "Calm",
        posture: item.posture || localStorage.getItem("lastPosture") || "Checking",
        date: item.date || new Date(Date.now() - index * 60000).toISOString()
      }));

      return history;
    } catch (error) {
      console.warn("Leaderboard local history error:", error.message);
      return [];
    }
  }

  async function fetchHistory() {
    try {
      const data = window.PrepGenieConfig?.fetchApiJson
        ? await window.PrepGenieConfig.fetchApiJson("/history", {}, { timeoutMs: 6000 })
        : await fetch(`${LEADERBOARD_API_URL}/history`, {
            headers: window.PrepGenieConfig?.getAuthHeaders?.() || {}
          }).then(async (response) => {
            if (!response.ok) throw new Error("History request failed");
            return response.json();
          });
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  async function fetchLeaderboard() {
    try {
      const data = window.PrepGenieConfig?.fetchApiJson
        ? await window.PrepGenieConfig.fetchApiJson("/history/leaderboard", {}, { timeoutMs: 6000 })
        : await fetch(`${LEADERBOARD_API_URL}/history/leaderboard`, {
            headers: window.PrepGenieConfig?.getAuthHeaders?.() || {}
          }).then(async (response) => {
            if (!response.ok) throw new Error("Leaderboard request failed");
            return response.json();
          });

      return Array.isArray(data) ? data : [];
    } catch (_error) {
      return [];
    }
  }

  function buildLeaderboard(history) {
    const grouped = new Map();

    history.forEach((session) => {
      const key = String(session.userEmail || session.userId || session.username || "anonymous").trim().toLowerCase();
      if (!key) return;

      const existing = grouped.get(key) || {
        key,
        username: session.username || session.userEmail || "Unknown User",
        userEmail: session.userEmail || "",
        scores: [],
        bestScore: 0,
        lastScore: 0,
        rounds: new Set(),
        lastDate: session.date || null
      };

      const score = Number(session.score) || 0;
      existing.scores.push(score);
      existing.bestScore = Math.max(existing.bestScore, score);
      existing.lastScore = score;
      existing.rounds.add(session.round || "general");
      existing.lastDate = session.date || existing.lastDate;
      if (session.username) existing.username = session.username;
      if (session.userEmail) existing.userEmail = session.userEmail;

      grouped.set(key, existing);
    });

    return Array.from(grouped.values())
      .map((item) => {
        const averageScore = item.scores.length
          ? Math.round(item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length)
          : 0;
        const consistency = item.scores.length > 1
          ? Math.max(0, 100 - (Math.max(...item.scores) - Math.min(...item.scores)) * 2)
          : averageScore;

        return {
          ...item,
          rounds: Array.from(item.rounds),
          averageScore,
          sessions: item.scores.length,
          consistency
        };
      })
      .sort((a, b) => {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        return b.sessions - a.sessions;
      })
      .slice(0, 8);
  }

  function medal(rank) {
    if (rank === 0) return "#1";
    if (rank === 1) return "#2";
    if (rank === 2) return "#3";
    return `#${rank + 1}`;
  }

  function renderLeaderboard(items) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">No ranked session data yet. Complete a few interview sessions to generate the leaderboard.</div>';
      return;
    }

    container.innerHTML = items.map((item, index) => `
      <article class="session-item leaderboard-item">
        <strong>${medal(index)} • ${item.username}</strong>
        <p>Average Score: ${item.averageScore}% • Best Score: ${item.bestScore}%</p>
        <p>Sessions: ${item.sessions} • Consistency: ${item.consistency}%</p>
        <p>Rounds: ${item.rounds.join(", ")}</p>
      </article>
    `).join("");
  }

  async function refreshLeaderboard() {
    const backendLeaderboard = await fetchLeaderboard();
    if (backendLeaderboard.length) {
      renderLeaderboard(backendLeaderboard);
      return;
    }

    const backendHistory = await fetchHistory();
    const history = backendHistory.length ? backendHistory : readLocalHistory();
    renderLeaderboard(buildLeaderboard(history));
  }

  window.PrepGenieLeaderboard = {
    refresh: refreshLeaderboard
  };

  refreshLeaderboard();
})();


