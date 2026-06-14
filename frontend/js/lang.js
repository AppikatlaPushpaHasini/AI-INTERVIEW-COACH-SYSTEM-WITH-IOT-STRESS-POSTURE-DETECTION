// /* ===================== 🌍 TRANSLATIONS ===================== */
// const translations = {
//   en: {
//     speak: "🎤 Speak",
//     record: "🎥 Record",
//     askSpeak: "Ask & Speak 🔊",
//     next: "Next Question",
//     selectRound: "Select Round",
//     hr: "HR Round",
//     technical: "Technical Round",
//     coding: "Coding Round",
//     behavior: "Behaviour Round",
//     placeholder: "Speak or type your answer...",
//     chatPlaceholder: "Ask something...",
//     dashboard: "📊 Dashboard"
//   },
//   hi: {
//     speak: "🎤 बोलें",
//     record: "🎥 रिकॉर्ड करें",
//     askSpeak: "पूछें और सुनें 🔊",
//     next: "अगला प्रश्न",
//     selectRound: "राउंड चुनें",
//     hr: "एचआर राउंड",
//     technical: "टेक्निकल राउंड",
//     coding: "कोडिंग राउंड",
//     behavior: "बिहेवियर राउंड",
//     placeholder: "अपना उत्तर बोलें या लिखें...",
//     chatPlaceholder: "कुछ पूछें...",
//     dashboard: "📊 डैशबोर्ड"
//   }
// };

// /* ===================== 🔄 TOGGLE LANGUAGE ===================== */
// function toggleLanguage() {
//   let current = localStorage.getItem("lang") || "en";
//   const newLang = current === "en" ? "hi" : "en";

//   localStorage.setItem("lang", newLang);

//   updateLanguageUI();
//   applyLanguage();
//   updateQuestionLanguage(); // ✅ FIXED (no reload)
// }

// /* ===================== 🌐 UPDATE UI TEXT ===================== */
// function updateLanguageUI() {
//   const lang = localStorage.getItem("lang") || "en";

//   const langText = document.getElementById("currentLang");
//   if (langText) {
//     langText.innerText = (lang === "hi") ? "🌐 हिंदी मोड" : "🌐 English Mode";
//   }
// }

// /* ===================== 🧠 APPLY LANGUAGE ===================== */
// function applyLanguage() {
//   const lang = localStorage.getItem("lang") || "en";

//   const speakBtn = document.querySelector("button[onclick='startVoice()']");
//   if (speakBtn) speakBtn.innerText = translations[lang].speak;

//   const recordBtn = document.querySelector("button[onclick='startRecording()']");
//   if (recordBtn) recordBtn.innerText = translations[lang].record;

//   const askSpeakBtn = document.querySelector("button[onclick='sendMessage()']");
//   if (askSpeakBtn) askSpeakBtn.innerText = translations[lang].askSpeak;

//   const nextBtn = document.querySelector("button[onclick='nextQuestion()']");
//   if (nextBtn) nextBtn.innerText = translations[lang].next;

//   const answerBox = document.getElementById("answer");
//   if (answerBox) answerBox.placeholder = translations[lang].placeholder;

//   const chatInput = document.getElementById("chatInput");
//   if (chatInput) chatInput.placeholder = translations[lang].chatPlaceholder;

//   const roundLabel = document.getElementById("roundLabel");
//   if (roundLabel) roundLabel.innerText = translations[lang].selectRound;

//   const roundSelect = document.getElementById("roundType");
//   if (roundSelect) {
//     roundSelect.options[0].text = translations[lang].hr;
//     roundSelect.options[1].text = translations[lang].technical;
//     roundSelect.options[2].text = translations[lang].coding;
//     roundSelect.options[3].text = translations[lang].behavior;
//   }
// }

// /* ===================== 🌍 TRANSLATE ===================== */
// async function translateToHindi(text) {
//   try {
//     const res = await fetch(
//       `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`
//     );
//     const data = await res.json();
//     return data.responseData.translatedText;
//   } catch (err) {
//     console.error("Translation error:", err);
//     return text;
//   }
// }

// /* ===================== 🔥 FIXED QUESTION LANGUAGE ===================== */
// function updateQuestionLanguage() {
//   const lang = localStorage.getItem("lang") || "en";

//   if (!window.originalQuestion) return;

