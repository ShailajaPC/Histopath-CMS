-- ============================================================
-- 06_rbac_vector.sql   (safe to run more than once)
--   1. Trigger: signed reports keep clinical content locked,
--      but the derived embedding may be refreshed / removed
--   2. Trigger: signed reports cannot be deleted
--   3. Make sure the full-text search trigger exists
--   4. Hash passwords with pgcrypto (bcrypt)
--   5. Database roles + GRANT / REVOKE (RBAC inside PostgreSQL)
-- ============================================================

-- ─── 1. Signed-report protection (clinical fields only) ──────
CREATE OR REPLACE FUNCTION prevent_signed_report_edit()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_signed = TRUE THEN
        IF NEW.is_signed             IS DISTINCT FROM OLD.is_signed
        OR NEW.signed_at             IS DISTINCT FROM OLD.signed_at
        OR NEW.diagnosis             IS DISTINCT FROM OLD.diagnosis
        OR NEW.icd_code              IS DISTINCT FROM OLD.icd_code
        OR NEW.category              IS DISTINCT FROM OLD.category
        OR NEW.microscopic_findings  IS DISTINCT FROM OLD.microscopic_findings
        OR NEW.synoptic_data         IS DISTINCT FROM OLD.synoptic_data
        OR NEW.pathologist_id        IS DISTINCT FROM OLD.pathologist_id
        OR NEW.case_id               IS DISTINCT FROM OLD.case_id THEN
            RAISE EXCEPTION 'Cannot modify a signed report. Use Report Addenda instead.';
        END IF;
        -- only derived data (embedding / search_vector) changed: allowed
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_signed_report_edit ON Reports;
CREATE TRIGGER trg_block_signed_report_edit
BEFORE UPDATE ON Reports
FOR EACH ROW EXECUTE FUNCTION prevent_signed_report_edit();

-- ─── 2. Signed reports cannot be deleted ─────────────────────
CREATE OR REPLACE FUNCTION prevent_signed_report_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_signed = TRUE THEN
        RAISE EXCEPTION 'Cannot delete a signed report.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_signed_report_delete ON Reports;
CREATE TRIGGER trg_block_signed_report_delete
BEFORE DELETE ON Reports
FOR EACH ROW EXECUTE FUNCTION prevent_signed_report_delete();

-- ─── 3. Full-text search vector: keep it up to date ──────────
ALTER TABLE Reports ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.diagnosis,'') || ' ' ||
        COALESCE(NEW.microscopic_findings,'') || ' ' ||
        COALESCE(NEW.icd_code,''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_search_vector ON Reports;
CREATE TRIGGER trg_update_search_vector
BEFORE INSERT OR UPDATE ON Reports
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE INDEX IF NOT EXISTS reports_search_idx ON Reports USING GIN(search_vector);

UPDATE Reports SET search_vector = to_tsvector('english',
    COALESCE(diagnosis,'') || ' ' || COALESCE(microscopic_findings,'') || ' ' || COALESCE(icd_code,''))
WHERE search_vector IS NULL;

-- ─── 4. Password hashing (bcrypt via pgcrypto) ───────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE Users
SET password_hash = crypt(password_hash, gen_salt('bf', 10))
WHERE password_hash NOT LIKE '$2%';          -- skips rows that are already hashed

-- ─── 5. Database roles (RBAC inside PostgreSQL) ──────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'histo_pathologist') THEN
        CREATE ROLE histo_pathologist NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'histo_technician') THEN
        CREATE ROLE histo_technician NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'histo_admin') THEN
        CREATE ROLE histo_admin NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO histo_pathologist, histo_technician, histo_admin;

-- (tables created with SERIAL ids need sequence rights for INSERT)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO histo_pathologist, histo_technician, histo_admin;

-- everyone can read clinical tables and the analytics views
GRANT SELECT ON Patients, Cases, Specimens, Reports, IHC_Results,
                Morphological_Features, Case_Audit_Logs, Report_Addenda
      TO histo_pathologist, histo_technician, histo_admin;

-- views: grant on each one that exists (skips any you have not created)
DO $$
DECLARE v TEXT;
BEGIN
    FOREACH v IN ARRAY ARRAY['pending_cases_by_priority','sla_breach_alerts','diagnosis_distribution',
                             'ihc_positivity_rates','gender_distribution','cases_per_month']
    LOOP
        IF to_regclass(v) IS NOT NULL THEN
            EXECUTE format('GRANT SELECT ON %I TO histo_pathologist, histo_technician, histo_admin', v);
        END IF;
    END LOOP;
END $$;

-- Users: column-level grant, so password hashes are never readable by these roles
REVOKE ALL ON Users FROM histo_pathologist, histo_technician, histo_admin;
GRANT SELECT (user_id, full_name, email, role, is_active, reports_to, created_at) ON Users
      TO histo_pathologist, histo_technician, histo_admin;

-- Pathologist: writes reports, IHC, morphology; can also register the case
GRANT INSERT, UPDATE, DELETE ON Reports, IHC_Results, Morphological_Features TO histo_pathologist;
GRANT INSERT, UPDATE ON Patients, Cases, Specimens                           TO histo_pathologist;
GRANT INSERT ON Case_Audit_Logs, Report_Addenda                              TO histo_pathologist;

-- Technician: accessioning only (patient / case / specimen), no reports
GRANT INSERT, UPDATE ON Patients, Cases, Specimens TO histo_technician;
GRANT INSERT ON Case_Audit_Logs                    TO histo_technician;

-- Admin: manages users AND can register cases (assigned to a pathologist); cannot edit/sign/delete reports
GRANT INSERT, UPDATE ON Users TO histo_admin;
GRANT INSERT, UPDATE ON Patients, Cases, Specimens TO histo_admin;
GRANT INSERT ON Reports, IHC_Results, Morphological_Features, Case_Audit_Logs TO histo_admin;   -- (SELECT on password_hash stays revoked)

-- Only pathologists may sign off a report / add addenda
REVOKE EXECUTE ON PROCEDURE add_report_addendum(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE add_report_addendum(UUID, UUID, TEXT, TEXT) TO histo_pathologist;

REVOKE EXECUTE ON FUNCTION sign_off_report(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION sign_off_report(UUID, UUID) TO histo_pathologist;

SELECT 'RBAC + triggers + hashing applied' AS status;
