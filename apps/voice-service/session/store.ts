import Redis from 'ioredis';
import { env, logger } from '@ai-interviewer/shared';
import { Session, Turn } from '@ai-interviewer/shared';

const REDIS_TTL = 7200; // 2 hours in seconds

export class SessionStore {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(env.REDIS_URL);
    
    this.redis.on('connect', () => {
      logger.info('Redis: Connection established');
    });

    this.redis.on('error', (error: Error) => {
      logger.error({ error }, 'Redis: Connection failure');
    });
  }

  private getKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  async createSession(sessionId: string, userId: string = ''): Promise<Session> {
    const session: Session = {
      id: sessionId,
      userId,
      status: 'active',
      turns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const key = this.getKey(sessionId);
    await this.redis.set(key, JSON.stringify(session), 'EX', REDIS_TTL);
    logger.info({ sessionId, userId }, 'Redis: Session created successfully');
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const key = this.getKey(sessionId);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as Session;
    } catch (error) {
      logger.error({ error, sessionId }, 'Redis: Failed to parse session JSON');
      return null;
    }
  }

  async appendTurn(sessionId: string, turn: Turn): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Redis: Cannot append turn, session ${sessionId} not found`);
    }

    // Upsert the turn based on id (updates transcript/latency on streaming writes, otherwise appends)
    const existingIndex = session.turns.findIndex(t => t.id === turn.id);
    if (existingIndex !== -1) {
      session.turns[existingIndex] = turn;
    } else {
      session.turns.push(turn);
    }
    
    session.updatedAt = new Date().toISOString();

    const key = this.getKey(sessionId);
    await this.redis.set(key, JSON.stringify(session), 'EX', REDIS_TTL);
    logger.debug({ sessionId, turnId: turn.id, role: turn.role }, 'Redis: Turn appended/updated and session updated');
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    await this.redis.del(key);
    logger.info({ sessionId }, 'Redis: Session deleted from cache');
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    logger.info('Redis: Connection closed cleanly');
  }
}
