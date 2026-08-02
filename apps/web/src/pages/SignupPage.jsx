import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Globe, Github, Mail, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/signup-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to initiate signup');
      }

      localStorage.setItem('unverified_email', data.email);
      navigate(`/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider) => {
    setOauthLoading(provider);
    setError(null);

    try {
      const demoEmail = provider === 'google' ? 'candidate.google@example.com' : 'candidate.github@example.com';
      const demoName = provider === 'google' ? 'Google Candidate' : 'GitHub Candidate';
      const demoProviderId = `${provider}_${Date.now()}`;

      const res = await fetch(`${API_URL}/api/v1/auth/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          email: demoEmail,
          name: demoName,
          providerId: demoProviderId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `${provider} OAuth sign-up failed`);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/interview');
    } catch (err) {
      setError(err instanceof Error ? err.message : `Error during ${provider} sign-up`);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div style={styles.card}>
      <button
        id="signup-back-home-btn"
        onClick={() => navigate('/')}
        style={styles.backBtn}
      >
        ← Back to Home
      </button>

      <div style={styles.logoRow}>
        <Activity size={28} color="#2563EB" />
        <h1 style={styles.title}>Create Account</h1>
      </div>
      <p style={styles.subtitle}>Step 1 of 3: Enter your details to verify your email</p>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* OAuth Buttons */}
      <div style={styles.oauthStack}>
        <button
          type="button"
          onClick={() => handleOAuthSignIn('google')}
          disabled={!!oauthLoading}
          style={styles.googleBtn}
        >
          <Globe size={18} color="#EA4335" />
          <span>{oauthLoading === 'google' ? 'Connecting Google...' : 'Sign up with Google'}</span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuthSignIn('github')}
          disabled={!!oauthLoading}
          style={styles.githubBtn}
        >
          <Github size={18} color="#FFF" />
          <span>{oauthLoading === 'github' ? 'Connecting GitHub...' : 'Sign up with GitHub'}</span>
        </button>
      </div>

      <div style={styles.dividerRow}>
        <div style={styles.dividerLine} />
        <span style={styles.dividerText}>OR ENTER EMAIL TO VERIFY FIRST</span>
        <div style={styles.dividerLine} />
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Full Name</label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Jane Doe"
            style={styles.input}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Email Address</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={styles.input}
          />
        </div>

        <button id="signup-submit" type="submit" disabled={loading} style={{
          ...styles.submitBtn,
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          <Mail size={16} />
          <span>{loading ? 'Sending Verification Code...' : 'Verify Email & Continue'}</span>
          <ArrowRight size={16} />
        </button>
      </form>

      <p style={styles.footerText}>
        Already have an account?{' '}
        <Link to="/login" style={styles.link}>Sign in</Link>
      </p>
    </div>
  );
}

const styles = {
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '1.25rem',
    padding: '2.5rem',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.5rem',
    padding: '0.375rem 0.75rem',
    color: '#9CA3AF',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '1.25rem',
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
    color: '#FFF',
    margin: 0,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '0.875rem',
    marginTop: '0.25rem',
    marginBottom: '1.5rem',
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
  oauthStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    color: '#F3F4F6',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  githubBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    backgroundColor: '#181717',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    color: '#FFFFFF',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#6B7280',
    letterSpacing: '0.05em',
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
    boxSizing: 'border-box',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.875rem',
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 800,
    marginTop: '0.5rem',
    transition: 'all 0.2s',
    cursor: 'pointer',
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