//   if (lang === "hi") {
//     translateToHindi(window.originalQuestion).then(translated => {
//       document.getElementById("question").innerText = translated;
//     });
//   } else {
//     document.getElementById("question").innerText = window.originalQuestion;
//   }
// }

/* ===================== 🌍 TRANSLATIONS ===================== */
const translations = {
  en: {
    speak: "🎤 Speak",
    record: "🎥 Record",
    askSpeak: "Ask & Speak 🔊",
    next: "Next Question",
    selectRound: "Select Round",
    hr: "HR Round",
    technical: "Technical Round",
    coding: "Coding Round",
    behavior: "Behaviour Round",
    placeholder: "Speak or type your answer...",
    chatPlaceholder: "Ask something...",
    dashboard: "📊 Dashboard"
  },
  hi: {
    speak: "🎤 बोलें",
    record: "🎥 रिकॉर्ड करें",
    askSpeak: "पूछें और सुनें 🔊",
    next: "अगला प्रश्न",
    selectRound: "राउंड चुनें",
    hr: "एचआर राउंड",
    technical: "टेक्निकल राउंड",
    coding: "कोडिंग राउंड",
    behavior: "बिहेवियर राउंड",
    placeholder: "अपना उत्तर बोलें या लिखें...",
    chatPlaceholder: "कुछ पूछें...",
    dashboard: "📊 डैशबोर्ड"
  }
};

/* ===================== 🔄 TOGGLE LANGUAGE ===================== */
function toggleLanguage() {
  let current = localStorage.getItem("lang") || "en";
  const newLang = current === "en" ? "hi" : "en";

  localStorage.setItem("lang", newLang);

  updateLanguageUI();
  applyLanguage();
  updateQuestionLanguage(); // ✅ FIXED (no reload)
}

/* ===================== 🌐 UPDATE UI TEXT ===================== */
function updateLanguageUI() {
  const lang = localStorage.getItem("lang") || "en";

  const langText = document.getElementById("currentLang");
  if (langText) {
    langText.innerText = (lang === "hi") ? "🌐 हिंदी मोड" : "🌐 English Mode";
  }
}

/* ===================== 🧠 APPLY LANGUAGE ===================== */
function applyLanguage() {
  const lang = localStorage.getItem("lang") || "en";

  const speakBtn = document.querySelector("button[onclick='startVoice()']");
  if (speakBtn) speakBtn.innerText = translations[lang].speak;

  const dashboardBtn = document.querySelector("button[onclick='goToDashboard()']");
if (dashboardBtn) dashboardBtn.innerText = translations[lang].dashboard;

  const recordBtn = document.querySelector("button[onclick='startRecording()']");
  if (recordBtn) recordBtn.innerText = translations[lang].record;

  const askSpeakBtn = document.querySelector("button[onclick='sendMessage()']");
  if (askSpeakBtn) askSpeakBtn.innerText = translations[lang].askSpeak;

  const nextBtn = document.querySelector("button[onclick='nextQuestion()']");
  if (nextBtn) nextBtn.innerText = translations[lang].next;

  const answerBox = document.getElementById("answer");
  if (answerBox) answerBox.placeholder = translations[lang].placeholder;

  const chatInput = document.getElementById("chatInput");
  if (chatInput) chatInput.placeholder = translations[lang].chatPlaceholder;

  const roundLabel = document.getElementById("roundLabel");
  if (roundLabel) roundLabel.innerText = translations[lang].selectRound;

    const roundSelect = document.getElementById("roundType");
  if (roundSelect) {
    roundSelect.options[0].text = translations[lang].hr;
    roundSelect.options[1].text = translations[lang].technical;
    roundSelect.options[2].text = translations[lang].coding;
    roundSelect.options[3].text = translations[lang].behavior;
  }
}


/* ===================== 🌍 TRANSLATE ===================== */
async function translateToHindi(text) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`
    );
    const data = await res.json();
    return data.responseData.translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
}

/* ===================== 🔥 FIXED QUESTION LANGUAGE ===================== */
function updateQuestionLanguage() {
  const lang = localStorage.getItem("lang") || "en";

  if (!window.originalQuestion) return;

  if (lang === "hi") {
    translateToHindi(window.originalQuestion).then(translated => {
      document.getElementById("question").innerText = translated;
    });
  } else {
    document.getElementById("question").innerText = window.originalQuestion;
  }
}