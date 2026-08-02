import './setupEnv.js';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { createServer } from 'http';
import { db, users, sessions, turns } from '../../packages/db/index.js';
import { eq } from 'drizzle-orm';
import { authRouter } from '../../apps/gateway/routes/auth.js';
import { sessionsRouter } from '../../apps/gateway/routes/sessions.js';
import { usersRouter } from '../../apps/gateway/routes/users.js';
import { AppError } from '../../apps/gateway/errors/AppError.js';

// IN-MEMORY DRIZZLE MOCK ENGINE
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function getTableName(table) {
  try {
    const symName = table[Symbol.for('drizzle:Name')];
    if (symName) return symName;
    if (table._?.name) return table._.name;
    const { getTableConfig } = require('drizzle-orm/pg-core');
    return getTableConfig(table).name;
  } catch {
    return table.tableName || '';
  }
}

function parseCondition(condition) {
  let field = '';
  let value = undefined;

  if (condition) {
    if (condition.queryChunks) {
      for (const chunk of condition.queryChunks) {
        if (chunk && typeof chunk === 'object') {
          if (chunk.name) {
            field = chunk.name;
          } else if (chunk.value !== undefined) {
            if (!Array.isArray(chunk.value)) {
              value = chunk.value;
            }
          }
        }
      }
    } else {
      field = condition.left?.name || '';
      value = condition.right;
    }
  }

  return { field, value };
}

const mockUsers = [];
const mockSessions = [];
const mockTurns = [];

// Override select
db.select = function() {
  return {
    from: (table) => {
      const getMatches = () => {
        const tableName = getTableName(table);
        if (tableName === 'users') return mockUsers;
        if (tableName === 'sessions') return mockSessions;
        if (tableName === 'turns') return mockTurns;
        return [];
      };

      const chain = {
        where: (condition) => {
          let filtered = getMatches();
          if (condition) {
            const { field, value } = parseCondition(condition);

            filtered = filtered.filter((item) => {
              if (field === 'email') return item.email === value;
              if (field === 'id') return item.id === value;
              if (field === 'user_id') return item.userId === value;
              if (field === 'session_id') return item.sessionId === value;
              return true;
            });
          }

          const whereChain = {
            limit: (num) => {
              const res = filtered.slice(0, num);
              return Promise.resolve(res);
            },
            orderBy: (orderField) => {
              return Promise.resolve(filtered);
            },
            then: (resolve) => resolve(filtered),
          };
          return whereChain;
        },
        orderBy: (orderField) => {
          const list = getMatches();
          return Promise.resolve(list);
        },
        then: (resolve) => resolve(getMatches()),
      };
      return chain;
    }
  };
};

