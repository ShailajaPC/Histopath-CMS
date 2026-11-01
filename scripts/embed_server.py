# Run with: python scripts/embed_server.py   (keep it running next to npm run dev)
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
model = SentenceTransformer('all-MiniLM-L6-v2')

@app.route('/embed', methods=['POST'])
def embed():
    text = (request.get_json() or {}).get('text', '')
    return jsonify({'embedding': model.encode(text).tolist()})

if __name__ == '__main__':
    app.run(port=5001)
