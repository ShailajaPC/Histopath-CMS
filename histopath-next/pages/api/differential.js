const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { organ, marker1, result1, marker2, result2, marker3, result3 } = req.body;
  try {
    const r = await pool.query(
      'SELECT * FROM suggest_differential_diagnosis($1,$2,$3,$4,$5,$6,$7)',
      [organ, marker1, result1, marker2||null, result2||null, marker3||null, result3||null]
    );
    res.status(200).json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','TECHNICIAN','ADMIN']);
