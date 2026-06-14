const API_URL = window.PrepGenieConfig?.API_BASE || 'http://localhost:5000/api';

function apiJson(path, options = {}, timeoutMs = 7000) {
    if (window.PrepGenieConfig?.fetchApiJson) {
        return window.PrepGenieConfig.fetchApiJson(path, options, { timeoutMs });
    }

    return fetch(`${API_URL}${path}`, options).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.message || data.error || `Request failed: ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return data;
    });
}

async function fetchExternalJson(url, timeoutMs = 3500) {
    if (window.PrepGenieConfig?.fetchWithTimeout) {
        const response = await window.PrepGenieConfig.fetchWithTimeout(url, {}, timeoutMs);
        return response.json();
    }

    const response = await fetch(url);
    return response.json();
}

window.PrepGenieAccess?.requireAuth();
const historyHelpers = window.PrepGenieHistory;

const questionEl = document.getElementById('question');
const answerEl = document.getElementById('answer');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score');
const stressEl = document.getElementById('stress');
const stressDetailEl = document.getElementById('stressDetail');
const postureEl = document.getElementById('posture');
const postureDetailEl = document.getElementById('postureDetail');
const feedbackListEl = document.getElementById('feedbackList');
const suggestionEl = document.getElementById('liveSuggestion');
const translatedEl = document.getElementById('translated');
const cameraStatusEl = document.getElementById('cameraStatus');
const cameraHelpEl = document.getElementById('cameraHelp');
const recordingStatusEl = document.getElementById('recordingStatus');
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('canvas');
const langSwitchEl = document.getElementById('langSwitch');
const iotDeviceStatusEl = document.getElementById('iotDeviceStatus');
const iotHeartRateEl = document.getElementById('iotHeartRate');
const iotTemperatureEl = document.getElementById('iotTemperature');
const iotSignalEl = document.getElementById('iotSignal');
const iotMovementEl = document.getElementById('iotMovement');
const iotLastSeenEl = document.getElementById('iotLastSeen');
const iotSummaryEl = document.getElementById('iotSummary');
const iotPacketsEl = document.getElementById('iotInterviewPackets');
const roundTypeEl = document.getElementById('roundType');
const activeRoundBadgeEl = document.getElementById('activeRoundBadge');
const roundCountdownBadgeEl = document.getElementById('roundCountdownBadge');
const roundAutoNoteEl = document.getElementById('roundAutoNote');

let recognition;
let recognitionActive = false;
let mediaStream;
let mediaRecorder;
let recordingChunks = [];
let isRecording = false;
let timerInterval;
let postureInterval;
let iotInterval;
let timeLeft = 30 * 60;
let currentRound = historyHelpers?.ROUND_ORDER?.[0] || 'hr';
let activeQuestionRound = currentRound;
let questionIndex = 0;
let currentStressStatus = 'Calm';
let currentPostureStatus = 'Checking';
let lastStressDetail = 'Calm and steady';
let lastPostureDetail = 'Align yourself with the frame';
let lastAnalysisSource = 'unknown';
let lastIoTSnapshot = null;
let activeSchedule = null;
let lastRoundChangeSignature = '';
const interviewSettingsDefaults = {
    autoCoachVoice: true,
    autoVoiceEmotion: true,
    emotionPopups: true,
    cameraSensitivity: 'standard'
};
const SESSION_TOTAL_SECONDS = 30 * 60;
const IOT_REFRESH_MS = 5 * 1000;
const ROUND_SEQUENCE = historyHelpers?.ROUND_ORDER?.length
    ? historyHelpers.ROUND_ORDER
    : ['hr', 'technical', 'coding', 'behaviour'];
const ROUND_DURATION_SECONDS = Math.floor(SESSION_TOTAL_SECONDS / ROUND_SEQUENCE.length);
const INTERVIEW_SCHEDULE_KEY = 'prepgenieInterviewSchedule';
let cameraMonitorState = {
    lastFaceBox: null,
    faceSupported: typeof window.FaceDetector !== 'undefined'
};

function getInterviewSettings() {
    try {
        return {
            ...interviewSettingsDefaults,
            ...(JSON.parse(localStorage.getItem('interviewSettings')) || {})
        };
    } catch (error) {
        return { ...interviewSettingsDefaults };
    }
}

function applyInterviewSettingsToUi() {
    const settings = getInterviewSettings();
    const autoCoachVoiceEl = document.getElementById('settingAutoCoachVoice');
    const autoVoiceEmotionEl = document.getElementById('settingAutoVoiceEmotion');
    const emotionPopupsEl = document.getElementById('settingEmotionPopups');
    const cameraSensitivityEl = document.getElementById('settingCameraSensitivity');

    if (autoCoachVoiceEl) autoCoachVoiceEl.checked = Boolean(settings.autoCoachVoice);
    if (autoVoiceEmotionEl) autoVoiceEmotionEl.checked = Boolean(settings.autoVoiceEmotion);
    if (emotionPopupsEl) emotionPopupsEl.checked = Boolean(settings.emotionPopups);
    if (cameraSensitivityEl) cameraSensitivityEl.value = settings.cameraSensitivity || 'standard';
}

function updateInterviewSetting(key, value) {
    const settings = getInterviewSettings();
    settings[key] = value;
    localStorage.setItem('interviewSettings', JSON.stringify(settings));
    applyInterviewSettingsToUi();
}

window.getInterviewSettings = getInterviewSettings;
window.updateInterviewSetting = updateInterviewSetting;

function stopExistingMediaStream() {
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
}

function setCameraHelp(message) {
    if (cameraHelpEl) cameraHelpEl.textContent = message;
}

function isIoTConnected(snapshot = lastIoTSnapshot) {
    return Boolean(window.PrepGenieIoT && typeof window.PrepGenieIoT.isConnected === 'function' && window.PrepGenieIoT.isConnected(snapshot));
}

function getEffectiveStressSnapshot() {
    if (isIoTConnected() && lastIoTSnapshot?.stress) {
        return {
            level: lastIoTSnapshot.stress,
            detail: lastIoTSnapshot.summary || lastIoTSnapshot.postureDetail || lastStressDetail
        };
    }

    return {
        level: currentStressStatus,
        detail: lastStressDetail
    };
}

function getEffectivePostureSnapshot() {
    if (isIoTConnected() && lastIoTSnapshot?.posture) {
        return {
            level: lastIoTSnapshot.posture,
            detail: lastIoTSnapshot.postureDetail || lastPostureDetail
        };
    }

    return {
        level: currentPostureStatus,
        detail: lastPostureDetail
    };
}

function renderIoTPanel(snapshot) {
    if (!iotDeviceStatusEl) return;

    const connected = isIoTConnected(snapshot);
    iotDeviceStatusEl.textContent = connected
        ? `${snapshot.deviceLabel || 'ESP32'} live`
        : 'Sensor offline';
    iotHeartRateEl.textContent = window.PrepGenieIoT?.formatHeartRate(snapshot) || '--';
    iotTemperatureEl.textContent = window.PrepGenieIoT?.formatTemperature(snapshot) || '--';
    iotSignalEl.textContent = window.PrepGenieIoT?.formatSignal(snapshot) || '--';
    iotMovementEl.textContent = window.PrepGenieIoT?.formatMovement(snapshot) || '--';
    iotLastSeenEl.textContent = window.PrepGenieIoT?.formatLastSeen(snapshot?.updatedAt) || 'No device data yet';
    iotSummaryEl.textContent = window.PrepGenieIoT?.buildStatusText(snapshot) || 'Waiting for ESP32 sensor feed.';
}

async function refreshIoTPanel() {
    if (!window.PrepGenieIoT) return;

    try {
        const summary = await window.PrepGenieIoT.getSummary(8);
        lastIoTSnapshot = summary?.live || null;
        renderIoTPanel(lastIoTSnapshot);
        window.PrepGenieIoT.renderPacketFeed(iotPacketsEl, summary?.recent, {
            title: 'Recent packets',
            limit: 6,
            layout: 'inline',
            emptyMessage: 'No ESP32 packets have been stored yet.'
        });
    } catch (error) {
        console.warn('IoT live feed unavailable:', error.message);
        renderIoTPanel(lastIoTSnapshot);
        window.PrepGenieIoT.renderPacketFeed(iotPacketsEl, [], {
            title: 'Recent packets',
            layout: 'inline',
            emptyMessage: 'Unable to load ESP32 packets from the backend.'
        });
    }
}

const questionBank = {
    hr: [
        'Tell me about yourself',
        'Why should we hire you?',
        'What are your strengths?',
        'What are your weaknesses?',
        'Why do you want this job?',
        'Where do you see yourself in 5 years?',
        'How do you handle pressure?',
        'Tell me about your biggest achievement'
    ],
    technical: [
        'What is OOP?',
        'Explain DBMS',
        'What is an API?',
        'What is normalization?',
        'What is recursion?',
        'What is Big O notation?',
        'Explain the difference between process and thread',
        'What is REST API?'
    ],
    coding: [
        'Write a program to reverse a string',
        'Check if a number is palindrome',
        'Find the largest number in an array',
        'Explain time complexity',
        'Implement binary search',
        'Check balanced parentheses',
        'Find duplicate elements in an array',
        'Explain merge sort'
    ],
    behaviour: [
        'Tell me about a challenge you faced',
        'Describe a conflict you resolved',
        'Give an example of teamwork',
        'How do you handle stress?',
        'Tell me about a failure and what you learned',
        'Describe a leadership experience',
        'How do you handle criticism?',
        'Describe a difficult situation you solved'
    ]
};

const uiTranslations = {
    en: {
        currentLang: 'English Mode',
        dashboard: 'Dashboard',
        interview: 'Interview',
        reports: 'Reports',
        admin: 'Admin',
        theme: 'Theme',
        pageTitle: 'Professional Interview Practice',
        pageSubtitle: 'Stay on camera, track your response quality, and receive live guidance while you practice.',
        heroTitle: 'Mock Interview Workspace',
        heroSubtitle: 'Practice with structured interview rounds, keep your delivery clear, and monitor score, stress, and posture without leaving the session.',
        scoreLabel: 'Live Score',
        scoreNote: 'Updated when your answer is analyzed.',
        stressLabel: 'Stress Level',
        stressNote: 'Estimated from answer quality and camera stability.',
        postureLabel: 'Posture',
        postureNote: 'Camera-based posture guidance appears live.',
        timerLabel: 'Timer',
        timerNote: 'The session timer keeps running during practice.',
        roundLabel: 'Current Round:',
        rounds: ['HR Round', 'Technical Round', 'Coding Round', 'Behaviour Round'],
        placeholder: 'Speak or type your answer...',
        chatPlaceholder: 'Ask something...',
        speak: 'Speak',
        stopSpeak: 'Stop Listening',
        record: 'Record',
        stopRecord: 'Stop Recording',
        analyze: 'Analyze Answer',
        next: 'Next Question',
        feedbackTitle: 'Live Feedback',
        defaultSuggestion: 'Your personalized suggestion will appear here after analysis.',
        defaultFeedback: 'Start speaking or type an answer to receive analysis feedback.',
        cameraMonitorTitle: 'Camera Monitor',
        enableCamera: 'Enable Camera',
        cameraHelp: 'Allow camera permission when prompted. If you opened the page directly as a file, use a local server.',
        stressDetailLabel: 'Stress',
        postureDetailLabel: 'Posture',
        askCoach: 'Ask Coach',
        coachReady: 'PrepGenie coach is ready to help.'
    },
    hi: {
        currentLang: 'हिंदी मोड',
        dashboard: 'डैशबोर्ड',
        interview: 'इंटरव्यू',
        reports: 'रिपोर्ट्स',
        admin: 'एडमिन',
        theme: 'थीम',
        pageTitle: 'प्रोफेशनल इंटरव्यू प्रैक्टिस',
        pageSubtitle: 'कैमरा ऑन रखें, अपने जवाब की क्वालिटी ट्रैक करें, और अभ्यास के दौरान लाइव गाइडेंस पाएं।',
        heroTitle: 'मॉक इंटरव्यू वर्कस्पेस',
        heroSubtitle: 'स्ट्रक्चर्ड इंटरव्यू राउंड्स के साथ अभ्यास करें और स्कोर, स्ट्रेस और पोस्चर को एक ही जगह मॉनिटर करें।',
        scoreLabel: 'लाइव स्कोर',
        scoreNote: 'जवाब के विश्लेषण के बाद यह अपडेट होगा।',
        stressLabel: 'स्ट्रेस लेवल',
        stressNote: 'यह जवाब की क्वालिटी और कैमरा स्थिरता के आधार पर दिखाया जाता है।',
        postureLabel: 'पोस्चर',
        postureNote: 'कैमरा आधारित पोस्चर गाइडेंस लाइव दिखाई जाएगी।',
        timerLabel: 'टाइमर',
        timerNote: 'प्रैक्टिस के दौरान टाइमर चलता रहेगा।',
        roundLabel: 'मौजूदा राउंड:',
        rounds: ['एचआर राउंड', 'टेक्निकल राउंड', 'कोडिंग राउंड', 'बिहेवियर राउंड'],
        placeholder: 'अपना जवाब बोलें या टाइप करें...',
        chatPlaceholder: 'कुछ पूछें...',
        speak: 'बोलें',
        stopSpeak: 'सुनना बंद',
        record: 'रिकॉर्ड',
        stopRecord: 'रिकॉर्डिंग बंद',
        analyze: 'जवाब विश्लेषण',
        next: 'अगला प्रश्न',
        feedbackTitle: 'लाइव फीडबैक',
        defaultSuggestion: 'विश्लेषण के बाद आपकी पर्सनल सलाह यहां दिखाई देगी।',
        defaultFeedback: 'फीडबैक पाने के लिए बोलना शुरू करें या जवाब टाइप करें।',
        cameraMonitorTitle: 'कैमरा मॉनिटर',
        enableCamera: 'कैमरा चालू करें',
        cameraHelp: 'जब ब्राउज़र पूछे तो कैमरा अनुमति दें। यदि आपने फाइल सीधे खोली है, तो लोकल सर्वर का उपयोग करें।',
        stressDetailLabel: 'स्ट्रेस',
        postureDetailLabel: 'पोस्चर',
        askCoach: 'कोच से पूछें',
        coachReady: 'PrepGenie कोच आपकी मदद के लिए तैयार है।'
    }
};

const statusTranslations = {
    en: {
        calm: 'Calm',
        moderate: 'Moderate',
        high: 'High',
        unknown: 'Unknown',
        checking: 'Checking',
        unavailable: 'Unavailable',
        guided: 'Guided',
        good: 'Good',
        adjust: 'Adjust'
    },
    hi: {
        calm: 'शांत',
        moderate: 'मध्यम',
        high: 'उच्च',
        unknown: 'अज्ञात',
        checking: 'जांच जारी',
        unavailable: 'उपलब्ध नहीं',
        guided: 'गाइडेड',
        good: 'अच्छा',
        adjust: 'सुधारें'
    }
};

function translateStatusWord(value) {
    const lang = localStorage.getItem('lang') || 'en';
    const translations = statusTranslations[lang] || statusTranslations.en;
    const normalized = String(value || '').trim().toLowerCase();
    return translations[normalized] || value;
}

async function translateToHindi(text) {
    try {
        const data = await fetchExternalJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`);
        return data?.responseData?.translatedText || text;
    } catch (err) {
        console.error('Hindi translation error:', err);
        return text;
    }
}

