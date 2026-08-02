import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, users } from '@ai-interviewer/db';
import { authenticateToken } from '../middleware/auth.js';
import { AppError } from '../errors/AppError.js';
const router = Router();
router.use(authenticateToken);
// GET /api/v1/users/me
router.get('/me', async (req, res, next) => {
    try {
        const authReq = req;
        const { id: userId } = authReq.user;
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
    }
    catch (err) {
        next(err);
    }
});
export const usersRouter = router;
