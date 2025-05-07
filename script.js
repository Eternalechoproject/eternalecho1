const ELEVENLABS_API_KEY = "sk_f1f2e850eb2fea7f8d3b3839513bb2fb5a3f54b5bb112bdc";

// === FIREBASE SETUP ===
const firebaseConfig = {
  apiKey: "AIzaSyC9YzEAOhUz2REALKEY",
  authDomain: "eternalecho.firebaseapp.com",
  projectId: "eternalecho",
  storageBucket: "eternalecho.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:exampleappid"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let firebaseUser = null;

firebase.auth().signInAnonymously().then(userCredential => {
  firebaseUser = userCredential.user;
  mergeCloudMemories();
}).catch(console.error);

// === DOM ELEMENTS ===
const chat = document.getElementById("chat");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("sendBtn");
const replayBtn = document.getElementById("replayBtn");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const memoryLog = document.getElementById("memory-log");
const voiceSelect = document.getElementById("voiceSelect");
const filterButtons = document.querySelectorAll(".filter-btn");
const exportBtn = document.getElementById("exportJson");
const importBtn = document.getElementById("importJson");
const importTrigger = document.getElementById("importTrigger");
const customReply = document.getElementById("customReply");
const customTag = document.getElementById("customTag");
const addCustom = document.getElementById("addCustom");
const searchInput = document.getElementById("searchInput");
const toggleSortBtn = document.getElementById("toggleSort");

let lastEcho = "";
let echoMemory = [];
let overrideVoice = null;
let lastMemoryDate = "";
let idleTimer = null;
let showCloudOnly = false;
let newestFirst = true;

const idleQuotes = [
  "I'm still here if you need me.",
  "Sometimes silence says more.",
  "Take your time. I'm not going anywhere.",
  "You don't have to talk. Just be.",
  "I'm holding the space until you're ready."
];

const memoryModes = {
  "#dad": {
    icon: "👤",
    voice: "EXAVITQu4vr4xnSDxMaL",
    lines: ["I’m proud of you.", "Keep pushing."]
  },
  "#mom": {
    icon: "👩‍🦳",
    voice: "TxGEqnHWrfWFTfGW9XjX",
    lines: ["I love you exactly as you are.", "You’ll always be my baby."]
  },
  "#partner": {
    icon: "❤️",
    voice: "TxGEqnHWrfWFTfGW9XjX",
    lines: ["I miss your face.", "You always feel like home."]
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

window.onload = () => {
  injectDynamicButtons(); // 🔁 & ☁️ Button loader

  const savedLocal = JSON.parse(localStorage.getItem("eternalEchoMemory"));
  if (savedLocal && Array.isArray(savedLocal)) {
    echoMemory = savedLocal;
    echoMemory.forEach(line => renderMemoryItem(line));
  }
  triggerEchoToday();
  checkBackupReminder();
  resetIdleTimer();
};

function injectDynamicButtons() {
  const playContainer = document.getElementById("playAllContainer");
  const cloudContainer = document.getElementById("cloudToggleContainer");

  if (playContainer) {
    const playAllBtn = document.createElement("button");
    playAllBtn.textContent = "Play All Memories";
    playAllBtn.onclick = () => {
      let i = 0;
      function next() {
        if (i >= echoMemory.length) return;
        playVoice(echoMemory[i].line);
        i++;
        setTimeout(next, 3000);
      }
      next();
    };
    playContainer.appendChild(playAllBtn);
  }

  if (cloudContainer) {
    const toggleCloudBtn = document.createElement("button");
    toggleCloudBtn.textContent = "View: Local + Cloud";
    toggleCloudBtn.onclick = () => {
      showCloudOnly = !showCloudOnly;
      toggleCloudBtn.textContent = showCloudOnly ? "View: Cloud Only" : "View: Local + Cloud";
      memoryLog.innerHTML = "";
      if (showCloudOnly) {
        db.collection("users").doc(firebaseUser.uid).collection("memories").orderBy("timestamp", "asc").get().then(snapshot => {
          snapshot.forEach(doc => renderMemoryItem(doc.data()));
        });
      } else {
        echoMemory.forEach(entry => renderMemoryItem(entry));
      }
    };
    cloudContainer.appendChild(toggleCloudBtn);
  }
}

sendBtn.onclick = async () => {
  const msg = input.value.trim();
  if (!msg) return;

  appendMessage("You", msg);
  input.value = "";

  let mode = null;
  let matched = Object.keys(memoryModes).find(key => msg.toLowerCase().includes(key));

  if (matched) {
    mode = matched;
    const group = memoryModes[matched];
    lastEcho = group.lines[Math.floor(Math.random() * group.lines.length)];
    overrideVoice = group.voice;
  } else {
    overrideVoice = null;
    const fallback = [
      "I'm here. I hear you.",
      "You're not alone.",
      "Say more. I'm listening.",
      "I’ve got you. Keep going."
    ];
    lastEcho = fallback[Math.floor(Math.random() * fallback.length)];
  }

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
  });

  const icon = mode ? memoryModes[mode].icon : "🌀";
  const memoryLine = `${icon} ${lastEcho}  —  ${time}`;
  const fullEntry = { date: dateLabel, line: memoryLine };

  echoMemory.push(fullEntry);
  localStorage.setItem("eternalEchoMemory", JSON.stringify(echoMemory));
  saveToFirebase(fullEntry);

  appendMessage("Echo", lastEcho);
  renderMemoryItem(fullEntry);
  playVoice(lastEcho);
  resetIdleTimer();
};
function saveToFirebase(entry) {
  if (!firebaseUser || !entry) return;
  db.collection("users").doc(firebaseUser.uid).collection("memories").add({
    date: entry.date,
    line: entry.line,
    timestamp: new Date()
  }).catch(console.error);
}

function mergeCloudMemories() {
  if (!firebaseUser) return;

  db.collection("users")
    .doc(firebaseUser.uid)
    .collection("memories")
    .orderBy("timestamp", "asc")
    .get()
    .then(snapshot => {
      const existing = new Set(echoMemory.map(e => `${e.date}|${e.line}`));
      const newEntries = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const key = `${data.date}|${data.line}`;
        if (!existing.has(key)) {
          newEntries.push({ date: data.date, line: data.line });
        }
      });

      if (newEntries.length) {
        newEntries.forEach(entry => {
          echoMemory.push(entry);
          renderMemoryItem(entry);
        });
        localStorage.setItem("eternalEchoMemory", JSON.stringify(echoMemory));
        appendMessage("Echo", "Cloud memories restored.");
      }
    })
    .catch(console.error);
}

