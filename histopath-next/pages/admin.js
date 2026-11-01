import { apiFetch } from '../lib/api';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';

const ROLE_COLOR = { ADMIN: '#6a1b9a', PATHOLOGIST: '#1565c0', TECHNICIAN: '#2e7d32' };
const pill = (role) => ({ background: '#f4f6fb', color: ROLE_COLOR[role] || '#333', padding: '2px 10px',
  borderRadius: 20, fontSize: '.72rem', fontWeight: 700, border: `1px solid ${ROLE_COLOR[role] || '#ccc'}` });

export default function Admin() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TECHNICIAN', reports_to: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => apiFetch('/api/admin/users').then(r => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  const call = async (method, body, okText) => {
    setMsg(null);
    const res = await apiFetch('/api/admin/users', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: 'error', text: d.error || 'Request failed' }); return false; }
    setMsg({ type: 'success', text: okText }); load(); return true;
  };

  const create = async (e) => {
    e.preventDefault();
    if (await call('POST', form, 'User created.')) setForm({ name: '', email: '', password: '', role: 'TECHNICIAN', reports_to: '' });
  };
  const resetPw = (u) => {
    const pw = prompt(`New password for ${u.full_name} (min 6 characters):`);
    if (pw) call('PATCH', { id: u.user_id, password: pw }, `Password reset for ${u.full_name}.`);
  };

  if (!data) return <><Navbar /><div className="container">Loading...</div></>;
  if (data.error) return <><Navbar /><div className="container"><div className="result-banner error">{data.error}</div></div></>;
  const { users, tree } = data;
  const count = (r) => users.filter(u => u.role === r && u.is_active).length;

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-header"><span style={{ fontSize: '1.5rem' }}>🛡️</span><h1>Administration</h1></div>
        {msg && <div className={`result-banner ${msg.type}`}>{msg.type === 'success' ? '✅' : '❌'} {msg.text}</div>}

        <div className="stats">
          <div className="stat-card"><div className="number">{users.length}</div><div className="label">Total Users</div></div>
          <div className="stat-card" style={{ borderTopColor: ROLE_COLOR.ADMIN }}><div className="number" style={{ color: ROLE_COLOR.ADMIN }}>{count('ADMIN')}</div><div className="label">Admins</div></div>
          <div className="stat-card" style={{ borderTopColor: ROLE_COLOR.PATHOLOGIST }}><div className="number" style={{ color: ROLE_COLOR.PATHOLOGIST }}>{count('PATHOLOGIST')}</div><div className="label">Pathologists</div></div>
          <div className="stat-card" style={{ borderTopColor: ROLE_COLOR.TECHNICIAN }}><div className="number" style={{ color: ROLE_COLOR.TECHNICIAN }}>{count('TECHNICIAN')}</div><div className="label">Technicians</div></div>
        </div>

        <div className="card">
          <div className="card-title">👥 User management</div>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Reports to</th><th>Reports</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} style={{ opacity: u.is_active ? 1 : .5 }}>
                  <td><strong>{u.full_name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} style={{ width: 'auto', padding: '4px 8px' }}
                      onChange={e => call('PATCH', { id: u.user_id, role: e.target.value }, `${u.full_name} is now ${e.target.value}.`)}>
                      <option>PATHOLOGIST</option><option>TECHNICIAN</option><option>ADMIN</option>
                    </select>
                  </td>
                  <td>{u.reports_to_name || '—'}</td>
                  <td>{u.report_count}</td>
                  <td>{u.is_active ? <span style={{ color: '#2e7d32', fontWeight: 600 }}>Active</span> : <span style={{ color: '#c62828', fontWeight: 600 }}>Disabled</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-accent" style={{ padding: '4px 10px', fontSize: '.72rem', marginRight: 6 }} onClick={() => resetPw(u)}>Reset password</button>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '.72rem', background: u.is_active ? '#fde8e8' : '#e8f5e9', color: u.is_active ? '#c62828' : '#2e7d32' }}
                      onClick={() => call('PATCH', { id: u.user_id, is_active: !u.is_active }, `${u.full_name} ${u.is_active ? 'disabled' : 'enabled'}.`)}>
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">➕ Create user</div>
          <form onSubmit={create}>
            <div className="form-grid">
              <div className="form-group"><label>Full name</label><input required value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-group"><label>Email</label><input required type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div className="form-group"><label>Password</label><input required type="password" value={form.password} onChange={e => set('password', e.target.value)} /></div>
              <div className="form-group"><label>Role</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}>
                  <option>PATHOLOGIST</option><option>TECHNICIAN</option><option>ADMIN</option></select></div>
              <div className="form-group"><label>Reports to</label>
                <select value={form.reports_to} onChange={e => set('reports_to', e.target.value)}>
                  <option value="">— nobody —</option>
                  {users.filter(u => u.is_active).map(u => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                </select></div>
            </div>
            <button className="btn btn-primary" type="submit" style={{ padding: '10px 22px' }}>Create user</button>
          </form>
        </div>

        <div className="card">
          <div className="card-title">🌳 Organisation hierarchy <span style={{ fontWeight: 400, color: '#6b7a99', fontSize: '.78rem' }}>(computed with a recursive CTE)</span></div>
          {tree.map(n => (
            <div key={n.user_id} style={{ marginLeft: n.depth * 28, padding: '5px 0', fontSize: '.88rem' }}>
              {n.depth > 0 && <span style={{ color: '#90a4ae' }}>└ </span>}
              <strong>{n.full_name}</strong> <span style={pill(n.role)}>{n.role}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
