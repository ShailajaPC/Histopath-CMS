import { apiFetch } from '../lib/api';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Link from 'next/link';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch('/api/dashboard').then(r=>r.json()).then(setData);
  }, []);

  if (!data) return <><Navbar/><div className="container">Loading...</div></>;
  if (data.error || !data.organ_counts) return (
    <><Navbar/><div className="container"><div className="result-banner error">
      ❌ Dashboard could not load: {data.error || 'unexpected response'}<br/>
      <small>Run <code>python scripts/setup_db.py</code> (it must finish without FAILED) and refresh.</small>
    </div></div></>
  );

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>🔬</span><h1>Dashboard</h1></div>

        <div className="stats">
          <div className="stat-card">
            <div className="number">{data.total_reports}</div>
            <div className="label">Total Reports</div>
          </div>
          <div className="stat-card">
            <div className="number">{data.total_patients}</div>
            <div className="label">Total Patients</div>
          </div>
          {data.organ_counts.map(o => (
            <div key={o.organ_site} className="stat-card" style={{borderTopColor:
              o.organ_site==='Breast'?'#e91e8c':o.organ_site==='Colon'?'#2e7d32':'#6a1b9a'}}>
              <div className="number" style={{color:
                o.organ_site==='Breast'?'#e91e8c':o.organ_site==='Colon'?'#2e7d32':'#6a1b9a'}}>
                {o.cnt}
              </div>
              <div className="label">{o.organ_site} Cases</div>
            </div>
          ))}
          <div className="stat-card" style={{borderTopColor:'#e65100'}}>
            <div className="number" style={{color:'#e65100'}}>{data.amendments}</div>
            <div className="label">Amended Reports</div>
          </div>
          <div className="stat-card" style={{borderTopColor:'#1565c0'}}>
            <div className="number" style={{color:'#1565c0'}}>{data.urgent}</div>
            <div className="label">Urgent Pending</div>
          </div>
        </div>

        {data.sla_breaches?.length > 0 && (
          <div className="card">
            <div className="card-title">⚠️ SLA Breach Alerts</div>
            {data.sla_breaches.map(s => (
              <div key={s.case_id} style={{ background:'#fff3e0', border:'1.5px solid #ffb74d',
                borderRadius:'10px', padding:'12px 16px', marginBottom:'10px',
                display:'flex', justifyContent:'space-between' }}>
                <div style={{fontWeight:600}}>{s.case_number} — {s.patient_name}
                  <Badge label={s.priority}/></div>
                <div style={{color:'#e65100',fontWeight:700}}>
                  {Math.round(s.hours_elapsed)}h elapsed
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="card-title">📋 Recent Reports</div>
          <table>
            <thead><tr>
              <th>Report ID</th><th>Patient</th><th>Organ</th>
              <th>Diagnosis</th><th>Category</th><th>Date</th><th>Action</th>
            </tr></thead>
            <tbody>
              {data.recent.map(r => (
                <tr key={r.report_id}>
                  <td><strong>{String(r.report_id).slice(0,8)}...</strong></td>
                  <td>{r.patient}</td>
                  <td>{r.organ_site}</td>
                  <td>{r.diagnosis}</td>
                  <td><Badge label={r.category}/></td>
                  <td>{r.signed_at ? String(r.signed_at).slice(0,10) : 'Pending'}</td>
                  <td><Link href={`/report/${r.report_id}`} className="btn btn-primary" style={{fontSize:'.78rem',padding:'5px 12px'}}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