// Override insert
db.insert = function(table) {
  return {
    values: (data) => {
      const records = Array.isArray(data) ? data : [data];
      const inserted = [];
      for (const rec of records) {
        const newRec = {
          id: rec.id,
          email: rec.email,
          passwordHash: rec.passwordHash,
          name: rec.name,
          plan: rec.plan || 'free',
          sessionCount: rec.sessionCount !== undefined ? rec.sessionCount : 0,
          status: rec.status || 'active',
          emailVerified: rec.emailVerified,
          provider: rec.provider,
          userId: rec.userId,
          sessionId: rec.sessionId,
          turnIndex: rec.turnIndex,
          role: rec.role,
          transcript: rec.transcript,
          latencyMs: rec.latencyMs,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const tableName = getTableName(table);
        if (tableName === 'users') mockUsers.push(newRec);
        if (tableName === 'sessions') mockSessions.push(newRec);
        if (tableName === 'turns') mockTurns.push(newRec);
        inserted.push(newRec);
      }

      const insertChain = {
        returning: () => {
          return Promise.resolve(inserted);
        },
        then: (resolve) => resolve(inserted),
      };
      return insertChain;
    }
  };
};

// Override update
db.update = function(table) {
  return {
    set: (updateData) => {
      return {
        where: (condition) => {
          const { field, value } = parseCondition(condition);

          let list = [];
          const tableName = getTableName(table);
          if (tableName === 'users') list = mockUsers;
          if (tableName === 'sessions') list = mockSessions;
          if (tableName === 'turns') list = mockTurns;

          const updated = [];
          for (const item of list) {
            const match = (field === 'id' && item.id === value) ||
                          (field === 'email' && item.email === value) ||
                          (field === 'user_id' && item.userId === value) ||
                          (field === 'session_id' && item.sessionId === value);

            if (match) {
              for (const k of Object.keys(updateData)) {
                if (k === 'sessionCount') {
                  item.sessionCount = (item.sessionCount || 0) + 1;
                } else {
                  item[k] = updateData[k];
                }
              }
              item.updatedAt = new Date().toISOString();
              updated.push(item);
            }
          }

          const updateChain = {
            returning: () => {
              return Promise.resolve(updated);
            },
            then: (resolve) => resolve(updated),
          };
          return updateChain;
        }
      };
    }
  };
};

// Override delete
db.delete = function(table) {
  return {
    where: (condition) => {
      const { field, value } = parseCondition(condition);

      const tableName = getTableName(table);
      if (tableName === 'users') {
        const idx = mockUsers.findIndex(u => u.id === value || u.email === value);
        if (idx !== -1) mockUsers.splice(idx, 1);
      }
      if (tableName === 'sessions') {
        const idx = mockSessions.findIndex(s => s.id === value || s.userId === value);
        if (idx !== -1) mockSessions.splice(idx, 1);
      }
      if (tableName === 'turns') {
        const idx = mockTurns.findIndex(t => t.id === value || t.sessionId === value);
        if (idx !== -1) mockTurns.splice(idx, 1);
      }

      return Promise.resolve();
    }
  };
};

// Setup test Express App
const app = express();
app.use(express.json());

// Mount routers
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/users', usersRouter);

// Global Error Handler matching apps/gateway/server.js
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  } else {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
      },
    });
  }
});

const TEST_EMAIL = 'test_integration@example.com';
const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'Integration Tester';

