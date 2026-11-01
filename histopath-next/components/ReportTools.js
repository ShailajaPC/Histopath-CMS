import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { apiFetch } from '../lib/api';

function tokenUserId() {
  try {
    const t = localStorage.getItem('hp_token');
    const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)).user_id;
  } catch (_) { return ''; }
}

export default function ReportTools({ report, onChanged }) {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [uid, setUid]   = useState('');
  const [vec, setVec]   = useState(null);
  const [msg, setMsg]   = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [adding, setAdding] = useState(false);
  const [add, setAdd] = useState({ new_diagnosis: '', note: '' });

  useEffect(() => { setRole(localStorage.getItem('hp_role') || ''); setUid(tokenUserId()); }, []);

  const loadVec = () =>
    apiFetch(`/api/vector?id=${report.report_id}`).then(r => r.json()).then(setVec).catch(() => {});
  useEffect(() => { loadVec(); }, [report.report_id]);

  const isPath   = role === 'PATHOLOGIST';
  const isOwner  = isPath && String(report.pathologist_id) === String(uid);
  const isDraft  = !report.is_signed;

  const call = async (method, url, body, okText) => {
    setBusy(true); setMsg(null);
    try {
      const res = await apiFetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Request failed' }); return false; }
      setMsg({ type: 'success', text: okText });
      return true;
    } finally { setBusy(false); }
  };

  const regenerate = async () => {
    if (await call('POST', '/api/vector', { id: report.report_id, action: 'regenerate' },
        'Embedding re-generated from the stored text.')) loadVec();
  };
  const removeVec = async () => {
    if (!confirm('Remove this report’s embedding? It will no longer appear in semantic search.')) return;
    if (await call('POST', '/api/vector', { id: report.report_id, action: 'delete' },
        'Embedding deleted. The report text is unchanged.')) loadVec();
  };
  const openEdit = () => {
    setForm({
      diagnosis: report.diagnosis || '', icd_code: report.icd_code || '', category: report.category || 'Malignant',
      microscopic_findings: report.microscopic_findings || '',
      gross_desc: (report.synoptic_data && report.synoptic_data.gross_description) || '',
    });
    setEditing(true); setMsg(null);
  };
  const saveEdit = async (e) => {
    e.preventDefault();
    if (await call('PUT', '/api/report_manage', { id: report.report_id, ...form },
        'Report updated and its embedding re-generated.')) {
      setEditing(false); onChanged && onChanged(); loadVec();
    }
  };
  const signOff = async () => {
    if (!confirm('Sign off this report? After signing it can no longer be edited or deleted.')) return;
    if (await call('POST', '/api/signoff', { id: report.report_id }, 'Report signed off.')) { onChanged && onChanged(); }
  };
  const deleteDraft = async () => {
    if (!confirm('Delete this draft report and its embedding permanently?')) return;
    if (await call('DELETE', `/api/report_manage?id=${report.report_id}`, null, 'Draft deleted.')) router.push('/reports');
  };

  const saveAddendum = async (e) => {
    e.preventDefault();
    if (await call('POST', '/api/addendum', { id: report.report_id, ...add }, 'Addendum recorded.')) {
      setAdding(false); setAdd({ new_diagnosis: '', note: '' }); onChanged && onChanged();
    }
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const btn = (extra = {}) => ({ padding: '8px 16px', fontSize: '.8rem', ...extra });

  return (
    <>
      {msg && <div className={`result-banner ${msg.type}`}>{msg.type === 'success' ? '✅' : '❌'} {msg.text}</div>}

      {/* ───────── Vector embedding (Read / Update / Delete) ───────── */}
      <div className="card">
        <div className="card-title">🧠 Vector Embedding (pgvector)</div>
        {!vec ? <p style={{ color: '#6b7a99' }}>Loading…</p> : vec.has_embedding ? (
          <>
            <div style={{ fontSize: '.83rem', marginBottom: '10px' }}>
              <strong>{vec.dims}-dimensional</strong> vector stored · first values:{' '}
              <code style={{ background: '#f4f6fb', padding: '2px 6px', borderRadius: '4px' }}>
                [{vec.preview.map(n => n.toFixed(3)).join(', ')}, …]
              </code>
            </div>
            <div style={{ fontWeight: 600, fontSize: '.82rem', color: '#0f2d52', margin: '12px 0 6px' }}>
              5 nearest cases by cosine similarity
            </div>
            <table>
              <thead><tr><th>Patient</th><th>Organ</th><th>Diagnosis</th><th>Similarity</th><th></th></tr></thead>
              <tbody>
                {vec.neighbors.map(n => (
                  <tr key={n.report_id}>
                    <td>{n.patient_name}</td><td>{n.organ_site}</td><td>{n.diagnosis}</td>
                    <td><strong style={{ color: '#2196f3' }}>{(parseFloat(n.similarity_score) * 100).toFixed(1)}%</strong></td>
                    <td><Link href={`/report/${n.report_id}`} className="btn btn-primary" style={{ fontSize: '.72rem', padding: '4px 10px' }}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p style={{ color: '#e65100', fontSize: '.85rem' }}>
            No embedding stored — this report is excluded from semantic search.
          </p>
        )}
        {isPath && vec && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button className="btn btn-accent" style={btn()} disabled={busy} onClick={regenerate}>
              🔄 {vec.has_embedding ? 'Regenerate embedding' : 'Generate embedding'}
            </button>
            {vec.has_embedding && (
              <button className="btn" style={btn({ background: '#fde8e8', color: '#c62828' })} disabled={busy} onClick={removeVec}>
                🗑 Delete embedding
              </button>
            )}
          </div>
        )}
      </div>

      {/* ───────── Draft actions / signed lock ───────── */}
      <div className="card">
        <div className="card-title">{isDraft ? '✏️ Draft report actions' : '🔒 Signed report'}</div>
        {!isDraft && (
          <p style={{ fontSize: '.85rem', color: '#6b7a99' }}>
            This report is signed. A database trigger blocks any change to its diagnosis or findings
            and blocks deletion. Only the derived embedding above can be refreshed or removed.
          </p>
        )}
        {!isDraft && isPath && !adding && (
          <button className="btn btn-primary" style={btn({ marginTop: 12 })} onClick={() => setAdding(true)}>➕ Add addendum</button>
        )}
        {!isDraft && isPath && adding && (
          <form onSubmit={saveAddendum} style={{ marginTop: 12 }}>
            <div className="form-group" style={{ marginBottom: 12 }}><label>Revised diagnosis *</label>
              <input required value={add.new_diagnosis} onChange={e => setAdd(a => ({ ...a, new_diagnosis: e.target.value }))} /></div>
            <div className="form-group" style={{ marginBottom: 12 }}><label>Reason for revision *</label>
              <textarea rows={3} required value={add.note} onChange={e => setAdd(a => ({ ...a, note: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" style={btn()} disabled={busy}>Save addendum</button>
              <button type="button" className="btn btn-accent" style={btn()} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </form>
        )}
        {isDraft && !isOwner && (
          <p style={{ fontSize: '.85rem', color: '#6b7a99' }}>
            This draft has not been signed yet. Only the pathologist who wrote it can edit, sign or delete it.
          </p>
        )}
        {isDraft && isOwner && !editing && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={btn()} disabled={busy} onClick={openEdit}>✏️ Edit report</button>
            <button className="btn btn-accent"  style={btn()} disabled={busy} onClick={signOff}>✅ Sign off</button>
            <button className="btn" style={btn({ background: '#fde8e8', color: '#c62828' })} disabled={busy} onClick={deleteDraft}>🗑 Delete draft</button>
          </div>
        )}
        {isDraft && isOwner && editing && (
          <form onSubmit={saveEdit}>
            <div className="form-grid">
              <div className="form-group"><label>Diagnosis *</label>
                <input required value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} /></div>
              <div className="form-group"><label>ICD Code</label>
                <input value={form.icd_code} onChange={e => set('icd_code', e.target.value)} /></div>
              <div className="form-group"><label>Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {['Malignant', 'Benign', 'Inflammatory', 'Reactive', 'Other'].map(c => <option key={c}>{c}</option>)}
                </select></div>
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}><label>Gross description</label>
              <textarea rows={2} value={form.gross_desc} onChange={e => set('gross_desc', e.target.value)} /></div>
            <div className="form-group" style={{ marginBottom: '12px' }}><label>Microscopic findings *</label>
              <textarea rows={4} required value={form.microscopic_findings} onChange={e => set('microscopic_findings', e.target.value)} /></div>
            <p style={{ fontSize: '.76rem', color: '#6b7a99', marginBottom: '10px' }}>
              Saving re-generates the 384-dimension embedding from the new text.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" style={btn()} disabled={busy}>{busy ? 'Saving…' : '💾 Save & re-embed'}</button>
              <button type="button" className="btn btn-accent" style={btn()} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