function go(page) {
    window.location.href = `${page}.html`;
}

function showTipPopup(message) {
    if (typeof message === 'string' && message.startsWith('Emotion coach:')) {
        const settings = getInterviewSettings();
        if (!settings.emotionPopups) return;
    }

    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2500);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;
}

function formatSecondsAsClock(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.floor(safeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function roundDisplayName(round = currentRound) {
    return historyHelpers?.roundLabel?.(round) || 'General Session';
}

function buildDefaultSchedule(now = Date.now()) {
    return {
        startedAt: new Date(now).toISOString(),
        totalSeconds: SESSION_TOTAL_SECONDS,
        roundDurationSeconds: ROUND_DURATION_SECONDS,
        rounds: ROUND_SEQUENCE
    };
}

function readInterviewSchedule() {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(INTERVIEW_SCHEDULE_KEY)) || null;
        if (!parsed || !parsed.startedAt) return null;

        const rounds = Array.isArray(parsed.rounds) && parsed.rounds.length
            ? parsed.rounds.map((item) => historyHelpers?.normalizeRound?.(item) || item)
            : ROUND_SEQUENCE;

        return {
            startedAt: new Date(parsed.startedAt).toISOString(),
            totalSeconds: Number(parsed.totalSeconds) || SESSION_TOTAL_SECONDS,
            roundDurationSeconds: Number(parsed.roundDurationSeconds) || ROUND_DURATION_SECONDS,
            rounds
        };
    } catch (_error) {
        return null;
    }
}

