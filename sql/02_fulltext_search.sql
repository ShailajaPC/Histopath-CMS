-- ============================================================
-- Full Text Search using PostgreSQL tsvector
-- Run this in pgAdmin after 01_schema.sql
-- ============================================================

-- Add tsvector column to Reports
ALTER TABLE Reports
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate tsvector from diagnosis + microscopic findings
UPDATE Reports
SET search_vector =
    to_tsvector('english',
        COALESCE(diagnosis, '') || ' ' ||
        COALESCE(microscopic_findings, '') || ' ' ||
        COALESCE(icd_code, '')
    );

-- Add GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS reports_search_idx
ON Reports USING GIN(search_vector);

-- Auto-update tsvector when report is inserted or updated
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        to_tsvector('english',
            COALESCE(NEW.diagnosis, '') || ' ' ||
            COALESCE(NEW.microscopic_findings, '') || ' ' ||
            COALESCE(NEW.icd_code, '')
        );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_search_vector
BEFORE INSERT OR UPDATE ON Reports
FOR EACH ROW
EXECUTE FUNCTION update_search_vector();

-- Also index patient names for search
ALTER TABLE Patients
ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE Patients
SET search_vector = to_tsvector('english', COALESCE(full_name,'') || ' ' || COALESCE(uhid,''));

CREATE INDEX IF NOT EXISTS patients_search_idx
ON Patients USING GIN(search_vector);

-- Test the search
SELECT r.report_id, r.diagnosis, r.microscopic_findings
FROM Reports r
WHERE r.search_vector @@ to_tsquery('english', 'carcinoma & ductal')
LIMIT 5;

SELECT 'Full text search setup complete!' AS status;
