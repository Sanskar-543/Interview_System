# AI Interviewer SaaS — Real-Time Voice Platform

[![Monorepo](https://img.shields.io/badge/monorepo-pnpm-blue.svg)](https://pnpm.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Neon-Postgres-00e676.svg)](https://neon.tech/)

A premium, high-performance, real-time AI voice interviewer platform built using a Node.js and Next.js monorepo architecture. The platform allows candidates to conduct mock interviews via live bidirectional audio streaming, dynamically generates follow-up questions using advanced LLMs (via OpenRouter), fetches question banks via semantic RAG search, processes evaluations in the background, and handles SaaS monetization through a simulated Razorpay subscription portal.

---

## 🏗️ Monorepo Architecture

The repository is structured as a `pnpm` workspace containing independent microservices and shared library packages:

### Applications (`apps/`)
- **[web](file:///home/sanskars/Codezz/DEV/Interview_System/apps/web)**: Next.js 14 Web App featuring a glassmorphic mock interview room, realtime candidate audio recording, transcription feed logs, latency metrics, and a Razorpay billing portal.
- **[gateway](file:///home/sanskars/Codezz/DEV/Interview_System/apps/gateway)**: Express API Gateway serving auth routes, session routing, user profiles, evaluations, rate limiting, and raw payload verification for Razorpay webhooks.
- **[voice-service](file:///home/sanskars/Codezz/DEV/Interview_System/apps/voice-service)**: Bidirectional WebSocket server hosting the real-time audio orchestration loop:
  - **STT**: Streams candidate audio chunks directly to Deepgram.
  - **Context Assembler**: Merges Redis history buffers with postgres `pgvector` RAG context.
  - **LLM**: Generates adaptive questions via OpenRouter streaming.
  - **TTS**: Synthesizes responses sentence-by-sentence to browser players.
- **[worker](file:///home/sanskars/Codezz/DEV/Interview_System/apps/worker)**: BullMQ background consumer processing heavy tasks:
  - **Session Evaluation**: Analyzes transcript metrics to compile scorecards.
  - **Credit Refunds**: Auto-reverses charges/credit usage on session infrastructure errors.

### Shared Packages (`packages/`)
- **[shared](file:///home/sanskars/Codezz/DEV/Interview_System/packages/shared)**: Core TS type definitions (`Turn`, `Session`, `WSMessage`), Pino structured logger, and `@t3-oss/env-core` schema validators.
- **[db](file:///home/sanskars/Codezz/DEV/Interview_System/packages/db)**: Drizzle ORM configuration, schema declarations (Users, Sessions, Turns, Reports, Knowledge Base), and database client.
- **[rag](file:///home/sanskars/Codezz/DEV/Interview_System/packages/rag)**: Nomic Embed API client (`nomic-embed-text-v1.5`) and cosine similarity matching on `pgvector`.
- **[queue](file:///home/sanskars/Codezz/DEV/Interview_System/packages/queue)**: Shared Redis connection client and BullMQ task definitions.

---

## ⚡ System Data Flow & Architecture

```mermaid
graph TD
    Client[Next.js Client] <-->|WS Bidirectional Audio| VS[Voice Service]
    Client -->|REST API Requests| GW[Express API Gateway]
    GW -->|REST / JWT Auth| DB[(Neon Postgres)]
    GW -->|WebSocket Proxy Upgrade| VS
    
    VS -->|Redis WAL / cb state| Redis[(Redis / Upstash)]
    VS -->|pgvector Cosine Search| RAG[RAG Service]
    VS -->|Add Jobs| Queue[BullMQ / Redis]
    
    Queue -->|Consume| Worker[Background Worker]
    Worker -->|Create Score Reports| DB
```

---

## 🛠️ Local Development Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v20 or higher)
- **PNPM** (v9 or higher)
- **Docker** (for local databases)

### 2. Infrastructure Setup
Start the local Redis and Postgres database instances using the development Docker Compose script:
```bash
docker compose -f infra/docker-compose.yml up -d
```
> [!NOTE]
> The database image utilizes `pgvector/pgvector:pg16` to enable vector operations required by the RAG search pipeline.

### 3. Environment Configuration
Copy the environment variables template and configure the required keys:
```bash
cp .env.example .env
```
Open the `.env` file and populate:
- `JWT_SECRET`: Random string (at least 32 characters).
- `DATABASE_URL`: Target database URL (defaults to `postgresql://ai_interviewer:ai_interviewer_dev@localhost:5432/ai_interviewer`).
- `REDIS_URL`: Target Redis connection URL (defaults to `redis://localhost:6379`).
- `DEEPGRAM_API_KEY`: API key for voice streaming services (STT & TTS).
- `OPENROUTER_API_KEY`: API key for LLM streaming and nomic embeddings.
- `RAZORPAY_KEY_ID` / `RAZORPAY_WEBHOOK_SECRET`: Subscriptions simulation variables (`RAZORPAY_KEY_SECRET` is unused).
- `WORKER_URL`: The public HTTP URL of the background worker service (used for wakeup pings on Render).

For a detailed review of each key, check the [Required API Keys Guide](file:///home/sanskars/Codezz/DEV/Interview_System/required_keys.md).

### 4. Database Migrations
Generate drizzle schema definitions and push them directly to your Postgres instance:
```bash
# Generate SQL migrations
pnpm --filter @ai-interviewer/db db:generate

# Push schema directly to development database
pnpm --filter @ai-interviewer/db db:push
```

### 5. Running the Monorepo
Start services using the parallel dev script or direct process execution:
```bash
# Run web client (Port 3000)
pnpm --filter @ai-interviewer/web dev

# Run gateway service (Port 5000)
npx tsx apps/gateway/server.ts

# Run voice service (Port 5001)
npx tsx apps/voice-service/server.ts

# Run background worker
npx tsx apps/worker/index.ts
```

---

## 🧪 Testing Suite

Tests are built using native Node.js test runner frameworks and Vitest. They can be executed collectively or targeted by component:

```bash
# Run all unit tests (mocked I/O, runs in < 100ms)
pnpm test:unit

# Run full integration tests (uses in-memory database mocks)
pnpm test:all-integration

# Run specific integration scopes
pnpm test:integration   # Session & auth CRUD flow
pnpm test:billing       # Razorpay subscriptions & webhooks signatures
pnpm test:rag           # Embedding vector searching
```

---

## 🛡️ Reliability & Resilience Patterns

The architecture enforces core engineering constraints to maintain stability under failures:

1. **Write-Ahead Log (WAL) Loop**: Real-time transcripts and metadata are written to Redis *prior* to streaming audio back to the candidate client. If a gateway crashes mid-conversation, the session resumes immediately from the cached log state.
2. **Distributed Circuit Breaker**: Shared through Redis keys (`cb:llm`). If OpenRouter errors spike (5 errors in 10 seconds), the circuit opens, bypassing the LLM to run cached question banks and eventually triggering a credit refund.
3. **Razorpay Webhook Safety**: Webhooks verify cryptographic SHA-256 HMAC signatures on the gateway's raw request buffer before parsing user plan upgrades.
