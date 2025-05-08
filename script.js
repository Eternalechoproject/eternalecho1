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

let lastEcho = "";
let echoMemory = [];
let overrideVoice = null;

const personalityProfiles = {
  "#dad": {
    tone: "Encouraging, short, firm. Doesn’t say 'I love you' much, but always shows up.",
    examples: ["You know what to do.", "I'm proud of how far you’ve come.", "Keep your chin up. One more round."]
  },
  "#mom": {
    tone: "Warm, comforting, overprotective.",
    examples: ["You don’t have to carry everything alone.", "You’ll always be my baby.", "I love you exactly as you are."]
  },
  "#partner": {
    tone: "Soft, emotional, reassuring.",
    examples: ["I miss your face.", "I know how hard that was. I'm here.", "You always feel like home."]
  }
};

const memoryModes = {
  "#dad": {
    icon: "👤",
    voice: "iiidtqDt9FBdT1vfBluA",
    lines: personalityProfiles["#dad"].examples
  },
  "#mom": {
    icon: "👩‍🦳",
    voice: "gPe4h2IS1C7XHbnizzFa",
    lines: personalityProfiles["#mom"].examples
  },
  "#partner": {
    icon: "❤️",
    voice: "WtA85syCrJwasGeHGH2p",
    lines: personalityProfiles["#partner"].examples
  },
  "#coach": {
    icon: "💪",
    voice: "MF3mGyEYCl7XYWbV9V6O",
    lines: ["No excuses.", "You’ve got this."]
  },
  "#friend": {
    icon: "✌️",
    voice: "ErXwobaYiN019PkySvjV",
    lines: ["You good?", "I got you."]
  },
  "#child": {
    icon: "🧒",
    voice: "EXAVITQu4vr4xnSDxMaL",
    lines: ["Did you miss me?", "Wanna play again soon?"]
  },
  "#future": {
    icon: "🧬",
    voice: "TxGEqnHWrfWFTfGW9XjX",
    lines: ["Keep going. I’m counting on you.", "I’m already proud of who you become."]
  }
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
    response = personalityProfiles[matched]?.examples[Math.floor(Math.random() * personalityProfiles[matched].examples.length)] || "I'm here. I hear you.";
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
    div.innerHTML = `
      <span style="opacity:0.6;">You:</span> ${entry.user}<br>
      <span style="opacity:0.9;">Echo:</span> <span class="echo-line">${entry.echo}</span>
    `;
    memoryLog.appendChild(div);
  });
}

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

window.onload = () => {
  const introLine = "Hi. I’m still here.";
  overrideVoice = ELEVENLABS_VOICE_ID;
  playVoice(introLine);

  const savedProfiles = JSON.parse(localStorage.getItem("eternalEchoProfiles"));
  if (savedProfiles) {
    Object.assign(personalityProfiles, savedProfiles);
  }
  updatePersonalityDisplay();
};
