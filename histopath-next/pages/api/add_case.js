const { pool } = require('../../lib/db');
const { withAuth } = require('../../lib/auth');
const { v4: uuidv4 } = require('uuid');

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const f = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE histo_pathologist');
    // Patient
    const pid = uuidv4();
    await client.query(
      'INSERT INTO Patients (patient_id,uhid,full_name,age,gender,contact) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (uhid) DO NOTHING',
      [pid, f.uhid, f.patient_name, parseInt(f.age), f.gender, f.contact||'N/A']
    );
    const patRes = await client.query('SELECT patient_id FROM Patients WHERE uhid=$1', [f.uhid]);
    const patient_id = patRes.rows[0].patient_id;

    // Case
    const case_id = uuidv4();
    const case_number = `HISTO-${new Date().getFullYear()}-${Math.floor(1000+Math.random()*9000)}`;
    await client.query(
      "INSERT INTO Cases (case_id,case_number,patient_id,status,priority) VALUES ($1,$2,$3,'REPORTED',$4)",
      [case_id, case_number, patient_id, f.priority]
    );

    // Specimen
    await client.query(
      'INSERT INTO Specimens (case_id,organ_site,biopsy_type,fixation_type,collection_date) VALUES ($1,$2,$3,$4,$5)',
      [case_id, f.organ_site, f.biopsy_type, f.fixation_type, f.collection_date]
    );

    // Report
    const report_id = uuidv4();
    const synoptic = JSON.stringify({ gross_description: f.gross_desc || '' });
    // Embedding (same model as the stored data); null if the service is down
    let embedding = null;
    try {
      const er = await fetch('http://localhost:5001/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${f.microscopic_desc} Diagnosis: ${f.diagnosis}` }),
      });
      if (er.ok) embedding = '[' + (await er.json()).embedding.join(',') + ']';
    } catch (_) { /* service not running */ }

    await client.query(
      `INSERT INTO Reports (report_id,case_id,pathologist_id,microscopic_findings,
       diagnosis,icd_code,category,synoptic_data,is_signed,embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,FALSE,$9::vector)`,
      [report_id, case_id, req.user.user_id, f.microscopic_desc,
       f.diagnosis, f.icd_code||'', f.category, synoptic, embedding]
    );

    // IHC Results
    const IHC_MARKERS = ['ER','PR','HER2','Ki-67','CK5/6','CDX2','CK20','MLH1','MSH2','CD20','CD3','TTF-1'];
    for (const marker of IHC_MARKERS) {
      const result = f[`ihc_result_${marker}`];
      if (result && result !== '') {
        await client.query(
          'INSERT INTO IHC_Results (report_id,marker_name,result,intensity) VALUES ($1,$2,$3,$4)',
          [report_id, marker, result, f[`ihc_intensity_${marker}`]||'1+']
        );
      }
    }

    // Morphological Features
    const morphFields = ['cell_arrangement','nuclear_grade','mitotic_activity','necrosis','lymphovascular_invasion','differentiation'];
    for (const field of morphFields) {
      if (f[field] && f[field] !== '') {
        await client.query(
          'INSERT INTO Morphological_Features (report_id,feature_type,feature_value) VALUES ($1,$2,$3)',
          [report_id, field, f[field]]
        );
      }
    }

    // Audit log
    await client.query(
      "INSERT INTO Case_Audit_Logs (case_id,action,old_status,new_status,performed_by) VALUES ($1,'NEW_CASE',NULL,'REPORTED',$2)",
      [case_id, req.user.user_id]
    );

    await client.query('COMMIT');
    res.status(200).json({ success: true, case_number, report_id });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}

export default withAuth(handler, ['PATHOLOGIST']);