function saveInterviewSchedule(schedule) {
    activeSchedule = schedule;
    sessionStorage.setItem(INTERVIEW_SCHEDULE_KEY, JSON.stringify(schedule));
}

function ensureInterviewSchedule() {
    const existing = readInterviewSchedule();
    if (existing) {
        activeSchedule = existing;
        return existing;
    }

    const created = buildDefaultSchedule();
    saveInterviewSchedule(created);
    return created;
}

function resetCompletedScheduleIfNeeded() {
    const existing = readInterviewSchedule();
    if (!existing) return;

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(existing.startedAt).getTime()) / 1000));
    if (elapsedSeconds < (Number(existing.totalSeconds) || SESSION_TOTAL_SECONDS)) {
        activeSchedule = existing;
        return;
    }

    saveInterviewSchedule(buildDefaultSchedule());
}

function getScheduleSnapshot(schedule = ensureInterviewSchedule(), now = Date.now()) {
    const startedAtMs = new Date(schedule.startedAt).getTime();
    const totalSeconds = Number(schedule.totalSeconds) || SESSION_TOTAL_SECONDS;
    const roundDurationSeconds = Number(schedule.roundDurationSeconds) || ROUND_DURATION_SECONDS;
    const rounds = Array.isArray(schedule.rounds) && schedule.rounds.length ? schedule.rounds : ROUND_SEQUENCE;
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1000));
    const boundedElapsedSeconds = Math.min(elapsedSeconds, totalSeconds);
    const activeSecond = Math.max(0, Math.min(boundedElapsedSeconds, Math.max(0, totalSeconds - 1)));
    const roundIndex = Math.min(rounds.length - 1, Math.floor(activeSecond / roundDurationSeconds));
    const roundStart = roundIndex * roundDurationSeconds;
    const roundElapsedSeconds = Math.max(0, boundedElapsedSeconds - roundStart);
    const roundRemainingSeconds = Math.max(0, Math.min(roundDurationSeconds, roundDurationSeconds - roundElapsedSeconds));

    return {
        schedule,
        rounds,
        roundIndex,
        round: rounds[roundIndex] || ROUND_SEQUENCE[0],
        elapsedSeconds: boundedElapsedSeconds,
        remainingSeconds: Math.max(0, totalSeconds - boundedElapsedSeconds),
        roundElapsedSeconds,
        roundRemainingSeconds,
        completed: boundedElapsedSeconds >= totalSeconds
    };
}

