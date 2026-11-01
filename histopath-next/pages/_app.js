import '../styles/globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const PUBLIC_PAGES = ['/login', '/register', '/forbidden'];

// Front-end role-based access control (the API and PostgreSQL enforce the same rules again).
const PAGE_ROLES = {
  '/analytics': ['PATHOLOGIST', 'ADMIN'],
  '/audit':     ['PATHOLOGIST', 'ADMIN'],
  '/tat':       ['PATHOLOGIST', 'ADMIN'],
  '/insights':  ['PATHOLOGIST', 'ADMIN'],
  '/add_case':  ['PATHOLOGIST', 'ADMIN'],
  '/admin':     ['ADMIN'],
};

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('hp_token');
    const role  = localStorage.getItem('hp_role');
    if (!token && !PUBLIC_PAGES.includes(router.pathname)) { router.push('/login'); return; }
    const allowed = PAGE_ROLES[router.pathname];
    if (token && allowed && !allowed.includes(role)) router.push('/forbidden');
  }, [router.pathname]);

  return <Component {...pageProps} />;
}
