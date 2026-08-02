import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, users } from '@ai-interviewer/db';
import { env, logger } from '@ai-interviewer/shared';
import { AppError } from '../errors/AppError.js';
const router = Router();
// Helper to generate 6-digit OTP
function generateOtpCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// 1. POST /api/v1/auth/signup-init & /signup (Step 1: Enter Name & Email -> Sends 6-Digit OTP)
const handleSignupInit = async (req, res, next) => {
    try {
        const { name, email } = req.body;
        if (!name || !email) {
            throw new AppError('VALIDATION_ERROR', 'name and email are required', 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        // Check existing verified user
        const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing && existing.emailVerified && existing.passwordHash) {
            throw new AppError('CONFLICT', 'Email is already registered. Please sign in instead.', 409);
        }
        const otpCode = generateOtpCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-min expiration
        if (existing) {
            // Update unverified record with new name and fresh OTP
            await db.update(users)
                .set({
                name: name.trim(),
                verificationCode: otpCode,
                verificationExpiresAt: expiresAt,
                updatedAt: new Date(),
            })
                .where(eq(users.id, existing.id));
        }
        else {
            // Insert new unverified user record
            const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
            await db.insert(users).values({
                id,
                email: normalizedEmail,
                name: name.trim(),
                passwordHash: null,
                plan: 'free',
                sessionCount: 0,
                emailVerified: false,
                provider: 'credentials',
                verificationCode: otpCode,
                verificationExpiresAt: expiresAt,
            });
        }
        // Log verification code prominently in server terminal
        console.log(`\n======================================================`);
        console.log(`📧 VERIFICATION CODE FOR ${normalizedEmail}: [ ${otpCode} ]`);
        console.log(`======================================================\n`);
        logger.info({ email: normalizedEmail, code: otpCode }, 'Auth: Generated 6-digit OTP verification code');
        res.status(200).json({
            requireVerification: true,
            email: normalizedEmail,
            message: 'Verification code generated! Please enter the 6-digit OTP code to verify your email.',
        });
    }
    catch (err) {
        next(err);
    }
};
router.post('/signup-init', handleSignupInit);
// POST /api/v1/auth/signup — direct registration (creates a fully verified user in one step)
router.post('/signup', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            throw new AppError('VALIDATION_ERROR', 'name, email and password are required', 400);
        }
        if (password.length < 8) {
            throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters long', 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing && existing.emailVerified && existing.passwordHash) {
            throw new AppError('CONFLICT', 'Email is already registered. Please sign in instead.', 409);
        }
        const passwordHash = await bcrypt.hash(password, 12);
        if (existing) {
            const [updatedUser] = await db.update(users)
                .set({
                name: name.trim(),
                passwordHash,
                emailVerified: true,
                updatedAt: new Date(),
            })
                .where(eq(users.id, existing.id))
                .returning();
            logger.info({ userId: updatedUser.id, email: updatedUser.email }, 'Auth: User completed direct signup');
            return res.status(201).json({
                user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, plan: updatedUser.plan },
            });
        }
        const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const [newUser] = await db.insert(users).values({
            id,
            email: normalizedEmail,
            name: name.trim(),
            passwordHash,
            plan: 'free',
            sessionCount: 0,
            emailVerified: true,
            provider: 'credentials',
        }).returning();
        logger.info({ userId: newUser.id, email: newUser.email }, 'Auth: User registered via direct signup');
        res.status(201).json({
            user: { id: newUser.id, email: newUser.email, name: newUser.name, plan: newUser.plan },
        });
    }
    catch (err) {
        next(err);
    }
});
// 2. POST /api/v1/auth/verify-email (Step 2: Validates 6-Digit OTP)
router.post('/verify-email', async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            throw new AppError('VALIDATION_ERROR', 'email and 6-digit verification code are required', 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (!user) {
            throw new AppError('NOT_FOUND', 'User account not found', 404);
        }
        if (!user.verificationCode || user.verificationCode !== code.trim()) {
            throw new AppError('VALIDATION_ERROR', 'Invalid verification code. Please check your code and try again.', 400);
        }
        if (user.verificationExpiresAt && new Date() > user.verificationExpiresAt) {
            throw new AppError('VALIDATION_ERROR', 'Verification code has expired. Please request a new code.', 400);
        }
        // Update emailVerified status & clear OTP code
        await db.update(users)
            .set({
            emailVerified: true,
            verificationCode: null,
            verificationExpiresAt: null,
            updatedAt: new Date(),
        })
            .where(eq(users.id, user.id));
        logger.info({ userId: user.id, email: user.email }, 'Auth: User email verified successfully');
        res.status(200).json({
            verified: true,
            email: user.email,
            message: 'Email verified successfully! Please set your password to finish account creation.',
        });
    }
    catch (err) {
        next(err);
    }
});
// 3. POST /api/v1/auth/create-password (Step 3: Creates & Confirms Password for Verified Email)
router.post('/create-password', async (req, res, next) => {
    try {
        const { email, password, confirmPassword } = req.body;
        if (!email || !password || !confirmPassword) {
            throw new AppError('VALIDATION_ERROR', 'email, password, and confirmPassword are required', 400);
        }
        if (password !== confirmPassword) {
            throw new AppError('VALIDATION_ERROR', 'Passwords do not match. Please re-enter your password carefully.', 400);
        }
        if (password.length < 8) {
            throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters long', 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (!user) {
            throw new AppError('NOT_FOUND', 'User account not found', 404);
        }
        if (!user.emailVerified) {
            throw new AppError('UNAUTHORIZED', 'Email must be verified before setting a password', 401);
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const [updatedUser] = await db.update(users)
            .set({
            passwordHash,
            emailVerified: true,
            updatedAt: new Date(),
        })
            .where(eq(users.id, user.id))
            .returning();
        const token = jwt.sign({ id: updatedUser.id, email: updatedUser.email, plan: updatedUser.plan }, env.JWT_SECRET, { expiresIn: '7d' });
        logger.info({ userId: updatedUser.id, email: updatedUser.email }, 'Auth: User created password and finished registration');
        res.status(200).json({
            token,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                plan: updatedUser.plan,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/v1/auth/resend-verification (Resends fresh 6-digit OTP)
router.post('/resend-verification', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            throw new AppError('VALIDATION_ERROR', 'email is required', 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (!user) {
            throw new AppError('NOT_FOUND', 'User account not found', 404);
        }
        const otpCode = generateOtpCode();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.update(users)
            .set({
            verificationCode: otpCode,
            verificationExpiresAt: expiresAt,
            updatedAt: new Date(),
        })
            .where(eq(users.id, user.id));
        console.log(`\n======================================================`);
        console.log(`🔄 NEW VERIFICATION CODE FOR ${user.email}: [ ${otpCode} ]`);
        console.log(`======================================================\n`);
        res.json({ status: 'success', message: 'A new 6-digit verification code has been generated.' });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new AppError('VALIDATION_ERROR', 'email and password are required', 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (!user || !user.passwordHash) {
            throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
        }
        // Check if email is verified
        if (!user.emailVerified) {
            return res.status(200).json({
                requireVerification: true,
                email: user.email,
                message: 'Please verify your email before signing in.',
            });
        }
        const token = jwt.sign({ id: user.id, email: user.email, plan: user.plan }, env.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/v1/auth/oauth (Google & GitHub Social OAuth Endpoint)
router.post('/oauth', async (req, res, next) => {
    try {
        const { provider, email, name, providerId } = req.body;
        if (!provider || !email || !name) {
            throw new AppError('VALIDATION_ERROR', 'provider, email, and name are required', 400);
        }
        if (provider !== 'google' && provider !== 'github') {
            throw new AppError('VALIDATION_ERROR', 'Provider must be "google" or "github"', 400);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        let user = existingUser;
        if (user) {
            const [updatedUser] = await db.update(users)
                .set({
                emailVerified: true,
                provider: provider,
                providerId: providerId || user.providerId,
                updatedAt: new Date(),
            })
                .where(eq(users.id, user.id))
                .returning();
            user = updatedUser;
        }
        else {
            const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
            const [newUser] = await db.insert(users).values({
                id,
                email: normalizedEmail,
                name: name,
                plan: 'free',
                sessionCount: 0,
                emailVerified: true,
                provider: provider,
                providerId: providerId || id,
            }).returning();
            user = newUser;
        }
        const token = jwt.sign({ id: user.id, email: user.email, plan: user.plan }, env.JWT_SECRET, { expiresIn: '7d' });
        logger.info({ userId: user.id, email: user.email, provider }, 'Auth: Successful OAuth login');
        res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
export const authRouter = router;
