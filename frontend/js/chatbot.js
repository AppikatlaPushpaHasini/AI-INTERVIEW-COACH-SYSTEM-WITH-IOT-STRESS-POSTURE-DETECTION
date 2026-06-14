const coachTranslations = {
  hi: {
    empty: "????? ???? ???? ?????? ??? ????????, ???????, ??????, ?????, ??????????, ????? ?? ???????? ??? ??? ?? ???? ????",
    fallback: "??? ????????, ???????, ??????, ?????, ??????????, ????? ?? ???????? ?? ????? ?????? ??? ??? ?? ???? ???? ???? ???? ????? ?? ?????? ??????"
  },
  en: {
    empty: "Type your question first. I can help with interview answers, stress, posture, camera, recording, timer, and settings.",
    fallback: "I can help with interview answers, stress, posture, camera, recording, timer, and settings. Ask me a more specific question and I will coach you from the current session."
  }
};

function getCoachLanguage() {
  return localStorage.getItem("lang") || "en";
}

function getText(id, fallback = "") {
  const element = document.getElementById(id);
  return element ? String(element.textContent || element.innerText || fallback).trim() : fallback;
}

function getValue(id, fallback = "") {
  const element = document.getElementById(id);
  return element ? String(element.value || fallback).trim() : fallback;
}

function getSessionSnapshot() {
  return {
    round: document.getElementById("roundType")?.value || "behaviour",
    question: getText("question", "Interview question"),
    score: getText("score", "0%"),
    stress: getText("stress", "Unknown"),
    stressDetail: getText("stressDetail", ""),
    posture: getText("posture", "Checking"),
    postureDetail: getText("postureDetail", ""),
    suggestion: getText("liveSuggestion", ""),
    cameraStatus: getText("cameraStatus", ""),
    cameraHelp: getText("cameraHelp", ""),
    recordingStatus: getText("recordingStatus", ""),
    timer: getText("timer", ""),
    answer: getValue("answer", ""),
    feedback: Array.from(document.querySelectorAll("#feedbackList .feedback-item")).map((item) => item.textContent.trim()).filter(Boolean)
  };
}

function normalizeRound(round) {
  return {
    hr: "HR",
    technical: "Technical",
    coding: "Coding",
    behaviour: "Behavioural"
  }[round] || round;
}

function buildInterviewReply(snapshot) {
  const feedbackText = snapshot.feedback.length
    ? snapshot.feedback.slice(0, 2).join(" ")
    : "No detailed feedback is visible yet.";

  return `You are in the ${normalizeRound(snapshot.round)} round. Current score is ${snapshot.score}. For this question, keep your answer tied to: ${snapshot.question}. Right now the session feedback says: ${feedbackText}`;
}

function buildStressReply(snapshot) {
  if (/high/i.test(snapshot.stress)) {
    return `Your live stress status is ${snapshot.stress}. ${snapshot.stressDetail || "Slow the pace, pause between points, and answer in short structured sentences."}`;
  }

  if (/moderate/i.test(snapshot.stress)) {
    return `Your stress level is ${snapshot.stress}. ${snapshot.stressDetail || "You are stable, but your delivery will improve if you slow down slightly and use one clear example."}`;
  }

  return `Your stress level is ${snapshot.stress}. ${snapshot.stressDetail || "Your delivery looks steady. Keep the same pace and breathing pattern."}`;
}

function buildPostureReply(snapshot) {
  if (/adjust/i.test(snapshot.posture) || /unavailable/i.test(snapshot.posture)) {
    return `Posture status is ${snapshot.posture}. ${snapshot.postureDetail || snapshot.cameraHelp || "Sit upright, keep your shoulders open, and center your face in the frame."}`;
  }

  return `Posture status is ${snapshot.posture}. ${snapshot.postureDetail || "Your camera framing looks fine. Keep your face centered and your head level."}`;
}

function buildCameraReply(snapshot) {
  return `Camera status: ${snapshot.cameraStatus || "unknown"}. ${snapshot.cameraHelp || "If the camera is not live, allow browser permission and run the page from localhost or HTTPS."}`;
}

