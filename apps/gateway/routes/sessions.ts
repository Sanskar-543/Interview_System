import { Router, IRouter, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { eq, sql, desc, asc } from 'drizzle-orm';
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

    const { jobTitle, jobDescription, resumeText, audioMode } = req.body || {};
    const sessionId = `sess_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const [session] = await db.insert(sessions).values({
      id: sessionId,
      userId,
      status: 'active',
      jobTitle: jobTitle || 'Software Engineer',
      jobDescription: jobDescription || null,
      resumeText: resumeText || null,
      audioMode: audioMode === 'push_to_talk' ? 'push_to_talk' : 'hands_free',
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

// POST /api/v1/sessions/parse-pdf — parse PDF resume base64 into clean text
router.post('/parse-pdf', async (req, res: Response, next: NextFunction) => {
  try {
    const { pdfBase64 } = req.body || {};
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      throw new AppError('INVALID_INPUT', 'Base64 encoded PDF data is required', 400);
    }

    // Strip data URL prefix if present (e.g. data:application/pdf;base64,...)
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const parsedResult = await parser.getText();

    let rawText = parsedResult?.text || '';
    if (!rawText && parsedResult?.pages) {
      rawText = parsedResult.pages.map((p: any) => p.text || '').join('\n');
    }

    // Clean text: strip page number footers, repetitive whitespace
    const cleanText = rawText
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanText || cleanText.length < 15) {
      throw new AppError('PDF_PARSING_FAILED', 'Could not extract text from PDF document. Please paste resume text directly.', 422);
    }

    res.json({
      text: cleanText,
      characterCount: cleanText.length,
      wordCount: cleanText.split(/\s+/).filter(Boolean).length,
    });
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
      .orderBy(desc(sessions.createdAt));

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
      .orderBy(asc(turns.turnIndex));

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

export const sessionsRouter: IRouter = router;
