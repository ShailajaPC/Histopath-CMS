# 🔬 HistoPath CMS — Histopathology Case & Report Management System.

Experiential Learning Level 3 – Mini Project  
**Stack:** PostgreSQL 14+ (relational + **pgvector** vector DB + JSONB) · Next.js (React) · Node API routes · Python sentence-transformers (embedding service)

A hospital-lab system to register histopathology cases, write/sign reports, record IHC markers and
morphology, and find **similar cases by meaning** (vector search). Three roles — **Admin, Pathologist,
Technician** — are enforced in the UI, in the API **and inside PostgreSQL** (GRANT/REVOKE + triggers).

---
## 1. Prerequisites
| Tool | Version |
|---|---|
| PostgreSQL | 14+ with the **pgvector** extension installed |
| Node.js | 18+ |
| Python | 3.9+ |

## 2. Setup (≈10 minutes)

```bash
# 0. edit your DB password in BOTH files
#    config.py                      (Python scripts)
#    histopath-next/.env.local      (Next.js)   <- copy .env.example if missing

# 1. Python deps
pip install -r requirements.txt

# 2. Create / upgrade the database  (runs sql/01 … 07; safe to run on your existing DB too)
python scripts/setup_db.py

# 3. Load the 60 TCGA-based sample cases + embeddings  (ONLY if the tables are empty)
python scripts/load_data.py

# 4. Start the embedding service (keep this terminal open)
python scripts/embed_server.py

# 5. Start the web app (new terminal)
cd histopath-next
npm install
npm run dev          # -> http://localhost:3000
```

### Demo accounts (created by `sql/07_seed_users.sql`)
| Role | Email | Password |
|---|---|---|
| **Admin** | admin@histopath.com | admin123 |
| **Pathologist** | meera@histopath.com | pass123 |
| **Technician** | ravi@histopath.com | tech123 |

> **Login not working?** Run `python scripts/setup_db.py` again — step `07` resets the demo passwords.
> The API also upgrades legacy plain-text passwords to bcrypt automatically.

## 3. Role matrix
| Feature | Admin | Pathologist | Technician |
|---|:-:|:-:|:-:|
| Dashboard, All Reports, Similar Cases, Differential Dx | ✅ | ✅ | ✅ |
| Analytics, Audit Log, TAT, SQL Insights | ✅ | ✅ | ❌ |
| New case (admin assigns it to a pathologist) | ✅ | ✅ | ❌ |
| Edit-sign-delete own draft / addendum / embeddings (vector C-R-U-D) | ❌ | ✅ | ❌ |
| **User management** (create, change role, disable, reset password, hierarchy) | ✅ | ❌ | ❌ |

Enforcement in 3 layers: `pages/_app.js` + Navbar (UI) → `withAuth(handler, roles)` (API, JWT) →
PostgreSQL roles `histo_admin / histo_pathologist / histo_technician` (`SET LOCAL ROLE` per request).

## 4. Project structure
```
sql/            01_schema (DDL) 02_fulltext 03_differential 04_analytics 05_functions_triggers_views
                06_rbac_vector (roles+grants) 07_seed_users 08_dml_and_queries (demo script)
scripts/        setup_db.py  load_data.py  embed_server.py
histopath-next/ pages/ (UI)  pages/api/ (backend)  lib/ (db, auth, embed)  components/
docs/           ER_diagram.png  PROJECT_DOCUMENTATION.md  
app/            first Flask prototype (kept for history – the Next.js app is the final system)
```

## 5. Documentation
* ER diagram → `docs/ER_diagram.png`
* Relational schema, technology justification, rubric mapping → `docs/PROJECT_DOCUMENTATION.md`
`

## 6. Push to GitHub
```bash
git remote add origin https://github.com/<your-user>/histopath-cms.git
git branch -M main
git push -u origin main
```
