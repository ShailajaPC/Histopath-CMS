# load_data.py
# Loads TCGA data into PostgreSQL with pgvector embeddings
# Run: python scripts/load_data.py

import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
import random
import uuid
from datetime import date, timedelta
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

print("Loading sentence-transformer model...")
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Model loaded!")

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw')

# ─── Connect ──────────────────────────────────────────────────
conn = psycopg2.connect(**DB_CONFIG)
cur  = conn.cursor()

# ─── Load TCGA files ──────────────────────────────────────────
brca = pd.read_csv(f"{RAW}/brca_tcga_clinical_data.tsv", sep="\t", low_memory=False).head(20)
coad = pd.read_csv(f"{RAW}/coadread_tcga_clinical_data.tsv", sep="\t", low_memory=False).head(20)
dlbc = pd.read_csv(f"{RAW}/dlbc_tcga_clinical_data.tsv", sep="\t", low_memory=False).head(20)

# ─── Diagnosis maps ───────────────────────────────────────────
DIAGNOSES = {
    'Breast': [
        ('Invasive Ductal Carcinoma',    'C50.9', 'Malignant'),
        ('Invasive Lobular Carcinoma',   'C50.9', 'Malignant'),
        ('Ductal Carcinoma In Situ',     'D05.1', 'Malignant'),
        ('Fibroadenoma',                 'D24',   'Benign'),
    ],
    'Colon': [
        ('Colon Adenocarcinoma',         'C18.2', 'Malignant'),
        ('Mucinous Adenocarcinoma',      'C18.9', 'Malignant'),
        ('Tubular Adenoma',              'D12.6', 'Benign'),
        ('Inflammatory Bowel Disease',   'K51.9', 'Inflammatory'),
    ],
    'Lymph Node': [
        ('Diffuse Large B-Cell Lymphoma','C83.3', 'Malignant'),
        ('Follicular Lymphoma',          'C82.9', 'Malignant'),
        ('Reactive Lymphadenopathy',     'L04.9', 'Reactive'),
        ('Hodgkin Lymphoma',             'C81.9', 'Malignant'),
    ]
}

IHC_PANELS = {
    'Breast':     [('ER',['Positive','Negative']),('PR',['Positive','Negative']),
                   ('HER2',['1+','2+','3+','Negative']),('Ki-67',['Low (<15%)','High (>15%)']),('CK5/6',['Positive','Negative'])],
    'Colon':      [('CDX2',['Positive','Negative']),('CK20',['Positive','Negative']),
                   ('MLH1',['Intact','Lost']),('MSH2',['Intact','Lost']),('CK7',['Positive','Negative'])],
    'Lymph Node': [('CD20',['Positive','Negative']),('CD3',['Positive','Negative']),
                   ('CD10',['Positive','Negative']),('BCL2',['Positive','Negative']),('Ki-67',['Low (<30%)','High (>30%)'])]
}

MORPH = {
    'Breast':     [('cell_arrangement',['acinar','solid sheets','trabecular','cribriform']),
                   ('nuclear_grade',   ['Grade 1','Grade 2','Grade 3']),
                   ('mitotic_activity',['Low','Moderate','High']),
                   ('necrosis',        ['Present','Absent'])],
    'Colon':      [('cell_arrangement',['glandular','mucinous','signet ring']),
                   ('differentiation', ['Well','Moderately','Poorly']),
                   ('lymphovascular_invasion',['Present','Absent']),
                   ('perineural_invasion',    ['Present','Absent'])],
    'Lymph Node': [('infiltration_pattern',['diffuse','follicular','nodular']),
                   ('cell_size',           ['Small','Large','Mixed']),
                   ('starry_sky',          ['Present','Absent']),
                   ('necrosis',            ['Present','Absent'])],
}

GROSS_TMPL = {
    'Breast':     "Mastectomy specimen weighing {w}g. Cut surface shows a grey-white firm mass measuring {s}cm with irregular margins. Nipple and overlying skin unremarkable.",
    'Colon':      "Segment of colon measuring {w}cm in length. Mucosa shows an ulceroproliferative growth measuring {s}cm. Proximal and distal surgical margins taken.",
    'Lymph Node': "Multiple lymph nodes largest measuring {s}cm. Cut surface is grey-white and homogeneous. No areas of necrosis grossly."
}

MICRO_TMPL = {
    'Breast':     "Sections show infiltrating malignant epithelial cells arranged in {arr} pattern. Nuclei show pleomorphism with prominent nucleoli. Mitotic figures {mit}. Surrounding stroma is desmoplastic. Lymphovascular invasion {lvi}.",
    'Colon':      "Sections show {arr} glands lined by columnar cells with hyperchromatic nuclei and loss of polarity. {lvi} lymphovascular invasion noted. Differentiation is {diff}. Surgical margins are clear.",
    'Lymph Node': "Lymph node architecture is {arch}. Large lymphoid cells with vesicular nuclei and prominent nucleoli arranged in {arr} pattern. Mitotic activity {mit}. Starry sky pattern {sky}."
}

# Get pathologist IDs
cur.execute("SELECT user_id FROM Users WHERE role='PATHOLOGIST' ORDER BY full_name")
pathologist_ids = [row[0] for row in cur.fetchall()]

# Real ER/PR/HER2 from TCGA
er_real  = brca['ER Status By IHC'].tolist()
pr_real  = brca['PR status by ihc'].tolist()
her2_real= brca['IHC-HER2'].tolist()

