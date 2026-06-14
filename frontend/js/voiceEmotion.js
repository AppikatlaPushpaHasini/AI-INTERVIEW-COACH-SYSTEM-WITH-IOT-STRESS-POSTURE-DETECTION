(function () {
  const API_URL = window.PrepGenieConfig?.API_BASE || "http://localhost:5000/api";
  const state = {
    busy: false,
    lastEmotion: null,
    lastDetail: "",
    lastSource: "fallback"
  };

  function setVoiceEmotionUi(result) {
    const emotionEl = document.getElementById("voiceEmotionValue");
    const detailEl = document.getElementById("voiceEmotionDetail");
    const sourceEl = document.getElementById("voiceEmotionSource");
    const buttonEl = document.getElementById("voiceEmotionBtn");

    if (emotionEl) {
      emotionEl.textContent = result?.emotion || "Monitoring";
    }

    if (detailEl) {
      detailEl.textContent = result?.detail || "Voice tone guidance will appear here after analysis.";
    }

    if (sourceEl) {
      const source = result?.source === "backend" ? "Live audio analysis" : "Session-based fallback";
      sourceEl.textContent = source;
    }

    if (buttonEl) {
      buttonEl.textContent = state.busy ? "Analyzing Voice..." : "Analyze Voice Emotion";
      buttonEl.disabled = state.busy;
    }
  }

  function getSessionSnapshot() {
    const answer = String(document.getElementById("answer")?.value || "").trim();
    const score = Number(String(document.getElementById("score")?.textContent || "0").replace("%", "")) || 0;
    const stress = String(document.getElementById("stress")?.textContent || "").toLowerCase();
    const posture = String(document.getElementById("posture")?.textContent || "").toLowerCase();
    const cameraStatus = String(document.getElementById("cameraStatus")?.textContent || "").toLowerCase();
    const feedback = Array.from(document.querySelectorAll("#feedbackList .feedback-item"))
      .map((item) => item.textContent.trim())
      .filter(Boolean);

    return {
      answer,
      score,
      stress,
      posture,
      cameraStatus,
      feedback,
      words: answer.split(/\s+/).filter(Boolean).length
    };
  }

  function inferFromSession(snapshot) {
    const feedbackText = snapshot.feedback.join(" ").toLowerCase();

    if (snapshot.cameraStatus.includes("blocked") || snapshot.cameraStatus.includes("required")) {
      return {
        emotion: "Unavailable",
        detail: "Voice emotion is using fallback mode because live device access is limited.",
        source: "fallback"
      };
    }

    if (snapshot.stress.includes("high") || snapshot.words < 10) {
      return {
        emotion: "Tense",
        detail: "Your voice delivery likely sounds pressured. Pause slightly and slow your opening lines.",
        source: "fallback"
      };
    }

    if (snapshot.stress.includes("moderate") || snapshot.posture.includes("adjust")) {
      return {
        emotion: "Focused",
        detail: "You sound engaged, but a steadier pace and calmer breathing would improve confidence.",
        source: "fallback"
      };
    }

    if (snapshot.score >= 75 && !feedbackText.includes("short")) {
      return {
        emotion: "Confident",
        detail: "Your answer pattern suggests a stable and self-assured speaking tone.",
        source: "fallback"
      };
    }

    return {
      emotion: "Neutral",
      detail: "Your voice pattern appears stable. Keep your pace clear and consistent.",
      source: "fallback"
    };
  }

  function normalizeBackendEmotion(value) {
    const text = String(value || "").toLowerCase().trim();
    if (!text || text.includes("error")) return null;

    if (text.includes("happy") || text.includes("positive") || text.includes("excited")) {
      return {
        emotion: "Positive",
        detail: "Backend voice analysis detected a positive and engaged tone.",
        source: "backend"
      };
    }

    if (text.includes("neutral") || text.includes("calm")) {
      return {
        emotion: "Calm",
        detail: "Backend voice analysis suggests your tone is controlled and low-pressure.",
        source: "backend"
      };
    }

    if (text.includes("sad") || text.includes("stressed") || text.includes("angry")) {
      return {
        emotion: "Tense",
        detail: "Backend voice analysis suggests pressure in your tone. Slow down and relax your delivery.",
        source: "backend"
      };
    }

    return {
      emotion: "Observed",
      detail: `Backend voice analysis detected: ${value}.`,
      source: "backend"
    };
  }

  async function captureBackendEmotion() {
    if (state.busy) return null;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    if (!window.MediaRecorder) return null;

    state.busy = true;
    setVoiceEmotionUi({
      emotion: state.lastEmotion || "Listening",
      detail: "Capturing a short audio sample to estimate voice emotion.",
      source: state.lastSource || "fallback"
    });
    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      const rawEmotion = await new Promise((resolve) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };

        recorder.onerror = () => resolve(null);

        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
            const formData = new FormData();
            formData.append("audio", blob, "voice-emotion.webm");

            const response = await fetch(`${API_URL}/emotion`, {
              method: "POST",
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
          if (recorder.state !== "inactive") recorder.stop();
        }, 2200);
      });

      return normalizeBackendEmotion(rawEmotion);
    } catch (error) {
      return null;
    } finally {
      state.busy = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  }

  async function analyze() {
    const snapshot = getSessionSnapshot();
    const fallback = inferFromSession(snapshot);
    setVoiceEmotionUi(fallback);
    const backend = await captureBackendEmotion();
    const finalResult = backend || fallback;

    state.lastEmotion = finalResult.emotion;
    state.lastDetail = finalResult.detail;
    state.lastSource = finalResult.source;
    setVoiceEmotionUi(finalResult);

    return finalResult;
  }

  async function analyzeAndRender() {
    return analyze();
  }

  window.PrepGenieVoiceEmotion = {
    analyze,
    analyzeAndRender,
    getState() {
      return {
        emotion: state.lastEmotion,
        detail: state.lastDetail,
        source: state.lastSource
      };
    }
  };

  window.analyzeVoiceEmotionManually = function analyzeVoiceEmotionManually() {
    return window.PrepGenieVoiceEmotion.analyzeAndRender();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setVoiceEmotionUi({
        emotion: "Monitoring",
        detail: "Voice tone guidance will appear here after analysis.",
        source: "fallback"
      });
    });
  } else {
    setVoiceEmotionUi({
      emotion: "Monitoring",
      detail: "Voice tone guidance will appear here after analysis.",
      source: "fallback"
    });
  }
})();

