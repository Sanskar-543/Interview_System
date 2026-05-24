import IORedis from 'ioredis';
import { env, logger } from '@ai-interviewer/shared';
import { enqueueCreditRefund } from '@ai-interviewer/queue';

const REDIS_FAIL_KEY = 'cb:llm:failures';
const REDIS_STATE_KEY = 'cb:llm:state';
const REDIS_QUESTIONS_KEY = 'cb:llm:questions';

const FAILURE_THRESHOLD = 5;
const COOLDOWN_PERIOD_MS = 30000; // 30 seconds

export type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// 20 pre-seeded generic interview questions mapping standard roles
const PRE_SEEDED_QUESTIONS = [
  "Can you tell me about a challenging project you worked on and how you overcame technical hurdles?",
  "How do you approach managing conflict or differing opinions within a software development team?",
  "What is your strategy for optimizing application performance and reducing latency at scale?",
  "Describe a time when you had to learn a brand new framework or technology quickly to meet a deadline.",
  "How do you balance technical debt with delivering new features in a fast-paced business environment?",
  "Can you walk me through your process for conducting thorough and constructive code reviews?",
  "How do you design APIs that are highly secure, reliable, and easy for other developers to integrate?",
  "Describe a situation where a production system crashed and how you diagnosed and resolved the issue.",
  "What is your approach to writing clean, maintainable unit and integration tests?",
  "How do you maintain focus and product design standards when requirements are highly ambiguous?",
  "Why are you interested in this role, and what unique value do you bring to our engineering team?",
  "What are the key trade-offs between utilizing relational vs non-relational database architectures?",
  "How do you ensure data confidentiality and ingress security when designing microservice layers?",
  "Describe a time when you disagreed with a product owner's direction. How did you align on a path?",
  "How do you keep your technical skills current with rapidly evolving industry standards?",
  "Can you discuss a time when you had to mentor a junior team member? What was your approach?",
  "What is the difference between concurrent execution and parallel execution in high-throughput services?",
  "How do you approach designing system architectures for horizontal scalability and high availability?",
  "What has been the most significant technical contribution of your career so far?",
  "Where do you see yourself technically and professionally in the next three to five years?"
];

export class CircuitBreaker {
  private redis: IORedis;

  constructor() {
    this.redis = new IORedis(env.REDIS_URL);
  }

  // Pre-seed 20 generic questions in Redis on startup
  async seedGenericQuestions(): Promise<void> {
    try {
      const len = await this.redis.llen(REDIS_QUESTIONS_KEY);
      if (len === 0) {
        await this.redis.rpush(REDIS_QUESTIONS_KEY, ...PRE_SEEDED_QUESTIONS);
        logger.info('CircuitBreaker: Pre-seeded 20 generic interview questions into Redis cache.');
      }
    } catch (err) {
      logger.error({ err }, 'CircuitBreaker: Failed to seed generic questions in Redis');
    }
  }

  async getState(): Promise<CBState> {
    const state = await this.redis.get(REDIS_STATE_KEY) as CBState | null;
    return state || 'CLOSED';
  }

  async recordFailure(): Promise<void> {
    const state = await this.getState();
    if (state === 'OPEN') return;

    const count = await this.redis.incr(REDIS_FAIL_KEY);
    logger.warn({ count, state }, 'CircuitBreaker: Logged failure for primary LLM');

    if (count >= FAILURE_THRESHOLD) {
      await this.redis.set(REDIS_STATE_KEY, 'OPEN', 'EX', COOLDOWN_PERIOD_MS / 1000);
      logger.error('CircuitBreaker: Primary LLM failure threshold reached. Circuit opened!');
    }
  }

  async recordSuccess(): Promise<void> {
    const state = await this.getState();
    if (state === 'OPEN') return;

    await this.redis.del(REDIS_FAIL_KEY);
    if (state === 'HALF_OPEN') {
      await this.redis.set(REDIS_STATE_KEY, 'CLOSED');
      logger.info('CircuitBreaker: Primary LLM verified healthy. Circuit closed.');
    }
  }

