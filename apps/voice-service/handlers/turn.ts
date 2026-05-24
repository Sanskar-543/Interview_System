import { STTProvider } from '../providers/stt';
import { LLMProvider, ChatMessage } from '../providers/llm';
import { TTSProvider } from '../providers/tts';
import { SessionStore } from '../session/store';
import { Turn, WSMessage } from '@ai-interviewer/shared';
import { logger } from '@ai-interviewer/shared';
import { CircuitBreaker } from '../circuit/breaker';
import { getEmbedding, searchKnowledge } from '@ai-interviewer/rag';
import { db, sessions, turns } from '@ai-interviewer/db';
import { eq } from 'drizzle-orm';
import { enqueueEvaluation } from '@ai-interviewer/queue';

export interface TurnOrchestratorConfig {
  stt: STTProvider;
  llm: LLMProvider;
  tts: TTSProvider;
  store: SessionStore;
  sessionId: string;
  userId: string;
  sendWSMessage: (message: WSMessage) => void;
  sendAudioChunk: (chunk: Buffer) => void;
}

export class TurnOrchestrator {
  private stt: STTProvider;
  private llm: LLMProvider;
  private tts: TTSProvider;
  private store: SessionStore;
  private sessionId: string;
  private userId: string;
  private sendWSMessage: (message: WSMessage) => void;
  private sendAudioChunk: (chunk: Buffer) => void;

  private breaker: CircuitBreaker;
  private turnIndex = 0;
  private isProcessing = false;
  private sentenceBuffer = '';
  private fullResponseText = '';
  private currentAssistantTurnId = '';
  private speechEndTime = 0;
  private tripRefundActive = false;

