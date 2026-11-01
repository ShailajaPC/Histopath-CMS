const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

// Active pathologists (used by the Admin when registering a case)
async function handler(req, res) {
  try {
    const r = await pool.query(
      "SELECT user_id, full_name FROM Users WHERE role='PATHOLOGIST' AND is_active ORDER BY full_name");
    res.status(200).json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
export default withAuth(handler, ['ADMIN']);
