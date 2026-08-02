import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Sparkles,
  Zap,
  Mic,
  FileText,
  Headphones,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  Cpu,
  Star,
  Users,
  Target,
  Clock,
  Volume2,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState('free');

  // Help/FAQ Accordion state
  const [expandedFaq, setExpandedFaq] = useState(0);

  // Contact Form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      fetchUserDataAndSessions(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserDataAndSessions = async (token) => {
    try {
      const [sessRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/sessions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessionsList(sessData.sessions || []);
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.user?.plan) {
          setUserPlan(userData.user.plan);
        }
      }
    } catch (err) {
      console.error('Failed to load user session history or profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactSent(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactMsg('');
      setContactSent(false);
    }, 4000);
  };

  const faqs = [
    {
      q: "How does the AI tailor questions to my specific resume & job description?",
      a: "Our system parses your uploaded PDF resume and pasted target Job Description text in real-time. The AI Senior Engineering Manager analyzes required skills, candidate history, and tech stack gaps to ask tailored, realistic technical questions."
    },
    {
      q: "What is the difference between Push-to-Talk and Hands-Free audio mode?",
      a: "Hands-Free mode uses continuous Voice Activity Detection (VAD) with silence endpointing. Push-to-Talk mode gives you manual control (Click to Record / Click to Send or Spacebar) to prevent device speaker audio feedback when earphones aren't available."
    },
    {
      q: "Why do I get a warning about earphones?",
      a: "When using device speakers without earphones, the AI interviewer's spoken audio can bleed back into your microphone, triggering echo feedback loops. Our earphone warning modal ensures clear audio capture or prompts you to toggle Push-to-Talk mode."
    },
    {
      q: "How are my interview performance scores calculated?",
      a: "After ending your session, an asynchronous evaluation worker analyzes all turn transcripts across Technical Depth, Communication Clarity, and Behavioral Alignment, producing a 0-100 overall score with detailed mistakes and actionable tips."
    }
  ];

  return (
    <div style={{ backgroundColor: '#090D16', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* IF LOGGED IN: PRACTICE DASHBOARD */}
      {isLoggedIn ? (
        <main style={styles.dashboardWrapper}>
          <div style={styles.dashHeader}>
            <div>
              <h1 style={styles.dashTitle}>Candidate Dashboard</h1>
              <p style={styles.dashSub}>Track your practice interviews, review scores, and launch new mock sessions.</p>
            </div>
            <button
              id="dash-start-interview-btn"
              onClick={() => navigate('/interview')}
              style={styles.dashStartBtn}
            >
              <Sparkles size={16} /> Start New Mock Interview
            </button>
          </div>

          {/* Usage Meter / Pro Status Card */}
          {userPlan === 'paid' || userPlan === 'pro' ? (
            <div style={styles.proMeterCard}>
              <div style={styles.meterInfo}>
                <div style={styles.meterBadge}>
                  <Sparkles size={18} color="#8B5CF6" />
                  <span style={{ fontWeight: 800, color: '#C4B5FD', fontSize: '0.9375rem', letterSpacing: '0.01em' }}>
                    PRO MEMBER — UNLIMITED MOCK SESSIONS ACTIVE
                  </span>
                </div>
                <span style={styles.proInfinityBadge}>
                  ♾️ Unlimited Sessions
                </span>
              </div>
              <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                You have full access to real-time AI voice streaming, PDF report downloads, and 360° performance analytics.
              </p>
              <div style={styles.proProgressBg}>
                <div style={styles.proProgressFill} />
              </div>
            </div>
          ) : (
            <div style={styles.meterCard}>
              <div style={styles.meterInfo}>
                <div style={styles.meterBadge}>
                  <Zap size={16} color="#F59E0B" />
                  <span style={{ fontWeight: 700, color: '#FBBF24', fontSize: '0.875rem' }}>Free Plan Usage</span>
                </div>
                <span style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>{sessionsList.length} / 3 Free Sessions Used</span>
              </div>
              <div style={styles.progressBg}>
                <div style={{ ...styles.progressFill, width: `${Math.min(100, (sessionsList.length / 3) * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Session History Grid */}
          <div style={styles.historySection}>
            <h2 style={styles.sectionHeading}>Your Past Mock Interviews</h2>

            {sessionsList.length === 0 ? (
              <div style={styles.emptyHistoryCard}>
                <Mic size={40} color="#3B82F6" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#FFF' }}>No Interviews Completed Yet</h3>
                <p style={{ color: '#9CA3AF', fontSize: '0.875rem', maxWidth: '400px', margin: '0.5rem 0 1.5rem' }}>
                  Set up your target job title, paste your resume & JD, and start practicing with your AI Senior Engineering Manager!
                </p>
                <button
                  id="dash-launch-first-btn"
                  onClick={() => navigate('/interview')}
                  style={styles.dashStartBtn}
                >
                  <Sparkles size={16} /> Setup & Launch Interview
                </button>
              </div>
            ) : (
              <div style={styles.historyGrid}>
                {sessionsList.map((sess) => (
                  <div key={sess.id} style={styles.historyItemCard}>
                    <div style={styles.cardTop}>
                      <div style={styles.roleIcon}>
                        <Cpu size={18} color="#3B82F6" />
                      </div>
                      <span style={styles.cardModeBadge}>
                        {sess.audioMode === 'push_to_talk' ? '🔊 Push-to-Talk' : '🎧 Hands-Free'}
                      </span>
                    </div>

                    <h3 style={styles.cardJobTitle}>{sess.jobTitle || 'Software Engineer'}</h3>
                    <p style={styles.cardDate}>
                      {new Date(sess.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>

                    <div style={styles.cardActions}>
                      <button
                        onClick={() => navigate(`/report/${sess.id}`)}
                        style={styles.viewReportBtn}
                      >
                        View Full Score Report <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      ) : (
        /* UNAUTHENTICATED MARKETING LANDING PAGE */
        <main style={{ flex: 1 }}>

          {/* Hero Section */}
          <section style={styles.heroSection}>
            <div style={styles.latencyPill}>
              <Zap size={14} color="#3B82F6" />
              <span>Sub-400ms Real-Time AI Voice Streaming Engine</span>
            </div>

            <h1 style={styles.heroTitle}>
              Ace Tech Interviews with Real-Time <br />
              <span style={styles.gradientText}>AI Senior Engineering Managers</span>
            </h1>

            <p style={styles.heroSubtitle}>
              Tailored to your exact resume and target Job Description. Practice coding, system design, and technical depth with instantaneous voice streaming and 360° performance analytics.
            </p>

            <div style={styles.heroCtas}>
              <button
                id="hero-start-free-btn"
                onClick={() => navigate(isLoggedIn ? '/interview' : '/login')}
                style={styles.heroPrimaryBtn}
              >
                <Sparkles size={18} /> Start Free Mock Interview <ArrowRight size={18} />
              </button>
              <button
                id="hero-view-demo-btn"
                onClick={() => navigate('/login')}
                style={styles.heroSecondaryBtn}
              >
                Explore Demo Report
              </button>
            </div>

            <div style={styles.heroMetricsRow}>
              <div style={styles.heroMetricItem}>
                <span style={styles.heroMetricNumber}>10,000+</span>
                <span style={styles.heroMetricLabel}>Mock Interviews Conducted</span>
              </div>
              <div style={styles.heroMetricItem}>
                <span style={styles.heroMetricNumber}>94%</span>
                <span style={styles.heroMetricLabel}>Candidate Confidence Boost</span>
              </div>
              <div style={styles.heroMetricItem}>
                <span style={styles.heroMetricNumber}>Sub-400ms</span>
                <span style={styles.heroMetricLabel}>Voice Streaming Latency</span>
              </div>
            </div>
          </section>

          {/* Bento Features Grid Section */}
          <section id="features" style={styles.sectionWrapper}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Built for Production Competitiveness</h2>
              <p style={styles.sectionSub}>State-of-the-art AI architecture designed to simulate real senior manager interviews.</p>
            </div>

            <div style={styles.bentoGrid}>
              <div style={styles.bentoCard}>
                <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                  <Mic size={24} color="#3B82F6" />
                </div>
                <h3 style={styles.bentoTitle}>Sub-400ms Live Voice Streaming</h3>
                <p style={styles.bentoDesc}>Powered by Deepgram WebSocket streaming and OpenRouter LLMs for natural conversational turn-taking.</p>
              </div>

              <div style={styles.bentoCard}>
                <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(139, 92, 246, 0.15)' }}>
                  <FileText size={24} color="#8B5CF6" />
                </div>
                <h3 style={styles.bentoTitle}>Resume & JD Context Tailoring</h3>
                <p style={styles.bentoDesc}>Parses PDF resumes & custom job description text boxes to probe candidate project depth.</p>
              </div>

              <div style={styles.bentoCard}>
                <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
                  <Headphones size={24} color="#10B981" />
                </div>
                <h3 style={styles.bentoTitle}>Speaker Echo Prevention</h3>
                <p style={styles.bentoDesc}>Automatic earphone warning setup modal and Push-to-Talk manual recording for zero speaker feedback.</p>
              </div>

              <div style={styles.bentoCard}>
                <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
                  <BarChart3 size={24} color="#F59E0B" />
                </div>
                <h3 style={styles.bentoTitle}>360° AI Performance Analytics</h3>
                <p style={styles.bentoDesc}>Detailed score breakdowns across Technical Depth, Communication Clarity, Mistakes, and Actionable Tips.</p>
              </div>
            </div>
          </section>

          {/* About Us Section */}
          <section id="about" style={{ ...styles.sectionWrapper, backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>About Our Mission</h2>
              <p style={styles.sectionSub}>Democratizing Technical Interview Mastery for Software Engineers Worldwide.</p>
            </div>

            <div style={styles.aboutPillarsGrid}>
              <div style={styles.aboutPillarCard}>
                <Target size={28} color="#3B82F6" style={{ marginBottom: '1rem' }} />
                <h3 style={styles.pillarTitle}>Realistic Technical Simulation</h3>
                <p style={styles.pillarDesc}>We train our AI models to act as strict, no-nonsense Senior Engineering Managers who probe deep technical implementation details without dramatic fluff.</p>
              </div>

              <div style={styles.aboutPillarCard}>
                <Users size={28} color="#8B5CF6" style={{ marginBottom: '1rem' }} />
                <h3 style={styles.pillarTitle}>Personalized Candidate Growth</h3>
                <p style={styles.pillarDesc}>Every software engineer deserves tailored interview practice. By pairing your resume with exact job requirements, we pinpoint technical blind spots before real interviews.</p>
              </div>

              <div style={styles.aboutPillarCard}>
                <Clock size={28} color="#10B981" style={{ marginBottom: '1rem' }} />
                <h3 style={styles.pillarTitle}>Instant On-Demand Practice</h3>
                <p style={styles.pillarDesc}>No scheduling conflicts or expensive $200/hr mock interviewer fees. Practice technical interviews 24/7 on your schedule with immediate PDF report generation.</p>
              </div>
            </div>
          </section>

          {/* Help / FAQ Accordion Section */}
          <section id="faq" style={styles.sectionWrapper}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Frequently Asked Questions</h2>
              <p style={styles.sectionSub}>Everything you need to know about setting up your AI technical interview.</p>
            </div>

            <div style={styles.faqList}>
              {faqs.map((faq, idx) => (
                <div key={idx} style={styles.faqItem}>
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    style={styles.faqQuestionBtn}
                  >
                    <span style={styles.faqQuestionText}>{faq.q}</span>
                    {expandedFaq === idx ? <ChevronUp size={18} color="#3B82F6" /> : <ChevronDown size={18} color="#9CA3AF" />}
                  </button>
                  {expandedFaq === idx && (
                    <div style={styles.faqAnswerBody}>
                      <p style={styles.faqAnswerText}>{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Contact Us Section */}
          <section id="contact" style={{ ...styles.sectionWrapper, backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Get in Touch</h2>
              <p style={styles.sectionSub}>Have questions or custom enterprise requirements? Send us a message.</p>
            </div>

            <div style={styles.contactContainer}>
              {contactSent ? (
                <div style={styles.contactSuccessBox}>
                  <CheckCircle2 size={36} color="#10B981" style={{ marginBottom: '0.75rem' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFF' }}>Message Sent Successfully!</h3>
                  <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginTop: '0.25rem' }}>Our team will respond to your inquiry within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={styles.contactForm}>
                  <div style={styles.formRow}>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Full Name</label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="John Doe"
                        style={styles.formInput}
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Email Address</label>
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="john@example.com"
                        style={styles.formInput}
                      />
                    </div>
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>Inquiry Message</label>
                    <textarea
                      required
                      rows={4}
                      value={contactMsg}
                      onChange={(e) => setContactMsg(e.target.value)}
                      placeholder="How can we help you prepare for your technical interview?"
                      style={styles.formTextarea}
                    />
                  </div>

                  <button type="submit" style={styles.submitBtn}>
                    <Send size={16} /> Send Inquiry
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* Pricing Matrix Section */}
          <section id="pricing" style={styles.sectionWrapper}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Simple, Transparent Pricing</h2>
              <p style={styles.sectionSub}>Start practicing for free. Upgrade to Pro for unlimited mock sessions.</p>
            </div>

            <div style={styles.pricingGrid}>
              {/* Free Plan */}
              <div style={styles.pricingCard}>
                <h3 style={styles.planTitle}>Free Candidate Plan</h3>
                <div style={styles.priceRow}>
                  <span style={styles.priceVal}>$0</span>
                  <span style={styles.pricePeriod}>/ forever</span>
                </div>
                <p style={styles.planDesc}>Ideal for trying out real-time voice streaming mock sessions.</p>
                <div style={styles.planFeaturesList}>
                  <div style={styles.planFeatureItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span>3 Free Mock Sessions</span>
                  </div>
                  <div style={styles.planFeatureItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span>PDF Resume & JD Parsing</span>
                  </div>
                  <div style={styles.planFeatureItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span>Push-to-Talk & Earphone Check</span>
                  </div>
                </div>
                <button onClick={() => navigate(isLoggedIn ? '/interview' : '/login')} style={styles.freePlanBtn}>
                  Get Started Free
                </button>
              </div>

              {/* Pro Plan */}
              <div style={{ ...styles.pricingCard, border: '2px solid #3B82F6', position: 'relative' }}>
                <div style={styles.popularBadge}>MOST POPULAR</div>
                <h3 style={styles.planTitle}>Pro Engineer Plan</h3>
                <div style={styles.priceRow}>
                  <span style={styles.priceVal}>$19</span>
                  <span style={styles.pricePeriod}>/ month</span>
                </div>
                <p style={styles.planDesc}>Unlimited AI technical interviews with deep performance insights.</p>
                <div style={styles.planFeaturesList}>
                  <div style={styles.planFeatureItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span>Unlimited Mock Interviews</span>
                  </div>
                  <div style={styles.planFeatureItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span>360° Mistakes & Actionable Tips</span>
                  </div>
                  <div style={styles.planFeatureItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span>Printable PDF Report Exports</span>
                  </div>
                  <div style={styles.planFeatureItem}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <span>Priority Sub-400ms LLM Server Slots</span>
                  </div>
                </div>
                <button onClick={() => navigate(isLoggedIn ? '/billing' : '/login')} style={styles.proPlanBtn}>
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </section>

        </main>
      )}

      <Footer />
    </div>
  );
}

const styles = {
  dashboardWrapper: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '3rem 1.5rem',
    flex: 1,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  dashHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  dashTitle: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  dashSub: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    marginTop: '0.25rem',
  },
  dashStartBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.75rem 1.25rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  meterCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '2.5rem',
  },
  proMeterCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '2.5rem',
  },
  meterInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  meterBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  proInfinityBadge: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '9999px',
    padding: '0.25rem 0.75rem',
  },
  progressBg: {
    height: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '9999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: '9999px',
    transition: 'width 0.6s ease',
  },
  proProgressBg: {
    height: '0.5rem',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: '9999px',
    overflow: 'hidden',
  },
  proProgressFill: {
    height: '100%',
    width: '100%',
    background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #10B981 100%)',
    borderRadius: '9999px',
  },
  historySection: {
    marginTop: '1.5rem',
  },
  sectionHeading: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '1.25rem',
  },
  emptyHistoryCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px dashed rgba(255, 255, 255, 0.12)',
    borderRadius: '1.25rem',
    padding: '3.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  historyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.25rem',
  },
  historyItemCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1rem',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  roleIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '0.5rem',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardModeBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#9CA3AF',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: '0.25rem 0.625rem',
    borderRadius: '9999px',
  },
  cardJobTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.25rem',
  },
  cardDate: {
    fontSize: '0.75rem',
    color: '#6B7280',
    marginBottom: '1.5rem',
  },
  cardActions: {
    marginTop: 'auto',
  },
  viewReportBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '0.5rem',
    padding: '0.625rem',
    color: '#60A5FA',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  heroSection: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '6rem 1.5rem 4rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  latencyPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '9999px',
    padding: '0.375rem 1rem',
    color: '#60A5FA',
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '2rem',
  },
  heroTitle: {
    fontSize: '3.25rem',
    fontWeight: 900,
    color: '#FFFFFF',
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
    marginBottom: '1.25rem',
  },
  gradientText: {
    background: 'linear-gradient(135deg, #60A5FA 0%, #A78BFA 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1.125rem',
    color: '#9CA3AF',
    lineHeight: 1.6,
    maxWidth: '680px',
    marginBottom: '2.5rem',
  },
  heroCtas: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '4rem',
  },
  heroPrimaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '0.75rem',
    padding: '0.875rem 1.75rem',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  heroSecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1.75rem',
    color: '#E5E7EB',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  heroMetricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '3rem',
    paddingTop: '2rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    width: '100%',
  },
  heroMetricItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  heroMetricNumber: {
    fontSize: '1.75rem',
    fontWeight: 900,
    color: '#FFFFFF',
  },
  heroMetricLabel: {
    fontSize: '0.8125rem',
    color: '#9CA3AF',
    marginTop: '0.25rem',
  },
  sectionWrapper: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '5rem 1.5rem',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '3.5rem',
  },
  sectionTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.02em',
    marginBottom: '0.5rem',
  },
  sectionSub: {
    fontSize: '1rem',
    color: '#9CA3AF',
  },
  bentoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.5rem',
  },
  bentoCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1.25rem',
    padding: '2rem',
  },
  bentoIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  bentoTitle: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.5rem',
  },
  bentoDesc: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    lineHeight: 1.6,
  },
  aboutPillarsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.5rem',
  },
  aboutPillarCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1.25rem',
    padding: '2rem',
  },
  pillarTitle: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.5rem',
  },
  pillarDesc: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    lineHeight: 1.6,
  },
  faqList: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  faqItem: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1rem',
    overflow: 'hidden',
  },
  faqQuestionBtn: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  faqQuestionText: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  faqAnswerBody: {
    padding: '0 1.5rem 1.25rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
  },
  faqAnswerText: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    lineHeight: 1.6,
    marginTop: '0.75rem',
  },
  contactContainer: {
    maxWidth: '650px',
    margin: '0 auto',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1.25rem',
    padding: '2.5rem',
  },
  contactSuccessBox: {
    textAlign: 'center',
    padding: '2rem 0',
  },
  contactForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  inputLabel: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.625rem',
    padding: '0.75rem 1rem',
    color: '#FFF',
    fontSize: '0.875rem',
    outline: 'none',
  },
  formTextarea: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.625rem',
    padding: '0.75rem 1rem',
    color: '#FFF',
    fontSize: '0.875rem',
    outline: 'none',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.875rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '2rem',
    maxWidth: '850px',
    margin: '0 auto',
  },
  pricingCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '1.25rem',
    padding: '2.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
  },
  popularBadge: {
    position: 'absolute',
    top: '-12px',
    right: '24px',
    backgroundColor: '#3B82F6',
    color: '#FFF',
    fontSize: '0.6875rem',
    fontWeight: 900,
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    letterSpacing: '0.05em',
  },
  planTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.75rem',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.375rem',
    marginBottom: '0.75rem',
  },
  priceVal: {
    fontSize: '2.5rem',
    fontWeight: 900,
    color: '#FFFFFF',
  },
  pricePeriod: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
  },
  planDesc: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  planFeaturesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '2rem',
  },
  planFeatureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    fontSize: '0.875rem',
    color: '#E5E7EB',
  },
  freePlanBtn: {
    marginTop: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.625rem',
    padding: '0.75rem',
    color: '#FFF',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  proPlanBtn: {
    marginTop: 'auto',
    backgroundColor: '#3B82F6',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.75rem',
    color: '#FFF',
    fontSize: '0.875rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
