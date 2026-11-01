-- ============================================================
-- 05_functions_triggers_views.sql
-- Advanced SQL: functions, STORED PROCEDURE, triggers, views, CTEs
-- Run after 01-04. Safe to re-run.
-- ============================================================

-- (drop first: an older version may exist with a different signature / column list)
DROP VIEW     IF EXISTS sla_breach_alerts;
DROP VIEW     IF EXISTS pending_cases_by_priority;
DROP FUNCTION IF EXISTS get_turnaround_time();
DROP FUNCTION IF EXISTS sign_off_report(UUID, UUID);

-- ─── FUNCTION: sign off a report (one ACID transaction) ──────
CREATE OR REPLACE FUNCTION sign_off_report(p_report_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE v_case UUID;
BEGIN
    SELECT case_id INTO v_case FROM Reports
    WHERE report_id = p_report_id AND is_signed = FALSE FOR UPDATE;

    IF v_case IS NULL THEN
        RAISE EXCEPTION 'Report not found or already signed';
    END IF;

    UPDATE Reports SET is_signed = TRUE, signed_at = NOW() WHERE report_id = p_report_id;
    UPDATE Cases   SET status = 'SIGNED'                   WHERE case_id   = v_case;
    INSERT INTO Case_Audit_Logs (case_id, action, old_status, new_status, performed_by)
    VALUES (v_case, 'SIGN_OFF', 'REPORTED', 'SIGNED', p_user_id);
END;
$$ LANGUAGE plpgsql;

-- ─── FUNCTION: turnaround time per pathologist & organ (uses a CTE) ──
CREATE OR REPLACE FUNCTION get_turnaround_time()
RETURNS TABLE (pathologist_name TEXT, organ_site TEXT, avg_tat_hours NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH tat AS (
        SELECT u.full_name::TEXT AS pname, s.organ_site::TEXT AS organ,
               ABS(EXTRACT(EPOCH FROM (r.signed_at - c.accessioned_at)) / 3600.0) AS hrs
        FROM Reports r
        JOIN Cases c     ON r.case_id = c.case_id
        JOIN Specimens s ON c.case_id = s.case_id
        JOIN Users u     ON r.pathologist_id = u.user_id
        WHERE r.is_signed AND r.signed_at IS NOT NULL
    )
    SELECT pname, organ, ROUND(AVG(hrs)::NUMERIC, 1)
    FROM tat GROUP BY pname, organ ORDER BY pname, organ;
END;
$$ LANGUAGE plpgsql;

-- ─── VIEWS: pending work & SLA breaches ──────────────────────
CREATE OR REPLACE VIEW pending_cases_by_priority AS
SELECT c.case_id, c.case_number, p.full_name AS patient_name, s.organ_site,
       c.priority, c.status, c.accessioned_at,
       ROUND(EXTRACT(EPOCH FROM (NOW() - c.accessioned_at)) / 3600.0, 1) AS hours_pending
FROM Cases c
JOIN Patients p  ON c.patient_id = p.patient_id
JOIN Specimens s ON c.case_id    = s.case_id
WHERE c.status <> 'SIGNED'
ORDER BY (c.priority = 'URGENT') DESC, c.accessioned_at;

-- SLA: URGENT must be signed within 24 h, ROUTINE within 72 h
CREATE OR REPLACE VIEW sla_breach_alerts AS
SELECT case_id, case_number, patient_name, organ_site, priority, status,
       hours_pending AS hours_elapsed
FROM pending_cases_by_priority
WHERE (priority = 'URGENT'  AND hours_pending > 24)
   OR (priority = 'ROUTINE' AND hours_pending > 72)
ORDER BY hours_pending DESC;

-- ─── STORED PROCEDURE: record an addendum to a SIGNED report ─
CREATE OR REPLACE PROCEDURE add_report_addendum(
    p_report_id UUID, p_author UUID, p_new_diagnosis TEXT, p_note TEXT)
LANGUAGE plpgsql AS $$
DECLARE v_old TEXT; v_case UUID;
BEGIN
    SELECT diagnosis, case_id INTO v_old, v_case
    FROM Reports WHERE report_id = p_report_id AND is_signed = TRUE;
    IF v_case IS NULL THEN
        RAISE EXCEPTION 'Addenda can only be added to signed reports';
    END IF;
    INSERT INTO Report_Addenda (report_id, author_id, revision_note, old_diagnosis, new_diagnosis)
    VALUES (p_report_id, p_author, p_note, v_old, p_new_diagnosis);
    INSERT INTO Case_Audit_Logs (case_id, action, old_status, new_status, performed_by)
    VALUES (v_case, 'ADDENDUM', 'SIGNED', 'SIGNED', p_author);
END;
$$;

-- ─── TRIGGER: addenda only for signed reports ────────────────
CREATE OR REPLACE FUNCTION check_addendum_signed() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Reports WHERE report_id = NEW.report_id AND is_signed) THEN
        RAISE EXCEPTION 'Addenda can only be added to signed reports';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_addendum_requires_signed ON Report_Addenda;
CREATE TRIGGER trg_addendum_requires_signed
BEFORE INSERT ON Report_Addenda
FOR EACH ROW EXECUTE FUNCTION check_addendum_signed();

-- ─── TRIGGER: the last active ADMIN can never be removed ─────
CREATE OR REPLACE FUNCTION protect_last_admin() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role = 'ADMIN' AND OLD.is_active
       AND (NEW.role <> 'ADMIN' OR NEW.is_active = FALSE)
       AND NOT EXISTS (SELECT 1 FROM Users WHERE role = 'ADMIN' AND is_active AND user_id <> OLD.user_id) THEN
        RAISE EXCEPTION 'Cannot demote or deactivate the last active administrator';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_last_admin ON Users;
CREATE TRIGGER trg_protect_last_admin
BEFORE UPDATE ON Users
FOR EACH ROW EXECUTE FUNCTION protect_last_admin();

-- ─── TRIGGER: normalise e-mail on every insert/update ────────
CREATE OR REPLACE FUNCTION normalise_user_email() RETURNS TRIGGER AS $$
BEGIN
    NEW.email := LOWER(TRIM(NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalise_email ON Users;
CREATE TRIGGER trg_normalise_email
BEFORE INSERT OR UPDATE OF email ON Users
FOR EACH ROW EXECUTE FUNCTION normalise_user_email();

SELECT 'Functions, procedure, triggers and views created' AS status;
