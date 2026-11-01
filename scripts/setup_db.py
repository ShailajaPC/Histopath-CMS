# setup_db.py - creates the database (if needed) and runs sql/01..07 in order.
# Safe to run on a brand-new server AND on your existing histopath_db (all scripts are idempotent).
# Run:  python scripts/setup_db.py
import os, sys, glob
import psycopg2
from psycopg2 import sql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT)
from config import DB_CONFIG

# 1. create database if missing
admin_cfg = dict(DB_CONFIG, dbname="postgres")
conn = psycopg2.connect(**admin_cfg); conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (DB_CONFIG["dbname"],))
if not cur.fetchone():
    cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_CONFIG["dbname"])))
    print(f"Created database {DB_CONFIG['dbname']}")
conn.close()

# 2. run scripts 01..07 (08 is a manual demo script)
conn = psycopg2.connect(**DB_CONFIG); conn.autocommit = True   # autocommit: each script is independent
cur = conn.cursor()
files = sorted(f for f in glob.glob(os.path.join(ROOT, "sql", "0[1-7]_*.sql")))
for f in files:
    print("Running", os.path.basename(f), "...", end=" ")
    try:
        cur.execute(open(f, encoding="utf-8").read())
        print("OK")
    except Exception as e:
        print("FAILED\n   ", str(e).strip())
        sys.exit(1)
conn.close()
print("\nDatabase ready. Next:  python scripts/load_data.py   (only if the tables are still empty)")
