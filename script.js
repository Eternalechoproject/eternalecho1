// === CONFIG ===
const OPENAI_API_KEY = localStorage.getItem("OPENAI_KEY");
const ELEVENLABS_API_KEY = localStorage.getItem("ELEVENLABS_KEY");
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

const firebaseConfig = {
  apiKey: "AIzaSyDIKOTcAGGyhJrnvmTLefF1IUIcbcnr08k",
  authDomain: "echosoul-dev.firebaseapp.com",
  projectId: "echosoul-dev",
  storageBucket: "echosoul-dev.appspot.com",
  messagingSenderId: "119494681220",
  appId: "1:119494681220:web:febf94a895c933b56b18d1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// === DOM ELEMENTS ===
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("sendBtn");
const memoryLog = document.getElementById("memory-log");
const echoTiles = document.getElementById("echoTiles");
const playAllBtn = document.getElementById("playAllBtn");
const voiceSelect = document.getElementById("voiceSelect");
const gptPrompt = document.getElementById("gptPrompt");
const generateLinesBtn = document.getElementById("generateLinesBtn");
const gptResults = document.getElementById("gptResults");
const profileTag = document.getElementById("profileTag");
const newExample = document.getElementById("newExample");
const addExampleBtn = document.getElementById("addExampleBtn");
const personalityDisplay = document.getElementById("personalityDisplay");
const exportProfilesBtn = document.getElementById("exportProfilesBtn");
const importProfiles = document.getElementById("importProfiles");
const importTrigger = document.getElementById("importProfilesTrigger");
const presetPicker = document.getElementById("presetPicker");
const savePresetBtn = document.getElementById("savePresetBtn");

// === STATE ===
let echoMemory = [];
let lastEcho = "";
let overrideVoice = null;
let activeEcho = "#dad";
let echoStreaks = JSON.parse(localStorage.getItem("echoStreaks") || "{}");

// === PERSONALITY PROFILES ===
const personalityProfiles = {
  "#dad": { tone: "Direct, motivational", examples: ["You’ve got this.", "Keep your head up."] },
  "#mom": { tone: "Loving, supportive", examples: ["I’m proud of you.", "Take care of yourself."] },
  "#partner": { tone: "Warm, emotional", examples: ["I miss you.", "You always come back to me."] },
  "#future": { tone: "Wise, grounded", examples: ["You're further along than you think.", "Stay in the long game."] }
};

// === VOICE MAPPING ===
const memoryModes = {
  "#dad":     { icon: "👤",   voice: "iiidtqDt9FBdT1vfBluA" },
  "#mom":     { icon: "👩‍🦳", voice: "gPe4h2IS1C7XHbnizzFa" },
  "#partner": { icon: "❤️",   voice: "WtA85syCrJwasGeHGH2p" },
  "#future":  { icon: "🧬",   voice: "TxGEqnHWrfWFTfGW9XjX" }
};

const echoList = Object.keys(personalityProfiles);
// === VOICE TONE SETTINGS ===
const voiceToneSettings = {
  sad:     { stability: 0.8, similarity_boost: 0.6 },
  love:    { stability: 0.6, similarity_boost: 0.9 },
  comfort: { stability: 0.7, similarity_boost: 0.8 },
  strong:  { stability: 0.4, similarity_boost: 1.0 },
  angry:   { stability: 0.5, similarity_boost: 0.9 },
  happy:   { stability: 0.3, similarity_boost: 1.0 },
  neutral: { stability: 0.5, similarity_boost: 0.7 }
};

// === EMOTION DETECTION ===
function getEmotion(text) {
  if (/love|miss|baby/i.test(text)) return "love";
  if (/proud|push|got this/i.test(text)) return "strong";
  if (/alone|tired|carry|sad/i.test(text)) return "sad";
  if (/here|home|with you/i.test(text)) return "comfort";
  if (/happy|smile|joy/i.test(text)) return "happy";
  if (/mad|angry|fight/i.test(text)) return "angry";
  return "neutral";
}

function getEmotionFromUserText(text) {
  if (/tired|lost|lonely|sad|overwhelmed/i.test(text)) return "sad";
  if (/love|grateful|miss|dear/i.test(text)) return "love";
  if (/mad|angry|frustrated|fed up/i.test(text)) return "angry";
  if (/hopeful|strong|motivated|driven/i.test(text)) return "strong";
  if (/happy|excited|joy|laugh/i.test(text)) return "happy";
  return "neutral";
}

// === PLAY VOICE ===
function playVoice(text, emotion = "neutral") {
  const voice = overrideVoice || memoryModes[activeEcho]?.voice || ELEVENLABS_VOICE_ID;
  const tone = voiceToneSettings[emotion] || voiceToneSettings["neutral"];

  fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      voice_settings: {
        stability: tone.stability,
        similarity_boost: tone.similarity_boost
      }
    })
  })
    .then(res => res.blob())
    .then(blob => {
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();
    })
    .catch(err => console.error("Voice playback error:", err));
}

