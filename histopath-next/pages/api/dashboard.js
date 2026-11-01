const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
  try {
    const [reports, patients, organs, amendments, urgent, recent, sla] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM Reports'),
      pool.query('SELECT COUNT(*) AS total FROM Patients'),
      pool.query('SELECT organ_site, COUNT(*) AS cnt FROM Specimens GROUP BY organ_site'),
      pool.query('SELECT COUNT(*) AS total FROM Report_Addenda'),
      pool.query("SELECT COUNT(*) AS total FROM Cases WHERE priority='URGENT' AND status!='SIGNED'"),
      pool.query(`SELECT r.report_id, p.full_name AS patient, s.organ_site,
        r.diagnosis, r.category, r.signed_at, r.is_signed
        FROM Reports r
        JOIN Cases c ON r.case_id=c.case_id
        JOIN Patients p ON c.patient_id=p.patient_id
        JOIN Specimens s ON c.case_id=s.case_id
        ORDER BY r.signed_at DESC NULLS LAST LIMIT 6`),
      pool.query('SELECT * FROM sla_breach_alerts LIMIT 5'),
    ]);
    res.status(200).json({
      total_reports:   reports.rows[0].total,
      total_patients:  patients.rows[0].total,
      organ_counts:    organs.rows,
      amendments:      amendments.rows[0].total,
      urgent:          urgent.rows[0].total,
      recent:          recent.rows,
      sla_breaches:    sla.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','TECHNICIAN','ADMIN']);
