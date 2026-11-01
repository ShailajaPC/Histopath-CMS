# app.py — HistoPath CMS with PostgreSQL + pgvector semantic search

from flask import Flask, render_template, request, redirect, url_for, session
import psycopg2
from psycopg2.extras import RealDictCursor
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

app = Flask(__name__)
app.secret_key = "histopath_secret_2024"

def get_db():
    return psycopg2.connect(**DB_CONFIG)

# ─── LOGIN ────────────────────────────────────────────────────
@app.route('/login', methods=['GET','POST'])
def login():
    error = None
    if request.method == 'POST':
        email    = request.form['email']
        password = request.form['password']
        conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM Users WHERE email=%s AND password_hash=%s", (email, password))
        user = cur.fetchone(); conn.close()
        if user:
            session['user_id']   = str(user['user_id'])
            session['user_name'] = user['full_name']
            session['role']      = user['role']
            return redirect(url_for('dashboard'))
        error = "Invalid email or password.Use demo credentials or register."
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


@app.route('/register', methods=['GET','POST'])
def register():
    error = None
    if request.method == 'POST':
        name     = request.form['name']
        email    = request.form['email']
        password = request.form['password']
        role     = request.form['role']
        conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute("""
                INSERT INTO Users (full_name,email,password_hash,role)
                VALUES (%s,%s,%s,%s)
            """, (name, email, password, role))
            conn.commit(); conn.close()
            return redirect(url_for('login'))
        except:
            conn.close()
            error = "Email already exists."
    return render_template('register.html', error=error)

# ─── DASHBOARD ────────────────────────────────────────────────
@app.route('/')
@login_required
def dashboard():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT COUNT(*) AS total FROM Reports")
    total_reports = cur.fetchone()['total']

    cur.execute("SELECT COUNT(*) AS total FROM Patients")
    total_patients = cur.fetchone()['total']

    cur.execute("""
        SELECT s.organ_site, COUNT(*) AS cnt
        FROM Specimens s GROUP BY s.organ_site
    """)
    organ_counts = cur.fetchall()

    cur.execute("""
        SELECT r.report_id, p.full_name AS patient, s.organ_site,
               r.diagnosis, r.category, r.signed_at, r.is_signed
        FROM Reports r
        JOIN Cases c    ON r.case_id    = c.case_id
        JOIN Patients p ON c.patient_id = p.patient_id
        JOIN Specimens s ON c.case_id   = s.case_id
        ORDER BY r.signed_at DESC NULLS LAST LIMIT 6
    """)
    recent = cur.fetchall()

    cur.execute("SELECT COUNT(*) AS total FROM Report_Addenda")
    amendments = cur.fetchone()['total']

    cur.execute("SELECT COUNT(*) AS total FROM Cases WHERE priority='URGENT' AND status!='SIGNED'")
    urgent = cur.fetchone()['total']

    cur.execute("SELECT * FROM sla_breach_alerts LIMIT 5")
    sla_breaches = cur.fetchall()

    conn.close()
    return render_template('index.html',
        total_reports=total_reports, total_patients=total_patients,
        organ_counts=organ_counts, recent=recent,
        amendments=amendments, urgent=urgent,
        sla_breaches=sla_breaches)

# ─── ALL REPORTS ──────────────────────────────────────────────
@app.route('/reports')
@login_required
def reports():
    organ    = request.args.get('organ', '')
    category = request.args.get('category', '')
    search   = request.args.get('search', '')

    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    query = """
        SELECT r.report_id, p.full_name AS patient, p.age, p.gender,
               s.organ_site, r.diagnosis, r.category, r.icd_code,
               u.full_name AS pathologist, r.signed_at, r.is_signed,
               c.case_number, c.priority
        FROM Reports r
        JOIN Cases c    ON r.case_id      = c.case_id
        JOIN Patients p ON c.patient_id   = p.patient_id
        JOIN Specimens s ON c.case_id     = s.case_id
        JOIN Users u    ON r.pathologist_id = u.user_id
        WHERE 1=1
    """
    params = []
    if organ:    query += " AND s.organ_site=%s";   params.append(organ)
    if category: query += " AND r.category=%s";     params.append(category)
    if search:   query += " AND (p.full_name ILIKE %s OR r.diagnosis ILIKE %s)"; params += [f'%{search}%', f'%{search}%']
    query += " ORDER BY r.signed_at DESC NULLS LAST"

    cur.execute(query, params)
    all_reports = cur.fetchall()
    conn.close()
    return render_template('reports.html', reports=all_reports,
        organ=organ, category=category, search=search)

