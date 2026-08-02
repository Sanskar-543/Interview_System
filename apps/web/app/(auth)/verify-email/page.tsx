'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, ArrowLeft, Mail, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // Check stored email
      const savedEmail = localStorage.getItem('unverified_email');
      if (savedEmail) setEmail(savedEmail);
    }
  }, [searchParams]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Pasted full 6-digit code
      const digits = value.slice(0, 6).split('');
      const newOtp = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtpDigits(newOtp);
      inputRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }

    const newOtp = [...otpDigits];
    newOtp[index] = value;
    setOtpDigits(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('');

    if (code.length < 6) {
      setError('Please enter the complete 6-digit verification code');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Verification failed. Please check your code.');
      }

      // Route to Create Password step upon successful email verification
      router.push(`/create-password?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during verification');
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to resend code');

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error resending code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        
        {/* Back Button */}
        <button
          id="verify-back-signup-btn"
          onClick={() => router.push('/signup')}
          style={styles.backBtn}
        >
          <ArrowLeft size={16} /> Back to Signup
        </button>

        {/* Brand Header */}
        <div style={styles.brandRow}>
          <div style={styles.logoBadge}>
            <Mic size={22} color="#3B82F6" />
          </div>
          <span style={styles.brandName}>AI Interviewer</span>
        </div>

        <div style={styles.headerBlock}>
          <div style={styles.mailIconBadge}>
            <Mail size={24} color="#8B5CF6" />
          </div>
          <h1 style={styles.title}>Verify Your Email Address</h1>
          <p style={styles.subtitle}>
            We've generated a 6-digit verification code for <strong style={{ color: '#F3F4F6' }}>{email || 'your email'}</strong>. Please enter the code below to complete your registration.
          </p>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={18} color="#EF4444" />
            <span>{error}</span>
          </div>
        )}

        {resendSuccess && (
          <div style={styles.successBanner}>
            <CheckCircle2 size={18} color="#10B981" />
            <span>A new 6-digit verification code has been generated!</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          
          {/* 6-Digit OTP Cards */}
          <div style={styles.otpGrid}>
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                maxLength={6}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                style={{
                  ...styles.otpInput,
                  borderColor: digit ? '#8B5CF6' : 'rgba(255, 255, 255, 0.12)',
                  backgroundColor: digit ? 'rgba(139, 92, 246, 0.1)' : 'rgba(30, 41, 59, 0.6)',
                }}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={styles.submitBtn}
          >
            {isSubmitting ? 'Verifying Code...' : 'Verify Email & Continue'}
          </button>
        </form>

        <div style={styles.resendRow}>
          <span style={styles.resendText}>Didn't receive the verification code?</span>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resending}
            style={styles.resendBtn}
          >
            <RefreshCw size={14} className={resending ? 'spin' : ''} />
            <span>{resending ? 'Sending...' : 'Resend Code'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ color: '#9CA3AF', textAlign: 'center', paddingTop: '4rem' }}>Loading verification...</div>}>
      <VerifyEmailForm />
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
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.875rem',
    color: '#9CA3AF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '1.5rem',
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
  mailIconBadge: {
    width: '52px',
    height: '52px',
    borderRadius: '0.875rem',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
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
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    color: '#6EE7B7',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  otpGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '0.5rem',
    marginBottom: '1.75rem',
  },
  otpInput: {
    height: '56px',
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    border: '1px solid',
    borderRadius: '0.625rem',
    outline: 'none',
    transition: 'all 0.2s',
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#8B5CF6',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.875rem',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
    transition: 'all 0.2s',
  },
  resendRow: {
    marginTop: '1.75rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8125rem',
  },
  resendText: {
    color: '#9CA3AF',
  },
  resendBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#A78BFA',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
};
