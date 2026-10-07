import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from ollama import chat, ChatResponse 

app = Flask(__name__)
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost5173").split(",")
CORS(app, origins = ALLOWED_ORIGINS)

MODEL = os.getenv("OLLAMA_MODEL", "llama3")

@app.route("/ai", methods=["POST"])
def ai():
    data = request.get_json(silent=True)

    if not data or "messages"not in data:
        return jsonify ({"error": "missing 'message' in request body"}), 400
    
    history = data.get("history", [])
    message = history + [{"role": "user", "content": data["messages"]}]

    try:
        response:ChatResponse = chat(model=Model, messages=messages)
        return jsonify ({"reply": response.message.content})



    except Exception as e:
        print(f"Error:{e}")
        return jsonify ({"error": str(e)}),500

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG") == "1", port=5001)