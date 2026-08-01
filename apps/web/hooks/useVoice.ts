import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage, Turn } from '@ai-interviewer/shared';

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

export interface UseVoiceConfig {
  gatewayUrl: string; // e.g., 'ws://localhost:5000'
  sessionId?: string;
  onTranscriptInterim?: (text: string) => void;
  onTranscriptFinal?: (text: string) => void;
  onTurnCompleted?: (turn: Turn) => void;
  onError?: (error: Error) => void;
  onSessionStarted?: (sessionId: string) => void;
}

export const useVoice = (config: UseVoiceConfig) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(config.sessionId || null);

  const wsRef = useRef<WebSocket | null>(null);
  const configRef = useRef<UseVoiceConfig>(config);
  configRef.current = config;

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const nextPlaybackTimeRef = useRef<number>(0);

  const stopRecording = useCallback(() => {
    // 1. Cancel animation frame loop
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // 2. Disconnect AnalyserNode
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }
      analyserRef.current = null;
    }

    // 3. Disconnect Audio Processors
    if (processorRef.current && sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        processorRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      processorRef.current = null;
      sourceRef.current = null;
    }

    // 4. Stop Media Stream Tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setMicVolume(0);
    setIsRecording(false);
  }, []);

  const disconnect = useCallback(() => {
    stopRecording();
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    setIsConnected(false);
    setStatus('idle');
  }, [stopRecording]);

  const playAudioBuffer = useCallback((arrayBuffer: ArrayBuffer) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      }

      const ctx = audioContextRef.current;
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);

      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }

      const audioBuffer = ctx.createBuffer(1, float32Array.length, 16000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlaybackTimeRef.current);

      source.start(startTime);
      setIsPlaying(true);
      setStatus('speaking'); // Transition state machine to speaking during audio playback

      source.onended = () => {
        if (ctx.currentTime >= nextPlaybackTimeRef.current) {
          setIsPlaying(false);
          setStatus((prev) => (prev === 'speaking' ? 'listening' : prev));
        }
      };

      nextPlaybackTimeRef.current = startTime + audioBuffer.duration;
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    const targetUrl = configRef.current.gatewayUrl;
    if (!targetUrl) return;

    try {
      setStatus('connecting');
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatus('listening');
        ws.send(JSON.stringify({
          type: 'session_start',
          sessionId: configRef.current.sessionId,
          timestamp: new Date().toISOString(),
        }));
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data) as WSMessage;
          switch (msg.type) {
            case 'session_started':
              setSessionId(msg.sessionId);
              setStatus('listening');
              if (configRef.current.onSessionStarted) configRef.current.onSessionStarted(msg.sessionId);
              break;
            case 'transcript_interim':
              if (configRef.current.onTranscriptInterim) configRef.current.onTranscriptInterim(msg.text);
              break;
            case 'transcript_final':
              setStatus('processing'); // AI is processing response
              if (configRef.current.onTranscriptFinal) configRef.current.onTranscriptFinal(msg.text);
              break;
            case 'turn_completed':
              if (configRef.current.onTurnCompleted) configRef.current.onTurnCompleted(msg.turn);
              break;
            case 'error':
              setStatus('error');
              if (configRef.current.onError) configRef.current.onError(new Error(msg.message));
              break;
          }
        } else {
          const buffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
          playAudioBuffer(buffer);
        }
      };

      ws.onerror = () => {
        setStatus('error');
        if (configRef.current.onError) configRef.current.onError(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        setIsConnected(false);
        setStatus('idle');
        wsRef.current = null;
      };
    } catch (err) {
      setStatus('error');
      if (configRef.current.onError) {
        configRef.current.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [playAudioBuffer]);

  const startRecording = async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Web Audio AnalyserNode for volume metering
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Real-time mic volume loop via requestAnimationFrame
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(int16Buffer.buffer);
        }
      };

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
    } catch (err) {
      if (configRef.current.onError) configRef.current.onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Explicit unmount cleanup for AnalyserNode and animationFrame to prevent memory leaks mid-session
  useEffect(() => {
    return () => {
      stopRecording();
      disconnect();
    };
  }, [stopRecording, disconnect]);

  return {
    isConnected,
    isRecording,
    isPlaying,
    status,
    micVolume,
    sessionId,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
};
