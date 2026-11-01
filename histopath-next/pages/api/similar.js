const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

async function getEmbedding(text) {
  const r = await fetch('http://localhost:5001/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error('embedding service error');
  return (await r.json()).embedding;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { mode, organ, category, marker, result, query_text } = req.body;
  try {
    if (mode === 'semantic') {
      const text = (query_text || '').trim();
      if (!text) return res.status(200).json([]);

      try {
        const vec = '[' + (await getEmbedding(text)).join(',') + ']';
        const r = await pool.query(`
          SELECT r.report_id, p.full_name AS patient_name, p.age,
                 s.organ_site, r.diagnosis, r.category, r.signed_at,
                 1 - (r.embedding <=> $1::vector) AS similarity_score
          FROM Reports r
          JOIN Cases c ON r.case_id=c.case_id
          JOIN Patients p ON c.patient_id=p.patient_id
          JOIN Specimens s ON c.case_id=s.case_id
          WHERE r.embedding IS NOT NULL
          ORDER BY r.embedding <=> $1::vector
          LIMIT 10`, [vec]);
        return res.status(200).json(r.rows);
      } catch (embedErr) {
        // Embedding service not running: keyword fallback, clearly marked (score = null)
        const words = text.split(/\s+/).filter(Boolean);
        const cond = words.map((_, i) =>
          `(r.diagnosis ILIKE $${i+1} OR r.microscopic_findings ILIKE $${i+1} OR s.organ_site ILIKE $${i+1})`
        ).join(' OR ');
        const r = await pool.query(`
          SELECT r.report_id, p.full_name AS patient_name, p.age,
                 s.organ_site, r.diagnosis, r.category, r.signed_at,
                 NULL AS similarity_score
          FROM Reports r
          JOIN Cases c ON r.case_id=c.case_id
          JOIN Patients p ON c.patient_id=p.patient_id
          JOIN Specimens s ON c.case_id=s.case_id
          WHERE ${cond}
          ORDER BY r.signed_at DESC NULLS LAST LIMIT 10`,
          words.map(w => `%${w}%`));
        return res.status(200).json(r.rows);
      }
    }

    const r = await pool.query(`
      SELECT DISTINCT r.report_id, p.full_name AS patient_name, p.age,
        s.organ_site, r.diagnosis, r.category, r.signed_at,
        ihc.marker_name, ihc.result AS ihc_result
      FROM Reports r
      JOIN Cases c ON r.case_id=c.case_id
      JOIN Patients p ON c.patient_id=p.patient_id
      JOIN Specimens s ON c.case_id=s.case_id
      JOIN IHC_Results ihc ON r.report_id=ihc.report_id
      WHERE s.organ_site=$1 AND r.category=$2
        AND ihc.marker_name=$3 AND ihc.result=$4
      ORDER BY r.signed_at DESC NULLS LAST`, [organ, category, marker, result]);
    return res.status(200).json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','TECHNICIAN','ADMIN']);
