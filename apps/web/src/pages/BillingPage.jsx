import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Zap, AlertTriangle, ArrowLeft, Loader2, Sparkles, Star, Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function BillingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const fetchUser = async () => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error('Failed to load user profile');
      }
      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error loading profile' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // Cryptographically sign simulated webhook body using native browser Web Crypto API
  async function computeHMAC(body, secret) {
    const encoder = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const handleSimulateUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    setMessage(null);

    try {
      // 1. Create mock order details
      const token = getToken();
      const subRes = await fetch(`${API_URL}/api/v1/billing/subscribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!subRes.ok) {
        const subData = await subRes.json();
        throw new Error(subData.error?.message || 'Failed to initialize subscription');
      }

      const subData = await subRes.json();
      const mockSubId = subData.data.id;

      // 2. Build cryptographically signed Razorpay Webhook postback body
      const webhookPayload = {
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: mockSubId,
              notes: {
                userId: user.id
              }
            }
          }
        }
      };

      const webhookBodyString = JSON.stringify(webhookPayload);
      const mockSecret = 'mock_webhook_secret';

      // Calculate HMAC SHA256 signature in browser
      const signature = await computeHMAC(webhookBodyString, mockSecret);

      // 3. POST Webhook postback directly to Express Gateway
      const webRes = await fetch(`${API_URL}/api/v1/billing/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature
        },
        body: webhookBodyString
      });

      if (!webRes.ok) {
        const webData = await webRes.json();
        throw new Error(webData.error?.message || 'Webhook simulation rejected by server');
      }

      setMessage({ type: 'success', text: 'Congratulations! Your account was upgraded to the Pro plan!' });
      await fetchUser(); // Reload updated plan status

    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upgrade simulation failed.' });
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your Pro plan? Your session limits will return to 3 free interviews/month.')) {
      return;
    }
    setCancelling(true);
    setMessage(null);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/v1/billing/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Cancellation failed');
      }

      setMessage({ type: 'success', text: 'Your Pro plan has been successfully cancelled.' });
      await fetchUser();

    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Cancellation failed' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingWrapper}>
        <Loader2 size={32} color="#8B5CF6" className="animate-spin" />
        <p style={styles.loadingText}>Loading subscription details...</p>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.container}>
        {/* Back Button */}
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Elevate Your Preparation</h1>
          <p style={styles.subtitle}>Select the subscription plan that aligns with your interview targets and practice limits.</p>
        </div>

        {/* Message Banner */}
        {message && (
          <div style={{
            ...styles.alertBanner,
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            color: message.type === 'success' ? '#6EE7B7' : '#FCA5A5',
          }}>
            {message.type === 'success' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{message.text}</span>
          </div>
        )}

        {/* Cards Grid */}
        <div style={styles.grid}>
          {/* Card 1: Free Starter */}
          <div className="glass-card" style={styles.card}>
            {user?.plan === 'free' && (
              <span style={styles.currentBadge}>Current Plan</span>
            )}
            <div>
              <h3 style={styles.planName}>Free Starter</h3>
              <p style={styles.planDesc}>Perfect to explore and run preliminary test evaluations.</p>

              <div style={styles.priceRow}>
                <span style={styles.priceNumber}>₹0</span>
                <span style={styles.pricePeriod}>/ month</span>
              </div>

              <ul style={styles.featureList}>
                <li style={styles.featureItem}>
                  <Check size={16} color="#10B981" /> 3 practice sessions total
                </li>
                <li style={styles.featureItem}>
                  <Check size={16} color="#10B981" /> Real-time Speech-to-Text & LLM
                </li>
                <li style={styles.featureItem}>
                  <Check size={16} color="#10B981" /> Basic performance scorecards
                </li>
                <li style={{ ...styles.featureItem, color: '#4B5563', textDecoration: 'line-through' }}>
                  Pro-tier custom RAG prompts
                </li>
              </ul>
            </div>

            <button disabled style={styles.disabledPlanBtn}>
              {user?.plan === 'free' ? 'Currently Active' : 'Starter Tier'}
            </button>
          </div>

          {/* Card 2: Pro Tier */}
          <div className="glass-card" style={{
            ...styles.card,
            borderColor: '#8B5CF6',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2)',
          }}>
            {user?.plan === 'paid' && (
              <span style={{ ...styles.currentBadge, backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#C4B5FD', borderColor: 'rgba(139, 92, 246, 0.4)' }}>
                <Star size={12} color="#A78BFA" /> Active Plan
              </span>
            )}
            <div style={styles.recommendedTag}>
              <Sparkles size={12} /> Recommended
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h3 style={{ ...styles.planName, color: '#C4B5FD' }}>Pro Interviewer</h3>
                <Zap size={18} color="#F59E0B" />
              </div>
              <p style={styles.planDesc}>Unlimited mock sessions with professional semantic RAG search & deep scoring.</p>

              <div style={styles.priceRow}>
                <span style={{ ...styles.priceNumber, color: '#A78BFA' }}>₹299</span>
                <span style={styles.pricePeriod}>/ month</span>
              </div>

              <ul style={styles.featureList}>
                <li style={{ ...styles.featureItem, color: '#F3F4F6' }}>
                  <Check size={16} color="#8B5CF6" /> <strong>Unlimited</strong> practice sessions
                </li>
                <li style={{ ...styles.featureItem, color: '#F3F4F6' }}>
                  <Check size={16} color="#8B5CF6" /> Adaptive follow-up AI interviewer
                </li>
                <li style={{ ...styles.featureItem, color: '#F3F4F6' }}>
                  <Check size={16} color="#8B5CF6" /> Deep technical & behavioral evaluation
                </li>
                <li style={{ ...styles.featureItem, color: '#F3F4F6' }}>
                  <Check size={16} color="#8B5CF6" /> Priority background job processing
                </li>
              </ul>
            </div>

            {user?.plan === 'paid' ? (
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                style={styles.cancelBtn}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
              </button>
            ) : (
              <button
                onClick={handleSimulateUpgrade}
                disabled={upgrading}
                style={styles.upgradeBtn}
              >
                {upgrading ? 'Processing Upgrade...' : 'Upgrade to Pro (₹299)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageWrapper: {
    minHeight: '100vh',
    backgroundColor: '#030712',
    color: '#F9FAFB',
    fontFamily: 'Inter, system-ui, sans-serif',
    paddingBottom: '4rem',
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
  },
  loadingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80vh',
    gap: '1rem',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: '0.875rem',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.875rem',
    color: '#9CA3AF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '2rem',
  },
  header: {
    textAlign: 'center',
    marginBottom: '3rem',
  },
  title: {
    fontSize: '2.25rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '1rem',
    maxWidth: '500px',
    margin: '0 auto',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    borderRadius: '0.75rem',
    border: '1px solid',
    marginBottom: '2rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '2rem',
  },
  card: {
    position: 'relative',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '2rem',
  },
  currentBadge: {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '0.25rem 0.625rem',
    borderRadius: '9999px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#D1D5DB',
  },
  recommendedTag: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#8B5CF6',
    color: 'white',
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  planName: {
    fontSize: '1.25rem',
    fontWeight: 800,
  },
  planDesc: {
    fontSize: '0.8125rem',
    color: '#9CA3AF',
    marginTop: '0.25rem',
    marginBottom: '1.5rem',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    marginBottom: '1.5rem',
  },
  priceNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
  },
  pricePeriod: {
    fontSize: '0.875rem',
    color: '#6B7280',
    marginLeft: '0.375rem',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
    listStyle: 'none',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    fontSize: '0.875rem',
    color: '#D1D5DB',
  },
  disabledPlanBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'rgba(31, 41, 55, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '0.5rem',
    color: '#6B7280',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'not-allowed',
  },
  upgradeBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#8B5CF6',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
    transition: 'all 0.2s',
  },
  cancelBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '0.5rem',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
