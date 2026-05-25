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
RUN pnpm --filter @ai-interviewer/worker build

# Prune workspace dependencies: copy built assets and production deps into isolation
RUN pnpm --filter @ai-interviewer/worker --prod deploy /prod/app

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /prod/app ./

USER nodejs

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
