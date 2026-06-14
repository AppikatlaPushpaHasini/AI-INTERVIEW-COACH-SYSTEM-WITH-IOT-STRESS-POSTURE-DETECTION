(function () {
  const speechApi = window.speechSynthesis;
  let availableVoices = [];
  let voiceReady = false;
  let lastSpokenText = "";

  function setVoiceUi(state, note) {
    const statusEl = document.getElementById("voicebotStatus");
    const statusTextEl = document.getElementById("voicebotStatusText");
    const noteEl = document.getElementById("voicebotNote");
    const replayBtn = document.getElementById("voiceReplayBtn");
    const stopBtn = document.getElementById("voiceStopBtn");

    if (statusEl) {
      statusEl.classList.toggle("active", state === "speaking");
    }

    if (statusTextEl) {
      statusTextEl.textContent =
        state === "speaking" ? "Speaking" :
        state === "unsupported" ? "Unavailable" :
        state === "stopped" ? "Stopped" :
        "Ready";
    }

    if (noteEl && note) {
      noteEl.textContent = note;
    }

    if (replayBtn) {
      replayBtn.disabled = !lastSpokenText;
    }

    if (stopBtn) {
      stopBtn.disabled = state !== "speaking";
    }
  }

  function getLanguage() {
    return localStorage.getItem("lang") || "en";
  }

  function getLanguageCode() {
    const lang = getLanguage();
    if (lang === "hi") return "hi-IN";
    if (lang === "te") return "te-IN";
    return "en-US";
  }

  function loadVoices() {
    if (!speechApi) return [];
    availableVoices = speechApi.getVoices() || [];
    voiceReady = availableVoices.length > 0;
    return availableVoices;
  }

  function chooseVoice(langCode) {
    if (!availableVoices.length) loadVoices();
    if (!availableVoices.length) return null;

    const normalized = String(langCode || "en-US").toLowerCase();
    const shortLang = normalized.split("-")[0];

    return (
      availableVoices.find((voice) => String(voice.lang || "").toLowerCase() === normalized) ||
      availableVoices.find((voice) => String(voice.lang || "").toLowerCase().startsWith(shortLang)) ||
      availableVoices.find((voice) => /female|zira|heera|samantha|google/i.test(String(voice.name || ""))) ||
      availableVoices[0]
    );
  }

  function sanitizeText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .trim();
  }

  function cancel() {
    if (!speechApi) return;
    speechApi.cancel();
    setVoiceUi("stopped", "Voice playback stopped. You can replay the latest coach reply anytime.");
  }

  function isSupported() {
    return Boolean(window.SpeechSynthesisUtterance && speechApi);
  }

  async function speak(text, options = {}) {
    const finalText = sanitizeText(text);
    if (!finalText) {
      return { ok: false, reason: "empty_text" };
    }

    if (!isSupported()) {
      console.warn("Speech synthesis is not supported in this browser.");
      setVoiceUi("unsupported", "This browser does not support voice playback for the coach assistant.");
      return { ok: false, reason: "unsupported" };
    }

    lastSpokenText = finalText;
    const langCode = options.lang || getLanguageCode();
    loadVoices();

    if (!voiceReady) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      loadVoices();
    }

    if (speechApi.speaking || speechApi.pending) {
      speechApi.cancel();
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(finalText);
      const selectedVoice = chooseVoice(langCode);

      utterance.lang = langCode;
      utterance.voice = selectedVoice;
      utterance.rate = typeof options.rate === "number" ? options.rate : 0.96;
      utterance.pitch = typeof options.pitch === "number" ? options.pitch : 1;
      utterance.volume = typeof options.volume === "number" ? options.volume : 1;

      utterance.onstart = () => {
        setVoiceUi("speaking", "Voice assistant is speaking the latest coaching reply.");
      };
      utterance.onend = () => {
        setVoiceUi("ready", "Latest coach reply is ready. Use Speak Reply to hear it again.");
        resolve({ ok: true });
      };
      utterance.onerror = (event) => {
        console.warn("Voice bot speech error:", event.error);
        setVoiceUi("ready", "Voice playback had an issue. You can try Speak Reply again.");
        resolve({ ok: false, reason: event.error || "speech_error" });
      };

      speechApi.speak(utterance);
    });
  }

  function toggle(text, options = {}) {
    if (!isSupported()) return { ok: false, reason: "unsupported" };
    if (speechApi.speaking) {
      cancel();
      return { ok: true, stopped: true };
    }
    return speak(text, options);
  }

  if (speechApi) {
    loadVoices();
    speechApi.onvoiceschanged = () => {
      loadVoices();
    };
  }

  function replayLast() {
    if (!lastSpokenText) {
      setVoiceUi("ready", "Ask the coach once and the latest reply will be available for replay here.");
      return { ok: false, reason: "no_reply" };
    }
    return speak(lastSpokenText);
  }

  window.PrepGenieVoiceBot = {
    speak,
    toggle,
    replayLast,
    cancel,
    isSupported,
    getVoices: () => availableVoices.slice(),
    getLanguageCode
  };

  window.speak = function speakCompat(text, options) {
    return window.PrepGenieVoiceBot.speak(text, options);
  };

  window.replayCoachReply = function replayCoachReply() {
    return window.PrepGenieVoiceBot.replayLast();
  };

  window.stopCoachVoice = function stopCoachVoice() {
    return window.PrepGenieVoiceBot.cancel();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setVoiceUi(isSupported() ? "ready" : "unsupported", isSupported()
        ? "Ask the coach once and the latest reply will be available for replay here."
        : "This browser does not support voice playback for the coach assistant.");
    });
  } else {
    setVoiceUi(isSupported() ? "ready" : "unsupported", isSupported()
      ? "Ask the coach once and the latest reply will be available for replay here."
      : "This browser does not support voice playback for the coach assistant.");
  }
})();
