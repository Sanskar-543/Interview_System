'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Github,
  Twitter,
  Linkedin,
  Heart,
  ArrowLeft,
  X,
  Target,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  FileText,
  Headphones,
  BarChart3,
} from 'lucide-react';

export default function Footer() {
  const router = useRouter();
  const [activeInfoModal, setActiveInfoModal] = useState<'features' | 'about' | 'faq' | 'contact' | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Contact Form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactSent, setContactSent] = useState(false);

  const handleAuthNavigate = (path: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      router.push(path);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
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
    <>
      <footer style={styles.footerWrapper}>
        <div style={styles.footerContainer}>
          
          {/* Column 1: Brand Info */}
          <div style={styles.colBrand}>
            <div style={{ ...styles.brandHeader, cursor: 'pointer' }} onClick={() => router.push('/')}>
              <div style={styles.logoBadge}>
                <Mic size={18} color="#3B82F6" />
              </div>
              <span style={styles.brandName}>AI Interviewer</span>
            </div>
            <p style={styles.brandDesc}>
              Real-Time AI Mock Interviews powered by Deepgram Voice Streaming & OpenRouter LLMs. Practice tech interviews anytime with instant feedback.
            </p>
            <div style={styles.socialIcons}>
              <a href="https://github.com" target="_blank" rel="noreferrer" style={styles.socialIcon}>
                <Github size={16} color="#9CA3AF" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" style={styles.socialIcon}>
                <Twitter size={16} color="#9CA3AF" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" style={styles.socialIcon}>
                <Linkedin size={16} color="#9CA3AF" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div style={styles.colLinks}>
            <h4 style={styles.colTitle}>Product</h4>
            <button onClick={() => setActiveInfoModal('features')} style={styles.footerBtnLink}>
              Bento Features
            </button>
            <button onClick={() => handleAuthNavigate('/interview')} style={styles.footerBtnLink}>
              Start Mock Interview
            </button>
            <button onClick={() => setActiveInfoModal('features')} style={styles.footerBtnLink}>
              Pricing Plans
            </button>
            <button onClick={() => handleAuthNavigate('/profile')} style={styles.footerBtnLink}>
              Candidate Profile
            </button>
          </div>

          {/* Column 3: Resources & Support */}
          <div style={styles.colLinks}>
            <h4 style={styles.colTitle}>Resources</h4>
            <button onClick={() => setActiveInfoModal('about')} style={styles.footerBtnLink}>
              About Our Mission
            </button>
            <button onClick={() => setActiveInfoModal('faq')} style={styles.footerBtnLink}>
              Help & FAQs
            </button>
            <button onClick={() => setActiveInfoModal('contact')} style={styles.footerBtnLink}>
              Support & Contact
            </button>
            <button onClick={() => handleAuthNavigate('/billing')} style={styles.footerBtnLink}>
              Manage Subscription
            </button>
          </div>

          {/* Column 4: Legal & System Status */}
          <div style={styles.colLinks}>
            <h4 style={styles.colTitle}>System Status</h4>
            <div style={styles.statusBadge}>
              <div style={styles.statusDot} />
              <span style={styles.statusText}>All Voice Engines Operational</span>
            </div>
            <p style={styles.subText}>Sub-400ms streaming latency in APAC & US West regions.</p>
          </div>

        </div>

        <div style={styles.bottomBar}>
          <span style={styles.copyright}>© 2026 AI Interviewer SaaS. All rights reserved.</span>
          <span style={styles.madeWith}>Built with <Heart size={12} color="#EF4444" style={{ margin: '0 4px' }} /> for Software Engineers</span>
        </div>
      </footer>

      {/* FOOTER INFO MODAL OVERLAY */}
      {activeInfoModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalWindow}>
            
            {/* Top Bar with Explicit Back Button */}
            <div style={styles.modalTopBar}>
              <button
                id="footer-modal-back-btn"
                onClick={() => setActiveInfoModal(null)}
                style={styles.modalBackBtn}
              >
                <ArrowLeft size={16} /> Back to Page
              </button>

              <button
                onClick={() => setActiveInfoModal(null)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color="#9CA3AF" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div style={styles.modalBody}>
              
              {/* 1. FEATURES MODAL */}
              {activeInfoModal === 'features' && (
                <div>
                  <div style={styles.modalHeader}>
                    <h2 style={styles.modalTitle}>Platform Features</h2>
                    <p style={styles.modalSub}>State-of-the-art AI architecture designed to simulate real senior manager interviews.</p>
                  </div>

                  <div style={styles.bentoGrid}>
                    <div style={styles.bentoCard}>
                      <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                        <Mic size={22} color="#3B82F6" />
                      </div>
                      <h3 style={styles.bentoTitle}>Sub-400ms Live Voice Streaming</h3>
                      <p style={styles.bentoDesc}>Powered by Deepgram WebSocket streaming and OpenRouter LLMs for natural conversational turn-taking.</p>
                    </div>

                    <div style={styles.bentoCard}>
                      <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(139, 92, 246, 0.15)' }}>
                        <FileText size={22} color="#8B5CF6" />
                      </div>
                      <h3 style={styles.bentoTitle}>Resume & JD Context Tailoring</h3>
                      <p style={styles.bentoDesc}>Parses PDF resumes & custom job description text boxes to probe candidate project depth.</p>
                    </div>

                    <div style={styles.bentoCard}>
                      <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
                        <Headphones size={22} color="#10B981" />
                      </div>
                      <h3 style={styles.bentoTitle}>Speaker Echo Prevention</h3>
                      <p style={styles.bentoDesc}>Automatic earphone warning setup modal and Push-to-Talk manual recording for zero speaker feedback.</p>
                    </div>

                    <div style={styles.bentoCard}>
                      <div style={{ ...styles.bentoIcon, backgroundColor: 'rgba(245, 158, 11, 0.15)' }}>
                        <BarChart3 size={22} color="#F59E0B" />
                      </div>
                      <h3 style={styles.bentoTitle}>360° AI Performance Analytics</h3>
                      <p style={styles.bentoDesc}>Detailed score breakdowns across Technical Depth, Communication Clarity, Mistakes, and Actionable Tips.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ABOUT US MODAL */}
              {activeInfoModal === 'about' && (
                <div>
                  <div style={styles.modalHeader}>
                    <h2 style={styles.modalTitle}>About Our Mission</h2>
                    <p style={styles.modalSub}>Democratizing Technical Interview Mastery for Software Engineers Worldwide.</p>
                  </div>

                  <div style={styles.aboutGrid}>
                    <div style={styles.aboutCard}>
                      <Target size={26} color="#3B82F6" style={{ marginBottom: '0.75rem' }} />
                      <h3 style={styles.bentoTitle}>Realistic Technical Simulation</h3>
                      <p style={styles.bentoDesc}>We train our AI models to act as strict, no-nonsense Senior Engineering Managers who probe deep technical implementation details without dramatic fluff.</p>
                    </div>

                    <div style={styles.aboutCard}>
                      <Users size={26} color="#8B5CF6" style={{ marginBottom: '0.75rem' }} />
                      <h3 style={styles.bentoTitle}>Personalized Candidate Growth</h3>
                      <p style={styles.bentoDesc}>Every software engineer deserves tailored interview practice. By pairing your resume with exact job requirements, we pinpoint technical blind spots before real interviews.</p>
                    </div>

                    <div style={styles.aboutCard}>
                      <Clock size={26} color="#10B981" style={{ marginBottom: '0.75rem' }} />
                      <h3 style={styles.bentoTitle}>Instant On-Demand Practice</h3>
                      <p style={styles.bentoDesc}>No scheduling conflicts or expensive $200/hr mock interviewer fees. Practice technical interviews 24/7 on your schedule with immediate PDF report generation.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. HELP / FAQ MODAL */}
              {activeInfoModal === 'faq' && (
                <div>
                  <div style={styles.modalHeader}>
                    <h2 style={styles.modalTitle}>Help & FAQs</h2>
                    <p style={styles.modalSub}>Everything you need to know about setting up your AI technical interview.</p>
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
                </div>
              )}

              {/* 4. CONTACT MODAL */}
              {activeInfoModal === 'contact' && (
                <div>
                  <div style={styles.modalHeader}>
                    <h2 style={styles.modalTitle}>Contact Support</h2>
                    <p style={styles.modalSub}>Have questions or custom enterprise requirements? Send us a message.</p>
                  </div>

                  {contactSent ? (
                    <div style={styles.contactSuccessBox}>
                      <CheckCircle2 size={36} color="#10B981" style={{ marginBottom: '0.75rem' }} />
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFF' }}>Message Sent Successfully!</h3>
                      <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginTop: '0.25rem' }}>Our support team will respond to your inquiry within 24 hours.</p>
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
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footerWrapper: {
    backgroundColor: 'rgba(9, 13, 22, 0.95)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    padding: '4rem 1.5rem 2rem',
    color: '#9CA3AF',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  footerContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '2.5rem',
    marginBottom: '3rem',
  },
  colBrand: {
    gridColumn: 'span 4',
  },
  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    marginBottom: '1rem',
  },
  logoBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '0.5rem',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  brandDesc: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: '#9CA3AF',
    marginBottom: '1.25rem',
  },
  socialIcons: {
    display: 'flex',
    gap: '0.75rem',
  },
  socialIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colLinks: {
    gridColumn: 'span 2',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  colTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
  },
  footerBtnLink: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9CA3AF',
    fontSize: '0.875rem',
    textAlign: 'left',
    cursor: 'pointer',
    padding: 0,
    transition: 'color 0.2s',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '9999px',
    padding: '0.375rem 0.75rem',
    width: 'fit-content',
    marginBottom: '0.75rem',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#34D399',
  },
  subText: {
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    color: '#6B7280',
  },
  bottomBar: {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingTop: '1.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8125rem',
    color: '#6B7280',
  },
  madeWith: {
    display: 'flex',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  modalWindow: {
    width: '100%',
    maxWidth: '850px',
    maxHeight: '90vh',
    overflowY: 'auto',
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '1.25rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
  },
  modalTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  modalBackBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.875rem',
    color: '#9CA3AF',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modalCloseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0.375rem',
    borderRadius: '0.375rem',
  },
  modalBody: {
    padding: '2rem 1.75rem',
  },
  modalHeader: {
    marginBottom: '2rem',
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.25rem',
  },
  modalSub: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
  },
  bentoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.25rem',
  },
  bentoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.5rem',
  },
  bentoIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '0.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  bentoTitle: {
    fontSize: '1rem',
    fontWeight: 800,
    color: '#FFFFFF',
    marginBottom: '0.375rem',
  },
  bentoDesc: {
    fontSize: '0.8125rem',
    color: '#9CA3AF',
    lineHeight: 1.5,
  },
  aboutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.25rem',
  },
  aboutCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.5rem',
  },
  faqList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  faqItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '0.875rem',
    overflow: 'hidden',
  },
  faqQuestionBtn: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  faqQuestionText: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  faqAnswerBody: {
    padding: '0 1.25rem 1rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
  },
  faqAnswerText: {
    fontSize: '0.8125rem',
    color: '#9CA3AF',
    lineHeight: 1.6,
    marginTop: '0.5rem',
  },
  contactSuccessBox: {
    textAlign: 'center',
    padding: '2rem 0',
  },
  contactForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  inputLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    color: '#FFF',
    fontSize: '0.875rem',
    outline: 'none',
  },
  formTextarea: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
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
    borderRadius: '0.5rem',
    padding: '0.75rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
};
