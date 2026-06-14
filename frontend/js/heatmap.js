const HEATMAP_API_URL = window.PrepGenieConfig?.API_BASE || "http://localhost:5000/api";

(function initPrepGenieHeatmap() {
  const canvas = document.getElementById("heatmap");

  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  let chart = null;

  function parseFeedback(feedback) {
    if (Array.isArray(feedback)) return feedback;
    if (typeof feedback === "string" && feedback.trim()) return [feedback];
    return [];
  }

  function readLocalHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem("reportHistory")) || [];
      const history = stored.map((item, index) => ({
        score: Number(item.score) || 0,
        round: item.round || "general",
        suggestion: item.suggestion || "",
        feedback: parseFeedback(item.feedback),
        stress: item.stress || localStorage.getItem("lastStress") || "Calm",
        posture: item.posture || localStorage.getItem("lastPosture") || "Checking",
        date: item.date || new Date(Date.now() - index * 60000).toISOString()
      }));

      if (history.length) return history;

      const lastScore = Number(localStorage.getItem("lastScore")) || 0;
      const lastFeedback = parseFeedback(JSON.parse(localStorage.getItem("lastFeedback") || "[]"));
      const lastSuggestion = localStorage.getItem("lastSuggestion") || "";

      if (!lastScore && !lastFeedback.length && !lastSuggestion) {
        return [];
      }

      return [{
        score: lastScore,
        round: "latest",
        suggestion: lastSuggestion,
        feedback: lastFeedback,
        stress: localStorage.getItem("lastStress") || "Calm",
        posture: localStorage.getItem("lastPosture") || "Checking",
        date: new Date().toISOString()
      }];
    } catch (error) {
      console.warn("Heatmap local history error:", error.message);
      return [];
    }
  }

  async function fetchHistory() {
    try {
      const data = window.PrepGenieConfig?.fetchApiJson
        ? await window.PrepGenieConfig.fetchApiJson("/history", {}, { timeoutMs: 6000 })
        : await fetch(`${HEATMAP_API_URL}/history`).then((response) => {
            if (!response.ok) throw new Error("History request failed");
            return response.json();
          });
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function average(values) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  function stressPenalty(stress) {
    const normalized = String(stress || "").toLowerCase();
    if (normalized.includes("high")) return 35;
    if (normalized.includes("moderate")) return 18;
    return 5;
  }

  function posturePenalty(posture) {
    const normalized = String(posture || "").toLowerCase();
    if (normalized.includes("adjust") || normalized.includes("unavailable")) return 28;
    if (normalized.includes("checking")) return 12;
    return 4;
  }

  function buildHeatmapMetrics(history) {
    if (!history.length) {
      return {
        labels: ["Communication", "Confidence", "Technical Depth", "Calmness", "Consistency"],
        values: [0, 0, 0, 0, 0]
      };
    }

    const scores = history.map((item) => Number(item.score) || 0);
    const feedbackText = history.flatMap((item) => parseFeedback(item.feedback)).join(" ").toLowerCase();
    const technicalRounds = history.filter((item) => ["technical", "coding"].includes(String(item.round).toLowerCase()));
    const technicalScores = technicalRounds.map((item) => Number(item.score) || 0);
    const calmnessScores = history.map((item) => Math.max(0, 100 - stressPenalty(item.stress)));
    const postureScores = history.map((item) => Math.max(0, 100 - posturePenalty(item.posture)));
    const scoreSpread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 0;

    let communication = average(scores);
    if (feedbackText.includes("short")) communication = Math.max(0, communication - 15);
    if (feedbackText.includes("example")) communication = Math.max(0, communication - 8);

    let confidence = Math.round((average(scores) + average(postureScores)) / 2);
    if (feedbackText.includes("confident")) confidence = Math.min(100, confidence + 5);

    let technicalDepth = technicalScores.length ? average(technicalScores) : average(scores);
    if (feedbackText.includes("complexity")) technicalDepth = Math.max(0, technicalDepth - 10);
    if (feedbackText.includes("technical reasoning")) technicalDepth = Math.max(0, technicalDepth - 8);

    const calmness = Math.round((average(calmnessScores) + average(postureScores)) / 2);
    const consistency = Math.max(0, 100 - scoreSpread * 2);

    return {
      labels: ["Communication", "Confidence", "Technical Depth", "Calmness", "Consistency"],
      values: [
        Math.min(100, communication),
        Math.min(100, confidence),
        Math.min(100, technicalDepth),
        Math.min(100, calmness),
        Math.min(100, consistency)
      ]
    };
  }

  function renderChart(currentMetrics, overallMetrics) {
    if (chart) {
      chart.destroy();
    }

    chart = new Chart(canvas.getContext("2d"), {
      type: "radar",
      data: {
        labels: overallMetrics.labels,
        datasets: [
          {
            label: "Current Session",
            data: currentMetrics.values,
            borderColor: "#138a52",
            backgroundColor: "rgba(19, 138, 82, 0.22)",
            pointBackgroundColor: "#138a52",
            pointBorderColor: "#ffffff",
            pointRadius: 4
          },
          {
            label: "Overall Sessions",
            data: overallMetrics.values,
            borderColor: "#0d6038",
            backgroundColor: "rgba(13, 96, 56, 0.10)",
            pointBackgroundColor: "#0d6038",
            pointBorderColor: "#ffffff",
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              backdropColor: "transparent"
            },
            grid: {
              color: "rgba(19, 83, 49, 0.12)"
            },
            angleLines: {
              color: "rgba(19, 83, 49, 0.12)"
            },
            pointLabels: {
              color: "#698174",
              font: {
                size: 12
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true
          }
        }
      }
    });
  }

  async function refreshHeatmap() {
    const backendHistory = await fetchHistory();
    const history = backendHistory.length ? backendHistory : readLocalHistory();
    const overallHistory = history.slice(-12);
    const currentSession = history.length ? [history[history.length - 1]] : [];
    renderChart(
      buildHeatmapMetrics(currentSession),
      buildHeatmapMetrics(overallHistory)
    );
  }

  window.PrepGenieHeatmap = {
    refresh: refreshHeatmap,
    destroy() {
      if (chart) {
        chart.destroy();
        chart = null;
      }
    }
  };

  refreshHeatmap();
})();
