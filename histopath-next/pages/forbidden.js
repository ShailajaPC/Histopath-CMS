import Link from 'next/link';
import Navbar from '../components/Navbar';

export default function Forbidden() {
  return (
    <>
      <Navbar />
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '2.5rem' }}>🔒</div>
          <h1 style={{ color: '#0f2d52', margin: '12px 0 8px' }}>Access denied</h1>
          <p style={{ color: '#6b7a99', marginBottom: '20px' }}>
            Your role does not have permission to open this page.
          </p>
          <Link href="/" className="btn btn-primary">← Back to Dashboard</Link>
        </div>
      </div>
    </>
  );
}
