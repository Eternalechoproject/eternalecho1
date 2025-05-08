// === CONFIG ===
const OPENAI_API_KEY = "sk_2cb8d573424713016fbf17e7a3405babd3c36d4c5d3e8b13";
const ELEVENLABS_API_KEY = "sk_f1f2e850eb2fea7f8d3b3839513bb2fb5a3f54b5bb112bdc";
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

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

const personalityProfiles = {
  "#dad": {
    tone: "Encouraging, short, firm.",
    examples: [
      "You know what to do.",
      "I'm proud of how far you’ve come.",
      "Keep your chin up. One more round."
    ]
  },
  "#mom": {
    tone: "Warm, comforting, overprotective.",
    examples: [
      "You don’t have to carry everything alone.",
      "You’ll always be my baby.",
      "I love you exactly as you are."
    ]
  },
  "#partner": {
    tone: "Soft, emotional, reassuring.",
    examples: [
      "I miss your face.",
      "I know how hard that was. I'm here.",
      "You always feel like home."
    ]
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

const echoList = ["#dad", "#mom", "#partner", "#future"];

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

    const today = new Date().toISOString().split("T")[0];
    const key = `streak-${matched}`;
    const last = localStorage.getItem(`${key}-last`);
    if (last !== today) {
      echoStreaks[matched] = (echoStreaks[matched] || 0) + 1;
      localStorage.setItem("echoStreaks", JSON.stringify(echoStreaks));
      localStorage.setItem(`${key}-last`, today);
    }
  } else {
    overrideVoice = voiceSelect.value || ELEVENLABS_VOICE_ID;
  }

  lastEcho = response;
  echoMemory.push({ user: msg, echo: response });
  renderMemoryLog();
  playVoice(response);
  input.value = "";
  scrollToLatestMemory();
  setAppMood();
};
replayBtn.onclick = () => {
  if (lastEcho) playVoice(lastEcho);
};

function renderMemoryLog() {
  memoryLog.innerHTML = "";
  echoMemory.forEach(entry => {
    const emotion = getEmotion(entry.echo);
    const div = document.createElement("div");
    div.className = `memory-entry`;
    div.setAttribute("data-emotion", emotion);

    const ageIndex = echoMemory.indexOf(entry);
    let ageTag = "new";
    if (ageIndex > 4) ageTag = "mid";
    if (ageIndex > 10) ageTag = "old";
    div.setAttribute("data-age", ageTag);

    div.innerHTML = `
      <span style="opacity:0.6;">You:</span> ${entry.user}<br>
      <span style="opacity:0.9;">Echo:</span> <span class="echo-line ${emotion}">${entry.echo}</span>
    `;
    memoryLog.appendChild(div);
  });
}

function scrollToLatestMemory() {
  memoryLog.scrollTop = memoryLog.scrollHeight;
}

function getEmotion(text) {
  if (/love|miss|baby/i.test(text)) return "love";
  if (/proud|push|got this/i.test(text)) return "strong";
  if (/alone|tired|carry|sad/i.test(text)) return "sad";
  if (/here|home|with you/i.test(text)) return "comfort";
  return "";
}

function setAppMood() {
  const moodCounts = { love: 0, sad: 0, strong: 0, comfort: 0 };
  echoMemory.forEach(entry => {
    const mood = getEmotion(entry.echo);
    if (mood) moodCounts[mood]++;
  });
  const dominant = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
  document.body.setAttribute("data-mood", dominant?.[0] || "");
}

function setIdleGlow(tag = activeEcho) {
  document.querySelectorAll(".echo-tile").forEach(tile => tile.classList.remove("idle"));
  const tile = Array.from(document.querySelectorAll(".echo-tile"))
    .find(t => t.textContent.toLowerCase().includes(tag.replace("#", "")));
  if (tile) tile.classList.add("idle");
}

function playVoice(text) {
  const voice = overrideVoice || voiceSelect.value;
  const allTiles = document.querySelectorAll(".echo-tile");
  allTiles.forEach(tile => tile.classList.remove("playing"));

  const activeTile = Array.from(allTiles).find(tile =>
    tile.textContent.toLowerCase().includes(activeEcho.replace("#", ""))
  );
  const wave = activeTile?.querySelector(".waveform");
  if (wave) wave.style.display = "flex";
  if (activeTile) activeTile.classList.add("playing");

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
      audio.onended = () => {
        if (wave) wave.style.display = "none";
        if (activeTile) activeTile.classList.remove("playing");
      };
    })
    .catch(() => {
      if (wave) wave.style.display = "none";
      if (activeTile) activeTile.classList.remove("playing");
      console.error("Voice playback failed");
    });
}

