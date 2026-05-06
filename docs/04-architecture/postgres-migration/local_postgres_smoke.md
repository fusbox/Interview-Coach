# Local Postgres Smoke

## Purpose

Use this runbook to prove the migration branch is functional against a disposable plain Postgres database before the final company AWS/database/deployment details are available.

This proves the branch as built. It does not prove the final hosted environment, network path, managed DB privileges, TLS policy, secret store, SMTP policy, or production URL.

## Smoke DB

The local smoke database is a disposable Docker container with known local-only credentials:

| Item | Value |
| --- | --- |
| Container | `interviewcoach-postgres-smoke` |
| Image | `ankane/pgvector:latest` |
| Host port | `5434` |
| Database | `interviewcoach_smoke` |
| User | `postgres` |
| Password | `interviewcoach-local-smoke-password` |

The connection string is:

```text
postgresql://postgres:interviewcoach-local-smoke-password@127.0.0.1:5434/interviewcoach_smoke
```

These credentials are intentionally local and disposable. Do not use them outside the local smoke container.

## One-Time Setup

```powershell
npm run postgres:smoke:start
npm run db:apply-schema
npm run db:smoke-schema
```

What this does:

- Starts or creates the disposable Docker Postgres container.
- Applies `db/migrations/001_initial_schema.sql`.
- Runs `db/validation/001_initial_schema_smoke.sql` inside a rollback transaction.

## Provision A Smoke User

```powershell
$env:APP_USER_PASSWORD = "interviewcoach-local-user-password"
npm run auth:provision-user -- --smoke-defaults --email fu@rangam.com --roles recruiter,admin,qa --first-name Fu --last-name Box --timezone America/Chicago
```

This creates a Postgres-backed app user with recruiter, admin, and QA roles. The provisioner is idempotent for the same email.

## App Env For Local Smoke

Use these env values when starting the app against the smoke DB:

```powershell
$env:DATABASE_URL = "postgresql://postgres:interviewcoach-local-smoke-password@127.0.0.1:5434/interviewcoach_smoke"
$env:APP_AUTH_BACKEND = "postgres"
$env:SESSION_REPOSITORY_BACKEND = "postgres"
$env:INVITE_REPOSITORY_BACKEND = "postgres"
$env:TEMPLATE_REPOSITORY_BACKEND = "postgres"
$env:FEEDBACK_REPOSITORY_BACKEND = "postgres"
$env:AI_GENERATION_REPOSITORY_BACKEND = "postgres"
$env:CANDIDATE_TOKEN_BACKEND = "postgres"
$env:IDEMPOTENCY_BACKEND = "postgres"
$env:RATE_LIMIT_BACKEND = "postgres"
$env:METRICS_BACKEND = "postgres"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:3000"
$env:GEMINI_API_KEY = "<real key for AI surfaces, or a placeholder for auth-only smoke>"
```

SMTP variables are required only if the smoke includes actual email delivery.

## Smoke Levels

### Level 1 - Database And Auth

Done when:

- Smoke DB starts.
- Schema applies.
- Rollback schema smoke passes.
- App user provisions.
- `/api/auth/login` accepts the provisioned user.
- Authenticated recruiter/admin/QA pages do not redirect to login.

Current result as of May 6, 2026:

- `npm run postgres:smoke:start`: passed.
- `npm run db:apply-schema`: passed.
- `npm run db:smoke-schema`: passed.
- `npm run auth:provision-user -- --smoke-defaults ...`: passed for `fu@rangam.com`.
- Local HTTP smoke on `http://localhost:3100`: `/api/auth/login`, `/recruiter`, `/qa/ai-quality`, and `/admin/feedback` all returned `200`.

### Level 2 - Recruiter And Candidate Data Flow

Done when:

- Recruiter can create an invite through the visible UI.
- Questions are persisted to Postgres.
- Candidate link opens through `/s/[token]`.
- Candidate can start practice and submit an answer.
- Session, question, answer, eval, token, idempotency, rate-limit, and metric rows are visible in the smoke DB.

### Level 3 - AI And QA Explorer

Done when:

- Gemini-backed question generation, answer feedback, hints, strong response, and session debrief run locally.
- `ai_generations` rows are written to Postgres.
- `/qa/ai-quality` reads the smoke DB records.

Level 2 and Level 3 require a real `GEMINI_API_KEY`; actual email delivery also requires valid `SMTP_*` values.

## Final Handoff Language

If Level 1-3 pass locally, we can say:

> The migration branch is functional against a disposable plain Postgres database using app-owned auth and Postgres-backed repositories. Remaining work is target-environment integration: final AWS hosting shape, managed Postgres endpoint and credentials, network/TLS policy, secret store, least-privilege DB user, SMTP policy, production URL, and deployment validation.
