import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { env, logger } from '@ai-interviewer/shared';
import { AppError } from '../errors/AppError';

const redis = new Redis(env.REDIS_URL);

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:${ip}`;
  const limit = 20; // 20 requests per minute
  const windowMs = 60000; // 1 minute

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    if (current > limit) {
      logger.warn({ ip, current }, 'Gateway: Rate limit exceeded');
      
      const retryAfter = Math.ceil((await redis.pttl(key)) / 1000);
      
      res.setHeader('Retry-After', retryAfter);
      return next(new AppError('RATE_LIMITED', 'Too many requests', 429));
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Gateway: Rate limiter internal failure');
    next(); // Fail-open on database failure to not break user connections
  }
};
