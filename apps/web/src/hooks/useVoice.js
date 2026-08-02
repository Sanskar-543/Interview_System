import { useEffect, useRef, useState, useCallback } from 'react';

export const useVoice = (config) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('idle');
  const [micVolume, setMicVolume] = useState(0);
  const [sessionId, setSessionId] = useState(config.sessionId || null);

  const wsRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const nextPlaybackTimeRef = useRef(0);

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
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

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

  const audioQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);
  const activeSourcesRef = useRef([]);

  const stopAllAudio = useCallback(() => {
    audioQueueRef.current = [];
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // Ignore already stopped sources
      }
    });
    activeSourcesRef.current = [];
    if (audioContextRef.current) {
      nextPlaybackTimeRef.current = audioContextRef.current.currentTime;
    }
    setIsPlaying(false);
  }, []);

  const processAudioQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    try {
      while (audioQueueRef.current.length > 0) {
        const arrayBuffer = audioQueueRef.current.shift();
        if (!arrayBuffer) continue;

        if (!audioContextRef.current) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
        }

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        let audioBuffer = null;

        // 1. Try native Web Audio container decoding (WAV / MP3)
        try {
          const clonedBuffer = arrayBuffer.slice(0);
          audioBuffer = await ctx.decodeAudioData(clonedBuffer);
        } catch (decodeErr) {
          // 2. Fallback to raw 16-bit 16kHz Linear PCM decoding
          const int16Array = new Int16Array(arrayBuffer);
          const float32Array = new Float32Array(int16Array.length);

          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
          }

          audioBuffer = ctx.createBuffer(1, float32Array.length, 16000);
          audioBuffer.getChannelData(0).set(float32Array);
        }

        if (!audioBuffer) continue;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        activeSourcesRef.current.push(source);

        const now = ctx.currentTime;
        const startTime = Math.max(now, nextPlaybackTimeRef.current);

        source.start(startTime);
        nextPlaybackTimeRef.current = startTime + audioBuffer.duration;

        setIsPlaying(true);
        setStatus('speaking');

        source.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
          if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
            setIsPlaying(false);
            setStatus((prev) => (prev === 'speaking' ? 'listening' : prev));
          }
        };
      }
    } catch (err) {
      console.error('Audio processing queue error:', err);
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, []);

  const playAudioBuffer = useCallback((arrayBuffer) => {
    audioQueueRef.current.push(arrayBuffer);
    processAudioQueue();
  }, [processAudioQueue]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        setIsConnected(true);
        return;
      }
      if (wsRef.current.readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    // Target URL with fallback: try primary gateway URL first, fallback to direct port if primary fails
    let targetUrl = configRef.current.gatewayUrl;
    if (retryCountRef.current === 1) {
      // On first retry attempt, if targetUrl was 5001, try 5000 (gateway), or vice versa
      if (targetUrl.includes(':5001')) {
        targetUrl = targetUrl.replace(':5001', ':5000');
      } else if (targetUrl.includes(':5000')) {
        targetUrl = targetUrl.replace(':5000', ':5001');
      }
    }

    if (!targetUrl) return;

    try {
      setStatus('connecting');
      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setStatus('listening');
        retryCountRef.current = 0; // Reset retry counter on clean open

        ws.send(JSON.stringify({
          type: 'session_start',
          sessionId: configRef.current.sessionId,
          timestamp: new Date().toISOString(),
        }));
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
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
              setStatus('processing'); // AI is evaluating candidate response
              if (configRef.current.onTranscriptFinal) configRef.current.onTranscriptFinal(msg.text);
              break;
            case 'turn_completed':
              setStatus('listening'); // Reset status back to listening when AI completes turn
              if (configRef.current.onTurnCompleted) configRef.current.onTurnCompleted(msg.turn);
              break;
            case 'error':
              if (!isConnected) {
                setStatus('error');
              }
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
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect if closed unexpectedly and max retries not exceeded
        if (!event.wasClean && retryCountRef.current < 3) {
          retryCountRef.current += 1;
          setStatus('connecting');
          retryTimerRef.current = setTimeout(() => {
            connect();
          }, 1000);
        } else {
          setStatus('idle');
        }
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

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
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

  const submitTurn = useCallback(() => {
    stopRecording();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'submit_turn' }));
    }
  }, [stopRecording]);

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
    submitTurn,
  };
};
