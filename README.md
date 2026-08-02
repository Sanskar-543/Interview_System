# AI Interviewer SaaS — Real-Time Voice Platform

[![Monorepo](https://img.shields.io/badge/monorepo-pnpm-blue.svg)](https://pnpm.io/)
[![Vite](https://img.shields.io/badge/Vite-5-blueviolet.svg)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Neon-Postgres-00e676.svg)](https://neon.tech/)

A premium, high-performance, real-time AI voice interviewer platform built using a Node.js (plain JavaScript ESM) and Vite + React SPA monorepo architecture. The platform allows candidates to conduct mock interviews via a **Zoom/Google Meet style video call interface**, streams bidirectional audio in real time, dynamically generates follow-up questions using advanced LLMs (via OpenRouter), fetches role-specific question banks via semantic RAG search (`pgvector`), processes evaluations asynchronously, and handles SaaS monetization through a simulated Razorpay subscription portal.

---

## 🌐 Live Production Deployments

| Service Component | Cloud Provider | Live Production URL | Description / Endpoints |
|---|---|---|---|
| **Web Frontend** | **Vercel** | [https://interview-system-web-js-pearl.vercel.app](https://interview-system-web-js-pearl.vercel.app) | Vite + React SPA with Zoom/Meet video call UI |
| **API Gateway** | **Render** | [https://interview-gateway-latest.onrender.com](https://interview-gateway-latest.onrender.com) | Express REST API Gateway & JWT Auth |
| **Voice Service** | **Render** | `wss://interview-voice-1lks.onrender.com` | Bidirectional WebSocket Real-Time Voice Loop |
| **Eval Worker** | **Render** | [https://interview-worker-latest-r8sx.onrender.com](https://interview-worker-latest-r8sx.onrender.com) | BullMQ Async Evaluation Engine |

---

## 🏗️ Monorepo Architecture

The repository is structured as a `pnpm` workspace containing independent microservices and shared library packages:

### Applications (`apps/`)
- **[web](file:///home/sanskars/Codezz/DEV/Interview_System_js/apps/web)**: Vite + React SPA (`react-router-dom`) featuring:
  - **Zoom / Google Meet Video-Call Interface**: ~70% viewport interviewer tile, animated audio-reactive speaking pulse rings, picture-in-picture (PIP) candidate tile with real-time mic volume equalizer, floating glassmorphic control bar, and collapsible transcript drawer.
  - **Dashboard & Session Manager**: Active session resume, completed report viewer, free-tier usage tracking (`3/3 sessions`), and Razorpay subscription upgrade portal.
- **[gateway](file:///home/sanskars/Codezz/DEV/Interview_System_js/apps/gateway)**: Express API Gateway serving auth routes, session routing, user profiles, evaluations, CORS dynamic origin matching, rate limiting, and raw payload verification for Razorpay webhooks. Two signup flows are supported: **direct registration** via `POST /api/v1/auth/signup` (validates + hashes the password, creates a verified user, and returns `201 Created` with the user object) and the **OTP flow** via `/signup-init` → `/verify-email` → `/create-password`. `/login` issues JWTs for session-authenticated routes.
- **[voice-service](file:///home/sanskars/Codezz/DEV/Interview_System_js/apps/voice-service)**: Bidirectional WebSocket server hosting the real-time audio orchestration loop:
  - **STT**: Streams candidate audio chunks directly to Deepgram.
  - **Context Assembler**: Merges Redis history buffers with postgres `pgvector` RAG context.
  - **LLM**: Generates adaptive questions via OpenRouter streaming.
  - **TTS**: Synthesizes responses sentence-by-sentence to browser players.
- **[worker](file:///home/sanskars/Codezz/DEV/Interview_System_js/apps/worker)**: BullMQ background consumer processing heavy tasks:
  - **Session Evaluation**: Analyzes transcript metrics to compile scorecards.
  - **Credit Refunds**: Auto-reverses charges/credit usage on session infrastructure errors.

### Shared Packages (`packages/`)
- **[shared](file:///home/sanskars/Codezz/DEV/Interview_System_js/packages/shared)**: Core type definitions (`Turn`, `Session`, `WSMessage`), Pino structured logger, and `@t3-oss/env-core` schema validators.
- **[db](file:///home/sanskars/Codezz/DEV/Interview_System_js/packages/db)**: Drizzle ORM configuration, schema declarations (Users, Sessions, Turns, Reports, Knowledge Base), standalone migration script (`pnpm db:migrate`), and database client.
- **[rag](file:///home/sanskars/Codezz/DEV/Interview_System_js/packages/rag)**: OpenRouter embedding client (`openai/text-embedding-3-small`) with cosine similarity matching on `pgvector`. Failed or malformed embedding responses throw an `AppError` (`EMBEDDING_FAILED`, HTTP 500) which callers (e.g. the voice-service orchestrator) catch and fall back on gracefully.
- **[queue](file:///home/sanskars/Codezz/DEV/Interview_System_js/packages/queue)**: Shared Redis connection client and BullMQ task definitions.

---

## ⚡ System Data Flow & Architecture

```mermaid
graph TD
    Client[Vite + React Client - Vercel] <-->|WS Bidirectional Audio| VS[Voice Service - Render]
    Client -->|REST API Requests| GW[Express API Gateway - Render]
    GW -->|REST / JWT Auth| DB[(Neon Postgres + pgvector)]
    GW -->|WebSocket Proxy Upgrade| VS
    
    VS -->|Redis WAL / cb state| Redis[(Redis / Upstash)]
    VS -->|pgvector Cosine Search| RAG[RAG Service]
    VS -->|Add Jobs| Queue[BullMQ / Redis]
    
    Queue -->|Consume| Worker[Background Worker - Render]
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
- `OPENROUTER_API_KEY`: API key for LLM streaming and RAG embeddings (OpenRouter embedding model).
- `RAZORPAY_KEY_ID` / `RAZORPAY_WEBHOOK_SECRET`: Subscriptions simulation variables (`RAZORPAY_KEY_SECRET` is unused).
- `WORKER_URL`: The public HTTP URL of the background worker service (used for wakeup pings on Render).

For a detailed review of each key, check the [Required API Keys Guide](file:///home/sanskars/Codezz/DEV/Interview_System/required_keys.md).

### 4. Database Migrations & Setup
Run automated database setup and schema migrations (enables `pgvector` and creates all required tables):
```bash
# Apply migrations to target Postgres database
pnpm --filter @ai-interviewer/db db:migrate
```

### 5. Running the Monorepo
Start services using the parallel dev script or direct process execution:
```bash
# Run web client (Port 3000)
pnpm --filter @ai-interviewer/web dev

# Run gateway service (Port 5000)
node apps/gateway/server.js

# Run voice service (Port 5001)
node apps/voice-service/server.js

# Run background worker
node apps/worker/index.js
```

---

## 🧪 Testing Suite

Tests are written against the native Node.js test runner API (via the `tests/shims/node-test.js` shim) and executed with **Vitest** — this is the canonical runner used by CI. They use in-memory mocks for Redis, Postgres, and external providers so no live infrastructure is required:

```bash
# Run the full unit + integration suite (CI equivalent)
pnpm exec vitest run --reporter=verbose

# Run a single test file
pnpm exec vitest run tests/integration/rag.test.js
```

Coverage includes:
- **`tests/unit`** — Voice-service `TurnOrchestrator` behavior: user/assistant turns, streaming, and the Write-Ahead guarantee that Redis turns are persisted before audio is sent to the client.
- **`tests/integration/session.test.js`** — Full auth + session CRUD flow against an in-memory Drizzle mock: direct signup (`201`), duplicate-signup conflict (`409`), login, profile, session creation/limits/teardown.
- **`tests/integration/rag.test.js`** — RAG + worker integration: `getEmbedding` throws `AppError` (`EMBEDDING_FAILED`) on failure, evaluation-job idempotency guard, and all four Circuit Breaker fallback levels (primary → backup rotation → cached questions → credit-refund flag).
- **`tests/integration/billing.test.js`** — Razorpay subscription upgrade via verified webhook signatures and background credit-refund processing.

---

## 🛡️ Reliability & Resilience Patterns

The architecture enforces core engineering constraints to maintain stability under failures:

1. **Write-Ahead Log (WAL) Loop**: Real-time transcripts and metadata are written to Redis *prior* to streaming audio back to the candidate client. If a gateway crashes mid-conversation, the session resumes immediately from the cached log state.
2. **Distributed Circuit Breaker**: Shared through Redis keys (`cb:llm`). If OpenRouter errors spike (5 errors in 10 seconds), the circuit opens, bypassing the LLM to run cached question banks and eventually triggering a credit refund.
3. **Razorpay Webhook Safety**: Webhooks verify cryptographic SHA-256 HMAC signatures on the gateway's raw request buffer before parsing user plan upgrades.
