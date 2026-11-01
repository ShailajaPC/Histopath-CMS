-- ============================================================
-- Differential Diagnosis Suggester
-- Based on IHC profile → suggests most likely diagnoses
-- ============================================================

CREATE OR REPLACE FUNCTION suggest_differential_diagnosis(
    p_organ    TEXT,
    p_marker1  TEXT, p_result1 TEXT,
    p_marker2  TEXT DEFAULT NULL, p_result2 TEXT DEFAULT NULL,
    p_marker3  TEXT DEFAULT NULL, p_result3 TEXT DEFAULT NULL
)
RETURNS TABLE (
    diagnosis        TEXT,
    case_count       BIGINT,
    percentage       NUMERIC,
    avg_age          NUMERIC,
    common_category  TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH matching_cases AS (
        SELECT DISTINCT r.report_id, r.diagnosis, r.category,
                        p.age
        FROM Reports r
        JOIN Cases c     ON r.case_id    = c.case_id
        JOIN Specimens s ON c.case_id    = s.case_id
        JOIN Patients p  ON c.patient_id = p.patient_id
        WHERE s.organ_site = p_organ
        AND r.report_id IN (
            SELECT report_id FROM IHC_Results
            WHERE marker_name = p_marker1 AND result = p_result1
        )
        AND (p_marker2 IS NULL OR r.report_id IN (
            SELECT report_id FROM IHC_Results
            WHERE marker_name = p_marker2 AND result = p_result2
        ))
        AND (p_marker3 IS NULL OR r.report_id IN (
            SELECT report_id FROM IHC_Results
            WHERE marker_name = p_marker3 AND result = p_result3
        ))
    ),
    total AS (SELECT COUNT(*) AS cnt FROM matching_cases)
    SELECT
        mc.diagnosis::TEXT,
        COUNT(*)                                         AS case_count,
        ROUND(COUNT(*) * 100.0 / NULLIF(t.cnt, 0), 1)  AS percentage,
        ROUND(AVG(mc.age)::NUMERIC, 1)                  AS avg_age,
        MODE() WITHIN GROUP (ORDER BY mc.category)::TEXT AS common_category
    FROM matching_cases mc, total t
    GROUP BY mc.diagnosis, t.cnt
    ORDER BY case_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Test it
SELECT * FROM suggest_differential_diagnosis(
    'Breast',
    'ER', 'Positive',
    'PR', 'Positive',
    'HER2', 'Negative'
);

SELECT 'Differential diagnosis function created!' AS status;
