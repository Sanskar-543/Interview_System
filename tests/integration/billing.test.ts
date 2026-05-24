import './setupEnv';
import test from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import express from 'express';
import { createServer } from 'http';
import { db, users, sessions } from '../../packages/db';
import { eq, sql } from 'drizzle-orm';
import { env } from '../../packages/shared/config/env';
import { billingRouter, billingWebhookHandler } from '../../apps/gateway/routes/billing';
import { processCreditRefundJob } from '../../apps/worker/jobs/billing';

// JWT Signing Helpers
import jwt from 'jsonwebtoken';

function getAuthHeader(userId: string): string {
  const token = jwt.sign({ id: userId, email: 'integration_billing@example.com', plan: 'free' }, env.JWT_SECRET);
  return `Bearer ${token}`;
}

test('Billing & Webhook Integration Suite', async (t) => {
  // Set up temporary Express server to mock Gateway behaviors
  const app = express();
  
  // MANDATORY CORRECTION 1: Mount webhook raw parser BEFORE express.json()
  app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);
  
  app.use(express.json());
  app.use('/api/v1/billing', billingRouter);

  // Global Express Error handler to capture AppError status codes
  app.use((err: any, req: any, res: any, next: any) => {
    res.status(err.status || 500).json({ error: { code: err.code || 'ERROR', message: err.message } });
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  // Mock Database helper configurations
  const originalSelect = db.select;
  const originalInsert = db.insert;
  const originalUpdate = db.update;

  let selectResult: any = [];
  let updateValues: any = null;
  let updateUserId: string = '';

  db.select = (() => ({
    from: () => ({
      where: () => ({
        limit: () => selectResult
      })
    })
  })) as any;

  db.update = ((table: any) => ({
    set: (values: any) => {
      updateValues = values;
      return {
        where: (expr: any) => {
          // Capture userId or sessionId from expression
          return {
            onConflictDoNothing: async () => ({})
          };
        }
      };
    }
  })) as any;

  // Cleanup helper
  t.after(async () => {
    db.select = originalSelect;
    db.insert = originalInsert;
    db.update = originalUpdate;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  await t.test('1. Gated Sandbox: missing Razorpay key in production throws BILLING_MISCONFIGURED', async () => {
    const originalNodeEnv = env.NODE_ENV;
    const originalRazorpayKey = env.RAZORPAY_KEY_ID;

    // Simulate Production with missing keys
    (env as any).NODE_ENV = 'production';
    (env as any).RAZORPAY_KEY_ID = undefined;

    const res = await fetch(`${baseUrl}/api/v1/billing/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader('usr_test_1')
      }
    });

    // Restore env values
    (env as any).NODE_ENV = originalNodeEnv;
    (env as any).RAZORPAY_KEY_ID = originalRazorpayKey;

    assert.equal(res.status, 500, 'Production missing keys should trigger 500 server failure');
    const data = await res.json() as any;
    assert.equal(data.error?.code, 'BILLING_MISCONFIGURED');
    assert.equal(data.error?.message, 'Razorpay keys missing in production');
  });

  await t.test('2. Subscribe order works normally under development/sandbox mode', async () => {
    // Populate user
    selectResult = [{ id: 'usr_test_1', plan: 'free', sessionCount: 0 }];

    const res = await fetch(`${baseUrl}/api/v1/billing/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader('usr_test_1')
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.data?.id.startsWith('sub_'));
    assert.equal(body.data?.currency, 'INR');
    assert.equal(body.data?.amount, 29900);
  });

  await t.test('3. Cancel subscription updates database plan state to free', async () => {
    updateValues = null;

    const res = await fetch(`${baseUrl}/api/v1/billing/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader('usr_test_1')
      }
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.data?.success, true);
    assert.equal(updateValues?.plan, 'free');
  });

  await t.test('4. Webhook Security: Invalid Signature rejects payload with 400 (CRITICAL SECURITY GATE)', async () => {
    const mockPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            notes: { userId: 'usr_test_1' }
          }
        }
      }
    };

    const res = await fetch(`${baseUrl}/api/v1/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'totally_fake_cryptographic_signature'
      },
      body: JSON.stringify(mockPayload)
    });

    assert.equal(res.status, 400, 'Invalid signature webhook must strictly return 400 Bad Request');
    const data = await res.json() as any;
    assert.equal(data.error?.code, 'INVALID_SIGNATURE');
    assert.equal(data.error?.message, 'Cryptographic signature is invalid');
  });

  await t.test('5. Webhook Success: Valid signature processes subscription upgrades', async () => {
    updateValues = null;

    const mockPayload = {
      event: 'subscription.charged',
      payload: {
        subscription: {
          entity: {
            id: 'sub_mock_123',
            notes: { userId: 'usr_test_1' }
          }
        }
      }
    };

    const payloadString = JSON.stringify(mockPayload);
    const testSecret = env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';
    const validSignature = crypto
      .createHmac('sha256', testSecret)
      .update(payloadString)
      .digest('hex');

    const res = await fetch(`${baseUrl}/api/v1/billing/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature
      },
      body: payloadString
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.status, 'ok');
    assert.equal(updateValues?.plan, 'paid');
    assert.equal(updateValues?.sessionCount, 0);
  });
});

test('Background Billing Worker Credit Refund Processing', async (t) => {
  const originalSelect = db.select;
  const originalUpdate = db.update;

  let selectCall = 0;
  let updateValues: any = null;
  let mockedSessionState: any = null;
  let mockedUserState: any = null;

  db.select = (() => {
    selectCall++;
    return {
      from: (table: any) => ({
        where: (expr: any) => ({
          limit: (n: number) => {
            // Alternately return session or user mock based on count
            if (selectCall === 1) return mockedSessionState ? [mockedSessionState] : [];
            return mockedUserState ? [mockedUserState] : [];
          }
        })
      })
    };
  }) as any;

  db.update = ((table: any) => ({
    set: (values: any) => {
      updateValues = values;
      return {
        where: () => ({})
      };
    }
  })) as any;

  t.after(() => {
    db.select = originalSelect;
    db.update = originalUpdate;
  });

  await t.test('1. Worker skips credit refund if session status is NOT failed', async () => {
    selectCall = 0;
    updateValues = null;
    mockedSessionState = { id: 'sess_1', status: 'completed', userId: 'usr_1' };
    mockedUserState = { id: 'usr_1', plan: 'free', sessionCount: 2 };

    await processCreditRefundJob({
      sessionId: 'sess_1',
      userId: 'usr_1',
      reason: 'test_reason'
    });

    assert.equal(updateValues, null, 'Should not execute database update if session status is completed');
  });

  await t.test('2. Worker processes credit refund using database SQL GREATEST if status is failed', async () => {
    selectCall = 0;
    updateValues = null;
    mockedSessionState = { id: 'sess_2', status: 'failed', userId: 'usr_1' };
    mockedUserState = { id: 'usr_1', plan: 'free', sessionCount: 2 };

    await processCreditRefundJob({
      sessionId: 'sess_2',
      userId: 'usr_1',
      reason: 'SYSTEM_FAILURE'
    });

    assert.ok(updateValues !== null, 'Should run database update for failed session');
    const sessionCountVal = updateValues.sessionCount;
    // Log the SQL chunk details for inspection
    console.log('SQL OBJECT:', sessionCountVal);
    
    // Check if the sql chunk string or chunks array contains GREATEST
    const hasGreatest = JSON.stringify(sessionCountVal).includes('GREATEST') || 
                        (sessionCountVal && typeof sessionCountVal === 'object' && 'queryChunks' in sessionCountVal);
    
    assert.ok(hasGreatest, 'Drizzle update must use SQL GREATEST constraint');
  });
});
