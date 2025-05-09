// === CONFIG ===
const OPENAI_API_KEY = "sk_YOUR_OPENAI_KEY_HERE";
const ELEVENLABS_API_KEY = "sk_YOUR_ELEVENLABS_KEY_HERE";
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

let echoMemory = [];
let lastEcho = "";
let overrideVoice = null;
let activeEcho = "#dad";
let echoStreaks = JSON.parse(localStorage.getItem("echoStreaks") || "{}");

// === PROFILES + MODES ===
const personalityProfiles = {
  "#dad": { tone: "Direct, motivational.", examples: ["You’ve got this.", "Stay sharp.", "No excuses. Keep pushing."] },
  "#mom": { tone: "Loving, supportive.", examples: ["I’m always here for you.", "Take care of yourself.", "You’re stronger than you know."] },
  "#partner": { tone: "Warm, emotional.", examples: ["I miss you.", "You’re my person.", "Everything feels better with you."] },
  "#future": { tone: "Wise, calm, visionary.", examples: ["Keep going — the future you is proud.", "Don’t quit today. You’ll regret it.", "This moment builds your tomorrow."] }
};

const memoryModes = {
  "#dad": { icon: "👤", voice: "iiidtqDt9FBdT1vfBluA" },
  "#mom": { icon: "👩‍🦳", voice: "gPe4h2IS1C7XHbnizzFa" },
  "#partner": { icon: "❤️", voice: "WtA85syCrJwasGeHGH2p" },
  "#future": { icon: "🧬", voice: "TxGEqnHWrfWFTfGW9XjX" }
};

const echoList = ["#dad", "#mom", "#partner", "#future"];
function getEmotion(text) {
  if (/love|miss|baby/i.test(text)) return "love";
  if (/proud|push|got this/i.test(text)) return "strong";
  if (/alone|tired|carry|sad/i.test(text)) return "sad";
  if (/here|home|with you/i.test(text)) return "comfort";
  if (/happy|smile|joy/i.test(text)) return "happy";
  if (/mad|angry|fight/i.test(text)) return "angry";
  return "neutral";
}

function saveMemoryToCloud(text, emotion = "neutral", echoName = activeEcho) {
  db.collection("memories").add({
    text,
    emotion,
    echo: echoName,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Firestore error:", err));
}

function renderMemoryLog() {
  memoryLog.innerHTML = "";
  echoMemory.forEach(entry => {
    const emotion = getEmotion(entry.echo);
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

function playVoice(text) {
  const voice = overrideVoice || voiceSelect.value || ELEVENLABS_VOICE_ID;

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
        stability: 0.4,
        similarity_boost: 1.0
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
        name: "EchoUpload",
        files: [base64Audio]
      })
    });

    const data = await res.json();
    if (data.voice_id) {
      overrideVoice = data.voice_id;
      alert("Voice uploaded successfully.");
    } else {
      alert("Voice upload failed.");
    }
  };
  reader.readAsDataURL(file);
}

