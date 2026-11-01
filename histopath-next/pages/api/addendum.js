const { withRole } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

// POST /api/addendum { id, new_diagnosis, note }
// Calls the stored PROCEDURE add_report_addendum() - the only way to change a signed report's record.
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id, new_diagnosis, note } = req.body || {};
  if (!id || !new_diagnosis || !note)
    return res.status(400).json({ error: 'id, new_diagnosis and note are required' });
  try {
    await withRole(req.user.role, (c) =>
      c.query('CALL add_report_addendum($1::uuid, $2::uuid, $3, $4)', [id, req.user.user_id, new_diagnosis, note]));
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(e.code === 'P0001' ? 409 : e.code === '42501' ? 403 : 500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST']);
