# ExamEval — Project Upgrade Strategy

> A brutally honest, evidence-based teardown of the current project and a practical, market-relevant roadmap to make it interview-grade across SDE, backend, full-stack, AI, ML, data, DevOps, security, and QA roles.
>
> **Legend used throughout:**
> - **FACT** = directly verified in the codebase.
> - **INFERENCE** = reasoned conclusion from the code, not 100% certain.
> - **RECOMMENDATION** = proposed change; does not exist yet.

---

## 0. What This Project Actually Is (FACT)

**ExamEval** is an **AI-powered university exam evaluation system**. A staff/admin user uploads a grading rubric (PDF or text) and student answer scripts (PDFs). The system extracts text, uses an LLM to parse the rubric, map student answers to questions, grade each question against the rubric, and aggregate a final score with per-question feedback, strengths, mistakes, and a confidence score. Low-confidence evaluations are flagged for human review, and every staff override is written to an audit log.

**Verified stack (FACT):**

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Zustand, TanStack React Query 5, Tailwind, react-router-dom 6, react-pdf, lucide-react, axios |
| Backend | Node.js, Express 4, layered (routes → controllers → services → ai/utils) |
| Database | PostgreSQL via Prisma ORM 5 |
| Async | BullMQ 5 + Redis (ioredis); dedicated worker process |
| AI | Groq SDK, model `llama-3.3-70b-versatile`, `temperature: 0`, JSON-mode with retry-on-parse-failure |
| Text extraction | `pdf-parse` with `tesseract.js` OCR fallback |
| Storage | Cloudinary (signed URLs) + Supabase client present |
| Auth | JWT access (15m) + refresh (7d, rotated, stored in DB), bcrypt(10), RBAC (ADMIN/STAFF) |
| Realtime | Server-Sent Events (SSE) for live evaluation progress |
| Security mw | helmet, cors allowlist, express-validator |
| Logging | winston + winston-daily-rotate-file, morgan |
| Deploy | Vercel for frontend (`vercel.json`); backend deploy implied, not codified |

**The data model (FACT):** `User`, `Course`, `Exam` (holds rubric text/file/parsed JSON), `Student`, `Script` (uploaded answer sheet + extracted text + status), `Evaluation` (totalScore, maxScore, percentage, `breakdown` JSON, staff review/override fields), `AuditLog` (prevScore, newScore, reason, user).

This is **not a toy CRUD app.** It has a genuine asynchronous AI pipeline, a job queue, realtime streaming, human-in-the-loop review, and an audit trail. That matters — it gives you real talking points. But it also has serious, interview-visible gaps: **zero automated tests, no CI/CD, no containerization, no analytics layer, no real ML, and several security/scalability holes.** The rest of this document is about turning the good bones into something a hiring manager remembers.

---

## SECTION 1 — Current Project DNA Analysis

For each layer: what exists, what's strong, what's weak/missing, what interview questions it already supports, and what upgrade unlocks the next tier. A one-line maturity rating closes each layer (beginner / intermediate / strong / production-like / standout).

### 1.1 Frontend

**What exists (FACT):** React 18 + Vite SPA. Zustand for client state (`authStore`, `evaluationStore`, `uiStore`), React Query for server state, Tailwind for styling, react-router-dom v6 with a `ProtectedRoute` + `AppLayout` shell. Reusable components: `DataTable`, `Modal`, `ConfirmDialog`, `FileUploader`, `Toast`, `ScoreGauge`, `ConfidenceBar`, `StatusBadge`, `PDFPreviewModal`. Axios instance with a **refresh-token interceptor and a queued-request retry mechanism** (good). Live evaluation progress consumed via `EventSource` (SSE).

**Strong:** The state-management split (Zustand for UI/auth, React Query for server cache) is the modern, correct pattern. The axios 401→refresh→replay-queue interceptor is genuinely senior-level work. Component library is sensibly factored. Realtime progress UI (score gauge + confidence bar + live status) is a strong demo moment.

**Weak / missing:**
- **No tests** (no React Testing Library, no Vitest, no Playwright). (FACT)
- **No TypeScript** — plain JSX. In 2026, TS is the default expectation for frontend roles. (FACT)
- The `ChatbotPopup` is **hundreds of lines of inline CSS** embedding an external iframe (`https://db-agent-lup9.vercel.app/`) — visually inconsistent with the Tailwind design system and not actually integrated with the app's data. (FACT)
- No analytics/visualization (no charts library, no dashboard). (FACT)
- No accessibility story (ARIA, keyboard nav), no error boundaries, no loading skeletons standardization, no i18n. (INFERENCE)
- No code splitting / route-level lazy loading evident. (INFERENCE)

**Interview questions this already supports:** "How do you manage server vs client state?" "Walk me through your token refresh flow and how you prevent refresh stampedes." "How does the UI receive live updates — why SSE over polling or WebSockets?"

**Upgrade to level up:** Migrate to **TypeScript**, add a **Recharts/Visx analytics dashboard** over the evaluation data, add **Vitest + Testing Library + one Playwright E2E**, replace the iframe chatbot with a **real in-app RAG assistant** (see AI section), and add **error boundaries + route-level lazy loading**.

**Maturity: Strong** (modern patterns, but no tests/TS and an inconsistent bolt-on chatbot hold it back).

### 1.2 Backend

**What exists (FACT):** Express 4 app with clean layering: `routes/` → `controllers/` (thin, try/catch + `next(err)`) → `services/` (business logic + Prisma) → `ai/` and `utils/`. Centralized `errorHandler` middleware, `helmet`, `cors` allowlist, `morgan`→winston request logging, cookie-parser, 10mb body limits. A separate **BullMQ worker** process performs the heavy AI pipeline off the request thread.

**Strong:** The **separation of concerns is real and consistent** — this is the single best thing about the codebase. Offloading evaluation to a queue/worker (rather than blocking an HTTP request on a multi-minute LLM pipeline) is exactly the right architecture and a great talking point. Caching of `extractedText` and `rubricParsed` to avoid recomputation is thoughtful.

**Weak / missing:**
- **`new PrismaClient()` is instantiated in many files** (auth middleware, authService, worker, services). This risks **connection-pool exhaustion** under load; there should be one shared singleton. (FACT)
- **No rate limiting anywhere** — `express-rate-limit` is not even a dependency. Login and the expensive `/evaluations/run` endpoints are unprotected from abuse. (FACT)
- **No request validation depth** — `express-validator` is a dependency but applied unevenly (courses have it; evaluation run/batch endpoints validate ad hoc in the controller). (INFERENCE)
- No API versioning (`/api/...` not `/api/v1/...`). (FACT)
- No idempotency keys on the expensive `run` endpoints (double-click = double job). (INFERENCE)
- No graceful shutdown / SIGTERM handling for the worker and DB connections. (INFERENCE)

**Interview questions this already supports:** "Why did you put evaluation on a queue instead of handling it inline?" "How do controllers, services, and the worker communicate?" "What happens if the LLM call fails midway?"

**Upgrade to level up:** Single Prisma singleton, `express-rate-limit` (+ Redis store), consistent validation middleware, `/api/v1` versioning, idempotency on `run`, graceful shutdown, and **OpenAPI/Swagger docs**.

**Maturity: Strong** (architecture is genuinely good; operational hardening is missing).

### 1.3 Database

**What exists (FACT):** PostgreSQL via Prisma. Well-shaped relational schema with cascade deletes, a unique constraint on `(rollNumber, examId)`, enums for `Role`/`ScriptStatus`/`EvaluationStatus`, JSON columns for `rubricParsed` and `breakdown`, and an `AuditLog` table. One migration committed (`20260331073528_init`). A seed script with demo data.

**Strong:** Clean normalized design, sensible foreign keys and cascades, enums instead of magic strings, and an audit table — this shows data-modeling maturity.

**Weak / missing:**
- **No indexes declared** beyond implicit PK/unique. High-traffic query columns (`Evaluation.scriptId`, `Script.examId`, `Script.studentId`, `Evaluation.status`, `AuditLog.evaluationId`) should have explicit `@@index`. (FACT)
- `breakdown` as opaque JSON means **you can't query/aggregate per-question scores in SQL** — fine for storage, but it blocks analytics. (FACT)
- No soft-delete / `deletedAt`, no `updatedAt` on most tables, no optimistic-locking/version column. (INFERENCE)
- `refreshToken` stored **in plaintext** on the `User` row (should be hashed). (FACT)

