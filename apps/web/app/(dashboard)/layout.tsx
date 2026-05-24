'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, LogOut } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(user.name || 'User');
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.logoRow}>
            <Activity size={24} color="#2563EB" />
            <span style={styles.logoText}>SpeechAI</span>
          </div>
          <div style={styles.navRight}>
            <span style={styles.greeting}>Hey, {userName}</span>
            <button id="logout-btn" onClick={handleLogout} style={styles.logoutBtn}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
  },
  nav: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  navInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0.875rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  logoText: {
    fontSize: '1.125rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  greeting: {
    fontSize: '0.8125rem',
    color: '#9CA3AF',
    fontWeight: 500,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.875rem',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '0.375rem',
    color: '#FCA5A5',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'all 0.2s',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
};
