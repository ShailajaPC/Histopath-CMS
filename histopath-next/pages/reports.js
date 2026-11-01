import { apiFetch } from '../lib/api';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Badge from '../components/Badge';
import Link from 'next/link';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [organ, setOrgan]     = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch]   = useState('');

  const fetchReports = () => {
    const params = new URLSearchParams();
    if (organ)    params.append('organ', organ);
    if (category) params.append('category', category);
    if (search)   params.append('search', search);
    apiFetch(`/api/reports?${params}`).then(r=>r.json()).then(setReports);
  };

  useEffect(() => { fetchReports(); }, []);

  return (
    <>
      <Navbar/>
      <div className="container">
        <div className="page-header"><span style={{fontSize:'1.5rem'}}>📁</span><h1>All Histopathology Reports</h1></div>

        <div className="card" style={{marginBottom:'16px'}}>
          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'flex-end'}}>
            <div className="form-group" style={{flex:1,minWidth:'140px'}}>
              <label>Organ Site</label>
              <select value={organ} onChange={e=>setOrgan(e.target.value)}>
                <option value="">All Organs</option>
                <option value="Breast">Breast</option>
                <option value="Colon">Colon</option>
                <option value="Lymph Node">Lymph Node</option>
              </select>
            </div>
            <div className="form-group" style={{flex:1,minWidth:'140px'}}>
              <label>Category</label>
              <select value={category} onChange={e=>setCategory(e.target.value)}>
                <option value="">All Categories</option>
                <option value="Malignant">Malignant</option>
                <option value="Benign">Benign</option>
                <option value="Inflammatory">Inflammatory</option>
                <option value="Reactive">Reactive</option>
              </select>
            </div>
            <div className="form-group" style={{flex:2,minWidth:'200px'}}>
              <label>Search Patient / Diagnosis</label>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search..." />
            </div>
            <button className="btn btn-primary" onClick={fetchReports}
              style={{padding:'9px 22px',marginBottom:'2px'}}>Filter</button>
            <button className="btn btn-accent" onClick={()=>{setOrgan('');setCategory('');setSearch('');}}
              style={{padding:'9px 18px',marginBottom:'2px'}}>Clear</button>
          </div>
        </div>

        <div className="card">
          <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr>
              <th>Case No.</th><th>Patient</th><th>Age</th><th>Gender</th>
              <th>Organ</th><th>Diagnosis</th><th>Category</th>
              <th>Pathologist</th><th>Priority</th><th>Date</th><th>Action</th>
            </tr></thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.report_id}>
                  <td><strong>{r.case_number}</strong></td>
                  <td>{r.patient}</td>
                  <td>{r.age}</td>
                  <td>{r.gender}</td>
                  <td>{r.organ_site}</td>
                  <td>{r.diagnosis}</td>
                  <td><Badge label={r.category}/></td>
                  <td>{r.pathologist}</td>
                  <td><Badge label={r.priority}/></td>
                  <td>{r.signed_at ? String(r.signed_at).slice(0,10) : '—'}</td>
                  <td><Link href={`/report/${r.report_id}`} className="btn btn-primary"
                    style={{fontSize:'.75rem',padding:'5px 10px'}}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}
