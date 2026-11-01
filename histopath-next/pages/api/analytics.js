const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

async function handler(req, res) {
  try {
    const [total, mal, ben, inf, age, diag, ihc, gender] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM Reports'),
      pool.query("SELECT COUNT(*) AS c FROM Reports WHERE category='Malignant'"),
      pool.query("SELECT COUNT(*) AS c FROM Reports WHERE category='Benign'"),
      pool.query("SELECT COUNT(*) AS c FROM Reports WHERE category='Inflammatory'"),
      pool.query('SELECT ROUND(AVG(age)::NUMERIC,1) AS a FROM Patients'),
      pool.query('SELECT * FROM diagnosis_distribution LIMIT 15'),
      pool.query('SELECT * FROM ihc_positivity_rates ORDER BY organ_site, positivity_rate DESC'),
      pool.query('SELECT * FROM gender_distribution'),
    ]);
    res.status(200).json({
      total_cases:        total.rows[0].c,
      malignant_count:    mal.rows[0].c,
      benign_count:       ben.rows[0].c,
      inflammatory_count: inf.rows[0].c,
      avg_age:            age.rows[0].a,
      diagnoses:          diag.rows,
      ihc_rates:          ihc.rows,
      gender_dist:        gender.rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST','ADMIN']);
