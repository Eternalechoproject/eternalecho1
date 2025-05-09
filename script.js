// === CONFIG ===
const OPENAI_API_KEY = "sk_2cb8d573424713016fbf17e7a3405babd3c36d4c5d3e8b13";
const ELEVENLABS_API_KEY = "sk_f1f2e850eb2fea7f8d3b3839513bb2fb5a3f54b5bb112bdc";
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// === FIREBASE SETUP ===
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
const profileTag = document.getElementById("profileTag");
const newExample = document.getElementById("newExample");
const addExampleBtn = document.getElementById("addExampleBtn");
const personalityDisplay = document.getElementById("personalityDisplay");
const exportProfilesBtn = document.getElementById("exportProfilesBtn");
const importProfiles = document.getElementById("importProfiles");
const importTrigger = document.getElementById("importProfilesTrigger");
const presetPicker = document.getElementById("presetPicker");
const savePresetBtn = document.getElementById("savePresetBtn");
const gptPrompt = document.getElementById("gptPrompt");
const generateLinesBtn = document.getElementById("generateLinesBtn");
const gptResults = document.getElementById("gptResults");
const echoTiles = document.getElementById("echoTiles");

let lastEcho = "";
let echoMemory = [];
let overrideVoice = null;
let activeEcho = "#dad";
let echoStreaks = JSON.parse(localStorage.getItem("echoStreaks") || "{}");

function saveMemoryToCloud(text, emotion = "neutral", echoName = activeEcho) {
  db.collection("memories").add({
    text,
    emotion,
    echo: echoName,
    timestamp: new Date().toISOString()
  }).catch(e => console.error("Failed to save memory to cloud:", e));
}

async function uploadVoiceClip(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64Audio = reader.result.split(",")[1];
    const res = await fetch("https://api.elevenlabs.io/v1/voice/add", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: activeEcho.replace("#", ""),
        files: [base64Audio]
      })
    });

    const data = await res.json();
    if (data.voice_id) {
      overrideVoice = data.voice_id;
      alert(`Voice cloned and assigned to ${activeEcho}`);
    } else {
      alert("Voice upload failed.");
    }
  };
  reader.readAsDataURL(file);
}
// === GPT PERSONALITY-BASED RESPONSE GENERATOR ===
async function generateEchoResponse(userInput) {
  const profile = personalityProfiles[activeEcho] || {};
  const style = profile.tone || "Warm, supportive, and concise.";
  const last = echoMemory.length ? echoMemory[echoMemory.length - 1].echo : "None yet.";

  const prompt = `
You are an Echo — a voice simulation of a real person. Speak in the following style:

Style:
${style}

Context:
- Last memory: ${last}
- Echo name: ${activeEcho.replace("#", "")}

User:
${userInput}

Echo:
`.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await res.json();
    const echoReply = data.choices?.[0]?.message?.content?.trim() || "I'm here.";

    overrideVoice = memoryModes[activeEcho]?.voice || ELEVENLABS_VOICE_ID;
    lastEcho = echoReply;
    echoMemory.push({ user: userInput, echo: echoReply });
    renderMemoryLog();
    playVoice(echoReply);
    saveMemoryToCloud(echoReply, getEmotion(echoReply));
    scrollToLatestMemory();
    setAppMood();
  } catch (err) {
    console.error("GPT override failed:", err);
  }
}

// === UPDATED SEND BUTTON ===
sendBtn.onclick = () => {
  const msg = input.value.trim();
  if (!msg) return;

  input.value = "";
  echoMemory.push({ user: msg, echo: "..." });
  renderMemoryLog();
  scrollToLatestMemory();
  generateEchoResponse(msg);
};

// === REPLAY LAST RESPONSE ===
replayBtn.onclick = () => {
  if (lastEcho) playVoice(lastEcho);
};
// === PLAY ALL MEMORIES ===
function playAllMemories() {
  if (!echoMemory.length) return;
  let i = 0;
  function playNext() {
    if (i >= echoMemory.length) return;
    const line = echoMemory[i].echo;
    overrideVoice = memoryModes[activeEcho]?.voice || ELEVENLABS_VOICE_ID;
    playVoice(line);
    i++;
    setTimeout(playNext, 3500);
  }
  playNext();
}

