let jarvisAccessToken = null;
let taskSummaryInterval = null;

async function jarvisLogin(username, password) {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch("/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error("Login failed. Check your credentials.");
    }

    const data = await response.json();
    jarvisAccessToken = data.access_token;
    return true;
}

async function loadChatHistory() {
    const response = await jarvisFetch("/chat/history");

    if (!response.ok) {
        throw new Error(`Failed to load chat history: ${response.status}`);
    }

    const data = await response.json();

    // Clear old messages before restoring history.
    messages.replaceChildren();

    for (const message of data.messages || []) {
        const type = message.role === "user" ? "user" : "jarvis";
        addMessage(message.content, type);
    }
}

async function jarvisFetch(url, options = {}) {
    if (!jarvisAccessToken) {
        throw new Error("Please log in to JARVIS first.");
    }

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${jarvisAccessToken}`);

    return fetch(url, {
        ...options,
        headers
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    const message = document.getElementById("login-message");

    if (!form || !message) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username =
            document.getElementById("login-username").value.trim();
        const password =
            document.getElementById("login-password").value;

        message.textContent = "Logging in...";

        try {
            await jarvisLogin(username, password);
            await loadChatHistory();

            message.textContent = "Login successful!";
            form.reset();
            await Promise.all([
                loadMemoryNotes(),
                loadTasks(),
                checkDueReminders(),
                updateTaskSummary()
            ]);
            if (!taskSummaryInterval) {
                taskSummaryInterval = setInterval(updateTaskSummary, 15000);
            }
        } catch (error) {
            message.textContent = error.message;
        }
    });
});

console.log("JARVIS SCRIPT LOADED");

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const statusText = document.getElementById("status-text");
const sendButton = document.getElementById("send-button");

function addMessage(text, type) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${type}`;
  bubble.textContent = text;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

const automationCommands = {
  "open notepad": "open_notepad",
  "open calculator": "open_calculator",
  "open youtube": "open_youtube",
  "open google": "open_google",
  "open github": "open_github",
  "what time is it": "tell_time",
  "tell me the time": "tell_time",
  "what is today's date": "tell_date",
  "what is the date today": "tell_date",
  "tell me today's date": "tell_date"
};

function getAutomationRequest(message) {
  const command = message
    .toLowerCase()
    .replace(/^jarvis[,:]?\s*/, "")
    .replace(/[.!?,]/g, "")
    .trim();

  if (automationCommands[command]) {
    return { action: automationCommands[command], query: "" };
  }

  const searchMatch = command.match(/^(?:search google for|search for)\s+(.+)$/);
  if (searchMatch) {
    return { action: "google_search", query: searchMatch[1] };
  }

  if (/\b(volume up|increase volume|turn up the volume)\b/i.test(message)) {
    return { action: "volume_up" };
}

if (/\b(volume down|decrease volume|turn down the volume)\b/i.test(message)) {
    return { action: "volume_down" };
}

if (/\b(mute|mute volume|silence the audio)\b/i.test(message)) {
    return { action: "mute_volume" };
}

if (/\b(open|launch|start)\s+(windows\s+)?settings\b/i.test(message)) {
    return { action: "open_settings" };
}

  return null;
}

async function executeAutomation(action, query = "", spokenText = "") {
  if (spokenText) {
    addMessage(spokenText, "user");
  }

  statusText.textContent = "RUNNING ACTION...";

  try {
    console.log("Token exists:", Boolean(jarvisAccessToken));
    console.log("Token type:", typeof jarvisAccessToken);
    const response = await jarvisFetch("/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, query })
    });

    const rawResponse = await response.text();

let data;

try {
    data = JSON.parse(rawResponse);
} catch {
    throw new Error(
        `Backend returned HTTP ${response.status}: ${rawResponse}`
    );
}

if (!response.ok) {
    throw new Error(data.detail || "Automation failed.");
}

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Server error: ${response.status}`);
    }

    addMessage(data.message, "jarvis");
    setJarvisState("speaking");

    const speech = new SpeechSynthesisUtterance(data.message);
    speech.lang = "en-IN";
    speech.onend = () => {
      setJarvisState("");
      statusText.textContent = "SYSTEM READY";
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  } catch (error) {
    console.error("Automation error:", error);
    statusText.textContent = "ACTION FAILED";
    addMessage("I couldn't complete that action.", "jarvis");
  } finally {
    input.value = "";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  console.log("SEND BUTTON HANDLER FIRED");

  const message = input.value.trim();
  if (!message) return;

  const automation = getAutomationRequest(message);
  if (automation) {
    await executeAutomation(automation.action, automation.query||"", message);
    return;
  }

  if (
    /^(please\s+)?(jarvis[\s,]+)?(find|search for|search files for|look for)\b/i.test(message)
  ) {
    await searchFilesByCommand(message);
    return;
  }

  addMessage(message, "user");
  input.value = "";
  input.focus();

  sendButton.disabled = true;
  statusText.textContent = "JARVIS IS THINKING...";

  try {
    setJarvisState("thinking");
    statusText.textContent = "JARVIS IS THINKING...";

    const response = await jarvisFetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    addMessage(data.reply, "jarvis");
    setJarvisState("speaking");

    window.speechSynthesis.cancel();
    
    const speech = new SpeechSynthesisUtterance(data.reply);
    speech.lang = "en-IN";
    speech.rate = 1;
    speech.onend = () => {
        setJarvisState("");
        statusText.textContent = "SYSTEM READY";
    };
    window.speechSynthesis.speak(speech);
    statusText.textContent = "SYSTEM READY";
  } catch (error) {
    console.error("JARVIS error:", error);
    statusText.textContent = "CONNECTION ERROR";
    setJarvisState("");
    addMessage(
      "Unable to reach the JARVIS server. Check that the backend is running.",
      "jarvis"
    );
  } finally {
    sendButton.disabled = false;
  }
});

const micButton = document.getElementById("mic-button");
const stopVoiceButton = document.getElementById("stop-voice-button");

const SpeechRecognitionAPI =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

if (SpeechRecognitionAPI) {
  recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add("listening");
    micButton.textContent = "🎙 LISTENING...";
    statusText.textContent = "LISTENING...";

    setJarvisState("listening");
  };

  function normalizeVoiceFileCommand(command) {
    return command
        .replace(/\bdot\s+(pdf|html|py|js|css|txt|docx?|png|jpe?g)\b/gi, ".$1")
        .replace(/\b(dot)\s+(pdf|html|py|js|css|txt|docx?|png|jpe?g)\b/gi, ".$2")
        .replace(/\s+/g, " ")
        .trim();
}

  recognition.onresult = async (event) => {
    const spokenText = event.results[0][0].transcript.trim();
    console.log("Recognized voice text:", spokenText);
    const command = spokenText.toLowerCase();
    input.value = spokenText;

    if (
        command.startsWith("remember that ") ||
        command.startsWith("save a note ")
    ) {
        const prefix = command.startsWith("remember that ")
            ? "remember that "
            : "save a note ";

        const note = spokenText.slice(prefix.length).trim();

        if (!note) {
            addMessage("Please tell me what to remember.", "assistant");
            return;
        }

        try {
            const response = await jarvisFetch("/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note })
            });

            const data = await response.json();

            if (!response.ok) {throw new Error(data.detail || "Could not save note.");}

            const message = data.message || "Note saved.";
            addMessage(message, "assistant");
            

            if ("speechSynthesis" in window) {
                window.speechSynthesis.speak(
                    new SpeechSynthesisUtterance(message)
                );
            }
        } catch (error) {
            console.error("Save note error:", error);
            addMessage("I couldn't save that note.", "assistant");
        }

        return;
    }

    if (
        command === "show my notes" ||
        command === "list my notes" ||
        command === "what notes have i saved"
    ) {
        try {
            const response = await jarvisFetch("/notes");
            const data = await response.json();

            if (!response.ok) {
                throw new Error("Could not retrieve notes.");
            }

            const message = data.notes && data.notes.length
                ? "Your saved notes: " +
                  data.notes.map((note, index) =>
                      `${index + 1}. ${note.text}`
                  ).join("; ")
                : "You have no saved notes yet.";

            addMessage(message, "assistant");

            if ("speechSynthesis" in window) {
                window.speechSynthesis.speak(
                    new SpeechSynthesisUtterance(message)
                );
            }
        } catch (error) {
            console.error("Read notes error:", error);
            addMessage("I couldn't retrieve your notes.", "assistant");
        }

        return;
    }

        const automation = getAutomationRequest(spokenText);

    if (automation) {
        await executeAutomation(
            automation.action,
            automation.query,
            spokenText
        );
        return;
    }

    if (
    /\b(folder|directory)\b/i.test(spokenText) &&
    /\b(open|show|find)\b/i.test(spokenText)
) {
    const query = spokenText
        .replace(/^(please\s+)?(jarvis[\s,:]*)?/i, "")
        .replace(/\b(open|show|find)\s+(me\s+)?/i, "")
        .replace(/^(the\s+)?(folder|directory)\s+(containing|for|of)\s+/i, "")
        .replace(/^(the\s+)?(folder|directory)\s+/i, "")
        .trim();

    console.log("Folder command query:", query);

    await searchFilesByCommand(`open folder containing ${query}`);
    return;
}

    if (
        /\b(find|search for|search files for|look for)\b/i.test(command)
    ) {
      const normalizedText = normalizeVoiceFileCommand(spokenText);
        await searchFilesByCommand(normalizedText);
        return;
    }

    if (
        /^(please\s+)?(jarvis[\s,]+)?open\s+(the\s+)?(file\s+)?/i.test(command)
    ) {
        const filename = normalizeVoiceFileCommand(spokenText
            .replace(/^(please\s+)?(jarvis[\s,]+)?open\s+(the\s+)?(file\s+)?/i, ""));

            console.log("Opening filename:", filename);

        if (!filename) {
            addMessage("Please say the filename you want to open.", "assistant");
            return;
        }

        addMessage(`Searching for ${filename}...`, "assistant");

        try {
            const response = await fetch("/files/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: filename.replace(/\.(pdf|html|py|js|css|txt|docx?|png|jpe?g)$/i, "").trim(),
                    extension: (filename.match(/\.(pdf|html|py|js|css|txt|docx?|png|jpe?g)$/i) || [""])[0].toLowerCase()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "File search failed.");
            }

            const results = data.results || [];

            if (results.length === 0) {
                addMessage(`I couldn't find ${filename}.`, "assistant");
                return;
            }

            if (results.length > 1) {
                addMessage(
                    `I found ${results.length} matching files. Please use the File Assistant panel to choose the correct one.`,
                    "assistant"
                );
                await searchFilesByCommand(`find ${filename}`);
                return;
            }

            const openResponse = await fetch("/files/open", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: results[0].path })
            });

            const openData = await openResponse.json();

            if (!openResponse.ok) {
                throw new Error(openData.detail || "Could not open file.");
            }

            const message = openData.message || `Opening ${results[0].name}.`;
            addMessage(message, "assistant");

            if ("speechSynthesis" in window) {
                window.speechSynthesis.speak(
                    new SpeechSynthesisUtterance(message)
                );
            }
        } catch (error) {
            console.error("Voice file open error:", error);
            addMessage(`I couldn't open that file: ${error.message}`, "assistant");
        }

        return;
    }

    form.requestSubmit();
  };

  recognition.onerror = (event) => {
    statusText.textContent = `VOICE ERROR: ${event.error}`;
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove("listening");
    micButton.textContent = "🎙 TALK TO JARVIS";

    if (statusText.textContent === "LISTENING...") {
      statusText.textContent = "SYSTEM READY";
    }
    setJarvisState("");
  };

  micButton.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
      return;
    }

    try {
      recognition.start();
    } catch (error) {
      statusText.textContent = "VOICE START FAILED";
    }
  });
} else {
  micButton.addEventListener("click", () => {
    statusText.textContent =
      "Speech recognition is not supported in this browser.";
  });
}

