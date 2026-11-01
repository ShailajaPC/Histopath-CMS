const { withRole } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');
const { getEmbedding, toVector } = require('../../lib/embed');

const fail = (status, message) => Object.assign(new Error(message), { status });

// GET  /api/vector?id=...            READ   : embedding status + 5 nearest cases (pgvector <=>)
// POST /api/vector {id, action}      UPDATE : action 'regenerate'  (re-embed from the stored text)
//                                    DELETE : action 'delete'      (remove the embedding only)
async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const out = await withRole(req.user.role, async (c) => {
        const info = await c.query(
          'SELECT (embedding IS NOT NULL) AS has_embedding, vector_dims(embedding) AS dims, embedding::text AS emb FROM Reports WHERE report_id=$1::uuid', [id]);
        if (!info.rows.length) throw fail(404, 'Report not found');
        const row = info.rows[0];
        let preview = [], neighbors = [];
        if (row.has_embedding) {
          preview = row.emb.slice(1, -1).split(',').slice(0, 6).map(Number);
          const n = await c.query(
            `SELECT r2.report_id, p.full_name AS patient_name, s.organ_site, r2.diagnosis, r2.category,
                    1 - (r2.embedding <=> (SELECT embedding FROM Reports WHERE report_id=$1::uuid)) AS similarity_score
             FROM Reports r2
             JOIN Cases c2 ON r2.case_id=c2.case_id
             JOIN Patients p ON c2.patient_id=p.patient_id
             JOIN Specimens s ON c2.case_id=s.case_id
             WHERE r2.embedding IS NOT NULL AND r2.report_id <> $1::uuid
             ORDER BY r2.embedding <=> (SELECT embedding FROM Reports WHERE report_id=$1::uuid)
             LIMIT 5`, [id]);
          neighbors = n.rows;
        }
        return { has_embedding: row.has_embedding, dims: row.dims, preview, neighbors };
      });
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      if (req.user.role !== 'PATHOLOGIST')
        return res.status(403).json({ error: 'Only pathologists can change embeddings' });
      const { id, action } = req.body || {};
      if (!id || !['regenerate', 'delete'].includes(action))
        return res.status(400).json({ error: "id and action ('regenerate' | 'delete') are required" });

      let vec = null;
      if (action === 'regenerate') {
        const src = await withRole(req.user.role, (c) =>
          c.query('SELECT microscopic_findings, diagnosis FROM Reports WHERE report_id=$1::uuid', [id]));
        if (!src.rows.length) throw fail(404, 'Report not found');
        vec = toVector(await getEmbedding(`${src.rows[0].microscopic_findings} Diagnosis: ${src.rows[0].diagnosis}`));
      }
      await withRole(req.user.role, async (c) => {
        const r = await c.query('UPDATE Reports SET embedding = $2::vector WHERE report_id=$1::uuid', [id, vec]);
        if (r.rowCount === 0) throw fail(404, 'Report not found');
      });
      return res.status(200).json({ success: true, action });
    }

    return res.status(405).end();
  } catch (e) {
    const status = e.status || (e.code === '42501' ? 403 : e.code === 'P0001' ? 409 : 500);
    res.status(status).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST', 'TECHNICIAN', 'ADMIN']);
