'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Plus, Clock, CheckCircle, XCircle, ArrowRight, Zap } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface SessionRecord {
  id: string;
  status: 'active' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [user, setUser] = useState<{ name: string; plan: string; sessionCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('token') || '';

  useEffect(() => {
    const fetchData = async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      try {
        const [sessRes, userRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/sessions`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/v1/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!sessRes.ok || !userRes.ok) {
          if (sessRes.status === 401 || userRes.status === 401) {
            localStorage.removeItem('token');
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch data');
        }

        const sessData = await sessRes.json();
        const userData = await userRes.json();
        setSessions(sessData.sessions);
        setUser(userData.user);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleNewSession = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create session');
      }
      setSessions(prev => [data.session, ...prev]);
      if (user) setUser({ ...user, sessionCount: user.sessionCount + 1 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock size={14} color="#F59E0B" />;
      case 'completed': return <CheckCircle size={14} color="#10B981" />;
      case 'failed': return <XCircle size={14} color="#EF4444" />;
      default: return null;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return '#F59E0B';
      case 'completed': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Activity size={32} color="#2563EB" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.heading}>Dashboard</h1>
          <p style={styles.subheading}>Your interview sessions and practice history</p>
        </div>
        <div style={styles.headerRight}>
          {user && (
            <div style={{
              ...styles.planBadge,
              backgroundColor: user.plan === 'paid' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(75, 85, 99, 0.2)',
              borderColor: user.plan === 'paid' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(75, 85, 99, 0.3)',
              color: user.plan === 'paid' ? '#A78BFA' : '#9CA3AF',
            }}>
              <Zap size={14} />
              {user.plan === 'paid' ? 'Pro Plan' : `Free Plan (${user.sessionCount}/3)`}
            </div>
          )}
          <button id="new-session-btn" onClick={handleNewSession} disabled={creating} style={{
            ...styles.newSessionBtn,
            opacity: creating ? 0.7 : 1,
          }}>
            <Plus size={18} />
            {creating ? 'Creating...' : 'New Session'}
          </button>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Sessions grid */}
      {sessions.length === 0 ? (
        <div style={styles.emptyState}>
          <Activity size={48} color="#374151" />
          <h3 style={styles.emptyTitle}>No sessions yet</h3>
          <p style={styles.emptyText}>Start your first AI interview to begin practicing</p>
          <button onClick={handleNewSession} style={styles.newSessionBtn}>
            <Plus size={18} /> Start First Session
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {sessions.map((s) => (
            <div key={s.id} style={styles.card}>
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
              <button style={styles.viewBtn}>
                View details <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  planBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.875rem',
    border: '1px solid',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
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
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    transition: 'border-color 0.2s, box-shadow 0.2s',
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
    padding: '0.5rem',
    backgroundColor: 'transparent',
    border: '1px solid #1F2937',
    borderRadius: '0.375rem',
    color: '#9CA3AF',
    fontSize: '0.75rem',
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
};
