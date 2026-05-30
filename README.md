# CloudCert Pro

> **Enterprise cloud certification study platform** — timed mock exams, analytics, spaced repetition, and role-based access for **GCP, AWS, Azure, and CompTIA** certifications.

[![CI Pipeline](https://github.com/your-org/cloudcert-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/cloudcert-pro/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-≥80%25-brightgreen)](#testing--quality-assurance)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Node 20 LTS](https://img.shields.io/badge/node-20%20LTS-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

---

## Table of Contents

- [Overview](#overview)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Local Development](#local-development)
- [API Reference](#api-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [CI/CD and Deployment](#cicd-and-deployment)
- [Security and Compliance](#security-and-compliance)
- [Data Model](#data-model)
- [Contribution Guide](#contribution-guide)
- [Support and SLA](#support-and-sla)
- [License](#license)

---

## Overview

**CloudCert Pro** is a full-stack, production-ready certification study platform designed for individuals and engineering teams preparing for cloud and IT certifications. The platform provides an intelligent, data-driven study experience covering:

| Certification Domain | Supported Exams |
|---|---|
| **Google Cloud Platform** | Professional Cloud Architect (PCA) |
| **Template-ready** | AWS, Azure, CompTIA (via the JSON seeder template system) |

### Core Features

- **🎯 Adaptive Mock Exams** — Timed practice exams with single-answer and multi-select MCQ formats, configurable duration, question count, and difficulty balance
- **🧠 Spaced Repetition System (SRS)** — Evidence-based review scheduling using SM-2 algorithm to surface weak questions at optimal intervals
- **📊 Deep Analytics Dashboard** — Topic proficiency scoring, exam readiness index, fatigue detection, hesitation analysis, consistency trends, and peer benchmarking
- **🔑 Role-Based Access Control** — Admin and Learner roles with separate portals; JWT httpOnly cookie authentication with per-role route guards
- **🗂️ Admin Portal** — Full certification CRUD: manage certifications, topics, subtopics, exam configurations, domain weight percentages, and question banks
- **📋 Study Plan Generation** — Automatically identifies the three weakest topics and generates a prioritised study list
- **🏆 Achievement System** — XP-based gamification with milestone achievements (streaks, completion rates, accuracy targets)
- **📄 OpenAPI 3.0 Specification** — Live Swagger UI at `/api-docs` with auto-generated TypeScript SDK
- **🔒 Enterprise-grade Security** — 8-job CI security pipeline: SAST (CodeQL), SCA (OWASP Dependency-Check), DAST (OWASP ZAP), secret scanning (TruffleHog)

### Audience

| Role | What you do here |
|---|---|
| **Learners** | Take mock exams, track progress, review answers, study weak topics |
| **Admins** | Manage question banks, configure exams, set domain weights |
| **Developers** | Extend the API, add certification data, integrate via the TypeScript SDK |
| **DevOps / Platform** | Deploy containers, configure CI/CD, manage secrets |

---

## Architecture Overview

CloudCert Pro is a **monorepo full-stack application** — a single Node.js process serves both the Express REST API and the compiled React SPA, making it simple to deploy as a single Docker container.

```
┌────────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                           │
│             React 19 SPA  ·  React Router 7  ·  Tailwind CSS 4     │
│             Motion (animations)  ·  Lucide React (icons)           │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ HTTPS / JSON REST
┌─────────────────────────────▼─────────────────────────────────────────┐
│                     Express 4 Server (server.ts)                      │
│                                                                       │
│  Middleware Stack:                                                    │
│  helmet (CSP) → cors → cookieParser → correlationId → httpLogger      │
│                                                                       │
│  API Routes (/api/*)           OpenAPI Docs (/api-docs/*)             │
│  ├─ /auth         (login/logout/register/reset-password)              │
│  ├─ /certifications (CRUD + topics + subtopics + questions)           │
│  ├─ /exam-sessions  (start/submit/history/session-based selection)    │
│  ├─ /srs            (spaced repetition scheduling)                    │
│  ├─ /achievements   (XP + milestone tracking)                         │
│  ├─ /study-plan     (weak topic identification)                       │
│  ├─ /insights       (analytics + benchmarking)                        │
│  └─ /units          (learning unit management)                        │
│                                                                       │
│  Service Layer:                                                       │
│  AnalyticsService · BenchmarkService · CertificationService           │
│  QuestionHistoryService · StudyListService · ExamGradingService       │
│  QuestionSelector · CacheService · RetryService · EmailService        │
│                                                                       │
│  Repository Layer (typed SQLite):                                     │
│  CertificationRepository · QuestionRepository · ExamSessionRepository │
│  ExamAnswerRepository · UserRepository · UnitRepository               │
└─────────────────────────────┬─────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│              SQLite 3 (better-sqlite3) — single-file DB             │
│              Schema migrations v1–v11 (auto-run on startup)         │
│              WAL mode · FK enforcement · composite indexes          │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| React Router DOM | 7 | Client-side routing with role-based guards |
| TypeScript | 5.8 | Type safety across the SPA |
| Tailwind CSS | 4 | Utility-first styling |
| Motion (Framer) | 12 | Page transition and micro-animations |
| Lucide React | 0.546 | Icon library |
| Vite | 6 | Build tool and dev server (HMR) |

#### Backend

| Technology | Version | Role |
|---|---|---|
| Node.js | 20 LTS | Runtime |
| Express | 4 | HTTP server and REST API |
| TypeScript (tsx) | 5.8 / 4.x | Server-side TypeScript without a compile step |
| better-sqlite3 | 12 | Synchronous, embedded SQLite driver |
| jsonwebtoken | 9 | JWT session tokens (httpOnly cookie) |
| bcryptjs | 3 | Password hashing (bcrypt, cost factor 12) |
| Zod | 4 | Request body validation and OpenAPI schema generation |
| pino / pino-http | 10 / 11 | Structured JSON logging with PII redaction |
| helmet | 8 | HTTP security headers and CSP |
| express-rate-limit | 8 | Request rate limiting |
| nodemailer | 8 | Transactional email (password reset) |
| uuid | 14 | UUID v4 (correlation IDs) and UUID v5 (deterministic cert IDs) |

#### API & Documentation

| Technology | Role |
|---|---|
| `@asteasolutions/zod-to-openapi` | Generates OpenAPI 3.0 spec from Zod schemas |
| swagger-ui-express | Interactive API docs at `/api-docs` |
| `@openapitools/openapi-generator-cli` | Generates TypeScript/JavaScript SDK from the spec |

#### Infrastructure & DevOps

| Technology | Role |
|---|---|
| Docker (multi-stage, Alpine) | Container packaging; 4-stage build (deps → builder → prod-deps → runtime) |
| GitHub Actions | 8-job CI/CD pipeline |
| OWASP ZAP | DAST (dynamic security testing) |
| CodeQL | SAST (static application security testing) |
| OWASP Dependency-Check | SCA (software composition analysis) |
| TruffleHog | Secret scanning across git history |

---

## Quick Start

### Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Required for running the server and tests |
| npm | 10+ | Installed with Node 20 |
| Git | 2.x | Required for cloning |
| Docker | 20+ | Optional — for containerised runs |

### 1. Clone the repository

```bash
git clone https://github.com/your-org/cloudcert-pro.git
cd cloudcert-pro
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set the required secrets (see [Environment Variables](#environment-variables) below for full reference):

```bash
# Required — must be at least 32 characters each
JWT_SECRET="your-super-secret-key-min-32-chars"
RESET_TOKEN_SECRET="your-reset-token-secret-min-32-chars"

# Optional — defaults shown
ALLOWED_ORIGIN="http://localhost:5173"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="ChangeMe123!"
```

### 4. Start the development server

```bash
npm run dev
```

The server starts on **http://localhost:3000** by default.

- **React SPA** → `http://localhost:3000/`
- **API** → `http://localhost:3000/api/`
- **Swagger UI** → `http://localhost:3000/api-docs/`

On first startup, the server automatically:
1. Runs all pending schema migrations (v1–v11)
2. Seeds the admin and learner accounts from `SEED_ADMIN_*` env vars
3. Seeds all GCP certification data from `src/server/db/seed-data/gcp/`

### 5. Default accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `ChangeMe123!` |
| Learner | `learner@example.com` | `ChangeMe123!` |

> **⚠️ Change default passwords immediately** in any non-local environment.

---

## Local Development

### Available Commands

```bash
# Development server (Express + Vite HMR)
npm run dev

# Run all tests
npm test

# Run tests with coverage report (≥80% threshold enforced)
npm run test:coverage

# Type checking
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Code formatting
npm run format
npm run format:check

# Production build (Vite)
npm run build

# Generate TypeScript SDK from OpenAPI spec
npm run generate:sdk:ts

# Generate JavaScript SDK from OpenAPI spec
npm run generate:sdk:js
```

### Project Structure

```
cloudcert-pro/
├── server.ts                    # Express app entry point
├── src/
│   ├── App.tsx                  # React root with routes and auth guards
│   ├── AuthContext.tsx          # React auth context provider
│   ├── api.ts                   # Typed fetch client (browser)
│   ├── components/
│   │   ├── features/            # Feature components (Admin, Quiz, Insights, Dashboard)
│   │   ├── layouts/             # AppShell layout wrapper
│   │   └── ui/                  # Reusable UI primitives
│   ├── hooks/                   # Custom React hooks (useAuth, useExamSession, useAdminNavigation, ...)
│   ├── utils/                   # Frontend utility functions
│   ├── constants/               # App-wide constants
│   ├── types/                   # Shared TypeScript types (frontend)
│   └── server/
│       ├── config.ts            # Env var loading with fail-fast validation
│       ├── logger.ts            # pino structured logger (PII-redacting)
│       ├── validation.ts        # Domain validators (email, password, URL)
│       ├── db-types.ts          # SQLite row shape interfaces
│       ├── db/
│       │   ├── connection.ts    # better-sqlite3 singleton (WAL + FK)
│       │   ├── migrations.ts    # Schema-guard migration runner (v1–v11)
│       │   ├── seeds.ts         # Admin/learner/achievement seeder
│       │   ├── seedCertifications.ts  # JSON-driven certification seeder
│       │   └── seed-data/       # Certification JSON data files
│       │       └── gcp/         # 8 GCP certification directories
│       ├── errors/              # AppError hierarchy (Validation, NotFound, Unauthorized, Forbidden)
│       ├── middleware/          # auth, correlationId, errorHandler, httpLogger, rateLimiter, validate
│       ├── repositories/        # Typed SQLite data access layer
│       ├── services/            # Business logic layer
│       ├── routes/              # Express HTTP route handlers
│       ├── openapi/             # OpenAPI spec registration and Zod schemas
│       ├── types/               # Server-side TypeScript augmentations
│       └── utils/               # Server utility functions
├── scripts/
│   └── generate-sdk.ts          # OpenAPI → SDK generation script
├── sdk/
│   └── typescript-test/         # Generated TypeScript SDK scaffold
├── .github/
│   └── workflows/
│       ├── ci.yml               # 8-job CI security + quality pipeline
│       └── container.yml        # Docker build and container scan pipeline
├── Dockerfile                   # 4-stage multi-stage production build
├── .env.example                 # Environment variable reference template
├── vitest.config.ts             # Test configuration (≥80% coverage thresholds)
├── vite.config.ts               # Vite frontend build config
├── tsconfig.json                # TypeScript compiler config
└── eslint.config.js             # ESLint flat config (TypeScript + React)
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | ✅ | — | Min 32 chars. Signs session JWT tokens |
| `RESET_TOKEN_SECRET` | ✅ | — | Min 32 chars. Signs password-reset tokens. Must differ from `JWT_SECRET` |
| `ALLOWED_ORIGIN` | ❌ | `http://localhost:5173` | CORS allowed origin for the React SPA |
| `PORT` | ❌ | `3000` | HTTP port the Express server listens on |
| `NODE_ENV` | ❌ | `development` | Set to `production` to disable Vite HMR and enable strict CSP |
| `SEED_ADMIN_EMAIL` | ❌ | `admin@example.com` | Admin account email created on first startup |
| `SEED_ADMIN_PASSWORD` | ❌ | `ChangeMe123!` | Admin account password — **change before deploying** |
| `SEED_LEARNER_EMAIL` | ❌ | `learner@example.com` | Test learner account email |
| `SEED_LEARNER_PASSWORD` | ❌ | `ChangeMe123!` | Test learner account password |
| `APP_URL` | ❌ | `http://localhost:5173` | Public URL used to build password-reset email links |
| `SMTP_HOST` | ❌ | — | SMTP server hostname. Omit to use console-log fallback in dev |
| `SMTP_PORT` | ❌ | `587` | SMTP port (587 for STARTTLS, 465 for SSL) |
| `SMTP_USER` | ❌ | — | SMTP auth username / API key |
| `SMTP_PASS` | ❌ | — | SMTP auth password / API secret |
| `SMTP_FROM` | ❌ | `noreply@cloudcertpro.com` | Sender address shown in outbound emails |
| `NVD_API_KEY` | ❌ | — | OWASP Dependency-Check NVD API key — reduces rate-limiting |

### Adding a New Certification

CloudCert Pro uses a **JSON-driven seeder** that auto-discovers certification directories:

1. Copy the seeder template:
   ```bash
   cp -r src/server/db/seed-data/certificate-seeder-json-template/my-cert-slug \
         src/server/db/seed-data/<vendor>/<my-cert-slug>
   ```
2. Edit the JSON files in your new directory to define:
   - `metadata.json` — certification name, vendor, exam code, domain weights
   - `topics/` — topic and subtopic definitions
   - `questions/` — MCQ question sets (supports both single and multi-select)
3. Run `npm run dev` — the seeder auto-discovers and loads the new directory on startup.
4. Run `npm test` to validate seed data integrity (property-based tests in `seedData.test.ts`)

---

## API Reference

The full API is documented in the **Swagger UI** at `/api-docs` when the server is running.

### API Domains

| Route Prefix | Domain | Auth Required |
|---|---|---|
| `POST /api/auth/login` | Authentication | ❌ |
| `POST /api/auth/register` | Authentication | ❌ |
| `POST /api/auth/forgot-password` | Password Reset | ❌ |
| `POST /api/auth/reset-password` | Password Reset | ❌ |
| `GET /api/certifications` | Certification Catalogue | ✅ |
| `POST /api/certifications` | Certification Management | ✅ Admin |
| `GET /api/certifications/:id/topics` | Topic Hierarchy | ✅ |
| `POST /api/certifications/:id/exam-sessions` | Start Mock Exam | ✅ |
| `POST /api/exam-sessions/:id/submit` | Submit Exam | ✅ |
| `GET /api/insights/:certId` | Analytics Dashboard | ✅ |
| `GET /api/srs` | Spaced Repetition Queue | ✅ |
| `GET /api/achievements` | Achievement Tracking | ✅ |
| `GET /api/study-plan/:certId` | Study Plan | ✅ |
| `GET /api/units/:certId` | Learning Units | ✅ |

### Authentication

CloudCert Pro uses **dual-token JWT authentication**:

- **Session Token** — signed with `JWT_SECRET`, delivered as an `httpOnly; SameSite=Strict` cookie. Automatically attached to every browser request.
- **Password Reset Token** — signed with `RESET_TOKEN_SECRET` (distinct from session secret), time-limited, single-use HMAC token embedded in the reset email link.

All protected routes validate the JWT from the cookie. Role-based middleware (`requireAdmin`) enforces admin-only endpoints.

### Generating the TypeScript SDK

```bash
npm run generate:sdk:ts
```

The SDK is generated into `sdk/typescript-test/` from the live OpenAPI spec. It provides fully-typed API client functions for every endpoint.

---

## Testing & Quality Assurance

### Test Philosophy

CloudCert Pro uses a **property-based testing** (PBT) approach alongside traditional unit and integration tests. The [fast-check](https://github.com/dubzzz/fast-check) library generates hundreds of randomised inputs per test run to surface edge cases that example-based tests miss.

### Test Suite Structure

| Layer | Files | What is tested |
|---|---|---|
| **Config** | `config.test.ts`, `validation.test.ts` | Env var loading, fail-fast guards, domain validators |
| **Logger** | `logger.test.ts`, `utils/time.test.ts` | pino config, PII redaction, time utilities |
| **DB** | `db/connection.test.ts`, `migrations.test.ts` (×3), `seeds.test.ts` | Connection singleton, migration runner idempotency, seeder |
| **Middleware** | `middleware/*.test.ts` (×4) | correlationId injection, error serialisation, request logging, Zod validation |
| **Errors** | `errors/errors.test.ts` | AppError hierarchy, HTTP status mapping |
| **Repositories** | `*Repository.test.ts` (×7) | CRUD operations, FK constraints, property-based data access |
| **Services** | `*Service.test.ts` (×16+) | Analytics, benchmarking, exam grading, question selection, SRS, study list |
| **Routes** | `routes/*.test.ts` (×8) | HTTP integration tests with in-memory SQLite |
| **OpenAPI** | `openapi/*.test.ts` (×3+) | Spec integrity, response-time SLOs, route coverage |
| **Seed Data** | `seedData.test.ts` | JSON data file validation (FK references, weight sums, MCQ format) |
| **Components** | `components/**/*.test.tsx` (×7) | React component rendering, user interactions |
| **Hooks** | `hooks/*.test.tsx` (×6) | State management, navigation, exam session logic |
| **Utilities** | `utils/*.test.ts` | URL encoding, session storage, filter serialisation |

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage (fails if any metric drops below 80%)
npm run test:coverage

# Run a specific test file
npx vitest run src/server/services/AnalyticsService.test.ts

# Watch mode (auto-reruns on file save)
npx vitest
```

### Coverage Requirements

All four coverage axes are gated at **≥ 80%** in CI. The pipeline will fail if any threshold is breached.

| Metric | Threshold |
|---|---|
| Lines | ≥ 80% |
| Functions | ≥ 80% |
| Branches | ≥ 80% |
| Statements | ≥ 80% |

Coverage reports are uploaded as CI artifacts (30-day retention on `main`, 7 days for PRs) and are available in `coverage/` locally after running `npm run test:coverage`.

### Code Quality Gates

```bash
# TypeScript strict type checking
npm run typecheck

# ESLint (TypeScript + React hooks rules)
npm run lint

# Prettier format check
npm run format:check
```

All three checks run in parallel in CI and **block merges** if they fail.

---

## CI/CD and Deployment

### CI Pipeline — GitHub Actions

The pipeline runs on every push to `main`, `develop`, and all pull requests. It is composed of **8 parallel and sequential jobs**:

```
 quality ────────┐
                 ├──► build ──► dast
 test ───────────┘

 security ──────────────────────────── (parallel)
 secret-scan ──────────────────────── (parallel)
 sast ──────────────────────────────── (parallel)
 sca ───────────────────────────────── (parallel)
```

| Job | Tool | What it checks |
|---|---|---|
| **quality** | ESLint + tsc + Prettier | Lint, type safety, formatting |
| **test** | Vitest | All tests + ≥80% coverage |
| **build** | Vite | Production frontend build |
| **security** | npm audit | High/critical CVE dependencies |
| **secret-scan** | TruffleHog v3 | Accidentally committed secrets across full git history |
| **sast** | GitHub CodeQL | Static analysis (OWASP Top 10, CWE Top 25, SQL injection, XSS, path traversal, …) |
| **sca** | OWASP Dependency-Check | NVD + OSS Index CVE cross-reference (fails on CVSS ≥ 7) |
| **dast** | OWASP ZAP Baseline | Runtime security headers, cookie attributes, clickjacking, info disclosure |

**Security features:**
- All Actions are pinned to **immutable full commit SHAs** to prevent supply-chain attacks from moving tags
- Principle of least privilege: `permissions: contents: read` at the workflow level; jobs declare additional permissions explicitly
- Concurrency control: in-progress runs for the same branch are cancelled to avoid wasted compute
- SARIF results from CodeQL, OWASP Dependency-Check, and ZAP are uploaded to the **GitHub Security tab**

### Container Pipeline

A separate `container.yml` workflow handles Docker image builds and container-level scanning.

### Deploying with Docker

#### Build the image

```bash
docker build \
  --build-arg COMMIT_SHA=$(git rev-parse HEAD) \
  --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -t cloudcert-pro:latest .
```

#### Run the container

```bash
docker run -d \
  --name cloudcert-pro \
  -p 3000:3000 \
  -v cloudcert-data:/app/data \
  -e JWT_SECRET="your-secret-min-32-chars" \
  -e RESET_TOKEN_SECRET="your-reset-secret-min-32-chars" \
  -e NODE_ENV=production \
  -e SEED_ADMIN_EMAIL="admin@yourorg.com" \
  -e SEED_ADMIN_PASSWORD="StrongPassword123!" \
  cloudcert-pro:latest
```

> **Persistent storage:** Mount a named volume at `/app/data` to persist the SQLite database across container restarts. Without this, all data is lost when the container stops.

#### Health check

The container exposes a built-in Docker health check:
```
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3
  CMD wget -qO- http://localhost:3000/api/health
```

This is compatible with Kubernetes liveness and readiness probes.

### Required GitHub Secrets for CI

| Secret | Description |
|---|---|
| `JWT_SECRET` | Min 32 chars — used by the DAST job to start the server |
| `RESET_TOKEN_SECRET` | Min 32 chars — used by the DAST job |
| `NVD_API_KEY` | *(Optional but recommended)* — OWASP NVD API key to avoid rate-limiting |

---

## Security and Compliance

### Authentication and Authorization

- **JWT httpOnly cookies** — Tokens are never accessible to JavaScript (`httpOnly`) and restricted to same-site requests (`SameSite=Strict`). No localStorage token storage.
- **Dual-secret rotation** — Session and password-reset tokens use separate secrets (`JWT_SECRET` vs `RESET_TOKEN_SECRET`). Each can be rotated independently without invalidating the other.
- **Password hashing** — bcrypt with cost factor 12. Plaintext passwords are never logged or stored.
- **Fail-fast config** — The server refuses to start if `JWT_SECRET` or `RESET_TOKEN_SECRET` are missing or shorter than 32 characters.
- **Role-based access** — Admin routes (`/api/certifications POST/PATCH/DELETE`, domain weights, question management) are protected by `requireAdmin` middleware that validates the `role` claim in the JWT.

### HTTP Security Headers

Managed by `helmet` with environment-specific CSP:

| Header | Production value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; CDN allowlist for Swagger UI only |
| `X-Powered-By` | Removed entirely (not just suppressed) |
| `X-Frame-Options` | `DENY` (via `frameAncestors 'none'`) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | Set by helmet defaults |

### PII and Logging

- pino is configured to **redact** `password`, `token`, `secret`, `authorization`, and `cookie` fields from all log output. Sensitive values never appear in logs.
- Correlation IDs (UUID v4) are injected on every request and propagated in the response `X-Correlation-ID` header for request tracing.

### Dependency Security

| Layer | Tool | Threshold |
|---|---|---|
| npm advisories | `npm audit` | Fails on HIGH/CRITICAL |
| NVD CVE database | OWASP Dependency-Check | Fails on CVSS ≥ 7 |
| Secret history scan | TruffleHog | Fails on verified secrets |
| Static analysis | CodeQL (security-extended) | OWASP Top 10 + CWE Top 25 |
| Runtime headers | OWASP ZAP Baseline | Fails on HIGH risk findings |

### Rate Limiting

`express-rate-limit` is applied globally. `/api/health` and `/api-docs` endpoints are exempt from rate limiting.

### False Positive Suppression

OWASP Dependency-Check false positives are suppressed in `.dependency-check-suppressions.xml`. Add documented suppressions here with a comment explaining the rationale.

---

## Data Model

The SQLite database is managed by a schema-guard migration runner (v1–v11). Migrations are idempotent and run automatically on server startup.

### Core Tables

| Table | Description |
|---|---|
| `users` | Learner and admin accounts (email, bcrypt password, role, XP) |
| `certifications` | Certification catalogue (title, vendor, level, exam code, icon) |
| `exam_configurations` | Per-certification exam settings (duration, question count, pass score, strategy) |
| `topics` | Certification topic hierarchy (ordered, weighted) |
| `subtopics` | Sub-level of topics (ordered) |
| `questions` | MCQ question bank (single/multi-select, difficulty, options, correct answers, explanation) |
| `exam_sessions` | Exam attempt records (userId, certificationId, config, score, status, timestamps) |
| `exam_answers` | Per-question answers within a session |
| `question_history` | Aggregated per-user-per-question statistics (times seen, times correct, confidence) |
| `srs_items` | Spaced repetition scheduling records (due date, interval, easiness factor) |
| `study_plan_completions` | Tracks completed study plan items |
| `achievements` | Achievement definitions (name, description, XP reward, criteria) |
| `user_achievements` | Per-user unlocked achievements |
| `units` | Learning unit definitions associated with topics |

### Database File Location

| Environment | Path |
|---|---|
| Development | `./cloudcert.db` (project root) |
| Docker (production) | `/app/data/cloudcert.db` (mounted volume — see [Persistent storage](#deploying-with-docker)) |

> **Production note:** Update `src/server/db/connection.ts` or set a `DB_PATH` environment variable to point to the volume path before deploying to production.

---

## Contribution Guide

### Branching Strategy (GitFlow)

```
main          ← production releases only
  └── develop ← integration branch; all feature PRs target this
        └── feature/<ticket>-<short-desc>   (e.g. feature/CP-42-add-aws-certs)
        └── fix/<ticket>-<short-desc>        (e.g. fix/CP-101-auth-cookie-expiry)
        └── chore/<scope>-<short-desc>       (e.g. chore/update-deps)
```

- `main` is **protected** — no direct pushes. Merges via PR with at least 1 approving review.
- `develop` is the integration target for all feature branches.
- Branch names must match the pattern above for CI to trigger correctly.

### Commit Convention (Conventional Commits)

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]
[optional footer: BREAKING CHANGE or issue refs]
```

| Type | When to use |
|---|---|
| `feat` | New functionality (routes, components, hooks) |
| `fix` | Bug fixes |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, config, seed data) |
| `ci` | CI/CD pipeline changes |
| `docs` | Documentation only |
| `refactor` | Code restructuring without behaviour change |
| `perf` | Performance improvements |
| `style` | Formatting only (no logic change) |

**Examples:**
```bash
git commit -m "feat(server): add GCP ACE exam configuration"
git commit -m "fix(auth): prevent JWT secret leaking to logs"
git commit -m "test(service): add property tests for QuestionSelector"
git commit -m "docs: update README with Docker deployment steps"
```

### Pull Request Workflow

1. **Create branch** from `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/CP-99-your-feature
   ```
2. **Write tests first** — all new code must be accompanied by tests. Test files go in the same directory as the source file.
3. **Ensure all quality gates pass locally:**
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
4. **Push and open a PR** targeting `develop`. Fill in the PR description template.
5. **CI must be green** — all 8 jobs must pass before a review is requested.
6. **At least 1 approving review** required before merge.
7. **Squash merge** to `develop` to keep history linear.

### Coding Standards

- **Architecture**: Repository/Service/Controller/Validation separation is strict. Business logic belongs in services, not in route handlers. Database access belongs in repositories, not in services.
- **TypeScript**: Strict mode enabled. Avoid `any`. Use Zod for all request validation.
- **Tests**: Every new service method requires unit tests. Every new route requires an integration test. Property-based tests are preferred for data-transformation logic.
- **Logging**: Use the `logger` singleton (`import { logger } from '../logger'`). Never use `console.log` in production code paths.
- **Error handling**: Throw typed `AppError` subclasses (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`). Never throw raw `Error` from route handlers.
- **Secrets**: Never hardcode secrets. Never log secrets. Never commit `.env`.

### Adding Seed Data

When adding a new certification:
- All JSON files must pass the `seedData.test.ts` property-based tests.
- Topic weight percentages in `metadata.json` must sum to exactly 100.
- All `topicId`, `subtopicId`, and `unitId` foreign key references must resolve within the same certification's data.

---

## Support and SLA

| Channel | Details |
|---|---|
| **Bug reports** | Open a GitHub Issue with the `bug` label and include the `X-Correlation-ID` from the failing request |
| **Feature requests** | Open a GitHub Issue with the `enhancement` label |
| **Security vulnerabilities** | **Do not open public issues.** Email the maintainer directly or use GitHub's private vulnerability reporting |
| **CI failures** | Check the GitHub Actions tab — all jobs upload artifacts (coverage, SARIF, HTML reports) |

### Uptime Target

99.9% monthly uptime for production deployments. Incidents should be tracked with the `X-Correlation-ID` header, which is present on every API response for log correlation.

---

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 CloudCert Pro Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

### Acknowledgements

- [fast-check](https://github.com/dubzzz/fast-check) — Property-based testing framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Synchronous SQLite driver for Node.js
- [OWASP](https://owasp.org/) — Dependency-Check and ZAP security tools
- [Zod](https://zod.dev/) — TypeScript-first schema validation and OpenAPI generation
- [pino](https://getpino.io/) — Fast, structured JSON logging
- [Vite](https://vitejs.dev/) — Next-generation frontend build tool

---

*Generated from codebase analysis on 2026-05-30. Keep this document in sync with the codebase — update version references, environment variables, and API domains when they change.*