stopVoiceButton.addEventListener("click", () => {
  window.speechSynthesis.cancel();
});

const jarvisOrb = document.querySelector(".orb");

function setJarvisState(state) {
  if (!jarvisOrb) return;

  jarvisOrb.classList.remove(
    "listening",
    "thinking",
    "speaking"
  );

  if (state) {
    jarvisOrb.classList.add(state);
  }
}

async function updateSystemStatus() {
  const backendStatus = document.getElementById("backend-status");
  const ollamaStatus = document.getElementById("ollama-status");

  try {
    const response = await fetch("/health");

    if (!response.ok) {
      throw new Error("Health check failed");
    }

    const data = await response.json();

    backendStatus.textContent = data.backend.toUpperCase();
    ollamaStatus.textContent = data.ollama.toUpperCase();

    backendStatus.classList.toggle("offline", data.backend !== "online");
    ollamaStatus.classList.toggle("offline", data.ollama !== "online");
  } catch (error) {
    backendStatus.textContent = "OFFLINE";
    ollamaStatus.textContent = "UNKNOWN";

    backendStatus.classList.add("offline");
    ollamaStatus.classList.remove("offline");

    console.error("Status check failed:", error);
  }
}

updateSystemStatus();
setInterval(updateSystemStatus, 10000);

