import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const ALL = ['PATHOLOGIST', 'TECHNICIAN', 'ADMIN'];
const STAFF = ['PATHOLOGIST', 'ADMIN'];

const LINKS = [
  { href: '/',             label: 'Dashboard',       roles: ALL },
  { href: '/reports',      label: 'All Reports',     roles: ALL },
  { href: '/similar',      label: 'Similar Cases',   roles: ALL },
  { href: '/differential', label: 'Differential Dx', roles: ALL },
  { href: '/analytics',    label: 'Analytics',       roles: STAFF },
  { href: '/audit',        label: 'Audit Log',       roles: STAFF },
  { href: '/tat',          label: 'TAT Report',      roles: STAFF },
  { href: '/insights',     label: 'SQL Insights',    roles: STAFF },
  { href: '/add_case',     label: '+ New Case',      roles: ['PATHOLOGIST'] },
  { href: '/admin',        label: '🛡 Admin',         roles: ['ADMIN'] },
];

export default function Navbar() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  // read localStorage only on the client (avoids the hydration error)
  useEffect(() => {
    setName(localStorage.getItem('hp_name') || '');
    setRole(localStorage.getItem('hp_role') || '');
  }, []);

  const logout = () => { localStorage.clear(); router.push('/login'); };
  const visible = LINKS.filter(l => !role || l.roles.includes(role));

  return (
    <nav style={{
      background: 'linear-gradient(135deg,#0f2d52,#1a4a8a)', padding: '0 24px', height: '58px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,.2)', flexWrap: 'wrap'
    }}>
      <Link href="/" style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none' }}>
        <span style={{ color: '#64b5f6' }}>Histo</span>Path CMS
      </Link>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
        {visible.map(l => (
          <Link key={l.href} href={l.href} style={{
            color: router.pathname === l.href ? '#fff' : '#90caf9',
            textDecoration: 'none', fontSize: '.78rem', fontWeight: 500,
            padding: '5px 10px', borderRadius: '6px',
            background: router.pathname === l.href ? 'rgba(255,255,255,.15)' : 'transparent',
          }}>{l.label}</Link>
        ))}
        {name && (
          <>
            <span style={{ color: '#64b5f6', fontSize: '.75rem', marginLeft: '8px' }}>{name}</span>
            <span style={{ background: 'rgba(255,255,255,.15)', color: '#fff', padding: '2px 8px',
              borderRadius: '20px', fontSize: '.7rem', fontWeight: 600 }}>{role}</span>
            <button onClick={logout} style={{ background: 'transparent', border: '1px solid #546e7a',
              color: '#90caf9', padding: '4px 10px', borderRadius: '6px', fontSize: '.75rem',
              cursor: 'pointer', marginLeft: '4px' }}>Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}
