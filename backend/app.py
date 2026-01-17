from flask import Flask, jsonify, request

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

    return jsonify({"status": "ok", "echo": text})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
