import express from 'express';
import { createServer } from 'http';
import httpProxy from 'http-proxy';
import { env, logger } from '@ai-interviewer/shared';
import { rateLimiter } from './middleware/rateLimit';
import { AppError } from './errors/AppError';
import { authRouter } from './routes/auth';
import { sessionsRouter } from './routes/sessions';
import { usersRouter } from './routes/users';
import { reportsRouter } from './routes/reports';

const app = express();
const server = createServer(app);

app.use(express.json());

// Proxy for WebSocket voice connections to the voice-service
const wsProxyTarget = `ws://localhost:${env.PORT + 1}`;
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

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  } else {
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