# ─── REPORT DETAIL ────────────────────────────────────────────
@app.route('/report/<report_id>')
@login_required
def view_report(report_id):
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT r.report_id, p.full_name AS patient, p.age, p.gender,
               s.organ_site, s.collection_date, s.fixation_type, s.biopsy_type,
               r.diagnosis, r.icd_code, r.category, r.microscopic_findings,
               r.synoptic_data, r.is_signed, r.signed_at,
               u.full_name AS pathologist, c.case_number, c.priority, c.status
        FROM Reports r
        JOIN Cases c    ON r.case_id      = c.case_id
        JOIN Patients p ON c.patient_id   = p.patient_id
        JOIN Specimens s ON c.case_id     = s.case_id
        JOIN Users u    ON r.pathologist_id = u.user_id
        WHERE r.report_id = %s
    """, (report_id,))
    report = cur.fetchone()

    cur.execute("SELECT marker_name, result, intensity FROM IHC_Results WHERE report_id=%s", (report_id,))
    ihc = cur.fetchall()

    cur.execute("SELECT feature_type, feature_value FROM Morphological_Features WHERE report_id=%s", (report_id,))
    morph = cur.fetchall()

    cur.execute("""
        SELECT ra.*, u.full_name AS author_name
        FROM Report_Addenda ra
        JOIN Users u ON ra.author_id = u.user_id
        WHERE ra.report_id = %s ORDER BY ra.created_at DESC
    """, (report_id,))
    addenda = cur.fetchall()

    conn.close()
    return render_template('report_detail.html',
        report=report, ihc=ihc, morph=morph, addenda=addenda)

# ─── SEMANTIC SIMILAR CASE RETRIEVAL ─────────────────────────
@app.route('/similar', methods=['GET','POST'])
@login_required
def similar():
    results, query_text, search_mode = [], '', 'ihc'

    if request.method == 'POST':
        search_mode = request.form.get('search_mode', 'ihc')

        if search_mode == 'semantic':
            # Vector similarity search
            query_text = request.form.get('query_text','')
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer('all-MiniLM-L6-v2')
            embedding = model.encode(query_text).tolist()

            conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT r.report_id, p.full_name AS patient_name, p.age,
                       s.organ_site, r.diagnosis, r.category, r.signed_at,
                       1 - (r.embedding <=> %s::vector) AS similarity_score
                FROM Reports r
                JOIN Cases c    ON r.case_id    = c.case_id
                JOIN Patients p ON c.patient_id = p.patient_id
                JOIN Specimens s ON c.case_id   = s.case_id
                WHERE r.embedding IS NOT NULL
                ORDER BY r.embedding <=> %s::vector
                LIMIT 10
            """, (str(embedding), str(embedding)))
            results = cur.fetchall()
            conn.close()

        else:
            # IHC marker matching
            organ    = request.form.get('organ','')
            category = request.form.get('category','')
            marker   = request.form.get('marker','')
            result   = request.form.get('result','')

            conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT DISTINCT r.report_id, p.full_name AS patient_name, p.age,
                       s.organ_site, r.diagnosis, r.category, r.signed_at,
                       ihc.marker_name, ihc.result AS ihc_result
                FROM Reports r
                JOIN Cases c     ON r.case_id    = c.case_id
                JOIN Patients p  ON c.patient_id = p.patient_id
                JOIN Specimens s ON c.case_id    = s.case_id
                JOIN IHC_Results ihc ON r.report_id = ihc.report_id
                WHERE s.organ_site = %s AND r.category = %s
                  AND ihc.marker_name = %s AND ihc.result = %s
                ORDER BY r.signed_at DESC NULLS LAST
            """, (organ, category, marker, result))
            results = cur.fetchall()
            conn.close()

    return render_template('similar_cases.html',
        results=results, query_text=query_text,
        search_mode=search_mode, form=request.form)

# ─── AUDIT LOG ────────────────────────────────────────────────
@app.route('/audit')
@login_required
def audit():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT ra.addendum_id, ra.report_id, p.full_name AS patient,
               u.full_name AS amended_by, ra.created_at,
               ra.old_diagnosis, ra.new_diagnosis, ra.revision_note
        FROM Report_Addenda ra
        JOIN Reports r  ON ra.report_id  = r.report_id
        JOIN Cases c    ON r.case_id     = c.case_id
        JOIN Patients p ON c.patient_id  = p.patient_id
        JOIN Users u    ON ra.author_id  = u.user_id
        ORDER BY ra.created_at DESC
    """)
    logs = cur.fetchall()

    cur.execute("""
        SELECT cal.*, u.full_name AS performed_by_name
        FROM Case_Audit_Logs cal
        JOIN Users u ON cal.performed_by = u.user_id
        ORDER BY cal.timestamp DESC LIMIT 20
    """)
    case_logs = cur.fetchall()
    conn.close()
    return render_template('audit.html', logs=logs, case_logs=case_logs)

