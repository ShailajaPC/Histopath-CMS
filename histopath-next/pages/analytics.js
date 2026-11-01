import { apiFetch } from '../lib/api';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';

export default function Analytics() {
  const [data, setData] = useState(null);
  useEffect(() => { apiFetch('/api/analytics').then(r=>r.json()).then(setData); }, []);
  if (!data) return <><Navbar/><div className="container">Loading...</div></>;

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>📊</span><h1>Case Analytics & Statistics</h1></div>

        <div className="stats">
          {[['Total Cases',data.total_cases,'#0f2d52'],
            ['Malignant',data.malignant_count,'#c62828'],
            ['Benign',data.benign_count,'#2e7d32'],
            ['Inflammatory',data.inflammatory_count,'#e65100'],
            ['Avg Patient Age',data.avg_age+' yrs','#6a1b9a']].map(([l,v,c])=>(
            <div key={l} className="stat-card" style={{borderTopColor:c}}>
              <div className="number" style={{color:c}}>{v}</div>
              <div className="label">{l}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">📋 Top Diagnoses by Frequency</div>
          <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Diagnosis</th><th>Organ</th><th>Category</th><th>Cases</th><th>Avg Age</th><th>Bar</th></tr></thead>
            <tbody>
              {data.diagnoses.map((d,i)=>(
                <tr key={i}>
                  <td><strong>{d.diagnosis}</strong></td>
                  <td>{d.organ_site}</td>
                  <td><Badge label={d.category}/></td>
                  <td>{d.case_count}</td>
                  <td>{d.avg_patient_age} yrs</td>
                  <td><div style={{background:'linear-gradient(90deg,#2196f3,#0f2d52)',
                    height:'10px',borderRadius:'5px',
                    width:`${Math.min(d.case_count*15,150)}px`}}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">🧪 IHC Marker Positivity Rates</div>
          <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Organ</th><th>Marker</th><th>Total Tested</th><th>Positive</th><th>Rate</th></tr></thead>
            <tbody>
              {data.ihc_rates.map((i,idx)=>(
                <tr key={idx}>
                  <td>{i.organ_site}</td>
                  <td><strong>{i.marker_name}</strong></td>
                  <td>{i.total_tested}</td>
                  <td>{i.positive_count}</td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <div style={{background:'linear-gradient(90deg,#e91e8c,#9c27b0)',
                        height:'8px',borderRadius:'4px',
                        width:`${Math.min(i.positivity_rate,100)}px`,maxWidth:'100px'}}/>
                      <span style={{fontWeight:700,color:'#0f2d52'}}>{i.positivity_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">👥 Gender Distribution</div>
          <table>
            <thead><tr><th>Organ</th><th>Gender</th><th>Cases</th><th>Avg Age</th></tr></thead>
            <tbody>
              {data.gender_dist.map((g,i)=>(
                <tr key={i}>
                  <td>{g.organ_site}</td><td>{g.gender}</td>
                  <td>{g.case_count}</td><td>{g.avg_age} yrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
