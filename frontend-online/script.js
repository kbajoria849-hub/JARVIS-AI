const API_BASE = "https://jarvis-ai-2-8.onrender.com";

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";
    message.className = "";
    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    const formData = new URLSearchParams();
    formData.set(
        "username",
        document.getElementById("username").value.trim()
    );
    formData.set(
        "password",
        document.getElementById("password").value
    );

    try {
        const response = await fetch(`${API_BASE}/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                response.status === 401
                    ? "Incorrect username or password."
                    : data.detail || "Login failed. Please try again."
            );
        }

        if (!data.access_token) {
            throw new Error("The server did not return an access token.");
        }

        // Keep the token in memory for now; don't save it in localStorage.
        sessionStorage.setItem("jarvisAccessToken", data.access_token);

        message.textContent = "Login successful! JARVIS is connected.";
        message.className = "success";

        // The dashboard will be added in our next step.
        loginButton.textContent = "Opening dashboard...";
        window.location.href = "dashboard.html"
    } catch (error) {
        message.textContent =
            error instanceof TypeError
                ? "Could not connect. Check your internet or API settings."
                : error.message;

        message.className = "error";
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
    }
});