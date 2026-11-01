import { apiFetch } from '../lib/api';
import { useState } from 'react';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Link from 'next/link';

const MARKERS = ['ER','PR','HER2','Ki-67','CK5/6','CDX2','CK20','MLH1','MSH2','CK7','CD20','CD3','CD10','BCL2'];
const RESULTS  = ['Positive','Negative','1+','2+','3+','Intact','Lost','Low (<15%)','High (>15%)','Low (<30%)','High (>30%)'];

export default function Similar() {
  const [mode, setMode]         = useState('ihc');
  const [organ, setOrgan]       = useState('Breast');
  const [category, setCategory] = useState('Malignant');
  const [marker, setMarker]     = useState('ER');
  const [result, setResult]     = useState('Positive');
  const [queryText, setQueryText] = useState('');
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const body = mode === 'semantic'
      ? { mode: 'semantic', query_text: queryText }
      : { mode: 'ihc', organ, category, marker, result };
    const res = await apiFetch('/api/similar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setResults(await res.json());
    setLoading(false);
  };

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>🔍</span><h1>Similar Case Retrieval Engine</h1></div>

        <div className="card">
          <div style={{display:'flex',gap:'10px',marginBottom:'20px'}}>
            {['ihc','semantic'].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{
                padding:'8px 22px', borderRadius:'8px', cursor:'pointer',
                border: `2px solid ${mode===m?'#2196f3':'#e0e7f0'}`,
                background: mode===m?'#e3f2fd':'#fff',
                color: mode===m?'#2196f3':'#6b7a99', fontWeight:600, fontSize:'.85rem'
              }}>
                {m==='ihc'?'🧪 IHC Marker Search':'🤖 Semantic Search (AI)'}
              </button>
            ))}
          </div>

          {mode === 'ihc' ? (
            <div className="form-grid">
              <div className="form-group">
                <label>Organ Site</label>
                <select value={organ} onChange={e=>setOrgan(e.target.value)}>
                  {['Breast','Colon','Lymph Node'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Diagnosis Category</label>
                <select value={category} onChange={e=>setCategory(e.target.value)}>
                  {['Malignant','Benign','Inflammatory','Reactive'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>IHC Marker</label>
                <select value={marker} onChange={e=>setMarker(e.target.value)}>
                  {MARKERS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>IHC Result</label>
                <select value={result} onChange={e=>setResult(e.target.value)}>
                  {RESULTS.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="form-group" style={{marginBottom:'16px'}}>
              <label>Describe the case in your own words</label>
              <textarea rows={3} value={queryText} onChange={e=>setQueryText(e.target.value)}
                placeholder="e.g. infiltrating ductal carcinoma solid growth pattern high mitotic activity ER positive..."
                style={{resize:'vertical'}}/>
              <p style={{fontSize:'.78rem',color:'#6b7a99',marginTop:'6px'}}>
                💡 Sentence-transformer (all-MiniLM-L6-v2) embeddings + pgvector cosine similarity
              </p>
            </div>
          )}

          <button onClick={handleSearch} className="btn btn-primary"
            style={{padding:'11px 28px',fontSize:'.9rem'}} disabled={loading}>
            {loading ? 'Searching...' : '🔍 Find Similar Cases'}
          </button>
        </div>

        {results !== null && (
          results.length > 0 ? (
            <>
              <div className="result-banner success">✅ {results.length} similar case(s) found</div>
              <div className="card">
                <table>
                  <thead><tr>
                    <th>Patient</th><th>Age</th><th>Organ</th><th>Diagnosis</th>
                    <th>Category</th>
                    {mode==='semantic'?<th>Score</th>:<><th>Marker</th><th>Result</th></>}
                    <th>Date</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {results.map(r=>(
                      <tr key={r.report_id}>
                        <td>{r.patient_name}</td>
                        <td>{r.age}</td>
                        <td>{r.organ_site}</td>
                        <td>{r.diagnosis}</td>
                        <td><Badge label={r.category}/></td>
                        {mode==='semantic'
                          ? <td><span style={{color:'#2196f3',fontWeight:700}}>
                              {r.similarity_score==null ? 'keyword match' : (parseFloat(r.similarity_score)*100).toFixed(1)+'%'}
                            </span></td>
                          : <><td>{r.marker_name}</td>
                            <td>{['Positive','Intact'].includes(r.ihc_result)
                              ?<span className="pos">{r.ihc_result}</span>
                              :<span className="neg">{r.ihc_result}</span>}</td></>
                        }
                        <td>{r.signed_at?String(r.signed_at).slice(0,10):'—'}</td>
                        <td><Link href={`/report/${r.report_id}`} className="btn btn-primary"
                          style={{fontSize:'.75rem',padding:'5px 10px'}}>View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="result-banner error">❌ No similar cases found.</div>
          )
        )}
      </div>
    </>
  );
}
