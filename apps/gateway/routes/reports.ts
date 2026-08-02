import { Router, IRouter, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, reports, sessions } from '@ai-interviewer/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../errors/AppError';
import { processEvaluationJob } from '../../worker/jobs/eval';

const router = Router();

// All report routes require auth
router.use(authenticateToken);

// GET /api/v1/reports/:session_id — retrieve interview score report
router.get('/:session_id', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;
    const sessionId = req.params.session_id;

    // Check if session exists in DB
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

    let [report] = await db.select().from(reports)
      .where(eq(reports.sessionId, sessionId))
      .limit(1);

    // If report does not exist yet, trigger evaluation synchronously so report analysis never hangs!
    if (!report) {
      const evalUserId = session ? session.userId : userId;
      await processEvaluationJob({ sessionId, userId: evalUserId }).catch(() => {});
      [report] = await db.select().from(reports)
        .where(eq(reports.sessionId, sessionId))
        .limit(1);
    }

    if (!report) {
      throw new AppError('NOT_FOUND', 'Report could not be generated for this session', 404);
    }

    // Auto-update report userId to match logged-in user if guest fallback was used
    if (report.userId !== userId && (session?.userId === userId || report.userId === 'usr_guest')) {
      await db.update(reports)
        .set({ userId })
        .where(eq(reports.id, report.id));
      report.userId = userId;
    }

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

export const reportsRouter: IRouter = router;
