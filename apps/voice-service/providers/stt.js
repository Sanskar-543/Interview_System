import WebSocket from 'ws';
import { env, logger, AppError } from '@ai-interviewer/shared';
import { STTNormalizer } from './normalizer.js';
export class MockSTTAdapter {
    onTurnCompleteCallback = null;
    hasSimulatedTurn = false;
    async startSession(sessionId) {
        logger.info({ sessionId }, 'STT [Mock]: Mock STT session started');
    }
    sendAudio(audioChunk) {
        if (!this.hasSimulatedTurn && this.onTurnCompleteCallback) {
            this.hasSimulatedTurn = true;
            setTimeout(() => {
                if (this.onTurnCompleteCallback) {
                    this.onTurnCompleteCallback('I am testing the AI interviewer locally with complete sentences.');
                }
                this.hasSimulatedTurn = false;
            }, 2500);
        }
    }
    onTurnComplete(callback) {
        this.onTurnCompleteCallback = callback;
    }
    endSession() {
        logger.info('STT [Mock]: Session ended');
    }
}
export class DeepgramSTTAdapter {
    ws = null;
    sessionId = null;
    finalSentenceBuffer = '';
    interimTranscript = '';
    silenceTimer = null;
    keepAliveTimer = null;
    onTurnCompleteCallback = null;
    onInterimTranscriptCallback = null;
    connectionError = null;
    async startSession(sessionId) {
        this.sessionId = sessionId;
        this.finalSentenceBuffer = '';
        this.interimTranscript = '';
        this.connectionError = null;
        // DEEPGRAM NOVA-2 MODEL WITH TECHNICAL KEYWORD BOOSTING & 4000ms ENDPOINTING
        const keywords = 'keywords=Next.js:3,Express.js:3,PostgreSQL:3,Redis:3,Docker:3,Kubernetes:3,TypeScript:3,GraphQL:3,REST:3,Microservices:3,Render:3,Node.js:3,React:3,AWS:3,Postgres:3,SQL:3,MongoDB:3,Tailwind:3,Prisma:3,Drizzle:3,B-Tree:3,ACID:3,MVCC:3,TCP/IP:3,UDP:3,HTTP/2:3,WebSockets:3,TLS:3,DNS:3,CDN:3,Polymorphism:3,Encapsulation:3,SOLID:3,Event Loop:3,Mutex:3,Semaphore:3,Deadlock:3';
        const url = `wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true&punctuate=true&endpointing=4000&utterance_end_ms=4000&vad_events=true&${keywords}`;
        logger.info({ sessionId }, 'STT: Connecting to Deepgram Nova-2 Voice API with technical keyword boosting...');
        this.ws = new WebSocket(url, {
            headers: {
                Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
            },
        });
        this.ws.on('open', () => {
            logger.info({ sessionId: this.sessionId }, 'STT: Connected to Deepgram Nova-2 WebSocket');
            // KeepAlive loop: Send KeepAlive frame every 5s to prevent Deepgram 1011 timeout during candidate silence!
            this.clearKeepAliveTimer();
            this.keepAliveTimer = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    try {
                        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
                    }
                    catch (e) { }
                }
            }, 5000);
        });
        this.ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                const transcript = (response.channel?.alternatives?.[0]?.transcript || '').trim();
                const isFinal = Boolean(response.is_final);
                const isSpeechFinal = Boolean(response.speech_final || response.type === 'UtteranceEnd');
                if (transcript) {
                    if (isFinal) {
                        this.finalSentenceBuffer += (this.finalSentenceBuffer ? ' ' : '') + transcript;
                        this.interimTranscript = '';
                    }
                    else {
                        this.interimTranscript = transcript;
                    }
                    // Emit live interim transcript update to UI in real-time
                    const currentLiveText = (this.finalSentenceBuffer + ' ' + this.interimTranscript).trim();
                    if (this.onInterimTranscriptCallback && currentLiveText) {
                        this.onInterimTranscriptCallback(currentLiveText);
                    }
                    this.resetSilenceTimer();
                }
                // Only auto-flush turn if speech_final is true AND sentence has at least 8 words
                const currentSentence = (this.finalSentenceBuffer + ' ' + this.interimTranscript).trim();
                const wordCount = currentSentence.split(/\s+/).filter(Boolean).length;
                if (isSpeechFinal && wordCount >= 8) {
                    this.flushTurn();
                }
            }
            catch (err) {
                logger.error({ err, sessionId: this.sessionId }, 'STT: Error parsing socket message');
            }
        });
        this.ws.on('error', (error) => {
            const appErr = new AppError('STT_DISCONNECTED', `STT connection lost: ${error.message || String(error)}`, 503);
            this.connectionError = appErr;
            logger.error({ err: appErr, sessionId: this.sessionId }, 'STT: Deepgram socket connection error occurred');
        });
        this.ws.on('close', (code, reason) => {
            this.clearSilenceTimer();
            this.clearKeepAliveTimer();
            if (code !== 1000) {
                const reasonStr = reason.toString('utf-8') || 'unknown';
                const appErr = new AppError('STT_DISCONNECTED', `STT connection lost (code ${code}): ${reasonStr}`, 503);
                this.connectionError = appErr;
                logger.error({ err: appErr, sessionId: this.sessionId, code, reason: reasonStr }, 'STT: Deepgram socket closed unexpectedly');
            }
            else {
                logger.info({ sessionId: this.sessionId }, 'STT: Deepgram socket gracefully closed');
            }
        });
    }
    onTurnComplete(callback) {
        this.onTurnCompleteCallback = callback;
    }
    onInterimTranscript(callback) {
        this.onInterimTranscriptCallback = callback;
    }
    resetSilenceTimer() {
        this.clearSilenceTimer();
        // Wait 4000ms (4.0 seconds) of silence before finalizing sentence turn
        this.silenceTimer = setTimeout(() => {
            this.flushTurn();
        }, 4000);
    }
    clearSilenceTimer() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
    clearKeepAliveTimer() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }
    flushTurn() {
        this.clearSilenceTimer();
        const rawSentence = (this.finalSentenceBuffer + (this.interimTranscript ? ' ' + this.interimTranscript : '')).trim();
        this.finalSentenceBuffer = '';
        this.interimTranscript = '';
        const normalizedSentence = STTNormalizer.normalize(rawSentence);
        if (normalizedSentence && this.onTurnCompleteCallback) {
            logger.info({ sessionId: this.sessionId, raw: rawSentence, normalized: normalizedSentence }, 'STT: Complete sentence turn finished & normalized');
            this.onTurnCompleteCallback(normalizedSentence);
        }
    }
    sendAudio(audioChunk) {
        if (this.connectionError) {
            throw this.connectionError;
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new AppError('STT_DISCONNECTED', 'STT connection lost (socket is not open)', 503);
        }
        this.ws.send(audioChunk);
    }
    endSession() {
        this.clearSilenceTimer();
        this.clearKeepAliveTimer();
        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'CloseStream' }));
                this.ws.close(1000);
            }
            this.ws = null;
        }
        this.finalSentenceBuffer = '';
        this.interimTranscript = '';
        this.onTurnCompleteCallback = null;
        this.connectionError = null;
    }
}
