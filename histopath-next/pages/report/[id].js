import { apiFetch } from '../../lib/api';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../../components/Navbar';
import Badge from '../../components/Badge';
import ReportTools from '../../components/ReportTools';
import Link from 'next/link';

export default function ReportDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);

  const load = () => apiFetch(`/api/report/${id}`).then(r=>r.json()).then(setData);
  useEffect(() => { if (id) load(); }, [id]);

  if (!data) return <><Navbar/><div className="container">Loading...</div></>;
  const { report, ihc, morph, addenda } = data;
  if (!report) return <><Navbar/><div className="container">Report not found.</div></>;

  const gross = report.synoptic_data?.gross_description || 'N/A';

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header">
          <span style={{fontSize:'1.5rem'}}>🧬</span>
          <h1>{report.case_number}
            <span style={{marginLeft:'10px'}}><Badge label={report.priority}/></span>
            {report.is_signed && <span style={{marginLeft:'6px'}}><Badge label="SIGNED"/></span>}
          </h1>
        </div>

        <div className="form-grid" style={{marginBottom:'20px'}}>
          <div className="card" style={{marginBottom:0}}>
            <div className="card-title">👤 Patient Information</div>
            {[['Name', report.patient],['Age / Gender',`${report.age} yrs / ${report.gender}`],
              ['Organ Site',report.organ_site],['Biopsy Type',report.biopsy_type],
              ['Collection Date',String(report.collection_date).slice(0,10)],
              ['Fixation',report.fixation_type]].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',
                marginBottom:'8px',fontSize:'.83rem'}}>
                <span style={{color:'#6b7a99',fontWeight:500}}>{l}</span>
                <span style={{fontWeight:600,textAlign:'right',maxWidth:'60%'}}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:0}}>
            <div className="card-title">🩺 Diagnosis</div>
            {[['Diagnosis',report.diagnosis],['ICD Code',report.icd_code],
              ['Pathologist',report.pathologist],
              ['Signed At', report.signed_at ? String(report.signed_at).slice(0,19) : 'Pending'],
              ['Case Status',report.status]].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',
                marginBottom:'8px',fontSize:'.83rem'}}>
                <span style={{color:'#6b7a99',fontWeight:500}}>{l}</span>
                <span style={{fontWeight:600}}>{l==='Category'?<Badge label={report.category}/>:v}</span>
              </div>
            ))}
            <div style={{marginTop:'6px'}}><Badge label={report.category}/></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">📝 Gross Description</div>
          <div style={{background:'#f8fbff',border:'1.5px solid #e0e7f0',borderRadius:'10px',
            padding:'16px',fontSize:'.85rem',lineHeight:'1.8',marginBottom:'16px'}}>{gross}</div>
          <div className="card-title">🔬 Microscopic Findings</div>
          <div style={{background:'#f8fbff',border:'1.5px solid #e0e7f0',borderRadius:'10px',
            padding:'16px',fontSize:'.85rem',lineHeight:'1.8'}}>{report.microscopic_findings}</div>
        </div>

        <div className="card">
          <div className="card-title">🧪 IHC Panel Results</div>
          <table>
            <thead><tr><th>Marker</th><th>Result</th><th>Intensity</th></tr></thead>
            <tbody>
              {ihc.map(i=>(
                <tr key={i.marker_name}>
                  <td><strong>{i.marker_name}</strong></td>
                  <td>
                    {['Positive','Intact'].includes(i.result)
                      ? <span className="pos">● {i.result}</span>
                      : ['Negative','Lost'].includes(i.result)
                      ? <span className="neg">● {i.result}</span>
                      : <span style={{color:'#e65100',fontWeight:700}}>● {i.result}</span>}
                  </td>
                  <td>{i.intensity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">🔎 Morphological Features</div>
          <table>
            <thead><tr><th>Feature</th><th>Value</th></tr></thead>
            <tbody>
              {morph.map(m=>(
                <tr key={m.feature_type}>
                  <td>{m.feature_type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</td>
                  <td><strong>{m.feature_value}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {addenda?.length > 0 && (
          <div className="card">
            <div className="card-title">📋 Report Addenda</div>
            {addenda.map(a=>(
              <div key={a.addendum_id} style={{borderLeft:'3px solid #2196f3',
                paddingLeft:'14px',marginBottom:'14px'}}>
                <div style={{fontSize:'.75rem',color:'#6b7a99'}}>
                  {String(a.created_at).slice(0,19)} — {a.author_name}
                </div>
                <div style={{fontWeight:600,fontSize:'.88rem',margin:'4px 0'}}>
                  {a.old_diagnosis} → <strong style={{color:'#0f2d52'}}>{a.new_diagnosis}</strong>
                </div>
                <div style={{fontSize:'.82rem',color:'#555'}}>{a.revision_note}</div>
              </div>
            ))}
          </div>
        )}

        <ReportTools report={report} onChanged={load}/>

        <div style={{display:'flex',gap:'12px',marginBottom:'30px'}}>
          <Link href="/similar" className="btn btn-accent">🔍 Find Similar Cases</Link>
          <Link href="/reports" className="btn btn-primary">← Back to Reports</Link>
        </div>
      </div>
    </>
  );
}
