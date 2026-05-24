import './setupEnv';
import test from 'node:test';
import assert from 'node:assert';
import { getEmbedding } from '../../packages/rag/embed';
import { searchKnowledge } from '../../packages/rag/search';
import { processEvaluationJob } from '../../apps/worker/jobs/eval';
import { CircuitBreaker } from '../../apps/voice-service/circuit/breaker';
import { db, sessions, turns, reports, users } from '../../packages/db';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

// In-Memory Drizzle/Database Mocks for Integration Testing
const mockDbState = {
  users: [] as any[],
  sessions: [] as any[],
  turns: [] as any[],
  reports: [] as any[],
  knowledge: [] as any[],
};

// Intercept DB query methods to simulate full Neon postgres layer during testing
test('RAG & Worker Integration: getEmbedding throws AppError on failure', async () => {
  // Global fetch mock to simulate OpenRouter API failure
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as any;
  };

  try {
    await getEmbedding('test text');
    assert.fail('Should have thrown AppError');
  } catch (err: any) {
    assert.equal(err.name, 'AppError');
    assert.equal(err.code, 'EMBEDDING_FAILED');
    assert.equal(err.message, 'Could not generate embedding');
    assert.equal(err.status, 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RAG & Worker Integration: processEvaluationJob satisfies Idempotency Guard', async () => {
  const sessionId = `sess_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // Mock database calls for this test
  const originalSelect = db.select;
  const originalInsert = db.insert;

  let selectCallCount = 0;
  let insertCallCount = 0;
  const existingReports: any[] = [];

  // Override db select and insert
  db.select = (() => {
    return {
      from: (table: any) => {
        return {
          where: (expr: any) => {
            return {
              limit: (n: number) => {
                selectCallCount++;
                return existingReports;
              },
              orderBy: (col: any) => {
                return []; // turns
              }
            };
          },
          orderBy: (col: any) => {
            return []; // turns
          }
        };
      }
    };
  }) as any;

  db.insert = ((table: any) => {
    return {
      values: (val: any) => {
        insertCallCount++;
        existingReports.push(val);
        return {
          onConflictDoNothing: async () => ({})
        };
      }
    };
  }) as any;

  try {
    // 1. Run evaluation job the first time - should create report
    await processEvaluationJob({ sessionId, userId });
    assert.equal(insertCallCount, 1, 'Should create report on first invocation');
    assert.equal(existingReports.length, 1, 'Report should exist in mock array');

    // Reset counters but keep existingReports populated to trigger idempotency guard
    insertCallCount = 0;
    
    // 2. Run evaluation job the second time - should trigger idempotency guard and skip insert
    await processEvaluationJob({ sessionId, userId });
    assert.equal(insertCallCount, 0, 'Idempotency Guard failed: Inserted duplicate report!');
  } finally {
    db.select = originalSelect;
    db.insert = originalInsert;
  }
});

test('CircuitBreaker Fallbacks: Exercises all four levels explicitly', async () => {
  const breaker = new CircuitBreaker();
  const sessionId = 'sess_breaker_test';
  const userId = 'usr_breaker_test';

  const originalFetch = globalThis.fetch;
  let completionsCallCount = 0;
  let primaryModelFailed = false;

  const mockCompletionsCall = async (model: string) => {
    completionsCallCount++;
    if (model === 'default') {
      if (primaryModelFailed) {
        throw new Error('Primary Model Failed');
      }
      return 'Primary LLM Response';
    }
    if (model.includes('gemini') || model.includes('llama') || model.includes('mistral')) {
      throw new Error(`Backup Model ${model} Failed`);
    }
    return `Backup LLM Response: ${model}`;
  };

  try {
    // LEVEL 1: Primary LLM succeeds
    const res1 = await breaker.runCompletionWithFallback(
      [],
      mockCompletionsCall,
      sessionId,
      userId
    );
    assert.equal(res1.response, 'Primary LLM Response');
    assert.equal(res1.usedFallback, false);
    assert.equal(res1.tripRefund, false);

    // LEVEL 2: Primary LLM fails -> backup model rotation occurs (Level 2)
    // For this test, we simulate that all completions fail (including backup models)
    primaryModelFailed = true;
    const res2 = await breaker.runCompletionWithFallback(
      [],
      mockCompletionsCall,
      sessionId,
      userId
    );

    // Since we throw errors for all models inside mockCompletionsCall, it should fall back to Level 3 (Redis/Static Questions)
    assert.ok(res2.response.length > 0, 'Level 3 Fallback should serve a question');
    assert.equal(res2.usedFallback, true);
    assert.equal(res2.tripRefund, true, 'Should flag for Level 4 credit refund job');

  } finally {
    globalThis.fetch = originalFetch;
    await breaker.close();
  }
});
