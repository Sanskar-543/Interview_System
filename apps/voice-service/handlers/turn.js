import { logger } from '@ai-interviewer/shared';
import { CircuitBreaker } from '../circuit/breaker.js';
import { getEmbedding, searchKnowledge } from '@ai-interviewer/rag';
import { db, sessions, turns } from '@ai-interviewer/db';
import { eq } from 'drizzle-orm';
import { enqueueEvaluation } from '@ai-interviewer/queue';
function cleanMetaThoughtPreamble(text) {
    if (!text)
        return text;
    // 1. If text starts with prompt echoes ("You're giving...", "The candidate has...", "Focus on...", "We need to..."), strip meta section completely
    let cleaned = text
        .replace(/^(?:You're giving|You are giving|The candidate|Focus on|We need to|CURRENT STAGE:|The stage|We must|Must follow|So we can|Here is|Rule:|As an interviewer|System:)+[\s\S]*?(?:fundamentals\.|overview\.|protocols\.|architecture\.|say:|ask:|state:|"|\n\n|:|\. So |\? |\!\s*)/gi, '')
        .replace(/^"(.*)"$/, '$1')
        .trim();
    // 2. If filtering left prompt text or non-dialogue, extract clean question using regex match
    if (!cleaned || cleaned.length < 5 || /^(?:You're|You are|The candidate|Focus on)/i.test(cleaned)) {
        const questionMatch = text.match(/(?:Welcome|Hello|Hi|What|How|Could|Can|Tell|Describe|Why|Which|In your|For your)[\s\S]*?[.?!]/i);
        if (questionMatch) {
            cleaned = questionMatch[0].trim();
        }
    }
    return cleaned || text;
}
export class TurnOrchestrator {
    stt;
    llm;
    tts;
    store;
    sessionId;
    userId;
    sendWSMessage;
    sendAudioChunk;
    breaker;
    turnIndex = 0;
    isProcessing = false;
    sentenceBuffer = '';
    fullResponseText = '';
    currentAssistantTurnId = '';
    speechEndTime = 0;
    tripRefundActive = false;
    constructor(config) {
        this.stt = config.stt;
        this.llm = config.llm;
        this.tts = config.tts;
        this.store = config.store;
        this.sessionId = config.sessionId;
        this.userId = config.userId;
        this.sendWSMessage = config.sendWSMessage;
        this.sendAudioChunk = config.sendAudioChunk;
        this.breaker = new CircuitBreaker();
    }
    async initialize() {
        await this.breaker.seedGenericQuestions();
        if (typeof this.stt.onInterimTranscript === 'function') {
            this.stt.onInterimTranscript((interimText) => {
                this.sendWSMessage({
                    type: 'transcript_interim',
                    text: interimText,
                    timestamp: new Date().toISOString(),
                });
            });
        }
        this.stt.onTurnComplete(async (transcript) => {
            logger.info({ sessionId: this.sessionId, text: transcript }, 'Orchestrator: STT turn complete received');
            await this.handleUserUtterance(transcript);
        });
        await this.stt.startSession(this.sessionId);
    }
    async triggerInitialGreeting() {
        try {
            const existingSession = await this.store.getSession(this.sessionId);
            if (existingSession && existingSession.turns.length > 0) {
                logger.info({ sessionId: this.sessionId }, 'Orchestrator: Session already has turns. Skipping initial greeting.');
                return;
            }
            this.isProcessing = true;
            this.speechEndTime = Date.now();
            // Fetch session metadata (jobTitle, jobDescription, resumeText) from DB
            const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, this.sessionId)).limit(1);
            const jobTitle = dbSession?.jobTitle || 'Software Engineer';
            const systemPrompt = `You are a Senior Engineering Manager conducting a technical interview for the ${jobTitle} role.

Welcome the candidate briefly and ask them to introduce themselves and summarize their engineering background and key technical projects.

STRICT RESPONSE RULES:
1. OUTPUT ONLY DIRECT SPOKEN DIALOGUE FOR THE CANDIDATE.
2. NO META-THOUGHTS OR SYSTEM REASONING: Never output phrases like "We need to respond as...", "The stage is...", or "So we can say...". Start immediately with your welcome question.
3. MAXIMUM 1 TO 2 SHORT SENTENCES (UNDER 25 WORDS TOTAL).`;
            const messages = [
                { role: 'system', content: systemPrompt }
            ];
            this.currentAssistantTurnId = `trn_${Math.random().toString(36).substring(2, 11)}`;
            this.sentenceBuffer = '';
            this.fullResponseText = '';
            await this.breaker.runCompletionWithFallback(messages, async (modelName) => {
                let responseText = '';
                await this.llm.streamCompletion(messages, {
                    onToken: async (token) => {
                        responseText += token;
                        this.sentenceBuffer += token;
                        this.fullResponseText += token;
                        if (/[.?!]\s*$/.test(this.sentenceBuffer)) {
                            const sentence = this.sentenceBuffer.trim();
                            this.sentenceBuffer = '';
                            if (sentence) {
                                await this.processSentenceAudio(sentence);
                            }
                        }
                    },
                    onComplete: () => { },
                    onError: (err) => { throw err; },
                    model: modelName !== 'default' ? modelName : undefined
                });
                // Flush any remaining un-punctuated trailing sentence buffer
                if (this.sentenceBuffer.trim()) {
                    const remaining = this.sentenceBuffer.trim();
                    this.sentenceBuffer = '';
                    await this.processSentenceAudio(remaining);
                }
                return responseText;
            }, this.sessionId, this.userId);
            this.isProcessing = false;
        }
        catch (error) {
            logger.error({ sessionId: this.sessionId, error }, 'Orchestrator: Initial greeting generation failed');
            this.isProcessing = false;
        }
    }
    handleAudioChunk(chunk) {
        this.stt.sendAudio(chunk);
    }
    flushCurrentTurn() {
        if (this.stt && typeof this.stt.flushTurn === 'function') {
            this.stt.flushTurn();
        }
    }
    async handleUserUtterance(transcript) {
        if (this.isProcessing) {
            logger.warn({ sessionId: this.sessionId }, 'Orchestrator: Input rate limited (processing active turn)');
            return;
        }
        this.isProcessing = true;
        this.speechEndTime = Date.now();
        try {
            // 1. Write-Ahead: Write User Turn to Redis first!
            const userTurnId = `trn_${Math.random().toString(36).substring(2, 11)}`;
            const userTurn = {
                id: userTurnId,
                sessionId: this.sessionId,
                turnIndex: this.turnIndex++,
                role: 'user',
                transcript,
                latencyMs: 0,
                createdAt: new Date().toISOString(),
            };
            await this.store.appendTurn(this.sessionId, userTurn);
            // Emit turn_completed for user to render in UI stream immediately
            this.sendWSMessage({
                type: 'turn_completed',
                turn: userTurn,
                timestamp: new Date().toISOString(),
            });
            // 2. Fetch DB session to extract candidate job title, resume, and JD
            const [session, dbSessionResults] = await Promise.all([
                this.store.getSession(this.sessionId),
                db.select().from(sessions).where(eq(sessions.id, this.sessionId)).limit(1),
            ]);
            if (!session) {
                throw new Error(`Orchestrator: Session ${this.sessionId} was not found in cache`);
            }
            const dbSession = dbSessionResults?.[0];
            const jobTitle = dbSession?.jobTitle || 'Software Engineer';
            const jobDescription = (dbSession?.jobDescription || 'Standard engineering requirements').slice(0, 2500);
            const resumeText = (dbSession?.resumeText || 'Standard candidate background').slice(0, 3000);
            // Generate RAG embedding on user transcript + jobTitle and search pgvector knowledge base
            let embedding = [];
            let ragChunks = [];
            try {
                const queryText = `${transcript} ${jobTitle} ${resumeText.slice(0, 500)}`;
                embedding = await getEmbedding(queryText);
                if (embedding && embedding.length > 0) {
                    ragChunks = await searchKnowledge(embedding, jobTitle, 3);
                    if (ragChunks.length === 0 && jobTitle !== 'Software Engineer') {
                        ragChunks = await searchKnowledge(embedding, 'Software Engineer', 3);
                    }
                }
            }
            catch (err) {
                logger.error({ err, sessionId: this.sessionId }, 'Orchestrator: RAG embedding generation or search failed.');
            }
            const ragContextText = ragChunks.length > 0
                ? ragChunks.map((c, i) => `[RAG Insight ${i + 1}]: Technical Focus: ${c.question} | Ideal Keywords: ${c.idealKeywords}`).join('\n')
                : 'Focus on evaluating candidate core technical stack, database design, and network protocols.';
            const currentStageNum = Math.min(5, Math.ceil(this.turnIndex / 2) || 1);
            const stageDirectives = {
                1: 'Goal: Ask candidate to summarize their primary project architecture and backend tech stack.',
                2: 'Goal: Focus on DBMS & Storage (ask about indexing, ACID transactions, PostgreSQL/MongoDB, or data consistency).',
                3: 'Goal: Focus on Computer Networks (ask about TCP handshake, HTTP/2, WebSockets, or TLS).',
                4: 'Goal: Focus on OS & OOPs (ask about Event Loop, Threads vs Processes, Mutex, or SOLID principles).',
                5: 'Goal: Focus on System Scalability (ask about Redis caching, load balancers, or read replicas).',
            };
            const systemPrompt = `You are an interviewer asking a candidate questions for the ${jobTitle} role.

${stageDirectives[currentStageNum]}

Candidate Details:
${resumeText}

Technical Guidelines:
${ragContextText}

Rules:
- Speak directly to the candidate.
- Ask exactly ONE clear technical question (1-2 sentences total, max 25 words).
- Do NOT repeat instructions, goals, or candidate descriptions.
- Output ONLY the spoken question.`;
            const recentTurns = session.turns.slice(-6);
            const messages = [
                { role: 'system', content: systemPrompt },
                ...recentTurns.map((t) => ({
                    role: t.role,
                    content: t.transcript,
                })),
            ];
            this.currentAssistantTurnId = `trn_${Math.random().toString(36).substring(2, 11)}`;
            this.sentenceBuffer = '';
            this.fullResponseText = '';
            const completionResult = await this.breaker.runCompletionWithFallback(messages, async (modelName) => {
                let responseText = '';
                this.sentenceBuffer = '';
                this.fullResponseText = '';
                await this.llm.streamCompletion(messages, {
                    onToken: async (token) => {
                        responseText += token;
                        this.sentenceBuffer += token;
                        this.fullResponseText += token;
                        if (/[.?!]\s*$/.test(this.sentenceBuffer)) {
                            const sentence = this.sentenceBuffer.trim();
                            this.sentenceBuffer = '';
                            if (sentence) {
                                await this.processSentenceAudio(sentence);
                            }
                        }
                    },
                    onComplete: () => { },
                    onError: (err) => { throw err; },
                    model: modelName !== 'default' ? modelName : undefined
                });
                // Flush any remaining un-punctuated trailing sentence buffer
                if (this.sentenceBuffer.trim()) {
                    const remaining = this.sentenceBuffer.trim();
                    this.sentenceBuffer = '';
                    await this.processSentenceAudio(remaining);
                }
                return responseText;
            }, this.sessionId, this.userId);
            // If circuit breaker degraded to Level 3 generic questions, process and stream the result directly
            if (completionResult.tripRefund) {
                this.tripRefundActive = true;
                this.fullResponseText = completionResult.response;
                await this.processSentenceAudio(completionResult.response);
            }
            this.isProcessing = false;
        }
        catch (error) {
            logger.error({ sessionId: this.sessionId, error }, 'Orchestrator: Complete turn loop failure');
            this.sendWSMessage({
                type: 'error',
                code: 'TURN_PROCESSING_FAILED',
                message: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            });
            this.isProcessing = false;
        }
    }
    async processSentenceAudio(sentence) {
        try {
            const cleanSentence = cleanMetaThoughtPreamble(sentence);
            if (!cleanSentence)
                return;
            // 1. Synthesize audio buffer
            const audioBuffer = await this.tts.synthesize(cleanSentence);
            const cleanFullText = cleanMetaThoughtPreamble(this.fullResponseText);
            // 2. Write-Ahead: Update current assistant turn state in Redis BEFORE transmitting audio!
            const assistantTurn = {
                id: this.currentAssistantTurnId,
                sessionId: this.sessionId,
                turnIndex: this.turnIndex,
                role: 'assistant',
                transcript: cleanFullText,
                latencyMs: Date.now() - this.speechEndTime,
                createdAt: new Date().toISOString(),
            };
            await this.store.appendTurn(this.sessionId, assistantTurn);
            // 3. Emit turn_completed event so AI responses appear in live transcript!
            this.sendWSMessage({
                type: 'turn_completed',
                turn: assistantTurn,
                timestamp: new Date().toISOString(),
            });
            // 4. Audio transmission
            this.sendAudioChunk(audioBuffer);
        }
        catch (error) {
            logger.error({ sessionId: this.sessionId, sentence, error }, 'Orchestrator: Sentence pipeline failure');
        }
    }
    async cleanup() {
        this.stt.endSession();
        logger.info({ sessionId: this.sessionId }, 'Orchestrator: STT adapters terminated');
        try {
            const session = await this.store.getSession(this.sessionId);
            if (session && session.turns.length > 0) {
                logger.info({ sessionId: this.sessionId, count: session.turns.length }, 'Orchestrator: Flushing turns to permanent Postgres DB');
                await db.transaction(async (tx) => {
                    for (const t of session.turns) {
                        await tx.insert(turns).values({
                            id: t.id,
                            sessionId: t.sessionId,
                            turnIndex: t.turnIndex,
                            role: t.role,
                            transcript: t.transcript,
                            latencyMs: t.latencyMs || 0,
                            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
                        }).onConflictDoNothing();
                    }
                    await tx.update(sessions)
                        .set({ status: 'completed', updatedAt: new Date() })
                        .where(eq(sessions.id, this.sessionId));
                });
                if (this.tripRefundActive) {
                    await this.breaker.triggerCreditRefund(this.sessionId, this.userId, 'CircuitBreaker tripped during session. Interview degraded to static cached generic questions.');
                }
                else {
                    await enqueueEvaluation(this.sessionId, this.userId);
                    logger.info({ sessionId: this.sessionId }, 'Orchestrator: Evaluation job enqueued successfully.');
                }
                await this.store.deleteSession(this.sessionId);
            }
        }
        catch (err) {
            logger.error({ err, sessionId: this.sessionId }, 'Orchestrator: Cleanup and database flush error');
        }
        await this.breaker.close();
    }
}