function buildEchoTiles() {
  echoTiles.innerHTML = "";
  echoList.forEach(tag => {
    const profile = personalityProfiles[tag];
    const icon = memoryModes[tag].icon;
    const topLine = profile?.examples?.[0] || "No examples yet.";
    const label = tag.replace("#", "");
    const imageFile = `${label}.jpg`;
    const emotion = getEmotion(topLine);
    const streak = echoStreaks[tag] || 0;
    const moodIcon = {
      love: "❤️",
      sad: "😔",
      strong: "💪",
      comfort: "🫂"
    }[emotion] || "🌀";

    const tile = document.createElement("div");
    tile.className = "echo-tile";
    if (activeEcho === tag) tile.classList.add("active");
    tile.dataset.emotion = emotion;
    tile.style.flex = "1 1 45%";
    tile.style.padding = "12px";
    tile.style.borderRadius = "12px";
    tile.style.background = activeEcho === tag ? "#333" : "#1e1e1e";
    tile.style.border = "1px solid #444";
    tile.style.transition = "all 0.3s ease";
    tile.style.cursor = "pointer";
    tile.style.display = "flex";
    tile.style.gap = "10px";
    tile.style.alignItems = "center";

    tile.innerHTML = `
      <div style="position: relative;">
        <img src="${imageFile}" style="width:50px;height:50px;border-radius:8px;border:1px solid #444;object-fit:cover;" />
        <div class="waveform" style="position:absolute;bottom:-12px;left:0;right:0;display:none;">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        ${streak > 1 ? `<div class="streak-badge">${streak}🔥</div>` : ""}
      </div>
      <div>
        <div style="font-size: 1.1rem;">
          ${icon} ${label.toUpperCase()} <span style="float:right;opacity:0.6;">${moodIcon}</span>
        </div>
        <div style="opacity: 0.7; font-size: 0.85rem;">${profile?.tone || "No tone set"}</div>
        <div style="margin-top: 4px; font-style: italic; font-size: 0.8rem; color: #aaa;">"${topLine}"</div>
      </div>
    `;

    tile.onclick = () => {
      activeEcho = tag;
      profileTag.value = tag;
      updatePersonalityDisplay();
      buildEchoTiles();
      filterEchoByTag(tag);
      setIdleGlow(tag);
    };

    tile.onmouseover = () => {
      tile.style.background = "#444";
      if (profile?.examples?.length) {
        overrideVoice = memoryModes[tag].voice;
        playVoice(profile.examples[0]);
      }
    };

    tile.onmouseleave = () => {
      tile.style.background = activeEcho === tag ? "#333" : "#1e1e1e";
    };

    echoTiles.appendChild(tile);
  });
}
function filterEchoByTag(tag) {
  const items = memoryLog.querySelectorAll("div");
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const matches = text.includes(tag.replace("#", ""));
    item.style.display = matches ? "" : "none";
  });
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

function echoFutureLine() {
  const futureLines = personalityProfiles["#future"]?.examples || [];
  const response = futureLines[Math.floor(Math.random() * futureLines.length)];
  overrideVoice = memoryModes["#future"].voice;
  playVoice(response);
  echoMemory.push({ user: "(morning check-in)", echo: response });
  renderMemoryLog();
  setAppMood();
}

function isMorning() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 5 && hour <= 11;
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
  filterEchoByEmotion(next);
  if (next) sortMemoryByEmotion(next);
  document.querySelectorAll(".emotion-filter").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-emotion") === next);
  });
}

function dismissOnboarding() {
  document.getElementById("onboarding").style.display = "none";
  localStorage.setItem("echoOnboarded", "true");
}

window.onload = () => {
  const introLine = "Hi. I’m still here.";
  overrideVoice = ELEVENLABS_VOICE_ID;
  playVoice(introLine);

  const savedProfiles = JSON.parse(localStorage.getItem("eternalEchoProfiles"));
  if (savedProfiles) Object.assign(personalityProfiles, savedProfiles);

  updatePersonalityDisplay();
  updatePresetPicker();
  buildEchoTiles();
  setIdleGlow();

  const lastCheck = localStorage.getItem("futureEchoDate");
  const today = new Date().toISOString().split("T")[0];
  if (isMorning() && lastCheck !== today) {
    echoFutureLine();
    localStorage.setItem("futureEchoDate", today);
  }

  enableSwipeGestures();

  // Onboarding
  if (localStorage.getItem("echoOnboarded") === "true") {
    document.getElementById("onboarding").style.display = "none";
  }

  setTimeout(() => {
    document.body.classList.add("ready");
  }, 50);
};