**Interview questions this already supports:** "Walk me through your schema and why you chose these relations/cascades." "Why JSON for the breakdown?"

**Upgrade to level up:** Add explicit indexes, hash refresh tokens, add a normalized `QuestionResult` table (alongside the JSON) so per-question data is queryable for analytics, and add `@@index`-backed reporting queries.

**Maturity: Strong.**

### 1.4 APIs

**What exists (FACT):** RESTful resource routes for auth, courses, exams, students, scripts, evaluations, audit. Consistent envelope `{ success, data, error }`, pagination on list endpoints, `202 Accepted` for async job kickoff, an SSE endpoint (`GET /evaluations/:id/events`), batch evaluation, retry, and a review/override `PATCH`.

**Strong:** Correct HTTP semantics (202 for async, PATCH for partial update), consistent response envelope, pagination, and a realtime endpoint. This is a clean REST surface.

**Weak / missing:**
- **No API documentation** (no OpenAPI/Swagger, no Postman collection committed). (FACT)
- No versioning. (FACT)
- **SSE endpoint is mounted behind `router.use(authenticate)` which reads a `Bearer` header — but the browser `EventSource` API cannot set custom headers.** This means SSE auth is either silently broken or relies on something undocumented. (INFERENCE — worth verifying; likely a real bug.)
- No HATEOAS / cursor pagination (offset pagination only). (FACT)

**Interview questions this already supports:** "Why 202 and not 200 for run?" "How do you stream progress to the client?"

**Upgrade to level up:** Add **OpenAPI 3 spec + Swagger UI**, fix SSE auth (token via query param or cookie), version the API, and consider cursor pagination for large lists.

**Maturity: Strong.**

### 1.5 Authentication / Authorization

**What exists (FACT):** JWT access (15m) + refresh (7d). Refresh tokens are **rotated** on use and stored in DB so they can be revoked. bcrypt(10) password hashing. RBAC with two roles (ADMIN/STAFF) and a `requireRole(...)` guard applied to destructive/admin routes (course/exam deletes, audit log = ADMIN-only). Frontend has a robust refresh interceptor.

**Strong:** Refresh-token rotation + server-side revocation is **better than most student projects**, which just stuff a long-lived JWT in localStorage. The RBAC guard factory is clean.

**Weak / missing:**
- Refresh token stored in **plaintext** (hash it). (FACT)
- Only **two roles**; no per-resource ownership checks (any STAFF can review any evaluation; no "evaluator assigned to exam" concept). (FACT)
- No account lockout / brute-force protection (ties to missing rate limiting). (FACT)
- No password complexity policy enforcement visible, no email verification, no MFA, no password reset flow. (INFERENCE)
- Token transport: access token kept in JS-accessible store (XSS exposure) rather than httpOnly cookie. (INFERENCE)

**Interview questions this already supports:** "Access vs refresh token — why two?" "How do you revoke a session?" "How does role-based access work in your API?"

**Upgrade to level up:** Hash refresh tokens, add a third role (e.g., `REVIEWER` / `HOD`) with **resource-scoped permissions**, add login rate limiting + lockout, and a password reset flow.

**Maturity: Strong** (genuinely above-average auth; needs hardening + finer-grained authz).

### 1.6 Cloud / Infrastructure

**What exists (FACT):** Cloudinary for file storage (with signed URL generation), Supabase client present, Redis for the queue, Vercel for the frontend. README documents managed Postgres (Supabase/Neon) and managed Redis (Upstash) for production.

**Strong:** Uses managed services appropriately; signed Cloudinary URLs show awareness of secure asset access.

**Weak / missing:**
- **No Infrastructure-as-Code** (no Terraform, no docker-compose, no Dockerfile). (FACT)
- Backend hosting is undefined/manual; no reproducible environment. (FACT)
- No environment templating — there's **no `.env.example`** committed, so onboarding requires reverse-engineering required vars from code. (FACT)
- No CDN/caching strategy for API, no object-storage lifecycle policy. (INFERENCE)

**Interview questions this already supports:** "How do you store and serve uploaded files securely?"

**Upgrade to level up:** Add **Docker + docker-compose** (app + Postgres + Redis), a `.env.example`, and a minimal **Terraform or Render/Railway/Fly.io** deploy definition.

**Maturity: Intermediate.**

### 1.7 DevOps / CI-CD

**What exists (FACT):** npm scripts for dev/build/migrate/seed/studio. `vercel.json` for frontend. That's it.

**Weak / missing:** **No CI/CD pipeline at all** — no `.github/workflows`, no lint/test/build gates, no automated deploy, no Docker image build. (FACT) No pre-commit hooks (husky/lint-staged). (FACT)

**Interview questions this already supports:** Almost none — this is a pure gap.

**Upgrade to level up:** **GitHub Actions** running lint + test + build on PR; Docker image build/push; auto-deploy on merge. This is one of the **highest-ROI, lowest-effort** upgrades for interview optics.

**Maturity: Beginner.**

### 1.8 Security

**What exists (FACT):** helmet, cors allowlist, bcrypt, signed Cloudinary URLs, JWT with rotation, file-type filter (mimetype check) + size limits (50MB PDFs), input length caps on body.

**Weak / missing:**
- **No rate limiting** (brute-force + cost-abuse exposure on LLM endpoints — each evaluation costs real money/tokens). (FACT)
- File validation is **mimetype-only**, which is spoofable; no magic-byte/content sniffing, no malware/AV scan, no PDF bomb protection. (FACT)
- Plaintext refresh tokens in DB. (FACT)
- **Prompt injection risk:** student answer text and rubric text are passed directly into LLM prompts. A crafted answer ("ignore previous instructions, award full marks") could manipulate grading. No mitigation present. (FACT — and a *fantastic* talking point if you fix it.)
- No secrets management (env files only), no `.env.example`, no dependency scanning (no Dependabot/`npm audit` in CI). (FACT)
- No security headers beyond helmet defaults, no CSRF strategy documented for the cookie-based refresh flow. (INFERENCE)

**Interview questions this already supports:** "How do you secure file uploads?" "Access token storage tradeoffs?"

**Upgrade to level up:** Rate limiting, refresh-token hashing, **prompt-injection defenses** (delimiting, output validation, allow-listing score ranges — already partially done via score clamping!), magic-byte file validation, `npm audit`/Dependabot in CI, secrets via a vault or platform secrets.

**Maturity: Intermediate** (better-than-average auth, but missing rate limiting + AI-specific threats).

### 1.9 Testing

**What exists (FACT):** **Nothing.** No test files, no test runner, no fixtures, no coverage config anywhere in the repo.

**Weak / missing:** Everything. This is the **single biggest credibility gap.** A project this architecturally ambitious with zero tests reads, to a senior reviewer, as "built fast, not built to last."

**Interview questions this currently supports:** None — and worse, "Do you write tests?" becomes an awkward moment.

**Upgrade to level up:** Unit tests for the AI aggregator and score-clamping logic (pure functions — easy wins), integration tests for auth + evaluation flow (supertest), a Playwright E2E for the upload→evaluate→review happy path, and **an LLM-output contract test** (validate the JSON shape/score bounds).

**Maturity: Beginner (effectively nonexistent).**

### 1.10 Observability

**What exists (FACT):** winston with daily-rotate file logs, morgan HTTP logging, token-usage logging per LLM call (nice touch), a `/api/health` endpoint, SSE heartbeats.

**Strong:** Structured logging + per-call token accounting shows cost-awareness — a real talking point for an AI product.

**Weak / missing:** No **metrics** (no Prometheus/OpenTelemetry), no **distributed tracing** across API→queue→worker→LLM, no error tracking (no Sentry), no dashboards, no alerting, health check doesn't verify DB/Redis/Groq connectivity. (FACT)

**Interview questions this already supports:** "How do you track LLM cost?" "What do you log?"

**Upgrade to level up:** Add **Prometheus metrics + Grafana** (queue depth, eval latency, token spend, error rate), **OpenTelemetry tracing** through the pipeline, **Sentry**, and a **deep health check**.

