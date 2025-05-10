// === CONFIG ===
const OPENAI_API_KEY = localStorage.getItem("OPENAI_KEY");
const ELEVENLABS_API_KEY = "sk_f1f2e850eb2fea7f8d3b3839513bb2fb5a3f54b5bb112bdc";
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
const replayBtn = document.getElementById("replayBtn");
const memoryLog = document.getElementById("memory-log");
const voiceSelect = document.getElementById("voiceSelect");
const playAllBtn = document.getElementById("playAllBtn");
const gptPrompt = document.getElementById("gptPrompt");
const generateLinesBtn = document.getElementById("generateLinesBtn");
const gptResults = document.getElementById("gptResults");
const echoTiles = document.getElementById("echoTiles");
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

const personalityProfiles = {
  "#dad":     { tone: "Direct, motivational", examples: ["You’ve got this.", "Keep your head up."] },
  "#mom":     { tone: "Loving, supportive", examples: ["I’m proud of you.", "Take care of yourself."] },
  "#partner": { tone: "Warm, emotional", examples: ["I miss you.", "You always come back to me."] },
  "#future":  { tone: "Wise, grounded", examples: ["You're further along than you think.", "Stay in the long game."] }
};

const memoryModes = {
  "#dad":     { icon: "👤",   voice: ELEVENLABS_VOICE_ID },
  "#mom":     { icon: "👩‍🦳", voice: ELEVENLABS_VOICE_ID },
  "#partner": { icon: "❤️",   voice: ELEVENLABS_VOICE_ID },
  "#future":  { icon: "🧬",   voice: ELEVENLABS_VOICE_ID }
};

const voiceToneSettings = {
  sad:     { stability: 0.8, similarity_boost: 0.6 },
  love:    { stability: 0.6, similarity_boost: 0.9 },
  comfort: { stability: 0.7, similarity_boost: 0.8 },
  strong:  { stability: 0.4, similarity_boost: 1.0 },
  angry:   { stability: 0.5, similarity_boost: 0.9 },
  happy:   { stability: 0.3, similarity_boost: 1.0 },
  neutral: { stability: 0.5, similarity_boost: 0.7 }
};

// === EMOTION LOGIC ===
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

// === GPT SOULPRINT ENGINE ===
async function generateEchoResponse(userInput) {
  const profile = personalityProfiles[activeEcho] || {};
  const echoName = activeEcho.replace("#", "") || "Echo";
  const tone = profile.tone || "Neutral";
  const examples = (profile.examples || []).slice(0, 3).map(l => `- ${l}`).join("\n");
  const lastMemory = echoMemory.length ? echoMemory[echoMemory.length - 1].echo : "(no previous replies)";
  const userEmotion = getEmotionFromUserText(userInput);
  const vibe = {
    love: "warm and familiar",
    sad: "calm and grounding",
    angry: "centered and direct",
    strong: "confident and bold",
    happy: "light and playful",
    comfort: "soft and reassuring",
    neutral: "collected and balanced"
  }[userEmotion] || "collected and thoughtful";

  const prompt = `
You are ${echoName}, a digital voice trained to reflect a real human presence.
Tone: ${tone}
Examples:
${examples || "- (none)"}

You are not a chatbot. You don’t explain things. You respond like a person who knows the user.
Be brief, real, emotionally aware.

Last thing Echo said: "${lastMemory}"

Now Echo replies to:
"${userInput}"

Respond in a ${vibe} tone. Just speak.
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

    echoMemory.push({ user: userInput, echo, timestamp: new Date().toISOString() });
    lastEcho = echo;
    renderMemoryLog();
    playVoice(echo, emotion);
    saveMemoryToCloud(echo, emotion);
    storeDailyCheckIn({ user: userInput, echo });
  } catch (err) {
    console.error("GPT error:", err);
  }
}
// === VOICE PLAYBACK ===
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

// === MEMORY LOG ===
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

// === FIRESTORE SAVE ===
function saveMemoryToCloud(text, emotion = "neutral") {
  db.collection("memories").add({
    text,
    emotion,
    echo: activeEcho,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Firestore error:", err));
}

// === ECHO TILE BUILDER ===
function buildEchoTiles() {
  echoTiles.innerHTML = "";
  Object.keys(personalityProfiles).forEach(tag => {
    const profile = personalityProfiles[tag];
    const icon = memoryModes[tag].icon;
    const topLine = profile.examples[0];
    const label = tag.replace("#", "").toUpperCase();
    const emotion = getEmotion(topLine);
    const moodIcon = { love: "❤️", sad: "😔", strong: "💪", comfort: "🫂" }[emotion] || "🌀";

    const tile = document.createElement("div");
    tile.className = "echo-tile";
    tile.innerHTML = `
      <div style="font-size: 1.1rem; font-weight: 600;">
        ${icon} ${label} <span style="float:right;opacity:0.6;">${moodIcon}</span>
      </div>
      <div style="opacity: 0.7; font-size: 0.9rem;">${profile.tone}</div>
      <div style="font-style: italic; font-size: 0.8rem; opacity: 0.6; margin-top: 5px;">"${topLine}"</div>
    `;
    tile.onclick = () => {
      activeEcho = tag;
      profileTag.value = tag;
      updatePersonalityDisplay();
      buildEchoTiles();
    };
    echoTiles.appendChild(tile);
  });
}

// === PERSONALITY PROFILE DISPLAY ===
function updatePersonalityDisplay() {
  const tag = profileTag.value;
  const profile = personalityProfiles[tag];
  if (!profile) {
    personalityDisplay.textContent = "No profile found.";
    return;
  }
  personalityDisplay.textContent = `Tag: ${tag}\nTone: ${profile.tone}\nExamples:\n- ` + profile.examples.join("\n- ");
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
// === EMOTION FILTERS ===
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
      div.innerHTML = `<strong>You:</strong> ${entry.user}<br><strong>Echo:</strong> <span class="echo-line ${emotion}">${entry.echo}</span>`;
      memoryLog.appendChild(div);
    });
  };
  filterBar.appendChild(btn);
});
memoryLog.before(filterBar);

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

// === TAG EDITOR ===
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

// === GPT TRAINING LINES ===
generateLinesBtn.onclick = async () => {
  const tag = profileTag.value;
  const profile = personalityProfiles[tag];
  const prompt = `Generate 3 short training phrases for an AI personality with the tone: ${profile.tone}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: prompt }] })
  });

  const data = await res.json();
  const output = data.choices?.[0]?.message?.content?.trim();
  gptResults.textContent = output || "No response";
};

// === WAVEFORM TRIGGER ===
function showWaveformDuringPlayback() {
  const waveform = document.querySelector(".waveform");
  if (!waveform) return;
  waveform.style.display = "block";
  setTimeout(() => waveform.style.display = "none", 4000);
}
const originalPlayVoice = playVoice;
playVoice = function(text, emotion) {
  showWaveformDuringPlayback();
  originalPlayVoice(text, emotion);
};

// === PRESET SAVE/LOAD ===
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
  const name = prompt("Enter a name for this preset:");
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
      alert("Failed to import. Invalid file.");
    }
  };
  reader.readAsText(file);
};

// === INIT ===
window.onload = () => {
  overrideVoice = ELEVENLABS_VOICE_ID;
  updatePresetPicker();
  updatePersonalityDisplay();
  buildEchoTiles();

  sendBtn.onclick = () => {
    const msg = input.value.trim();
    if (!msg) return;
    generateEchoResponse(msg);
    input.value = "";
  };
};