function syncRoundUi(snapshot = getScheduleSnapshot()) {
    if (roundTypeEl) {
        roundTypeEl.value = snapshot.round;
    }

    if (activeRoundBadgeEl) {
        activeRoundBadgeEl.textContent = roundDisplayName(snapshot.round);
    }

    if (roundCountdownBadgeEl) {
        roundCountdownBadgeEl.textContent = snapshot.completed
            ? 'Session Complete'
            : `Next round in ${formatSecondsAsClock(snapshot.roundRemainingSeconds)}`;
    }

    if (roundAutoNoteEl) {
        roundAutoNoteEl.textContent = snapshot.completed
            ? 'The 30-minute interview cycle is complete. Refresh the page to begin a new full-session rotation.'
            : `${roundDisplayName(snapshot.round)} is active now. The flow rotates automatically every ${formatSecondsAsClock(ROUND_DURATION_SECONDS)} and covers all rounds in 30 minutes.`;
    }
}

function switchToScheduledRound(snapshot, options = {}) {
    const normalizedRound = historyHelpers?.normalizeRound?.(snapshot.round) || snapshot.round || ROUND_SEQUENCE[0];
    const roundChanged = currentRound !== normalizedRound;
    const changeSignature = `${normalizedRound}:${snapshot.roundIndex}`;

    currentRound = normalizedRound;
    syncRoundUi(snapshot);

    if (!roundChanged || options.silent || lastRoundChangeSignature === changeSignature) {
        return;
    }

    lastRoundChangeSignature = changeSignature;
    questionIndex = 0;
    answerEl.value = '';
    renderFeedback([]);
    suggestionEl.textContent = `${roundDisplayName(currentRound)} is active. Answer when you are ready.`;
    showTipPopup(`${roundDisplayName(currentRound)} started automatically.`);
    loadQuestion();
}

function refreshTimedInterviewState() {
    const snapshot = getScheduleSnapshot();
    timeLeft = snapshot.remainingSeconds;
    updateTimerDisplay();
    syncRoundUi(snapshot);

    if (snapshot.completed) {
        currentRound = snapshot.round;
        return snapshot;
    }

    switchToScheduledRound(snapshot);
    return snapshot;
}

function startTimer() {
    clearInterval(timerInterval);
    refreshTimedInterviewState();

    timerInterval = setInterval(() => {
        const snapshot = refreshTimedInterviewState();
        if (snapshot.remainingSeconds <= 0) {
            clearInterval(timerInterval);
            showTipPopup('The 30-minute interview cycle is complete. Review your report next.');
            return;
        }
    }, 1000);
}

function appendLocalReportEntry(entry) {
    try {
        const existing = historyHelpers?.normalizeHistory?.(JSON.parse(localStorage.getItem('reportHistory')) || []) || [];
        const merged = historyHelpers?.dedupeHistory?.([...existing, entry]) || [...existing, entry];
        localStorage.setItem('reportHistory', JSON.stringify(merged));
    } catch (err) {
        console.error('Local report history error:', err);
    }
}

function buildSessionEntry(score, feedback, suggestion, answer, context = {}) {
    const currentUser = historyHelpers?.getCurrentUser?.() || null;
    const emotionState = window.PrepGenieEmotion && typeof window.PrepGenieEmotion.getState === 'function'
        ? window.PrepGenieEmotion.getState()
        : { emotion: '', detail: '' };
    const voiceEmotionState = window.PrepGenieVoiceEmotion && typeof window.PrepGenieVoiceEmotion.getState === 'function'
        ? window.PrepGenieVoiceEmotion.getState()
        : { emotion: '', detail: '', source: '' };
    const effectiveStress = getEffectiveStressSnapshot();
    const effectivePosture = getEffectivePostureSnapshot();
    const snapshot = context.snapshot || getScheduleSnapshot();
    const timestamp = new Date().toISOString();
    const resolvedRound = historyHelpers?.normalizeRound?.(context.round || activeQuestionRound || currentRound || snapshot.round) || currentRound;
    const resolvedQuestion = String(context.question || window.originalQuestion || questionEl.textContent || '').trim();

    syncRoundUi(snapshot);

    return {
        sessionId: `${currentUser?.id || currentUser?.email || 'guest'}-${resolvedRound}-${Date.now()}`,
        userId: currentUser?.id || currentUser?._id || '',
        userEmail: currentUser?.email || '',
        username: currentUser?.username || '',
        score: Number(score) || 0,
        feedback,
        suggestion,
        round: resolvedRound,
        question: resolvedQuestion,
        answer: String(answer || '').trim(),
        stress: effectiveStress.level,
        stressDetail: effectiveStress.detail,
        posture: effectivePosture.level,
        postureDetail: effectivePosture.detail,
        emotion: emotionState.emotion || '',
        emotionDetail: emotionState.detail || '',
        voiceEmotion: voiceEmotionState.emotion || '',
        voiceEmotionDetail: voiceEmotionState.detail || '',
        voiceEmotionSource: voiceEmotionState.source || '',
        analysisSource: lastAnalysisSource,
        sensorSnapshot: lastIoTSnapshot || null,
        durationSeconds: snapshot.elapsedSeconds,
        date: timestamp
    };
}

