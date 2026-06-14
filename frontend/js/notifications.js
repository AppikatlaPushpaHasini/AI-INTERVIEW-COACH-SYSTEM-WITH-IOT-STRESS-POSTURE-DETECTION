const NOTIFICATION_API_URL = window.PrepGenieConfig?.API_BASE || "http://localhost:5000/api";

(function initPrepGenieNotifications() {
  const historyHelpers = window.PrepGenieHistory;
  const listEl = document.getElementById("notificationList");
  const sidebarListEl = document.getElementById("sidebarNotificationList");
  const badgeEls = Array.from(document.querySelectorAll('[data-role="notification-badge"]'));
  if (!listEl && !sidebarListEl && !badgeEls.length) return;

  let lastSignature = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseFeedback(feedback) {
    return historyHelpers?.parseFeedback?.(feedback) || [];
  }

  function getCurrentUser() {
    return historyHelpers?.getCurrentUser?.() || null;
  }

  function readLocalHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem("reportHistory")) || [];
      const normalized = historyHelpers?.normalizeHistory?.(stored) || [];
      return historyHelpers?.filterForCurrentUser?.(normalized, getCurrentUser()) || normalized;
    } catch (error) {
      console.warn("Notification local history error:", error.message);
      return [];
    }
  }

  async function fetchHistory() {
    if (!getCurrentUser()) return [];

    try {
      const data = window.PrepGenieConfig?.fetchApiJson
        ? await window.PrepGenieConfig.fetchApiJson("/history", {}, { timeoutMs: 6000 })
        : await fetch(`${NOTIFICATION_API_URL}/history`, {
            headers: window.PrepGenieConfig?.getAuthHeaders?.() || {}
          }).then(async (response) => {
            if (!response.ok) throw new Error("History request failed");
            return response.json();
          });
      const normalized = historyHelpers?.normalizeHistory?.(Array.isArray(data) ? data : []) || [];
      return historyHelpers?.filterForCurrentUser?.(normalized, getCurrentUser()) || normalized;
    } catch (_error) {
      return [];
    }
  }

  function roundLabel(round) {
    return historyHelpers?.roundLabel?.(round) || "General Session";
  }

  function formatSessionTime(value) {
    return historyHelpers?.formatSessionTime?.(value) || "Recent";
  }

  function formatSessionDate(value) {
    return historyHelpers?.formatSessionDate?.(value) || "Recent";
  }

  function relativeTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Recent";

    const diffMs = Date.now() - parsed.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatSessionDate(value);
  }

  function averageScore(history) {
    if (!history.length) return 0;
    return Math.round(history.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / history.length);
  }

  function uniqueByKey(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = item.key || `${item.type}:${item.title}:${item.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sortByPriority(items) {
    return [...items].sort((left, right) => {
      if ((right.priority || 0) !== (left.priority || 0)) {
        return (right.priority || 0) - (left.priority || 0);
      }

      return new Date(right.date || 0) - new Date(left.date || 0);
    });
  }

  function buildNotification({
    type,
    title,
    body,
    time,
    date,
    key,
    priority = 0
  }) {
    return { type, title, body, time, date, key, priority };
  }

  function sessionsInLastHours(history, hours) {
    const threshold = Date.now() - (hours * 60 * 60 * 1000);
    return history.filter((item) => new Date(item.date).getTime() >= threshold);
  }

  function getRoundAverages(history) {
    const groups = new Map();

    history.forEach((item) => {
      const round = String(item.round || "general").trim().toLowerCase();
      const group = groups.get(round) || { round, scores: [], sessions: [] };
      group.scores.push(Number(item.score) || 0);
      group.sessions.push(item);
      groups.set(round, group);
    });

    return Array.from(groups.values()).map((group) => ({
      round: group.round,
      average: Math.round(group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length),
      count: group.scores.length,
      latest: group.sessions[group.sessions.length - 1]
    }));
  }

  function findFeedbackPattern(history) {
    const patterns = [
      {
        key: "answer-depth",
        title: "Answer depth needs work",
        match: /short|brief|depth|explanation/i,
        body: "Recent answers are still landing short. Add more context, action, and result before you finish."
      },
      {
        key: "examples",
        title: "Examples are still missing",
        match: /example|project|real experience|implementation/i,
        body: "Your recent sessions keep asking for stronger real examples. Use one project, team task, or outcome."
      },
      {
        key: "structure",
        title: "Structure is the next focus",
        match: /star|structure|step|reasoning|complexity|edge case/i,
        body: "Your latest answers need a clearer flow. Use STAR for behaviour and step-by-step reasoning for technical and coding rounds."
      }
    ];

    const hits = patterns.map((pattern) => {
      const matchingSessions = history.filter((item) => parseFeedback(item.feedback).some((line) => pattern.match.test(String(line))));
      return {
        ...pattern,
        count: matchingSessions.length,
        sessions: matchingSessions
      };
    }).sort((left, right) => right.count - left.count);

    return hits[0] && hits[0].count > 0 ? hits[0] : null;
  }

  function buildCoverageNotification(history) {
    if (!history.length) return null;

    const latest = history[history.length - 1];
    const recentCycle = history.filter((item) => {
      const itemTime = new Date(item.date).getTime();
      const latestTime = new Date(latest.date).getTime();
      return (latestTime - itemTime) <= (35 * 60 * 1000);
    });
    const covered = [...new Set(recentCycle.map((item) => String(item.round || "general").toLowerCase()))]
      .filter((round) => historyHelpers?.ROUND_ORDER?.includes(round));

    if (!covered.length) return null;

    const missing = (historyHelpers?.ROUND_ORDER || []).filter((round) => !covered.includes(round));
    if (!missing.length) {
      return buildNotification({
        type: "success",
        title: "All rounds covered in the current cycle",
        body: `Your recent interview cycle includes HR, Technical, Coding, and Behaviour sessions. The flow is being saved realistically across every round.`,
        time: relativeTime(latest.date),
        date: latest.date,
        key: `coverage-complete-${latest.sessionId || latest.date}`,
        priority: 96
      });
    }

    return buildNotification({
      type: "info",
      title: `${covered.length} of 4 rounds covered`,
      body: `Recent saved sessions cover ${covered.map(roundLabel).join(", ")}. Next good target: ${roundLabel(missing[0])}.`,
      time: relativeTime(latest.date),
      date: latest.date,
      key: `coverage-partial-${covered.join("-")}-${missing[0]}`,
      priority: 58
    });
  }

  function buildNotifications(history) {
    const currentUser = getCurrentUser();
    const orderedHistory = historyHelpers?.sortHistory?.(historyHelpers?.dedupeHistory?.(history) || history, "asc") || history;
    const latest = orderedHistory.length ? orderedHistory[orderedHistory.length - 1] : null;
    const notifications = [];

    if (!latest) {
      notifications.push(buildNotification({
        type: currentUser ? "info" : "neutral",
        title: "No session activity yet",
        body: currentUser
          ? "Finish one answer analysis to start building realistic notifications from your saved interview sessions."
          : "Complete one practice answer in preview mode to start generating session-based notifications.",
        time: "Pending",
        key: "no-session-history",
        priority: 20
      }));

      return notifications;
    }

    const previous = orderedHistory.length > 1 ? orderedHistory[orderedHistory.length - 2] : null;
    const sameRoundHistory = orderedHistory.filter((item) => item.round === latest.round);
    const previousSameRound = sameRoundHistory.length > 1 ? sameRoundHistory[sameRoundHistory.length - 2] : null;
    const todaySessions = sessionsInLastHours(orderedHistory, 24);
    const recentSessions = orderedHistory.slice(-6);
    const roundAverages = getRoundAverages(orderedHistory).sort((left, right) => left.average - right.average);
    const weakestRound = roundAverages[0];
    const strongestRound = roundAverages[roundAverages.length - 1];
    const pattern = findFeedbackPattern(recentSessions);
    const latestScore = Number(latest.score) || 0;
    const recentAverage = averageScore(recentSessions);
    const latestStress = String(latest.stress || "").toLowerCase();
    const latestPosture = String(latest.posture || "").toLowerCase();
    const stressAlerts = recentSessions.filter((item) => {
      const level = String(item.stress || "").toLowerCase();
      return level === "high" || level === "moderate";
    });
    const postureAlerts = recentSessions.filter((item) => String(item.posture || "").toLowerCase() === "adjust");
    const coverageNotification = buildCoverageNotification(orderedHistory);

    notifications.push(buildNotification({
      type: latestScore >= 80 ? "success" : latestScore >= 60 ? "info" : "warning",
      title: `${roundLabel(latest.round)} saved at ${latestScore}%`,
      body: latest.suggestion
        ? latest.suggestion
        : `Saved ${formatSessionDate(latest.date)} with realistic round and session timing.`,
      time: relativeTime(latest.date),
      date: latest.date,
      key: `latest-session-${latest.sessionId || latest.date}`,
      priority: 100
    }));

    if (previousSameRound) {
      const delta = latestScore - (Number(previousSameRound.score) || 0);
      if (delta >= 6) {
        notifications.push(buildNotification({
          type: "success",
          title: `${roundLabel(latest.round)} improved by ${delta} points`,
          body: `You moved from ${previousSameRound.score}% to ${latestScore}% since the last ${roundLabel(latest.round)}. Keep this structure in the next answer.`,
          time: relativeTime(latest.date),
          date: latest.date,
          key: `round-improve-${latest.round}-${latest.sessionId || latest.date}`,
          priority: 92
        }));
      } else if (delta <= -6) {
        notifications.push(buildNotification({
          type: "warning",
          title: `${roundLabel(latest.round)} dropped by ${Math.abs(delta)} points`,
          body: `This round fell from ${previousSameRound.score}% to ${latestScore}%. Revisit the same question style before the next attempt.`,
          time: relativeTime(latest.date),
          date: latest.date,
          key: `round-drop-${latest.round}-${latest.sessionId || latest.date}`,
          priority: 88
        }));
      }
    } else if (previous) {
      const delta = latestScore - (Number(previous.score) || 0);
      if (delta >= 10) {
        notifications.push(buildNotification({
          type: "success",
          title: "Latest score trend is improving",
          body: `Your latest saved answer improved by ${delta} points compared with the previous session.`,
          time: relativeTime(latest.date),
          date: latest.date,
          key: `overall-improve-${latest.sessionId || latest.date}`,
          priority: 84
        }));
      }
    }

    if (todaySessions.length >= 3) {
      notifications.push(buildNotification({
        type: "info",
        title: `${todaySessions.length} sessions logged in the last 24 hours`,
        body: `Your recent practice average is ${averageScore(todaySessions)}%. This is enough data to track real round-by-round movement.`,
        time: relativeTime(latest.date),
        date: latest.date,
        key: `daily-volume-${todaySessions.length}-${latest.date}`,
        priority: 62
      }));
    } else {
      const gapHours = Math.floor((Date.now() - new Date(latest.date).getTime()) / (60 * 60 * 1000));
      if (gapHours >= 12) {
        notifications.push(buildNotification({
          type: "warning",
          title: "Practice gap is growing",
          body: `Your last saved session was ${relativeTime(latest.date)}. Resume with ${weakestRound ? roundLabel(weakestRound.round) : "the next round"} to keep the data realistic and current.`,
          time: formatSessionDate(latest.date),
          date: latest.date,
          key: `practice-gap-${gapHours}-${latest.date}`,
          priority: 70
        }));
      }
    }

    if (coverageNotification) {
      notifications.push(coverageNotification);
    }

    if (weakestRound && weakestRound.count >= 2 && weakestRound.average < 70) {
      notifications.push(buildNotification({
        type: "tip",
        title: `${roundLabel(weakestRound.round)} needs the most attention`,
        body: `Its current average is ${weakestRound.average}% across ${weakestRound.count} saved session${weakestRound.count === 1 ? "" : "s"}. Practice this round next for the fastest improvement.`,
        time: weakestRound.latest?.date ? relativeTime(weakestRound.latest.date) : "Pattern",
        date: weakestRound.latest?.date,
        key: `weakest-round-${weakestRound.round}-${weakestRound.average}`,
        priority: 78
      }));
    } else if (strongestRound && strongestRound.count >= 2 && strongestRound.average >= 80) {
      notifications.push(buildNotification({
        type: "success",
        title: `${roundLabel(strongestRound.round)} is your strongest round`,
        body: `You are averaging ${strongestRound.average}% there. Use the same clarity and structure in weaker rounds.`,
        time: strongestRound.latest?.date ? relativeTime(strongestRound.latest.date) : "Pattern",
        date: strongestRound.latest?.date,
        key: `strongest-round-${strongestRound.round}-${strongestRound.average}`,
        priority: 64
      }));
    }

    if (pattern && pattern.count >= 2) {
      notifications.push(buildNotification({
        type: "coach",
        title: pattern.title,
        body: `${pattern.body} This pattern appeared in ${pattern.count} recent session${pattern.count === 1 ? "" : "s"}.`,
        time: "Pattern",
        key: `feedback-pattern-${pattern.key}-${pattern.count}`,
        priority: 80
      }));
    }

    if (stressAlerts.length >= 2 || latestStress === "high") {
      notifications.push(buildNotification({
        type: "alert",
        title: "Pressure is rising in recent sessions",
        body: `Stress markers appeared in ${stressAlerts.length} of your last ${recentSessions.length} saved sessions. Slow down and answer in shorter, clearer blocks.`,
        time: latest.date ? relativeTime(latest.date) : "Recent",
        date: latest.date,
        key: `stress-trend-${stressAlerts.length}-${latest.sessionId || latest.date}`,
        priority: 90
      }));
    } else if (latestStress === "calm" && recentSessions.some((item) => String(item.stress || "").toLowerCase() === "high")) {
      notifications.push(buildNotification({
        type: "success",
        title: "Stress recovered in the latest session",
        body: `Your latest saved answer is back to Calm. Keep the same pace and posture control.`,
        time: latest.date ? relativeTime(latest.date) : "Recent",
        date: latest.date,
        key: `stress-recovery-${latest.sessionId || latest.date}`,
        priority: 66
      }));
    }

    if (postureAlerts.length >= 2 || latestPosture === "adjust") {
      notifications.push(buildNotification({
        type: "alert",
        title: "Posture needs more consistency",
        body: `Camera guidance asked for posture adjustment in ${postureAlerts.length} recent session${postureAlerts.length === 1 ? "" : "s"}. Sit upright and stay centered before answering.`,
        time: latest.date ? relativeTime(latest.date) : "Recent",
        date: latest.date,
        key: `posture-trend-${postureAlerts.length}-${latest.sessionId || latest.date}`,
        priority: 82
      }));
    }

    if (recentSessions.length >= 3 && recentAverage >= 75) {
      notifications.push(buildNotification({
        type: "success",
        title: "Recent session quality is holding strong",
        body: `Your last ${recentSessions.length} saved sessions average ${recentAverage}%. The current practice data looks stable and realistic.`,
        time: latest.date ? relativeTime(latest.date) : "Recent",
        date: latest.date,
        key: `quality-streak-${recentAverage}-${latest.date}`,
        priority: 68
      }));
    }

    return sortByPriority(uniqueByKey(notifications)).slice(0, 6);
  }

  function renderNotifications(items) {
    if (listEl) {
      listEl.innerHTML = items.map((item) => `
        <article class="session-item notification-item notification-${item.type}">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
          <p>${escapeHtml(item.time)}</p>
        </article>
      `).join("");
    }

    if (sidebarListEl) {
      sidebarListEl.innerHTML = items.slice(0, 3).map((item) => `
        <article class="sidebar-notice notification-${item.type}">
          <strong>${escapeHtml(item.title)}</strong>
          <p class="sidebar-notice-body">${escapeHtml(item.body)}</p>
          <span class="sidebar-notice-time">${escapeHtml(item.time)}</span>
        </article>
      `).join("");
    }
  }

  function updateNavBadges(items) {
    if (!badgeEls.length) return;

    const badgeItems = items.filter((item) => item.key !== "no-session-history");
    const count = badgeItems.length;
    const hasAlert = badgeItems.some((item) => item.type === "alert");
    const hasWarning = badgeItems.some((item) => item.type === "warning");

    badgeEls.forEach((badgeEl) => {
      badgeEl.classList.remove("is-alert", "is-warning");

      if (!count) {
        badgeEl.hidden = true;
        badgeEl.textContent = "";
        badgeEl.removeAttribute("aria-label");
        return;
      }

      badgeEl.hidden = false;
      badgeEl.textContent = count > 9 ? "9+" : String(count);
      badgeEl.setAttribute("aria-label", `${count} session notifications`);

      if (hasAlert) {
        badgeEl.classList.add("is-alert");
      } else if (hasWarning) {
        badgeEl.classList.add("is-warning");
      }
    });
  }

  function maybeToastTopNotification(items) {
    if (!items.length || typeof window.showDashboardToast !== "function") return;

    const signature = items.map((item) => item.key || `${item.type}:${item.title}:${item.body}`).join("|");
    if (signature === lastSignature) return;
    lastSignature = signature;

    const top = items[0];
    window.showDashboardToast(top.title);
  }

  function presentItems(items) {
    renderNotifications(items);
    updateNavBadges(items);
    maybeToastTopNotification(items);
    return items;
  }

  async function refreshNotifications() {
    const history = await loadHistory();
    return presentItems(buildNotifications(history.slice(-16)));
  }

  async function loadHistory() {
    const backendHistory = await fetchHistory();
    return historyHelpers?.sortHistory?.(
      historyHelpers?.dedupeHistory?.(backendHistory.length ? backendHistory : readLocalHistory()) || (backendHistory.length ? backendHistory : readLocalHistory()),
      "asc"
    ) || [];
  }

  window.PrepGenieNotifications = {
    refresh: refreshNotifications,
    buildNotifications,
    loadHistory,
    present: presentItems
  };

  refreshNotifications();
})();