# ─── TAT REPORT ───────────────────────────────────────────────
@app.route('/tat')
@login_required
def tat():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM get_turnaround_time()")
    tat_data = cur.fetchall()
    conn.close()
    return render_template('tat.html', tat_data=tat_data)

# ─── PENDING CASES ────────────────────────────────────────────
@app.route('/pending')
@login_required
def pending():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM pending_cases_by_priority")
    cases = cur.fetchall()
    conn.close()
    return render_template('pending.html', cases=cases)


# ─── ADD NEW CASE ─────────────────────────────────────────────
@app.route('/add_case', methods=['GET','POST'])
@login_required
def add_case():
    success, error, case_number, report_id = None, None, None, None

    if request.method == 'POST':
        try:
            from sentence_transformers import SentenceTransformer
            import uuid, json

            model     = SentenceTransformer('all-MiniLM-L6-v2')
            conn      = get_db()
            cur       = conn.cursor(cursor_factory=RealDictCursor)
            f         = request.form

            # ── Patient ──────────────────────────────────────
            patient_id  = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO Patients (patient_id,uhid,full_name,age,gender,contact)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (uhid) DO UPDATE SET full_name=EXCLUDED.full_name
                RETURNING patient_id
            """, (patient_id, f['uhid'], f['patient_name'],
                  int(f['age']), f['gender'], f.get('contact','N/A')))
            patient_id = str(cur.fetchone()['patient_id'])

            # ── Case ─────────────────────────────────────────
            case_id     = str(uuid.uuid4())
            import random
            case_number = f"HISTO-{random.randint(2024,2026)}-{random.randint(1000,9999)}"
            cur.execute("""
                INSERT INTO Cases (case_id,case_number,patient_id,status,priority)
                VALUES (%s,%s,%s,'REPORTED',%s)
            """, (case_id, case_number, patient_id, f['priority']))

            # ── Specimen ──────────────────────────────────────
            cur.execute("""
                INSERT INTO Specimens
                (case_id,organ_site,biopsy_type,fixation_type,collection_date)
                VALUES (%s,%s,%s,%s,%s)
            """, (case_id, f['organ_site'], f['biopsy_type'],
                  f['fixation_type'], f['collection_date']))

            # ── Report with embedding ─────────────────────────
            report_id   = str(uuid.uuid4())
            micro       = f['microscopic_desc']
            embed_text  = f"{micro} Diagnosis: {f['diagnosis']}"
            embedding   = model.encode(embed_text).tolist()
            synoptic    = json.dumps({"gross_description": f.get('gross_desc','')})

            cur.execute("""
                INSERT INTO Reports
                (report_id,case_id,pathologist_id,microscopic_findings,
                 diagnosis,icd_code,category,synoptic_data,
                 is_signed,embedding)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,FALSE,%s::vector)
            """, (report_id, case_id, session['user_id'],
                  micro, f['diagnosis'], f.get('icd_code',''),
                  f['category'], synoptic, str(embedding)))

            # ── IHC Results ───────────────────────────────────
            IHC_MARKERS = ['ER','PR','HER2','Ki-67','CK5/6','CDX2',
                           'CK20','MLH1','MSH2','CD20','CD3','TTF-1']
            for marker in IHC_MARKERS:
                result = f.get(f'ihc_result_{marker}','')
                if result:
                    intensity = f.get(f'ihc_intensity_{marker}','1+')
                    cur.execute("""
                        INSERT INTO IHC_Results (report_id,marker_name,result,intensity)
                        VALUES (%s,%s,%s,%s)
                    """, (report_id, marker, result, intensity))

            # ── Morphological Features ────────────────────────
            morph_fields = {
                'cell_arrangement':        f.get('cell_arrangement'),
                'nuclear_grade':           f.get('nuclear_grade'),
                'mitotic_activity':        f.get('mitotic_activity'),
                'necrosis':                f.get('necrosis'),
                'lymphovascular_invasion': f.get('lymphovascular_invasion'),
                'differentiation':         f.get('differentiation'),
            }
            for ftype, fval in morph_fields.items():
                if fval:
                    cur.execute("""
                        INSERT INTO Morphological_Features
                        (report_id,feature_type,feature_value)
                        VALUES (%s,%s,%s)
                    """, (report_id, ftype, fval))

            # ── Audit log ─────────────────────────────────────
            cur.execute("""
                INSERT INTO Case_Audit_Logs
                (case_id,action,old_status,new_status,performed_by)
                VALUES (%s,'NEW_CASE',NULL,'REPORTED',%s)
            """, (case_id, session['user_id']))

            conn.commit()
            conn.close()
            success = True

        except Exception as e:
            error = str(e)

    return render_template('add_case.html',
        success=success, error=error,
        case_number=case_number, report_id=report_id)

# ================================================================
# PASTE ALL THESE ROUTES INTO app.py
# Just before: if __name__ == '__main__':
# ================================================================

# ─── 1. FULL TEXT SEARCH ─────────────────────────────────────
@app.route('/search')
@login_required
def search():
    q          = request.args.get('q', '').strip()
    search_in  = request.args.get('search_in', 'all')
    results    = []

    if q:
        conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)

        # Build tsquery — handle multi-word search
        ts_query = ' & '.join(q.split())

        if search_in == 'patient':
            cur.execute("""
                SELECT DISTINCT r.report_id, p.full_name AS patient, p.age,
                       s.organ_site, r.diagnosis, r.category, c.case_number,
                       ts_rank(p.search_vector, to_tsquery('english',%s)) AS rank
                FROM Patients p
                JOIN Cases c     ON p.patient_id  = c.patient_id
                JOIN Specimens s ON c.case_id      = s.case_id
                JOIN Reports r   ON c.case_id      = r.case_id
                WHERE p.search_vector @@ to_tsquery('english',%s)
                   OR p.full_name ILIKE %s
                ORDER BY rank DESC
            """, (ts_query, ts_query, f'%{q}%'))
        else:
            field_filter = ""
            if search_in == 'diagnosis':
                field_filter = "AND r.diagnosis ILIKE %s"
            elif search_in == 'micro':
                field_filter = "AND r.microscopic_findings ILIKE %s"

            cur.execute(f"""
                SELECT DISTINCT r.report_id, p.full_name AS patient, p.age,
                       s.organ_site, r.diagnosis, r.category, c.case_number,
                       ts_rank(r.search_vector, to_tsquery('english',%s)) AS rank
                FROM Reports r
                JOIN Cases c     ON r.case_id     = c.case_id
                JOIN Specimens s ON c.case_id     = s.case_id
                JOIN Patients p  ON c.patient_id  = p.patient_id
                WHERE (
                    r.search_vector @@ to_tsquery('english',%s)
                    OR r.diagnosis ILIKE %s
                    OR r.microscopic_findings ILIKE %s
                    OR p.full_name ILIKE %s
                )
                ORDER BY rank DESC
            """, (ts_query, ts_query, f'%{q}%', f'%{q}%', f'%{q}%'))

        results = cur.fetchall()
        conn.close()

    return render_template('search.html', results=results, q=q, search_in=search_in)


# ─── 2. DIFFERENTIAL DIAGNOSIS ───────────────────────────────
@app.route('/differential', methods=['GET','POST'])
@login_required
def differential():
    results, form, total = None, {}, 0

    if request.method == 'POST':
        form    = request.form
        organ   = form.get('organ')
        marker1 = form.get('marker1')
        result1 = form.get('result1')
        marker2 = form.get('marker2') or None
        result2 = form.get('result2') or None
        marker3 = form.get('marker3') or None
        result3 = form.get('result3') or None

        conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT * FROM suggest_differential_diagnosis(%s,%s,%s,%s,%s,%s,%s)
        """, (organ, marker1, result1, marker2, result2, marker3, result3))
        results = cur.fetchall()
        total   = sum(r['case_count'] for r in results)
        conn.close()

    return render_template('differential.html',
        results=results, form=form, total=total,
        enumerate=enumerate)


