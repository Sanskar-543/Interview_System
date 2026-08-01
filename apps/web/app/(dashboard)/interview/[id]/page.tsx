'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useVoice } from '../../../../hooks/useVoice';
import { Turn } from '@ai-interviewer/shared';
import { Mic, MicOff, Activity, Terminal, Cpu, MessageSquare, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function InterviewRoomPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [interimTranscript, setInterimTranscript] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [endingSession, setEndingSession] = useState(false);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const {
    isConnected,
    isRecording,
    isPlaying,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useVoice({
    gatewayUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000',
    sessionId,
    onTranscriptInterim: (text) => setInterimTranscript(text),
    onTranscriptFinal: () => setInterimTranscript(''),
    onTurnCompleted: (turn) => {
      setTurns((prev) => [...prev, turn]);
      if (turn.role === 'assistant') {
        setLatencyMs(turn.latencyMs);
      }
    },
    onError: (err) => loggerError(err.message),
    onSessionStarted: () => {
      setErrorMsg(null);
    },
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    // Connect to WebSocket when page loads
    connect();

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect, router]);

  const loggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    stopRecording();
    disconnect();

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/v1/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to end session');
      }

      // Redirect to score report page
      router.push(`/report/${sessionId}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error ending session');
      setEndingSession(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.radialGlow1} />
      <div style={styles.radialGlow2} />

      <main style={styles.main}>
        {/* Top Header Navigation */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <button onClick={() => router.push('/')} style={styles.backBtn}>
              <ArrowLeft size={16} /> Dashboard
            </button>
            <div style={styles.logoContainer}>
              <Activity style={{ color: '#2563EB' }} size={24} />
              <span style={styles.logoText}>SpeechAI Room</span>
            </div>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.statusBadge}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#10B981' : '#EF4444',
                boxShadow: isConnected ? '0 0 10px #10B981' : '0 0 10px #EF4444',
              }} />
              <span style={styles.statusText}>{isConnected ? 'LIVE SESSION' : 'DISCONNECTED'}</span>
            </div>

            <button
              onClick={handleEndSession}
              disabled={endingSession}
              style={{
                ...styles.endSessionBtn,
                opacity: endingSession ? 0.7 : 1,
              }}
            >
              <CheckCircle2 size={16} />
              {endingSession ? 'Evaluating...' : 'End & Evaluate'}
            </button>
          </div>
        </header>

        {/* Content Grid */}
        <div style={styles.grid}>
          {/* Left Console */}
          <section style={styles.panelLeft}>
            <div style={styles.cardHeader}>
              <Cpu size={18} color="#9CA3AF" />
              <h2 style={styles.cardTitle}>Audio Console</h2>
            </div>

            <div style={styles.sessionState}>
              <div style={styles.stateRow}>
                <span style={styles.stateLabel}>Session ID:</span>
                <span style={styles.stateValue}>{sessionId.slice(0, 16)}...</span>
              </div>
              <div style={styles.stateRow}>
                <span style={styles.stateLabel}>Response Latency:</span>
                <span style={{
                  ...styles.stateValue,
                  color: latencyMs ? (latencyMs < 1500 ? '#10B981' : '#F59E0B') : '#9CA3AF'
                }}>
                  {latencyMs ? `${(latencyMs / 1000).toFixed(2)}s` : 'Real-time'}
                </span>
              </div>
            </div>

            {/* Mic Visualizer Area */}
            <div style={styles.visualizerContainer}>
              <div style={{
                ...styles.pulseRing,
                animation: isRecording ? 'pulseGlow 2s infinite' : isPlaying ? 'pulseGlow 2s infinite' : 'none',
                borderColor: isRecording ? '#3B82F6' : isPlaying ? '#8B5CF6' : '#374151',
              }} />
              <div style={{
                ...styles.pulseRingInner,
                animation: isRecording ? 'pulseGlowInner 1.5s infinite' : isPlaying ? 'pulseGlowInner 1.5s infinite' : 'none',
                borderColor: isRecording ? '#60A5FA' : isPlaying ? '#A78BFA' : '#4B5563',
              }} />

              <button
                onClick={toggleRecording}
                disabled={!isConnected}
                style={{
                  ...styles.micButton,
                  backgroundColor: !isConnected ? '#1F2937' : isRecording ? '#EF4444' : '#2563EB',
                  cursor: !isConnected ? 'not-allowed' : 'pointer',
                  transform: isRecording ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {isRecording ? <MicOff size={34} color="white" /> : <Mic size={34} color="white" />}
              </button>

              <span style={{
                ...styles.visualizerLabel,
                color: isRecording ? '#60A5FA' : isPlaying ? '#A78BFA' : '#9CA3AF'
              }}>
                {isRecording ? 'Listening to Candidate...' : isPlaying ? 'AI Interviewer Speaking...' : 'Click Mic to Speak'}
              </span>
            </div>

            {errorMsg && (
              <div style={styles.errorAlert}>
                <AlertCircle size={16} color="#FCA5A5" />
                <span style={styles.errorText}>{errorMsg}</span>
              </div>
            )}
          </section>

          {/* Right Live Feed */}
          <section style={styles.panelRight}>
            <div style={styles.cardHeader}>
              <MessageSquare size={18} color="#9CA3AF" />
              <h2 style={styles.cardTitle}>Live Conversation Transcript</h2>
            </div>

            <div style={styles.feedScroll}>
              {turns.length === 0 && !interimTranscript && (
                <div style={styles.emptyState}>
                  <Terminal size={36} color="#374151" />
                  <p style={styles.emptyText}>Conversational turns will appear here in real time as you speak.</p>
                </div>
              )}

              {turns.map((turn, i) => (
                <div
                  key={turn.id || i}
                  style={{
                    ...styles.chatBubble,
                    alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: turn.role === 'user' ? '#1E3A8A' : '#1F2937',
                    borderLeft: turn.role === 'user' ? 'none' : '4px solid #8B5CF6',
                    borderRight: turn.role === 'user' ? '4px solid #3B82F6' : 'none',
                  }}
                >
                  <span style={styles.bubbleRole}>{turn.role === 'user' ? 'CANDIDATE' : 'INTERVIEWER'}</span>
                  <p style={styles.bubbleText}>{turn.transcript}</p>
                  <span style={styles.bubbleTime}>{new Date(turn.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}

              {interimTranscript && (
                <div style={{
                  ...styles.chatBubble,
                  alignSelf: 'flex-end',
                  backgroundColor: 'rgba(30, 58, 138, 0.5)',
                  borderRight: '4px dashed #3B82F6',
                }}>
                  <span style={styles.bubbleRole}>CANDIDATE (Listening...)</span>
                  <p style={{ ...styles.bubbleText, fontStyle: 'italic' }}>{interimTranscript}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    minHeight: '100vh',
    backgroundColor: '#030712',
    color: '#F9FAFB',
    fontFamily: 'Inter, system-ui, sans-serif',
    overflow: 'hidden',
  },
  radialGlow1: {
    position: 'absolute',
    top: '-10%',
    left: '20%',
    width: '50vw',
    height: '50vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(3, 7, 18, 0) 70%)',
    pointerEvents: 'none',
  },
  radialGlow2: {
    position: 'absolute',
    bottom: '-10%',
    right: '15%',
    width: '45vw',
    height: '45vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(3, 7, 18, 0) 75%)',
    pointerEvents: 'none',
  },
  main: {
    position: 'relative',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    height: '95vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
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
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  logoText: {
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#111827',
    border: '1px solid #1F2937',
    padding: '0.4rem 0.875rem',
    borderRadius: '9999px',
  },
  statusText: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#E5E7EB',
  },
  endSessionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.5rem 1rem',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '1.5rem',
    flex: 1,
    minHeight: 0,
  },
  panelLeft: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
  },
  panelRight: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid #1F2937',
    paddingBottom: '0.75rem',
    marginBottom: '1.25rem',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#F3F4F6',
  },
  sessionState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    backgroundColor: 'rgba(3, 7, 18, 0.5)',
    border: '1px solid #1F2937',
    borderRadius: '0.5rem',
    padding: '0.875rem',
    marginBottom: '1.5rem',
  },
  stateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8125rem',
  },
  stateLabel: {
    color: '#9CA3AF',
  },
  stateValue: {
    fontWeight: 600,
    fontFamily: 'monospace',
    color: '#E5E7EB',
  },
  visualizerContainer: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.25rem',
  },
  micButton: {
    position: 'relative',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.3s ease',
    zIndex: 5,
  },
  pulseRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '2px solid',
    pointerEvents: 'none',
    zIndex: 3,
  },
  pulseRingInner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '1px solid',
    pointerEvents: 'none',
    zIndex: 4,
  },
  visualizerLabel: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  errorAlert: {
    marginTop: '1rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  errorText: {
    fontSize: '0.75rem',
    color: '#FCA5A5',
    fontWeight: 500,
  },
  feedScroll: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    paddingRight: '0.375rem',
    minHeight: 0,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    color: '#4B5563',
    textAlign: 'center',
    padding: '1.5rem',
  },
  emptyText: {
    fontSize: '0.8125rem',
    maxWidth: '260px',
  },
  chatBubble: {
    maxWidth: '85%',
    borderRadius: '0.75rem',
    padding: '0.875rem 1.125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  bubbleRole: {
    fontSize: '0.625rem',
    fontWeight: 800,
    letterSpacing: '0.075em',
    color: '#9CA3AF',
  },
  bubbleText: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    color: '#F9FAFB',
  },
  bubbleTime: {
    fontSize: '0.6875rem',
    color: '#6B7280',
    alignSelf: 'flex-end',
  },
};
