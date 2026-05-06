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
$env:ENCRYPTION_SECRET = "interviewcoach-local-smoke-encryption-secret-32plus"
$env:GEMINI_API_KEY = "<real key for AI surfaces, or a placeholder for auth-only smoke>"
```

SMTP variables are required only if the smoke includes actual email delivery.
`ENCRYPTION_SECRET` is required before invite creation because candidate invite tokens are encrypted into session intake metadata. The value above is local-only and disposable; do not use it outside the smoke container.

For real local email smoke, also set the Office365 SMTP values in the server process:

```powershell
$env:SMTP_HOST = "smtp.office365.com"
$env:SMTP_PORT = "587"
$env:SMTP_USERNAME = "<mailbox>"
$env:SMTP_PASSWORD = "<password>"
$env:SMTP_FROM_EMAIL = "<from address>"
$env:SMOKE_EMAIL_RECIPIENT = "<recipient for test emails>"
```

`SMOKE_EMAIL_RECIPIENT` is optional. If omitted, `npm run postgres:smoke:email` sends to `SMTP_USERNAME`.

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

- Recruiter login and invite creation work through the app route stack.
- Questions are persisted to Postgres.
- Candidate link opens through `/s/[token]`.
- Candidate can start practice and submit an answer.
- Session, question, answer, eval, token, idempotency, rate-limit, metric, and AI-generation rows are visible in the smoke DB.

Repeatable command after the app is running on port `3100` with the env values above:

```powershell
npm run postgres:smoke:product
```

Current result as of May 6, 2026:

- `npm run postgres:smoke:product`: passed against `http://127.0.0.1:3100`.
- Recruiter login succeeded for `fu@rangam.com`.
- Invite batch `7b89aa1e-6c67-4fa3-a3b9-e994f5e420aa` completed with candidate session `019dfd3f-9937-7ea5-94c0-cdec2204b61e`.
- Candidate link opened through `/s/[token]`.
- Candidate session fetched, initials submitted, session started, draft saved, answer submitted, and answer analysis completed.
- Verified Postgres rows: 3 questions, 1 answer, 1 eval result, 1 active candidate token, 2 idempotency rows for the candidate session, rate-limit rows, metric counter rows, and 1 AI-generation row for the session.

This script does not send email. Actual invite/debrief email delivery remains a separate SMTP smoke because `/api/invite/send` expects a provider acceptance result before it marks invitations sent.

### Level 3 - AI And QA Explorer

Done when:

- Gemini-backed question generation, answer feedback, hints, strong response, and session debrief run locally.
- `ai_generations` rows are written to Postgres.
- `/qa/ai-quality` reads the smoke DB records.

Repeatable command after the app is running on port `3100` with the env values above and a real `GEMINI_API_KEY`:

```powershell
npm run postgres:smoke:ai
```

Current result as of May 6, 2026:

- `npm run postgres:smoke:ai`: passed against `http://127.0.0.1:3100`.
- Recruiter login succeeded for `fu@rangam.com`.
- Gemini-backed question generation created a successful `question_generation` row.
- Postgres-backed invite batch `e60b2d5f-5658-4770-87db-2fcd9e1a99a0` completed with candidate session `019dfd4c-6a06-7ceb-8706-7dbea5062d10`.
- Candidate link opened through `/s/[token]`.
- Gemini-backed hints, strong response, answer feedback, and session debrief all completed.
- Verified successful `ai_generations` rows for `question_generation`, `hint`, `strong_response`, `answer_feedback`, and `session_debrief`, all with `model_provider = gemini` and `model_name = gemini-2.5-flash`.
- `/qa/ai-quality` returned `200`; `/qa/ai-quality/export?format=json&status=success&limit=100` returned `200` with records.

The Level 2 script can run without `GEMINI_API_KEY`; answer analysis will use the app's local mock fallback and still exercises the Postgres `ai_generations` write path. Level 3 requires a real `GEMINI_API_KEY`; actual email delivery also requires valid `SMTP_*` values.

### Level 4 - Real SMTP Email

Done when:

- `/api/invite/send` sends an initial invite through the configured SMTP provider.
- The provider returns a message id and accepted-recipient response.
- The session row has `invitation_sent_at`.
- Completing a candidate session sends the debrief email through the same SMTP provider.
- The session row has `summary_narrative` and `intake_json.summary_expires_at`, proving the debrief send returned provider acceptance.

Repeatable command after the app is running on port `3100` with the Postgres env values and real SMTP env values:

```powershell
npm run postgres:smoke:email
```

This smoke sends real email. It defaults the recipient to `SMTP_USERNAME` unless `SMOKE_EMAIL_RECIPIENT` is set.

Current result as of May 6, 2026:

- `npm run postgres:smoke:email`: passed against `http://127.0.0.1:3100` with Office365 SMTP env values loaded from local development configuration.
- The intentional smoke recipient was `fusbox@gmail.com`.
- Recruiter login succeeded for `fu@rangam.com`.
- Invite batch `eb13a647-e9cf-48d1-ac84-632c8427491a` completed with candidate session `019dfd58-d217-7f2d-876c-1fa6178a88b8`.
- `/api/invite/send` returned provider message id `<4ebd8382-3e15-bf17-d17e-e02e5d5bf234@coach.rangam.com>`.
- Verified `sessions.invitation_sent_at` was set.
- Candidate session opened, initials submitted, practice started, one answer submitted, answer analysis completed, and session completion generated the debrief.
- Verified `summary_narrative` and `intake_json.summary_expires_at` were persisted after debrief email provider acceptance.
- Verified Postgres metrics included successful `invite_send_total` and `session_completion_total` rows.

## Final Handoff Language

If Level 1-4 pass locally, we can say:

> The migration branch is functional against a disposable plain Postgres database using app-owned auth, Postgres-backed repositories, Gemini-backed AI surfaces, and real SMTP invite/debrief delivery. Remaining work is target-environment integration: final AWS hosting shape, managed Postgres endpoint and credentials, network/TLS policy, secret store, least-privilege DB user, production URL, and deployment validation.
