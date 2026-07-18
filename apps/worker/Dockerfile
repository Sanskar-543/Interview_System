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
RUN pnpm --filter @ai-interviewer/shared build && \
    pnpm --filter @ai-interviewer/db build && \
    pnpm --filter @ai-interviewer/queue build && \
    pnpm --filter @ai-interviewer/rag build && \
    pnpm --filter @ai-interviewer/worker build

# Prune workspace dependencies: copy built assets and production deps into isolation
RUN pnpm --filter @ai-interviewer/worker --prod deploy /prod/app --legacy

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /prod/app ./

USER nodejs

EXPOSE 8000

# Healthcheck for Worker HTTP service
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8000) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

ENV PORT=8000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