case_num = 1
datasets = [(brca,'Breast'),(coad,'Colon'),(dlbc,'Lymph Node')]

for df, organ in datasets:
    print(f"\nLoading {organ} cases...")
    for i, (_, row) in enumerate(df.iterrows()):
        # Patient
        patient_id = str(uuid.uuid4())
        uhid = str(row['Patient ID'])
        age  = int(row['Diagnosis Age']) if pd.notna(row.get('Diagnosis Age')) else 50
        sex  = row.get('Sex','')
        gender = 'Female' if str(sex).lower() in ['female','f'] else 'Male'

        cur.execute("""
            INSERT INTO Patients (patient_id,uhid,full_name,age,gender,contact)
            VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (uhid) DO NOTHING
        """, (patient_id, uhid, uhid, age, gender, 'N/A'))

        # Case
        case_id = str(uuid.uuid4())
        case_number = f"HISTO-2024-{case_num:04d}"
        priority = 'URGENT' if random.random() < 0.2 else 'ROUTINE'
        acc_dt   = date(2020 + random.randint(0,3), random.randint(1,12), random.randint(1,28))
        acc_date = acc_dt.isoformat()

        cur.execute("""
            INSERT INTO Cases (case_id,case_number,patient_id,status,priority,accessioned_at)
            VALUES (%s,%s,%s,'SIGNED',%s,%s)
        """, (case_id, case_number, patient_id, priority, acc_date))

        # Specimen
        cur.execute("""
            INSERT INTO Specimens (case_id,organ_site,biopsy_type,collection_date)
            VALUES (%s,%s,%s,%s)
        """, (case_id, organ, 'Core Needle Biopsy', acc_date))

        # Report
        diag_name, icd, category = random.choice(DIAGNOSES[organ])
        w   = random.randint(20,300)
        s   = round(random.uniform(1.0,8.0),1)
        arr = random.choice(['acinar','solid sheets','tubular','cribriform','diffuse','glandular'])
        mit = random.choice(['frequent','occasional','rare'])
        lvi = random.choice(['Present','Absent'])
        diff= random.choice(['Well','Moderately','Poorly'])
        arch= random.choice(['effaced','partially preserved','nodular'])
        sky = random.choice(['Present','Absent'])

        gross = GROSS_TMPL[organ].format(w=w,s=s)
        micro = MICRO_TMPL[organ].format(arr=arr,mit=mit,lvi=lvi,diff=diff,arch=arch,sky=sky)

        # Generate embedding from microscopic findings + diagnosis
        text_for_embedding = f"{micro} Diagnosis: {diag_name}"
        embedding = model.encode(text_for_embedding).tolist()

        path_id  = pathologist_ids[i % len(pathologist_ids)]
        report_id= str(uuid.uuid4())
        # signed 1-5 days after accession (URGENT cases are faster) so TAT figures are realistic
        sign_date= (acc_dt + timedelta(days=random.randint(1,2) if priority=='URGENT' else random.randint(2,5))).isoformat()

        # Synoptic JSONB
        synoptic = {
            "gross_description": gross,
            "specimen_weight_g": w,
            "tumor_size_cm": s
        }

        cur.execute("""
            INSERT INTO Reports
            (report_id,case_id,pathologist_id,microscopic_findings,diagnosis,
             icd_code,category,synoptic_data,is_signed,signed_at,embedding)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,TRUE,%s,%s::vector)
        """, (report_id, case_id, path_id, micro, diag_name,
              icd, category, str(synoptic).replace("'",'"'),
              sign_date, str(embedding)))

        # IHC Results
        for marker, options in IHC_PANELS[organ]:
            result = random.choice(options)
            if organ=='Breast' and i < len(er_real):
                if marker=='ER'   and pd.notna(er_real[i]):   result=str(er_real[i])
                if marker=='PR'   and pd.notna(pr_real[i]):   result=str(pr_real[i])
                if marker=='HER2' and pd.notna(her2_real[i]): result=str(her2_real[i])
            cur.execute("""
                INSERT INTO IHC_Results (report_id,marker_name,result,intensity)
                VALUES (%s,%s,%s,%s)
            """, (report_id, marker, result, random.choice(['1+','2+','3+'])))

        # Morphological features
        for ftype, fopts in MORPH[organ]:
            cur.execute("""
                INSERT INTO Morphological_Features (report_id,feature_type,feature_value)
                VALUES (%s,%s,%s)
            """, (report_id, ftype, random.choice(fopts)))

        case_num += 1

    print(f"  ✅ {organ}: 20 cases loaded")

# Sample addendum
cur.execute("SELECT report_id FROM Reports LIMIT 1")
first_report = cur.fetchone()[0]
cur.execute("SELECT user_id FROM Users WHERE role='PATHOLOGIST' LIMIT 1")
first_path = cur.fetchone()[0]

# Must disable trigger temporarily for sample addendum
cur.execute("""
    INSERT INTO Report_Addenda (report_id,author_id,revision_note,old_diagnosis,new_diagnosis)
    VALUES (%s,%s,%s,%s,%s)
""", (first_report, first_path,
      'IHC pattern more consistent with lobular phenotype after MDT review',
      'Invasive Ductal Carcinoma', 'Invasive Lobular Carcinoma'))

conn.commit()
cur.close()
conn.close()

print("\n🎉 All 60 cases loaded with vector embeddings!")
print("   Run: python app/app.py to start the web interface")
