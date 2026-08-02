import { Router, IRouter, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, users } from '@ai-interviewer/db';
import { env, logger } from '@ai-interviewer/shared';
import { AppError } from '../errors/AppError';

const router = Router();

// POST /api/v1/admin/users/grant-pro — Admin endpoint to manually grant premium access
router.post('/users/grant-pro', async (req, res: Response, next: NextFunction) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const secretKey = process.env.ADMIN_SECRET_KEY || 'super_secret_admin_key_2026';

    if (adminKey !== secretKey) {
      throw new AppError('UNAUTHORIZED', 'Invalid admin security key', 401);
    }

    const { email, userId, plan = 'paid' } = req.body;

    if (!email && !userId) {
      throw new AppError('BAD_REQUEST', 'Please provide either an email or userId', 400);
    }

    const queryCondition = email ? eq(users.email, email.trim().toLowerCase()) : eq(users.id, userId.trim());
    const [existingUser] = await db.select().from(users).where(queryCondition).limit(1);

    if (!existingUser) {
      throw new AppError('NOT_FOUND', `User ${email || userId} was not found`, 404);
    }

    const [updatedUser] = await db.update(users)
      .set({
        plan: plan === 'free' ? 'free' : 'paid',
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    logger.info({ userId: updatedUser.id, email: updatedUser.email, newPlan: updatedUser.plan }, 'Admin: Manually granted user plan status');

    res.json({
      status: 'success',
      message: `User plan successfully updated to ${updatedUser.plan.toUpperCase()}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        plan: updatedUser.plan,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const adminRouter: IRouter = router;