async function updateSystemMonitor() {
  try {
    const response = await fetch("/system-stats");

    if (!response.ok) {
      throw new Error("System stats request failed");
    }

    const data = await response.json();

    document.getElementById("cpu-value").textContent =
      `${data.cpu_percent}%`;
    document.getElementById("cpu-bar").style.width =
      `${data.cpu_percent}%`;

    document.getElementById("ram-value").textContent =
      `${data.ram_percent}%`;
    document.getElementById("ram-bar").style.width =
      `${data.ram_percent}%`;

    document.getElementById("ram-details").textContent =
      `${data.ram_used_gb} GB used of ${data.ram_total_gb} GB`;

    const batteryValue =
      document.getElementById("battery-value");
    const batteryDetails =
      document.getElementById("battery-details");

    if (data.battery_percent === null) {
      batteryValue.textContent = "N/A";
      batteryDetails.textContent =
        "Battery information is unavailable.";
    } else {
      batteryValue.textContent =
        `${data.battery_percent}%`;

      batteryDetails.textContent = data.plugged_in
        ? "Connected to power"
        : "Running on battery";
    }

    document.getElementById("monitor-updated").textContent =
      `Last updated: ${new Date().toLocaleTimeString()}`;

  } catch (error) {
    console.error("System monitor error:", error);
    document.getElementById("monitor-updated").textContent =
      "Unable to load system data.";
  }
}