async function saveSession(payload) {
    try {
        await apiJson('/history/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 5000);
    } catch (err) {
        console.error('Error saving session:', err);
    }
}

function renderFeedback(feedback) {
    const items = Array.isArray(feedback) && feedback.length
        ? feedback
        : ['Answer captured. Try adding more detail and one example for stronger impact.'];

    const lang = localStorage.getItem('lang') || 'en';

    if (lang === 'hi') {
        Promise.all(items.map((item) => translateToHindi(item)))
            .then((translatedItems) => {
                feedbackListEl.innerHTML = translatedItems
                    .map((item) => `<div class="feedback-item">${item}</div>`)
                    .join('');
            })
            .catch(() => {
                feedbackListEl.innerHTML = items
                    .map((item) => `<div class="feedback-item">${item}</div>`)
                    .join('');
            });
        return;
    }

    feedbackListEl.innerHTML = items
        .map((item) => `<div class="feedback-item">${item}</div>`)
        .join('');
}

function updateStressStatus(level, detail) {
    currentStressStatus = level;
    lastStressDetail = detail;
    stressEl.textContent = translateStatusWord(level);
    stressDetailEl.textContent = detail;
}

function updatePostureStatus(level, detail) {
    currentPostureStatus = level;
    lastPostureDetail = detail;
    postureEl.textContent = translateStatusWord(level);
    postureDetailEl.textContent = detail;
}

function inferStress(score, answer) {
    const lowered = answer.toLowerCase();
    const fillerMatches = lowered.match(/\b(um|uh|like|actually|basically)\b/g) || [];

    if (score < 45 || fillerMatches.length >= 4) {
        return {
            level: 'High',
            detail: 'Slow down, breathe, and answer in short structured points.'
        };
    }

    if (score < 70 || fillerMatches.length >= 2) {
        return {
            level: 'Moderate',
            detail: 'You are doing okay. Focus on a steady pace and clearer examples.'
        };
    }

    return {
        level: 'Calm',
        detail: 'Delivery looks steady. Maintain this pace and confidence.'
    };
}

function getSessionHistory() {
    try {
        const stored = JSON.parse(localStorage.getItem('reportHistory')) || [];
        const normalized = historyHelpers?.normalizeHistory?.(stored) || stored;
        const filtered = historyHelpers?.filterForCurrentUser?.(normalized) || normalized;
        const deduped = historyHelpers?.dedupeHistory?.(filtered) || filtered;
        return historyHelpers?.sortHistory?.(deduped, 'asc') || deduped;
    } catch (error) {
        return [];
    }
}

function buildRoundSpecificFeedback(answer, round, question, history, score) {
    const lowered = answer.toLowerCase();
    const words = lowered.trim().split(/\s+/).filter(Boolean);
    const feedback = [];
    const recentSameRound = history.filter((item) => item.round === round).slice(-3);
    const repeatedShortAnswers = recentSameRound.filter((item) => Number(item.score) < 55).length >= 2;

    if (words.length < 25) {
        feedback.push('This answer is still too brief. Add more explanation before you conclude.');
    } else if (words.length > 120) {
        feedback.push('Your answer is detailed, but trim a few lines so the key point lands faster.');
    }

    if (round === 'hr') {
        if (!/(role|company|team|value|growth|career)/i.test(lowered)) {
            feedback.push('Connect your answer more clearly to the role, company, or long-term career direction.');
        }
        if (!/(strength|improve|learned|adapted|responsible)/i.test(lowered)) {
            feedback.push('Show a little more self-awareness by naming what you learned or improved.');
        }
    }

    if (round === 'technical') {
        if (!/(because|therefore|means|works|used|architecture|system|database|api)/i.test(lowered)) {
            feedback.push('Explain the technical reasoning, not just the final definition.');
        }
        if (!/(example|for example|project|implementation|real)/i.test(lowered)) {
            feedback.push('Add one practical technical example from a project or implementation.');
        }
    }

    if (round === 'coding') {
        if (!/(time complexity|space complexity|complexity|o\(|optimal)/i.test(lowered)) {
            feedback.push('Mention time or space complexity so the solution feels interview-ready.');
        }
        if (!/(step|first|then|loop|array|function|condition|edge case)/i.test(lowered)) {
            feedback.push('Walk through the approach step by step instead of jumping straight to the final answer.');
        }
        if (!/(edge case|null|empty|duplicate|boundary)/i.test(lowered)) {
            feedback.push('Call out at least one edge case to make the coding answer stronger.');
        }
    }

    if (round === 'behaviour') {
        if (!/(situation|task|action|result|learned|outcome)/i.test(lowered)) {
            feedback.push('Use a clearer STAR flow: situation, action, result, and learning.');
        }
        if (!/(team|stakeholder|manager|client|member)/i.test(lowered)) {
            feedback.push('Include who was involved so the situation feels more real and credible.');
        }
    }

    if (question && /stress|pressure|conflict|failure|challenge/i.test(question) && !/(calm|plan|resolved|lesson|improved|handled)/i.test(lowered)) {
        feedback.push('For this question, explain how you handled the situation and what changed after your action.');
    }

    if (repeatedShortAnswers) {
        feedback.push('Your recent answers in this round are trending short. Slow down and add one more complete example.');
    }

    if (score >= 75 && !feedback.length) {
        feedback.push('This answer is strong. Keep this structure and make the ending slightly more memorable.');
    }

    return feedback;
}

function localAnalyzeAnswer(answer, context = {}) {
    const lowered = answer.toLowerCase();
    const words = lowered.trim().split(/\s+/).filter(Boolean);
    const round = historyHelpers?.normalizeRound?.(context.round || activeQuestionRound || currentRound) || currentRound;
    const question = String(context.question || window.originalQuestion || questionEl.textContent || '').trim();
    const history = Array.isArray(context.history) ? context.history : getSessionHistory();
    let score = 20;
    const feedback = [];

    if (words.length >= 30) score += 25;
    else feedback.push('Answer is too short. Add more depth and explanation.');

    if (/(example|for instance|for example|project|experience)/i.test(lowered)) score += 20;
    else feedback.push('Add one clear example from your real experience.');

    if (/(team|collaborate|client|user|result|impact)/i.test(lowered)) score += 20;
    else feedback.push('Show the impact of your work or teamwork contribution.');

    if (/(learned|improved|solved|built|delivered|managed)/i.test(lowered)) score += 15;
    else feedback.push('Use stronger action verbs to sound more confident.');

    if (words.length >= 60) score += 10;
    if (/\bi\b/.test(lowered)) score += 10;

    score = Math.min(100, score);

    const roundFeedback = buildRoundSpecificFeedback(answer, round, question, history, score);
    roundFeedback.forEach((item) => {
        if (!feedback.includes(item)) feedback.push(item);
    });

    let suggestion = 'Good answer. Keep your examples specific and your delivery confident.';

    if (round === 'hr') {
        suggestion = score < 60
            ? 'Align your answer more clearly with the role and show what you learned from your experience.'
            : 'Good HR response. Keep the answer personal, relevant, and closely tied to the role.';
    } else if (round === 'technical') {
        suggestion = score < 60
            ? 'Explain the concept, why it matters, and one real implementation example.'
            : 'Good technical answer. Keep connecting concepts to real systems or project use.';
    } else if (round === 'coding') {
        suggestion = score < 60
            ? 'State the approach, complexity, and important edge cases more clearly.'
            : 'Strong coding explanation. Keep the algorithm clear and mention tradeoffs early.';
    } else if (round === 'behaviour') {
        suggestion = score < 60
            ? 'Use STAR more clearly and make the result measurable.'
            : 'Good behavioural answer. Keep the result and lesson very concrete.';
    }

    return {
        score,
        feedback,
        suggestion
    };
}

async function analyzeAnswer(answer) {
    if (!answer.trim()) {
        showTipPopup('Please enter or speak an answer first.');
        return null;
    }

    let data;
    const sessionHistory = getSessionHistory();
    const analysisSnapshot = getScheduleSnapshot();
    const analysisRound = historyHelpers?.normalizeRound?.(activeQuestionRound || currentRound || analysisSnapshot.round) || currentRound;
    const analysisQuestion = String(window.originalQuestion || questionEl.textContent || '').trim();
    let localAnalysis = null;

    try {
        data = await apiJson('/analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                answer,
                round: analysisRound,
                question: analysisQuestion
            })
        }, 5000);
        lastAnalysisSource = 'api';
    } catch (err) {
        console.warn('Using local analysis fallback:', err.message);
        localAnalysis = localAnalyzeAnswer(answer, {
            round: analysisRound,
            question: analysisQuestion,
            history: sessionHistory
        });
        data = localAnalysis;
        lastAnalysisSource = 'local';
    }

    const fallbackAnalysis = localAnalysis || localAnalyzeAnswer(answer, {
        round: analysisRound,
        question: analysisQuestion,
        history: sessionHistory
    });
    const refinedFeedback = [
        ...(Array.isArray(data.feedback) ? data.feedback : []),
        ...buildRoundSpecificFeedback(answer, analysisRound, analysisQuestion, sessionHistory, Number(data.score) || 0)
    ].filter((item, index, array) => item && array.indexOf(item) === index);

    scoreEl.textContent = `${Number(data.score) || 0}%`;
    renderFeedback(refinedFeedback);

    const stressResult = inferStress(Number(data.score) || 0, answer);
    updateStressStatus(stressResult.level, stressResult.detail);
    const effectiveStress = getEffectiveStressSnapshot();
    const effectivePosture = getEffectivePostureSnapshot();

    const lang = localStorage.getItem('lang') || 'en';
    const finalSuggestion = data.suggestion || fallbackAnalysis.suggestion || 'Keep refining your answer with stronger examples.';
    const suggestionText = finalSuggestion;
    suggestionEl.textContent = lang === 'hi'
        ? await translateToHindi(suggestionText)
        : suggestionText;

    localStorage.setItem('lastScore', Number(data.score) || 0);
    localStorage.setItem('lastFeedback', JSON.stringify(refinedFeedback));
    localStorage.setItem('lastSuggestion', finalSuggestion);
    localStorage.setItem('lastStress', effectiveStress.level);
    localStorage.setItem('lastPosture', effectivePosture.level);

    const sessionEntry = buildSessionEntry(Number(data.score) || 0, refinedFeedback, finalSuggestion, answer, {
        round: analysisRound,
        question: analysisQuestion,
        snapshot: analysisSnapshot
    });
    appendLocalReportEntry(sessionEntry);
    saveSession(sessionEntry);
    if (window.PrepGenieNotifications?.refresh) {
        window.PrepGenieNotifications.refresh().catch((error) => {
            console.warn('Notification refresh skipped:', error.message);
        });
    }
    return data;
}

