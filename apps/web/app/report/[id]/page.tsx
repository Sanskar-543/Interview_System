'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Activity, ArrowLeft, RefreshCw, Star, Shield, Cpu, MessageSquare } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface ReportData {
  id: string;
  sessionId: string;
  userId: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  behavioralScore: number;
  feedback: string;
  createdAt: string;
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const getToken = () => localStorage.getItem('token') || '';

  useEffect(() => {
    const fetchReport = async () => {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/v1/reports/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 202) {
          setIsPending(true);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error('Could not fetch the evaluation report');
        }

        const data = await res.json();
        setReport(data.report);
      } catch (err: any) {
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [sessionId, router]);

  const handleRetry = () => {
    router.push('/interview');
  };

  const handleBackToDashboard = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Activity size={36} color="#3B82F6" style={styles.spinner} />
        <p style={styles.loadingText}>Analyzing conversational metrics...</p>
      </div>
    );
  }

  if (isPending) {
    return (
      <div style={styles.pendingContainer}>
        <Activity size={48} color="#8B5CF6" style={styles.spinner} />
        <h2 style={styles.pendingTitle}>Calculating Your Score</h2>
        <p style={styles.pendingText}>
          Our AI engines are currently assessing your technical depth, communication clarity, and behavioral alignment. This takes about 30 seconds.
        </p>
        <button
          id="retry-poll-btn"
          onClick={() => { setLoading(true); setIsPending(false); }}
          style={styles.retryBtn}
        >
          <RefreshCw size={16} /> Refresh Status
        </button>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={styles.errorContainer}>
        <h2 style={styles.errorTitle}>Evaluation Failed</h2>
        <p style={styles.errorText}>{error || 'Could not load report details.'}</p>
        <button id="error-back-btn" onClick={handleBackToDashboard} style={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  // Radial progress calculations
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (report.overallScore / 100) * circumference;

  return (
    <div style={styles.pageWrapper}>
      {/* Navbar Actions */}
      <div style={styles.topActions}>
        <button id="back-dashboard-btn" onClick={handleBackToDashboard} style={styles.backBtn}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <button id="practice-again-btn" onClick={handleRetry} style={styles.practiceBtn}>
          <RefreshCw size={16} /> Practice Again
        </button>
      </div>

      {/* Main Grid */}
      <div style={styles.bentoGrid}>
        
        {/* Bento Cell 1: Overall Score Card (Glassmorphism + Radical Ring) */}
        <div style={styles.scoreCard}>
          <h3 style={styles.cardHeading}>Overall Score</h3>
          <div style={styles.radialWrapper}>
            <svg width="160" height="160" style={styles.svg}>
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="url(#purpleBlueGradient)"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={styles.circleProgress}
              />
              <defs>
                <linearGradient id="purpleBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
            <div style={styles.scoreTextWrapper}>
              <span style={styles.scoreNumber}>{report.overallScore}</span>
              <span style={styles.scorePercent}>/ 100</span>
            </div>
          </div>
          <div style={styles.badgeWrapper}>
            <Star size={14} color="#F59E0B" />
            <span style={styles.badgeText}>
              {report.overallScore >= 85 ? 'Outstanding Performance' : report.overallScore >= 70 ? 'Competent Fit' : 'Practice Recommended'}
            </span>
          </div>
        </div>

        {/* Bento Cell 2: Category Breakdown Slider Meters */}
        <div style={styles.breakdownCard}>
          <h3 style={styles.cardHeading}>Performance Breakdown</h3>
          <div style={styles.metersList}>
            {/* Meter 1: Technical */}
            <div style={styles.meterItem}>
              <div style={styles.meterInfo}>
                <span style={styles.meterLabel}>
                  <Cpu size={14} style={{ marginRight: '6px' }} /> Technical Depth
                </span>
                <span style={styles.meterVal}>{report.technicalScore}%</span>
              </div>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${report.technicalScore}%`, backgroundColor: '#3B82F6' }} />
              </div>
            </div>

            {/* Meter 2: Communication */}
            <div style={styles.meterItem}>
              <div style={styles.meterInfo}>
                <span style={styles.meterLabel}>
                  <MessageSquare size={14} style={{ marginRight: '6px' }} /> Communication Clarity
                </span>
                <span style={styles.meterVal}>{report.communicationScore}%</span>
              </div>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${report.communicationScore}%`, backgroundColor: '#8B5CF6' }} />
              </div>
            </div>

            {/* Meter 3: Behavioral */}
            <div style={styles.meterItem}>
              <div style={styles.meterInfo}>
                <span style={styles.meterLabel}>
                  <Shield size={14} style={{ marginRight: '6px' }} /> Behavioral Alignment
                </span>
                <span style={styles.meterVal}>{report.behavioralScore}%</span>
              </div>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${report.behavioralScore}%`, backgroundColor: '#10B981' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Bento Cell 3: Detailed Feedback Panel */}
        <div style={styles.feedbackCard}>
          <h3 style={styles.cardHeading}>Detailed Review Feedback</h3>
          <div style={styles.markdownBody}>
            {report.feedback.split('\n').map((line, idx) => {
              if (line.startsWith('# ')) {
                return <h1 key={idx} style={styles.mdH1}>{line.replace('# ', '')}</h1>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={idx} style={styles.mdH2}>{line.replace('## ', '')}</h2>;
              }
              if (line.startsWith('### ')) {
                return <h3 key={idx} style={styles.mdH3}>{line.replace('### ', '')}</h3>;
              }
              if (line.startsWith('* ') || line.startsWith('- ')) {
                return <li key={idx} style={styles.mdLi}>{line.replace(/^[*-\s]+/, '')}</li>;
              }
              if (line.trim() === '') {
                return <div key={idx} style={{ height: '0.75rem' }} />;
              }
              return <p key={idx} style={styles.mdP}>{line}</p>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
    color: '#F3F4F6',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  topActions: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '2rem',
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
    transition: 'all 0.2s',
  },
  practiceBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.625rem 1.25rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  bentoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '1.5rem',
  },
  scoreCard: {
    gridColumn: 'span 4',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  breakdownCard: {
    gridColumn: 'span 8',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  feedbackCard: {
    gridColumn: 'span 12',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '2rem',
  },
  cardHeading: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#9CA3AF',
    marginBottom: '1.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    alignSelf: 'flex-start',
  },
  radialWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    transform: 'rotate(-90deg)',
  },
  circleProgress: {
    transition: 'stroke-dashoffset 0.8s ease-in-out',
  },
  scoreTextWrapper: {
    position: 'absolute',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  scoreNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1,
  },
  scorePercent: {
    fontSize: '0.75rem',
    color: '#6B7280',
    marginTop: '0.25rem',
  },
  badgeWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    borderRadius: '9999px',
    padding: '0.375rem 0.875rem',
    marginTop: '1.5rem',
  },
  badgeText: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#FBBF24',
  },
  metersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  meterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  meterInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#E5E7EB',
  },
  meterVal: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#E5E7EB',
  },
  progressBarBg: {
    height: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '9999px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.8s ease-in-out',
  },
  markdownBody: {
    color: '#D1D5DB',
    lineHeight: 1.6,
  },
  mdH1: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#FFFFFF',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '0.5rem',
    marginBottom: '1rem',
  },
  mdH2: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#F3F4F6',
    marginTop: '1.5rem',
    marginBottom: '0.75rem',
  },
  mdH3: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#E5E7EB',
    marginTop: '1.25rem',
    marginBottom: '0.5rem',
  },
  mdP: {
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  mdLi: {
    fontSize: '0.875rem',
    marginLeft: '1.25rem',
    marginBottom: '0.5rem',
    listStyleType: 'disc',
  },
  loadingContainer: {
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
    fontWeight: 600,
  },
  pendingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80vh',
    maxWidth: '500px',
    margin: '0 auto',
    textAlign: 'center',
    gap: '1rem',
    padding: '0 1rem',
  },
  pendingTitle: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  pendingText: {
    color: '#9CA3AF',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  retryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#8B5CF6',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.625rem 1.25rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80vh',
    gap: '1rem',
  },
  errorTitle: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#EF4444',
  },
  errorText: {
    color: '#9CA3AF',
    fontSize: '0.875rem',
  },
  spinner: {
    animation: 'spin 1.5s linear infinite',
  },
};