updateSystemMonitor();
setInterval(updateSystemMonitor, 3000);

async function loadMemoryNotes() {
  const list = document.getElementById("memory-list");
  const status = document.getElementById("memory-status");

  if (!jarvisAccessToken) {
    list.textContent = "Log in to view saved notes.";
    return;
  }

  try {
    const response = await jarvisFetch("/notes");
    if (!response.ok) {throw new Error(`Failed to load notes: ${response.status}`);}

    const data = await response.json();
    list.replaceChildren();

    if (!data.notes || data.notes.length === 0) {
      list.textContent = "No saved notes yet.";
      return;
    }

    data.notes.forEach((note) => {
      const row = document.createElement("div");
      row.className = "memory-note";

      const text = document.createElement("span");
      text.textContent = note.text;

      const remove = document.createElement("button");
      remove.className = "memory-delete";
      remove.textContent = "DELETE";
      remove.type = "button";

      remove.addEventListener("click", async () => {
        if (!confirm("Delete this saved note?")) return;

        try {
          const result = await jarvisFetch(`/notes/${note.id}`, {
            method: "DELETE"
          });

          const answer = await result.json();

          if (!result.ok || !answer.success) {
            throw new Error(answer.message || "Delete failed");
          }

          status.textContent = "Note deleted.";
          await loadMemoryNotes();
        } catch (error) {
          status.textContent = "Could not delete the note.";
          console.error(error);
        }
      });

      row.append(text, remove);
      list.appendChild(row);
    });
  } catch (error) {
    list.textContent = "Unable to load notes. Check the backend.";
    console.error("Memory dashboard error:", error);
  }
}

const memoryForm = document.getElementById("memory-form");

if (memoryForm) {
  memoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = document.getElementById("memory-input");
    const status = document.getElementById("memory-status");
    const note = input.value.trim();

    if (!note) return;

    try {
      const response = await jarvisFetch("/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Could not save note");
      }

      input.value = "";
      status.textContent = "Note saved successfully.";
      await loadMemoryNotes();
    } catch (error) {
      status.textContent = "Could not save the note.";
      console.error("Save memory error:", error);
    }
  });

}

