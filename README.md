# AI Interviewer SaaS — Phase 1 Walking Skeleton

High-performance real-time AI voice interviewer built using Next.js, Express, and WebSockets.

## Folder Layout
- `packages/shared`: Core TS type definitions, Pino logger, and `@t3-oss/env-core` config validators.
- `apps/gateway`: Express ingress gateway with Redis-backed rate limiting and upgrade proxy hooks.
- `apps/voice-service`: Node.js live audio socket handler running Deepgram, OpenRouter, and Google TTS.
- `apps/web`: Glassmorphic Next.js interview room visualizer dashboard.

## Local Setup
1. Start Redis: `docker compose -f infra/docker-compose.yml up -d`
2. Configure Environment: `cp .env.example .env` and populate keys
3. Launch Gateways: Start gateway and voice servers
