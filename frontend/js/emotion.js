(function initPrepGenieEmotion() {
  const API_URL = window.PrepGenieConfig?.API_BASE || 'http://localhost:5000/api';
  const emotionEl = document.getElementById('emotion');
  const videoEl = document.getElementById('video');
  const answerEl = document.getElementById('answer');
  const stressEl = document.getElementById('stress');
  const postureEl = document.getElementById('posture');
  const feedbackListEl = document.getElementById('feedbackList');
  const cameraStatusEl = document.getElementById('cameraStatus');

  if (!emotionEl || !videoEl) {
    return;
  }

  const state = {
    currentEmotion: 'Neutral',
    currentDetail: 'Monitoring mood signals from delivery and camera stability.',
    timer: null,
    lastPopupKey: '',
    audioBusy: false
  };

  function setEmotion(label, detail) {
    state.currentEmotion = label;
    state.currentDetail = detail;
    emotionEl.textContent = `${label} - ${detail}`;
  }

  function showPopup(message, key = message) {
    if (state.lastPopupKey === key) return;
    state.lastPopupKey = key;

    if (typeof window.showTipPopup === 'function') {
      window.showTipPopup(message);
    }

    setTimeout(() => {
      if (state.lastPopupKey === key) state.lastPopupKey = '';
    }, 6000);
  }

  function getFeedbackText() {
    return Array.from(feedbackListEl?.querySelectorAll('.feedback-item') || [])
      .map((item) => item.textContent.trim())
      .join(' ')
      .toLowerCase();
  }

  function inferEmotionFromSession() {
    const answer = String(answerEl?.value || '').trim();
    const scoreText = String(document.getElementById('score')?.textContent || '0');
    const score = Number(scoreText.replace('%', '')) || 0;
    const stress = String(stressEl?.textContent || '').toLowerCase();
    const posture = String(postureEl?.textContent || '').toLowerCase();
    const cameraStatus = String(cameraStatusEl?.textContent || '').toLowerCase();
    const feedbackText = getFeedbackText();
    const words = answer.split(/\s+/).filter(Boolean).length;

    if (cameraStatus.includes('blocked') || cameraStatus.includes('required')) {
      return {
        emotion: 'Unavailable',
        detail: 'Camera access is limited, so emotion monitoring is running in fallback mode.'
      };
    }

    if (stress.includes('high') || feedbackText.includes('too brief') || words < 12) {
      return {
        emotion: 'Tense',
        detail: 'Your session signals suggest pressure. Slow down and answer in shorter, calmer steps.'
      };
    }

    if (stress.includes('moderate') || posture.includes('adjust') || score < 60) {
      return {
        emotion: 'Focused',
        detail: 'You are engaged, but a steadier pace and clearer examples would improve delivery.'
      };
    }

    if (score >= 75 && !posture.includes('adjust')) {
      return {
        emotion: 'Confident',
        detail: 'Your current delivery looks balanced and steady. Keep the same rhythm.'
      };
    }

    return {
      emotion: 'Neutral',
      detail: 'Your mood signals look stable. Keep eye contact and clear structure.'
    };
  }

  function buildEmotionPopup(snapshot) {
    const answer = String(snapshot.answer || '').trim();
    const words = answer.split(/\s+/).filter(Boolean).length;
    const question = String(snapshot.question || '').toLowerCase();
    const round = String(snapshot.round || '').toLowerCase();
    const score = Number(String(snapshot.score || '0').replace('%', '')) || 0;
    const stress = String(snapshot.stress || '').toLowerCase();
    const posture = String(snapshot.posture || '').toLowerCase();
    const cameraStatus = String(snapshot.cameraStatus || '').toLowerCase();
    const feedbackText = Array.isArray(snapshot.feedback) ? snapshot.feedback.join(' ').toLowerCase() : '';

    if (cameraStatus.includes('blocked') || cameraStatus.includes('required')) {
      return {
        key: 'camera-guidance',
        message: 'Emotion coach: camera access is limited, so posture and mood guidance are running in fallback mode.'
      };
    }

    if (stress.includes('high') && posture.includes('adjust')) {
      return {
        key: 'high-stress-posture',
        message: 'Emotion coach: you look tense and off-center. Relax your shoulders, sit upright, and answer one point at a time.'
      };
    }

    if (stress.includes('high')) {
      return {
        key: 'high-stress',
        message: 'Emotion coach: stress looks high right now. Pause for a second, breathe out, and restart with a calmer opening line.'
      };
    }

    if (posture.includes('adjust')) {
      return {
        key: 'posture-adjust',
        message: 'Emotion coach: your posture needs a quick correction. Center your face, lift your chin slightly, and keep still while speaking.'
      };
    }

    if (words > 0 && words < 12) {
      return {
        key: 'short-answer',
        message: 'Emotion coach: your answer is very short. Add one real example and one result so you sound more confident.'
      };
    }

    if (round === 'coding' && !/complexity|o\(|edge case|array|loop|function/i.test(answer)) {
      return {
        key: 'coding-depth',
        message: 'Emotion coach: for coding rounds, explain the approach, complexity, and one edge case to sound more interview-ready.'
      };
    }

    if (round === 'technical' && !/because|works|example|system|api|database/i.test(answer)) {
      return {
        key: 'technical-depth',
        message: 'Emotion coach: your technical answer needs more reasoning. Explain why it works and give one practical example.'
      };
    }

    if (round === 'behaviour' && /challenge|failure|conflict|stress/i.test(question) && !/result|learned|resolved|handled/i.test(answer)) {
      return {
        key: 'behaviour-result',
        message: 'Emotion coach: this behavioural answer needs a clearer result and learning. Finish with what changed because of your action.'
      };
    }

    if (feedbackText.includes('example')) {
      return {
        key: 'missing-example',
        message: 'Emotion coach: your content will feel more convincing if you add one concrete project or team example.'
      };
    }

    if (score >= 75 && !stress.includes('high') && !posture.includes('adjust')) {
      return {
        key: 'strong-session',
        message: 'Emotion coach: this session looks strong. Keep the same calm pace and finish your answer with a crisp result.'
      };
    }

    if (stress.includes('moderate')) {
      return {
        key: 'moderate-stress',
        message: 'Emotion coach: you are stable, but a slower pace and cleaner sentence flow will improve your presence.'
      };
    }

    return {
      key: 'steady-session',
      message: 'Emotion coach: your delivery looks steady. Keep eye contact and stay consistent with your answer structure.'
    };
  }

  async function analyzeVoiceEmotion() {
    const settings = typeof window.getInterviewSettings === 'function'
      ? window.getInterviewSettings()
      : { autoVoiceEmotion: true };

    if (!settings.autoVoiceEmotion) return null;

    if (window.PrepGenieVoiceEmotion && typeof window.PrepGenieVoiceEmotion.analyze === 'function') {
      const result = await window.PrepGenieVoiceEmotion.analyze();
      return result || null;
    }

    if (state.audioBusy) return null;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    if (!window.MediaRecorder) return null;

    state.audioBusy = true;
    let stream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      const result = await new Promise((resolve) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };

        recorder.onerror = () => resolve(null);

        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
            const formData = new FormData();
            formData.append('audio', blob, 'emotion-audio.webm');

            const response = await fetch(`${API_URL}/emotion`, {
              method: 'POST',
              body: formData
            });

            if (!response.ok) {
              resolve(null);
              return;
            }

            const data = await response.json();
            resolve(data?.emotion || null);
          } catch (error) {
            resolve(null);
          }
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 2500);
      });

      return result;
    } catch (error) {
      return null;
    } finally {
      state.audioBusy = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  }

  function normalizeBackendEmotion(value) {
    if (value && typeof value === 'object' && value.emotion) {
      return value;
    }

    const text = String(value || '').toLowerCase();
    if (!text) return null;
    if (text.includes('happy') || text.includes('excited')) {
      return { emotion: 'Positive', detail: 'Your voice energy sounds engaged and upbeat.' };
    }
    if (text.includes('sad') || text.includes('calm')) {
      return { emotion: 'Calm', detail: 'Your voice sounds low-pressure and steady.' };
    }
    if (text.includes('neutral')) {
      return { emotion: 'Neutral', detail: 'Your voice tone sounds stable and controlled.' };
    }
    if (text.includes('error')) {
      return null;
    }
    return { emotion: 'Observed', detail: `Voice analysis detected: ${value}.` };
  }

  async function refreshEmotion() {
    const snapshot = {
      round: document.getElementById('roundType')?.value || 'behaviour',
      question: getText('question', ''),
      score: getText('score', '0%'),
      stress: getText('stress', 'Unknown'),
      posture: getText('posture', 'Checking'),
      cameraStatus: getText('cameraStatus', ''),
      answer: String(answerEl?.value || ''),
      feedback: Array.from(feedbackListEl?.querySelectorAll('.feedback-item') || []).map((item) => item.textContent.trim()).filter(Boolean)
    };

    const fallback = inferEmotionFromSession();
    setEmotion(fallback.emotion, fallback.detail);

    const backendEmotion = await analyzeVoiceEmotion();
    const normalized = normalizeBackendEmotion(backendEmotion);

    if (normalized) {
      setEmotion(normalized.emotion, normalized.detail);
    }

    const popup = buildEmotionPopup({
      ...snapshot,
      stress: getText('stress', snapshot.stress),
      posture: getText('posture', snapshot.posture),
      score: getText('score', snapshot.score)
    });
    showPopup(popup.message, popup.key);
  }

  window.PrepGenieEmotion = {
    refresh: refreshEmotion,
    getState() {
      return {
        emotion: state.currentEmotion,
        detail: state.currentDetail
      };
    },
    destroy() {
      if (state.timer) clearInterval(state.timer);
      state.timer = null;
    }
  };

  refreshEmotion();
  state.timer = setInterval(refreshEmotion, 12000);
})();
