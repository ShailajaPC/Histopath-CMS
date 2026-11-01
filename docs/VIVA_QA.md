# Viva cheat-sheet

**Q. What problem does the project solve?** Histopathology labs keep reports as free text; finding similar past cases is slow. We store structured data in PostgreSQL and a 384-dim embedding of each report in pgvector, so a pathologist can search *by meaning* and also by IHC markers.

**Q. Why pgvector instead of a separate vector DB?** Same database ⇒ one transaction, one backup, joins between vectors and clinical tables, DB-level security applies to vectors too.

**Q. How does semantic search work?** Text → `all-MiniLM-L6-v2` (Python service on :5001) → 384 floats → `ORDER BY embedding <=> query LIMIT 10`. `<=>` is cosine distance; similarity = `1 - distance`.

**Q. Explain vector CRUD.** Create: embedding generated on new case. Read: `/api/vector` shows dims, first values and 5 nearest neighbours. Update: regenerate button, and automatic re-embed when a draft is edited. Delete: remove only the embedding (report is kept) or delete the draft (vector deleted with the row).

**Q. How is RBAC done?** Three layers. UI hides pages; API `withAuth(handler, roles)` verifies the JWT; PostgreSQL has roles `histo_admin/pathologist/technician` and every request runs `SET LOCAL ROLE`, so even a bug in the API cannot exceed the role's GRANTs. Column-level GRANT hides `password_hash`.

**Q. What does the Admin do?** Creates users with any role, changes roles, disables accounts, resets passwords, sees the hierarchy (recursive CTE). Admin has read-only access to clinical data.

**Q. Which triggers exist?** block edit / delete of signed reports; auto-update tsvector; addendum only for signed reports; protect last admin; normalise e-mail.

**Q. Procedure vs function?** `add_report_addendum` is a PROCEDURE (`CALL`, may do multi-statement writes). `sign_off_report`, `get_turnaround_time`, `suggest_differential_diagnosis` are FUNCTIONs (`SELECT`).

**Q. Where is the recursive query?** `WITH RECURSIVE org AS (...)` – Admin page and `sql/08` §E; walks `Users.reports_to`.

**Q. Correlated vs nested sub-query?** Nested runs once independently (average diagnosis count). Correlated references the outer row and re-evaluates per row (patients older than the average of *their* organ site). Both on `/insights`.

**Q. How are passwords stored?** bcrypt (cost 10) hashes; compared in Node with bcryptjs. JWT (8 h) signed with `JWT_SECRET`.

**Q. What is ACID here?** Sign-off updates report, case and audit log in one transaction – all or nothing.

**Q. Normal form?** 3NF; IHC and morphology are child tables; `synoptic_data` JSONB holds variable organ-specific fields.

**Q. Limitations / future work.** Dataset is TCGA-derived with synthetic text; embeddings are not clinical-grade; add file upload of slide images, e-mail alerts for SLA breaches.
