import { Router, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, reports } from '@ai-interviewer/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../errors/AppError';

const router = Router();

// All report routes require auth
router.use(authenticateToken);

// GET /api/v1/reports/:session_id — retrieve interview score report
router.get('/:session_id', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    const [report] = await db.select().from(reports)
      .where(eq(reports.sessionId, req.params.session_id))
      .limit(1);

    if (!report) {
      return res.status(202).json({
        status: 'pending',
        message: 'Evaluation in progress. Please check again in a moment.',
      });
    }

    if (report.userId !== userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

export const reportsRouter = router;
