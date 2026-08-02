'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, Lock, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function CreatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    } else {
      const savedEmail = localStorage.getItem('unverified_email');
      if (savedEmail) setEmail(savedEmail);
    }
  }, [searchParams]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password carefully.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/create-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create password');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.removeItem('unverified_email');

      // Redirect candidate to interview setup!
      router.push('/interview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error setting password');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        
        {/* Brand Header */}
        <div style={styles.brandRow}>
          <div style={styles.logoBadge}>
            <Mic size={22} color="#3B82F6" />
          </div>
          <span style={styles.brandName}>AI Interviewer</span>
        </div>

        <div style={styles.headerBlock}>
          <div style={styles.lockIconBadge}>
            <ShieldCheck size={26} color="#10B981" />
          </div>
          <h1 style={styles.title}>Create Your Password</h1>
          <p style={styles.subtitle}>
            Step 3 of 3: Your email <strong style={{ color: '#F3F4F6' }}>{email || 'address'}</strong> is verified! Create a password to secure your account.
          </p>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={18} color="#EF4444" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          
          {/* Password Input */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              <Lock size={14} color="#A78BFA" /> New Password
            </label>
            <input
              id="create-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              style={styles.input}
            />
          </div>

          {/* Confirm Password Input */}
          <div style={styles.fieldGroup}>
            <div style={styles.labelRow}>
              <label style={styles.label}>
                <Lock size={14} color="#A78BFA" /> Re-enter Password for Safety
              </label>
              
              {passwordsMatch && (
                <span style={styles.matchBadgeSuccess}>
                  <CheckCircle2 size={13} color="#10B981" /> Passwords Match
                </span>
              )}

              {passwordsMismatch && (
                <span style={styles.matchBadgeError}>
                  <AlertCircle size={13} color="#EF4444" /> Passwords Do Not Match
                </span>
              )}
            </div>

            <input
              id="confirm-password-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Re-enter your password to confirm"
              style={{
                ...styles.input,
                borderColor: passwordsMismatch ? '#EF4444' : passwordsMatch ? '#10B981' : 'rgba(255, 255, 255, 0.12)',
              }}
            />
          </div>

          <button
            id="create-password-submit-btn"
            type="submit"
            disabled={isSubmitting || passwordsMismatch}
            style={{
              ...styles.submitBtn,
              opacity: isSubmitting || passwordsMismatch ? 0.6 : 1,
              cursor: isSubmitting || passwordsMismatch ? 'not-allowed' : 'pointer',
            }}
          >
            <span>{isSubmitting ? 'Securing Account...' : 'Create Password & Complete Setup'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

      </div>
    </div>
  );
}

export default function CreatePasswordPage() {
  return (
    <Suspense fallback={<div style={{ color: '#9CA3AF', textAlign: 'center', paddingTop: '4rem' }}>Loading password setup...</div>}>
      <CreatePasswordForm />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#090D16',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '1.25rem',
    padding: '2.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    marginBottom: '1.5rem',
  },
  logoBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '0.625rem',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  headerBlock: {
    marginBottom: '2rem',
  },
  lockIconBadge: {
    width: '52px',
    height: '52px',
    borderRadius: '0.875rem',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#F9FAFB',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    lineHeight: 1.6,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
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
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#E5E7EB',
  },
  matchBadgeSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#10B981',
  },
  matchBadgeError: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#EF4444',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0.625rem',
    color: '#F9FAFB',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    width: '100%',
    padding: '0.875rem',
    backgroundColor: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '0.625rem',
    fontSize: '1rem',
    fontWeight: 800,
    marginTop: '0.75rem',
    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
    transition: 'all 0.2s',
  },
};
