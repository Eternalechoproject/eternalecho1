// === CONFIG ===
const OPENAI_API_KEY = "sk_2cb8d573424713016fbf17e7a3405babd3c36d4c5d3e8b13";
const ELEVENLABS_API_KEY = "sk_f1f2e850eb2fea7f8d3b3839513bb2fb5a3f54b5bb112bdc";
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Scarlett fallback

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

let lastEcho = "";
let echoMemory = [];
let overrideVoice = null;
let activeEcho = "#dad";

const personalityProfiles = {
  "#dad": {
    tone: "Encouraging, short, firm.",
    examples: ["You know what to do.", "I'm proud of how far you’ve come.", "Keep your chin up. One more round."]
  },
  "#mom": {
    tone: "Warm, comforting, overprotective.",
    examples: ["You don’t have to carry everything alone.", "You’ll always be my baby.", "I love you exactly as you are."]
  },
  "#partner": {
    tone: "Soft, emotional, reassuring.",
    examples: ["I miss your face.", "I know how hard that was. I'm here.", "You always feel like home."]
  },
  "#future": {
    tone: "Wise, calm, grounded. Encourages from experience.",
    examples: [
      "You're further along than you think.",
      "Keep going — I already know where this ends.",
      "I'm proud of what you're doing now. Don't stop.",
      "What you're building matters. Keep the long game in sight.",
      "One day you'll look back and be glad you didn’t quit today."
    ]
  }
};

const memoryModes = {
  "#dad": { icon: "👤", voice: "iiidtqDt9FBdT1vfBluA" },
  "#mom": { icon: "👩‍🦳", voice: "gPe4h2IS1C7XHbnizzFa" },
  "#partner": { icon: "❤️", voice: "WtA85syCrJwasGeHGH2p" },
  "#coach": { icon: "💪", voice: "MF3mGyEYCl7XYWbV9V6O" },
  "#friend": { icon: "✌️", voice: "ErXwobaYiN019PkySvjV" },
  "#child": { icon: "🧒", voice: "EXAVITQu4vr4xnSDxMaL" },
  "#future": { icon: "🧬", voice: "TxGEqnHWrfWFTfGW9XjX" }
};

sendBtn.onclick = () => {
  const msg = input.value.trim();
  if (!msg) return;

  let response = "You’re not alone. I’m here.";
  overrideVoice = ELEVENLABS_VOICE_ID;

  const matched = Object.keys(memoryModes).find(tag => msg.toLowerCase().includes(tag));
  if (matched) {
    const mode = memoryModes[matched];
    overrideVoice = mode.voice;
    const examples = personalityProfiles[matched]?.examples || [];
    response = examples[Math.floor(Math.random() * examples.length)] || response;
  } else {
    overrideVoice = voiceSelect.value || ELEVENLABS_VOICE_ID;
  }

  lastEcho = response;
  echoMemory.push({ user: msg, echo: response });
  renderMemoryLog();
  playVoice(response);
  input.value = "";
};

replayBtn.onclick = () => {
  if (lastEcho) playVoice(lastEcho);
};

function renderMemoryLog() {
  memoryLog.innerHTML = "";
  echoMemory.forEach(entry => {
    const div = document.createElement("div");
    div.setAttribute("data-emotion", getEmotion(entry.echo));
    div.innerHTML = `
      <span style="opacity:0.6;">You:</span> ${entry.user}<br>
      <span style="opacity:0.9;">Echo:</span> <span class="echo-line">${entry.echo}</span>
    `;
    memoryLog.appendChild(div);
  });
}

function getEmotion(text) {
  if (/love|miss|baby/i.test(text)) return "love";
  if (/proud|push|got this/i.test(text)) return "strong";
  if (/alone|tired|carry|sad/i.test(text)) return "sad";
  if (/here|home|with you/i.test(text)) return "comfort";
  return "";
}

function filterEchoByEmotion(filter) {
  const items = memoryLog.querySelectorAll("div");
  items.forEach(item => {
    const match = item.getAttribute("data-emotion");
    item.style.display = !filter || match === filter ? "" : "none";
  });
}

document.querySelectorAll(".emotion-filter").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".emotion-filter").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    const filter = button.getAttribute("data-emotion");
    filterEchoByEmotion(filter);
  };
});

function playVoice(text) {
  const voice = overrideVoice || voiceSelect.value;
  fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  })
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    })
    .catch(() => console.error("Voice playback failed"));
}

playAllBtn.onclick = () => {
  if (echoMemory.length === 0) return;
  let i = 0;
  function playNext() {
    if (i >= echoMemory.length) return;
    const line = echoMemory[i].echo;
    overrideVoice = ELEVENLABS_VOICE_ID;
    playVoice(line);
    i++;
    setTimeout(playNext, 3500);
  }
  playNext();
};

addExampleBtn.onclick = () => {
  const tag = profileTag.value;
  activeEcho = tag;
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

window.onload = () => {
  const introLine = "Hi. I’m still here.";
  overrideVoice = ELEVENLABS_VOICE_ID;
  playVoice(introLine);

  const savedProfiles = JSON.parse(localStorage.getItem("eternalEchoProfiles"));
  if (savedProfiles) Object.assign(personalityProfiles, savedProfiles);

  updatePersonalityDisplay();
  updatePresetPicker();
};
function isMorning() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 5 && hour <= 11;
}
buildEchoTiles();

function echoFutureLine() {
  const futureLines = personalityProfiles["#future"]?.examples || [];
  const response = futureLines[Math.floor(Math.random() * futureLines.length)];
  overrideVoice = memoryModes["#future"].voice;
  playVoice(response);
  echoMemory.push({ user: "(morning check-in)", echo: response });
  renderMemoryLog();
}
const echoTiles = document.getElementById("echoTiles");

const echoList = ["#dad", "#mom", "#partner", "#future"];

function buildEchoTiles() {
  echoTiles.innerHTML = "";
  echoList.forEach(tag => {
    const profile = personalityProfiles[tag];
    const tile = document.createElement("button");
    tile.textContent = `${memoryModes[tag].icon} ${tag.replace("#", "").toUpperCase()}`;
    tile.style.padding = "10px";
    tile.style.borderRadius = "10px";
    tile.style.background = activeEcho === tag ? "#555" : "#222";
    tile.style.color = "#fff";
    tile.style.flex = "1 1 30%";
    tile.style.border = "1px solid #444";
    tile.onclick = () => {
      activeEcho = tag;
      profileTag.value = tag;
      updatePersonalityDisplay();
      buildEchoTiles();
    };
    echoTiles.appendChild(tile);
  });
}

