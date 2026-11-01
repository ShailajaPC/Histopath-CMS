import { apiFetch } from '../lib/api';
import { useState } from 'react';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';

const MARKERS = ['ER','PR','HER2','Ki-67','CK5/6','CDX2','CK20','MLH1','MSH2','CD20','CD3','CD10','BCL2'];
const RESULTS  = ['Positive','Negative','1+','2+','3+','Intact','Lost','Low (<15%)','High (>15%)'];

export default function Differential() {
  const [organ, setOrgan]   = useState('Breast');
  const [m1, setM1] = useState('ER');   const [r1, setR1] = useState('Positive');
  const [m2, setM2] = useState('');     const [r2, setR2] = useState('Positive');
  const [m3, setM3] = useState('');     const [r3, setR3] = useState('Positive');
  const [results, setResults] = useState(null);
  const [total, setTotal]     = useState(0);

  const handleSearch = async () => {
    const res = await apiFetch('/api/differential', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organ, marker1:m1, result1:r1,
        marker2:m2||null, result2:r2||null, marker3:m3||null, result3:r3||null }),
    });
    const data = await res.json();
    setResults(data);
    setTotal(data.reduce((s,r)=>s+parseInt(r.case_count),0));
  };

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>🧬</span><h1>Differential Diagnosis Suggester</h1></div>

        <div className="card">
          <div className="card-title">Enter IHC Profile — System suggests most likely diagnoses from past cases</div>
          <div className="form-grid" style={{marginBottom:'12px'}}>
            <div className="form-group">
              <label>Organ Site</label>
              <select value={organ} onChange={e=>setOrgan(e.target.value)}>
                {['Breast','Colon','Lymph Node'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{fontWeight:600,color:'#0f2d52',marginBottom:'12px'}}>IHC Markers (up to 3):</div>
          {[[m1,setM1,r1,setR1,'Marker 1 *'],[m2,setM2,r2,setR2,'Marker 2 (optional)'],[m3,setM3,r3,setR3,'Marker 3 (optional)']].map(([mv,ms,rv,rs,label],i)=>(
            <div key={i} className="form-grid" style={{marginBottom:'8px'}}>
              <div className="form-group">
                <label>{label}</label>
                <select value={mv} onChange={e=>ms(e.target.value)}>
                  {i>0 && <option value="">— None —</option>}
                  {MARKERS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Result {i+1}</label>
                <select value={rv} onChange={e=>rs(e.target.value)}>
                  {RESULTS.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          ))}
          <button onClick={handleSearch} className="btn btn-primary"
            style={{padding:'11px 28px',fontSize:'.9rem',marginTop:'8px'}}>
            🧬 Suggest Differential Diagnosis
          </button>
        </div>

        {results !== null && (
          results.length > 0 ? (
            <>
              <div className="result-banner success">✅ Based on {total} matching case(s)</div>
              <div className="card">
                <div className="card-title">📊 Differential Diagnosis — Most Likely (by frequency)</div>
                <table>
                  <thead><tr><th>Rank</th><th>Diagnosis</th><th>Cases</th><th>Probability</th><th>Avg Age</th><th>Category</th></tr></thead>
                  <tbody>
                    {results.map((r,i)=>(
                      <tr key={i}>
                        <td><strong>#{i+1}</strong></td>
                        <td><strong>{r.diagnosis}</strong></td>
                        <td>{r.case_count}</td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <div style={{background:`linear-gradient(90deg,#2196f3,#0f2d52)`,
                              height:'8px',borderRadius:'4px',
                              width:`${Math.min(parseFloat(r.percentage),100)}px`,maxWidth:'100px'}}/>
                            <span style={{fontWeight:700,color:'#2196f3'}}>{r.percentage}%</span>
                          </div>
                        </td>
                        <td>{r.avg_age} yrs</td>
                        <td><Badge label={r.common_category}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{marginTop:'14px',fontSize:'.78rem',color:'#6b7a99'}}>
                  ⚠️ Statistical suggestion based on past cases. Clinical judgment always takes precedence.
                </p>
              </div>
            </>
          ) : (
            <div className="result-banner error">❌ No matching cases found for this IHC profile.</div>
          )
        )}
      </div>
    </>
  );
}
