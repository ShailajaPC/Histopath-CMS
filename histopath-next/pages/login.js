import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid email or password');
        setLoading(false);
        return;
      }
      localStorage.setItem('hp_token', data.token);
      localStorage.setItem('hp_name',  data.name);
      localStorage.setItem('hp_role',  data.role);
      router.push('/');
    } catch (err) {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'linear-gradient(135deg,#0f2d52,#1a4a8a)' }}>
      <div style={{ background:'#fff', borderRadius:'18px', padding:'44px 40px',
        width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>

        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'8px' }}>🔬</div>
          <h2 style={{ fontSize:'1.6rem', fontWeight:700, color:'#0f2d52', margin:0 }}>HistoPath CMS</h2>
          <p style={{ color:'#6b7a99', fontSize:'.83rem', marginTop:'6px' }}>
            Histopathology Case & Report Management System
          </p>
        </div>

        {error && (
          <div style={{
            background:'#fde8e8', color:'#c62828', borderRadius:'10px',
            padding:'12px 16px', fontSize:'.85rem', marginBottom:'18px',
            border:'1.5px solid #ffcdd2', display:'flex', alignItems:'center', gap:'8px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', fontSize:'.8rem', fontWeight:600,
              color:'#6b7a99', marginBottom:'6px' }}>Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="your@email.com" required
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e0e7f0',
                borderRadius:'8px', fontSize:'.9rem', fontFamily:'inherit',
                outline:'none', transition:'border .2s' }}
              onFocus={e=>e.target.style.borderColor='#2196f3'}
              onBlur={e=>e.target.style.borderColor='#e0e7f0'}
            />
          </div>
          <div style={{ marginBottom:'22px' }}>
            <label style={{ display:'block', fontSize:'.8rem', fontWeight:600,
              color:'#6b7a99', marginBottom:'6px' }}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="Enter password" required
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e0e7f0',
                borderRadius:'8px', fontSize:'.9rem', fontFamily:'inherit',
                outline:'none', transition:'border .2s' }}
              onFocus={e=>e.target.style.borderColor='#2196f3'}
              onBlur={e=>e.target.style.borderColor='#e0e7f0'}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            width:'100%', background: loading ? '#90a4ae' : '#0f2d52',
            color:'#fff', padding:'13px', border:'none', borderRadius:'10px',
            fontSize:'1rem', fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer',
            transition:'background .2s'
          }}>
            {loading ? 'Logging in...' : 'Login →'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:'18px', fontSize:'.83rem', color:'#6b7a99' }}>
          New user?{' '}
          <Link href="/register" style={{ color:'#2196f3', fontWeight:600, textDecoration:'none' }}>
            Register here
          </Link>
        </p>

        <div style={{ background:'#e3f2fd', borderRadius:'10px', padding:'14px 16px',
          marginTop:'18px', fontSize:'.78rem', color:'#1565c0', lineHeight:'1.8' }}>
          <strong style={{ display:'block', marginBottom:'4px' }}>Demo Credentials:</strong>
          Pathologist: meera@histopath.com / pass123<br/>
          Admin: admin@histopath.com / admin123<br/>
          Technician: ravi@histopath.com / tech123
        </div>
      </div>
    </div>
  );
}