function renderMemoryItem(entry) {
  if (typeof entry === "string") return;

  const currentDate = entry.date;
  if (currentDate !== lastMemoryDate) {
    lastMemoryDate = currentDate;
    const header = document.createElement("li");
    header.textContent = `🗓️ ${currentDate}`;
    header.style.fontWeight = "bold";
    header.style.marginTop = "20px";
    memoryLog.appendChild(header);
  }

  const item = document.createElement("li");
  item.textContent = entry.line;
  item.setAttribute("title", "Click to edit");

  let tone = "neutral";
  if (entry.line.includes("👤")) tone = "dad";
  else if (entry.line.includes("👩‍🦳")) tone = "mom";
  else if (entry.line.includes("❤️")) tone = "partner";
  else if (entry.line.includes("💪")) tone = "coach";
  else if (entry.line.includes("✌️")) tone = "friend";
  else if (entry.line.includes("🧒")) tone = "child";
  else if (entry.line.includes("🧬")) tone = "future";

  item.setAttribute("data-tone", tone);

  // Tag editor on click
  item.onclick = () => {
    const newMsg = prompt("Edit memory line:", entry.line);
    if (newMsg && newMsg !== entry.line) {
      entry.line = newMsg;
      localStorage.setItem("eternalEchoMemory", JSON.stringify(echoMemory));
      memoryLog.innerHTML = "";
      echoMemory.forEach(renderMemoryItem);
    }
  };

  memoryLog.appendChild(item);
}

replayBtn.onclick = () => {
  if (lastEcho) playVoice(lastEcho);
  resetIdleTimer();
};

downloadBtn.onclick = () => {
  if (echoMemory.length === 0) return;

  let markdown = "# EternalEcho Journal\n\n";
  let currentDay = "";

  echoMemory.forEach(entry => {
    if (entry.date !== currentDay) {
      currentDay = entry.date;
      markdown += `### ${currentDay}\n\n`;
    }
    markdown += `- ${entry.line}\n`;
  });

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "EternalEcho_Journal.md";
  a.click();
  URL.revokeObjectURL(url);
};

clearBtn.onclick = () => {
  echoMemory = [];
  localStorage.removeItem("eternalEchoMemory");
  memoryLog.innerHTML = "";
  appendMessage("Echo", "Memory cleared.");
  resetIdleTimer();
};

exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(echoMemory)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "EternalEcho_Memory.json";
  a.click();
  URL.revokeObjectURL(url);
};

importTrigger.onclick = () => importBtn.click();

