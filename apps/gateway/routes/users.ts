import { Router, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, users } from '@ai-interviewer/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../errors/AppError';

const router = Router();

router.use(authenticateToken);

// GET /api/v1/users/me
router.get('/me', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      plan: users.plan,
      sessionCount: users.sessionCount,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export const usersRouter = router;
