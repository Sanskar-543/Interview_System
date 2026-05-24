# AI Interviewer SaaS — Master Plan

> This document is the single source of truth for architecture, stack decisions, folder structure, and implementation phases. Reference it during every coding session.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Market & Pricing Context](#2-market--pricing-context)
3. [Tech Stack](#3-tech-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Microservices Inventory](#5-microservices-inventory)
6. [Data Flow — One Interview Turn](#6-data-flow--one-interview-turn)
7. [Resilience Patterns](#7-resilience-patterns)
8. [Event Bus — Kafka Topics](#8-event-bus--kafka-topics)
9. [API Design Standards](#9-api-design-standards)
10. [Folder Structure](#10-folder-structure)
11. [Implementation Phases](#11-implementation-phases)
12. [Key Architectural Decisions](#12-key-architectural-decisions)
13. [Coding Rules & Conventions](#13-coding-rules--conventions)

---

## 1. Product Overview

An AI-powered voice interview platform where candidates practice job interviews by speaking with an AI interviewer in real time. The AI listens, generates contextually aware follow-up questions, evaluates responses, and delivers a scored report after the session.

**Core differentiators vs competitors (HireVue, Final Round AI, Huru):**
- Genuine adaptive follow-up questions based on answer content (not scripted)
- Voice-first — not text chat
- Pressure simulation — silence, probing, redirection
- Cross-session memory of weak spots
- Role-specific question banks via RAG
- Credit refund if session fails due to infrastructure issues

**Target market:** Indian job seekers (primary), global candidates (secondary)

**Pricing model:** Freemium — 3 free sessions/month, paid tier at ₹299–₹499/month

---

## 2. Market & Pricing Context

| Platform | Type | Price |
|---|---|---|
| Interviewing.io | Human-led | $225–$300/session |
| Final Round AI | Copilot (real-time) | $96–$148/month |
| Verve AI | Copilot | $38–$60/month |
| Huru | AI mock practice | $24.99/month |
| Himalayas | AI mock practice | $9/month |
| **This product** | **Voice AI practice** | **₹299–499/month** |

**Cost per session at scale:** ~$0.05–0.15 (STT + LLM + TTS tokens combined)

---

## 3. Tech Stack

### Zero-cost launch stack

| Layer | Service | Free limit |
|---|---|---|
| Frontend | Vercel (Next.js hobby) | Unlimited deploys |
| Edge | Cloudflare | DNS + CDN + DDoS free |
| API service | Railway / Render | 500 hrs/month |
| Voice service | Fly.io | 3 shared VMs |
| Database | Neon (Postgres + pgvector) | 0.5 GB |
| Cache / queue | Upstash Redis | 10k req/day |
| STT | Deepgram | $200 credit on signup |
| LLM | OpenRouter (free models) | 1000 req/day after $10 top-up |
| LLM (eval) | AWS Bedrock | $200 credits (6 months) |
| TTS | Google Cloud TTS | 1M chars/month (WaveNet) |
| CI/CD | GitHub Actions | 2000 min/month |
| Monitoring | BetterUptime | Uptime alerts free |
| Billing | Razorpay | No monthly fee |

### Runtime decisions

- **Node.js** — all non-AI services (gateway, auth, session, user, voice, eval worker, billing worker)
- **FastAPI (Python)** — AI services only: STT, LLM, TTS, RAG (Python-native AI libs required)
- **Express** — API gateway specifically (thin middleware chain, no business logic needed)
- **Next.js 14 App Router** — frontend

### LLM strategy

- **Voice loop (real-time):** OpenRouter free models,aws bedrock models — rotate across different models to 20x daily quota.
- **Post-session eval:** AWS Bedrock (Claude Sonnet) — higher quality, lower frequency, use $200 credits here
- **Fallback chain on circuit open:** primary LLM → backup free model rotation → Redis cached questions → credit refund

---

## 4. Architecture Overview

```
Client (Next.js)
    │ REST (HTTPS)          │ WebSocket (voice)
    ▼                       ▼
Express API Gateway     WS Voice Gateway (Fly.io)
[auth · rate limit]     [sticky sessions · upgrade]
    │                       │
    │ Consul Service Discovery
    ▼                       ▼
┌─────────────────────────────────────────────────┐
│              CORE SERVICES (Node.js)            │
│  Auth svc · Session svc · User svc · Voice svc  │
└────────────────────┬────────────────────────────┘
                     │ gRPC (hot path)
┌────────────────────▼────────────────────────────┐
│              AI SERVICES (FastAPI)              │
│      STT svc · LLM svc · TTS svc · RAG svc     │
└────────────────────┬────────────────────────────┘
                     │ publishes events
┌────────────────────▼────────────────────────────┐
│                  KAFKA EVENT BUS                │
│  session.ended · turn.completed · score.ready   │
│  user.subscribed · session.failed               │
└────────────────────┬────────────────────────────┘
                     │ consumes
┌────────────────────▼────────────────────────────┐
│            ASYNC CONSUMERS (Node.js)            │
│  Eval worker · Billing svc · Notification svc   │
│  Analytics svc (CQRS read model)                │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│                  DATA LAYER                     │
│  Neon Postgres (write) · Redis · pgvector       │
│  Read DB (CQRS query side)                      │
└─────────────────────────────────────────────────┘
```

### Protocol decisions

| Connection | Protocol | Reason |
|---|---|---|
| Client → API gateway | REST (HTTPS) | Browsers cannot call gRPC directly |
| Client → Voice gateway | WebSocket | Long-lived bidirectional audio stream |
| Gateway → Auth, Session, User, Billing | REST | Cold path — called once per request, not latency critical |
| Voice svc → STT, LLM, TTS, RAG | gRPC | Hot path — called every turn, latency compounds |
| Services → Kafka | Kafka producer | Async, durable, multi-consumer fan-out |
| Never use | GraphQL internally | Solves flexible querying — a problem that doesn't exist between services you own |

---

## 5. Microservices Inventory

| Service | Runtime | Inbound | Owns | Kafka role | Scales by |
|---|---|---|---|---|---|
| API gateway | Express (Node.js) | HTTPS REST | — | — | CPU · stateless |
| Auth svc | Node.js | gRPC | users table | — | CPU · stateless |
| Session svc | Node.js | gRPC · REST | sessions table | producer | CPU · stateless |
| User svc | Node.js | REST | users · plans | consumer | CPU · stateless |
| Voice svc | Node.js | WebSocket | Redis session state | producer | conn count · sticky |
| STT svc | FastAPI | gRPC stream | — | — | concurrent streams |
| LLM svc | FastAPI | gRPC stream | CB state (Redis) | — | concurrent calls |
| TTS svc | FastAPI | gRPC stream | — | — | concurrent streams |
| RAG svc | FastAPI | gRPC | pgvector embeddings | — | query load |
| Eval worker | Node.js | Kafka consumer | scores · reports | consumer | partition count |
| Billing svc | Node.js | REST + Kafka | subscriptions | consumer | CPU · stateless |
| Notification svc | Node.js | Kafka consumer | — | consumer | CPU · stateless |
| Analytics svc | Node.js | Kafka consumer | Read DB (CQRS) | consumer | partition count |

---

## 6. Data Flow — One Interview Turn

**Total latency budget: ~1.4 seconds**

```
Step 1  VAD fires (Silero)              ~50ms    speech end detected client-side
Step 2  Audio chunk sent over WS        ~10ms    binary PCM 16kHz frames
Step 3  Deepgram returns transcript     ~300ms   streaming interim + final result
Step 4  Context assembled               ~80ms    Redis history + pgvector RAG (PARALLEL)
Step 5  LLM streams tokens              ~800ms   OpenRouter · first token target
Step 6  Google TTS streams audio        ~200ms   sentence-by-sentence · overlaps step 5
Step 7  Redis write (BEFORE audio sent) ~5ms     write-ahead — crash recovery depends on this
Step 8  Audio plays in browser          —        Web Audio API · buffered chunks
Step 9  Loop repeats                    —        ↻ next turn begins
```

**Critical ordering rule:** Step 7 (Redis write) MUST happen before Step 8 (audio sent). If the server crashes after sending audio but before writing to Redis, the turn is lost from history. The candidate gets asked the same question again on reconnect. Write first, send second — always.

**Parallelism:** Steps 4a (Redis history fetch) and 4b (pgvector RAG lookup) run with `Promise.all()` — never sequentially.

**TTS pipeline trick:** Do not wait for the full LLM response before calling TTS. Pipe tokens into a sentence buffer. The moment a `.` or `?` is detected, fire that sentence to Google TTS immediately. The candidate hears sentence 1 while the LLM is still writing sentence 3. This cuts perceived latency from ~3s to ~1.4s.

---

## 7. Resilience Patterns

### Circuit breaker — LLM service

**Three states:**

- **Closed (normal):** All requests pass through to the LLM. Failure counter tracked in Redis (`cb:llm`). Threshold: 5 failures in 10 seconds.
- **Open (tripped):** Requests are immediately rejected without calling the LLM. Fail fast — do not let threads pile up waiting for a dead service. Trigger fallback chain silently. Duration: 30 seconds before attempting recovery.
- **Half-open (recovery probe):** One test request allowed through. If it succeeds → Closed. If it fails → back to Open.

**Fallback chain (executed silently — candidate never sees an error unless all fail):**

```
1. Primary LLM (OpenRouter best model)
        ↓ circuit opens
2. Backup LLM rotation (free model 1 → free model 2 → free model 3)
        ↓ all fail
3. Redis cached questions (20–30 generic role-based questions pre-loaded)
        ↓ session ends without LLM restoring
4. Credit refund — publish session.failed event → billing worker reverses charge
```

**Circuit breaker state stored in Redis** (`cb:llm` key) so all voice service instances share the same state. If one instance trips the breaker, all instances immediately stop calling the LLM — not just the one that detected the failure.

### Token bucket rate limiting — API gateway

- Anonymous users: 20 req/min
- Free plan: 60 req/min
- Paid plan: 300 req/min
- WebSocket voice sessions: 1 concurrent session per user (enforced via `SETNX session:active:{user_id}`)

Redis sliding window — buckets stored per user, auto-expire via TTL.

### Session crash recovery — Redis + Postgres

```
Normal flow:
  voice svc starts → Redis.set("session:{id}", { turns: [] })
  each turn → Redis.append turn → send audio
  session ends → flush Redis to Postgres → publish session.ended

Crash recovery:
  Fly.io restarts container → in-memory state lost
  client reconnects with session_id
  voice svc → Redis.get("session:{id}")
    → hit: resume from last written turn
    → miss (TTL expired): fallback to Postgres.getSession(id)
    → both null: show error, offer restart

Redis TTL: 2 hours (max interview length)
Postgres is permanent record — written on session end, not during
```

### CQRS — analytics separation

- **Command side (writes):** All session writes go to Neon Postgres. Fast, ACID, no aggregation.
- **Query side (reads):** Analytics service consumes Kafka events and builds a pre-aggregated read model in a separate DB. Dashboard queries never touch the write DB. Prevents analytics aggregations from degrading live interview performance.

---

## 8. Event Bus — Kafka Topics

| Topic | Producer | Consumers | Payload |
|---|---|---|---|
| `session.ended` | Voice svc | Eval worker, Billing svc, Analytics svc | `{ session_id, user_id, duration, turn_count }` |
| `turn.completed` | Voice svc | Analytics svc | `{ session_id, turn_index, transcript, latency_ms }` |
| `score.ready` | Eval worker | Notification svc | `{ session_id, user_id, score, report_url }` |
| `user.subscribed` | Billing svc | User svc, Analytics svc | `{ user_id, plan, started_at }` |
| `session.failed` | Voice svc | Billing svc | `{ session_id, user_id, reason }` |

**Kafka vs Redis Pub/Sub — why Kafka:**
- Redis Pub/Sub: if a consumer is offline when a message fires, the message is lost forever
- Kafka: messages persisted to disk, consumers read from their own offset, replay is possible at any time
- Each consumer group has an independent offset — eval worker, billing, and analytics all read `session.ended` independently without competing

**Idempotency requirement for all consumers:** Every job must check if it has already processed a given `session_id` before writing. Use `INSERT ... ON CONFLICT DO NOTHING` in Postgres. Kafka delivers at-least-once — without idempotency guards, a worker restart will reprocess events and create duplicate scores/charges.

---

## 9. API Design Standards

### URL structure

```
POST   /api/v1/sessions              create session
GET    /api/v1/sessions/:id          get session
PATCH  /api/v1/sessions/:id          update session
POST   /api/v1/sessions/:id/end      end session (action sub-resource)
DELETE /api/v1/sessions/:id          delete session

GET    /api/v1/reports/:session_id   get score report
GET    /api/v1/users/me              current user
PATCH  /api/v1/users/me              update profile

GET    /health                       health check (DB ping + Redis ping)
```

Rules:
- Always versioned (`/v1/`)
- Nouns only in path — never verbs (`/getSession` is wrong)
- kebab-case for multi-word paths
- Action sub-resources allowed for state changes (`.../end`, `.../cancel`)

### Response envelope

```json
// Single resource — 200 OK
{
  "data": {
    "id": "sess_01j...",
    "status": "active",
    "createdAt": "2026-04-30T12:00:00Z"
  },
  "meta": { "requestId": "req_..." }
}

// List resource — 200 OK
{
  "data": [ ... ],
  "pagination": { "page": 1, "perPage": 20, "total": 143 }
}
```

### Error envelope

```json
// 422 Validation error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is invalid",
    "fields": { "email": "must be a valid email address" }
  }
}

// 429 Rate limited
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retryAfter": 30,
    "requestId": "req_..."
  }
}
```

### Conventions

- **IDs:** Stripe-style prefixed IDs — `sess_01j...`, `usr_01j...`, `rpt_01j...`
- **Timestamps:** ISO 8601 UTC always — `2026-04-30T12:00:00Z`
- **Field names:** camelCase in JSON — `createdAt` not `created_at`
- **HTTP status codes:** `201` create, `204` delete (no body), `422` validation, `429` rate limit, `401` unauth, `403` forbidden
- **Idempotency:** `Idempotency-Key` header on all POST endpoints

---

## 10. Folder Structure

```
ai-interviewer/                         # monorepo root
├── turbo.json                          # Turborepo — parallel builds    [p1]
├── pnpm-workspace.yaml                 # workspace definitions          [p1]
├── biome.json                          # lint + format (replaces ESLint+Prettier) [p1]
├── .env.example                        # ALL vars documented with comments [p1]
├── .github/
│   └── workflows/
│       ├── ci.yml                      # lint · typecheck · test on every PR [p1]
│       └── deploy-prod.yml             # deploy on merge to main        [p1]
├── infra/
│   └── docker-compose.yml             # local dev — all services       [p1]
├── fly.toml                            # voice service deploy config    [p1]
├── docs/
│   ├── ADR/                            # architecture decision records  [p1]
│   │   ├── ADR-001-why-flyio.md
│   │   ├── ADR-002-why-drizzle.md
│   │   └── ADR-003-why-node-not-fastapi.md
│   └── PLAN.md                         # this file
├── CHANGELOG.md                        # updated each release           [p1]
│
├── apps/
│   ├── web/                            # Next.js 14 · Vercel
│   │   ├── app/
│   │   │   ├── page.tsx                # landing · mic button           [p1]
│   │   │   ├── interview/[id]/
│   │   │   │   └── page.tsx            # voice room UI                  [p1]
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx      # auth route group               [p2]
│   │   │   │   └── signup/page.tsx                                      [p2]
│   │   │   ├── (dashboard)/
│   │   │   │   └── page.tsx            # session history                [p2]
│   │   │   ├── report/[id]/
│   │   │   │   └── page.tsx            # score + PDF view               [p3]
│   │   │   └── billing/
│   │   │       └── page.tsx            # plans + upgrade UI             [p4]
│   │   ├── components/
│   │   │   ├── ui/                     # shadcn primitives — no logic   [p1]
│   │   │   └── interview/              # VoiceRoom · Transcript         [p1]
│   │   ├── hooks/
│   │   │   └── useVoice.ts             # WS + MediaRecorder + VAD + audio [p1]
│   │   ├── lib/
│   │   │   └── api.ts                  # typed fetch wrappers           [p2]
│   │   ├── middleware.ts               # auth guard on protected routes  [p2]
│   │   ├── next.config.ts                                               [p1]
│   │   └── env.ts                      # t3-env schema                  [p1]
│   │
│   ├── gateway/                        # Express · Railway · stateless
│   │   ├── server.ts                   # entry point — no logic here    [p1]
│   │   ├── middleware/
│   │   │   ├── rateLimit.ts            # token bucket · Redis backed    [p1]
│   │   │   └── auth.ts                 # JWT verify plugin              [p2]
│   │   ├── routes/                     # one file per resource          [p2]
│   │   │   ├── sessions.ts
│   │   │   ├── users.ts
│   │   │   └── reports.ts
│   │   └── errors/
│   │       └── AppError.ts             # typed error class              [p1]
│   │
│   ├── voice-service/                  # Node.js · Fly.io · WebSocket
│   │   ├── server.ts                   # WS server · disconnect guard   [p1]
│   │   ├── handlers/
│   │   │   └── turn.ts                 # STT→context→LLM→TTS orchestrator [p1]
│   │   ├── providers/                  # ADAPTER LAYER — only files that import vendors
│   │   │   ├── stt.ts                  # Deepgram adapter               [p1]
│   │   │   ├── llm.ts                  # OpenRouter adapter             [p1]
│   │   │   └── tts.ts                  # Google TTS adapter             [p1]
│   │   ├── session/
│   │   │   └── store.ts                # Redis abstraction — getSession · appendTurn [p1]
│   │   ├── context/
│   │   │   └── assembler.ts            # history + RAG chunks → prompt  [p3]
│   │   ├── circuit/
│   │   │   └── breaker.ts              # CB state machine · Redis backed [p3]
│   │   ├── queue/
│   │   │   └── publish.ts              # Kafka producer on turn/session end [p3]
│   │   └── errors/
│   │       └── AppError.ts             # typed error class              [p1]
│   │
│   └── worker/                         # Node.js · BullMQ · Railway
│       ├── jobs/
│       │   ├── eval.ts                 # score · PDF · idempotent       [p3]
│       │   ├── billing.ts              # usage sync · Razorpay          [p4]
│       │   └── notification.ts         # email on score.ready           [p3]
│       └── index.ts                    # worker entry point             [p3]
│
├── packages/
│   ├── shared/
│   │   ├── types/
│   │   │   └── index.ts                # Turn · Session · WSMessage · Score [p1]
│   │   ├── config/
│   │   │   └── env.ts                  # t3-env — crash on misconfiguration [p1]
│   │   └── logger/
│   │       └── index.ts                # Pino · structured JSON · requestId [p1]
│   ├── db/
│   │   ├── schema.ts                   # Drizzle ORM schema             [p2]
│   │   └── migrations/                 # every schema change tracked    [p2]
│   ├── rag/
│   │   ├── embed.ts                    # text → vector embedding        [p3]
│   │   └── search.ts                   # pgvector cosine search         [p3]
│   ├── protos/
│   │   └── interview.proto             # gRPC contracts · single source of truth [p3]
│   └── queue/
│       └── jobs.ts                     # BullMQ typed job definitions   [p3]
│
└── tests/
    ├── unit/
    │   ├── turn.test.ts                # mocked providers · <100ms      [p1]
    │   └── store.test.ts               # Redis mock · write-ahead check [p1]
    ├── integration/
    │   ├── session.test.ts             # real Neon branch · mocked AI   [p2]
    │   └── rag.test.ts                 # embed → pgvector → top-k check [p3]
    ├── e2e/
    │   └── billing.test.ts             # Playwright · upgrade flow      [p4]
    ├── fixtures/                       # shared test data               [p1]
    └── mocks/                          # provider mocks                 [p1]
```

**Phase key:** `[p1]` = week 1–2 · `[p2]` = week 3–4 · `[p3]` = week 5–7 · `[p4]` = week 8–10

---

## 11. Implementation Phases

### Phase 1 — walking skeleton (week 1–2)

**Goal:** Candidate speaks → AI replies with audio. No auth, no DB, no billing.

**What exists:** Next.js page with mic button, Express gateway (rate limiting + WS proxy), Node.js voice service (STT→LLM→TTS loop), Redis for turn history only.

**What deliberately does NOT exist:** Login, Postgres, user accounts, billing, RAG, scoring, pretty UI.

**Phase 1 file creation order:**

1. `turbo.json` + `pnpm-workspace.yaml` — monorepo scaffolding
2. `packages/shared/types/index.ts` — define `Turn`, `Session`, `WSMessage`
3. `packages/shared/config/env.ts` — t3-env schema, crash on missing keys
4. `packages/shared/logger/index.ts` — Pino structured logger
5. `apps/voice-service/providers/stt.ts` — Deepgram adapter
6. `apps/voice-service/providers/llm.ts` — OpenRouter adapter
7. `apps/voice-service/providers/tts.ts` — Google TTS adapter
8. `apps/voice-service/session/store.ts` — Redis `getSession` / `appendTurn` / `deleteSession`
9. `apps/voice-service/handlers/turn.ts` — turn orchestrator (most important file in phase 1)
10. `apps/voice-service/server.ts` — WS server
11. `apps/gateway/server.ts` — Express + rate limiter + WS proxy
12. `apps/web/hooks/useVoice.ts` — React hook (WS + MediaRecorder + VAD + reconnect)
13. `apps/web/app/page.tsx` — minimal UI
14. `tests/unit/turn.test.ts` — mocked providers
15. `tests/unit/store.test.ts` — write-ahead ordering test
16. `infra/docker-compose.yml` — local dev environment
17. `.github/workflows/ci.yml` — CI pipeline
18. `fly.toml` + `.env.example` + `README.md`

**Phase gate:** Speak a sentence → AI replies with audio under 3 seconds → CI badge green

---

### Phase 2 — SaaS skeleton (week 3–4)

**Goal:** Real users can sign up, log in, run a session, see a basic result.

**What gets added:** Auth (JWT), Postgres schema via Drizzle, session CRUD, user management, basic dashboard UI, post-session report page, plan enforcement (free tier session count).

**Phase gate:** Sign up → start session → finish → see report. Auth flow integration tests pass on Neon branch.

---

### Phase 3 — intelligence layer (week 5–7)

**Goal:** Interviewer asks smart follow-ups, not scripted questions. Post-session scoring works.

**What gets added:** RAG pipeline (pgvector), context assembler, prompt engineering layer, eval worker (scoring + PDF), async job queue (BullMQ/Kafka), circuit breaker, OpenTelemetry + Langfuse observability, gRPC for AI services, notification service.

**Phase gate:** RAG retrieves correct context chunks. Circuit breaker trips and recovers. Eval score correlates with answer quality. Kafka fan-out delivers to all consumers correctly.

---

### Phase 4 — SaaS monetisation (week 8–10)

**Goal:** Free tier limits enforced, paid users can subscribe, credits refunded on failure.

**What gets added:** Razorpay billing integration, billing worker (usage tracking + plan sync), upgrade UI, session.failed credit refund flow, Playwright e2e tests, production observability (Sentry, BetterUptime).

**Phase gate:** Free user hits limit and sees upgrade prompt. Paid user subscribes and unlocks. `session.failed` triggers credit refund. All e2e tests pass in CI.

---

## 12. Key Architectural Decisions

### Why Node.js everywhere except AI services

Node's event loop handles thousands of concurrent WebSocket connections with low memory overhead — I/O non-blocking by default. Python FastAPI under the same WS concurrency uses more RAM per connection and needs explicit async workers. FastAPI is used only where Python-native AI libraries (`sentence-transformers`, `grpcio` streaming, Deepgram Python SDK) give a real advantage.

### Why Express for the gateway, not Fastify or FastAPI

A gateway has one job: cross-cutting concerns (auth, rate limiting, routing). It should never have business logic. Express gives the thinnest composable middleware chain for this. Fastify's DI and OpenAPI generation are valuable inside a microservice — at the gateway they're overhead.

### Why Kafka over Redis Pub/Sub

Redis Pub/Sub: if a consumer is offline when a message fires, the message is lost. Kafka writes every event to disk — any consumer can replay from any offset at any time. Five consumers (eval, billing, analytics, notification, user svc) all independently read the same `session.ended` event. With Redis they'd compete for messages or miss them.

### Why REST at the client edge, gRPC on the hot path

Browsers cannot call gRPC directly — HTTP/2 framing is blocked. `grpc-web` requires an Envoy proxy: extra infra for zero gain at the edge. Internally, gRPC binary serialization + HTTP/2 multiplexing saves 20ms per hop. Across 5 chained calls in the voice loop that's 100ms saved per turn — meaningful on a 1.4s budget.

### Why never GraphQL internally

GraphQL solves flexible querying from heterogeneous clients. Between services you own, every caller knows exactly what it needs. GraphQL adds schema definitions, resolver functions, query parsing overhead, and N+1 guards for zero benefit. REST for cold-path internal calls. gRPC for hot-path.

### Why Google TTS over ElevenLabs (for now)

1M chars/month free vs 10k/month. `en-IN-Neural2-A` sounds natural for the Indian market. Upgrade path to ElevenLabs is one file change in `providers/tts.ts` — the adapter pattern exists for exactly this reason.

### CQRS for analytics

Running complex aggregations (avg score by role, sessions per day, conversion rates) on the primary Postgres during peak interview time would degrade write performance for every active session. The analytics service maintains a separate pre-aggregated read model built from Kafka events. Dashboard queries never touch the write DB.

### Write-ahead ordering in the voice loop

Redis write happens before audio is sent back to the client. If reversed: server sends audio, crashes before Redis write, client reconnects, turn is missing from history, interviewer asks the same question again. With correct ordering: worst case on crash is the candidate doesn't hear the audio — they reconnect and the question is re-read. Context integrity is preserved.

---

## 13. Coding Rules & Conventions

### Non-negotiable rules

- **TypeScript strict mode** throughout — no `any`, no `@ts-ignore`, no implicit returns
- **Typed error classes** — `AppError extends Error` with `code` and `status` — never `throw new Error("string")`
- **Structured logging** — Pino everywhere, never `console.log`, always include `requestId` on every log line
- **Validated env vars** — t3-env schema, app crashes at startup with a clear message if a required var is missing
- **No raw fetch in components** — all API calls go through `lib/api.ts` typed wrappers
- **No DB queries in route handlers** — routes call services, services call the DB
- **Adapter pattern on all AI vendors** — `stt.ts`, `llm.ts`, `tts.ts` are the ONLY files that import from Deepgram, OpenRouter, Google. Everything else calls the interface
- **`Promise.all()` for parallel I/O** — never `await` two independent async calls sequentially

### Commit convention

```
feat: add circuit breaker to LLM service
fix: correct Redis write ordering in turn handler
chore: update Deepgram SDK to v3
test: add idempotency check to eval worker
docs: add ADR for Kafka vs Redis decision
```

### Test rules

- Unit tests: mock all I/O, no network, must run in under 100ms
- Integration tests: use Neon database branch, mock AI APIs
- E2e tests: Playwright, run in CI on every PR to main
- Every new feature ships with a failing test written first

### ID format

All entity IDs use Stripe-style prefixed nanoid:
- Sessions: `sess_01j...`
- Users: `usr_01j...`
- Reports: `rpt_01j...`
- Turns: `trn_01j...`

### File naming

- All files: `camelCase.ts`
- React components: `PascalCase.tsx`
- Test files: `[filename].test.ts` colocated or in `tests/`
- Never abbreviate unless the abbreviation is universally understood (`stt`, `tts`, `llm`, `rag` are fine)

### Before any PR is merged

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (Biome)
- [ ] All unit tests pass
- [ ] No `console.log` in committed code
- [ ] `.env.example` updated if new env vars added
- [ ] `CHANGELOG.md` updated

---

*Last updated: session covering phases 1–4, full microservices architecture, resilience patterns, and implementation order.*
