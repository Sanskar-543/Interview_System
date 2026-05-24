import { Router, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, sessions, users, turns } from '@ai-interviewer/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../errors/AppError';

const router = Router();

// All session routes require auth
router.use(authenticateToken);

// POST /api/v1/sessions — create a new interview session
router.post('/', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    // Fetch current user to get accurate session count
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!currentUser) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    // Enforce free-tier session limit
    if (currentUser.plan === 'free' && currentUser.sessionCount >= 3) {
      throw new AppError('PLAN_LIMIT_EXCEEDED', 'Upgrade to start more sessions', 403);
    }

    const sessionId = `sess_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const [session] = await db.insert(sessions).values({
      id: sessionId,
      userId,
      status: 'active',
    }).returning();

    // Increment user session count
    await db.update(users)
      .set({ sessionCount: sql`${users.sessionCount} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sessions — list user's sessions
router.get('/', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    const userSessions = await db.select().from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(sessions.createdAt);

    res.json({ sessions: userSessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sessions/:id — get session with turns
router.get('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    const [session] = await db.select().from(sessions)
      .where(eq(sessions.id, req.params.id))
      .limit(1);

    if (!session) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }

    if (session.userId !== userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    const sessionTurns = await db.select().from(turns)
      .where(eq(turns.sessionId, session.id))
      .orderBy(turns.turnIndex);

    res.json({ session: { ...session, turns: sessionTurns } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sessions/:id/end — end a session
router.post('/:id/end', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    const [session] = await db.select().from(sessions)
      .where(eq(sessions.id, req.params.id))
      .limit(1);

    if (!session) {
      throw new AppError('NOT_FOUND', 'Session not found', 404);
    }

    if (session.userId !== userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    if (session.status !== 'active') {
      throw new AppError('BAD_REQUEST', 'Session is not active', 400);
    }

    const [updated] = await db.update(sessions)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(sessions.id, req.params.id))
      .returning();

    res.json({ session: updated });
  } catch (err) {
    next(err);
  }
});

export const sessionsRouter = router;
