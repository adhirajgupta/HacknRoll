from flask import Flask, jsonify, request
from sendPrompt import send_prompt_to_backend

app = Flask(__name__)


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

    additional_prompt = "Do not hallucinate. Provide accurate and concise information. If the information is not available, say 'I don't know'. Dont make up answers." \
    "Dont generate random dates. Now search the following question: "

    print(f"Appended prompt: {additional_prompt + text}")

    reply = send_prompt_to_backend(text, frontend_payload=data)
    print(f"Generated reply in app.js: {reply}")
    return jsonify({"status": "ok", "echo": text, "reply": reply})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
