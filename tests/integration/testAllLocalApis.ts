import crypto from 'node:crypto';
import WebSocket from 'ws';

const GATEWAY = 'http://localhost:5000';
const VOICE_WS = 'ws://localhost:5001';

async function testAllProductionApisLocally() {
  console.log('=============== 🚀 LOCAL PRODUCTION API TEST SUITE ===============\n');
  const timestamp = Date.now();
  const testEmail = `pro_tester_${timestamp}@example.com`;
  const password = 'Password123!';
  let token = '';
  let userId = '';
  let sessionId = '';

  // 1. Health Check Endpoint
  console.log('1. Testing GET /health ...');
  const healthRes = await fetch(`${GATEWAY}/health`);
  console.log(`   Status: ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log(`   Response:`, healthData);
  if (healthRes.status !== 200 || healthData.status !== 'healthy') throw new Error('Health check failed');
  console.log('   ✅ Health Check PASSED\n');

  // 2. Auth Signup
  console.log('2. Testing POST /api/v1/auth/signup ...');
  const signupRes = await fetch(`${GATEWAY}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password, name: 'Production Tester' }),
  });
  console.log(`   Status: ${signupRes.status}`);
  const signupData = await signupRes.json();
  token = signupData.token;
  userId = signupData.user.id;
  console.log(`   User ID Created: ${userId}`);
  if (signupRes.status !== 201 || !token) throw new Error('Signup failed');
  console.log('   ✅ Auth Signup PASSED\n');

  // 3. Auth Login
  console.log('3. Testing POST /api/v1/auth/login ...');
  const loginRes = await fetch(`${GATEWAY}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password }),
  });
  console.log(`   Status: ${loginRes.status}`);
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.token) throw new Error('Login failed');
  console.log('   ✅ Auth Login PASSED\n');

  // 4. User Profile (/users/me)
  console.log('4. Testing GET /api/v1/users/me ...');
  const meRes = await fetch(`${GATEWAY}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   Status: ${meRes.status}`);
  const meData = await meRes.json();
  console.log(`   User Profile: email=${meData.user.email}, plan=${meData.user.plan}, sessionCount=${meData.user.sessionCount}`);
  if (meRes.status !== 200 || !meData.user) throw new Error('Get profile failed');
  console.log('   ✅ User Profile PASSED\n');

  // 5. Create Interview Session
  console.log('5. Testing POST /api/v1/sessions ...');
  const createSessRes = await fetch(`${GATEWAY}/api/v1/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  console.log(`   Status: ${createSessRes.status}`);
  const createSessData = await createSessRes.json();
  sessionId = createSessData.session.id;
  console.log(`   Session ID Created: ${sessionId}`);
  if (createSessRes.status !== 201 || !sessionId) throw new Error('Create session failed');
  console.log('   ✅ Create Session PASSED\n');

  // 6. List User Sessions
  console.log('6. Testing GET /api/v1/sessions ...');
  const listSessRes = await fetch(`${GATEWAY}/api/v1/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   Status: ${listSessRes.status}`);
  const listSessData = await listSessRes.json();
  console.log(`   Sessions Count: ${listSessData.sessions.length}`);
  if (listSessRes.status !== 200 || !Array.isArray(listSessData.sessions)) throw new Error('List sessions failed');
  console.log('   ✅ List Sessions PASSED\n');

  // 7. Get Session Details & Turns
  console.log(`7. Testing GET /api/v1/sessions/${sessionId} ...`);
  const getSessRes = await fetch(`${GATEWAY}/api/v1/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   Status: ${getSessRes.status}`);
  const getSessData = await getSessRes.json();
  if (getSessRes.status !== 200 || !getSessData.session) throw new Error('Get session detail failed');
  console.log('   ✅ Get Session Detail PASSED\n');

  // 8. Billing Subscription Order (/billing/subscribe)
  console.log('8. Testing POST /api/v1/billing/subscribe ...');
  const subRes = await fetch(`${GATEWAY}/api/v1/billing/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ simulate: false }),
  });
  console.log(`   Status: ${subRes.status}`);
  const subData = await subRes.json();
  console.log(`   Order Details:`, subData.data);
  if (subRes.status !== 200 || !subData.data?.id) throw new Error('Subscribe order failed');
  console.log('   ✅ Billing Subscribe PASSED\n');

  // 9. Razorpay Webhook Signature Verification (/billing/webhook)
  console.log('9. Testing POST /api/v1/billing/webhook (Razorpay HMAC SHA-256) ...');
  const webhookPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_${crypto.randomBytes(6).toString('hex')}`,
          notes: { userId },
        },
      },
    },
  });
  const webhookSecret = 'mock_webhook_secret';
  const validSignature = crypto.createHmac('sha256', webhookSecret).update(webhookPayload).digest('hex');

  // 9a. Invalid signature test
  const invalidWebhookRes = await fetch(`${GATEWAY}/api/v1/billing/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': 'invalid_signature_hex',
    },
    body: webhookPayload,
  });
  console.log(`   Invalid Signature Test Status: ${invalidWebhookRes.status} (Expected 400)`);
  if (invalidWebhookRes.status !== 400) throw new Error('Webhook invalid signature security check failed');

  // 9b. Valid signature test
  const validWebhookRes = await fetch(`${GATEWAY}/api/v1/billing/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validSignature,
    },
    body: webhookPayload,
  });
  console.log(`   Valid Signature Test Status: ${validWebhookRes.status}`);
  const validWebhookData = await validWebhookRes.json();
  console.log(`   Webhook Response:`, validWebhookData);
  if (validWebhookRes.status !== 200) throw new Error('Valid webhook failed');
  console.log('   ✅ Razorpay Webhook HMAC Signature Validation PASSED\n');

  // 10. Verify Plan Upgrade to 'paid' after Webhook
  console.log('10. Verifying User Plan Upgrade ...');
  const meUpgradedRes = await fetch(`${GATEWAY}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meUpgradedData = await meUpgradedRes.json();
  console.log(`    Upgraded Plan: ${meUpgradedData.user.plan}`);
  if (meUpgradedData.user.plan !== 'paid') throw new Error('Plan upgrade verification failed');
  console.log('    ✅ Plan Upgrade Verification PASSED\n');

  // 11. Billing Cancel Subscription
  console.log('11. Testing POST /api/v1/billing/cancel ...');
  const cancelRes = await fetch(`${GATEWAY}/api/v1/billing/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`    Status: ${cancelRes.status}`);
  if (cancelRes.status !== 200) throw new Error('Cancel subscription failed');
  console.log('    ✅ Billing Cancel PASSED\n');

  // 12. Voice Service WebSocket Handshake & Turn Loop
  console.log('12. Testing Voice WebSocket Service Handshake & Initial Greeting ...');
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(VOICE_WS);
    ws.on('open', () => {
      console.log('    WebSocket connected to Voice Service');
      ws.send(JSON.stringify({ type: 'session_start', sessionId }));
    });
    ws.on('message', (msg) => {
      const parsed = JSON.parse(msg.toString());
      console.log(`    Received WS Event [${parsed.type}]:`, parsed);
      if (parsed.type === 'session_started') {
        ws.close();
        resolve();
      }
    });
    ws.on('error', (err) => {
      reject(err);
    });
  });
  console.log('    ✅ Voice Service WebSocket PASSED\n');

  // 13. Reports Endpoint (/reports/:sessionId)
  console.log(`13. Testing GET /api/v1/reports/${sessionId} ...`);
  const reportRes = await fetch(`${GATEWAY}/api/v1/reports/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`    Status: ${reportRes.status}`);
  const reportData = await reportRes.json();
  console.log(`    Report Status Response:`, reportData);
  if (reportRes.status !== 200 && reportRes.status !== 202) throw new Error('Fetch report failed');
  console.log('    ✅ Report Endpoint PASSED\n');

  // 14. End Session Endpoint
  console.log(`14. Testing POST /api/v1/sessions/${sessionId}/end ...`);
  const endRes = await fetch(`${GATEWAY}/api/v1/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`    Status: ${endRes.status}`);
  const endData = await endRes.json();
  console.log(`    End Session Response:`, endData);
  if (endRes.status !== 200) throw new Error('End session failed');
  console.log('    ✅ End Session PASSED\n');

  console.log('===================================================================');
  console.log('🎉 ALL 14 PRODUCTION API ENDPOINTS TESTED LOCALLY WITH 100% SUCCESS!');
  console.log('===================================================================');
}

testAllProductionApisLocally().catch((err) => {
  console.error('\n❌ LOCAL PRODUCTION API TEST FAILED:', err);
  process.exit(1);
});