  constructor(config: TurnOrchestratorConfig) {
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

  async initialize(): Promise<void> {
    // Seed generic questions on startup
    await this.breaker.seedGenericQuestions();

    await this.stt.start({
      onTranscript: async (text: string, isFinal: boolean) => {
        if (isFinal) {
          logger.info({ sessionId: this.sessionId, text }, 'Orchestrator: Final transcript received');
          this.sendWSMessage({
            type: 'transcript_final',
            text,
            timestamp: new Date().toISOString(),
          });
          
          await this.handleUserUtterance(text);
        } else {
          this.sendWSMessage({
            type: 'transcript_interim',
            text,
            timestamp: new Date().toISOString(),
          });
        }
      },
      onError: (error: Error) => {
        logger.error({ sessionId: this.sessionId, error }, 'Orchestrator: STT stream failure');
        this.sendWSMessage({
          type: 'error',
          code: 'STT_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      },
    });
  }

  handleAudioChunk(chunk: Buffer): void {
    this.stt.sendAudio(chunk);
  }

  async handleUserUtterance(transcript: string): Promise<void> {
    if (this.isProcessing) {
      logger.warn({ sessionId: this.sessionId }, 'Orchestrator: Input rate limited (processing active turn)');
      return;
    }

    this.isProcessing = true;
    this.speechEndTime = Date.now();
    
    try {
      // 1. Write-Ahead: Write User Turn to Redis first!
      const userTurnId = `trn_${Math.random().toString(36).substring(2, 11)}`;
      const userTurn: Turn = {
        id: userTurnId,
        sessionId: this.sessionId,
        turnIndex: this.turnIndex++,
        role: 'user',
        transcript,
        latencyMs: Date.now() - this.speechEndTime,
        createdAt: new Date().toISOString(),
      };

      await this.store.appendTurn(this.sessionId, userTurn);
      
      this.sendWSMessage({
        type: 'turn_completed',
        turn: userTurn,
        timestamp: new Date().toISOString(),
      });

      // 2. Load context: Fetch embedding & query RAG + fetch history in parallel!
      const role = 'Software Engineer'; // Dynamic role mapping
      let embedding: number[] = [];
      try {
        embedding = await getEmbedding(transcript);
      } catch (err) {
        logger.error({ err, sessionId: this.sessionId }, 'Orchestrator: RAG embedding generation failed.');
      }

      // MANDATORY CORRECTION 4: Redis fetch and RAG search MUST use Promise.all()
      const [session, ragChunks] = await Promise.all([
        this.store.getSession(this.sessionId),
        searchKnowledge(embedding, role, 2)
      ]);

      if (!session) {
        throw new Error(`Orchestrator: Session ${this.sessionId} was not found in cache`);
      }

      // Compile rich pressure-simulated prompt context
      const systemPrompt = `You are an elite, empathetic, and professional voice interviewer conducting a realistic mock interview for a ${role} role.

Follow these strict conversational guidelines:
1. Speak naturally and conversationally. Avoid listicles, bullet points, or any formal markdown formatting.
2. Ask exactly ONE follow-up question at a time. Keep your turns concise and under 3 sentences.
3. Challenge the candidate's assumptions: if they give a generic answer, probe deeper by asking for concrete examples.

${ragChunks && ragChunks.length > 0 ? `Here are some role-specific question prompts you can draw inspiration from during this turn:\n- ${ragChunks.map(m => m.question).join('\n- ')}` : ''}
`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...session.turns.map((t): ChatMessage => ({
          role: t.role,
          content: t.transcript,
        })),
      ];

      this.currentAssistantTurnId = `trn_${Math.random().toString(36).substring(2, 11)}`;
      this.sentenceBuffer = '';
      this.fullResponseText = '';

      // 3. Open LLM Stream utilizing Circuit Breaker completions
      const completionResult = await this.breaker.runCompletionWithFallback(
        messages,
        async (modelName) => {
          let responseText = '';
          await this.llm.streamCompletion(messages, {
            onToken: async (token: string) => {
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
            onComplete: () => {},
            onError: (err: Error) => { throw err; },
            model: modelName !== 'default' ? modelName : undefined
          });
          return responseText;
        },
        this.sessionId,
        this.userId
      );

      // If circuit breaker degraded to Level 3 generic questions, process and stream the result directly
      if (completionResult.tripRefund) {
        this.tripRefundActive = true;
        this.fullResponseText = completionResult.response;
        await this.processSentenceAudio(completionResult.response);
      }

      this.isProcessing = false;
    } catch (error) {
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

  private async processSentenceAudio(sentence: string): Promise<void> {
    try {
      // 1. Synthesize audio buffer
      const audioBuffer = await this.tts.synthesize(sentence);

      // 2. Write-Ahead: Update current assistant turn state in Redis BEFORE transmitting audio!
      const assistantTurn: Turn = {
        id: this.currentAssistantTurnId,
        sessionId: this.sessionId,
        turnIndex: this.turnIndex,
        role: 'assistant',
        transcript: this.fullResponseText,
        latencyMs: Date.now() - this.speechEndTime,
        createdAt: new Date().toISOString(),
      };

      await this.store.appendTurn(this.sessionId, assistantTurn);

      // 3. Audio transmission
      this.sendAudioChunk(audioBuffer);

    } catch (error) {
      logger.error({ sessionId: this.sessionId, sentence, error }, 'Orchestrator: Sentence pipeline failure');
    }
  }

  async cleanup(): Promise<void> {
    await this.stt.stop();
    logger.info({ sessionId: this.sessionId }, 'Orchestrator: STT adapters terminated');

    try {
      // 1. Flush turns from Redis cache to permanent Postgres DB
      const session = await this.store.getSession(this.sessionId);
      if (session && session.turns.length > 0) {
        logger.info({ sessionId: this.sessionId, count: session.turns.length }, 'Orchestrator: Flushing turns to permanent Postgres DB');
        
        for (const t of session.turns) {
          await db.insert(turns).values({
            id: t.id,
            sessionId: this.sessionId,
            turnIndex: t.turnIndex,
            role: t.role,
            transcript: t.transcript,
            latencyMs: t.latencyMs,
            createdAt: new Date(t.createdAt),
          }).onConflictDoNothing();
        }

        // Update session status to completed
        await db.update(sessions)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(sessions.id, this.sessionId));

        // 2. Enqueue Evaluation background job
        await enqueueEvaluation(this.sessionId, this.userId);
        logger.info({ sessionId: this.sessionId }, 'Orchestrator: Evaluation job enqueued successfully.');
      }

      // 3. Level 4 Fallback: trigger refund if interview degraded to static questions
      if (this.tripRefundActive) {
        await this.breaker.triggerCreditRefund(this.sessionId, this.userId, 'LLM_COMPLETIONS_DEGRADED');
      }
    } catch (err) {
      logger.error({ err, sessionId: this.sessionId }, 'Orchestrator: Failed to finalize session during cleanup');
    } finally {
      await this.breaker.close();
    }
  }
}
