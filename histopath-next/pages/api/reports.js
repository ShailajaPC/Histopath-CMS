const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
  try {
    const { organ, category, search } = req.query;
    let query = `SELECT r.report_id, p.full_name AS patient, p.age, p.gender,
      s.organ_site, r.diagnosis, r.category, r.icd_code,
      u.full_name AS pathologist, r.signed_at, r.is_signed,
      c.case_number, c.priority
      FROM Reports r
      JOIN Cases c ON r.case_id=c.case_id
      JOIN Patients p ON c.patient_id=p.patient_id
      JOIN Specimens s ON c.case_id=s.case_id
      JOIN Users u ON r.pathologist_id=u.user_id
      WHERE 1=1`;
    const params = [];
    if (organ)    { params.push(organ);    query += ` AND s.organ_site=$${params.length}`; }
    if (category) { params.push(category); query += ` AND r.category=$${params.length}`; }
    if (search)   {
      params.push(`%${search}%`); params.push(`%${search}%`);
      query += ` AND (p.full_name ILIKE $${params.length-1} OR r.diagnosis ILIKE $${params.length})`;
    }
    query += ' ORDER BY r.signed_at DESC NULLS LAST';
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','TECHNICIAN','ADMIN']);