importBtn.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data)) {
        echoMemory = data;
        localStorage.setItem("eternalEchoMemory", JSON.stringify(data));
        memoryLog.innerHTML = "";
        data.forEach(entry => renderMemoryItem(entry));
        appendMessage("Echo", "Memory restored.");
      }
    } catch (err) {
      appendMessage("Echo", "Invalid memory file.");
    }
  };
  reader.readAsText(file);
};
function playVoice(text) {
  const selected = overrideVoice || voiceSelect.value;
  fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selected}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  })
    .then(res => res.blob())
    .then(audioBlob => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    })
    .catch(() => appendMessage("Echo", "Voice playback failed."));
}

function appendMessage(sender, text) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender.toLowerCase()}`;
  bubble.textContent = `${sender}: ${text}`;

  if (sender.toLowerCase() === "echo") {
    const reaction = getReactionEmoji(text.toLowerCase());
    if (reaction) {
      bubble.classList.add("reaction");
      bubble.setAttribute("data-reaction", reaction);
    }
  }

  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function getReactionEmoji(text) {
  if (text.includes("proud")) return "🎖️";
  if (text.includes("miss")) return "❤️";
  if (text.includes("love")) return "💞";
  if (text.includes("hurt") || text.includes("tired")) return "😔";
  if (text.includes("you’ve got this") || text.includes("push")) return "💪";
  if (text.includes("home") || text.includes("here")) return "🫂";
  return "";
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const quote = idleQuotes[Math.floor(Math.random() * idleQuotes.length)];
    lastEcho = quote;
    appendMessage("Echo", quote);
    playVoice(quote);
  }, 60000);
}

filterButtons.forEach(btn => {
  btn.onclick = () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tag = btn.getAttribute("data-tag");
    const items = memoryLog.querySelectorAll("li");

    let currentDate = "";
    items.forEach(item => {
      const isHeader = item.textContent.startsWith("🗓️");
      if (isHeader) {
        currentDate = item.textContent;
        item.style.display = "";
        return;
      }

      const type = item.getAttribute("data-tone");
      const show = tag === "" || type === tag;
      item.style.display = show ? "" : "none";
    });
  };
});

searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  const items = memoryLog.querySelectorAll("li");

  items.forEach(item => {
    if (item.textContent.toLowerCase().includes(term)) {
      item.style.display = "";
    } else if (!item.textContent.startsWith("🗓️")) {
      item.style.display = "none";
    }
  });
});

toggleSortBtn.onclick = () => {
  newestFirst = !newestFirst;
  toggleSortBtn.textContent = `Sort: ${newestFirst ? "Newest First" : "Oldest First"}`;
  echoMemory.reverse();
  memoryLog.innerHTML = "";
  echoMemory.forEach(renderMemoryItem);
};
addCustom.onclick = () => {
  const text = customReply.value.trim();
  const tag = customTag.value.trim();
  if (!text || !memoryModes[tag]) return;

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
  });

  const icon = memoryModes[tag].icon || "🌀";
  const voiceId = memoryModes[tag].voice;
  const memoryLine = `${icon} ${text}  —  ${time}`;
  const fullEntry = { date: dateLabel, line: memoryLine };

  overrideVoice = voiceId;
  lastEcho = text;

  echoMemory.push(fullEntry);
  localStorage.setItem("eternalEchoMemory", JSON.stringify(echoMemory));
  saveToFirebase(fullEntry);

  appendMessage("Echo", text);
  renderMemoryItem(fullEntry);
  playVoice(text);

  customReply.value = "";
};

function triggerEchoToday() {
  const today = new Date().toLocaleDateString();
  const seenToday = localStorage.getItem("echoTodayDate");

  if (seenToday === today) return;

  const thoughts = [
    "Whatever you're carrying, you don’t have to carry it alone.",
    "Take a breath. You're already doing better than you think.",
    "Let’s start today quietly. I’m here.",
    "You made it. That counts.",
    "I’ll be here for every moment, just like this one."
  ];

  const line = thoughts[Math.floor(Math.random() * thoughts.length)];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
  });

  const memoryLine = `🌀 ${line}  —  ${time}`;
  const fullEntry = { date: dateLabel, line: memoryLine };

  echoMemory.push(fullEntry);
  localStorage.setItem("eternalEchoMemory", JSON.stringify(echoMemory));
  localStorage.setItem("echoTodayDate", today);
  saveToFirebase(fullEntry);

  appendMessage("Echo", line);
  renderMemoryItem(fullEntry);
  playVoice(line);
}

function checkBackupReminder() {
  const lastBackup = localStorage.getItem("lastEchoBackup");
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (!lastBackup) {
    localStorage.setItem("lastEchoBackup", today);
    return;
  }

  const then = new Date(lastBackup);
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));

  if (diffDays >= 3) {
    const reminder = "Hey — it's been a few days. Don't forget to back up your Echo journal.";
    lastEcho = reminder;
    appendMessage("Echo", reminder);
    playVoice(reminder);
  }
}
