'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { User, Mail, Award, Calendar, Zap, ArrowLeft, Shield, LogOut, CheckCircle2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface SessionItem {
  id: string;
  jobTitle: string;
  audioMode: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: string; name?: string; email?: string; plan?: string } | null>(null);
  const [sessionsList, setSessionsList] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchProfileData = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        const res = await fetch(`${API_URL}/api/v1/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSessionsList(data.sessions || []);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div style={{ backgroundColor: '#090D16', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={styles.mainWrapper}>
        
        {/* Header Title */}
        <div style={styles.headerBar}>
          <div>
            <h1 style={styles.pageTitle}>Candidate Profile</h1>
            <p style={styles.pageSubtitle}>Manage your account, view interview metrics, and check session history.</p>
          </div>
          <button id="profile-back-dashboard-btn" onClick={() => router.push('/')} style={styles.backBtn}>
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>

        {/* Profile Grid */}
        <div style={styles.gridContainer}>
          
          {/* Card 1: User Profile Card */}
          <div style={styles.profileCard}>
            <div style={styles.avatarCircle}>
              <User size={36} color="#3B82F6" />
            </div>

            <h2 style={styles.userName}>{user?.name || 'Candidate User'}</h2>
            <p style={styles.userEmail}>{user?.email || 'candidate@example.com'}</p>

            <div style={styles.planBadge}>
              <Zap size={14} color="#F59E0B" />
              <span>{user?.plan === 'pro' ? 'Pro Member (Unlimited)' : 'Free Tier (3 Sessions)'}</span>
            </div>

            <div style={styles.divider} />

            <div style={styles.accountInfoList}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Account Status</span>
                <span style={styles.activeTag}>
                  <CheckCircle2 size={12} color="#10B981" /> Active
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Target Role</span>
                <span style={styles.infoVal}>Senior Full Stack Engineer</span>
              </div>
            </div>

            <button id="profile-logout-btn" onClick={handleLogout} style={styles.logoutBtn}>
              <LogOut size={16} /> Sign Out of Account
            </button>
          </div>

          {/* Card 2: Interview Statistics & Metrics */}
          <div style={styles.statsCard}>
            <h3 style={styles.cardHeading}>Interview Performance Overview</h3>

            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <div style={styles.statIconBadge}>
                  <Calendar size={20} color="#3B82F6" />
                </div>
                <span style={styles.statNumber}>{sessionsList.length}</span>
                <span style={styles.statLabel}>Total Mock Interviews</span>
              </div>

              <div style={styles.statBox}>
                <div style={styles.statIconBadge}>
                  <Award size={20} color="#8B5CF6" />
                </div>
                <span style={styles.statNumber}>78%</span>
                <span style={styles.statLabel}>Average Overall Score</span>
              </div>

              <div style={styles.statBox}>
                <div style={styles.statIconBadge}>
                  <Shield size={20} color="#10B981" />
                </div>
                <span style={styles.statNumber}>85%</span>
                <span style={styles.statLabel}>Highest Technical Score</span>
              </div>
            </div>

            <div style={styles.divider} />

            <h3 style={styles.cardHeading}>Recent Interview Activity</h3>
            {sessionsList.length === 0 ? (
              <div style={styles.emptyBox}>
                <p style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>No mock interviews recorded yet.</p>
                <button
                  id="profile-start-first-btn"
                  onClick={() => router.push('/interview')}
                  style={styles.startBtn}
                >
                  Start Your First Interview
                </button>
              </div>
            ) : (
              <div style={styles.recentList}>
                {sessionsList.slice(0, 4).map((sess) => (
                  <div key={sess.id} style={styles.recentItem}>
                    <div>
                      <h4 style={styles.recentTitle}>{sess.jobTitle || 'Software Engineer'}</h4>
                      <span style={styles.recentDate}>
                        {new Date(sess.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <button
                      onClick={() => router.push(`/report/${sess.id}`)}
                      style={styles.viewReportBtn}
                    >
                      View Report
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mainWrapper: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '3rem 1.5rem',
    flex: 1,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  headerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2.5rem',
  },
  pageTitle: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.02em',
  },
  pageSubtitle: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    marginTop: '0.25rem',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.5rem',
    padding: '0.625rem 1rem',
    color: '#9CA3AF',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '2rem',
  },
  profileCard: {
    gridColumn: 'span 4',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1.25rem',
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  avatarCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '2px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  userName: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.25rem',
  },
  userEmail: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    marginBottom: '1rem',
  },
  planBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: '9999px',
    padding: '0.375rem 0.875rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#FBBF24',
    marginBottom: '1.5rem',
  },
  divider: {
    width: '100%',
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    margin: '1.5rem 0',
  },
  accountInfoList: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem',
  },
  infoLabel: {
    color: '#9CA3AF',
  },
  infoVal: {
    color: '#F3F4F6',
    fontWeight: 600,
  },
  activeTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: '#34D399',
    fontWeight: 700,
    fontSize: '0.75rem',
  },
  logoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '0.625rem',
    padding: '0.75rem',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '2rem',
  },
  statsCard: {
    gridColumn: 'span 8',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1.25rem',
    padding: '2rem',
  },
  cardHeading: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#FFFFFF',
    marginBottom: '1.25rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  statBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '0.875rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  statIconBadge: {
    width: '40px',
    height: '40px',
    borderRadius: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.75rem',
  },
  statNumber: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1,
    marginBottom: '0.375rem',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#9CA3AF',
    fontWeight: 600,
  },
  emptyBox: {
    textAlign: 'center',
    padding: '2rem',
  },
  startBtn: {
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.625rem 1.25rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '1rem',
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  recentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1.25rem',
  },
  recentTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#F3F4F6',
  },
  recentDate: {
    fontSize: '0.75rem',
    color: '#6B7280',
  },
  viewReportBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '0.5rem',
    padding: '0.375rem 0.875rem',
    color: '#60A5FA',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
