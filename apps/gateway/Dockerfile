# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm

# Copy workspace metadata first to cache installs
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/voice-service/package.json ./apps/voice-service/
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/rag/package.json ./packages/rag/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (development + production) using frozen-lockfile
RUN pnpm install --frozen-lockfile

# Copy source code and build service
COPY . .
RUN pnpm --filter @ai-interviewer/gateway build

# Prune workspace dependencies: copy built assets and production deps into isolation
RUN pnpm --filter @ai-interviewer/gateway --prod deploy /prod/app

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /prod/app ./

USER nodejs

EXPOSE 5000

# Healthcheck for Gateway
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({ host: 'localhost', port: 5000, path: '/health', method: 'GET', timeout: 2000 }, (res) => { if (res.statusCode === 200) { process.exit(0); } else { process.exit(1); } }); req.on('error', () => process.exit(1)); req.end();"

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
