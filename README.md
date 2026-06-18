# AI Medical Education Platform

A full-stack platform for teaching and assessing clinical reasoning, powered by
the **Google Gemini API** (with deterministic fallbacks so it runs without a key).
Students learn through AI virtual patients, clinical cases, tests and OSCE exams;
teachers author content and assignments; admins manage the whole system.

Built as a **pnpm + Turborepo monorepo**: Next.js 14 web app, NestJS API,
PostgreSQL (relational core) and MongoDB (flexible content).

---

## Features (7 modules)

| Module | What it does |
|--------|--------------|
| **1. Clinical Cases** | Teacher-authored cases by specialty/difficulty; hybrid storage (Postgres metadata + Mongo content); launchable as a virtual patient. |
| **2. Virtual Patient** | Streaming AI patient encounter — take a history, order exams, treat, diagnose; AI debrief + score. |
| **3. Tests** | 6 question types (single/multiple/image/ECG/radiology/case-based); timed sessions; auto-grading; explanations. |
| **4. Assignments** | Assign cases/tests to students or groups with deadlines; submissions; review + grade; deadline notifications. |
| **5. OSCE** | Objective Structured Clinical Examination: timed stations, examiner checklists, automatic scoring + AI debrief. Two modes — examiner-led (manual or AI checklist grading) and **student self-conduct** (chat with an AI patient on each station, AI auto-grades, auto-advances by timer, final debrief). |
| **6. AI Analytics** | Per-student errors-by-category (NLP-classified), diagnostic accuracy, decision speed, weak topics, progress, AI recommendations; teacher cohort dashboards + CSV export. |
| **7. Admin Panel** | User management (roles, blocking), system statistics, content moderation, audit-log viewer, backup management. |

Foundation: **Auth & Users** with JWT (access + rotating refresh), 4 roles
(Admin / Teacher / Student / Examiner), global RBAC, audit logging and scheduled
backups.

---

## Quick start (Docker — recommended)

Requires Docker + Docker Compose.

```bash
# 1. Configure environment
cp .env.example .env
#    (optional) edit .env — set a strong JWT_SECRET and your GEMINI_API_KEY

# 2. Build and start everything (postgres, mongo, api, web, nginx)
docker compose up -d --build
#    The API container applies database migrations automatically on start.

# 3. Seed demo data (4 accounts, 3 clinical cases, 10 questions, 1 OSCE exam)
docker compose exec api pnpm db:seed

# 4. Open the app
#    https://localhost   (accept the self-signed certificate warning)
```

The API runs behind nginx — there is a single public origin, `https://localhost`.
nginx terminates TLS (self-signed cert generated on first boot) and proxies
`/api` and `/uploads` to the API and everything else to the web app.

### Seeded accounts

All use the password **`Password123!`**:

| Role | Email |
|------|-------|
| Admin | `admin@med.local` |
| Teacher | `teacher@med.local` |
| Examiner | `examiner@med.local` |
| Student | `student@med.local` |

### Useful commands

```bash
docker compose logs -f api          # tail API logs
docker compose exec api pnpm db:seed   # (re)seed — idempotent
docker compose --profile tools up -d   # add Adminer (:8080) + mongo-express (:8081)
docker compose down                 # stop
docker compose down -v              # stop + wipe all data volumes
```

---

## Local development (without Docker)

Requires Node ≥ 20, pnpm 9, and local PostgreSQL + MongoDB instances.

```bash
pnpm install

# API env
cp apps/api/.env.example apps/api/.env   # point DATABASE_URL / MONGODB_URI at your DBs

pnpm --filter @med/api db:deploy         # apply migrations
pnpm --filter @med/api db:seed           # seed demo data

pnpm dev                                 # runs web (:3000) + api (:4000) via Turborepo
```

For non-Docker dev set `NEXT_PUBLIC_API_URL=http://localhost:4000` (in
`apps/web/.env`) so the browser reaches the API directly.

- Web: http://localhost:3000
- API: http://localhost:4000/api
- Swagger API docs: http://localhost:4000/api/docs

### Monorepo scripts

```bash
pnpm build       # turbo build (shared → ui → api/web)
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint
pnpm test
```

---

## Architecture

```
medicineProject/
├─ apps/
│  ├─ api/        NestJS API (Prisma + Mongoose), Dockerfile, prisma/ (schema, migrations, seed)
│  └─ web/        Next.js 14 App Router, Dockerfile
├─ packages/
│  ├─ shared/     framework-agnostic types + constants (@med/shared)
│  └─ ui/         shared React components (@med/ui)
├─ infra/nginx/   reverse proxy: TLS termination + routing
├─ docker-compose.yml
└─ .env.example
```

**Data stores**
- **PostgreSQL** (Prisma) — users, refresh tokens, audit logs, case/test/OSCE
  metadata, questions, sessions, assignments, submissions, notifications.
- **MongoDB** (Mongoose) — clinical-case content and virtual-patient session
  state. Cross-store references link the two (`contentId` / `metaId`).

**Request flow**

```
Browser ──HTTPS──> nginx ──┬─ /api, /uploads ─> API (:4000) ─┬─ PostgreSQL
                           │                                 └─ MongoDB
                           └─ /                ─> Web (:3000)
```

---

## Security

- **JWT access + refresh** — short-lived access tokens (15m) and opaque refresh
  tokens (SHA-256 hashed at rest). Refresh tokens **rotate on every use**; reuse
  of a revoked token is treated as theft and **kills the whole token family**.
- **RBAC** — a global `JwtAuthGuard` (opt out with `@Public()`) plus a global
  `RolesGuard` (`@Roles(...)`) protect every route. The `/admin` area is
  Admin-only on both the API and the web client.
- **Audit log** — middleware records every request (user, method, path, status,
  IP) to PostgreSQL; viewable/filterable in the Admin panel.
- **HTTPS** — terminated at nginx (TLS 1.2/1.3 + HSTS). The API can additionally
  reject non-TLS traffic (`FORCE_HTTPS=true`) using the forwarded proto.
- **Backups** — scheduled `pg_dump` (config-driven cron) with retention pruning;
  run-now / list / delete from the Admin panel.

---

## Environment variables

All variables are documented in **[`.env.example`](.env.example)** (Docker /
compose) and **`apps/api/.env.example`** (API for local dev). Highlights:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing secret — **set a long random value in production**. |
| `GEMINI_API_KEY` | Google Generative Language API key (optional; blank → fallbacks). |
| `DATABASE_URL` / `MONGODB_URI` | Postgres / Mongo connection strings. |
| `FORCE_HTTPS` | Reject non-TLS API requests (use `true` in production). |
| `AUDIT_ENABLED` | Toggle audit logging (default `true`). |
| `BACKUP_ENABLED` / `BACKUP_CRON` | Scheduled `pg_dump` backups. |
| `NEXT_PUBLIC_API_URL` | Web → API base; blank = same-origin via nginx. |

---

## Notes

- **TLS certificate** — the bundled cert is **self-signed** for local use; your
  browser will warn on first visit. Mount a real certificate into the
  `nginx_certs` volume (`/etc/nginx/certs/server.{crt,key}`) for production.
- **Without a Gemini key** every AI feature degrades gracefully to a
  deterministic heuristic (case generation, virtual-patient replies, grading,
  error classification, recommendations) so the MVP is fully demonstrable
  offline.
- **UI language** — the web interface is in **Russian**; the codebase, API and
  docs are in English.
- **For educational use only — not a substitute for clinical judgment.**