// === FIRESTORE SAVE ===
function saveMemoryToCloud(text, emotion = "neutral") {
  db.collection("memories").add({
    text,
    emotion,
    echo: activeEcho,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Firestore error:", err));
}

// === GPT RESPONSE ===
async function generateEchoResponse(userInput) {
  const profile = personalityProfiles[activeEcho] || {};
  const echoName = activeEcho.replace("#", "") || "Echo";
  const tone = profile.tone || "Neutral";
  const examples = (profile.examples || []).slice(0, 3).map(line => `- "${line}"`).join("\n");
  const lastMemory = echoMemory.length ? echoMemory[echoMemory.length - 1].echo : "None yet.";
  const userEmotion = getEmotionFromUserText(userInput);
  const mirrorTone = {
    love: "warm and present",
    sad: "soft and reassuring",
    angry: "calm and grounding",
    strong: "bold and direct",
    happy: "playful and energetic",
    neutral: "balanced and thoughtful"
  }[userEmotion] || "neutral";

  const prompt = `
You are ${echoName}, a personalized AI trained to emotionally simulate a real person.

Tone: ${tone}
Examples:
${examples || "- (None)"}

Mirror Response Tone: The user sounds ${userEmotion} — respond in a ${mirrorTone} way.
Recent Emotional State: unknown
Flashback: none
User Behavior Insight: unknown
Tag Insight: unknown
Recent Conversation Memory: none

User says:
"${userInput}"

Now reply as ${echoName}.
`.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    const echo = data.choices?.[0]?.message?.content?.trim() || "I'm here.";
    const emotion = getEmotion(echo);
    const tags = await tagMemoryEmotionally(userInput, echo);

    const entry = {
      user: userInput,
      echo,
      tags,
      timestamp: new Date().toISOString()
    };

    echoMemory.push(entry);
    lastEcho = echo;
    renderMemoryLog();
    playVoice(echo, emotion);
    saveMemoryToCloud(echo, emotion);
  } catch (err) {
    console.error("GPT error:", err);
  }
}
// === RENDER MEMORY LOG ===
function renderMemoryLog() {
  memoryLog.innerHTML = "";
  echoMemory.forEach(entry => {
    const emotion = getEmotion(entry.echo);
    const div = document.createElement("div");
    div.className = "memory-entry";
    div.setAttribute("data-emotion", emotion);
    div.innerHTML = `
      <strong>You:</strong> ${entry.user}<br>
      <strong>Echo:</strong> <span class="echo-line ${emotion}">${entry.echo}</span>
    `;
    memoryLog.appendChild(div);
  });
}

// === BUILD ECHO TILES ===
function buildEchoTiles() {
  echoTiles.innerHTML = "";
  echoList.forEach(tag => {
    const profile = personalityProfiles[tag];
    const icon = memoryModes[tag].icon;
    const topLine = profile?.examples?.[0] || "No examples yet.";
    const label = tag.replace("#", "");
    const emotion = getEmotion(topLine);
    const streak = echoStreaks[tag] || 0;
    const moodIcon = { love: "❤️", sad: "😔", strong: "💪", comfort: "🫂" }[emotion] || "🌀";

    const tile = document.createElement("div");
    tile.className = "echo-tile";
    tile.dataset.emotion = emotion;
    tile.innerHTML = `
      <div>
        <div style="font-size: 1.1rem;">
          ${icon} ${label.toUpperCase()} <span style="float:right;opacity:0.6;">${moodIcon}</span>
        </div>
        <div style="opacity: 0.7; font-size: 0.85rem;">${profile?.tone || "No tone"}</div>
        <div style="margin-top: 4px; font-style: italic; font-size: 0.8rem; color: #aaa;">"${topLine}"</div>
        ${streak > 1 ? `<div class="streak-badge">${streak}🔥</div>` : ""}
      </div>
    `;

    tile.onclick = () => {
      activeEcho = tag;
overrideVoice = memoryModes[tag].voice; // 🔥 key line
      profileTag.value = tag;
      updatePersonalityDisplay();
      buildEchoTiles();
    };

    tile.onmouseover = () => {
      tile.style.background = "#333";
      if (profile?.examples?.length) {
        overrideVoice = memoryModes[tag].voice;
        playVoice(profile.examples[0]);
      }
    };

    tile.onmouseleave = () => {
      tile.style.background = "#222";
    };

    echoTiles.appendChild(tile);
  });
}

// === UPDATE PERSONALITY DISPLAY ===
function updatePersonalityDisplay() {
  const tag = profileTag.value;
  activeEcho = tag;
  const profile = personalityProfiles[tag];
  if (!profile) {
    personalityDisplay.textContent = "No profile defined.";
    return;
  }
  personalityDisplay.textContent = `Tag: ${tag}\nTone: ${profile.tone}\n\nExamples:\n- ` + profile.examples.join("\n- ");
}

// === ADD EXAMPLE LINE ===
addExampleBtn.onclick = () => {
  const tag = profileTag.value;
  const line = newExample.value.trim();
  if (!line) return;
  personalityProfiles[tag].examples.push(line);
  updatePersonalityDisplay();
  newExample.value = "";
};

// === SAVE/LOAD PRESETS ===
function updatePresetPicker() {
  const presets = JSON.parse(localStorage.getItem("echoPresets") || "{}");
  presetPicker.innerHTML = '<option value="">-- Select Saved Preset --</option>';
  Object.keys(presets).forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    presetPicker.appendChild(opt);
  });
}