async function loadTasks() {
  const list = document.getElementById("task-list");
  const status = document.getElementById("task-status");

  if (!jarvisAccessToken) {
    list.textContent = "Log in to view your tasks.";
    return;
  }

  try {
    const response = await jarvisFetch("/tasks");
    if (!response.ok) {throw new Error(`Failed to load tasks: ${response.status}`);}

    const data = await response.json();
    list.replaceChildren();

    if (!data.tasks || data.tasks.length === 0) {
      list.textContent = "No tasks yet. Add your first task above.";
      return;
    }

    data.tasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = "task-row" +
        (task.completed ? " completed" : "");

      const title = document.createElement("span");
      title.textContent = task.title;

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "task-action";
      toggle.textContent = task.completed ? "UNDO" : "DONE";

      toggle.addEventListener("click", async () => {
        await changeTask(`/tasks/${task.id}`, "PATCH");
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "task-action";
      remove.textContent = "DELETE";

      remove.addEventListener("click", async () => {
        if (!confirm("Delete this task?")) return;
        await changeTask(`/tasks/${task.id}`, "DELETE");
      });

      actions.append(toggle, remove);
      row.append(title, actions);
      list.appendChild(row);
    });
  } catch (error) {
    list.textContent = "Unable to load tasks. Check the backend.";
    console.error("Task loading error:", error);
  }
}

async function changeTask(url, method) {
  const status = document.getElementById("task-status");

  try {
    const response = await jarvisFetch(url, { method });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Task update failed");
    }

    status.textContent = data.message;
    await loadTasks();
  } catch (error) {
    status.textContent = "Unable to update the task.";
    console.error("Task update error:", error);
  }
}

const taskForm = document.getElementById("task-form");

if (taskForm) {
  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = document.getElementById("task-input");
    const status = document.getElementById("task-status");
    const title = input.value.trim();
    const dueAt = document.getElementById("task-due").value;

    if (!title) return;

    try {
      const response = await jarvisFetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, due_at: dueAt || null })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not add task");
      }

      input.value = "";
      status.textContent = data.message;
      await loadTasks();
    } catch (error) {
      status.textContent = "Unable to save the task.";
      console.error("Task saving error:", error);
    }
  });
}

const enableReminderButton =
  document.getElementById("enable-reminders");

const reminderStatus =
  document.getElementById("reminder-status");

const notifiedReminderIds = new Set();

if (enableReminderButton && reminderStatus) {
  enableReminderButton.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      reminderStatus.textContent =
        "Browser notifications are not supported here.";
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      reminderStatus.textContent =
        "Reminder notifications enabled.";
      checkDueReminders();
    } else {
      reminderStatus.textContent =
        "Notifications were not enabled. Keep the dashboard open to check reminders.";
    }
  });
}

async function checkDueReminders() {
  if (!jarvisAccessToken) return;

  try {
    const response = await jarvisFetch("/reminders/due");

    if (!response.ok) {
      throw new Error("Reminder request failed");
    }

    const data = await response.json();

    for (const task of data.reminders || []) {
      if (notifiedReminderIds.has(task.id)) continue;

      // Mark first so overlapping checks don't repeat the alert.
      notifiedReminderIds.add(task.id);

      const message = `Reminder: ${task.title}`;

      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("JARVIS Reminder", {
          body: message
        });
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance(message)
        );
      }

      const status = document.getElementById("reminder-status");

      if (status) {
        status.textContent = message;
      }
    }
  } catch (error) {
    console.error("Reminder checker error:", error);
  }
}

checkDueReminders();
setInterval(checkDueReminders, 15000);

