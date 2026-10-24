const API_BASE = "https://jarvis-ai-2-8.onrender.com";

const logoutButton = document.getElementById("logoutButton");
const dashboardMessage = document.getElementById("dashboardMessage");

// The login token is kept in memory on the login page.
// A page navigation loses that memory, so verify the token
// after transferring it through sessionStorage.
async function verifySession() {
    const token = sessionStorage.getItem("jarvisAccessToken");

    if (!token) {
        window.location.replace("index.html");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            sessionStorage.removeItem("jarvisAccessToken");
            window.location.replace("index.html");
            return;
        }

        const data = await response.json();
        dashboardMessage.textContent = `Welcome, ${data.username}.`;
        dashboardMessage.className = "success";
    } catch (error) {
        dashboardMessage.textContent =
            "Unable to verify your session. Check your connection and reload.";
        dashboardMessage.className = "error";
    }
}

logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("jarvisAccessToken");
    window.location.replace("index.html");
});

verifySession();

const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatSendButton = document.getElementById("chatSendButton");
const chatStatus = document.getElementById("chatStatus");

if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = chatInput.value.trim();

        const commandReply = handleBrowserCommand(message);

if (commandReply) {
    const commandMessage = document.createElement("div");
    commandMessage.className = "chat-message assistant-message";
    commandMessage.textContent = commandReply;
    chatMessages.appendChild(commandMessage);
    chatStatus.textContent = commandReply;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(commandReply);
        utterance.lang = "en-IN";
        window.speechSynthesis.speak(utterance);
    }

    return;
}

        const token = sessionStorage.getItem("jarvisAccessToken");

        if (!message) return;

        if (!token) {
            window.location.replace("index.html");
            return;
        }

        const userMessage = document.createElement("p");
        userMessage.className = "chat-bubble user-message";
        userMessage.textContent = message;
        chatMessages.appendChild(userMessage);

        chatInput.value = "";
        chatSendButton.disabled = true;
        chatSendButton.textContent = "Thinking...";
        chatStatus.textContent = "JARVIS is thinking...";

        try {
            const response = await fetch(
                "https://jarvis-ai-2-8.onrender.com/chat",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ message })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail || `Request failed (${response.status})`
                );
            }

            const reply = document.createElement("p");
            reply.className = "chat-bubble jarvis-message";
            reply.textContent = data.reply || "JARVIS returned an empty reply.";
            chatMessages.appendChild(reply);

            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(data.reply);
                utterance.lang = "en-IN";
                utterance.rate = 1;
                utterance.pitch = 1;
                window.speechSynthesis.speak(utterance);
            }

            chatStatus.textContent = "Connected to JARVIS.";
        } catch (error) {
            chatStatus.textContent =
                `Chat error: ${error.message}`;
        } finally {
            chatSendButton.disabled = false;
            chatSendButton.textContent = "Send";
            chatInput.focus();
        }
    });
}

const voiceButton = document.getElementById("voiceButton");
const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

if (voiceButton) {
    if (!SpeechRecognition) {
        voiceButton.disabled = true;
        voiceButton.textContent = "Voice unavailable";
    } else {
        const recognition = new SpeechRecognition();

        recognition.lang = "en-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            voiceButton.textContent = "Listening...";
            chatStatus.textContent = "Listening to your voice...";
        };

        recognition.onresult = (event) => {
            chatInput.value = event.results[0][0].transcript;
            chatForm.requestSubmit();
        };

        recognition.onerror = (event) => {
            chatStatus.textContent =
                "Voice input error: " + event.error;
        };

        recognition.onend = () => {
            voiceButton.textContent = "🎤 Speak";
        };

        voiceButton.addEventListener("click", () => {
            try {
                recognition.start();
            } catch (error) {
                chatStatus.textContent =
                    "Please wait a moment and try again.";
            }
        });
    }
}

function handleBrowserCommand(rawMessage) {
    const message = rawMessage.trim();

    const openCommands = {
        "open youtube": "https://www.youtube.com/",
        "open google": "https://www.google.com/",
        "open github": "https://github.com/",
        "open gmail": "https://mail.google.com/",
        "open spotify": "https://open.spotify.com/"
    };

    const command = message.toLowerCase();

    if (openCommands[command]) {
        window.open(openCommands[command], "_blank", "noopener");
        return "Opened " + command.replace("open ", "") + ".";
    }

    const spotifyMatch = message.match(
    /^(?:play|search spotify for|find on spotify)\s+(.+?)(?:\s+on spotify)?$/i
);

if (spotifyMatch) {
    const song = spotifyMatch[1].trim();
    const query = encodeURIComponent(song);

    window.open(
        "https://open.spotify.com/search/" + query,
        "_blank",
        "noopener"
    );

    return "Searching Spotify for " + song + ".";
}

    const searchMatch = message.match(
        /^(?:search google for|google search for|search for)\s+(.+)$/i
    );

    if (searchMatch) {
        const query = encodeURIComponent(searchMatch[1].trim());
        window.open(
            "https://www.google.com/search?q=" + query,
            "_blank",
            "noopener"
        );
        return "Searching Google for " + searchMatch[1].trim() + ".";
    }

    return null;
}