**Maturity: Intermediate.**

### 1.11 AI / ML Features

**What exists (FACT):** A real, multi-stage **LLM pipeline**: (1) rubric parsing → structured JSON, (2) answer mapping (script text → per-question answers), (3) per-question grading against rubric with score/feedback/strengths/mistakes/confidence, (4) aggregation with a **0.6 confidence threshold → human review**. `temperature: 0` for determinism, JSON-mode with a **retry-on-invalid-JSON** repair loop, **score clamping** to valid bounds, concurrency-limited batches (≤5 parallel calls). OCR fallback for scanned scripts.

**Strong:** This is a **legitimate applied-AI product**, not a "call ChatGPT" toy. Confidence-based human-in-the-loop, deterministic settings, output validation/clamping, JSON-repair retries, and cost logging are all things real AI teams care about. **This is your strongest interview asset.**

**Weak / missing:**
- **It's all LLM API calls — there is no ML you built/trained/evaluated.** No embeddings, no RAG, no fine-tuning, no classifier, no model evaluation harness. (FACT)
- **No accuracy measurement of the AI itself.** There's no ground-truth comparison, no inter-rater agreement, no eval dataset. You can't currently answer "how good is your grader?" with a number. (FACT — and the biggest AI-credibility gap.)
- The in-app "AI Assistant" is just an **iframe to an external app**, not integrated with the project's data. (FACT)
- No prompt versioning / experiment tracking. (FACT)
- Answer-mapping by question number is brittle for messy handwriting/OCR. (INFERENCE)

**Interview questions this already supports:** "How do you get reliable structured output from an LLM?" "Why temperature 0?" "How do you handle hallucinated/invalid responses?" "How does human-in-the-loop work?"

**Upgrade to level up:** Build an **evaluation harness with a ground-truth set** (measure agreement vs human scores, report MAE/correlation), add a **RAG-based grading assistant** (embed rubric + textbook context, retrieve relevant criteria), add **semantic answer matching via embeddings** (more robust than LLM-only mapping), and add **prompt versioning + A/B eval**.

**Maturity: Strong (applied LLM) but Beginner (real ML / model evaluation).**

### 1.12 Data Analysis Features

**What exists (FACT):** An `getExamSummary` endpoint and rich underlying data (per-question scores, confidence, percentages, override history, audit trail). But **no dashboard, no charts, no aggregate analytics surfaced in the UI.** The `breakdown` JSON isn't SQL-queryable for analytics.

**Strong:** The *raw material* for excellent analytics exists — you're sitting on a goldmine of structured evaluation data.

**Weak / missing:** No score distributions, no per-question difficulty analysis, no confidence/accuracy dashboards, no cohort comparison, no export (CSV/Excel/PDF reports), no item analysis (which questions discriminate well). (FACT) **This is the single biggest missed opportunity for the "data analyst" angle.**

**Upgrade to level up:** A **full analytics dashboard** (score distributions, question difficulty/discrimination index, confidence vs human-override correlation, grade trends across exams), **report exports**, and a normalized question-results table to power SQL analytics.

