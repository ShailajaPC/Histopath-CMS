import { apiFetch } from '../lib/api';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Link from 'next/link';

export default function Audit() {
  const [data, setData] = useState(null);
  useEffect(() => { apiFetch('/api/audit').then(r=>r.json()).then(setData); }, []);
  if (!data) return <><Navbar/><div className="container">Loading...</div></>;

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>📝</span><h1>Report Amendment Audit Log</h1></div>

        <div className="card">
          <div className="card-title">Report Addenda</div>
          {data.logs.length > 0 ? (
            <ul style={{listStyle:'none',padding:0}}>
              {data.logs.map(l=>(
                <li key={l.addendum_id} style={{
                  position:'relative', padding:'14px 14px 14px 40px',
                  borderLeft:'2px solid #e0e7f0', marginLeft:'14px', marginBottom:'4px'
                }}>
                  <div style={{position:'absolute',left:'-7px',top:'18px',width:'12px',
                    height:'12px',borderRadius:'50%',background:'#2196f3',border:'2px solid #fff'}}/>
                  <div style={{fontSize:'.75rem',color:'#6b7a99',marginBottom:'4px'}}>
                    {String(l.created_at).slice(0,19)} — {l.amended_by}
                  </div>
                  <div style={{fontWeight:600,fontSize:'.88rem',marginBottom:'3px'}}>
                    Patient: {l.patient} | <Link href={`/report/${l.report_id}`}
                      style={{color:'#2196f3'}}>View Report</Link>
                  </div>
                  <div style={{fontSize:'.82rem',color:'#555'}}>
                    <strong>{l.old_diagnosis}</strong> →
                    <strong style={{color:'#0f2d52'}}> {l.new_diagnosis}</strong><br/>
                    <em>{l.revision_note}</em>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p style={{color:'#6b7a99'}}>No amendments recorded yet.</p>}
        </div>

        <div className="card">
          <div className="card-title">Case Status Change Log</div>
          <table>
            <thead><tr><th>Action</th><th>Old Status</th><th>New Status</th><th>Performed By</th><th>Timestamp</th></tr></thead>
            <tbody>
              {data.case_logs.map(l=>(
                <tr key={l.log_id}>
                  <td><strong>{l.action}</strong></td>
                  <td>{l.old_status||'—'}</td>
                  <td><span style={{background:'#e8f5e9',color:'#2e7d32',
                    padding:'3px 10px',borderRadius:'20px',fontSize:'.72rem',fontWeight:600}}>
                    {l.new_status}</span></td>
                  <td>{l.performed_by_name}</td>
                  <td>{String(l.timestamp).slice(0,19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
