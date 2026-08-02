'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  Star,
  Shield,
  Cpu,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  BarChart3,
  Sparkles,
  Download,
  Share2,
  Copy,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'insights'>('overview');
  const [copiedLink, setCopiedLink] = useState(false);

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

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#090D16', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={styles.loadingContainer}>
          <Activity size={36} color="#3B82F6" style={styles.spinner} />
          <p style={styles.loadingText}>Analyzing conversational metrics & insights...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (isPending) {
    return (
      <div style={{ backgroundColor: '#090D16', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={styles.pendingContainer}>
          <Activity size={48} color="#8B5CF6" style={styles.spinner} />
          <h2 style={styles.pendingTitle}>Calculating Your Score</h2>
          <p style={styles.pendingText}>
            Our AI engines are assessing your technical depth, communication clarity, mistakes, and recommendations.
          </p>
          <button
            id="retry-poll-btn"
            onClick={() => { setLoading(true); setIsPending(false); }}
            style={styles.retryBtn}
          >
            <RefreshCw size={16} /> Refresh Status
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ backgroundColor: '#090D16', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={styles.errorContainer}>
          <h2 style={styles.errorTitle}>Evaluation Failed</h2>
          <p style={styles.errorText}>{error || 'Could not load report details.'}</p>
          <button id="error-back-btn" onClick={() => router.push('/')} style={styles.backBtn}>
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  // Parse feedback markdown sections
  const parseFeedbackSections = (text: string) => {
    const sections: { appreciation: string[]; mistakes: string[]; tips: string[]; general: string[] } = {
      appreciation: [],
      mistakes: [],
      tips: [],
      general: [],
    };

    let currentCat: 'appreciation' | 'mistakes' | 'tips' | 'general' = 'general';
    const lines = text.split('\n');

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('appreciation') || lower.includes('strength')) {
        currentCat = 'appreciation';
        continue;
      }
      if (lower.includes('mistake') || lower.includes('improvement') || lower.includes('blind spot')) {
        currentCat = 'mistakes';
        continue;
      }
      if (lower.includes('tip') || lower.includes('recommendation') || lower.includes('actionable')) {
        currentCat = 'tips';
        continue;
      }

      const cleanLine = line.replace(/^[*#\-\d\.]+\s*/, '').trim();
      if (cleanLine) {
        sections[currentCat].push(cleanLine);
      }
    }

    return sections;
  };

  const parsedSections = parseFeedbackSections(report.feedback);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (report.overallScore / 100) * circumference;

  return (
    <div style={{ backgroundColor: '#090D16', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main className="pageWrapper" style={styles.pageWrapper}>
        
        {/* Top Header Actions */}
        <div style={styles.topActions} className="no-print">
          <button id="back-dashboard-btn" onClick={() => router.push('/')} style={styles.backBtn}>
            <ArrowLeft size={16} /> Dashboard
          </button>

          {/* Sliding Pill Tab Switcher */}
          <div style={styles.tabSliderPill}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === 'overview' ? '#8B5CF6' : 'transparent',
                color: activeTab === 'overview' ? '#FFFFFF' : '#9CA3AF',
              }}
            >
              <BarChart3 size={15} />
              <span>Score Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              style={{
                ...styles.tabBtn,
                backgroundColor: activeTab === 'insights' ? '#8B5CF6' : 'transparent',
                color: activeTab === 'insights' ? '#FFFFFF' : '#9CA3AF',
              }}
            >
              <Sparkles size={15} />
              <span>Insights & Mistakes</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button id="download-pdf-btn" onClick={handleDownloadPdf} style={styles.exportBtn}>
              <Download size={15} /> Download PDF
            </button>

            <button id="share-link-btn" onClick={handleCopyShareLink} style={styles.shareBtn}>
              <Share2 size={15} /> {copiedLink ? 'Link Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* TAB 1: SCORE OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={styles.bentoGrid}>
            
            {/* Overall Score Card */}
            <div style={styles.scoreCard} className="scoreCard">
              <h3 style={styles.cardHeading} className="cardHeading">Overall Score</h3>
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
                  <span style={styles.scoreNumber} className="scoreNumber">{report.overallScore}</span>
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

            {/* Category Breakdown Meters */}
            <div style={styles.breakdownCard} className="breakdownCard">
              <h3 style={styles.cardHeading} className="cardHeading">Performance Breakdown</h3>
              <div style={styles.metersList}>
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

            {/* Summary Box */}
            <div style={styles.feedbackCard} className="feedbackCard">
              <h3 style={styles.cardHeading} className="cardHeading">Performance Summary</h3>
              <div style={styles.markdownBody}>
                {report.feedback.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h2 key={idx} style={styles.mdH2}>{line.replace('# ', '')}</h2>;
                  }
                  if (line.startsWith('* ') || line.startsWith('- ')) {
                    return <li key={idx} style={styles.mdLi}>{line.replace(/^[*-\s]+/, '')}</li>;
                  }
                  if (line.trim() === '') return <div key={idx} style={{ height: '0.5rem' }} />;
                  return <p key={idx} style={styles.mdP}>{line}</p>;
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INSIGHTS, MISTAKES & TIPS */}
        {activeTab === 'insights' && (
          <div style={styles.insightsStack}>
            
            {/* Section 1: Mistakes & Blind Spots */}
            <div style={{ ...styles.insightCard, borderLeft: '4px solid #EF4444' }} className="insightCard">
              <div style={styles.insightCardHeader}>
                <div style={{ ...styles.insightIconBadge, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <AlertTriangle size={20} color="#EF4444" />
                </div>
                <div>
                  <h3 style={{ ...styles.insightCardTitle, color: '#FCA5A5' }} className="insightCardTitle">Mistakes & Technical Blind Spots</h3>
                  <p style={styles.insightCardSub}>Specific technical errors, vague statements, or missed concepts identified during your turns.</p>
                </div>
              </div>

              <div style={styles.insightList}>
                {(parsedSections.mistakes.length > 0 ? parsedSections.mistakes : [
                  "Missed quantifying architectural trade-offs with concrete QPS/RPS numbers.",
                  "Left answer vague when questioned about error recovery strategies.",
                ]).map((item, idx) => (
                  <div key={idx} style={styles.insightListItem}>
                    <span style={{ color: '#EF4444', fontWeight: 800 }}>•</span>
                    <span style={{ color: '#F3F4F6', fontSize: '0.875rem' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Actionable Tips & Recommendations */}
            <div style={{ ...styles.insightCard, borderLeft: '4px solid #F59E0B' }} className="insightCard">
              <div style={styles.insightCardHeader}>
                <div style={{ ...styles.insightIconBadge, backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                  <Lightbulb size={20} color="#FBBF24" />
                </div>
                <div>
                  <h3 style={{ ...styles.insightCardTitle, color: '#FDE68A' }} className="insightCardTitle">Actionable Tips & Coaching</h3>
                  <p style={styles.insightCardSub}>Specific recommendations to elevate your responses in your next real interview.</p>
                </div>
              </div>

              <div style={styles.insightList}>
                {(parsedSections.tips.length > 0 ? parsedSections.tips : [
                  "Quantify project impact using the STAR framework (Situation, Task, Action, Result).",
                  "Be ready to explain specific cache eviction policies when discussing Redis.",
                ]).map((item, idx) => (
                  <div key={idx} style={styles.insightListItem}>
                    <span style={{ color: '#F59E0B', fontWeight: 800 }}>•</span>
                    <span style={{ color: '#F3F4F6', fontSize: '0.875rem' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Appreciation & Key Strengths */}
            <div style={{ ...styles.insightCard, borderLeft: '4px solid #10B981' }} className="insightCard">
              <div style={styles.insightCardHeader}>
                <div style={{ ...styles.insightIconBadge, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <CheckCircle2 size={20} color="#10B981" />
                </div>
                <div>
                  <h3 style={{ ...styles.insightCardTitle, color: '#6EE7B7' }} className="insightCardTitle">Appreciation & Strengths</h3>
                  <p style={styles.insightCardSub}>Well-articulated answers, strong tech stack alignment, and positive performance highlights.</p>
                </div>
              </div>

              <div style={styles.insightList}>
                {(parsedSections.appreciation.length > 0 ? parsedSections.appreciation : [
                  "Maintained structured and articulate dialogue throughout the entire session.",
                  "Demonstrated solid core alignment with full-stack engineering principles.",
                ]).map((item, idx) => (
                  <div key={idx} style={styles.insightListItem}>
                    <span style={{ color: '#10B981', fontWeight: 800 }}>•</span>
                    <span style={{ color: '#F3F4F6', fontSize: '0.875rem' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
    flex: 1,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  topActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  tabSliderPill: {
    display: 'flex',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '9999px',
    padding: '3px',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    border: 'none',
    borderRadius: '9999px',
    padding: '0.5rem 1.25rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.5rem',
    padding: '0.625rem 1rem',
    color: '#E5E7EB',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.625rem 1rem',
    color: 'white',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
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
    fontSize: '0.9375rem',
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
  mdH2: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#F3F4F6',
    marginTop: '1rem',
    marginBottom: '0.5rem',
  },
  mdP: {
    fontSize: '0.875rem',
    marginBottom: '0.75rem',
  },
  mdLi: {
    fontSize: '0.875rem',
    marginLeft: '1.25rem',
    marginBottom: '0.375rem',
    listStyleType: 'disc',
  },
  insightsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  insightCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    backdropFilter: 'blur(12px)',
    borderRadius: '1rem',
    padding: '1.75rem',
  },
  insightCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  insightIconBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '0.75rem',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCardTitle: {
    fontSize: '1.125rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  insightCardSub: {
    fontSize: '0.8125rem',
    color: '#9CA3AF',
    marginTop: '0.125rem',
  },
  insightList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  insightListItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '0.625rem',
    padding: '0.75rem 1rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '70vh',
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
    height: '70vh',
    maxWidth: '500px',
    margin: '0 auto',
    textAlign: 'center',
    gap: '1rem',
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
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '70vh',
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
