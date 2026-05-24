'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.logoRow}>
        <Activity size={28} color="#2563EB" />
        <h1 style={styles.title}>Welcome back</h1>
      </div>
      <p style={styles.subtitle}>Sign in to your SpeechAI account</p>

      {error && <div style={styles.errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={styles.input}
          />
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={styles.input}
          />
        </div>
        <button id="login-submit" type="submit" disabled={loading} style={{
          ...styles.submitBtn,
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p style={styles.footerText}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" style={styles.link}>Create one</Link>
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1.25rem',
    padding: '2.5rem',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.25rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
    margin: 0,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '0.875rem',
    marginTop: '0.25rem',
    marginBottom: '1.75rem',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.8125rem',
    marginBottom: '1.25rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#D1D5DB',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(3, 7, 18, 0.5)',
    border: '1px solid #1F2937',
    borderRadius: '0.5rem',
    color: '#F9FAFB',
    fontSize: '0.875rem',
    outline: 'none',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxSizing: 'border-box',
  },
  submitBtn: {
    width: '100%',
    padding: '0.875rem',
    backgroundColor: '#2563EB',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    marginTop: '0.5rem',
    transition: 'all 0.2s',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  footerText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: '0.8125rem',
    marginTop: '1.5rem',
  },
  link: {
    color: '#60A5FA',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