async function analyzeCurrentAnswer() {
    const analyzeBtn = document.getElementById('askSpeakBtn');
    const originalLabel = analyzeBtn ? analyzeBtn.textContent : '';

    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        analyzeBtn.style.opacity = '0.7';
    }

    try {
        await analyzeAnswer(answerEl.value.trim());
    } finally {
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = originalLabel || 'Analyze Answer';
            analyzeBtn.style.opacity = '1';
        }
    }
}

async function initMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        cameraStatusEl.textContent = 'Camera unsupported';
        updatePostureStatus('Unavailable', 'Your browser does not support camera access.');
        setCameraHelp('Use a modern browser like Chrome or Edge and open the app from localhost or HTTPS.');
        return;
    }

    if (!window.isSecureContext) {
        cameraStatusEl.textContent = 'Secure context required';
        updatePostureStatus('Unavailable', 'Camera needs localhost or HTTPS to work.');
        setCameraHelp('Open this project from a local server such as http://localhost instead of opening the HTML file directly.');
        return;
    }

    stopExistingMediaStream();

    const constraintsList = [
        {
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: true
        },
        {
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false
        },
        { video: true, audio: false }
    ];

    try {
        let lastError;

        for (const constraints of constraintsList) {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!mediaStream) throw lastError || new Error('Unable to access media devices');

        videoEl.srcObject = mediaStream;
        await new Promise((resolve) => {
            if (videoEl.readyState >= 1) {
                resolve();
                return;
            }
            videoEl.onloadedmetadata = () => resolve();
        });

        try {
            await videoEl.play();
        } catch (playError) {
            console.warn('Video play warning:', playError.message);
        }

        cameraStatusEl.textContent = 'Camera live';
        updatePostureStatus('Checking', 'Camera connected. Hold a centered upright posture.');
        setCameraHelp('Camera connected successfully. If the preview is blank, click Enable Camera once more.');
        startCameraMonitoring();
    } catch (err) {
        console.error('Permission denied or error:', err);
        cameraStatusEl.textContent = 'Camera blocked';
        updatePostureStatus('Unavailable', 'Allow camera access to monitor posture.');
        updateStressStatus('Unknown', 'Camera permission is needed for live monitoring.');

        if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
            setCameraHelp('Camera permission was denied. Allow camera access in the browser address bar and click Enable Camera.');
        } else if (err && err.name === 'NotFoundError') {
            setCameraHelp('No camera device was found. Connect a webcam and click Enable Camera again.');
        } else {
            setCameraHelp('Camera could not start. If you opened the file directly, run it from localhost and try again.');
        }
    }
}

async function enableCamera() {
    cameraStatusEl.textContent = 'Retrying camera...';
    await initMedia();
}

