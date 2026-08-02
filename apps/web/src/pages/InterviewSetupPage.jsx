import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractTextFromPDF } from '../lib/pdf';
import {
  Sparkles,
  FileText,
  UploadCloud,
  Headphones,
  Volume2,
  CheckCircle2,
  ArrowRight,
  Briefcase,
  AlertCircle,
  RotateCcw,
  Save,
  ArrowLeft,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function InterviewSetupPage() {
  const navigate = useNavigate();

  const [jobTitle, setJobTitle] = useState('Senior Full Stack Engineer');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeMode, setResumeMode] = useState('pdf');
  const [resumeText, setResumeText] = useState('');
  const [pdfFileName, setPdfFileName] = useState(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [audioMode, setAudioMode] = useState('hands_free');

  // Auto-fill and Remember preset state
  const [hasSavedPreset, setHasSavedPreset] = useState(false);
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [rememberPresetEnabled, setRememberPresetEnabled] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load saved preset from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('interview_preset');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.jobTitle) setJobTitle(parsed.jobTitle);
        if (parsed.jobDescription) setJobDescription(parsed.jobDescription);
        if (parsed.resumeText) setResumeText(parsed.resumeText);
        if (parsed.pdfFileName) setPdfFileName(parsed.pdfFileName);
        if (parsed.resumeMode) setResumeMode(parsed.resumeMode);
        if (parsed.audioMode) setAudioMode(parsed.audioMode);
        setHasSavedPreset(true);
        setAutoFillEnabled(true);
      }
    } catch (e) {
      console.error('Failed loading saved interview preset:', e);
    }
  }, []);

  const toggleAutoFill = () => {
    if (autoFillEnabled) {
      // Turn OFF auto-fill: Clear fields for a new role/resume
      setAutoFillEnabled(false);
      setJobTitle('');
      setJobDescription('');
      setResumeText('');
      setPdfFileName(null);
    } else {
      // Turn ON auto-fill: Reload from saved preset
      setAutoFillEnabled(true);
      try {
        const saved = localStorage.getItem('interview_preset');
        if (saved) {
          const parsed = JSON.parse(saved);
          setJobTitle(parsed.jobTitle || 'Senior Full Stack Engineer');
          setJobDescription(parsed.jobDescription || '');
          setResumeText(parsed.resumeText || '');
          setPdfFileName(parsed.pdfFileName || null);
          if (parsed.resumeMode) setResumeMode(parsed.resumeMode);
          if (parsed.audioMode) setAudioMode(parsed.audioMode);
        }
      } catch (e) {}
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Please upload a valid PDF document (.pdf)');
      return;
    }

    setPdfFileName(file.name);
    setIsParsingPdf(true);
    setError(null);

    try {
      const extracted = await extractTextFromPDF(file);
      if (!extracted || extracted.length < 20) {
        throw new Error('Could not extract readable text from PDF. Please paste resume text directly.');
      }
      setResumeText(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error extracting text from PDF');
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleStartInterview = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Save or clear preset in localStorage based on candidate's remember switch
    try {
      if (rememberPresetEnabled) {
        localStorage.setItem('interview_preset', JSON.stringify({
          jobTitle,
          jobDescription,
          resumeText,
          pdfFileName,
          resumeMode,
          audioMode,
        }));
      } else {
        localStorage.removeItem('interview_preset');
      }
    } catch (e) {}

    try {
      const createRes = await fetch(`${API_URL}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobTitle.trim() || 'Software Engineer',
          jobDescription: jobDescription.trim() || null,
          resumeText: resumeText.trim() || null,
          audioMode,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error?.message || 'Failed to create interview session');
      }

      navigate(`/interview/${createData.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error starting interview');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Back to Dashboard Button */}
        <button
          id="setup-back-dashboard-btn"
          onClick={() => navigate('/')}
          style={styles.backBtn}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* Header Title */}
        <div style={styles.header}>
          <div style={styles.iconBadge}>
            <Sparkles size={20} color="#8B5CF6" />
          </div>
          <div>
            <h1 style={styles.title}>Customize Your AI Interview</h1>
            <p style={styles.subtitle}>
              Provide your target role, job description, and resume to generate tailored technical questions.
            </p>
          </div>
        </div>

        {/* Auto-fill Saved Resume & JD Toggle Switch */}
        {hasSavedPreset && (
          <div style={styles.autoFillBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <RotateCcw size={16} color="#60A5FA" />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#F3F4F6' }}>
                  Auto-fill saved Resume & JD from last session
                </span>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                  {autoFillEnabled ? 'Pre-filled from your previous session.' : 'Auto-fill disabled. Enter a new resume & JD below.'}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              id="auto-fill-toggle-btn"
              onClick={toggleAutoFill}
              style={{
                ...styles.toggleSwitchBg,
                backgroundColor: autoFillEnabled ? '#3B82F6' : 'rgba(255, 255, 255, 0.1)',
              }}
              title={autoFillEnabled ? 'Disable Auto-fill' : 'Enable Auto-fill'}
            >
              <div
                style={{
                  ...styles.toggleSwitchDot,
                  transform: autoFillEnabled ? 'translateX(20px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        )}

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={18} color="#EF4444" />
            <span>{error}</span>
          </div>
        )}

        <div style={styles.formGrid}>

          {/* 1. Target Role Title */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              <Briefcase size={15} color="#A78BFA" /> Target Role Title
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Full Stack Engineer / Frontend Specialist"
              style={styles.input}
            />
          </div>

          {/* 2. Dedicated Job Description Text Area */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              <FileText size={15} color="#A78BFA" /> Dedicated Job Description (JD) & Requirements
            </label>
            <textarea
              rows={4}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste target job description, responsibilities, required qualifications, and tech stack..."
              style={styles.textarea}
            />
          </div>

          {/* 3. Candidate Resume (PDF Upload OR Paste Text) */}
          <div style={styles.fieldGroup}>
            <div style={styles.resumeHeaderRow}>
              <label style={styles.label}>
                <FileText size={15} color="#A78BFA" /> Candidate Resume
              </label>
              <div style={styles.togglePill}>
                <button
                  type="button"
                  onClick={() => setResumeMode('pdf')}
                  style={{
                    ...styles.toggleBtn,
                    backgroundColor: resumeMode === 'pdf' ? '#8B5CF6' : 'transparent',
                    color: resumeMode === 'pdf' ? '#FFFFFF' : '#9CA3AF',
                  }}
                >
                  Upload PDF
                </button>
                <button
                  type="button"
                  onClick={() => setResumeMode('text')}
                  style={{
                    ...styles.toggleBtn,
                    backgroundColor: resumeMode === 'text' ? '#8B5CF6' : 'transparent',
                    color: resumeMode === 'text' ? '#FFFFFF' : '#9CA3AF',
                  }}
                >
                  Paste Text
                </button>
              </div>
            </div>

            {resumeMode === 'pdf' ? (
              <div style={styles.uploadDropzone}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  style={styles.fileInputHidden}
                  id="resume-pdf-upload"
                />
                <label htmlFor="resume-pdf-upload" style={styles.dropzoneLabel}>
                  <UploadCloud size={32} color="#8B5CF6" />
                  <div>
                    <span style={{ fontWeight: 700, color: '#F3F4F6' }}>
                      {pdfFileName ? pdfFileName : 'Click to select or drag & drop PDF resume'}
                    </span>
                    <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem' }}>
                      {isParsingPdf ? 'Parsing PDF text...' : 'Supports .pdf files up to 10MB'}
                    </p>
                  </div>
                </label>

                {resumeText && (
                  <div style={styles.previewBox}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                      <CheckCircle2 size={14} color="#10B981" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10B981' }}>
                        Extracted {resumeText.length} characters from PDF
                      </span>
                    </div>
                    <p style={styles.previewText}>{resumeText.slice(0, 180)}...</p>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                rows={4}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume summary, key technical projects, skills, and experience..."
                style={styles.textarea}
              />
            )}
          </div>

          {/* 4. Audio Setup Check (Earphones vs Device Speakers) */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              🎧 Audio Setup & Earphones Check
            </label>

            <div style={styles.audioOptionGrid}>

              {/* Option 1: Earphones */}
              <div
                onClick={() => setAudioMode('hands_free')}
                style={{
                  ...styles.audioCard,
                  borderColor: audioMode === 'hands_free' ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: audioMode === 'hands_free' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Headphones size={24} color={audioMode === 'hands_free' ? '#A78BFA' : '#9CA3AF'} />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#F9FAFB' }}>
                      I am wearing Earphones / Headphones
                    </span>
                    <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.125rem' }}>
                      Hands-Free Streaming Mode (continuous live conversation).
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2: Device Speakers (Push-to-Talk) */}
              <div
                onClick={() => setAudioMode('push_to_talk')}
                style={{
                  ...styles.audioCard,
                  borderColor: audioMode === 'push_to_talk' ? '#F59E0B' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: audioMode === 'push_to_talk' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Volume2 size={24} color={audioMode === 'push_to_talk' ? '#FBBF24' : '#9CA3AF'} />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#F9FAFB' }}>
                      No Earphones (Using Device Speakers)
                    </span>
                    <p style={{ fontSize: '0.75rem', color: '#FBBF24', marginTop: '0.125rem' }}>
                      Manual Push-to-Talk Mode (Click to Record / Click to Send) to prevent speaker echo feedback!
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 5. Remember Resume & JD Toggle Switch */}
          <div style={styles.rememberCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Save size={20} color="#A78BFA" />
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#F3F4F6' }}>
                  Save Resume & Job Description for future sessions
                </span>
                <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.125rem' }}>
                  {rememberPresetEnabled
                    ? 'ON: Automatically remembers and pre-fills your Resume & JD in next interview rounds.'
                    : 'OFF: Inputs will not be saved for future sessions.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="remember-preset-toggle-btn"
              onClick={() => setRememberPresetEnabled(prev => !prev)}
              style={{
                ...styles.toggleSwitchBg,
                backgroundColor: rememberPresetEnabled ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)',
              }}
              title={rememberPresetEnabled ? 'Disable Remembering Preset' : 'Enable Remembering Preset'}
            >
              <div
                style={{
                  ...styles.toggleSwitchDot,
                  transform: rememberPresetEnabled ? 'translateX(20px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>

        </div>

        {/* Action Button */}
        <div style={styles.actionRow}>
          <button
            onClick={handleStartInterview}
            disabled={isSubmitting || isParsingPdf}
            style={styles.submitBtn}
          >
            <span>{isSubmitting ? 'Initializing Room...' : 'Start Tailored Interview'}</span>
            <ArrowRight size={18} />
          </button>
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: 'calc(100vh - 60px)',
    backgroundColor: '#090D16',
    color: '#F9FAFB',
    fontFamily: 'Inter, system-ui, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
  card: {
    width: '100%',
    maxWidth: '760px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '1.25rem',
    padding: '2.25rem',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
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
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.75rem',
  },
  iconBadge: {
    width: '48px',
    height: '48px',
    borderRadius: '0.75rem',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#F9FAFB',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
    marginTop: '0.25rem',
  },
  autoFillBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1.25rem',
    marginBottom: '1.5rem',
  },
  rememberCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
  },
  toggleSwitchBg: {
    width: '44px',
    height: '24px',
    borderRadius: '9999px',
    border: 'none',
    padding: '2px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
  },
  toggleSwitchDot: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    transition: 'transform 0.2s ease-in-out',
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
  formGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#E5E7EB',
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0.625rem',
    padding: '0.75rem 1rem',
    color: '#F9FAFB',
    fontSize: '0.9375rem',
    outline: 'none',
  },
  textarea: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0.625rem',
    padding: '0.75rem 1rem',
    color: '#F9FAFB',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  resumeHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  togglePill: {
    display: 'flex',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '9999px',
    padding: '2px',
  },
  toggleBtn: {
    border: 'none',
    borderRadius: '9999px',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  uploadDropzone: {
    position: 'relative',
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    border: '2px dashed rgba(139, 92, 246, 0.3)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    textAlign: 'center',
  },
  fileInputHidden: {
    display: 'none',
  },
  dropzoneLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  previewBox: {
    marginTop: '1rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '0.5rem',
    textAlign: 'left',
  },
  previewText: {
    fontSize: '0.75rem',
    color: '#D1D5DB',
    fontStyle: 'italic',
  },
  audioOptionGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  audioCard: {
    border: '1px solid',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionRow: {
    marginTop: '2rem',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    backgroundColor: '#8B5CF6',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.875rem 1.75rem',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
    transition: 'all 0.2s',
  },
};
