import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import httpProxy from 'http-proxy';
import { env, logger } from '@ai-interviewer/shared';
import { rateLimiter } from './middleware/rateLimit.js';
import { AppError } from './errors/AppError.js';
import { authRouter } from './routes/auth.js';
import { sessionsRouter } from './routes/sessions.js';
import { usersRouter } from './routes/users.js';
import { reportsRouter } from './routes/reports.js';
import { billingRouter, billingWebhookHandler } from './routes/billing.js';
import { adminRouter } from './routes/admin.js';
const app = express();
const server = createServer(app);
// CORS — allow Vercel frontend origin & localhost
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin)
            return callback(null, true);
        const configuredOrigins = env.CORS_ORIGIN
            ? env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''))
            : [];
        const normalizedOrigin = origin.replace(/\/$/, '');
        if (configuredOrigins.includes(normalizedOrigin) ||
            configuredOrigins.includes('*') ||
            normalizedOrigin.endsWith('.vercel.app') ||
            normalizedOrigin.startsWith('http://localhost')) {
            return callback(null, true);
        }
        logger.warn({ origin }, 'Gateway CORS rejected origin');
        return callback(null, false);
    },
    credentials: true,
}));
// MANDATORY CORRECTION 1: Razorpay webhook mounted BEFORE express.json() using raw body parser
app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);
app.use(express.json());
// Proxy for WebSocket voice connections to the voice-service (use explicit 127.0.0.1 to prevent IPv6 ::1 ECONNREFUSED)
const wsProxyTarget = (env.VOICE_SERVICE_URL || `ws://127.0.0.1:${env.PORT + 1}`).replace('localhost', '127.0.0.1');
const proxy = httpProxy.createProxyServer({
    target: wsProxyTarget,
    ws: true,
});
proxy.on('error', (err, req, res) => {
    logger.error({ err }, 'Gateway: Proxy error occurred');
});
// Upgrade handler for WS proxying
server.on('upgrade', (req, socket, head) => {
    const ip = req.socket.remoteAddress || 'unknown';
    logger.info({ ip }, 'Gateway: Upgrade request received');
    proxy.ws(req, socket, head);
});
// Health check
app.get('/health', rateLimiter, (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});
// API v1 routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/admin', adminRouter);
// Global error handler
app.use((err, req, res, next) => {
    if (err instanceof AppError) {
        res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
            },
        });
    }
    else {
        logger.error({ err }, 'Gateway: Unhandled server failure');
        res.status(500).json({
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
            },
        });
    }
});
const PORT = env.PORT;
server.listen(PORT, () => {
    logger.info(`Gateway: Express API Gateway running on port ${PORT}`);
});