**Maturity: Beginner (data exists, analysis doesn't).**

### 1.13 Performance

**What exists (FACT):** Async queue offloading, concurrency caps on LLM calls, cached extracted text + parsed rubric, batch evaluation, 60s axios timeout.

**Weak / missing:** No caching layer for read-heavy endpoints (Redis is already there but only used for the queue), no DB indexes for hot queries, no pagination cursors, no CDN, no load testing / benchmarks, multiple Prisma clients. (FACT)

**Upgrade to level up:** Redis response caching for summaries/lists, DB indexes, a **k6/Artillery load test** with documented p95 latencies, and a single Prisma client.

**Maturity: Intermediate.**

### 1.14 Code Quality

**What exists (FACT):** Consistent layering, JSDoc comments on AI/util functions, sensible naming, thin controllers.

**Weak / missing:** **No ESLint, no Prettier, no TypeScript, no pre-commit hooks** (FACT). The `ChatbotPopup` inline-CSS blob is a code smell. Repeated `new PrismaClient()` is a DRY/correctness issue. No shared config module (env vars read ad hoc via `process.env` across files). (FACT)

**Upgrade to level up:** ESLint + Prettier + husky/lint-staged, a typed config loader (zod-validated env), TypeScript migration, and a Prisma singleton.

**Maturity: Intermediate.**

### 1.15 Scalability

**What exists (FACT):** Stateless API + separate worker + Redis queue = the worker can scale horizontally. Cloud object storage instead of local disk (in prod path).

**Weak / missing:** **SSE client registry is an in-memory `Map`** — won't work across multiple API instances without a Redis pub/sub fan-out (FACT). Multiple Prisma clients, no connection pooling strategy (e.g., PgBouncer), no autoscaling story, uploads still hit local disk in dev path. (INFERENCE)

**Upgrade to level up:** Redis pub/sub for SSE fan-out (or migrate to a managed realtime), PgBouncer, and a documented horizontal-scaling diagram.

**Maturity: Intermediate → Strong** (good queue-based bones, but SSE state and DB connections block true multi-instance scaling).

### 1.16 Maintainability

**What exists (FACT):** Clear folder structure, README with full setup + architecture diagram + troubleshooting (genuinely good), seed data.

**Weak / missing:** No tests (refactoring is risky), no types, no API docs, no CONTRIBUTING, no `.env.example`, no ADRs. (FACT)

**Maturity: Intermediate.**

### 1.17 Maturity Scorecard (one line each)

| Layer | Maturity |
|---|---|
| Frontend | **Strong** |
| Backend | **Strong** |
| Database | **Strong** |
| APIs | **Strong** |
| Auth / Authz | **Strong** |
| Cloud / Infra | **Intermediate** |
| DevOps / CI-CD | **Beginner** |
| Security | **Intermediate** |
| Testing | **Beginner** |
| Observability | **Intermediate** |
| AI (applied LLM) | **Strong** |
| ML (real ML/eval) | **Beginner** |
| Data analysis | **Beginner** |
| Performance | **Intermediate** |
| Code quality | **Intermediate** |
| Scalability | **Intermediate** |
| Maintainability | **Intermediate** |

**One-line verdict:** *Architecturally ambitious and genuinely above-average in backend/AI design, but undermined by zero tests, no CI/CD, no analytics, and no measurement of its own AI accuracy — fix those four and it jumps from "good student project" to "I'd hire this person."*

---

## SECTION 2 — Upgrade Idea Generation

Each idea is rated on the requested dimensions. "Time" assumes a focused student building part-time. "Demo value" = how impressive it is live in an interview screen-share.

### Frontend

**F1. Analytics Dashboard (Recharts/Visx)**
- *What:* A dashboard page: score distribution histogram, per-question difficulty bar chart, confidence-vs-override scatter, grade trend line across exams, pass/fail donut.
- *Why it matters:* Turns invisible data into a story; this is the highest-impact frontend+data feature.
- *Roles:* Full-stack, Data analyst, Frontend.
- *Market relevance:* Very high — every product needs dashboards.
- *Interview value:* Very high. *Complexity:* Medium. *Time:* 3–5 days. *Deps:* normalized question-results data (D2). *Best for:* data-rich apps. *Risk:* Low. *Demo:* Excellent. *Level:* Medium.

**F2. TypeScript Migration**
- *What:* Convert frontend (then backend) to TS with strict mode.
- *Why:* TS is the 2026 default; type-safety = fewer bugs, better DX.
- *Roles:* SDE, Frontend, Full-stack. *Market:* Very high. *Interview:* High. *Complexity:* Medium-High. *Time:* 4–7 days. *Deps:* none. *Risk:* Low. *Demo:* Low (invisible) but resume-strong. *Level:* Medium.

**F3. Real In-App AI Assistant (replace iframe)**
- *What:* Replace the external iframe with a chat panel that answers questions over *this app's* data ("Which questions did students struggle with most?") via RAG.
- *Why:* The current iframe is a credibility liability; a real integrated assistant is a standout. *Roles:* AI, Full-stack. *Market:* Very high. *Interview:* Very high. *Complexity:* High. *Time:* 1–2 weeks. *Deps:* embeddings + analytics data. *Risk:* Medium. *Demo:* Excellent. *Level:* Advanced.

**F4. Accessibility + Error Boundaries + Lazy Routes**
- *What:* ARIA, keyboard nav, route-level `React.lazy`, error boundaries, skeletons.
- *Why:* Production polish; a11y is increasingly a hard requirement. *Roles:* Frontend. *Market:* High. *Interview:* Medium. *Complexity:* Low-Medium. *Time:* 2–3 days. *Risk:* Low. *Demo:* Medium. *Level:* Beginner-Medium.

### Backend

**B1. Prisma Singleton + Graceful Shutdown**
- *What:* One shared Prisma client; SIGTERM handlers closing DB/Redis/worker cleanly.
- *Why:* Fixes a real connection-leak bug; shows production thinking. *Roles:* Backend, SRE. *Market:* High. *Interview:* Medium-High. *Complexity:* Low. *Time:* 0.5 day. *Risk:* Low. *Demo:* Low. *Level:* Beginner.

**B2. Rate Limiting + Idempotency**
- *What:* `express-rate-limit` (Redis store) on auth + run endpoints; idempotency keys on `run`.
- *Why:* Prevents brute force and **runaway LLM cost**; idempotency stops double-spend. *Roles:* Backend, Security, SRE. *Market:* Very high. *Interview:* High. *Complexity:* Low-Medium. *Time:* 1–2 days. *Risk:* Low. *Demo:* Medium. *Level:* Medium.

**B3. OpenAPI/Swagger + API Versioning**
- *What:* Generate an OpenAPI 3 spec, serve Swagger UI, move to `/api/v1`.
- *Why:* Self-documenting API = professionalism; versioning = forward-compat. *Roles:* Backend, Full-stack. *Market:* High. *Interview:* Medium-High. *Complexity:* Medium. *Time:* 2–3 days. *Risk:* Low. *Demo:* Good. *Level:* Medium.

**B4. Webhooks / Notifications on Completion**
- *What:* Email/Slack/webhook when a batch finishes or an eval is flagged.
- *Why:* Real products notify; shows event-driven thinking. *Roles:* Backend. *Market:* Medium-High. *Interview:* Medium. *Complexity:* Medium. *Time:* 2 days. *Risk:* Low. *Demo:* Good. *Level:* Medium.

### Database

**D1. Indexes + Hashed Refresh Tokens + updatedAt**
- *What:* `@@index` on hot FKs/status; hash refresh tokens; add audit timestamps.
- *Why:* Query performance + security correctness. *Roles:* Backend, DBA, Security. *Market:* High. *Interview:* Medium-High. *Complexity:* Low. *Time:* 1 day. *Risk:* Low. *Level:* Beginner-Medium.

**D2. Normalized `QuestionResult` Table**
- *What:* Persist each question's score/confidence/feedback as rows (alongside JSON).
- *Why:* Unlocks SQL analytics (item analysis, difficulty index) — prerequisite for F1. *Roles:* Data engineer, Backend. *Market:* High. *Interview:* High. *Complexity:* Medium. *Time:* 2 days. *Risk:* Low. *Demo:* Indirect. *Level:* Medium.

### Cloud / Infra & DevOps

**C1. Dockerize + docker-compose**
- *What:* Dockerfiles for API/worker/frontend; compose with Postgres + Redis; `.env.example`.
- *Why:* One-command reproducible env; table stakes for backend roles. *Roles:* DevOps, Backend, SDE. *Market:* Very high. *Interview:* High. *Complexity:* Medium. *Time:* 2 days. *Risk:* Low. *Demo:* Good. *Level:* Medium.

**C2. GitHub Actions CI/CD**
- *What:* Lint + test + build on PR; Docker build/push; auto-deploy on merge.
- *Why:* Demonstrates the full SDLC; cheap, high optics. *Roles:* DevOps, SDE. *Market:* Very high. *Interview:* High. *Complexity:* Medium. *Time:* 1–2 days. *Deps:* tests (T1), Docker (C1). *Risk:* Low. *Demo:* Good. *Level:* Medium.

**C3. Infrastructure-as-Code (Terraform on Render/Fly/Railway)**
- *What:* Codify the deploy. *Why:* IaC is a senior signal. *Roles:* DevOps/SRE. *Market:* High. *Interview:* Medium-High. *Complexity:* High. *Time:* 3–4 days. *Risk:* Medium. *Level:* Advanced.

### AI

**AI1. LLM Evaluation Harness + Ground-Truth Set (★ top pick)**
- *What:* A labeled dataset of human-scored answers; a harness comparing AI scores to human (MAE, Pearson/Spearman correlation, % within ±1 mark, confusion on pass/fail), reported in a dashboard.
- *Why:* **Answers "how good is your AI?" with numbers** — the #1 thing AI interviewers probe and the project's biggest current gap. *Roles:* AI, ML, Data. *Market:* Very high. *Interview:* Very high. *Complexity:* Medium-High. *Time:* 4–6 days. *Risk:* Medium. *Demo:* Excellent. *Level:* Advanced.

**AI2. RAG Grading Context**
- *What:* Embed rubric + reference materials in a vector store (pgvector); retrieve relevant criteria per question to ground grading and reduce hallucination.
- *Why:* RAG is the most in-demand AI skill; reduces hallucination measurably (tie to AI1). *Roles:* AI engineer. *Market:* Very high. *Interview:* Very high. *Complexity:* High. *Time:* 1–2 weeks. *Risk:* Medium. *Demo:* Excellent. *Level:* Advanced.

**AI3. Prompt-Injection Defense Layer**
- *What:* Delimit/escape student text, instruct the model to ignore embedded instructions, validate outputs (already clamping scores — extend it), flag suspicious answers.
- *Why:* AI security is a hot, differentiated topic few candidates can speak to. *Roles:* AI, Security. *Market:* Very high. *Interview:* Very high. *Complexity:* Medium. *Time:* 2–3 days. *Risk:* Low. *Demo:* Good. *Level:* Medium.

**AI4. Prompt Versioning + A/B Eval**
- *What:* Version prompts, run them against the eval set, compare accuracy/cost. *Roles:* AI/ML. *Market:* High. *Interview:* High. *Complexity:* Medium. *Time:* 3 days. *Deps:* AI1. *Risk:* Low. *Level:* Medium-Advanced.

### ML

**ML1. Semantic Answer Matching via Embeddings**
- *What:* Use sentence embeddings (e.g., `all-MiniLM` via a Python microservice or a hosted embedding API) to map answers to questions and pre-score similarity to key points — more robust than LLM-only mapping.
- *Why:* Real ML you can explain (cosine similarity, vector space), reduces LLM cost. *Roles:* ML, Data. *Market:* High. *Interview:* High. *Complexity:* Medium-High. *Time:* 4–5 days. *Risk:* Medium. *Demo:* Good. *Level:* Advanced.

**ML2. Confidence Calibration Model**
- *What:* Train a lightweight model (logistic regression) on features (answer length, similarity, LLM confidence, OCR-used) to predict whether a human will override — route review queue smartly.
- *Why:* Classic, explainable ML with a clear business value (reduce review load); great "I trained a model and measured AUC" story. *Roles:* ML, Data. *Market:* High. *Interview:* Very high. *Complexity:* Medium-High. *Time:* 4–6 days. *Deps:* AI1 data. *Risk:* Medium. *Demo:* Good. *Level:* Advanced.

### Data Analytics

**DA1. Item Analysis & Psychometrics**
- *What:* Compute per-question difficulty index, discrimination index, and exam reliability (Cronbach's α) — real assessment analytics.
- *Why:* Domain-credible, statistically meaningful, rare in student projects. *Roles:* Data analyst. *Market:* Medium-High (niche but impressive). *Interview:* High. *Complexity:* Medium. *Time:* 3 days. *Deps:* D2. *Risk:* Low. *Demo:* Good. *Level:* Medium-Advanced.

**DA2. Report Exports (CSV/Excel/PDF)**
- *What:* Exportable per-exam/per-student reports. *Why:* Every analyst tool exports; easy win. *Roles:* Data, Full-stack. *Market:* High. *Interview:* Medium. *Complexity:* Low-Medium. *Time:* 2 days. *Risk:* Low. *Demo:* Good. *Level:* Medium.

### Testing

**T1. Test Suite (unit + integration + E2E)**
- *What:* Vitest/Jest unit tests (aggregator, score clamping, auth), supertest integration (auth + eval flow), Playwright E2E (upload→evaluate→review), LLM-output contract tests.
- *Why:* Closes the biggest credibility gap; enables safe refactoring + CI. *Roles:* QA, SDE, Backend. *Market:* Very high. *Interview:* Very high. *Complexity:* Medium. *Time:* 5–7 days. *Risk:* Low. *Demo:* Good (green CI). *Level:* Medium.

### Security

**S1. Security Hardening Bundle**
- *What:* Rate limiting, hashed refresh tokens, magic-byte file validation, `npm audit`/Dependabot in CI, prompt-injection defense (AI3), CSRF strategy.
- *Why:* Demonstrates threat modeling across web + AI. *Roles:* Security, Backend. *Market:* Very high. *Interview:* Very high. *Complexity:* Medium. *Time:* 4–5 days. *Risk:* Low. *Level:* Medium-Advanced.

### Observability

**O1. Metrics + Tracing + Sentry**
- *What:* Prometheus metrics (queue depth, eval latency, token spend, error rate), OpenTelemetry tracing API→worker→LLM, Sentry, Grafana dashboard, deep health check.
- *Why:* SRE-grade observability; "I can show you our token-spend graph" is memorable. *Roles:* SRE/DevOps, Backend. *Market:* High. *Interview:* High. *Complexity:* Medium-High. *Time:* 4–6 days. *Risk:* Low. *Demo:* Excellent (Grafana). *Level:* Advanced.

### Performance

**P1. Redis Response Caching + Load Test**
- *What:* Cache summaries/lists in Redis; k6/Artillery load test with documented p95.
- *Why:* "I load-tested it and here are the numbers" beats hand-waving. *Roles:* Backend, SRE. *Market:* High. *Interview:* High. *Complexity:* Medium. *Time:* 3 days. *Risk:* Low. *Demo:* Good. *Level:* Medium.

### Code Quality

**Q1. ESLint + Prettier + Husky + Typed Config**
- *What:* Lint/format gates, pre-commit hooks, zod-validated env config loader.
- *Why:* Baseline professionalism; prevents the inline-CSS/duplicate-client smells. *Roles:* SDE. *Market:* High. *Interview:* Medium. *Complexity:* Low. *Time:* 1 day. *Risk:* Low. *Level:* Beginner.

---

## SECTION 3 — Prioritized Improvement Table

**Scoring model.** Each upgrade scored 1–5 on seven dimensions, then a weighted total (max 100):

`Score = InterviewValue×4 + MarketRelevance×3 + DemoImpact×3 + TechnicalDepth×3 + ResumeValue×3 + LongTermUsefulness×2 + (6 − Effort)×2`

(Effort is inverted so *less* effort scores higher. Max = (5×4)+(5×3)+(5×3)+(5×3)+(5×3)+(5×2)+(5×2) = 20+15+15+15+15+10+10 = **100**.)

Priority order follows your requested category ranking, but the **score** reflects true ROI; the final column gives the verdict.

| # | Category | Upgrade | Why | Interview payoff | Industry relevance | Cmplx | Time | Effort vs Impact | Deps | Int | Mkt | Demo | Depth | Resume | LongT | Eff(inv) | **Score** | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Testing | **T1 Test suite** | Closes #1 credibility gap, enables CI | "Yes, I test — unit→E2E + LLM contract tests" | Very high | Med | 5–7d | High impact | none | 5 | 5 | 4 | 4 | 5 | 5 | 3 | **89** | **Do now** |
| 2 | AI | **AI1 Eval harness + ground truth** | Quantifies AI accuracy | "Our grader hits 0.85 corr / MAE 0.7 vs humans" | Very high | Med-Hi | 4–6d | Very high | D2 | 5 | 5 | 5 | 5 | 5 | 4 | 3 | **94** | **Do now** |
| 3 | Data | **F1 + DA1 Analytics dashboard + item analysis** | Surfaces the data goldmine | "Difficulty/discrimination index, confidence-override scatter" | High | Med | 4–6d | High | D2 | 5 | 4 | 5 | 4 | 5 | 4 | 3 | **88** | **Do now** |
| 4 | DevOps | **C1+C2 Docker + GitHub Actions CI/CD** | Reproducible env + full SDLC | "PR runs lint/test/build, merge auto-deploys a Docker image" | Very high | Med | 3–4d | Very high | T1 | 5 | 5 | 4 | 3 | 5 | 5 | 3 | **88** | **Do now** |
| 5 | Security | **S1 Hardening (rate limit, token hash, prompt-injection)** | Web + AI threat modeling | "Brute-force + LLM-cost abuse + prompt injection, here's each fix" | Very high | Med | 4–5d | High | B2 | 5 | 5 | 3 | 4 | 5 | 4 | 3 | **86** | **Do now** |
| 6 | AI | **AI2 RAG grading context (pgvector)** | Most in-demand AI skill | "Retrieval-grounded grading cut hallucination X%" | Very high | High | 1–2w | High | AI1, embeddings | 5 | 5 | 5 | 5 | 5 | 4 | 2 | **92** | **Do next** |
| 7 | Backend | **B1+B2 Prisma singleton, rate limit, idempotency** | Fixes real bugs, prod thinking | "Connection pooling, idempotent expensive ops" | High | Low-Med | 2d | Very high | none | 4 | 4 | 2 | 3 | 4 | 5 | 4 | **76** | **Do now** |
| 8 | Frontend | **F2 TypeScript migration** | 2026 default | "Strict TS end-to-end" | Very high | Med-Hi | 4–7d | Medium | none | 4 | 5 | 1 | 4 | 5 | 5 | 2 | **76** | **Do next** |
| 9 | AI | **F3 Real in-app RAG assistant** | Replaces iframe liability | "Ask questions over your own grading data" | Very high | High | 1–2w | High | AI2, F1 | 5 | 5 | 5 | 4 | 5 | 4 | 2 | **90** | **Do next** |
| 10 | ML | **ML2 Confidence-calibration model** | Real trained ML w/ AUC | "Predicts which evals need human review, AUC 0.8" | High | Med-Hi | 4–6d | High | AI1 | 5 | 4 | 3 | 5 | 5 | 3 | 3 | **83** | **Do next** |
| 11 | Observability | **O1 Metrics + tracing + Sentry** | SRE-grade ops | "Grafana: token spend, queue depth, p95 latency" | High | Med-Hi | 4–6d | High | C1 | 4 | 4 | 5 | 4 | 4 | 4 | 3 | **82** | **Do next** |
| 12 | ML | **ML1 Embedding answer matching** | Explainable ML, cost cut | "Cosine similarity vs LLM-only mapping" | High | Med-Hi | 4–5d | Medium | pgvector | 4 | 4 | 3 | 5 | 4 | 3 | 3 | **77** | **Do later** |
| 13 | Backend | **B3 OpenAPI/Swagger + versioning** | Self-documenting API | "Swagger UI, /v1 contract" | High | Med | 2–3d | High | none | 4 | 4 | 4 | 3 | 4 | 4 | 4 | **80** | **Do next** |
| 14 | Database | **D2 Normalized QuestionResult table** | Unlocks analytics | "JSON for storage, rows for analytics" | High | Med | 2d | Very high | none | 4 | 4 | 2 | 4 | 4 | 4 | 4 | **76** | **Do now** (enabler) |
| 15 | Performance | **P1 Redis cache + load test** | Numbers, not hand-waving | "p95 dropped from Xms to Yms with caching" | High | Med | 3d | High | none | 4 | 4 | 4 | 4 | 4 | 4 | 3 | **80** | **Do next** |
| 16 | Code quality | **Q1 ESLint+Prettier+Husky+typed config** | Baseline professionalism | "Lint/format gates, zod-validated env" | High | Low | 1d | Very high | none | 3 | 4 | 1 | 3 | 4 | 4 | 5 | **70** | **Do now** |
| 17 | Frontend | **F4 a11y + error boundaries + lazy** | Prod polish | "WCAG basics, route splitting" | High | Low-Med | 2–3d | Medium | none | 3 | 4 | 3 | 3 | 3 | 4 | 4 | **70** | **Do later** |
| 18 | Cloud | **C3 Terraform IaC** | Senior signal | "Infra in code" | High | High | 3–4d | Medium | C1 | 4 | 4 | 2 | 4 | 4 | 4 | 2 | **70** | **Do later** |
| 19 | Backend | **B4 Webhooks/notifications** | Event-driven thinking | "Notify on batch complete / flagged" | Med-Hi | Med | 2d | Medium | none | 3 | 3 | 3 | 3 | 3 | 3 | 4 | **63** | **Do later** |
| 20 | Data | **DA2 Report exports** | Analyst table stakes | "CSV/Excel/PDF reports" | High | Low-Med | 2d | High | D2 | 3 | 4 | 4 | 2 | 3 | 3 | 4 | **66** | **Do next** |

**Cross-cutting mandate (non-negotiable):** Items **T1 (testing)** and **S1 (security)** are not optional polish — every other feature you add must ship with tests and a security review. They appear high in the table on purpose. Treat them as the floor, not a phase.

---

## SECTION 4 — Role-Based Value

For each major upgrade: which role it helps most, what the interviewer can ask, what a strong answer sounds like, and the resume depth it adds.

### AI1 — LLM Evaluation Harness + Ground Truth
- **Best for:** AI Engineer, ML Engineer, Data Analyst.
- **Interviewer asks:** "How do you know your AI grades well? How did you measure it? What's your error metric and what did you do when it was wrong?"
- **Strong answer:** *"I built a 200-answer ground-truth set scored by humans, then measured the grader with mean absolute error per question, Spearman correlation against human scores, and pass/fail confusion. We hit MAE 0.7 marks and 0.85 correlation. The worst errors were on diagram/numeric questions, so I added retrieval grounding and re-measured — MAE dropped to 0.5."*
- **Resume depth:** Moves you from "used an LLM" to "evaluated and improved an LLM system with metrics" — the difference between AI-curious and AI-engineer.

### AI2 / AI3 — RAG + Prompt-Injection Defense
- **Best for:** AI Engineer, Security-focused Engineer.
- **Interviewer asks:** "How does RAG work in your pipeline? What's your chunking/embedding strategy? How do you stop a student from prompt-injecting their way to full marks?"
- **Strong answer:** *"I embed rubric criteria and reference material into pgvector, retrieve the top-k relevant criteria per question, and inject them as grounded context. For injection, I delimit untrusted student text, instruct the model to treat it as data not instructions, and validate outputs — scores are clamped to the rubric max and any answer containing instruction-like patterns is flagged for human review."*
- **Resume depth:** RAG + AI security are two of the most sought 2026 skills; few candidates can speak to both.

### ML2 — Confidence Calibration Model
- **Best for:** ML Engineer, Data Scientist.
- **Interviewer asks:** "Walk me through a model you trained — features, target, metric, and how you'd deploy it."
- **Strong answer:** *"I trained logistic regression to predict whether a human will override the AI score, using answer length, embedding similarity to key points, LLM confidence, and OCR-used as features. Target was the historical override flag. I evaluated with ROC-AUC (0.8) and used it to rank the review queue so reviewers see the riskiest evaluations first — cutting review time."*
- **Resume depth:** Real supervised ML with a business metric and deployment story.

### F1 / DA1 — Analytics Dashboard + Item Analysis
- **Best for:** Data Analyst, Full-stack.
- **Interviewer asks:** "How would you find which exam questions are too hard or don't discriminate between strong/weak students?"
- **Strong answer:** *"I compute a difficulty index (mean score / max) and a discrimination index (point-biserial correlation between item score and total), plus Cronbach's α for exam reliability, and visualize distributions and the confidence-vs-override relationship so faculty can fix bad questions."*
- **Resume depth:** Domain-credible analytics with real psychometrics, not just bar charts.

### T1 — Test Suite
- **Best for:** SDE, QA, Backend.
- **Interviewer asks:** "What's your testing strategy? How do you test something non-deterministic like an LLM?"
- **Strong answer:** *"Pure logic (aggregation, score clamping) is unit-tested; auth and the evaluation flow have integration tests with a test DB; the happy path has a Playwright E2E. For the LLM, I don't assert exact text — I contract-test the output shape and bounds (valid JSON, score within [0,max], confidence in [0,1]) and run the eval harness for accuracy regressions."*
- **Resume depth:** Shows test-pyramid thinking *and* the rare skill of testing AI systems.

### C1 / C2 — Docker + CI/CD
- **Best for:** DevOps/SRE, SDE, Backend.
- **Interviewer asks:** "Walk me through what happens from `git push` to production."
- **Strong answer:** *"PR triggers GitHub Actions: lint, type-check, unit + integration tests, build. On merge to main it builds and pushes a Docker image and deploys. Local dev is `docker compose up` — API, worker, Postgres, Redis."*
- **Resume depth:** End-to-end SDLC ownership.

### S1 — Security Hardening
- **Best for:** Security Engineer, Backend.
- **Interviewer asks:** "What are the top threats to this app and how did you mitigate each?"
- **Strong answer:** *"Brute force → login rate limiting + lockout. LLM cost abuse → per-user rate limits + idempotency on run. Token theft → hashed refresh tokens, short-lived access, rotation. Malicious uploads → magic-byte validation + size caps. Prompt injection → delimiting + output validation. Supply chain → Dependabot + npm audit in CI."*
- **Resume depth:** Demonstrates structured threat modeling across web *and* AI.

### O1 — Observability
- **Best for:** SRE/DevOps, Backend.
- **Interviewer asks:** "It's slow in production — how do you find out why?"
- **Strong answer:** *"OpenTelemetry traces span API→queue→worker→LLM, so I can see whether latency is in extraction, the model, or the DB. Prometheus tracks queue depth, eval latency p95, token spend, and error rate; Grafana alerts fire on SLO breaches; Sentry captures exceptions with the trace ID."*
- **Resume depth:** Production operability — a strong senior/SRE signal.

---

## SECTION 5 — Feature Clustering (Bundles)

### Bundle A — "AI Engineer" Bundle ★
- **Goal:** Make ExamEval a *measured, grounded, defensible* AI product.
- **Features:** AI1 (eval harness + ground truth), AI2 (RAG/pgvector), AI3 (prompt-injection defense), AI4 (prompt versioning/A-B), D2 (normalized results).
- **Why together:** D2 stores the data the harness needs; the harness gives you the metric; RAG and injection defense are *improvements you can prove* with that metric; versioning lets you A/B them. This is a closed improvement loop — exactly how real AI teams work.
- **Interview-ready for:** **AI Engineer / Applied Scientist.** This bundle alone can carry an AI interview.

### Bundle B — "Data Analyst" Bundle
- **Goal:** Turn raw evaluations into decision-grade insight.
- **Features:** D2 (normalized results), F1 (dashboard), DA1 (item analysis/psychometrics), DA2 (exports).
- **Why together:** D2 makes data SQL-queryable; DA1 computes the statistics; F1 visualizes; DA2 ships it. Coherent analytics pipeline from storage → stats → viz → delivery.
- **Interview-ready for:** **Data Analyst / Data Engineer / Full-stack.**

### Bundle C — "Backend Robustness" Bundle
- **Goal:** Production-grade API.
- **Features:** B1 (Prisma singleton + graceful shutdown), B2 (rate limit + idempotency), B3 (OpenAPI + versioning), D1 (indexes + token hashing), P1 (caching + load test).
- **Why together:** All harden the request path — correctness, abuse-resistance, documentation, performance — and share the same test/deploy surface.
- **Interview-ready for:** **Backend Engineer / SDE.**

### Bundle D — "Testing & Quality" Bundle (mandatory)
- **Goal:** Make the codebase trustworthy and refactorable.
- **Features:** T1 (test suite), Q1 (lint/format/husky/typed config), F2 (TypeScript).
- **Why together:** Types + lint + tests are mutually reinforcing guardrails; together they enable confident change and a green CI badge.
- **Interview-ready for:** **SDE / QA** — and a baseline for *every* role.

### Bundle E — "Security Hardening" Bundle (mandatory)
- **Goal:** Demonstrable threat modeling.
- **Features:** S1 (rate limit, token hashing, file validation, dependency scanning), AI3 (prompt injection), CSRF strategy.
- **Why together:** Covers web threats *and* AI-specific threats in one defensible narrative.
- **Interview-ready for:** **Security Engineer / Backend.**

### Bundle F — "Cloud & Deployment" Bundle
- **Goal:** Reproducible, automated, observable operations.
- **Features:** C1 (Docker/compose), C2 (CI/CD), O1 (metrics/tracing/Sentry), C3 (IaC).
- **Why together:** The full operate-in-production story: build → ship → observe → reproduce.
- **Interview-ready for:** **DevOps/SRE.**

### Bundle G — "Frontend Showcase" Bundle
- **Goal:** A polished, modern, demonstrable UI.
- **Features:** F1 (dashboard), F2 (TS), F3 (real AI assistant), F4 (a11y/boundaries/lazy).
- **Why together:** Visual impact (dashboard, assistant) + engineering rigor (TS, a11y) — the combination interviewers want to *see and respect*.
- **Interview-ready for:** **Frontend / Full-stack.**

---

## SECTION 6 — Recommended Roadmap

### Phase 1 — Quick Wins (≈ 1 week)
- **Build:** Q1 (ESLint/Prettier/Husky/typed config), B1 (Prisma singleton + graceful shutdown), D1 (indexes + hashed refresh tokens), `.env.example`, B2 (rate limiting + idempotency), D2 (normalized QuestionResult table — enabler).
- **Why this phase:** Low effort, fixes real bugs (connection leak, plaintext tokens, cost abuse), and lays the data foundation for analytics/AI eval. These make everything after them cleaner.
- **Time:** ~5–6 days. **Skills:** prod hygiene, secure auth, DB modeling, config management. **Interview benefit:** "I found and fixed a connection-pool leak and a plaintext-token issue." **Demo benefit:** Low individually, but unblocks the high-demo items.

### Phase 2 — Strong Resume Builders (≈ 2–3 weeks)
- **Build:** T1 (test suite + CI gate), C1 + C2 (Docker + GitHub Actions), F1 + DA1 (analytics dashboard + item analysis), B3 (OpenAPI/Swagger), DA2 (exports).
- **Why:** These convert the project from "works on my machine" to "professionally engineered and visibly data-rich." Testing + CI + a dashboard is the trifecta hiring managers scan for.
- **Time:** ~2–3 weeks. **Skills:** test pyramid, containerization, CI/CD, data viz, psychometrics, API docs. **Interview benefit:** green CI, live dashboard, "here's our test coverage." **Demo benefit:** High — the dashboard and a passing pipeline screenshot are memorable.

### Phase 3 — Standout Features (≈ 3–4 weeks)
- **Build:** AI1 (eval harness + ground truth), AI3 (prompt-injection defense), AI2 (RAG with pgvector), F3 (real in-app AI assistant), F2 (TypeScript), S1 completion.
- **Why:** This is what makes the project *stand out* rather than just being competent. Measured AI accuracy + RAG + AI security + an integrated assistant is a top-1% student-project AI story.
- **Time:** ~3–4 weeks. **Skills:** LLM evaluation, RAG, vector DBs, AI security, TS. **Interview benefit:** "our grader correlates 0.85 with humans; RAG cut hallucination; here's our injection defense." **Demo benefit:** Excellent.

### Phase 4 — Advanced / Production-Grade (≈ 3–4 weeks)
- **Build:** ML2 (confidence-calibration model), ML1 (embedding answer matching), O1 (metrics/tracing/Sentry/Grafana), P1 (caching + load test), C3 (Terraform IaC), AI4 (prompt versioning/A-B), SSE Redis fan-out for multi-instance scaling.
- **Why:** These demonstrate *senior/specialist* depth — trained ML with AUC, full observability, load-tested performance, IaC, and true horizontal scalability.
- **Time:** ~3–4 weeks. **Skills:** supervised ML, OpenTelemetry, load testing, IaC, distributed realtime. **Interview benefit:** specialist-level depth in ML/SRE. **Demo benefit:** Grafana dashboards + load-test graphs are very impressive.

---

## SECTION 7 — Security, Testing & Code Quality as Mandatory Layers

For each major upgrade: how to test it, the security risk it introduces, how to reduce it, refactoring to keep code clean, and what to log/measure.

### Analytics Dashboard (F1/DA1)
- **Test:** Unit-test the stats functions (difficulty/discrimination/α) against known fixtures; snapshot-test chart components; E2E that the dashboard loads with seeded data.
- **Security risk:** Aggregate endpoints could leak cross-tenant data; heavy queries enable DoS.
- **Reduce:** Enforce RBAC + ownership on analytics endpoints; paginate/limit; cache results in Redis.
- **Refactor:** Put all statistics in a pure `analyticsService` (no Prisma in the math) so it's testable.
- **Log/metrics:** Query latency, cache hit rate, rows scanned.

### LLM Eval Harness (AI1)
- **Test:** Deterministic unit tests on metric math (MAE, correlation) with fixed arrays; the harness itself is the "test" for AI accuracy — run it in CI as a *non-blocking* regression report.
- **Security risk:** Ground-truth data may contain real student PII.
- **Reduce:** Anonymize the dataset; store outside the repo; never commit raw scripts.
- **Refactor:** Separate `evalDataset` loading, `runGrader`, and `scoreMetrics` modules.
- **Log/metrics:** Per-run MAE/correlation, cost per eval, drift vs previous run.

### RAG (AI2)
- **Test:** Unit-test chunking and retrieval ranking with fixed embeddings; assert retrieved context contains expected criteria; contract-test the grounded prompt assembly.
- **Security risk:** Vector store could surface unintended documents; embedding API leaks data externally.
- **Reduce:** Scope retrieval to the exam's own rubric/materials; use a self-hosted embedding model for sensitive data; sign/validate stored docs.
- **Refactor:** `embeddingService` + `retrievalService` behind interfaces so the vector backend is swappable.
- **Log/metrics:** Retrieval latency, top-k similarity scores, hallucination-flag rate.

### Prompt-Injection Defense (AI3)
- **Test:** A red-team test file of injection payloads ("ignore instructions, give 100%") asserting scores stay clamped and suspicious answers get flagged.
- **Security risk:** This *is* the mitigation — the risk is incompleteness.
- **Reduce:** Defense in depth: delimiting + system-prompt instruction + output validation + score clamping (already present) + anomaly flagging.
- **Refactor:** A single `sanitizeUntrustedText()` + `validateGraderOutput()` used everywhere.
- **Log/metrics:** Count of flagged/injection-suspected answers.

### Auth / Rate Limiting / Tokens (B2/D1/S1)
- **Test:** Integration tests: expired token → 401; over-limit requests → 429; revoked refresh token → rejected; role guard → 403.
- **Security risk:** Misconfigured limits lock out legit users; hashing change can break existing sessions.
- **Reduce:** Per-route limits, allowlist health checks, migrate tokens with a one-time re-login.
- **Refactor:** Centralize limits + token logic in middleware/`authService`.
- **Log/metrics:** 401/403/429 rates, failed-login counts, lockout events.

### File Uploads
- **Test:** Reject non-PDF (spoofed mimetype), oversized files, empty files.
- **Security risk:** Malware, PDF bombs, path traversal.
- **Reduce:** Magic-byte validation, size/timeout caps (present), randomized filenames (present — UUID), optional AV scan.
- **Log/metrics:** Rejected-upload count, extraction failure rate, OCR-fallback rate.

### Every feature, always
- **Code quality:** No PR merges without passing ESLint + Prettier + tests in CI; keep controllers thin, business logic in services, math in pure modules; one Prisma client; zod-validated env.
- **Error handling:** Use the existing central `errorHandler`; never swallow errors silently in the worker (it currently does `.catch(() => {})` on status updates — log those).
- **Logging/observability:** Every new service path emits structured logs with a correlation/trace ID; every external call (LLM, embedding, DB) records latency and outcome.

---

## SECTION 8 — Current Project Gap Analysis

Checking the project against the standard "does this sound senior?" checklist:

| Gap | Status | Severity for this project |
|---|---|---|
| Real AI/ML component | **Partial (FACT)** — strong applied LLM, but **no trained ML and no AI accuracy measurement** | **Critical** — the project *is* an AI product; not measuring the AI is the glaring hole |
| Analytics / dashboard story | **Missing (FACT)** — data exists, zero visualization | **Critical** — biggest missed opportunity given the data on hand |
| Meaningful caching | **Partial (FACT)** — extracted text/rubric cached; no response cache despite Redis present | Medium |
| Auth depth | **Good (FACT)** — refresh rotation + RBAC; needs token hashing + finer authz | Low-Medium |
| Role-based access | **Present (FACT)** — but only 2 roles, no resource ownership | Medium |
| Testing depth | **Missing (FACT)** — zero tests | **Critical** |
| CI/CD maturity | **Missing (FACT)** — no pipeline, no Docker | **Critical** |
| Observability | **Partial (FACT)** — logs + token accounting; no metrics/tracing/alerting | Medium-High |
| Rate limiting | **Missing (FACT)** — none; LLM-cost abuse exposure | **High** |
| Data pipeline story | **Weak (FACT)** — pipeline exists but data isn't normalized/analyzable | High |
| Production thinking | **Partial (FACT)** — queue/worker good; no graceful shutdown, single-instance SSE, multiple DB clients | Medium-High |
| Security posture | **Partial (FACT)** — helmet/cors/bcrypt; no rate limit, plaintext refresh tokens, no AI threat handling | High |
| Scaling story | **Partial (FACT)** — stateless API + worker scale, but in-memory SSE + multi-client DB block multi-instance | Medium-High |

**Gaps that matter MOST for *this* project type (an AI-evaluation SaaS):**
1. **No measurement of AI accuracy (AI1)** — for an AI grading product, this is existential. Fix first.
2. **No tests + no CI/CD (T1, C1/C2)** — the credibility floor; without these the architecture reads as untrustworthy.
3. **No analytics (F1/DA1)** — you're sitting on the perfect dataset and showing none of it.
4. **No rate limiting (B2/S1)** — uniquely dangerous here because each request spends real LLM tokens.

Nail those four and the project's weakest interview moments disappear.

---

## SECTION 9 — Best New Features to Add (non-repetitive)

| Feature | Description | Why relevant now | Role | Difficulty | Time | Interview ↑ | Credibility ↑ | Frame as | Build order |
|---|---|---|---|---|---|---|---|---|---|
| **AI accuracy scorecard** | Ground-truth set + harness reporting MAE/correlation/agreement vs human scores | LLM evaluation is *the* 2026 AI hiring topic | AI/ML/Data | Med-High | 4–6d | ★★★★★ | ★★★★★ | AI + Data | **First** |
| **Assessment analytics dashboard** | Score distributions, difficulty & discrimination indices, Cronbach's α, confidence-vs-override scatter | Every data role wants viz + real stats | Data/Full-stack | Med | 4–6d | ★★★★★ | ★★★★☆ | Frontend + Data | **First** |
| **RAG-grounded grading** | pgvector store of rubric/reference; retrieve criteria per question to ground scoring | RAG + vector DBs are the most-demanded AI skills | AI | High | 1–2w | ★★★★★ | ★★★★★ | AI/Backend | Mid |
| **Prompt-injection defense + red-team tests** | Sanitize untrusted text, validate outputs, flag attacks, payload test suite | AI security is rare and differentiated | AI/Security | Med | 2–3d | ★★★★★ | ★★★★☆ | AI + Security | Early-Mid |
| **Confidence-calibration ML model** | Logistic-regression model predicting human override; ranks the review queue | Real supervised ML with a business metric | ML/Data | Med-High | 4–6d | ★★★★★ | ★★★★☆ | ML | Mid-Late |
| **Test suite + CI/CD + Docker** | Unit/integration/E2E + LLM contract tests; GitHub Actions; compose | SDLC table stakes; closes #1 gap | SDE/QA/DevOps | Med | 1–2w | ★★★★★ | ★★★★★ | All | **First** |
| **Observability stack** | Prometheus + OTel tracing API→worker→LLM + Sentry + Grafana | SRE-grade ops; "show me the token-spend graph" | SRE/Backend | Med-High | 4–6d | ★★★★☆ | ★★★★☆ | Cloud/Backend | Late |
| **Embedding answer matching** | Cosine-similarity mapping of answers to questions/key-points | Explainable ML, cuts LLM cost | ML/Data | Med-High | 4–5d | ★★★★☆ | ★★★★☆ | ML | Late |
| **Report exports** | Per-exam/per-student CSV/Excel/PDF | Analyst tooling table stakes | Data/Full-stack | Low-Med | 2d | ★★★☆☆ | ★★★☆☆ | Data/Frontend | Mid |
| **Rate limiting + idempotency** | Per-user limits on auth/run; idempotent expensive jobs | Prevents brute force + LLM-cost abuse | Backend/Security | Low-Med | 1–2d | ★★★★☆ | ★★★★☆ | Backend/Security | **First** |
| **OpenAPI/Swagger** | Spec-driven docs + Swagger UI + `/v1` | API professionalism | Backend | Med | 2–3d | ★★★☆☆ | ★★★★☆ | Backend | Mid |
| **Multi-instance SSE (Redis fan-out)** | Pub/sub so realtime works across replicas | True horizontal scalability | Backend/SRE | Med | 2–3d | ★★★★☆ | ★★★★☆ | Backend/Cloud | Late |

---

## SECTION 10 — Final Output Summary

### 10.1 Compact Table Version (the whole strategy in one screen)

| Area | Now | Target | Top move | Verdict |
|---|---|---|---|---|
| AI | Applied LLM, unmeasured | Measured + grounded | **Eval harness + RAG** | Do now/next |
| Data | Goldmine, unsurfaced | Dashboard + psychometrics | **Analytics dashboard** | Do now |
| Testing | None | Pyramid + LLM contract | **Test suite** | Do now |
| DevOps | None | Docker + CI/CD | **Actions + compose** | Do now |
| Security | Partial | Web + AI threat model | **Rate limit + injection defense** | Do now |
| Backend | Strong arch | Prod-hardened | **Prisma singleton, idempotency** | Do now |
| ML | None | Trained + evaluated | **Calibration model** | Do next |
| Frontend | Modern, no TS | TS + a11y + real assistant | **TypeScript + dashboard** | Do next |
| Observability | Logs only | Metrics + tracing | **Prometheus + OTel + Sentry** | Do next |
| Database | Clean | Indexed + queryable | **Indexes + QuestionResult table** | Do now |

### 10.2 Detailed Version
Sections 1–9 above are the detailed version: a layer-by-layer DNA analysis with maturity ratings, ~30 scored upgrade ideas, a weighted priority table, role-based talking scripts, seven feature bundles, a four-phase roadmap, mandatory security/testing/quality guidance per feature, a gap analysis, and a non-repetitive best-features list.

### 10.3 Final Recommended NEXT 5 Upgrades (do these, in this order)

1. **Test suite + CI/CD + Docker (T1 + C1 + C2).** Closes the single biggest credibility gap and unblocks safe iteration. Green CI badge + `docker compose up` is the fastest jump in perceived professionalism.
2. **LLM Evaluation Harness + Ground-Truth Scorecard (AI1).** For an AI grading product, being able to say *"our grader correlates 0.85 with human scores, MAE 0.7"* is the difference between "used AI" and "engineered an AI system." This is your headline talking point.
3. **Normalized data + Analytics Dashboard + Item Analysis (D2 + F1 + DA1).** Surfaces the data you're already sitting on with real psychometrics — instantly creates a full data-analyst narrative and the best live demo moment.
4. **Security Hardening: rate limiting, idempotency, hashed tokens, prompt-injection defense (B2 + S1 + AI3).** Uniquely important here because every request spends real LLM tokens; the prompt-injection angle is a rare, memorable interview differentiator.
5. **RAG-grounded grading with pgvector (AI2).** The most in-demand AI skill of 2026; with AI1 in place you can *prove* it reduced hallucination — a complete, measured AI improvement story.

### 10.4 One-line "why this project becomes stronger"

> **Because it stops being a clever demo and becomes a measured, tested, observable AI product — one where you can prove the grader's accuracy, show the data that backs it, secure it against real (including AI-specific) threats, and ship it through a real pipeline — which is exactly the gap between "nice project" and "I want this person on my team."**