# ─── 3. ANALYTICS ────────────────────────────────────────────
@app.route('/analytics')
@login_required
def analytics():
    conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT COUNT(*) AS c FROM Reports")
    total_cases = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM Reports WHERE category='Malignant'")
    malignant_count = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM Reports WHERE category='Benign'")
    benign_count = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM Reports WHERE category='Inflammatory'")
    inflammatory_count = cur.fetchone()['c']

    cur.execute("SELECT ROUND(AVG(age)::NUMERIC,1) AS a FROM Patients")
    avg_age = cur.fetchone()['a']

    cur.execute("SELECT * FROM diagnosis_distribution LIMIT 15")
    diagnoses = cur.fetchall()

    cur.execute("SELECT * FROM ihc_positivity_rates ORDER BY organ_site, positivity_rate DESC")
    ihc_rates = cur.fetchall()

    cur.execute("SELECT * FROM gender_distribution")
    gender_dist = cur.fetchall()

    conn.close()
    return render_template('analytics.html',
        total_cases=total_cases, malignant_count=malignant_count,
        benign_count=benign_count, inflammatory_count=inflammatory_count,
        avg_age=avg_age, diagnoses=diagnoses,
        ihc_rates=ihc_rates, gender_dist=gender_dist)


# ─── 4. PDF EXPORT ───────────────────────────────────────────
@app.route('/export_pdf/<report_id>')
@login_required
def export_pdf(report_id):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from io import BytesIO
        from flask import Response

        conn = get_db(); cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT r.report_id, p.full_name AS patient, p.age, p.gender,
                   p.uhid, s.organ_site, s.collection_date, s.fixation_type,
                   s.biopsy_type, r.diagnosis, r.icd_code, r.category,
                   r.microscopic_findings, r.synoptic_data, r.signed_at,
                   u.full_name AS pathologist, c.case_number, c.priority
            FROM Reports r
            JOIN Cases c    ON r.case_id      = c.case_id
            JOIN Patients p ON c.patient_id   = p.patient_id
            JOIN Specimens s ON c.case_id     = s.case_id
            JOIN Users u    ON r.pathologist_id = u.user_id
            WHERE r.report_id = %s
        """, (report_id,))
        report = cur.fetchone()

        cur.execute("SELECT marker_name, result, intensity FROM IHC_Results WHERE report_id=%s", (report_id,))
        ihc = cur.fetchall()

        cur.execute("SELECT feature_type, feature_value FROM Morphological_Features WHERE report_id=%s", (report_id,))
        morph = cur.fetchall()
        conn.close()

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                rightMargin=2*cm, leftMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story  = []

        # Header
        header_style = ParagraphStyle('header', fontSize=16, fontName='Helvetica-Bold',
                                      alignment=TA_CENTER, textColor=colors.HexColor('#0f2d52'))
        sub_style    = ParagraphStyle('sub', fontSize=10, alignment=TA_CENTER, textColor=colors.grey)
        normal       = ParagraphStyle('normal', fontSize=9, leading=14)
        bold         = ParagraphStyle('bold', fontSize=9, fontName='Helvetica-Bold')
        section      = ParagraphStyle('section', fontSize=11, fontName='Helvetica-Bold',
                                      textColor=colors.HexColor('#0f2d52'), spaceAfter=6)

        story.append(Paragraph("HISTOPATHOLOGY REPORT", header_style))
        story.append(Paragraph("HistoPath CMS — Case & Report Management System", sub_style))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0f2d52')))
        story.append(Spacer(1, 0.3*cm))

        # Case info table
        case_data = [
            ['Case Number:', report['case_number'], 'Priority:', report['priority']],
            ['Patient Name:', report['patient'], 'UHID:', report['uhid']],
            ['Age / Gender:', f"{report['age']} yrs / {report['gender']}", 'Organ Site:', report['organ_site']],
            ['Biopsy Type:', report['biopsy_type'], 'Collection Date:', str(report['collection_date'])],
            ['Fixation:', report['fixation_type'], 'Pathologist:', report['pathologist']],
            ['Signed At:', str(report['signed_at'])[:19] if report['signed_at'] else 'Pending', '', ''],
        ]
        t = Table(case_data, colWidths=[3.5*cm, 6*cm, 3.5*cm, 4*cm])
        t.setStyle(TableStyle([
            ('FONTNAME',  (0,0),(-1,-1), 'Helvetica'),
            ('FONTNAME',  (0,0),(0,-1),  'Helvetica-Bold'),
            ('FONTNAME',  (2,0),(2,-1),  'Helvetica-Bold'),
            ('FONTSIZE',  (0,0),(-1,-1), 9),
            ('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.white, colors.HexColor('#f4f6fb')]),
            ('GRID',      (0,0),(-1,-1), 0.5, colors.HexColor('#e0e7f0')),
            ('PADDING',   (0,0),(-1,-1), 5),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.4*cm))

        # Diagnosis
        story.append(Paragraph("DIAGNOSIS", section))
        diag_data = [
            ['Diagnosis:', report['diagnosis']],
            ['ICD Code:', report['icd_code'] or 'N/A'],
            ['Category:', report['category']],
        ]
        dt = Table(diag_data, colWidths=[4*cm, 13*cm])
        dt.setStyle(TableStyle([
            ('FONTNAME', (0,0),(0,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0),(-1,-1), 9),
            ('BACKGROUND', (0,0),(-1,0), colors.HexColor('#fde8e8')),
            ('GRID', (0,0),(-1,-1), 0.5, colors.HexColor('#e0e7f0')),
            ('PADDING', (0,0),(-1,-1), 5),
        ]))
        story.append(dt)
        story.append(Spacer(1, 0.3*cm))

        # Gross description
        gross = report['synoptic_data'].get('gross_description','N/A') if report['synoptic_data'] else 'N/A'
        story.append(Paragraph("GROSS DESCRIPTION", section))
        story.append(Paragraph(gross, normal))
        story.append(Spacer(1, 0.3*cm))

        # Microscopic
        story.append(Paragraph("MICROSCOPIC FINDINGS", section))
        story.append(Paragraph(report['microscopic_findings'] or 'N/A', normal))
        story.append(Spacer(1, 0.3*cm))

        # IHC
        if ihc:
            story.append(Paragraph("IHC PANEL RESULTS", section))
            ihc_data = [['Marker', 'Result', 'Intensity']]
            for i in ihc:
                ihc_data.append([i['marker_name'], i['result'], i['intensity']])
            it = Table(ihc_data, colWidths=[5*cm, 7*cm, 5*cm])
            it.setStyle(TableStyle([
                ('BACKGROUND', (0,0),(-1,0), colors.HexColor('#0f2d52')),
                ('TEXTCOLOR',  (0,0),(-1,0), colors.white),
                ('FONTNAME',   (0,0),(-1,0), 'Helvetica-Bold'),
                ('FONTSIZE',   (0,0),(-1,-1), 9),
                ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white, colors.HexColor('#f4f6fb')]),
                ('GRID',       (0,0),(-1,-1), 0.5, colors.HexColor('#e0e7f0')),
                ('PADDING',    (0,0),(-1,-1), 5),
            ]))
            story.append(it)
            story.append(Spacer(1, 0.3*cm))

        # Morphological features
        if morph:
            story.append(Paragraph("MORPHOLOGICAL FEATURES", section))
            morph_data = [['Feature', 'Value']]
            for m in morph:
                morph_data.append([m['feature_type'].replace('_',' ').title(), m['feature_value']])
            mt = Table(morph_data, colWidths=[8*cm, 9*cm])
            mt.setStyle(TableStyle([
                ('BACKGROUND', (0,0),(-1,0), colors.HexColor('#0f2d52')),
                ('TEXTCOLOR',  (0,0),(-1,0), colors.white),
                ('FONTNAME',   (0,0),(-1,0), 'Helvetica-Bold'),
                ('FONTSIZE',   (0,0),(-1,-1), 9),
                ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white, colors.HexColor('#f4f6fb')]),
                ('GRID',       (0,0),(-1,-1), 0.5, colors.HexColor('#e0e7f0')),
                ('PADDING',    (0,0),(-1,-1), 5),
            ]))
            story.append(mt)

        # Footer
        story.append(Spacer(1, 0.5*cm))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        story.append(Paragraph(
            f"Signed by: {report['pathologist']} | Generated by HistoPath CMS",
            ParagraphStyle('footer', fontSize=8, textColor=colors.grey, alignment=TA_CENTER)
        ))

        doc.build(story)
        buffer.seek(0)

        return Response(
            buffer,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment;filename={report["case_number"]}_report.pdf'}
        )

    except ImportError:
        return "Please install reportlab: pip install reportlab", 500


if __name__ == '__main__':
    app.run(debug=True)