  // Fetch random static cached question from Redis
  async getCachedQuestion(): Promise<string> {
    try {
      const len = await this.redis.llen(REDIS_QUESTIONS_KEY);
      if (len === 0) {
        // Fallback if Redis fails
        return PRE_SEEDED_QUESTIONS[Math.floor(Math.random() * PRE_SEEDED_QUESTIONS.length)];
      }
      const idx = Math.floor(Math.random() * len);
      const question = await this.redis.lindex(REDIS_QUESTIONS_KEY, idx);
      return question || PRE_SEEDED_QUESTIONS[0];
    } catch (err) {
      logger.error({ err }, 'CircuitBreaker: Failed to fetch cached question');
      return PRE_SEEDED_QUESTIONS[0];
    }
  }

  /**
   * Run with 4 Fallback Levels
   */
  async runCompletionWithFallback(
    messages: any[],
    primaryCompletionsCall: (model: string) => Promise<string>,
    sessionId: string,
    userId: string
  ): Promise<{ response: string; usedFallback: boolean; tripRefund: boolean }> {
    const state = await this.getState();

    // If circuit is OPEN, skip Level 1 and start from Level 2 directly
    if (state === 'OPEN') {
      logger.warn({ sessionId }, 'CircuitBreaker: Circuit is OPEN. Bypassing primary LLM directly.');
      return this.executeLevel2(messages, primaryCompletionsCall, sessionId, userId);
    }

    // LEVEL 1: Primary LLM (OpenRouter best model)
    try {
      logger.info({ sessionId }, 'CircuitBreaker [Level 1]: Calling Primary LLM...');
      const response = await primaryCompletionsCall('default');
      await this.recordSuccess();
      return { response, usedFallback: false, tripRefund: false };
    } catch (err: any) {
      logger.error({ err, sessionId }, 'CircuitBreaker [Level 1] Failed!');
      await this.recordFailure();
      return this.executeLevel2(messages, primaryCompletionsCall, sessionId, userId);
    }
  }

  // LEVEL 2: Rotate through 3 backup free models
  private async executeLevel2(
    messages: any[],
    primaryCompletionsCall: (model: string) => Promise<string>,
    sessionId: string,
    userId: string
  ): Promise<{ response: string; usedFallback: boolean; tripRefund: boolean }> {
    const backupModels = [
      'google/gemini-2.5-flash',
      'meta-llama/llama-3-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free'
    ];

    for (let i = 0; i < backupModels.length; i++) {
      const model = backupModels[i];
      try {
        logger.warn({ sessionId, model }, `CircuitBreaker [Level 2 - Rotation ${i + 1}]: Calling backup model...`);
        const response = await primaryCompletionsCall(model);
        // Record partial success if backup succeeds
        await this.recordSuccess();
        return { response, usedFallback: true, tripRefund: false };
      } catch (err: any) {
        logger.error({ err, sessionId, model }, `CircuitBreaker [Level 2 - Rotation ${i + 1}] Failed!`);
      }
    }

    // If all Level 2 backup models fail, go to Level 3
    return this.executeLevel3(sessionId, userId);
  }

  // LEVEL 3: Serve generic cached interview questions from Redis
  private async executeLevel3(
    sessionId: string,
    userId: string
  ): Promise<{ response: string; usedFallback: boolean; tripRefund: boolean }> {
    logger.error({ sessionId }, 'CircuitBreaker [Level 3]: All LLM connections failed! Serving static generic question.');
    const response = await this.getCachedQuestion();
    
    // We indicate that a refund is needed because the interview was degraded to static questions
    return { response, usedFallback: true, tripRefund: true };
  }

  // LEVEL 4: Enqueue credit refund job
  async triggerCreditRefund(sessionId: string, userId: string, reason: string): Promise<void> {
    try {
      logger.error({ sessionId, userId, reason }, 'CircuitBreaker [Level 4]: Session ended without LLM restoring. Enqueuing credit refund!');
      await enqueueCreditRefund(sessionId, userId, reason);
    } catch (err) {
      logger.error({ err, sessionId }, 'CircuitBreaker: Failed to enqueue Level 4 credit refund job');
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
