const API_URL = window.PrepGenieConfig?.API_BASE || 'http://localhost:5000/api';

(function initPrepGenieAnalytics() {
  const chartCanvas = document.getElementById('chart');
  const stressEl = document.getElementById('stress');
  const postureEl = document.getElementById('posture');
  const suggestionEl = document.getElementById('suggestion');

  if (!chartCanvas || !stressEl || !postureEl || !suggestionEl || typeof Chart === 'undefined') {
    return;
  }

  const state = {
    labels: [],
    dataPoints: [],
    lastSuggestion: '',
    alertPlayed: false,
    chart: null,
    refreshTimer: null
  };

  function stressToNumber(stress) {
    if (typeof stress === 'number') return stress;

    const normalized = String(stress || '').trim().toLowerCase();
    if (normalized === 'high') return 90;
    if (normalized === 'moderate' || normalized === 'medium') return 60;
    if (normalized === 'low' || normalized === 'calm') return 30;

    const parsed = Number(stress);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatStressLabel(value) {
    if (typeof value === 'string' && value.trim()) return value;
    const numeric = stressToNumber(value);
    if (numeric >= 75) return 'High';
    if (numeric >= 45) return 'Moderate';
    return 'Calm';
  }

  function formatPostureLabel(value) {
    if (!value) return 'Checking';
    return String(value);
  }

  function parseFeedback(feedback) {
    if (Array.isArray(feedback)) return feedback;
    if (typeof feedback === 'string' && feedback.trim()) return [feedback];
    return [];
  }

  function readLocalHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem('reportHistory')) || [];
      const history = stored.map((item, index) => ({
        score: Number(item.score) || 0,
        stress: item.stress || localStorage.getItem('lastStress') || 'Calm',
        posture: item.posture || localStorage.getItem('lastPosture') || 'Checking',
        suggestion: item.suggestion || '',
        feedback: parseFeedback(item.feedback),
        date: item.date || new Date(Date.now() - index * 60000).toISOString()
      }));

      if (history.length) return history;

      const lastScore = Number(localStorage.getItem('lastScore')) || 0;
      const lastStress = localStorage.getItem('lastStress') || '';
      const lastPosture = localStorage.getItem('lastPosture') || '';
      const lastSuggestion = localStorage.getItem('lastSuggestion') || '';
      const lastFeedback = parseFeedback(JSON.parse(localStorage.getItem('lastFeedback') || '[]'));

      if (!lastScore && !lastStress && !lastPosture && !lastSuggestion && !lastFeedback.length) {
        return [];
      }

      return [{
        score: lastScore,
        stress: lastStress || 'Calm',
        posture: lastPosture || 'Checking',
        suggestion: lastSuggestion,
        feedback: lastFeedback,
        date: new Date().toISOString()
      }];
    } catch (error) {
      console.warn('Unable to load local analytics history:', error.message);
      return [];
    }
  }

  function smartSuggestion({ score, stress, posture, emotion, feedback }) {
    const normalizedEmotion = String(emotion || '').toLowerCase();
    const normalizedStress = formatStressLabel(stress).toLowerCase();
    const normalizedPosture = String(posture || '').toLowerCase();
    const feedbackText = Array.isArray(feedback) ? feedback.join(' ').toLowerCase() : String(feedback || '').toLowerCase();

    if (normalizedEmotion === 'sad') return 'Try to sound more energetic and positive in delivery.';
    if (normalizedEmotion === 'angry') return 'Stay calm and composed so your answer feels professional.';
    if (normalizedStress === 'high') return 'Relax your pace, breathe slowly, and answer in short clear points.';
    if (normalizedPosture.includes('bad') || normalizedPosture.includes('adjust')) return 'Sit straight, keep your shoulders open, and stay centered on camera.';
    if (feedbackText.includes('short')) return 'Expand your answer with more depth and one clear example.';
    if (feedbackText.includes('example')) return 'Support your answer with a real project or measurable outcome.';
    if ((Number(score) || 0) < 50) return 'Structure your answer using situation, action, and result.';
    return 'Great communication. Keep your clarity and confidence steady.';
  }

  function showSuggestionPopup(text) {
    const div = document.createElement('div');
    div.textContent = text;
    div.className = 'popup';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  }

  function playAlertOnce() {
    if (state.alertPlayed) return;
    console.log('Analytics alert triggered');
    state.alertPlayed = true;
  }

  function ensureChart() {
    if (state.chart) return state.chart;

    state.chart = new Chart(chartCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: state.labels,
        datasets: [{
          label: 'Stress Trend',
          data: state.dataPoints,
          borderColor: '#138a52',
          backgroundColor: 'rgba(19, 138, 82, 0.16)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });

    return state.chart;
  }

  function updateChart(history) {
    state.labels.length = 0;
    state.dataPoints.length = 0;

    const source = Array.isArray(history) && history.length
      ? history.slice(-10)
      : [{ date: null, stress: 0 }];

    source.forEach((item, index) => {
      state.labels.push(item.date ? new Date(item.date).toLocaleTimeString() : `Point ${index + 1}`);
      state.dataPoints.push(stressToNumber(item.stress));
    });

    const chart = ensureChart();
    chart.update();
  }

  async function fetchHistory() {
    try {
      const data = window.PrepGenieConfig?.fetchApiJson
        ? await window.PrepGenieConfig.fetchApiJson('/history', {}, { timeoutMs: 6000 })
        : await fetch(`${API_URL}/history`).then(async (res) => {
            if (!res.ok) throw new Error('History request failed');
            return res.json();
          });
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('Unable to load analytics history:', error.message);
      return [];
    }
  }

  async function fetchIoTSummary() {
    try {
      return window.PrepGenieConfig?.fetchApiJson
        ? await window.PrepGenieConfig.fetchApiJson('/iot/summary?limit=20', {}, { timeoutMs: 6000 })
        : await fetch(`${API_URL}/iot/summary?limit=20`).then(async (res) => {
            if (!res.ok) throw new Error('IoT request failed');
            return res.json();
          });
    } catch (error) {
      return null;
    }
  }

  function renderFromSnapshot(snapshot) {
    if (!snapshot) {
      stressEl.textContent = '--';
      postureEl.textContent = '--';
      suggestionEl.textContent = 'No analytics data available yet.';
      return;
    }

    const stressLabel = formatStressLabel(snapshot.stress);
    const postureLabel = formatPostureLabel(snapshot.posture);
    const suggestion = smartSuggestion(snapshot);

    stressEl.textContent = stressLabel;
    postureEl.textContent = postureLabel;
    suggestionEl.textContent = suggestion;

    if (suggestion !== state.lastSuggestion) {
      showSuggestionPopup(suggestion);
      state.lastSuggestion = suggestion;
    }

    if (stressLabel === 'High' || /bad|adjust/i.test(postureLabel)) {
      playAlertOnce();
    } else {
      state.alertPlayed = false;
    }
  }

  async function refreshAnalytics() {
    const [backendHistory, iotSummary] = await Promise.all([fetchHistory(), fetchIoTSummary()]);
    const history = backendHistory.length ? backendHistory : readLocalHistory();
    const liveIoT = iotSummary && iotSummary.live ? iotSummary.live : null;
    const chartHistory = iotSummary && Array.isArray(iotSummary.recent) && iotSummary.recent.length
      ? iotSummary.recent
      : history;
    const latestHistory = history.length ? history[history.length - 1] : null;

    const snapshot = liveIoT
      ? {
          score: liveIoT.score ?? latestHistory?.score ?? 0,
          stress: liveIoT.stress ?? latestHistory?.stress ?? 0,
          posture: liveIoT.posture ?? latestHistory?.posture ?? 'Checking',
          emotion: liveIoT.emotion ?? '',
          feedback: latestHistory?.feedback ?? [],
          suggestion: latestHistory?.suggestion ?? ''
        }
      : latestHistory;

    updateChart(chartHistory);
    renderFromSnapshot(snapshot);
  }

  window.PrepGenieAnalytics = {
    refresh: refreshAnalytics,
    destroy() {
      if (state.refreshTimer) clearInterval(state.refreshTimer);
      state.refreshTimer = null;
      if (state.chart) {
        state.chart.destroy();
        state.chart = null;
      }
    }
  };

  refreshAnalytics();
  state.refreshTimer = setInterval(refreshAnalytics, 5000);
})();
