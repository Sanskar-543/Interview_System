import Redis from 'ioredis';
import { env, logger } from '@ai-interviewer/shared';
const REDIS_TTL = 7200; // 2 hours in seconds
export class SessionStore {
    redis;
    constructor() {
        this.redis = new Redis(env.REDIS_URL);
        this.redis.on('connect', () => {
            logger.info('Redis: Connection established');
        });
        this.redis.on('error', (error) => {
            logger.error({ error }, 'Redis: Connection failure');
        });
    }
    getKey(sessionId) {
        return `session:${sessionId}`;
    }
    async createSession(sessionId, userId = '') {
        const session = {
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
    async getSession(sessionId) {
        const key = this.getKey(sessionId);
        const data = await this.redis.get(key);
        if (!data) {
            return null;
        }
        try {
            return JSON.parse(data);
        }
        catch (error) {
            logger.error({ error, sessionId }, 'Redis: Failed to parse session JSON');
            return null;
        }
    }
    async appendTurn(sessionId, turn) {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new Error(`Redis: Cannot append turn, session ${sessionId} not found`);
        }
        // Upsert the turn based on id (updates transcript/latency on streaming writes, otherwise appends)
        const existingIndex = session.turns.findIndex(t => t.id === turn.id);
        if (existingIndex !== -1) {
            session.turns[existingIndex] = turn;
        }
        else {
            session.turns.push(turn);
        }
        session.updatedAt = new Date().toISOString();
        const key = this.getKey(sessionId);
        await this.redis.set(key, JSON.stringify(session), 'EX', REDIS_TTL);
        logger.debug({ sessionId, turnId: turn.id, role: turn.role }, 'Redis: Turn appended/updated and session updated');
    }
    async deleteSession(sessionId) {
        const key = this.getKey(sessionId);
        await this.redis.del(key);
        logger.info({ sessionId }, 'Redis: Session deleted from cache');
    }
    async disconnect() {
        await this.redis.quit();
        logger.info('Redis: Connection closed cleanly');
    }
}
