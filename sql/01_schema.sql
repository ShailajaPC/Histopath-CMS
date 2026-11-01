-- ============================================================
-- 01_schema.sql  -  HistoPath CMS : complete relational schema (DDL)
-- PostgreSQL 14+ with pgvector + pgcrypto.
-- Safe to re-run: every statement is idempotent.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector  (vector database feature)
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), bcrypt crypt()

-- ─── USERS  (3 roles: PATHOLOGIST, TECHNICIAN, ADMIN) ────────
CREATE TABLE IF NOT EXISTS Users (
    user_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name      VARCHAR(120) NOT NULL,
    email          VARCHAR(160) NOT NULL UNIQUE,
    password_hash  TEXT         NOT NULL,                 -- bcrypt hash
    role           VARCHAR(20)  NOT NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    reports_to     UUID         REFERENCES Users(user_id) ON DELETE SET NULL,  -- hierarchy (recursive query)
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);
-- for databases created by an older version of this project
ALTER TABLE Users ADD COLUMN IF NOT EXISTS is_active  BOOLEAN   NOT NULL DEFAULT TRUE;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES Users(user_id) ON DELETE SET NULL;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Make sure ADMIN is an allowed role (works for CHECK constraints and for ENUM types)
DO $$
DECLARE c RECORD; is_enum BOOLEAN; tname TEXT;
BEGIN
    SELECT (t.typtype = 'e'), t.typname INTO is_enum, tname
    FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
    WHERE a.attrelid = 'users'::regclass AND a.attname = 'role';

    IF is_enum THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', tname, 'ADMIN');
    ELSE
        FOR c IN SELECT conname FROM pg_constraint
                 WHERE conrelid = 'users'::regclass AND contype = 'c'
                   AND pg_get_constraintdef(oid) ILIKE '%role%'
        LOOP
            EXECUTE format('ALTER TABLE Users DROP CONSTRAINT %I', c.conname);
        END LOOP;
        ALTER TABLE Users ADD CONSTRAINT users_role_check
            CHECK (role IN ('PATHOLOGIST','TECHNICIAN','ADMIN'));
    END IF;
END $$;

-- ─── PATIENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Patients (
    patient_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    uhid         VARCHAR(40)  NOT NULL UNIQUE,            -- hospital id
    full_name    VARCHAR(120) NOT NULL,
    age          INT          CHECK (age BETWEEN 0 AND 120),
    gender       VARCHAR(10)  CHECK (gender IN ('Male','Female','Other')),
    contact      VARCHAR(40)  DEFAULT 'N/A',
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── CASES  (one patient -> many cases) ──────────────────────
CREATE TABLE IF NOT EXISTS Cases (
    case_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number     VARCHAR(30) NOT NULL UNIQUE,
    patient_id      UUID        NOT NULL REFERENCES Patients(patient_id) ON DELETE RESTRICT,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACCESSIONED'
                    CHECK (status IN ('ACCESSIONED','GROSSING','REPORTED','SIGNED')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'ROUTINE'
                    CHECK (priority IN ('ROUTINE','URGENT')),
    accessioned_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── SPECIMENS  (one case -> specimen) ───────────────────────
CREATE TABLE IF NOT EXISTS Specimens (
    specimen_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id          UUID         NOT NULL REFERENCES Cases(case_id) ON DELETE CASCADE,
    organ_site       VARCHAR(40)  NOT NULL,
    biopsy_type      VARCHAR(60),
    fixation_type    VARCHAR(80)  DEFAULT 'Formalin Fixed Paraffin Embedded (FFPE)',
    collection_date  DATE
);

-- ─── REPORTS  (one case -> one report; embedding = pgvector) ─
CREATE TABLE IF NOT EXISTS Reports (
    report_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id               UUID         NOT NULL UNIQUE REFERENCES Cases(case_id) ON DELETE CASCADE,
    pathologist_id        UUID         NOT NULL REFERENCES Users(user_id),
    microscopic_findings  TEXT,
    diagnosis             VARCHAR(160) NOT NULL,
    icd_code              VARCHAR(20),
    category              VARCHAR(20)  CHECK (category IN ('Malignant','Benign','Inflammatory','Reactive','Other')),
    synoptic_data         JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- semi-structured (NoSQL-style) data
    is_signed             BOOLEAN      NOT NULL DEFAULT FALSE,
    signed_at             TIMESTAMP,
    embedding             vector(384),                                 -- all-MiniLM-L6-v2 sentence embedding
    search_vector         tsvector,
    CONSTRAINT signed_has_date CHECK (is_signed = FALSE OR signed_at IS NOT NULL)
);

-- ─── IHC RESULTS  (report 1 : N) ─────────────────────────────
CREATE TABLE IF NOT EXISTS IHC_Results (
    ihc_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id    UUID        NOT NULL REFERENCES Reports(report_id) ON DELETE CASCADE,
    marker_name  VARCHAR(30) NOT NULL,
    result       VARCHAR(30) NOT NULL,
    intensity    VARCHAR(10)
);

-- ─── MORPHOLOGICAL FEATURES  (report 1 : N) ──────────────────
CREATE TABLE IF NOT EXISTS Morphological_Features (
    feature_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id      UUID        NOT NULL REFERENCES Reports(report_id) ON DELETE CASCADE,
    feature_type   VARCHAR(40) NOT NULL,
    feature_value  VARCHAR(60) NOT NULL
);

-- ─── REPORT ADDENDA  (corrections to SIGNED reports) ─────────
CREATE TABLE IF NOT EXISTS Report_Addenda (
    addendum_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id      UUID        NOT NULL REFERENCES Reports(report_id) ON DELETE CASCADE,
    author_id      UUID        NOT NULL REFERENCES Users(user_id),
    revision_note  TEXT        NOT NULL,
    old_diagnosis  VARCHAR(160),
    new_diagnosis  VARCHAR(160),
    created_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── CASE AUDIT LOG ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Case_Audit_Logs (
    log_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID        REFERENCES Cases(case_id) ON DELETE SET NULL,
    action        VARCHAR(40) NOT NULL,
    old_status    VARCHAR(20),
    new_status    VARCHAR(20),
    performed_by  UUID        REFERENCES Users(user_id),
    "timestamp"   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cases_patient      ON Cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_status       ON Cases(status, priority);
CREATE INDEX IF NOT EXISTS idx_specimens_case     ON Specimens(case_id);
CREATE INDEX IF NOT EXISTS idx_specimens_organ    ON Specimens(organ_site);
CREATE INDEX IF NOT EXISTS idx_reports_path       ON Reports(pathologist_id);
CREATE INDEX IF NOT EXISTS idx_ihc_report         ON IHC_Results(report_id, marker_name);
CREATE INDEX IF NOT EXISTS idx_morph_report       ON Morphological_Features(report_id);
CREATE INDEX IF NOT EXISTS idx_addenda_report     ON Report_Addenda(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_case         ON Case_Audit_Logs(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_synoptic   ON Reports USING GIN (synoptic_data);   -- JSONB index

-- Vector index (approximate nearest neighbour, cosine distance). Needs pgvector >= 0.5.
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_reports_embedding
        ON Reports USING hnsw (embedding vector_cosine_ops);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index skipped (older pgvector) - exact search still works: %', SQLERRM;
END $$;

SELECT 'Schema (tables + constraints + indexes) ready' AS status;