function drawGuide(faceBox) {
    if (!canvasEl || !videoEl.videoWidth) return;

    const ctx = canvasEl.getContext('2d');
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvasEl.width * 0.22, canvasEl.height * 0.14, canvasEl.width * 0.56, canvasEl.height * 0.72);

    if (faceBox) {
        ctx.strokeStyle = '#7be2a6';
        ctx.lineWidth = 3;
        ctx.strokeRect(faceBox.x, faceBox.y, faceBox.width, faceBox.height);
    }
  }

async function startCameraMonitoring() {
    clearInterval(postureInterval);

    if (!cameraMonitorState.faceSupported) {
        cameraStatusEl.textContent = 'Camera live';
        updatePostureStatus('Guided', 'Center your face inside the frame guide for best posture.');
        drawGuide(null);
        return;
    }

    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });

    postureInterval = setInterval(async () => {
        if (!videoEl.videoWidth) return;

        try {
            const faces = await detector.detect(videoEl);
            if (!faces.length) {
                cameraStatusEl.textContent = 'Face not detected';
                updatePostureStatus('Adjust', 'Move into the frame and keep your head visible.');
                updateStressStatus(stressEl.textContent === 'Unknown' ? 'Moderate' : stressEl.textContent, 'Stay centered in the frame and keep steady eye contact.');
                drawGuide(null);
                return;
            }

            const face = faces[0].boundingBox;
            drawGuide(face);
            cameraStatusEl.textContent = 'Face detected';

            const centerX = face.x + face.width / 2;
            const centerY = face.y + face.height / 2;
            const xRatio = centerX / videoEl.videoWidth;
            const yRatio = centerY / videoEl.videoHeight;
            const movement = cameraMonitorState.lastFaceBox
                ? Math.abs(face.x - cameraMonitorState.lastFaceBox.x) + Math.abs(face.y - cameraMonitorState.lastFaceBox.y)
                : 0;

            cameraMonitorState.lastFaceBox = face;

            if (xRatio > 0.34 && xRatio < 0.66 && yRatio > 0.28 && yRatio < 0.58) {
                updatePostureStatus('Good', 'Posture looks aligned and camera framing is strong.');
            } else {
                updatePostureStatus('Adjust', 'Sit upright and center your face slightly higher in the frame.');
            }

            const sensitivity = getInterviewSettings().cameraSensitivity;
            const movementThreshold = sensitivity === 'strict' ? 40 : 65;

            if (movement > movementThreshold) {
                updateStressStatus('Moderate', 'Noticeable movement detected. Slow down and stay steady.');
            }
        } catch (err) {
            console.warn('Face detection unavailable:', err.message);
            cameraMonitorState.faceSupported = false;
            drawGuide(null);
            updatePostureStatus('Guided', 'Keep your shoulders square and face centered in the guide.');
        }
    }, 2500);
}

