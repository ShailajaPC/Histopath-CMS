import { apiFetch } from '../lib/api';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Link from 'next/link';

const IHC_MARKERS = ['ER','PR','HER2','Ki-67','CK5/6','CDX2','CK20','MLH1','MSH2','CD20','CD3','TTF-1'];
const RESULTS = ['','Positive','Negative','1+','2+','3+','Intact','Lost','Low (<15%)','High (>15%)'];

export default function AddCase() {
  const [form, setForm] = useState({
    patient_name:'', uhid:'', age:'', gender:'Female', contact:'',
    organ_site:'Breast', biopsy_type:'Core Needle Biopsy',
    fixation_type:'Formalin Fixed Paraffin Embedded (FFPE)',
    collection_date:'', priority:'ROUTINE',
    diagnosis:'', icd_code:'', category:'Malignant',
    gross_desc:'', microscopic_desc:'',
    cell_arrangement:'', nuclear_grade:'', mitotic_activity:'',
    necrosis:'', lymphovascular_invasion:'', differentiation:'',
  });
  const [ihc, setIhc] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [paths, setPaths]   = useState([]);
  const [success, setSuccess] = useState(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    apiFetch('/api/reports').then(r=>r.json()).then(()=>{});
    // Get pathologist from token
    const name = localStorage.getItem('hp_name');
    setForm(f=>({...f, pathologist_name: name}));
    if (localStorage.getItem('hp_role') === 'ADMIN') {
      setIsAdmin(true);
      apiFetch('/api/pathologists').then(r=>r.json()).then(d => Array.isArray(d) && setPaths(d));
    }
  }, []);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('hp_token');
    // Decode JWT to get user_id
    const body = { ...form };   // pathologist id now comes from the login token on the server
    IHC_MARKERS.forEach(m => {
      body[`ihc_result_${m}`]    = ihc[`result_${m}`] || '';
      body[`ihc_intensity_${m}`] = ihc[`intensity_${m}`] || '1+';
    });
    const res = await apiFetch('/api/add_case', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setSuccess(data);
  };

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>➕</span><h1>Add New Case & Report</h1></div>

        {success && (
          <div className="result-banner success">
            ✅ Case {success.case_number} created!{' '}
            <Link href={`/report/${success.report_id}`} style={{color:'#2e7d32',fontWeight:700}}>View Report →</Link>
          </div>
        )}
        {error && <div className="result-banner error">❌ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="card">
            {isAdmin && (
              <div className="form-group" style={{marginBottom:'18px'}}>
                <label>Assign to pathologist * (they will review and sign the report)</label>
                <select required value={form.pathologist_id||''} onChange={e=>set('pathologist_id',e.target.value)}>
                  <option value="">— choose pathologist —</option>
                  {paths.map(p=><option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                </select>
              </div>
            )}
            <div className="card-title">👤 Patient Information</div>
            <div className="form-grid">
              {[['patient_name','Full Name','text','e.g. Priya Sharma',true],
                ['uhid','UHID','text','e.g. UHID-2024-001',true],
                ['age','Age','number','e.g. 45',true],
                ['contact','Contact','text','e.g. 9876543210',false]].map(([k,l,t,p,req])=>(
                <div key={k} className="form-group">
                  <label>{l}</label>
                  <input type={t} placeholder={p} required={req}
                    value={form[k]} onChange={e=>set(k,e.target.value)}/>
                </div>
              ))}
              <div className="form-group">
                <label>Gender</label>
                <select value={form.gender} onChange={e=>set('gender',e.target.value)}>
                  {['Female','Male','Other'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">🧫 Specimen Details</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Organ Site</label>
                <select value={form.organ_site} onChange={e=>set('organ_site',e.target.value)}>
                  {['Breast','Colon','Lymph Node','Lung','Thyroid','Cervix','Skin','Prostate','Other'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Biopsy Type</label>
                <select value={form.biopsy_type} onChange={e=>set('biopsy_type',e.target.value)}>
                  {['Core Needle Biopsy','Excision Biopsy','Incision Biopsy','FNAC','Mastectomy','Colectomy'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Collection Date</label>
                <input type="date" required value={form.collection_date} onChange={e=>set('collection_date',e.target.value)}/>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={form.priority} onChange={e=>set('priority',e.target.value)}>
                  <option value="ROUTINE">Routine</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">📝 Report</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Diagnosis *</label>
                <input required value={form.diagnosis} onChange={e=>set('diagnosis',e.target.value)}
                  placeholder="e.g. Invasive Ductal Carcinoma"/>
              </div>
              <div className="form-group">
                <label>ICD Code</label>
                <input value={form.icd_code} onChange={e=>set('icd_code',e.target.value)} placeholder="e.g. C50.9"/>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e=>set('category',e.target.value)}>
                  {['Malignant','Benign','Inflammatory','Reactive','Other'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{marginTop:'12px'}}>
              <label>Gross Description</label>
              <textarea rows={3} value={form.gross_desc} onChange={e=>set('gross_desc',e.target.value)}
                placeholder="e.g. Mastectomy specimen weighing 280g..." style={{resize:'vertical'}}/>
            </div>
            <div className="form-group" style={{marginTop:'12px'}}>
              <label>Microscopic Findings *</label>
              <textarea rows={4} required value={form.microscopic_desc} onChange={e=>set('microscopic_desc',e.target.value)}
                placeholder="e.g. Sections show infiltrating malignant epithelial cells..." style={{resize:'vertical'}}/>
            </div>
          </div>

          <div className="card">
            <div className="card-title">🧪 IHC Panel</div>
            <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Marker</th><th>Result</th><th>Intensity</th></tr></thead>
              <tbody>
                {IHC_MARKERS.map(m=>(
                  <tr key={m}>
                    <td><strong>{m}</strong></td>
                    <td>
                      <select value={ihc[`result_${m}`]||''} onChange={e=>setIhc(h=>({...h,[`result_${m}`]:e.target.value}))}>
                        {RESULTS.map(r=><option key={r} value={r}>{r||'— Not Done —'}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={ihc[`intensity_${m}`]||'1+'} onChange={e=>setIhc(h=>({...h,[`intensity_${m}`]:e.target.value}))}>
                        {['1+','2+','3+'].map(r=><option key={r}>{r}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">🔬 Morphological Features</div>
            <div className="form-grid">
              {[['cell_arrangement','Cell Arrangement',['','acinar','solid sheets','trabecular','cribriform','glandular','mucinous','diffuse','follicular','nodular']],
                ['nuclear_grade','Nuclear Grade',['','Grade 1','Grade 2','Grade 3']],
                ['mitotic_activity','Mitotic Activity',['','Low','Moderate','High']],
                ['necrosis','Necrosis',['','Present','Absent']],
                ['lymphovascular_invasion','Lymphovascular Invasion',['','Present','Absent']],
                ['differentiation','Differentiation',['','Well','Moderately','Poorly']]].map(([k,l,opts])=>(
                <div key={k} className="form-group">
                  <label>{l}</label>
                  <select value={form[k]} onChange={e=>set(k,e.target.value)}>
                    {opts.map(o=><option key={o} value={o}>{o||'— Select —'}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'flex',gap:'12px',marginBottom:'30px'}}>
            <button type="submit" className="btn btn-primary"
              style={{padding:'13px 32px',fontSize:'1rem'}}>➕ Submit New Case</button>
            <Link href="/reports" className="btn btn-accent" style={{padding:'13px 24px'}}>Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