test('Auth and Sessions Flow Integration Tests', async (t) => {
  let server;
  let baseUrl = '';
  let token = '';
  let activeSessionId = '';

  // Startup test server on a dynamic port
  t.before(() => {
    return new Promise((resolve) => {
      server = createServer(app);
      server.listen(0, () => {
        const addr = server.address();
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  t.after(async () => {
    // Shutdown server
    await new Promise((resolve) => server.close(() => resolve()));

    // Cleanup Database entries for test email
    try {
      const [testUser] = await db.select().from(users).where(eq(users.email, TEST_EMAIL)).limit(1);
      if (testUser) {
        // Delete dependent turns, sessions and user
        const userSessions = await db.select().from(sessions).where(eq(sessions.userId, testUser.id));
        for (const s of userSessions) {
          await db.delete(turns).where(eq(turns.sessionId, s.id));
        }
        await db.delete(sessions).where(eq(sessions.userId, testUser.id));
        await db.delete(users).where(eq(users.id, testUser.id));
      }
    } catch (err) {
      console.warn('DB cleanup warning:', err);
    }
  });

  await t.test('01. Clean existing test user if present', async () => {
    try {
      const [existingUser] = await db.select().from(users).where(eq(users.email, TEST_EMAIL)).limit(1);
      if (existingUser) {
        const userSessions = await db.select().from(sessions).where(eq(sessions.userId, existingUser.id));
        for (const s of userSessions) {
          await db.delete(turns).where(eq(turns.sessionId, s.id));
        }
        await db.delete(sessions).where(eq(sessions.userId, existingUser.id));
        await db.delete(users).where(eq(users.id, existingUser.id));
      }
    } catch (err) {
      // Ignore if database or tables don't exist yet, which will be caught in subsequent tests
    }
  });

  await t.test('02. User Sign Up', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      }),
    });

    assert.equal(res.status, 201, 'Signup should return 201 Created');
    const data = await res.json();
    assert.ok(data.user, 'Signup response should contain user object');
    assert.equal(data.user.email, TEST_EMAIL, 'User email should match signup email');
    assert.ok(!data.user.passwordHash, 'Signup response should not expose passwordHash');
  });

  await t.test('03. Duplicate Sign Up Prevention', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      }),
    });

    assert.equal(res.status, 409, 'Duplicate signup should return 409 Conflict');
    const data = await res.json();
    assert.equal(data.error.code, 'CONFLICT', 'Duplicate error code should be CONFLICT');
  });

  await t.test('04. User Log In', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    assert.equal(res.status, 200, 'Login should return 200 OK');
    const data = await res.json();
    assert.ok(data.token, 'Login response should contain JWT token');
    token = data.token;
  });

  await t.test('05. Invalid Credentials Log In', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: 'WrongPassword!',
      }),
    });

    assert.equal(res.status, 401, 'Invalid login should return 401 Unauthorized');
  });

  await t.test('06. Get Current User Profile without JWT', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`);
    assert.equal(res.status, 401, 'No token profile request should return 401 Unauthorized');
  });

  await t.test('07. Get Current User Profile with Invalid JWT', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { 'Authorization': 'Bearer invalid_token_value' },
    });
    assert.equal(res.status, 403, 'Invalid token profile request should return 403 Forbidden');
  });

  await t.test('08. Get Current User Profile with Valid JWT', async () => {
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    assert.equal(res.status, 200, 'Profile request should return 200 OK');
    const data = await res.json();
    assert.ok(data.user, 'Profile response should contain user object');
    assert.equal(data.user.email, TEST_EMAIL, 'Email should match active user');
    assert.equal(data.user.plan, 'free', 'Default plan should be free');
    assert.equal(data.user.sessionCount, 0, 'Initial session count should be 0');
  });

  await t.test('09. Create Interview Session 1', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 201, 'Session 1 creation should return 201 Created');
    const data = await res.json();
    assert.ok(data.session, 'Session response should contain session object');
    assert.equal(data.session.status, 'active', 'Created session should be active');
    activeSessionId = data.session.id;

    // Verify user session count is incremented to 1
    const profileRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const profileData = await profileRes.json();
    assert.equal(profileData.user.sessionCount, 1, 'Session count should be 1');
  });

  await t.test('10. List User Sessions', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sessions`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    assert.equal(res.status, 200, 'Listing sessions should return 200 OK');
    const data = await res.json();
    assert.ok(Array.isArray(data.sessions), 'Sessions response should be an array');
    assert.equal(data.sessions.length, 1, 'User should have exactly 1 session');
    assert.equal(data.sessions[0].id, activeSessionId, 'Session ID should match');
  });

  await t.test('11. Get Individual Session Details', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sessions/${activeSessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    assert.equal(res.status, 200, 'Get individual session should return 200 OK');
    const data = await res.json();
    assert.ok(data.session, 'Response should contain session');
    assert.equal(data.session.id, activeSessionId, 'IDs should match');
    assert.ok(Array.isArray(data.session.turns), 'Turns should be an array');
  });

  await t.test('12. Create Interview Session 2 and 3', async () => {
    // Session 2
    const res2 = await fetch(`${baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    assert.equal(res2.status, 201, 'Session 2 creation should return 201');

    // Session 3
    const res3 = await fetch(`${baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    assert.equal(res3.status, 201, 'Session 3 creation should return 201');

    // Verify session count is 3
    const profileRes = await fetch(`${baseUrl}/api/v1/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const profileData = await profileRes.json();
    assert.equal(profileData.user.sessionCount, 3, 'Session count should be 3');
  });

  await t.test('13. Enforce Free Plan Session Limit (Session 4 should fail)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 403, 'Session 4 should be rejected with 403 Forbidden');
    const data = await res.json();
    assert.equal(data.error.code, 'PLAN_LIMIT_EXCEEDED', 'Error code should be PLAN_LIMIT_EXCEEDED');
  });

  await t.test('14. Complete/End Session', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sessions/${activeSessionId}/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 200, 'Ending session should return 200 OK');
    const data = await res.json();
    assert.equal(data.session.status, 'completed', 'Ended session status should be completed');
  });
});
