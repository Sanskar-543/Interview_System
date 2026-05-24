'use client';

import { useState } from 'react';
import { useVoice } from '../hooks/useVoice';
import { Turn } from '@ai-interviewer/shared';
import { Mic, MicOff, Play, Square, RefreshCw, Activity, Terminal, Shield, Cpu, MessageSquare } from 'lucide-react';

export default function Home() {
  const [interimTranscript, setInterimTranscript] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const {
    isConnected,
    isRecording,
    isPlaying,
    sessionId,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useVoice({
    gatewayUrl: 'ws://localhost:5000', // Express gateway endpoint (proxied to voice-service)
    onTranscriptInterim: (text) => {
      setInterimTranscript(text);
    },
    onTranscriptFinal: (text) => {
      setInterimTranscript('');
    },
    onTurnCompleted: (turn) => {
      setTurns((prev) => [...prev, turn]);
      if (turn.role === 'assistant') {
        setLatencyMs(turn.latencyMs);
      }
    },
    onError: (err) => {
      loggerError(err.message);
    },
    onSessionStarted: (id) => {
      setTurns([]);
      setErrorMsg(null);
      setLatencyMs(null);
    },
  });

  const loggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div style={styles.container}>
      {/* Background gradients */}
      <div style={styles.radialGlow1} />
      <div style={styles.radialGlow2} />

      {/* Main layout */}
      <main style={styles.main}>
        {/* Header section */}
        <header style={styles.header}>
          <div style={styles.logoContainer}>
            <Activity style={styles.logoIcon} size={28} />
            <h1 style={styles.logoText}>SpeechAI <span style={styles.logoBadge}>Skeleton</span></h1>
          </div>
          
          <div style={styles.statusContainer}>
            <span style={{
              ...styles.statusIndicator,
              backgroundColor: isConnected ? '#10B981' : '#EF4444',
              boxShadow: isConnected ? '0 0 12px #10B981' : '0 0 12px #EF4444',
            }} />
            <span style={styles.statusText}>{isConnected ? 'SOCKET CONNECTED' : 'DISCONNECTED'}</span>
          </div>
        </header>

        {/* Content grid */}
        <div style={styles.grid}>
          {/* Left panel: Room Controls */}
          <section style={styles.panelLeft}>
            <div style={styles.cardHeader}>
              <Cpu style={styles.cardHeaderIcon} size={20} />
              <h2 style={styles.cardTitle}>Control Console</h2>
            </div>
            
            <div style={styles.sessionState}>
              <div style={styles.stateRow}>
                <span style={styles.stateLabel}>Session ID:</span>
                <span style={styles.stateValue}>{sessionId || 'Not Started'}</span>
              </div>
              <div style={styles.stateRow}>
                <span style={styles.stateLabel}>Latency Budget:</span>
                <span style={{
                  ...styles.stateValue,
                  color: latencyMs ? (latencyMs < 1500 ? '#10B981' : '#F59E0B') : '#9CA3AF'
                }}>
                  {latencyMs ? `${(latencyMs / 1000).toFixed(2)}s` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Pulsing Visualizer Frame */}
            <div style={styles.visualizerContainer}>
              <div style={{
                ...styles.pulseRing,
                animation: isRecording ? 'pulseRecording 2s infinite' : isPlaying ? 'pulsePlaying 2s infinite' : 'none',
                borderColor: isRecording ? '#3B82F6' : isPlaying ? '#8B5CF6' : '#374151',
              }} />
              <div style={{
                ...styles.pulseRingInner,
                animation: isRecording ? 'pulseRecordingInner 1.5s infinite' : isPlaying ? 'pulsePlayingInner 1.5s infinite' : 'none',
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
                {isRecording ? <MicOff size={36} color="white" /> : <Mic size={36} color="white" />}
              </button>
              
              <span style={{
                ...styles.visualizerLabel,
                color: isRecording ? '#60A5FA' : isPlaying ? '#A78BFA' : '#9CA3AF'
              }}>
                {isRecording ? 'Listening...' : isPlaying ? 'AI Speaking...' : 'Mic Standby'}
              </span>
            </div>

            {/* Connection Actions */}
            <div style={styles.actions}>
              <button 
                onClick={toggleConnection} 
                style={{
                  ...styles.btnConnection,
                  backgroundColor: isConnected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                  borderColor: isConnected ? '#EF4444' : '#2563EB',
                  color: isConnected ? '#FCA5A5' : '#93C5FD',
                }}
              >
                {isConnected ? 'Terminate Session' : 'Establish Session'}
              </button>
            </div>

            {errorMsg && (
              <div style={styles.errorAlert}>
                <span style={styles.errorText}>{errorMsg}</span>
              </div>
            )}
          </section>

          {/* Right panel: Live Transcript Feed */}
          <section style={styles.panelRight}>
            <div style={styles.cardHeader}>
              <MessageSquare style={styles.cardHeaderIcon} size={20} />
              <h2 style={styles.cardTitle}>Live Conversational Feed</h2>
            </div>

            <div style={styles.feedScroll}>
              {turns.length === 0 && !interimTranscript && (
                <div style={styles.emptyState}>
                  <Terminal size={40} style={styles.emptyIcon} />
                  <p style={styles.emptyText}>Conversational log will populate here once speech starts.</p>
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
                  <span style={styles.bubbleRole}>CANDIDATE (Interim)</span>
                  <p style={{...styles.bubbleText, fontStyle: 'italic'}}>{interimTranscript}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Embedded CSS Animations */}
      <style jsx global>{`
        @keyframes pulseRecording {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          50% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
        }
        @keyframes pulseRecordingInner {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          50% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
        }
        @keyframes pulsePlaying {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          50% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
        }
        @keyframes pulsePlayingInner {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          50% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    minHeight: '100vh',
    backgroundColor: '#030712',
    color: '#F9FAFB',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
    zIndex: 1,
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
    zIndex: 1,
    pointerEvents: 'none',
  },
  main: {
    position: 'relative',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    height: '92vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoIcon: {
    color: '#2563EB',
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.025em',
  },
  logoBadge: {
    fontSize: '0.75rem',
    color: '#8B5CF6',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    padding: '0.125rem 0.375rem',
    borderRadius: '9999px',
    marginLeft: '0.25rem',
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#111827',
    border: '1px solid #1F2937',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#E5E7EB',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '2rem',
    flex: 1,
    minHeight: 0,
  },
  panelLeft: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  },
  panelRight: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid #1F2937',
    paddingBottom: '0.75rem',
    marginBottom: '1.5rem',
  },
  cardHeaderIcon: {
    color: '#9CA3AF',
  },
  cardTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#F3F4F6',
  },
  sessionState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    backgroundColor: 'rgba(3, 7, 18, 0.4)',
    border: '1px solid #1F2937',
    borderRadius: '0.5rem',
    padding: '1rem',
    marginBottom: '2rem',
  },
  stateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.875rem',
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
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  micButton: {
    position: 'relative',
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 5,
  },
  pulseRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90px',
    height: '90px',
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
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    border: '1px solid',
    pointerEvents: 'none',
    zIndex: 4,
  },
  visualizerLabel: {
    fontSize: '0.875rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  btnConnection: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '0.5rem',
    border: '1px solid',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  errorAlert: {
    marginTop: '1.25rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
  },
  errorText: {
    fontSize: '0.8125rem',
    color: '#FCA5A5',
    fontWeight: 500,
  },
  feedScroll: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    paddingRight: '0.5rem',
    minHeight: 0,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    color: '#4B5563',
    textAlign: 'center',
    padding: '2rem',
  },
  emptyIcon: {
    color: '#374151',
  },
  emptyText: {
    fontSize: '0.875rem',
    maxWidth: '280px',
  },
  chatBubble: {
    maxWidth: '85%',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
  },
  bubbleRole: {
    fontSize: '0.625rem',
    fontWeight: 800,
    letterSpacing: '0.075em',
    color: '#9CA3AF',
  },
  bubbleText: {
    fontSize: '0.9375rem',
    lineHeight: 1.5,
    color: '#F9FAFB',
  },
  bubbleTime: {
    fontSize: '0.6875rem',
    color: '#6B7280',
    alignSelf: 'flex-end',
  },
};
