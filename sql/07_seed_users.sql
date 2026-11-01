-- ============================================================
-- 07_seed_users.sql  -  demo accounts for the 3 roles
-- Re-running RESETS these demo passwords (this also repairs a broken login).
-- Must run BEFORE scripts/load_data.py (it needs the pathologists).
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMP TABLE seed_users (full_name TEXT, email TEXT, pw TEXT, role TEXT, boss_email TEXT);
INSERT INTO seed_users VALUES
 ('System Administrator',     'admin@histopath.com',  'admin123', 'ADMIN',       NULL),
 ('Dr. Meera Nair',           'meera@histopath.com',  'pass123',  'PATHOLOGIST', 'admin@histopath.com'),
 ('Dr. Suresh Kumar',         'suresh@histopath.com', 'pass123',  'PATHOLOGIST', 'admin@histopath.com'),
 ('Dr. Anita Sharma',         'anita@histopath.com',  'pass123',  'PATHOLOGIST', 'admin@histopath.com'),
 ('Dr. Ravi Menon',           'menon@histopath.com',  'pass123',  'PATHOLOGIST', 'admin@histopath.com'),
 ('Ravi Kumar (Lab Tech)',    'ravi@histopath.com',   'tech123',  'TECHNICIAN',  'meera@histopath.com');

-- update accounts that already exist (reset password / role / active)
UPDATE Users u
SET password_hash = crypt(s.pw, gen_salt('bf', 10)), role = s.role, is_active = TRUE
FROM seed_users s WHERE u.email = s.email;

-- insert the ones that do not exist yet
INSERT INTO Users (full_name, email, password_hash, role)
SELECT s.full_name, s.email, crypt(s.pw, gen_salt('bf', 10)), s.role
FROM seed_users s
WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.email = s.email);

-- reporting hierarchy (used by the recursive query on the Admin page)
UPDATE Users u SET reports_to = b.user_id
FROM seed_users s JOIN Users b ON b.email = s.boss_email
WHERE u.email = s.email AND u.reports_to IS NULL;

SELECT full_name, email, role FROM Users ORDER BY role, full_name;
