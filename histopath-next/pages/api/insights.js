const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');

// Read-only showcase of advanced SQL: correlated sub-query, nested sub-query, window function + CTE.
const QUERIES = {
  correlated: {
    title: 'Correlated sub-query - patients older than the average age of their own organ site',
    sql: `SELECT p.full_name, p.age, s.organ_site,
       (SELECT ROUND(AVG(p2.age),1) FROM Patients p2
          JOIN Cases c2 ON c2.patient_id = p2.patient_id
          JOIN Specimens s2 ON s2.case_id = c2.case_id
         WHERE s2.organ_site = s.organ_site) AS site_avg_age
FROM Patients p
JOIN Cases c ON c.patient_id = p.patient_id
JOIN Specimens s ON s.case_id = c.case_id
WHERE p.age > (SELECT AVG(p2.age) FROM Patients p2
                 JOIN Cases c2 ON c2.patient_id = p2.patient_id
                 JOIN Specimens s2 ON s2.case_id = c2.case_id
                WHERE s2.organ_site = s.organ_site)
ORDER BY s.organ_site, p.age DESC LIMIT 15`,
  },
  nested: {
    title: 'Nested sub-query - diagnoses more frequent than the average diagnosis',
    sql: `SELECT diagnosis, COUNT(*) AS cases
FROM Reports GROUP BY diagnosis
HAVING COUNT(*) > (SELECT AVG(cnt) FROM (SELECT COUNT(*) AS cnt FROM Reports GROUP BY diagnosis) t)
ORDER BY cases DESC`,
  },
  window: {
    title: 'CTE + window function - diagnosis rank and share within each organ',
    sql: `WITH per_dx AS (
  SELECT s.organ_site, r.diagnosis, COUNT(*) AS n
  FROM Reports r JOIN Specimens s ON s.case_id = r.case_id
  GROUP BY s.organ_site, r.diagnosis)
SELECT organ_site, diagnosis, n,
       RANK() OVER (PARTITION BY organ_site ORDER BY n DESC) AS rank_in_organ,
       ROUND(100.0 * n / SUM(n) OVER (PARTITION BY organ_site), 1) AS pct_of_organ
FROM per_dx ORDER BY organ_site, rank_in_organ`,
  },
};

async function handler(req, res) {
  try {
    const out = {};
    for (const [k, q] of Object.entries(QUERIES)) {
      const r = await pool.query(q.sql);
      out[k] = { title: q.title, sql: q.sql, rows: r.rows };
    }
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default withAuth(handler, ['PATHOLOGIST', 'ADMIN']);
