from flask import Flask, jsonify, request
from dotenv import load_dotenv
from sendPrompt import send_prompt_to_backend
from chat.history_chain import build_chain, get_history

app = Flask(__name__)
load_dotenv()
chat_chain = build_chain()


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response


@app.route("/message", methods=["POST", "OPTIONS"])
def handle_message():
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json(silent=True) or {}
    text = data.get("text", "")

    # Log incoming payload
    print(f"Received text: {text}")

    session_id = (
        request.headers.get("x-session-id")
        or request.cookies.get("session_id")
        or "default"
    )

    # Reuse tool-enabled agent while preserving history per session
    history = get_history(session_id)
    result_text = send_prompt_to_backend(
        text,
        frontend_payload=data,
        existing_messages=history.messages,
    )
    history.add_user_message(text)
    history.add_ai_message(result_text)

    print(f"Generated reply: {result_text}")
    return jsonify({"status": "ok", "echo": text, "reply": result_text, "session_id": session_id})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
