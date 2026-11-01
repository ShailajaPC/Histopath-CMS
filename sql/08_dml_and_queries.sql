-- ============================================================
-- 08_dml_and_queries.sql   -   DEMONSTRATION SCRIPT (run in pgAdmin, block by block)
-- Rubric items 6 & 7: DML operations, nested / correlated / recursive queries, joins
-- ============================================================

-- ═══════════ A. DML  (INSERT / UPDATE / DELETE / SELECT) ═════
-- All inside a transaction that is rolled back, so your data is untouched.
BEGIN;
  INSERT INTO Patients (uhid, full_name, age, gender, contact)
  VALUES ('DEMO-001', 'Demo Patient', 45, 'Female', '9999999999');

  UPDATE Patients SET age = 46, contact = '8888888888' WHERE uhid = 'DEMO-001';

  SELECT patient_id, uhid, full_name, age, contact FROM Patients WHERE uhid = 'DEMO-001';

  DELETE FROM Patients WHERE uhid = 'DEMO-001';
ROLLBACK;

-- ═══════════ B. JOIN queries ═════════════════════════════════
-- B1. INNER JOIN across 5 tables
SELECT c.case_number, p.full_name AS patient, s.organ_site, r.diagnosis, u.full_name AS pathologist
FROM Cases c
JOIN Patients  p ON c.patient_id = p.patient_id
JOIN Specimens s ON c.case_id    = s.case_id
JOIN Reports   r ON c.case_id    = r.case_id
JOIN Users     u ON r.pathologist_id = u.user_id
ORDER BY c.case_number LIMIT 10;

-- B2. LEFT JOIN: every report with its number of addenda (0 allowed)
SELECT r.report_id, r.diagnosis, COUNT(a.addendum_id) AS addenda_count
FROM Reports r LEFT JOIN Report_Addenda a ON a.report_id = r.report_id
GROUP BY r.report_id, r.diagnosis
ORDER BY addenda_count DESC LIMIT 10;

-- B3. SELF JOIN: employee -> manager
SELECT e.full_name AS employee, e.role, m.full_name AS reports_to
FROM Users e LEFT JOIN Users m ON e.reports_to = m.user_id;

-- ═══════════ C. NESTED (sub-)queries ═════════════════════════
-- C1. Diagnoses that occur more often than the average diagnosis
SELECT diagnosis, COUNT(*) AS n
FROM Reports
GROUP BY diagnosis
HAVING COUNT(*) > (SELECT AVG(cnt) FROM (SELECT COUNT(*) AS cnt FROM Reports GROUP BY diagnosis) t)
ORDER BY n DESC;

-- C2. Patients having at least one ER-positive report  (IN + nested)
SELECT full_name, age FROM Patients
WHERE patient_id IN (SELECT c.patient_id FROM Cases c
                     WHERE c.case_id IN (SELECT r.case_id FROM Reports r
                                         WHERE r.report_id IN (SELECT report_id FROM IHC_Results
                                                               WHERE marker_name='ER' AND result='Positive')));

-- ═══════════ D. CORRELATED sub-queries ═══════════════════════
-- D1. Patients older than the average age of patients with the SAME organ site
SELECT p.full_name, p.age, s.organ_site
FROM Patients p
JOIN Cases c ON c.patient_id = p.patient_id
JOIN Specimens s ON s.case_id = c.case_id
WHERE p.age > (SELECT AVG(p2.age)
               FROM Patients p2
               JOIN Cases c2 ON c2.patient_id = p2.patient_id
               JOIN Specimens s2 ON s2.case_id = c2.case_id
               WHERE s2.organ_site = s.organ_site)           -- <- refers to the outer row
ORDER BY s.organ_site, p.age DESC;

-- D2. For each pathologist, their most recently signed report (correlated EXISTS / MAX)
SELECT u.full_name, r.diagnosis, r.signed_at
FROM Users u JOIN Reports r ON r.pathologist_id = u.user_id
WHERE r.signed_at = (SELECT MAX(r2.signed_at) FROM Reports r2 WHERE r2.pathologist_id = u.user_id);

-- ═══════════ E. RECURSIVE query (WITH RECURSIVE) ═════════════
-- Organisation tree: admin -> pathologists -> technicians, with depth and path
WITH RECURSIVE org AS (
    SELECT user_id, full_name, role, reports_to, 0 AS depth, full_name::TEXT AS path
    FROM Users WHERE reports_to IS NULL
  UNION ALL
    SELECT u.user_id, u.full_name, u.role, u.reports_to, o.depth + 1, o.path || ' > ' || u.full_name
    FROM Users u JOIN org o ON u.reports_to = o.user_id
)
SELECT repeat('    ', depth) || full_name AS hierarchy, role, depth, path FROM org ORDER BY path;

-- ═══════════ F. WINDOW function + CTE ════════════════════════
WITH per_dx AS (
    SELECT s.organ_site, r.diagnosis, COUNT(*) AS n
    FROM Reports r JOIN Specimens s ON s.case_id = r.case_id
    GROUP BY s.organ_site, r.diagnosis
)
SELECT organ_site, diagnosis, n,
       RANK() OVER (PARTITION BY organ_site ORDER BY n DESC) AS rank_in_organ,
       ROUND(100.0 * n / SUM(n) OVER (PARTITION BY organ_site), 1) AS pct_of_organ
FROM per_dx ORDER BY organ_site, rank_in_organ;

-- ═══════════ G. Advanced objects in action ═══════════════════
SELECT * FROM get_turnaround_time();                                   -- function
SELECT * FROM sla_breach_alerts;                                       -- view
SELECT * FROM suggest_differential_diagnosis('Breast','ER','Positive','PR','Positive'); -- function
-- CALL add_report_addendum('<signed report uuid>', '<pathologist user uuid>', 'New Dx', 'Reason');  -- procedure

-- ═══════════ H. Vector (pgvector) + JSONB + full-text ════════
-- 5 nearest reports to report #1 by cosine distance
SELECT r2.diagnosis, 1 - (r2.embedding <=> r1.embedding) AS similarity
FROM Reports r1, Reports r2
WHERE r1.report_id = (SELECT report_id FROM Reports WHERE embedding IS NOT NULL LIMIT 1)
  AND r2.report_id <> r1.report_id AND r2.embedding IS NOT NULL
ORDER BY r2.embedding <=> r1.embedding LIMIT 5;

-- JSONB: tumour size > 5 cm
SELECT diagnosis, synoptic_data->>'tumor_size_cm' AS tumor_size_cm
FROM Reports WHERE (synoptic_data->>'tumor_size_cm')::NUMERIC > 5;

-- Full-text search
SELECT diagnosis FROM Reports WHERE search_vector @@ to_tsquery('english','carcinoma & ductal') LIMIT 5;

-- ═══════════ I. Trigger / RBAC proofs ════════════════════════
-- UPDATE Reports SET diagnosis='x' WHERE is_signed;   -- fails: "Cannot modify a signed report"
-- SET ROLE histo_technician; INSERT INTO Reports(...);  -- fails: permission denied
-- RESET ROLE;
