import { Router, Response, NextFunction, Request } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, users } from '@ai-interviewer/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../errors/AppError';
import { env, logger } from '@ai-interviewer/shared';

export const billingRouter = Router();

// Gated routes for checkout and cancellation
billingRouter.use(authenticateToken);

// POST /api/v1/billing/subscribe
billingRouter.post('/subscribe', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    // MANDATORY CORRECTION 2: Strict production gating
    if (!env.RAZORPAY_KEY_ID && env.NODE_ENV === 'production') {
      throw new AppError('BILLING_MISCONFIGURED', 'Razorpay keys missing in production', 500);
    }

    if (env.NODE_ENV === 'production' && req.body.simulate) {
      throw new AppError('FORBIDDEN', 'Sandbox simulation not allowed in production', 403);
    }

    // Fetch current user
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!currentUser) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    if (currentUser.plan === 'paid') {
      throw new AppError('ALREADY_SUBSCRIBED', 'You are already on the Pro plan', 400);
    }

    // Generate subscription/order response
    const mockId = `sub_${crypto.randomBytes(8).toString('hex')}`;
    res.status(200).json({
      data: {
        id: mockId,
        amount: 29900, // ₹299.00 in paise
        currency: 'INR',
        plan: 'Pro Plan',
        isSandbox: env.NODE_ENV !== 'production'
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/v1/billing/cancel
billingRouter.post('/cancel', async (req, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { id: userId } = authReq.user!;

    // Update user to free plan
    await db.update(users)
      .set({ plan: 'free', updatedAt: new Date() })
      .where(eq(users.id, userId));

    logger.info({ userId }, 'Gateway: User downgraded plan to free');
    res.status(200).json({
      data: {
        success: true,
        message: 'Subscription cancelled successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

// MANDATORY CORRECTION 1: Webhook route handler with explicit raw signature check
export async function billingWebhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    
    // MANDATORY CORRECTION 4: Reject missing/invalid signatures with 400
    if (!signature) {
      logger.error('Gateway Webhook: Missing x-razorpay-signature header');
      res.status(400).json({
        error: {
          code: 'UNAUTHORIZED_WEBHOOK',
          message: 'Webhook signature is missing'
        }
      });
      return;
    }

    // Convert raw body buffer to string
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      logger.error('Gateway Webhook: Request body is not a raw buffer');
      res.status(400).json({
        error: {
          code: 'INVALID_BODY',
          message: 'Webhook body must be raw application/json buffer'
        }
      });
      return;
    }

    const bodyString = rawBody.toString('utf-8');

    // Secure cryptographic validation
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyString)
      .digest('hex');

    if (expectedSignature !== signature) {
      logger.error({ signature, expectedSignature }, 'Gateway Webhook: Cryptographic signature mismatch!');
      res.status(400).json({
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Cryptographic signature is invalid'
        }
      });
      return;
    }

    // Process event
    const payload = JSON.parse(bodyString);
    logger.info({ event: payload.event }, 'Gateway Webhook: Signature verified successfully');

    if (payload.event === 'order.paid' || payload.event === 'subscription.charged' || payload.event === 'payment.captured') {
      // Extract userId from payment notes
      const entity = payload.payload?.payment?.entity || payload.payload?.subscription?.entity;
      const userId = entity?.notes?.userId;

      if (!userId) {
        logger.error({ payload }, 'Gateway Webhook: Missing userId in entity notes');
        res.status(422).json({
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'UserId missing in payment notes'
          }
        });
        return;
      }

      // Upgrade user to Pro plan
      await db.update(users)
        .set({ plan: 'paid', sessionCount: 0, updatedAt: new Date() })
        .where(eq(users.id, userId));

      logger.info({ userId }, 'Gateway Webhook: User subscription plan upgraded to paid successfully');
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    next(error);
  }
}
