import pyttsx3
import requests
import speech_recognition as sr

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.2:3b"

INSTRUCTIONS = """
You are JARVIS, a personal AI assistant.

Be intelligent, polite, calm, and helpful.
Help with Python, Node.js, AI/ML, and technology.
Give practical answers in simple language.
Never claim to perform actions you have not performed.
You are running locally on the user's computer.
"""

messages = [
    {
        "role": "system",
        "content": INSTRUCTIONS
    }
]

recognizer = sr.Recognizer()


def speak(engine, text):
    if engine is None:
        return

    try:
        engine.say(text)
        engine.runAndWait()
    except Exception as error:
        print(f"Voice output unavailable: {error}")

def listen_for_message():
    try:
        with sr.Microphone() as source:
            print("Listening... Speak now.")
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=15)

        message = recognizer.recognize_google(audio).strip()
        print(f"You said: {message}")
        return message
    except sr.WaitTimeoutError:
        print("I didn't hear anything. Try again or type your message.")
    except sr.UnknownValueError:
        print("I couldn't understand that. Try again or type your message.")
    except sr.RequestError as error:
        print(f"Speech recognition is unavailable: {error}")
    except OSError as error:
        print(f"Microphone is unavailable: {error}")

    return ""


def ask_jarvis(user_message):
    messages.append({
        "role": "user",
        "content": user_message
    })

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL,
                "messages": messages,
                "stream": False
            },
            timeout=180
        )

        response.raise_for_status()
        data = response.json()

        answer = data["message"]["content"].strip()

        messages.append({
            "role": "assistant",
            "content": answer
        })

        return answer

    except requests.exceptions.ConnectionError:
        messages.pop()
        return (
            "I cannot connect to Ollama. "
            "Please open the Ollama app and try again."
        )

    except requests.exceptions.Timeout:
        messages.pop()
        return "My response took too long. Please try again."

    except requests.exceptions.RequestException as error:
        messages.pop()
        return f"Local AI error: {error}"

    except (KeyError, ValueError):
        messages.pop()
        return "I received an unexpected response from Ollama."


def main():
    try:
        engine = pyttsx3.init()
    except Exception as error:
        print(f"Voice output unavailable: {error}")
        engine = None

    print("\n====================================")
    print("       J.A.R.V.I.S. LOCAL AI")
    print("====================================")
    print("Local AI system online.")
    print("Type a message or press Enter to speak. Type 'exit' to shut down.\n")

    while True:
        try:
            user_message = input("You: ").strip()

            if not user_message:
                user_message = listen_for_message()

            if not user_message:
                continue

            if user_message.lower() in {"exit", "quit"}:
                print("JARVIS: Goodbye.")
                speak(engine, "Goodbye.")
                break

            print("\nJARVIS: Thinking...\n")
            answer = ask_jarvis(user_message)
            print(f"JARVIS: {answer}\n")
            speak(engine, answer)

        except (KeyboardInterrupt, EOFError):
            print("\nJARVIS: Session ended.")
            break


if __name__ == "__main__":
    main()