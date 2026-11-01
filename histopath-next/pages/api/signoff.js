const { withRole } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

const fail = (status, message) => Object.assign(new Error(message), { status });

// POST /api/signoff { id } -> calls the sign_off_report() function: one ACID transaction that
// marks the report signed, sets the case to SIGNED and writes the audit log.
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    await withRole(req.user.role, async (c) => {
      const cur = await c.query('SELECT is_signed, pathologist_id FROM Reports WHERE report_id=$1 FOR UPDATE', [id]);
      if (!cur.rows.length) throw fail(404, 'Report not found');
      if (cur.rows[0].is_signed) throw fail(409, 'Report is already signed');
      if (String(cur.rows[0].pathologist_id) !== String(req.user.user_id))
        throw fail(403, 'Only the pathologist who wrote this report can sign it off');
      await c.query('SELECT sign_off_report($1::uuid, $2::uuid)', [id, req.user.user_id]);
    });
    res.status(200).json({ success: true });
  } catch (e) {
    const status = e.status || (e.code === '42501' ? 403 : 500);
    res.status(status).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST']);
