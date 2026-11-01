import { apiFetch } from '../lib/api';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';

export default function Insights() {
  const [data, setData] = useState(null);
  useEffect(() => { apiFetch('/api/insights').then(r => r.json()).then(setData); }, []);
  if (!data) return <><Navbar /><div className="container">Loading...</div></>;
  if (data.error) return <><Navbar /><div className="container"><div className="result-banner error">{data.error}</div></div></>;

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-header"><span style={{ fontSize: '1.5rem' }}>🧮</span><h1>SQL Insights</h1></div>
        <p style={{ color: '#6b7a99', marginBottom: 18, fontSize: '.85rem' }}>
          Live results of advanced SQL (nested, correlated, window functions, CTEs) running on the database.
        </p>
        {Object.entries(data).map(([k, q]) => {
          const cols = q.rows[0] ? Object.keys(q.rows[0]) : [];
          return (
            <div className="card" key={k}>
              <div className="card-title">{q.title}</div>
              <pre style={{ background: '#0f2d52', color: '#cfe3ff', padding: 14, borderRadius: 10, fontSize: '.74rem', overflowX: 'auto', marginBottom: 14 }}>{q.sql}</pre>
              {q.rows.length === 0 ? <p style={{ color: '#6b7a99' }}>No rows.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>{q.rows.map((r, i) => <tr key={i}>{cols.map(c => <td key={c}>{String(r[c])}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