function buildRecordingReply(snapshot) {
  if (/live/i.test(snapshot.recordingStatus)) {
    return `Recording is already active. Current recorder status is: ${snapshot.recordingStatus}. Click the Record button again when you want to stop and save the session.`;
  }

  return `Recorder status is ${snapshot.recordingStatus || "idle"}. To record the session, enable camera and microphone permission first, then press Record. A popup should confirm when recording starts.`;
}

function buildTimerReply(snapshot) {
  return `The session timer is currently ${snapshot.timer || "not visible"}. If you restart the interview page, the timer resets to 30 minutes and keeps running during practice.`;
}

function buildSettingsReply(snapshot) {
  return `For settings issues, first check camera status (${snapshot.cameraStatus || "unknown"}), recorder status (${snapshot.recordingStatus || "unknown"}), and current stress/posture signals (${snapshot.stress}, ${snapshot.posture}). If something is not working, refresh the page on localhost and allow browser permissions again.`;
}

function buildAnswerQualityReply(snapshot) {
  const answerLength = snapshot.answer.split(/\s+/).filter(Boolean).length;

  if (!snapshot.answer.trim()) {
    return "You have not entered an answer yet. Start with a clear opening, add one concrete example, and finish with the result or learning.";
  }

  if (answerLength < 20) {
    return `Your current answer is short at about ${answerLength} words. Add more explanation, one real example, and a stronger closing result.`;
  }

  if (snapshot.feedback.length) {
    return `Based on your current answer, the top coaching point is: ${snapshot.feedback[0]}. After that, improve this: ${snapshot.feedback[1] || snapshot.suggestion || "Make the example more specific."}`;
  }

  return "Your answer has enough length to work with. Make sure it stays structured, relevant to the question, and ends with a clear result.";
}

function buildCoachReply(input, snapshot) {
  const lang = getCoachLanguage();
  const normalized = input.toLowerCase().trim();

  if (!normalized) {
    return coachTranslations[lang]?.empty || coachTranslations.en.empty;
  }

  if (/(stress|nervous|anxious|pressure)/i.test(normalized)) {
    return buildStressReply(snapshot);
  }

  if (/(posture|sit|camera angle|face|frame|position)/i.test(normalized)) {
    return buildPostureReply(snapshot);
  }

  if (/(camera|webcam|permission|video)/i.test(normalized)) {
    return buildCameraReply(snapshot);
  }

  if (/(record|recording|save video|download video)/i.test(normalized)) {
    return buildRecordingReply(snapshot);
  }

  if (/(timer|time left|countdown)/i.test(normalized)) {
    return buildTimerReply(snapshot);
  }

  if (/(setting|settings|toggle|theme|language|hindi|english|not working|issue|problem|error)/i.test(normalized)) {
    return buildSettingsReply(snapshot);
  }

  if (/(feedback|answer|improve|improvement|score|how am i doing|how is my answer)/i.test(normalized)) {
    return buildAnswerQualityReply(snapshot);
  }

  if (/(hr|technical|coding|behaviour|behavior|interview|question|star)/i.test(normalized)) {
    return buildInterviewReply(snapshot);
  }

  return coachTranslations[lang]?.fallback || coachTranslations.en.fallback;
}

async function sendMessage() {
  const inputEl = document.getElementById("chatInput");
  const outputEl = document.getElementById("chatOutput");
  if (!inputEl || !outputEl) return;

  const input = inputEl.value.trim();
  const snapshot = getSessionSnapshot();
  const finalReply = buildCoachReply(input, snapshot);

  outputEl.innerText = finalReply;

  const settings = typeof window.getInterviewSettings === "function"
    ? window.getInterviewSettings()
    : { autoCoachVoice: true };

  if (settings.autoCoachVoice && window.PrepGenieVoiceBot && typeof window.PrepGenieVoiceBot.speak === "function") {
    await window.PrepGenieVoiceBot.speak(finalReply);
  } else if (settings.autoCoachVoice && typeof speak === "function") {
    await speak(finalReply);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("chatInput");
  if (!inputEl) return;

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
});
