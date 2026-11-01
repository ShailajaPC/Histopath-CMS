const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
  try {
    const [logs, case_logs] = await Promise.all([
      pool.query(`SELECT ra.addendum_id, ra.report_id, p.full_name AS patient,
        u.full_name AS amended_by, ra.created_at,
        ra.old_diagnosis, ra.new_diagnosis, ra.revision_note
        FROM Report_Addenda ra
        JOIN Reports r ON ra.report_id=r.report_id
        JOIN Cases c ON r.case_id=c.case_id
        JOIN Patients p ON c.patient_id=p.patient_id
        JOIN Users u ON ra.author_id=u.user_id
        ORDER BY ra.created_at DESC`),
      pool.query(`SELECT cal.*, u.full_name AS performed_by_name
        FROM Case_Audit_Logs cal
        JOIN Users u ON cal.performed_by=u.user_id
        ORDER BY cal.timestamp DESC LIMIT 20`),
    ]);
    res.status(200).json({ logs: logs.rows, case_logs: case_logs.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','ADMIN']);
