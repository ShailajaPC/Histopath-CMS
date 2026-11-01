-- ============================================================
-- Analytics Views for Dashboard
-- ============================================================

-- Cases per month
CREATE OR REPLACE VIEW cases_per_month AS
SELECT
    TO_CHAR(accessioned_at, 'YYYY-MM') AS month,
    COUNT(*) AS total_cases,
    SUM(CASE WHEN priority='URGENT' THEN 1 ELSE 0 END) AS urgent_cases
FROM Cases
GROUP BY TO_CHAR(accessioned_at, 'YYYY-MM')
ORDER BY month;

-- Diagnosis distribution
CREATE OR REPLACE VIEW diagnosis_distribution AS
SELECT
    r.diagnosis,
    r.category,
    s.organ_site,
    COUNT(*) AS case_count,
    ROUND(AVG(p.age)::NUMERIC, 1) AS avg_patient_age
FROM Reports r
JOIN Cases c     ON r.case_id    = c.case_id
JOIN Specimens s ON c.case_id    = s.case_id
JOIN Patients p  ON c.patient_id = p.patient_id
GROUP BY r.diagnosis, r.category, s.organ_site
ORDER BY case_count DESC;

-- IHC marker positivity rates
CREATE OR REPLACE VIEW ihc_positivity_rates AS
SELECT
    s.organ_site,
    ihc.marker_name,
    COUNT(*) AS total_tested,
    SUM(CASE WHEN ihc.result IN ('Positive','Intact','3+','2+') THEN 1 ELSE 0 END) AS positive_count,
    ROUND(
        SUM(CASE WHEN ihc.result IN ('Positive','Intact','3+','2+') THEN 1 ELSE 0 END)
        * 100.0 / NULLIF(COUNT(*),0), 1
    ) AS positivity_rate
FROM IHC_Results ihc
JOIN Reports r   ON ihc.report_id  = r.report_id
JOIN Cases c     ON r.case_id      = c.case_id
JOIN Specimens s ON c.case_id      = s.case_id
GROUP BY s.organ_site, ihc.marker_name
ORDER BY s.organ_site, positivity_rate DESC;

-- Gender distribution
CREATE OR REPLACE VIEW gender_distribution AS
SELECT
    s.organ_site,
    p.gender,
    COUNT(*) AS case_count,
    ROUND(AVG(p.age)::NUMERIC,1) AS avg_age
FROM Patients p
JOIN Cases c     ON p.patient_id = c.patient_id
JOIN Specimens s ON c.case_id    = s.case_id
GROUP BY s.organ_site, p.gender
ORDER BY s.organ_site;

SELECT 'Analytics views created!' AS status;