async function translateToEnglish(text) {
    try {
        const data = await fetchExternalJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=hi|en`);
        return data.responseData.translatedText || text;
    } catch (err) {
        console.error('Translation error:', err);
        return text;
    }
}

async function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showTipPopup('Speech recognition is not supported in this browser.');
        return;
    }

    if (recognitionActive && recognition) {
        recognition.stop();
        return;
    }

    const lang = localStorage.getItem('lang') || 'en';
    recognition = new SpeechRecognition();
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        recognitionActive = true;
        document.getElementById('speakBtn').textContent = uiTranslations[lang].stopSpeak;
        showTipPopup('Listening to your answer...');
    };

    recognition.onresult = async (event) => {
        let transcript = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalText += `${text} `;
            else transcript += text;
        }

        answerEl.value = `${transcript}${finalText}`.trim();

        if (finalText.trim()) {
            let processedText = finalText.trim();
            if (lang === 'hi') {
                processedText = await translateToEnglish(processedText);
                translatedEl.textContent = processedText;
            }
            await analyzeAnswer(processedText);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        showTipPopup(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
        recognitionActive = false;
        document.getElementById('speakBtn').textContent = uiTranslations[localStorage.getItem('lang') || 'en'].speak;
    };

    recognition.start();
}

async function toggleRecording() {
    if (!mediaStream) {
        await initMedia();
    }

    if (!mediaStream) {
        showTipPopup('Camera or microphone is not available for recording.');
        return;
    }

    if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
        return;
    }

    const supportedMimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        ''
    ];
    const selectedMimeType = supportedMimeTypes.find((type) => !type || MediaRecorder.isTypeSupported(type)) || '';

    recordingChunks = [];
    try {
        mediaRecorder = selectedMimeType
            ? new MediaRecorder(mediaStream, { mimeType: selectedMimeType })
            : new MediaRecorder(mediaStream);
    } catch (error) {
        console.error('Recorder start error:', error);
        recordingStatusEl.textContent = 'Recorder unavailable';
        showTipPopup('Recording is not supported in this browser.');
        return;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunks.push(event.data);
    };

    mediaRecorder.onstart = () => {
        isRecording = true;
        recordingStatusEl.textContent = 'Recording live';
        document.getElementById('recordBtn').textContent = uiTranslations[localStorage.getItem('lang') || 'en'].stopRecord;
        showTipPopup('Recording has been started.');
    };

    mediaRecorder.onstop = () => {
        isRecording = false;
        recordingStatusEl.textContent = 'Recorder idle';
        document.getElementById('recordBtn').textContent = uiTranslations[localStorage.getItem('lang') || 'en'].record;

        if (!recordingChunks.length) {
            showTipPopup('No recording data was captured.');
            return;
        }

        const blob = new Blob(recordingChunks, { type: selectedMimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prepgenie-interview.webm';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showTipPopup('Recording saved successfully.');
    };

    mediaRecorder.onerror = (event) => {
        console.error('Recorder error:', event.error);
        isRecording = false;
        recordingStatusEl.textContent = 'Recorder error';
        document.getElementById('recordBtn').textContent = uiTranslations[localStorage.getItem('lang') || 'en'].record;
        showTipPopup('Recording failed. Please try again.');
    };

    mediaRecorder.start();
}

async function loadQuestion() {
    try {
        const data = await apiJson(`/questions/${currentRound}`, {}, 5000);
        const questions = Array.isArray(data) ? data : [data.question];

        if (questionIndex >= questions.length) {
            activeQuestionRound = currentRound;
            questionEl.textContent = 'Round completed';
            return;
        }

        activeQuestionRound = currentRound;
        window.originalQuestion = questions[questionIndex];
        updateQuestionLanguage();
    } catch (error) {
        const questions = questionBank[currentRound] || [];
        if (questionIndex >= questions.length) {
            activeQuestionRound = currentRound;
            questionEl.textContent = 'Round completed';
            return;
        }

        activeQuestionRound = currentRound;
        window.originalQuestion = questions[questionIndex];
        updateQuestionLanguage();
    }
}

function nextQuestion() {
    questionIndex += 1;
    answerEl.value = '';
    suggestionEl.textContent = `${roundDisplayName(currentRound)} question updated. Answer when you are ready.`;
    renderFeedback([]);
    loadQuestion();
}

function changeRound() {
    const snapshot = refreshTimedInterviewState();
    if (roundTypeEl) {
        roundTypeEl.value = snapshot.round;
    }
}

function detectLanguage(text) {
    const hindiPattern = /[\u0900-\u097F]/;
    return hindiPattern.test(text) ? 'hi' : 'en';
}

async function updateQuestionLanguage() {
    const lang = localStorage.getItem('lang') || 'en';
    if (!window.originalQuestion) return;

    if (lang === 'hi') {
        questionEl.textContent = await translateToHindi(window.originalQuestion);
        return;
    }

    questionEl.textContent = window.originalQuestion;
}

function updateLanguageUI() {
    const lang = localStorage.getItem('lang') || 'en';
    const ui = uiTranslations[lang] || uiTranslations.en;

    document.getElementById('currentLang').textContent = ui.currentLang;
    document.getElementById('dashboardBtn').textContent = ui.dashboard;
    document.getElementById('interviewBtn').textContent = ui.interview;
    document.getElementById('reportBtn').textContent = ui.reports;
    document.getElementById('adminBtn').textContent = ui.admin;
    document.getElementById('themeBtn').textContent = ui.theme;
    document.getElementById('pageTitle').textContent = ui.pageTitle;
    document.getElementById('pageSubtitle').textContent = ui.pageSubtitle;
    document.getElementById('heroTitle').textContent = ui.heroTitle;
    document.getElementById('heroSubtitle').textContent = ui.heroSubtitle;
    document.getElementById('scoreLabel').textContent = ui.scoreLabel;
    document.getElementById('scoreNote').textContent = ui.scoreNote;
    document.getElementById('stressLabel').textContent = ui.stressLabel;
    document.getElementById('stressNote').textContent = ui.stressNote;
    document.getElementById('postureLabel').textContent = ui.postureLabel;
    document.getElementById('postureNote').textContent = ui.postureNote;
    document.getElementById('timerLabel').textContent = ui.timerLabel;
    document.getElementById('timerNote').textContent = ui.timerNote;
    document.getElementById('roundLabel').textContent = ui.roundLabel;
    answerEl.placeholder = ui.placeholder;
    document.getElementById('chatInput').placeholder = ui.chatPlaceholder;
    document.getElementById('speakBtn').textContent = recognitionActive ? ui.stopSpeak : ui.speak;
    document.getElementById('recordBtn').textContent = isRecording ? ui.stopRecord : ui.record;
    document.getElementById('askSpeakBtn').textContent = ui.analyze;
    document.getElementById('nextBtn').textContent = ui.next;
    document.getElementById('feedbackTitle').textContent = ui.feedbackTitle;
    document.getElementById('cameraMonitorTitle').textContent = ui.cameraMonitorTitle;
    document.getElementById('enableCameraBtn').textContent = ui.enableCamera;
    document.getElementById('stressDetailLabel').textContent = ui.stressDetailLabel;
    document.getElementById('postureDetailLabel').textContent = ui.postureDetailLabel;
    document.getElementById('askCoachBtn').textContent = ui.askCoach;

    if (!suggestionEl.textContent || suggestionEl.textContent === uiTranslations.en.defaultSuggestion || suggestionEl.textContent === uiTranslations.hi.defaultSuggestion) {
        suggestionEl.textContent = ui.defaultSuggestion;
    }

    if (feedbackListEl.children.length === 1 && feedbackListEl.firstElementChild && feedbackListEl.firstElementChild.textContent) {
        const text = feedbackListEl.firstElementChild.textContent.trim();
        if (text === uiTranslations.en.defaultFeedback || text === uiTranslations.hi.defaultFeedback) {
            feedbackListEl.innerHTML = `<div class="feedback-item">${ui.defaultFeedback}</div>`;
        }
    }

    if (cameraHelpEl && (
        cameraHelpEl.textContent === uiTranslations.en.cameraHelp ||
        cameraHelpEl.textContent === uiTranslations.hi.cameraHelp
    )) {
        cameraHelpEl.textContent = ui.cameraHelp;
    }

    if (document.getElementById('chatOutput').textContent === uiTranslations.en.coachReady ||
        document.getElementById('chatOutput').textContent === uiTranslations.hi.coachReady) {
        document.getElementById('chatOutput').textContent = ui.coachReady;
    }

    stressEl.textContent = translateStatusWord(currentStressStatus);
    postureEl.textContent = translateStatusWord(currentPostureStatus);

    const roundSelect = document.getElementById('roundType');
    ui.rounds.forEach((label, index) => {
        if (roundSelect.options[index]) roundSelect.options[index].text = label;
    });

    if (langSwitchEl) langSwitchEl.checked = lang === 'hi';
}

function toggleLanguage() {
    const current = localStorage.getItem('lang') || 'en';
    const next = current === 'en' ? 'hi' : 'en';
    localStorage.setItem('lang', next);
    updateLanguageUI();
    updateQuestionLanguage();
}

function applyLanguage() {
    updateLanguageUI();
    syncRoundUi(getScheduleSnapshot());
}

window.addEventListener('DOMContentLoaded', async () => {
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.style.display = window.PrepGenieAccess?.isAdminUser?.() ? 'block' : 'none';
    }
    resetCompletedScheduleIfNeeded();
    ensureInterviewSchedule();
    const initialSnapshot = refreshTimedInterviewState();
    currentRound = initialSnapshot.round;
    activeQuestionRound = currentRound;
    questionIndex = 0;
    applyInterviewSettingsToUi();
    applyLanguage();
    await refreshIoTPanel();
    clearInterval(iotInterval);
    iotInterval = setInterval(refreshIoTPanel, IOT_REFRESH_MS);
    await initMedia();
    startTimer();
    await loadQuestion();
    renderFeedback([]);
});


