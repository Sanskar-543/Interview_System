import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Plus, Clock, CheckCircle, XCircle, ArrowRight, Zap, LogOut, ShieldAlert } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const fetchData = async () => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const [sessRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/sessions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!sessRes.ok || !userRes.ok) {
        if (sessRes.status === 401 || userRes.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error('Failed to load dashboard data');
      }

      const sessData = await sessRes.json();
      const userData = await userRes.json();
      setSessions(sessData.sessions || []);
      setUser(userData.user || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleNewSession = () => {
    if (user && user.plan === 'free' && user.sessionCount >= 3) {
      setShowUpgradeModal(true);
      return;
    }

    // Navigate to customization setup page (/interview)
    navigate('/interview');
  };

  const handleViewDetails = (session) => {
    if (session.status === 'active') {
      navigate(`/interview/${session.id}`);
    } else {
      navigate(`/report/${session.id}`);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'active': return <Clock size={14} color="#F59E0B" />;
      case 'completed': return <CheckCircle size={14} color="#10B981" />;
      case 'failed': return <XCircle size={14} color="#EF4444" />;
      default: return null;
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'active': return '#F59E0B';
      case 'completed': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '1rem' }}>
        <Activity size={36} color="#3B82F6" className="animate-spin" />
        <p style={{ color: '#9CA3AF', fontSize: '0.875rem', fontWeight: 600 }}>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      {/* Top Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navLogo}>
          <Activity size={26} color="#2563EB" />
          <span style={styles.navTitle}>SpeechAI</span>
        </div>

        <div style={styles.navRight}>
          {user && <span style={styles.userGreeting}>Hey, {user.name}</span>}
          <button onClick={() => navigate('/billing')} style={styles.planBtn}>
            <Zap size={14} color={user?.plan === 'paid' ? '#A78BFA' : '#F59E0B'} />
            {user?.plan === 'paid' ? 'Pro Plan' : `Free Plan (${user?.sessionCount || 0}/3)`}
          </button>
          <button onClick={handleSignOut} style={styles.signOutBtn}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </nav>

      {/* Main Dashboard Body */}
      <main style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.heading}>Dashboard</h1>
            <p style={styles.subheading}>Your interview sessions and practice history</p>
          </div>
          <button id="new-session-btn" onClick={handleNewSession} disabled={creating} style={{
            ...styles.newSessionBtn,
            opacity: creating ? 0.7 : 1,
          }}>
            <Plus size={18} />
            {creating ? 'Creating...' : '+ New Session'}
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Sessions Grid */}
        {sessions.length === 0 ? (
          <div style={styles.emptyState}>
            <Activity size={48} color="#374151" />
            <h3 style={styles.emptyTitle}>No interview sessions yet</h3>
            <p style={styles.emptyText}>Start your first AI voice interview to begin practicing</p>
            <button onClick={handleNewSession} style={styles.newSessionBtn}>
              <Plus size={18} /> Start First Session
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {sessions.map((s) => (
              <div key={s.id} className="glass-card" style={styles.card}>
                <div style={styles.cardTop}>
                  <span style={styles.sessionId}>{s.id.slice(0, 16)}...</span>
                  <div style={{
                    ...styles.statusBadge,
                    color: statusColor(s.status),
                    borderColor: statusColor(s.status) + '33',
                    backgroundColor: statusColor(s.status) + '0D',
                  }}>
                    {statusIcon(s.status)}
                    {s.status}
                  </div>
                </div>
                <div style={styles.cardBody}>
                  <span style={styles.dateLabel}>
                    {new Date(s.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <button
                  onClick={() => handleViewDetails(s)}
                  style={styles.viewBtn}
                >
                  {s.status === 'active' ? 'Resume Session' : 'View Report'} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Upgrade Required Modal */}
      {showUpgradeModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-card" style={styles.modalContent}>
            <ShieldAlert size={48} color="#F59E0B" />
            <h2 style={styles.modalTitle}>Free Session Limit Reached</h2>
            <p style={styles.modalText}>
              You have completed 3/3 free practice sessions on the Starter tier. Upgrade to Pro for unlimited mock interviews!
            </p>
            <div style={styles.modalActions}>
              <button onClick={() => setShowUpgradeModal(false)} style={styles.modalCancelBtn}>
                Close
              </button>
              <button onClick={() => navigate('/billing')} style={styles.modalUpgradeBtn}>
                <Zap size={16} /> Upgrade to Pro (₹299/mo)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  pageWrapper: {
    minHeight: '100vh',
    backgroundColor: '#030712',
    color: '#F9FAFB',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(11, 15, 25, 0.8)',
    backdropFilter: 'blur(12px)',
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
  },
  navTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userGreeting: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    fontWeight: 500,
  },
  planBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(31, 41, 55, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '9999px',
    padding: '0.4rem 0.875rem',
    color: '#E5E7EB',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  signOutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '0.5rem',
    padding: '0.4rem 0.875rem',
    color: '#FCA5A5',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
    margin: 0,
  },
  subheading: {
    color: '#9CA3AF',
    fontSize: '0.875rem',
    marginTop: '0.25rem',
  },
  newSessionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.625rem 1.25rem',
    backgroundColor: '#2563EB',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
    transition: 'all 0.2s',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.8125rem',
    marginBottom: '1.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionId: {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    color: '#D1D5DB',
    fontWeight: 600,
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.625rem',
    border: '1px solid',
    borderRadius: '9999px',
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  dateLabel: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    padding: '0.625rem',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    border: '1px solid rgba(37, 99, 235, 0.25)',
    borderRadius: '0.375rem',
    color: '#60A5FA',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    transition: 'all 0.2s',
    marginTop: '0.25rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '4rem 2rem',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#E5E7EB',
    margin: 0,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: '0.875rem',
    maxWidth: '300px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '1rem',
  },
  modalContent: {
    maxWidth: '440px',
    width: '100%',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: '1.375rem',
    fontWeight: 800,
    marginTop: '1rem',
    marginBottom: '0.5rem',
  },
  modalText: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  modalActions: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    padding: '0.625rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.5rem',
    color: '#9CA3AF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalUpgradeBtn: {
    flex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    padding: '0.625rem',
    backgroundColor: '#8B5CF6',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
