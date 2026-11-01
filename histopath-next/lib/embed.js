// Calls scripts/embed_server.py (same all-MiniLM-L6-v2 model that created the stored vectors)
async function getEmbedding(text) {
  let r;
  try {
    r = await fetch('http://localhost:5001/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (_) {
    throw Object.assign(new Error('Embedding service is not running. Start it with: python scripts/embed_server.py'), { status: 503 });
  }
  if (!r.ok) throw Object.assign(new Error('Embedding service error'), { status: 503 });
  return (await r.json()).embedding;
}
const toVector = (arr) => '[' + arr.join(',') + ']';
module.exports = { getEmbedding, toVector };