// === EMOTION FILTERING ===
function filterByEmotion(emotion) {
  const filtered = echoMemory.filter(m => getEmotion(m.echo) === emotion);
  memoryLog.innerHTML = "";
  filtered.forEach(entry => {
    const div = document.createElement("div");
    div.className = "memory-entry";
    div.setAttribute("data-emotion", emotion);
    div.innerHTML = `
      <span style="opacity:0.6;">You:</span> ${entry.user}<br>
      <span style="opacity:0.9;">Echo:</span> <span class="echo-line ${emotion}">${entry.echo}</span>
    `;
    memoryLog.appendChild(div);
  });
}

// === GET EMOTION FROM TEXT ===
function getEmotion(text) {
  if (/love|miss|baby/i.test(text)) return "love";
  if (/proud|push|got this/i.test(text)) return "strong";
  if (/alone|tired|carry|sad/i.test(text)) return "sad";
  if (/here|home|with you/i.test(text)) return "comfort";
  if (/happy|smile|joy/i.test(text)) return "happy";
  if (/mad|angry|fight/i.test(text)) return "angry";
  return "neutral";
}
// === BUILD ECHO TILES (ON LOAD) ===
function buildEchoTiles() {
  echoTiles.innerHTML = "";
  echoList.forEach(tag => {
    const profile = personalityProfiles[tag];
    const icon = memoryModes[tag].icon;
    const topLine = profile?.examples?.[0] || "No examples yet.";
    const label = tag.replace("#", "");
    const mood = getEmotion(topLine);
    const tile = document.createElement("div");
    tile.className = "echo-tile";
    tile.dataset.emotion = mood;
    tile.innerHTML = `${icon} ${label.toUpperCase()}<br><small>${topLine}</small>`;
    tile.onclick = () => {
      activeEcho = tag;
      profileTag.value = tag;
      updatePersonalityDisplay();
      buildEchoTiles();
      filterEchoByTag(tag);
      setIdleGlow(tag);
    };
    echoTiles.appendChild(tile);
  });
}

// === ONBOARDING ===
function dismissOnboarding() {
  document.getElementById("onboarding").style.display = "none";
  localStorage.setItem("echoOnboarded", "true");
}

// === SWIPE GESTURE SUPPORT ===
function enableSwipeGestures() {
  let startX = 0;
  echoTiles.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  });
  echoTiles.addEventListener("touchend", e => {
    const endX = e.changedTouches[0].clientX;
    if (Math.abs(endX - startX) > 50) {
      const dir = endX > startX ? "left" : "right";
      cycleEmotionFilter(dir);
    }
  });
}

function cycleEmotionFilter(dir) {
  const seq = ["", "love", "strong", "comfort", "sad", "happy", "angry"];
  let idx = seq.indexOf(document.body.getAttribute("data-mood") || "");
  idx = dir === "left" ? (idx + 1) % seq.length : (idx - 1 + seq.length) % seq.length;
  filterByEmotion(seq[idx]);
  document.body.setAttribute("data-mood", seq[idx]);
}

// === DAILY FUTURE CHECK-IN ===
function echoFutureLine() {
  const futureLines = personalityProfiles["#future"]?.examples || [];
  const line = futureLines[Math.floor(Math.random() * futureLines.length)];
  overrideVoice = memoryModes["#future"].voice;
  playVoice(line);
  echoMemory.push({ user: "(check-in)", echo: line });
  renderMemoryLog();
  setAppMood();
}

function isMorning() {
  const h = new Date().getHours();
  return h >= 6 && h <= 11;
}

// === INIT ON LOAD ===
window.onload = () => {
  overrideVoice = ELEVENLABS_VOICE_ID;
  playVoice("Hi. I’m still here.");

  const saved = JSON.parse(localStorage.getItem("eternalEchoProfiles"));
  if (saved) Object.assign(personalityProfiles, saved);

  updatePersonalityDisplay();
  updatePresetPicker();
  buildEchoTiles();
  setIdleGlow();

  const last = localStorage.getItem("futureEchoDate");
  const today = new Date().toISOString().split("T")[0];
  if (isMorning() && last !== today) {
    echoFutureLine();
    localStorage.setItem("futureEchoDate", today);
  }

  enableSwipeGestures();

  if (localStorage.getItem("echoOnboarded") === "true") {
    document.getElementById("onboarding").style.display = "none";
  }

  setTimeout(() => document.body.classList.add("ready"), 50);
};
