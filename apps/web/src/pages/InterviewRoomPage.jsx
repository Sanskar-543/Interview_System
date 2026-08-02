import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useVoice } from '../hooks/useVoice';
import {
  Mic,
  MicOff,
  PhoneOff,
  MessageSquare,
  Settings,
  ArrowLeft,
  X,
  Volume2,
  Sparkles,
  UserCheck,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function InterviewRoomPage() {
  const navigate = useNavigate();
  const params = useParams();
  const sessionId = params.id;

  const [interimTranscript, setInterimTranscript] = useState('');
  const [turns, setTurns] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [endingSession, setEndingSession] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const scrollRef = useRef(null);
  const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '');

  const {
    isConnected,
    isRecording,
    status,
    micVolume,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    submitTurn,
  } = useVoice({
    gatewayUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:5000',
    sessionId,
    onTranscriptInterim: (text) => setInterimTranscript(text),
    onTranscriptFinal: () => setInterimTranscript(''),
    onTurnCompleted: (turn) => {
      setTurns((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === turn.id);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = turn;
          return updated;
        }
        return [...prev, turn];
      });
      if (turn.role === 'assistant') {
        setLatencyMs(turn.latencyMs);
      }
    },
    onError: (err) => loggerError(err.message),
  });

  // Session elapsed timer (MM:SS)
  useEffect(() => {
    let timer = null;
    if (isConnected) {
      timer = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isConnected]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }
    connect();
    return () => {
      disconnect();
    };
  }, [sessionId]); // Run connect on initial mount only

  // Auto-scroll transcript drawer to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, interimTranscript]);

  const loggerError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  const [sessionInfo, setSessionInfo] = useState(null);

  // Fetch session metadata (jobTitle, audioMode)
  useEffect(() => {
    const fetchSession = async () => {
      const token = getToken();
      if (!token || !sessionId) return;
      try {
        const res = await fetch(`${API_URL}/api/v1/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setSessionInfo({
              jobTitle: data.session.jobTitle,
              audioMode: data.session.audioMode,
            });
          }
        }
      } catch (e) {
        // Fallback
      }
    };
    fetchSession();
  }, [sessionId]);

  const toggleRecording = () => {
    if (isRecording) {
      submitTurn();
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

      navigate(`/report/${sessionId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error ending session');
      setEndingSession(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // State text mapping
  const getStatusMessage = () => {
    if (status === 'speaking') {
      return 'AI Interviewer speaking...';
    }
    if (status === 'processing') {
      return 'AI is evaluating your answer...';
    }
    if (isRecording) {
      return 'Listening to your response...';
    }
    if (isConnected) {
      return 'Microphone ready — Speak or click to answer';
    }
    if (status === 'connecting') {
      return 'Connecting to AI Interviewer...';
    }
    return 'Connection interrupted. Click Reconnect above.';
  };

  return (
    <div style={styles.videoRoomWrapper}>

      {/* 1. TOP MINIMAL HEADER BAR */}
      <header style={styles.topHeader}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate('/')} style={styles.dashboardBackBtn}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          <div style={styles.roomBadge}>
            <Sparkles size={14} color="#8B5CF6" />
            <span style={styles.roomTitle}>{sessionInfo?.jobTitle ? `${sessionInfo.jobTitle} Mock Interview` : 'AI Senior Technical Interview'}</span>
          </div>
          {sessionInfo?.audioMode && (
            <div
              style={{
                ...styles.audioModeBadge,
                backgroundColor: sessionInfo.audioMode === 'push_to_talk' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                borderColor: sessionInfo.audioMode === 'push_to_talk' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(139, 92, 246, 0.3)',
                color: sessionInfo.audioMode === 'push_to_talk' ? '#FBBF24' : '#C4B5FD',
              }}
            >
              <span>{sessionInfo.audioMode === 'push_to_talk' ? '🔊 Push-to-Talk (Device Speakers)' : '🎧 Hands-Free (Earphones)'}</span>
            </div>
          )}
        </div>

        <div style={styles.headerRight}>
          {/* Interview Timer */}
          <div style={styles.timerBadge}>
            <span style={styles.timerText}>⏱️ {formatTimer(secondsElapsed)}</span>
          </div>

          {/* Connection Status Dot & Reconnect Button */}
          <div style={styles.connectionBadge}>
            <span
              style={{
                ...styles.connectionDot,
                backgroundColor: isConnected ? '#10B981' : status === 'connecting' ? '#F59E0B' : '#EF4444',
                boxShadow: isConnected ? '0 0 10px #10B981' : '0 0 10px #EF4444',
              }}
            />
            <span style={styles.connectionText}>
              {isConnected ? 'CONNECTED' : status === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}
            </span>

            {!isConnected && status !== 'connecting' && (
              <button
                id="reconnect-voice-btn"
                onClick={() => connect()}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '0.375rem',
                  padding: '0.25rem 0.5rem',
                  color: '#FCA5A5',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: '0.5rem',
                }}
              >
                🔄 Reconnect
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN CENTER INTERVIEW TILE (~70% VIEWPORT) */}
      <main style={styles.stageViewport}>
        <div style={styles.mainTile}>

          {/* Animated Audio-Reactive Ring Container around Avatar */}
          <div style={styles.avatarStage}>
            {/* Outer Expanding Pulse Ring — Active strictly on "speaking" */}
            <div
              style={{
                ...styles.pulseRingOuter,
                opacity: status === 'speaking' ? 0.8 : status === 'processing' ? 0.4 : 0.1,
                transform: status === 'speaking' ? 'scale(1.25)' : 'scale(1)',
                animation: status === 'speaking' ? 'pulseRingActive 1.6s ease-in-out infinite' : 'none',
              }}
            />
            {/* Inner Glowing Ring */}
            <div
              style={{
                ...styles.pulseRingInner,
                borderColor: status === 'speaking' ? '#8B5CF6' : status === 'processing' ? '#F59E0B' : 'rgba(255,255,255,0.1)',
                boxShadow: status === 'speaking' ? '0 0 40px rgba(139, 92, 246, 0.6)' : 'none',
              }}
            />

            {/* Professional AI Interviewer Illustrated Avatar */}
            <div style={styles.avatarWrapper}>
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="48" fill="url(#avatarGradient)" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" />
                <path d="M50 30C41.7157 30 35 36.7157 35 45C35 53.2843 41.7157 60 50 60C58.2843 60 65 53.2843 65 45C65 36.7157 58.2843 30 50 30Z" fill="#E2E8F0" />
                <path d="M25 80C25 68.9543 33.9543 60 45 60H55C66.0457 60 75 68.9543 75 80V84H25V80Z" fill="#94A3B8" />
                <circle cx="50" cy="42" r="4" fill="#3B82F6" />
                <defs>
                  <linearGradient id="avatarGradient" x1="0" y1="0" x2="100" y2="100">
                    <stop offset="0%" stopColor="#1E293B" />
                    <stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Interviewer Info & Live Status Label */}
          <div style={styles.interviewerInfo}>
            <h2 style={styles.interviewerName}>AI Interviewer</h2>
            <div style={styles.statusRow}>
              {status === 'speaking' && <Volume2 size={14} color="#C4B5FD" className="animate-pulse" />}
              <span
                style={{
                  ...styles.statusMessage,
                  color: status === 'speaking' ? '#C4B5FD' : status === 'processing' ? '#FDE68A' : '#9CA3AF',
                }}
              >
                {getStatusMessage()}
              </span>
            </div>
          </div>

          {/* Latency Indicator Tag */}
          {latencyMs && (
            <div style={styles.latencyTag}>
              <span>Latency: {(latencyMs / 1000).toFixed(2)}s</span>
            </div>
          )}
        </div>

        {/* 3. SELF-VIEW PIP TILE (BOTTOM-RIGHT CORNER) */}
        <div style={styles.selfViewPIP}>
          <div style={styles.pipHeader}>
            <UserCheck size={12} color="#10B981" />
            <span style={styles.pipName}>You</span>
          </div>

          {/* Real-time 5-Bar Mic Volume Equalizer */}
          <div style={styles.equalizerContainer}>
            {[0.4, 0.7, 1.0, 0.6, 0.3].map((multiplier, idx) => {
              const barHeight = isRecording ? Math.max(4, Math.min(24, Math.round((micVolume / 100) * 24 * multiplier))) : 3;
              return (
                <div
                  key={idx}
                  style={{
                    ...styles.eqBar,
                    height: `${barHeight}px`,
                    backgroundColor: isRecording ? '#3B82F6' : '#4B5563',
                  }}
                />
              );
            })}
          </div>

          <div style={styles.pipStatusBadge}>
            {isRecording ? (
              <span style={{ fontSize: '0.6875rem', color: '#60A5FA', fontWeight: 600 }}>Mic Active</span>
            ) : (
              <span style={{ fontSize: '0.6875rem', color: '#EF4444', fontWeight: 600 }}>Muted</span>
            )}
          </div>
        </div>
      </main>

      {/* 4. BOTTOM FLOATING CONTROL BAR (ZOOM/MEET STYLE) */}
      <footer style={styles.bottomControlBar}>
        <div style={styles.controlPill}>

          {/* Push-to-Talk prominent Record/Send Pill or Standard Mic Toggle */}
          {sessionInfo?.audioMode === 'push_to_talk' ? (
            <button
              onClick={toggleRecording}
              disabled={!isConnected}
              style={{
                ...styles.pushToTalkBtn,
                backgroundColor: isRecording ? '#EF4444' : '#F59E0B',
                boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.6)' : '0 0 20px rgba(245, 158, 11, 0.4)',
              }}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              <span>{isRecording ? '📤 Click to Send Answer' : '🎙️ Click to Record Answer'}</span>
            </button>
          ) : (
            <button
              onClick={toggleRecording}
              disabled={!isConnected}
              style={{
                ...styles.controlBtn,
                backgroundColor: isRecording ? 'rgba(255, 255, 255, 0.08)' : '#EF4444',
                color: isRecording ? '#F3F4F6' : '#FFFFFF',
                borderColor: isRecording ? 'rgba(255, 255, 255, 0.15)' : '#DC2626',
              }}
              title={isRecording ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
          )}

          {/* Toggle Transcript Panel Button */}
          <button
            onClick={() => setShowTranscript((prev) => !prev)}
            style={{
              ...styles.controlBtn,
              backgroundColor: showTranscript ? '#8B5CF6' : 'rgba(255, 255, 255, 0.08)',
              color: 'white',
              borderColor: showTranscript ? '#7C3AED' : 'rgba(255, 255, 255, 0.15)',
            }}
            title="Toggle Transcript Drawer"
          >
            <MessageSquare size={20} />
            {turns.length > 0 && <span style={styles.turnBadge}>{turns.length}</span>}
          </button>

          {/* Settings Button Placeholder */}
          <button style={styles.controlBtn} title="Audio Settings">
            <Settings size={20} />
          </button>

          {/* End Call / Leave Interview Button */}
          <button
            onClick={handleEndSession}
            disabled={endingSession}
            style={styles.endCallBtn}
            title="End Interview & Evaluate"
          >
            <PhoneOff size={18} />
            <span>{endingSession ? 'Evaluating...' : 'End Call'}</span>
          </button>
        </div>
      </footer>

      {/* 5. COLLAPSIBLE SIDE TRANSCRIPT DRAWER */}
      {showTranscript && (
        <aside style={styles.transcriptDrawer}>
          <div style={styles.drawerHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={16} color="#A78BFA" />
              <h3 style={styles.drawerTitle}>Live Transcript</h3>
            </div>
            <button onClick={() => setShowTranscript(false)} style={styles.closeDrawerBtn}>
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} style={styles.drawerScroll}>
            {turns.length === 0 && !interimTranscript && (
              <p style={styles.emptyDrawerText}>No conversation turns logged yet. Speak to begin your interview.</p>
            )}

            {turns.map((turn, i) => (
              <div
                key={turn.id || i}
                style={{
                  ...styles.drawerBubble,
                  backgroundColor: turn.role === 'user' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(31, 41, 55, 0.6)',
                  borderLeft: turn.role === 'user' ? '3px solid #3B82F6' : '3px solid #8B5CF6',
                }}
              >
                <div style={styles.bubbleMeta}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: turn.role === 'user' ? '#93C5FD' : '#C4B5FD' }}>
                    {turn.role === 'user' ? 'YOU' : 'AI INTERVIEWER'}
                  </span>
                  <span style={styles.bubbleTime}>{new Date(turn.createdAt).toLocaleTimeString()}</span>
                </div>
                <p style={styles.bubbleBody}>{turn.transcript}</p>
              </div>
            ))}

            {interimTranscript && (
              <div style={{ ...styles.drawerBubble, backgroundColor: 'rgba(37, 99, 235, 0.08)', borderLeft: '3px dashed #3B82F6' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#93C5FD' }}>YOU (Speaking...)</span>
                <p style={{ ...styles.bubbleBody, fontStyle: 'italic', opacity: 0.8 }}>{interimTranscript}</p>
              </div>
            )}
          </div>
        </aside>
      )}

      <style>{`
        @keyframes pulseRingActive {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.22);
            opacity: 0.4;
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  videoRoomWrapper: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#090D16',
    color: '#F9FAFB',
    fontFamily: 'Inter, system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topHeader: {
    height: '60px',
    padding: '0 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(12px)',
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  dashboardBackBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    color: '#9CA3AF',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  roomBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  audioModeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.625rem',
    borderRadius: '9999px',
    border: '1px solid',
  },
  pushToTalkBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    border: 'none',
    borderRadius: '9999px',
    padding: '0.625rem 1.25rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  roomTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#F3F4F6',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  timerBadge: {
    backgroundColor: 'rgba(31, 41, 55, 0.6)',
    padding: '0.25rem 0.625rem',
    borderRadius: '0.375rem',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  timerText: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#E5E7EB',
  },
  connectionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'rgba(31, 41, 55, 0.6)',
    padding: '0.25rem 0.625rem',
    borderRadius: '9999px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  connectionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  connectionText: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#D1D5DB',
  },
  stageViewport: {
    position: 'relative',
    flex: 1,
    padding: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTile: {
    position: 'relative',
    width: '100%',
    maxWidth: '960px',
    height: 'calc(100% - 2rem)',
    maxHeight: '620px',
    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '1.25rem',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
  },
  avatarStage: {
    position: 'relative',
    width: '120px',
    height: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRingOuter: {
    position: 'absolute',
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    border: '2px solid #8B5CF6',
    transition: 'all 0.3s ease',
    pointerEvents: 'none',
  },
  pulseRingInner: {
    position: 'absolute',
    width: '124px',
    height: '124px',
    borderRadius: '50%',
    border: '2px solid',
    transition: 'all 0.3s ease',
    pointerEvents: 'none',
  },
  avatarWrapper: {
    position: 'relative',
    zIndex: 2,
  },
  interviewerInfo: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  interviewerName: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#F9FAFB',
    letterSpacing: '-0.01em',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    justifyContent: 'center',
  },
  statusMessage: {
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  latencyTag: {
    position: 'absolute',
    bottom: '1rem',
    left: '1rem',
    fontSize: '0.75rem',
    color: '#6B7280',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  selfViewPIP: {
    position: 'absolute',
    bottom: '2.5rem',
    right: '2.5rem',
    width: '180px',
    height: '120px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0.875rem',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  pipHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  pipName: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#E5E7EB',
  },
  equalizerContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '4px',
    height: '30px',
  },
  eqBar: {
    width: '4px',
    borderRadius: '2px',
    transition: 'height 0.1s ease',
  },
  pipStatusBadge: {
    alignSelf: 'flex-end',
  },
  bottomControlBar: {
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '1rem',
    zIndex: 10,
  },
  controlPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '9999px',
    padding: '0.625rem 1.25rem',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
  },
  controlBtn: {
    position: 'relative',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  turnBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: '#3B82F6',
    color: 'white',
    fontSize: '0.625rem',
    fontWeight: 800,
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#EF4444',
    border: 'none',
    borderRadius: '9999px',
    padding: '0.625rem 1.25rem',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
    transition: 'all 0.2s',
  },
  transcriptDrawer: {
    position: 'absolute',
    top: '60px',
    right: 0,
    width: '360px',
    height: 'calc(100vh - 60px)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(16px)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 20,
  },
  drawerHeader: {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#F9FAFB',
  },
  closeDrawerBtn: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
  },
  drawerScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  emptyDrawerText: {
    color: '#6B7280',
    fontSize: '0.8125rem',
    textAlign: 'center',
    marginTop: '2rem',
  },
  drawerBubble: {
    padding: '0.75rem 0.875rem',
    borderRadius: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  bubbleMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bubbleTime: {
    fontSize: '0.625rem',
    color: '#6B7280',
  },
  bubbleBody: {
    fontSize: '0.8125rem',
    color: '#F3F4F6',
    lineHeight: 1.5,
  },
};
