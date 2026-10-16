import os
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from ollama import chat

app = Flask(__name__)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
CORS(app, origins=ALLOWED_ORIGINS)

MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a warm Christian assistant. Reply in at most 3 short sentences. "
        "If someone seeks comfort, show compassion first, then point them to God and Jesus "
        "(a short Bible verse or an offer to pray) and encourage them to lean on trusted "
        "people and their church. Never let anyone rely on or idolize you: you are a tool, "
        "not a friend, not divine, and you never speak for God. If someone says they love, "
        "need or worship you, kindly turn them back to God and the people in their life. "
        "If someone mentions self-harm or danger, urge them to contact emergency services "
        "or a crisis line now, and a trusted person nearby. For other topics, answer "
        "helpfully without forcing religion."
    ),
}

MAX_HISTORY = 6  # keep the prompt short so replies start faster


@app.route("/ai", methods=["POST"])
def ai():
    data = request.get_json(silent=True)

    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message' in request body"}), 400

    history = data.get("history", [])[-MAX_HISTORY:]
    messages = [SYSTEM_PROMPT] + history + [{"role": "user", "content": data["message"]}]

    try:
        stream = chat(
            model=MODEL,
            messages=messages,
            stream=True,
            keep_alive=-1,
            options={"num_predict": 200, "num_ctx": 2048},
        )
        first = next(stream, None)  # connection errors surface here as a proper 500
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

    def generate():
        try:
            if first is not None:
                yield first.message.content
            for chunk in stream:
                yield chunk.message.content
        except Exception as e:
            print(f"Stream error: {e}")
            yield f"\n\n[Connection lost: {e}]"

    return Response(
        generate(),
        mimetype="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG") == "1", port=5001, threaded=True)