const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
  try {
    const r = await pool.query('SELECT * FROM get_turnaround_time()');
    res.status(200).json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','ADMIN']);