async function updateTaskSummary() {

    console.log("UPDATE TASK SUMMARY STARTED");
  if (!jarvisAccessToken) return;

  try {
    const response = await jarvisFetch("/tasks");

    if (!response.ok) {
      throw new Error(`Tasks API returned ${response.status}`);
    }

    const result = await response.json();

    // Support either a direct array or an object containing tasks.
    const tasks = Array.isArray(result)
      ? result
      : Array.isArray(result.tasks)
        ? result.tasks
        : [];

    console.log("Tasks received:", tasks);

    const now = new Date();

    let pending = 0;
    let overdue = 0;
    let completed = 0;

    for (const task of tasks) {
      if (task.completed === true) {
        completed++;
        continue;
      }

      pending++;

      if (task.due_at) {
        const dueDate = new Date(task.due_at);

        if (
          !Number.isNaN(dueDate.getTime()) &&
          dueDate.getTime() <= now.getTime()
        ) {
          overdue++;
        }
      }
    }

    const pendingElement =
      document.getElementById("pending-count");
    const overdueElement =
      document.getElementById("overdue-count");
    const completedElement =
      document.getElementById("completed-count");

    if (pendingElement) pendingElement.textContent = pending;
    if (overdueElement) overdueElement.textContent = overdue;
    if (completedElement) completedElement.textContent = completed;

    console.log("Summary:", { pending, overdue, completed });

    } catch (error) {
    console.error("Task summary error:", error);
  }

}

const studyModeBtn = document.getElementById("studyModeBtn");

if (studyModeBtn) {
    studyModeBtn.addEventListener("click", async () => {
        studyModeBtn.disabled = true;
        studyModeBtn.textContent = "Starting Study Mode...";

        try {
            for (const action of ["open_notepad", "open_calculator"]) {
                const response = await jarvisFetch("/automation", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        action: action,
                        query: ""
                    })
                });

                const responseText = await response.text();
                let result;

                try {
                    result = responseText ? JSON.parse(responseText) : {};
                } catch {
                    throw new Error(
                        `${action} failed (${response.status}): ` +
                        `${responseText || response.statusText}`
                    );
                }

                if (!result || typeof result !== "object") {
                    throw new Error(
                        `${action} returned an invalid response (${response.status})`
                    );
                }

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.message ||
                        result.detail ||
                        `${action} failed (${response.status})`
                    );
                }
            }

            const message = "Study Mode activated. Your study tools are ready.";

            if ("speechSynthesis" in window) {
                speechSynthesis.cancel();
                speechSynthesis.speak(
                    new SpeechSynthesisUtterance(message)
                );
            }

            studyModeBtn.textContent = "Study Mode Active";

        } catch (error) {
            console.error("Study Mode error:", error);
            studyModeBtn.textContent = "Study Mode Failed";
            studyModeBtn.title = error.message;
        } finally {
            studyModeBtn.disabled = false;

            setTimeout(() => {
                studyModeBtn.textContent = "Start Study Mode";
                studyModeBtn.title = "";
            }, 2500);
        }
    });
}

const searchFilesBtn = document.getElementById("searchFilesBtn");

if (searchFilesBtn) {
    searchFilesBtn.addEventListener("click", async () => {
    const query = document.getElementById("fileQuery").value.trim();
    const extension = document.getElementById("fileExtension").value.trim();
    const status = document.getElementById("fileSearchStatus");
    const resultsBox = document.getElementById("fileResults");

    console.log("SEARCH BUTTON HANDLER FIRED");
    console.log("Sending query:", query);
    console.log("Sending extension:", extension);

    status.textContent = "Searching approved folders...";
    resultsBox.replaceChildren();
    searchFilesBtn.disabled = true;

    try {
        const response = await fetch("/files/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, extension })
        });

        console.log("Search response status:", response.status);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "File search failed.");
        }

        const results = data.results || [];
        console.log("Files found:", results.length);

        if (results.length === 0) {
            status.textContent = "No matching files found.";
            return;
        }

        status.textContent = `Found ${results.length} file(s).`;

        results.forEach((file) => {
            const item = document.createElement("div");
            item.className = "file-result";

            const info = document.createElement("div");
            info.className = "file-result-info";

            const name = document.createElement("strong");
            name.textContent = file.name;

            const path = document.createElement("div");
            path.className = "file-result-path";
            path.textContent = file.path;

            info.append(name, path);
            
            const actions = document.createElement("div");
            actions.className = "file-result-actions";

            const openButton = document.createElement("button");
            openButton.textContent = "Open File";
            openButton.type = "button";

            openButton.addEventListener("click", async () => {
        try {
            const response = await fetch("/files/open", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ path: file.path })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Could not open file.");
            }

            status.textContent = data.message || "Opening file...";
        } catch (error) {
            console.error("Open file failed:", error);
            status.textContent = `Could not open file: ${error.message}`;
        }
    });

    actions.appendChild(openButton);
    item.append(info, actions);
    resultsBox.appendChild(item);
    });
    } catch (error) {
        console.error("File search failed:", error);
        status.textContent = `Search failed: ${error.message}`;
    } finally {
        searchFilesBtn.disabled = false;
    }
    });
}

