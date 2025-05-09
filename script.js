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