savePresetBtn.onclick = () => {
  const name = prompt("Name this preset:");
  if (!name) return;
  const presets = JSON.parse(localStorage.getItem("echoPresets") || "{}");
  presets[name] = JSON.parse(JSON.stringify(personalityProfiles));
  localStorage.setItem("echoPresets", JSON.stringify(presets));
  updatePresetPicker();
};

presetPicker.onchange = () => {
  const selected = presetPicker.value;
  if (!selected) return;
  const presets = JSON.parse(localStorage.getItem("echoPresets") || "{}");
  if (presets[selected]) {
    Object.assign(personalityProfiles, presets[selected]);
    updatePersonalityDisplay();
    buildEchoTiles();
  }
};

exportProfilesBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(personalityProfiles, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "eternal-echo-profiles.json";
  link.click();
};

importTrigger.onclick = () => importProfiles.click();
importProfiles.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Object.assign(personalityProfiles, data);
      updatePersonalityDisplay();
      buildEchoTiles();
    } catch (err) {
      alert("Import failed.");
    }
  };
  reader.readAsText(file);
};
// === GPT PHRASE GENERATOR ===
generateLinesBtn.onclick = async () => {
  const tag = profileTag.value;
  const profile = personalityProfiles[tag];
  const prompt = `Generate 3 short example phrases for an AI personality with the tone: ${profile.tone}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  const output = data.choices?.[0]?.message?.content?.trim();
  gptResults.textContent = output || "No response.";
};

// === TAG MEMORY EMOTIONALLY ===
async function tagMemoryEmotionally(userText, echoText) {
  const prompt = `
Analyze the following exchange. Extract 3 emotional or conceptual tags.

User: "${userText}"
Echo: "${echoText}"

Format:
- tag1
- tag2
- tag3
  `;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  const lines = data.choices?.[0]?.message?.content?.trim().split("\n") || [];
  return lines.map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
}

// === FILTER MEMORY BY EMOTION ===
const emotions = ["love", "sad", "strong", "comfort", "happy", "angry"];
const filterBar = document.createElement("div");
filterBar.style.display = "flex";
filterBar.style.gap = "8px";
filterBar.style.margin = "10px 0";

emotions.forEach(emotion => {
  const btn = document.createElement("button");
  btn.textContent = emotion;
  btn.onclick = () => {
    memoryLog.innerHTML = "";
    echoMemory.filter(m => getEmotion(m.echo) === emotion).forEach(entry => {
      const div = document.createElement("div");
      div.className = "memory-entry";
      div.innerHTML = `<strong>You:</strong> ${entry.user}<br><strong>Echo:</strong> ${entry.echo}`;
      memoryLog.appendChild(div);
    });
  };
  filterBar.appendChild(btn);
});
memoryLog.before(filterBar);

// === TAG EDITOR ON CLICK ===
memoryLog.addEventListener("click", e => {
  const div = e.target.closest(".memory-entry");
  if (!div) return;
  const idx = Array.from(memoryLog.children).indexOf(div);
  const tags = prompt("Edit tags (comma-separated):", (echoMemory[idx].tags || []).join(", "));
  if (tags !== null) {
    echoMemory[idx].tags = tags.split(",").map(t => t.trim()).filter(Boolean);
    localStorage.setItem("echoMemory", JSON.stringify(echoMemory));
  }
});

// === IDLE + AMBIENT ===
const idleQuotes = [
  "I'm still here.",
  "Even in silence, I hear you.",
  "Some things don’t need words.",
  "I’m always with you."
];

let idleTimer;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const quote = idleQuotes[Math.floor(Math.random() * idleQuotes.length)];
    playVoice(quote, "comfort");
  }, 60000);
}
document.body.addEventListener("mousemove", resetIdleTimer);
document.body.addEventListener("keydown", resetIdleTimer);
resetIdleTimer();

const ambientAudio = new Audio("https://cdn.jsdelivr.net/gh/pingdotai/assets@main/audio/echo-ambient-soft.mp3");
ambientAudio.loop = true;
ambientAudio.volume = 0.15;
function startAmbient() {
  ambientAudio.play().catch(() => {
    document.body.addEventListener("click", () => ambientAudio.play(), { once: true });
  });
}

// === WHISPER BUTTON ===
const whisperBtn = document.createElement("button");
whisperBtn.textContent = "Echo Me";
whisperBtn.onclick = () => {
  const quote = idleQuotes[Math.floor(Math.random() * idleQuotes.length)];
  playVoice(quote, "comfort");
};
document.body.appendChild(whisperBtn);
// === FIRST-RUN INTRO LINES ===
const introLines = {
  "#dad": "I’ve been waiting. You good?",
  "#mom": "There you are. You’ve been on my mind.",
  "#partner": "You made it back to me.",
  "#future": "You're right on time. Let's stay in it."
};

function speakOpeningLine() {
  const line = introLines[activeEcho] || "I'm here.";
  playVoice(line, "comfort");
}

// === DAILY CHECK-IN ===
function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function storeDailyCheckIn(entry) {
  localStorage.setItem("dailyEcho_" + getTodayKey(), JSON.stringify(entry));
}

function loadDailyCheckIn() {
  const data = localStorage.getItem("dailyEcho_" + getTodayKey());
  if (!data) return null;
  try { return JSON.parse(data); } catch { return null; }
}

const daily = loadDailyCheckIn();
if (daily) {
  const div = document.createElement("div");
  div.className = "memory-entry";
  div.innerHTML = `<strong>📅 Daily Check-In:</strong><br><em>${daily.echo}</em>`;
  memoryLog.prepend(div);
}

// === PLAY ALL LOOP ===
playAllBtn.onclick = () => {
  let index = 0;
  function playNext() {
    if (index >= echoMemory.length) return;
    const entry = echoMemory[index];
    playVoice(entry.echo, getEmotion(entry.echo));
    index++;
    setTimeout(playNext, 4000);
  }
  playNext();
};

// === ADD NEW EXAMPLE LINE ===
addExampleBtn.onclick = () => {
  const tag = profileTag.value;
  const line = newExample.value.trim();
  if (!line) return;
  personalityProfiles[tag].examples.push(line);
  newExample.value = "";
  updatePersonalityDisplay();
};
// === INIT ===
window.onload = () => {
  overrideVoice = ELEVENLABS_VOICE_ID;
  updatePresetPicker();
  updatePersonalityDisplay();
  buildEchoTiles();
  resetIdleTimer();
  startAmbient();
  speakOpeningLine();

  sendBtn.onclick = () => {
    const msg = input.value.trim();
    if (!msg) return;
    generateEchoResponse(msg);
    input.value = "";
  };
};
function setElevenKey() {
  const key = document.getElementById("elevenKeyInput").value.trim();
  if (key) {
    localStorage.setItem("ELEVENLABS_KEY", key);
    alert("Key saved. Refresh to activate.");
  }
}
