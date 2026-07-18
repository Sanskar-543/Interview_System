# AI Interviewer SaaS — Required API Keys & Secrets

This document contains a complete inventory of all the connection strings, API keys, and cryptographic secrets required to run and test the AI Mock Interviewer platform in a real-world production or staging environment.

---

## 1. Application Security

These keys secure user communications, passwords, and sessions.

| Environment Variable | Service / Purpose | Security Requirement | Where to Get It |
|----------------------|-------------------|----------------------|-----------------|
| **`JWT_SECRET`** | Signs and cryptographically validates JSON Web Tokens for candidate sessions and routes. | Secure, random 256-bit string (at least 32 characters long). | Generate via terminal:<br>`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## 2. Infrastructure & Databases

Persistent storage and background job scheduling.

| Environment Variable | Provider | Purpose | Format / Where to Get It |
|----------------------|----------|---------|--------------------------|
| **`DATABASE_URL`** | [Neon Postgres](https://neon.tech) | Connection string for candidate profiles, session records, turns transcripts, and evaluation reports. | `postgres://[user]:[password]@[host]/[dbname]?sslmode=require` from your Neon console. |
| **`REDIS_URL`** | [Upstash Redis](https://upstash.com) | Turn history cache, Circuit Breaker states, and BullMQ worker queue management. | `redis://:[password]@[host]:[port]` from your Upstash database console. |

---

## 3. Real-Time Conversational Loop (AI APIs)

Hot-path APIs responsible for real-time speech transcribing, follow-up generation, and audio synthesis.

| Environment Variable | Provider | Purpose | Where to Get It |
|----------------------|----------|---------|-----------------|
| **`DEEPGRAM_API_KEY`** | [Deepgram](https://console.deepgram.com) | Transcribes real-time binary audio stream (STT) and synthesizes follow-up responses into waveNet-like natural audio (TTS). | Sign up at Deepgram and create an API Key under your project console. |
| **`OPENROUTER_API_KEY`** | [OpenRouter](https://openrouter.ai) | Streams conversational follow-ups (LLM) and computes nomic text RAG embeddings. | Create an account at OpenRouter, top-up standard balance (e.g. $10), and generate an API key. |

---

## 4. SaaS Monetization (Razorpay)

Handles subscriptions, candidate upgrades, and failed interview credit rollbacks.

| Environment Variable | Provider | Purpose | Where to Get It |
|----------------------|----------|---------|-----------------|
| **`RAZORPAY_KEY_ID`** | [Razorpay](https://dashboard.razorpay.com) | Loaded on the client-side pricing portal to initialize the Razorpay checkout overlay. Required by the Gateway in production. | Razorpay Dashboard → Settings → API Keys (Test/Live mode). |
| **`RAZORPAY_KEY_SECRET`** | [Razorpay](https://dashboard.razorpay.com) | Defined in config schema but **UNUSED** by the codebase (all billing checkouts and refunds are simulated/mocked). | Optional / Unused. |
| **`RAZORPAY_WEBHOOK_SECRET`** | [Razorpay](https://dashboard.razorpay.com) | Shared webhook signing key used by the gateway to verify postback payloads. Defaults to `mock_webhook_secret` if omitted. | Razorpay Dashboard → Webhooks → Add Webhook URL (`/api/v1/billing/webhook`) and define a secret. |

---

## 5. Network & Routing Configuration

Configures CORS origins and routing proxy URLs.

| Environment Variable | Service / Purpose | Requirement / Format |
|----------------------|-------------------|----------------------|
| **`CORS_ORIGIN`** | Sets allowed origins on the API Gateway. | Optional. The URL of the Next.js frontend (e.g., `https://my-app.vercel.app` or `http://localhost:3000`). |
| **`VOICE_SERVICE_URL`** | The target WebSocket URL for gateway proxying voice connections. | Optional. Defaults to `ws://localhost:[PORT+1]` (e.g., `ws://localhost:5001`). |
| **`WORKER_URL`** | The public HTTP URL of the background worker service. Used by Gateway/Voice service to wake the worker container on Render. | Optional. The URL of your deployed Worker Web Service (e.g., `https://ai-interviewer-worker.onrender.com`). |

---

## 6. Frontend Client-Side Environment Variables

Loaded on the client-side Next.js application.

| Environment Variable | Purpose | Default / Example |
|----------------------|---------|-------------------|
| **`NEXT_PUBLIC_API_URL`** | Next.js API URL pointing to the Gateway server. | `http://localhost:5000` |
| **`NEXT_PUBLIC_WS_URL`** | Next.js WebSocket URL pointing to the Gateway server. | `ws://localhost:5000` |

---

## 🚀 Production `.env` Template

Create a `.env` file in the root folder of your monorepo and populate these values before starting the services:

```env
# Node Environment
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Security (JWT Auth)
JWT_SECRET=your_secure_32_character_jwt_secret_here

# Persistent Storage
DATABASE_URL=postgres://user:password@host.neon.tech/neondb?sslmode=require
REDIS_URL=rediss://default:password@host.upstash.io:6379

# Conversational AI (Deepgram & OpenRouter)
DEEPGRAM_API_KEY=dg_your_deepgram_api_key_here
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key_here

# Billing & Monetization (Razorpay)
RAZORPAY_KEY_ID=rzp_live_your_key_id_here
RAZORPAY_KEY_SECRET=unused_in_codebase
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret_here

# Network / Gateway Configuration
CORS_ORIGIN=https://your-frontend-app.vercel.app
VOICE_SERVICE_URL=wss://your-voice-service-app.railway.app
WORKER_URL=https://your-worker-app.onrender.com

# Next.js Client-Side Configuration
NEXT_PUBLIC_API_URL=https://your-gateway-app.railway.app
NEXT_PUBLIC_WS_URL=wss://your-gateway-app.railway.app
```
