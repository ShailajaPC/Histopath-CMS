const { pool } = require('../../../lib/db');
const { withAuth } = require('../../../lib/auth');

async function handler(req, res) {
  const { id } = req.query;
  try {
    const [report, ihc, morph, addenda] = await Promise.all([
      pool.query(`SELECT r.report_id, p.full_name AS patient, p.age, p.gender, p.uhid,
        s.organ_site, s.collection_date, s.fixation_type, s.biopsy_type,
        r.diagnosis, r.icd_code, r.category, r.microscopic_findings,
        r.synoptic_data, r.is_signed, r.signed_at, r.pathologist_id,
        u.full_name AS pathologist, c.case_number, c.priority, c.status
        FROM Reports r
        JOIN Cases c ON r.case_id=c.case_id
        JOIN Patients p ON c.patient_id=p.patient_id
        JOIN Specimens s ON c.case_id=s.case_id
        JOIN Users u ON r.pathologist_id=u.user_id
        WHERE r.report_id=$1`, [id]),
      pool.query('SELECT marker_name, result, intensity FROM IHC_Results WHERE report_id=$1', [id]),
      pool.query('SELECT feature_type, feature_value FROM Morphological_Features WHERE report_id=$1', [id]),
      pool.query(`SELECT ra.*, u.full_name AS author_name FROM Report_Addenda ra
        JOIN Users u ON ra.author_id=u.user_id WHERE ra.report_id=$1
        ORDER BY ra.created_at DESC`, [id]),
    ]);
    res.status(200).json({
      report:  report.rows[0],
      ihc:     ihc.rows,
      morph:   morph.rows,
      addenda: addenda.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','TECHNICIAN','ADMIN']);
