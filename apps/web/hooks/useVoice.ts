import { useEffect, useRef, useState, useCallback } from 'react';
import { WSMessage, Turn } from '@ai-interviewer/shared';

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
  const [sessionId, setSessionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextPlaybackTimeRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    const ws = new WebSocket(config.gatewayUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'session_start',
        sessionId: config.sessionId,
        timestamp: new Date().toISOString(),
      }));
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data) as WSMessage;
        switch (msg.type) {
          case 'session_started':
            setSessionId(msg.sessionId);
            if (config.onSessionStarted) config.onSessionStarted(msg.sessionId);
            break;
          case 'transcript_interim':
            if (config.onTranscriptInterim) config.onTranscriptInterim(msg.text);
            break;
          case 'transcript_final':
            if (config.onTranscriptFinal) config.onTranscriptFinal(msg.text);
            break;
          case 'turn_completed':
            if (config.onTurnCompleted) config.onTurnCompleted(msg.turn);
            break;
          case 'error':
            if (config.onError) config.onError(new Error(msg.message));
            break;
        }
      } else {
        const buffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
        playAudioBuffer(buffer);
      }
    };

    ws.onerror = () => {
      if (config.onError) config.onError(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
    };
  }, [config]);

  const disconnect = useCallback(() => {
    stopRecording();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

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

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

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

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
    } catch (err) {
      if (config.onError) config.onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    if (processorRef.current && sourceRef.current) {
      sourceRef.current.disconnect();
      processorRef.current.disconnect();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  };

  const playAudioBuffer = (arrayBuffer: ArrayBuffer) => {
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

    source.onended = () => {
      if (ctx.currentTime >= nextPlaybackTimeRef.current) {
        setIsPlaying(false);
      }
    };

    nextPlaybackTimeRef.current = startTime + audioBuffer.duration;
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isRecording,
    isPlaying,
    sessionId,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
};
