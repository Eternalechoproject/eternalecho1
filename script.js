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

// === ELEMENTS ===
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("sendBtn");
const replayBtn = document.getElementById("replayBtn");
const memoryLog = document.getElementById("memory-log");
const voiceSelect = document.getElementById("voiceSelect");
const playAllBtn = document.getElementById("playAllBtn");

// === STATE ===
let lastEcho = "";
let echoMemory = [];
let overrideVoice = null;
let activeEcho = "#dad";

// === SAVE TO FIRESTORE ===
function saveMemoryToCloud(text, emotion = "neutral") {
  db.collection("memories").add({
    text,
    emotion,
    echo: activeEcho,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Firestore save error:", err));
}

// === VOICE UPLOAD ===
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
        name: "UploadedEcho",
        files: [base64Audio]
      })
    });

    const data = await res.json();
    if (data.voice_id) {
      overrideVoice = data.voice_id;
      alert("Voice cloned successfully.");
    } else {
      alert("Voice upload failed.");
    }
  };
  reader.readAsDataURL(file);
}

// === GPT PERSONALITY OVERRIDE ===
async function generateEchoResponse(userInput) {
  const style = "Warm, supportive, grounded. Sounds like someone you miss.";
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
    overrideVoice = voiceSelect.value || ELEVENLABS_VOICE_ID;

    echoMemory.push({ user: userInput, echo });
    lastEcho = echo;
    renderMemoryLog();
    playVoice(echo);
    saveMemoryToCloud(echo, getEmotion(echo));
  } catch (err) {
    console.error("GPT failed:", err);
  }
}

// === PLAY VOICE ===
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

// === LOGIC ===
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
    playVoice(echoMemory[i].echo);
    i++;
    setTimeout(playNext, 3500);
  }
  playNext();
};

function renderMemoryLog() {
  memoryLog.innerHTML = "";
  echoMemory.forEach(entry => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>You:</strong> ${entry.user}<br><strong>Echo:</strong> ${entry.echo}<hr/>`;
    memoryLog.appendChild(div);
  });
}

function getEmotion(text) {
  if (/love|miss|baby/i.test(text)) return "love";
  if (/proud|push|got this/i.test(text)) return "strong";
  if (/alone|tired|carry|sad/i.test(text)) return "sad";
  if (/here|home|with you/i.test(text)) return "comfort";
  return "neutral";
}