async function openSelectedFile(endpoint, path) {
    const status = document.getElementById("fileSearchStatus");

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Could not open the item.");
        }

        status.textContent = data.message;
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
    }
}

async function openFolderByPath(path) {
    try {
        const result = await openSelectedFile(
            "/files/open-folder",
            path
        );

        const message = result.message || "Folder opened successfully.";
        addMessage(message, "assistant");

    } catch (error) {
        console.error("Open folder error:", error);
        addMessage(
            `Could not open folder: ${error.message}`,
            "assistant"
        );
    }
}

async function searchFilesByCommand(command) {
    const text = normalizeVoiceFileCommand(command)
        .toLowerCase()
        .replace(/^(?:please\s+)?(?:jarvis[\s,:]*)?/, "")
        .trim();

    const folderMatch = text.match(
        /^(?:open|show|find)\s+(?:me\s+)?(?:the\s+)?folder\s+(?:containing|for|of)\s+(.+)$/
    );

    const shouldOpenFolder = Boolean(folderMatch);

    const openMatch = text.match(
        /^open\s+(?:the\s+)?file(?:\s+named)?\s+(.+)$/
    );

    const shouldOpen = Boolean(openMatch);

    const queryText = (
        folderMatch?.[1] ||
        openMatch?.[1] ||
        text
    )
        .replace(
            /^(?:find|search files for|search for|look for)\s+/,
            ""
        )
        .trim();

    const extensionNames = {
        "pdf": ".pdf",
        "pdf files": ".pdf",
        "pdf documents": ".pdf",
        "python": ".py",
        "python files": ".py",
        "html": ".html",
        "html files": ".html",
        "javascript": ".js",
        "javascript files": ".js",
        "css": ".css",
        "css files": ".css",
        "images": ".png"
    };

    let query = queryText;
    let extension = extensionNames[queryText] || "";

    if (!extension) {
        const match = queryText.match(
            /\.(pdf|html|py|js|css|txt|docx?|png|jpe?g)$/i
        );

        if (match) {
            extension = `.${match[1].toLowerCase()}`;
            query = queryText.slice(0, match.index).trim();
        }
    } else {
        query = "";
    }

    const status = document.getElementById("fileSearchStatus");
    const queryInput = document.getElementById("fileQuery");
    const extensionInput = document.getElementById("fileExtension");
    const searchButton = document.getElementById("searchFilesBtn");

    if (!status || !queryInput || !extensionInput || !searchButton) {
        console.error("File Assistant elements are missing.");
        addMessage(
            "The File Assistant panel is missing. Please check index.html.",
            "assistant"
        );
        return;
    }

    if (!query && !extension) {
        status.textContent = "Please specify a filename or file type.";
        return;
    }

    queryInput.value = query;
    extensionInput.value = extension;

    status.textContent = shouldOpenFolder
        ? "Finding the folder containing your file..."
        : shouldOpen
            ? "Searching for a file to open..."
            : "Searching files...";

    try {
        const response = await fetch("/files/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, extension })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "File search failed.");
        }

        const results = data.results || [];

        if (results.length === 0) {
            status.textContent = "No matching file found.";
            return;
        }

        if (shouldOpenFolder) {
            if (results.length === 1) {
                await openFolderByPath(results[0].path);
                status.textContent = "Opened the containing folder.";
            } else {
                status.textContent =
                    `Found ${results.length} matches. Refine the filename.`;
                searchButton.click();
            }
            return;
        }

        if (shouldOpen) {
            if (results.length === 1) {
                await openSelectedFile("/files/open", results[0].path);
            } else {
                status.textContent =
                    `Found ${results.length} matches. Refine the filename.`;
                searchButton.click();
            }
            return;
        }

        searchButton.click();

    } catch (error) {
        console.error("File Assistant error:", error);
        status.textContent = `Error: ${error.message}`;
    }
}

document.getElementById("logout-button")?.addEventListener("click", () => {
    jarvisAccessToken = null;
    location.reload();
});