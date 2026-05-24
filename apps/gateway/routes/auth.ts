import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, users } from '@ai-interviewer/db';
import { env } from '@ai-interviewer/shared';
import { AppError } from '../errors/AppError';

const router = Router();

// POST /api/v1/auth/signup
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new AppError('VALIDATION_ERROR', 'email, password, and name are required', 400);
    }

    // Check existing user
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      throw new AppError('CONFLICT', 'Email already registered', 409);
    }

    const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db.insert(users).values({
      id,
      email,
      passwordHash,
      name,
      plan: 'free',
      sessionCount: 0,
    }).returning();

    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan },
      env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'email and password are required', 400);
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan },
      env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    next(err);
  }
});

export const authRouter = router;
