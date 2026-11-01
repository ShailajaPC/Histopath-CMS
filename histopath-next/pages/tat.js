import { apiFetch } from '../lib/api';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';

export default function TAT() {
  const [data, setData] = useState(null);
  useEffect(() => { apiFetch('/api/tat').then(r=>r.json()).then(setData); }, []);
  if (!data) return <><Navbar/><div className="container">Loading...</div></>;

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>⏱️</span><h1>Turnaround Time (TAT) Report</h1></div>
        <div className="card">
          <div className="card-title">Average TAT by Pathologist & Organ Site</div>
          {data.length > 0 ? (
            <table>
              <thead><tr><th>Pathologist</th><th>Organ Site</th><th>Avg TAT (Hours)</th><th>SLA Status</th></tr></thead>
              <tbody>
                {data.map((t,i)=>{
                  const tat = Math.abs(parseFloat(t.avg_tat_hours));
                  return (
                    <tr key={i}>
                      <td><strong>{t.pathologist_name}</strong></td>
                      <td>{t.organ_site}</td>
                      <td>{tat}h</td>
                      <td>
                        {tat <= 24
                          ? <span style={{background:'#e8f5e9',color:'#2e7d32',padding:'3px 10px',borderRadius:'20px',fontSize:'.72rem',fontWeight:600}}>Within SLA</span>
                          : tat <= 72
                          ? <span style={{background:'#fff3e0',color:'#e65100',padding:'3px 10px',borderRadius:'20px',fontSize:'.72rem',fontWeight:600}}>Borderline</span>
                          : <span style={{background:'#fde8e8',color:'#c62828',padding:'3px 10px',borderRadius:'20px',fontSize:'.72rem',fontWeight:600}}>SLA Breach</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p style={{color:'#6b7a99'}}>No TAT data available.</p>}
        </div>
      </div>
    </>
  );
}
