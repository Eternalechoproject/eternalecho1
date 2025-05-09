// === CONFIG ===
const OPENAI_API_KEY = "sk_YOUR_OPENAI_KEY_HERE";
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

// === START: GPT SOULPRINT ENGINE ===
async function generateEchoResponse(userInput) {
  const profile = personalityProfiles[activeEcho] || {};
  const echoName = activeEcho.replace("#", "") || "Echo";
  const tone = profile.tone || "Warm and emotionally present.";
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

  const summary = await summarizeMemoryThread();
  const flashback = getMemoryFlashback(3);
  const topTags = getFrequentTags();
  const tagInsight = generateTagReflection(topTags);
  const moodMap = getEmotionTrendMap();
  const dominantMood = getDominantEmotion();
  const moodSummary = `Dominant emotion: ${dominantMood}\nMap: ${JSON.stringify(moodMap)}`;
  const recentRefs = getRecentMemoryRefs();
  const behaviorInsight = await detectBehaviorPattern();

  const prompt = `
You are ${echoName}, a personalized AI trained to emotionally simulate a real person.

Tone: ${tone}
Examples:
${examples || "- (None)"}

Mirror Response Tone: The user sounds ${userEmotion} — respond in a ${mirrorTone} way.
Recent Emotional State: ${summary}
Flashback: ${flashback}
User Behavior Insight: ${behaviorInsight}
Tag Insight: ${tagInsight}
Recent Conversation Memory:
${recentRefs}

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
    const emotion = getEmotion(echo);
    playVoice(echo, emotion);
    saveMemoryToCloud(echo, emotion);
  } catch (err) {
    console.error("GPT soulprint error:", err);
  }
}
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

function saveMemoryToCloud(text, emotion = "neutral") {
  db.collection("memories").add({
    text,
    emotion,
    echo: activeEcho,
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
      <strong>You:</strong> ${entry.user}<br>
      <strong>Echo:</strong> <span class="echo-line ${emotion}">${entry.echo}</span>
    `;
    memoryLog.appendChild(div);
  });
}

function playVoice(text, emotion = "neutral") {
  const voice = overrideVoice || memoryModes[activeEcho]?.voice || voiceSelect.value || ELEVENLABS_VOICE_ID;
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
      memoryModes[activeEcho].voice = data.voice_id;
      overrideVoice = data.voice_id;
      alert(`Voice uploaded and assigned to ${activeEcho}`);
      localStorage.setItem("voiceMap", JSON.stringify(memoryModes));
    } else {
      alert("Voice upload failed.");
    }
  };
  reader.readAsDataURL(file);
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
function filterByEmotion(emotion) {
  const filtered = echoMemory.filter(m => getEmotion(m.echo) === emotion);
  memoryLog.innerHTML = "";
  filtered.forEach(entry => {
    const div = document.createElement("div");
    div.className = "memory-entry";
    div.innerHTML = `<strong>You:</strong> ${entry.user}<br><strong>Echo:</strong> ${entry.echo}<hr/>`;
    memoryLog.appendChild(div);
  });
}

// === GPT MEMORY INTELLIGENCE ===

async function summarizeMemoryThread() {
  const thread = echoMemory.slice(-10).map(entry => `User: ${entry.user}\nEcho: ${entry.echo}`).join("\n\n");
  const prompt = `Summarize the emotional tone and themes of this conversation log in 2-3 sentences:\n${thread}`;

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
  return data.choices?.[0]?.message?.content?.trim() || "Unable to summarize.";
}

function getMemoryFlashback(daysAgo = 3) {
  const now = Date.now();
  const windowStart = now - (daysAgo * 24 * 60 * 60 * 1000);
  const entries = echoMemory.filter(m => {
    const t = new Date(m.timestamp || new Date()).getTime();
    return t < now && t > windowStart;
  });
  if (!entries.length) return "";
  const pick = entries[Math.floor(Math.random() * entries.length)];
  return `On ${new Date(pick.timestamp).toDateString()}, you said: "${pick.user}", and Echo replied: "${pick.echo}"`;
}

function getRecentMemoryRefs(limit = 3, hoursBack = 48) {
  const now = Date.now();
  return echoMemory
    .filter(m => now - new Date(m.timestamp).getTime() < hoursBack * 3600 * 1000)
    .slice(-limit)
    .map(m => `You said: "${m.user}"\nEcho replied: "${m.echo}"`)
    .join("\n\n");
}

function getFrequentTags(limit = 5) {
  const tagCounts = {};
  echoMemory.forEach(entry => {
    if (!entry.tags) return;
    entry.tags.forEach(tag => {
      tag = tag.toLowerCase();
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([tag, count]) => ({ tag, count }));
}

function generateTagReflection(topTags) {
  if (!topTags.length) return "";
  return topTags.map(t => `The theme of “${t.tag}” has come up ${t.count} times.`).join(" ");
}

function getDominantEmotion(recent = 10) {
  const emotions = { love: 0, sad: 0, strong: 0, comfort: 0, happy: 0, angry: 0 };
  echoMemory.slice(-recent).forEach(entry => {
    const emotion = getEmotion(entry.echo);
    if (emotions[emotion] !== undefined) emotions[emotion]++;
  });
  return Object.entries(emotions).sort((a, b) => b[1] - a[1])[0][0];
}

function getEmotionTrendMap(window = 20) {
  const trends = { love: 0, sad: 0, strong: 0, comfort: 0, happy: 0, angry: 0 };
  echoMemory.slice(-window).forEach(entry => {
    const e = getEmotion(entry.echo);
    if (trends[e] !== undefined) trends[e]++;
  });
  return trends;
}

async function detectBehaviorPattern() {
  const history = echoMemory.map(m => `User: ${m.user}\nEcho: ${m.echo}`).join("\n\n");
  const prompt = `
Identify patterns in the user's emotional behavior. Mention repeated moods, times they reach out, or shifting tones.

History:
${history}
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
  return data.choices?.[0]?.message?.content?.trim() || "";
}

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

// === APP INIT ===

window.onload = () => {
  overrideVoice = ELEVENLABS_VOICE_ID;
  const saved = JSON.parse(localStorage.getItem("eternalEchoProfiles"));
  const storedVoices = JSON.parse(localStorage.getItem("voiceMap"));
  if (saved) Object.assign(personalityProfiles, saved);
  if (storedVoices) Object.assign(memoryModes, storedVoices);

  updatePersonalityDisplay();
  updatePresetPicker();
  buildEchoTiles();

  if (localStorage.getItem("echoOnboarded") === "true") {
    document.getElementById("onboarding").style.display = "none";
  }

  setTimeout(() => document.body.classList.add("ready"), 50);
};
