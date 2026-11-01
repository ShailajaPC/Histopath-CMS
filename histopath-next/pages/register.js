import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Register() {
  const [form, setForm]       = useState({ name:'', email:'', password:'', confirm:'', role:'PATHOLOGIST' });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); setLoading(false); return; }
      setSuccess('Account created! Redirecting to login...');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const inputStyle = { width:'100%', padding:'10px 14px', border:'1.5px solid #e0e7f0',
    borderRadius:'8px', fontSize:'.9rem', fontFamily:'inherit', outline:'none' };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'linear-gradient(135deg,#0f2d52,#1a4a8a)' }}>
      <div style={{ background:'#fff', borderRadius:'18px', padding:'44px 40px',
        width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ fontSize:'2.5rem' }}>🔬</div>
          <h2 style={{ fontSize:'1.5rem', fontWeight:700, color:'#0f2d52', margin:'8px 0 4px' }}>Create Account</h2>
          <p style={{ color:'#6b7a99', fontSize:'.83rem' }}>HistoPath CMS — New User Registration</p>
        </div>

        {error && <div style={{ background:'#fde8e8', color:'#c62828', borderRadius:'10px',
          padding:'12px 16px', fontSize:'.85rem', marginBottom:'16px', border:'1.5px solid #ffcdd2' }}>
          ⚠️ {error}</div>}

        {success && <div style={{ background:'#e8f5e9', color:'#2e7d32', borderRadius:'10px',
          padding:'12px 16px', fontSize:'.85rem', marginBottom:'16px', border:'1.5px solid #a5d6a7' }}>
          ✅ {success}</div>}

        <form onSubmit={handleRegister}>
          {[['name','Full Name','text','Dr. Priya Sharma'],
            ['email','Email Address','email','your@email.com'],
            ['password','Password','password','Create a password'],
            ['confirm','Confirm Password','password','Re-enter password']].map(([k,l,t,p])=>(
            <div key={k} style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'.8rem', fontWeight:600,
                color:'#6b7a99', marginBottom:'5px' }}>{l}</label>
              <input type={t} placeholder={p} required
                value={form[k]} onChange={e=>set(k,e.target.value)} style={inputStyle}
                onFocus={e=>e.target.style.borderColor='#2196f3'}
                onBlur={e=>e.target.style.borderColor='#e0e7f0'}/>
            </div>
          ))}
          <div style={{ marginBottom:'20px' }}>
            <label style={{ display:'block', fontSize:'.8rem', fontWeight:600,
              color:'#6b7a99', marginBottom:'5px' }}>Role</label>
            <select value={form.role} onChange={e=>set('role',e.target.value)} style={inputStyle}>
              <option value="PATHOLOGIST">Pathologist</option>
              <option value="TECHNICIAN">Lab Technician</option>
            </select>
          </div>
          <button type="submit" disabled={loading} style={{
            width:'100%', background: loading?'#90a4ae':'#0f2d52', color:'#fff',
            padding:'13px', border:'none', borderRadius:'10px',
            fontSize:'1rem', fontWeight:600, cursor: loading?'not-allowed':'pointer' }}>
            {loading ? 'Creating account...' : 'Register →'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:'16px', fontSize:'.83rem', color:'#6b7a99' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color:'#2196f3', fontWeight:600, textDecoration:'none' }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}