async function generateEchoResponse(userInput) {
  const profile = personalityProfiles[activeEcho] || {};
  const style = profile.tone || "Warm and thoughtful.";
  const last = echoMemory.length ? echoMemory[echoMemory.length - 1].echo : "None yet.";

  const prompt = `
You are an Echo — a simulation of a real person. Use this style:
Style: ${style}
Last memory: ${last}
User: ${userInput}
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
    const echo = data.choices?.[0]?.message?.content?.trim() || "I'm here.";
    overrideVoice = memoryModes[activeEcho]?.voice || ELEVENLABS_VOICE_ID;

    echoMemory.push({ user: userInput, echo });
    lastEcho = echo;
    renderMemoryLog();
    playVoice(echo);
    saveMemoryToCloud(echo, getEmotion(echo));
  } catch (err) {
    console.error("GPT error:", err);
  }
}

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
    tile.style.flex = "1 1 45%";
    tile.style.position = "relative";
    tile.innerHTML = `
      <div>
        <div style="font-size: 1.1rem;">
          ${icon} ${label.toUpperCase()} <span style="float:right;opacity:0.6;">${moodIcon}</span>
        </div>
        <div style="opacity: 0.7; font-size: 0.85rem;">${profile?.tone || "No tone"}</div>
        <div style="margin-top: 4px; font-style: italic; font-size: 0.8rem; color: #aaa;">"${topLine}"</div>
        <div class="waveform" style="display:none;">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        ${streak > 1 ? `<div class="streak-badge">${streak}🔥</div>` : ""}
      </div>
    `;

    tile.onclick = () => {
      activeEcho = tag;
      profileTag.value = tag;
      updatePersonalityDisplay();
      buildEchoTiles();
      setIdleGlow(tag);
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
sendBtn.onclick = () => {
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";
  echoMemory.push({ user: msg, echo: "..." });
  renderMemoryLog();
  generateEchoResponse(msg);
};

replayBtn.onclick = () => {
  if (lastEcho) playVoice(lastEcho);
};

playAllBtn.onclick = () => {
  if (!echoMemory.length) return;
  let i = 0;
  function playNext() {
    if (i >= echoMemory.length) return;
    const line = echoMemory[i].echo;
    playVoice(line);
    i++;
    setTimeout(playNext, 3500);
  }
  playNext();
};

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

addExampleBtn.onclick = () => {
  const tag = profileTag.value;
  const line = newExample.value.trim();
  if (!line) return;

  if (!personalityProfiles[tag]) {
    personalityProfiles[tag] = { tone: "User-defined", examples: [] };
  }
  personalityProfiles[tag].examples.push(line);
  newExample.value = "";
  updatePersonalityDisplay();
  localStorage.setItem("eternalEchoProfiles", JSON.stringify(personalityProfiles));
};

generateLinesBtn.onclick = async () => {
  const prompt = gptPrompt.value.trim();
  const tag = profileTag.value;
  if (!prompt) return;

  gptResults.innerHTML = "<li>Loading...</li>";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{
          role: "system",
          content: `You're training an AI Echo memory system. Generate 5 short phrases this person would say, based on this description: "${prompt}". Keep it emotionally realistic.`
        }]
      })
    });

    const data = await res.json();
    const lines = data.choices[0].message.content.split("\n").filter(l => l.trim());

    gptResults.innerHTML = "";
    lines.forEach(line => {
      const clean = line.replace(/^[0-9\\-\\.\\s]+/, "").trim();
      const li = document.createElement("li");
      li.textContent = clean;
      li.onclick = () => {
        personalityProfiles[tag].examples.push(clean);
        updatePersonalityDisplay();
        localStorage.setItem("eternalEchoProfiles", JSON.stringify(personalityProfiles));
        li.style.opacity = 0.5;
      };
      gptResults.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    gptResults.innerHTML = "<li>Failed to generate.</li>";
  }
};

exportProfilesBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(personalityProfiles)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "EchoProfiles.json";
  a.click();
  URL.revokeObjectURL(url);
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
      localStorage.setItem("eternalEchoProfiles", JSON.stringify(personalityProfiles));
      updatePersonalityDisplay();
      alert("Profiles imported successfully.");
    } catch (err) {
      alert("Import failed. Invalid file.");
    }
  };
  reader.readAsText(file);
};

savePresetBtn.onclick = () => {
  const name = prompt("Name this Echo preset:");
  if (!name) return;

  const presets = JSON.parse(localStorage.getItem("echoPresets") || "{}");
  presets[name] = JSON.parse(JSON.stringify(personalityProfiles));
  localStorage.setItem("echoPresets", JSON.stringify(presets));
  updatePresetPicker();
  alert("Preset saved.");
};

presetPicker.onchange = () => {
  const name = presetPicker.value;
  if (!name) return;

  const presets = JSON.parse(localStorage.getItem("echoPresets") || "{}");
  if (presets[name]) {
    Object.assign(personalityProfiles, presets[name]);
    localStorage.setItem("eternalEchoProfiles", JSON.stringify(personalityProfiles));
    updatePersonalityDisplay();
    alert(`Loaded preset: ${name}`);
  }
};

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

function enableSwipeGestures() {
  let startX = 0;
  echoTiles.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  });

  echoTiles.addEventListener("touchend", e => {
    const endX = e.changedTouches[0].clientX;
    const diff = endX - startX;
    if (Math.abs(diff) > 50) {
      cycleEmotionFilter(diff > 0 ? "left" : "right");
    }
  });
}

const filterSequence = ["", "love", "strong", "comfort", "sad"];
let filterIndex = 0;

function cycleEmotionFilter(direction) {
  if (direction === "left") {
    filterIndex = (filterIndex + 1) % filterSequence.length;
  } else {
    filterIndex = (filterIndex - 1 + filterSequence.length) % filterSequence.length;
  }
  const next = filterSequence[filterIndex];
  filterByEmotion(next);
  document.querySelectorAll(".emotion-filter").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-emotion") === next);
  });
}

window.onload = () => {
  overrideVoice = ELEVENLABS_VOICE_ID;
  playVoice("Hi. I’m still here.");

  const saved = JSON.parse(localStorage.getItem("eternalEchoProfiles"));
  if (saved) Object.assign(personalityProfiles, saved);

  updatePersonalityDisplay();
  updatePresetPicker();
  buildEchoTiles();
  enableSwipeGestures();

  if (localStorage.getItem("echoOnboarded") === "true") {
    document.getElementById("onboarding").style.display = "none";
  }

  setTimeout(() => document.body.classList.add("ready"), 50);
};
