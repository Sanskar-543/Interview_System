import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { env, logger } from '@ai-interviewer/shared';
import { SessionStore } from './session/store.js';
import { DeepgramSTTAdapter, MockSTTAdapter } from './providers/stt.js';
import { OpenRouterLLMAdapter } from './providers/llm.js';
import { DeepgramTTSAdapter } from './providers/tts.js';
import { TurnOrchestrator } from './handlers/turn.js';
const server = createServer();
const wss = new WebSocketServer({ server });
const store = new SessionStore();
wss.on('connection', async (ws) => {
    logger.info('VoiceService: Incoming WebSocket connection established');
    let orchestrator = null;
    let activeSessionId = null;
    ws.on('message', async (data, isBinary) => {
        try {
            if (isBinary) {
                if (orchestrator) {
                    orchestrator.handleAudioChunk(data);
                }
            }
            else {
                const parsed = JSON.parse(data.toString());
                logger.info({ type: parsed.type }, 'VoiceService: Received text control command');
                if (parsed.type === 'submit_turn' && orchestrator) {
                    logger.info({ sessionId: activeSessionId }, 'VoiceService: Candidate explicitly clicked Send Answer');
                    orchestrator.flushCurrentTurn();
                }
                if (parsed.type === 'session_start') {
                    const sessionId = parsed.sessionId || `sess_${Math.random().toString(36).substring(2, 11)}`;
                    const userId = 'usr_guest';
                    activeSessionId = sessionId;
                    let session = await store.getSession(sessionId);
                    if (!session) {
                        session = await store.createSession(sessionId, userId);
                    }
                    const stt = (!env.DEEPGRAM_API_KEY || env.DEEPGRAM_API_KEY.startsWith('mock'))
                        ? new MockSTTAdapter()
                        : new DeepgramSTTAdapter();
                    const llm = new OpenRouterLLMAdapter();
                    const tts = new DeepgramTTSAdapter();
                    orchestrator = new TurnOrchestrator({
                        stt,
                        llm,
                        tts,
                        store,
                        sessionId,
                        userId,
                        sendWSMessage: (msg) => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify(msg));
                            }
                        },
                        sendAudioChunk: (buf) => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(buf);
                            }
                        },
                    });
                    await orchestrator.initialize();
                    ws.send(JSON.stringify({
                        type: 'session_started',
                        sessionId,
                        timestamp: new Date().toISOString(),
                    }));
                    logger.info({ sessionId }, 'VoiceService: Session orchestrator successfully initialized');
                    // Trigger AI interviewer opening question automatically
                    orchestrator.triggerInitialGreeting().catch((err) => {
                        logger.error({ err, sessionId }, 'VoiceService: Initial greeting failed');
                    });
                }
            }
        }
        catch (err) {
            logger.error({ err }, 'VoiceService: Failed to process WebSocket message');
            ws.send(JSON.stringify({
                type: 'error',
                code: 'MESSAGE_PROCESS_FAILED',
                message: err instanceof Error ? err.message : String(err),
                timestamp: new Date().toISOString(),
            }));
        }
    });
    ws.on('close', async () => {
        logger.info({ sessionId: activeSessionId }, 'VoiceService: Client socket connection closed');
        if (orchestrator) {
            await orchestrator.cleanup();
            orchestrator = null;
        }
    });
    ws.on('error', (err) => {
        logger.error({ err }, 'VoiceService: Socket error occurred');
    });
});
// In production, listen directly on env.PORT (e.g. 3001). In development, use env.PORT + 1 (e.g. 5001) to avoid conflicts with the gateway on env.PORT.
const VOICE_PORT = process.env.NODE_ENV === 'production' ? env.PORT : env.PORT + 1;
server.listen(VOICE_PORT, () => {
    logger.info(`VoiceService: WebSocket server listening on port ${VOICE_PORT}`);
});
