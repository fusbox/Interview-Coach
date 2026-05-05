# Target Runtime Facts

## Purpose

This document captures the runtime facts needed before the Postgres migration can be validated in the company environment. It separates facts confirmed from this branch, current working assumptions, and open confirmations for the integration/infra team.

Scope of this pass:

- Worktree: `C:\tmp\Interview-Coach-Recruiter-postgres`
- Branch: `feature/postgres-integration`
- Branch head during review: `5668696 bypass replay tour gate for 1 user`
- Date: 2026-05-04

## Current Classification

| Category | Status | Summary |
| --- | --- | --- |
| Production host | Working assumption | `https://interviewcoach.talentarbor.com` |
| Staging/UAT host | Open | Needs integration-team answer |
| Deployment platform | Open | Repo is Next.js and Azure branch exists, but target hosting shape is not confirmed |
| Node version | Confirmed for GitHub CI, open for deployment | GitHub quality workflow uses Node 22; target deployment Node runtime still needs confirmation |
| Build/start commands | Confirmed from repo | `npm ci`, `npm run build`, `npm run start` |
| Database connectivity | Working approach | Support `DATABASE_URL` and individual `POSTGRES_*`, preferring `DATABASE_URL` |
| Auth approach | Working decision | App-owned email/password auth backed by Postgres for recruiter/admin users |
| Candidate access | Working decision | Keep token-link access at `/s/[token]`, backed by Postgres token storage |
| Email provider | Drifted by branch | This Azure branch still uses Resend; current mainline work has moved to SMTP/Microsoft mail |
| Logs/DB inspection | Open | Needs integration-team answer |
| Secret store | Open | Needs deployment owner answer |

## Confirmed From This Branch

| Fact | Evidence | Notes |
| --- | --- | --- |
| Framework | `package.json`: `next ^15.5.13`, `react ^18.2.0`, TypeScript | Next App Router app. |
| Build command | `package.json`: `npm run build` -> `next build` | Use this for deployment build unless platform wraps it. |
| Start command | `package.json`: `npm run start` -> `next start` | Requires production build first. |
| Local dev command | `package.json`: `npm run dev` -> `next dev -H 0.0.0.0` | README says local opens at `http://localhost:3000`. |
| Dependency install | `.github/workflows/quality-gates.yml`: `npm ci` | Use lockfile install for CI/deploy. |
| CI Node version | `.github/workflows/quality-gates.yml`: `node-version: 22` | Target deployment should confirm Node 22 or a compatible LTS runtime. |
| Quality commands | `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run test:stability` | GitHub workflow runs all four. |
| Public origin requirement | `src/lib/server/url/get-app-origin.ts` | In production, `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_BASE_URL` must be set or URL generation throws. |
| Current default public origin | `src/lib/config/public-app-origin.ts` | Defaults to `https://coach.rangam.com` outside production when no env/request origin exists. This should not be relied on for migrated production. |
| Current email implementation in this branch | `src/lib/server/services/email-service.ts` | Uses Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). This is stale relative to recent SMTP/Microsoft mail work and must be reconciled before migration completion. |
| Current auth/data provider | `README.md`, `src/lib/supabase/*`, `package.json` | Still Supabase in this branch baseline. |
| Current DB package readiness | `package.json` | `pg` and `@types/pg` are already installed. |
| Docker/container config | repo scan | No `Dockerfile` found in this branch. |
| Vercel config | repo scan | No `vercel.json` found in this branch. |

## Working Target Values

| Runtime item | Working target | Confidence | Notes |
| --- | --- | --- | --- |
| Production URL | `https://interviewcoach.talentarbor.com` | Medium | User-provided working assumption. Needs final DNS/deployment confirmation. |
| Candidate URL shape | `https://interviewcoach.talentarbor.com/s/[token]` | Medium-high | Preserves current candidate entry model. |
| Public origin env | `NEXT_PUBLIC_APP_URL=https://interviewcoach.talentarbor.com` | Medium-high | Existing code already supports this. |
| DB env input | `DATABASE_URL` preferred, `POSTGRES_*` fallback | Medium-high | Matches handoff values and gives integration flexibility. |
| Auth | App-owned email/password | Medium-high | Product decision made for phase 1; implementation details remain. |
| Session storage | Postgres-backed app sessions | Medium-high | Needed to replace Supabase SSR cookies. |
| Email | Microsoft/Office365 SMTP | Medium | Confirmed in current mainline discussion, but this Azure branch still has Resend code. Reconcile branch before final runtime validation. |
| AI provider | Google Gemini | High | Existing app uses `GEMINI_API_KEY` and Google GenAI SDK. |
| Runtime install/build | `npm ci`, `npm run build`, `npm run start` | High | Confirmed by package scripts and GitHub workflow. |

## Target Environment Variables

This is the expected direction after Supabase removal. Names may be adjusted during implementation.

| Env var | Required? | Purpose | Status |
| --- | --- | --- | --- |
| `DATABASE_URL` | Preferred | Full Postgres connection string | Open confirmation |
| `POSTGRES_HOST` | Fallback | Host for composed Postgres connection | Open confirmation |
| `POSTGRES_PORT` | Fallback | Port, expected default `5432` | Open confirmation |
| `POSTGRES_USER` | Fallback | DB username | Open confirmation |
| `POSTGRES_PASSWORD` | Fallback | DB password | Open confirmation |
| `POSTGRES_DB` | Fallback | DB name | Open confirmation |
| `NEXT_PUBLIC_APP_URL` | Required in production | Canonical public origin for invite/debrief links | Working target |
| `APP_SESSION_SECRET` | Not currently required | Earlier placeholder for signed cookies/tokens. Current app-auth foundation uses random opaque session tokens hashed at rest, so there is no signing secret in this first implementation. | Revisit only if signed stateless tokens are introduced |
| `AUTH_COOKIE_NAME` | Optional | Explicit app session cookie name. Defaults to `ic_app_session`. | Added |
| `APP_SESSION_TTL_SECONDS` | Optional | App-owned recruiter session lifetime in seconds. Defaults to 8 hours. | Added |
| `GEMINI_API_KEY` | Required for production AI | Question generation, feedback, hints, strong response, debrief | Existing |
| `SMTP_HOST` | Required after SMTP reconciliation | Microsoft/enterprise SMTP host | To reconcile from mainline |
| `SMTP_PORT` | Required after SMTP reconciliation | Expected `587` | To reconcile from mainline |
| `SMTP_USERNAME` | Required after SMTP reconciliation | SMTP auth user | To reconcile from mainline |
| `SMTP_PASSWORD` | Required after SMTP reconciliation | SMTP secret | To reconcile from mainline |
| `SMTP_FROM_EMAIL` | Required after SMTP reconciliation | Verified sender | To reconcile from mainline |
| `APP_AUTH_BACKEND` | Optional during migration | Selects recruiter/admin auth lookup: `supabase` default or `postgres` for app-owned auth/session cookies. | Added |
| `SESSION_REPOSITORY_BACKEND` | Optional during migration | Selects session repository implementation: `supabase` default or `postgres` for migration validation. | Added |
| `INVITE_REPOSITORY_BACKEND` | Optional during migration | Selects invite repository implementation: `supabase` default or `postgres` for migration validation. | Added |
| `TEMPLATE_REPOSITORY_BACKEND` | Optional during migration | Selects recruiter template repository implementation: `supabase` default or `postgres` for migration validation. | Added |
| `FEEDBACK_REPOSITORY_BACKEND` | Optional during migration | Selects app feedback repository implementation: `supabase` default or `postgres` for migration validation. | Added |
| `AI_GENERATION_REPOSITORY_BACKEND` | Optional during migration | Selects AI-quality generation write/read repository implementation: `supabase` default or `postgres` for migration validation. | Added |
| `CANDIDATE_TOKEN_BACKEND` | Optional during migration | Selects candidate token implementation: `supabase` default or `postgres` for migration validation. | Added |
| `IDEMPOTENCY_BACKEND` | Optional during migration | Selects idempotency store implementation: `supabase` default or `postgres` for migration validation. | Added |
| `RATE_LIMIT_BACKEND` | Required in production | Supported values during migration: `memory`, `supabase`, `postgres`. `postgres` is implemented and should be pinned in migrated environments; `memory` must not be used in production. | Postgres backend added |
| `METRICS_BACKEND` | Required in production | Supported values during migration: `memory`, `supabase`, `postgres`. `postgres` is implemented and should be pinned in migrated environments; `memory` must not be used in production. | Postgres backend added |

Supabase env vars to remove after migration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Resend env vars to remove after SMTP reconciliation:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Open Integration Questions

These need answers from the deployment/integration/infra side before environment validation can be complete.

1. What deployment platform will host `interviewcoach.talentarbor.com`?
2. What staging or UAT URL should be used before production cutover?
3. Is Node 22 available/approved in the target deployment runtime?
4. Should deployment use `npm ci`, `npm run build`, and `npm run start`, or does the platform have a different command contract?
5. Where are environment variables/secrets stored, and who can update them?
6. Can the app runtime reach Postgres over TCP, and are firewall/IP allowlists needed?
7. Is TLS required for Postgres connections, and if so, what certificate/SSL mode is expected?
8. What is the final env contract: `DATABASE_URL`, individual `POSTGRES_*`, or both?
9. Who provides the final least-privilege app DB user?
10. Who can inspect target DB records during validation?
11. Where are application/API logs available, and who can view them?
12. What rollback mechanism exists for app deployment and DB migrations?
13. Should recruiter/admin users be self-signup, admin-provisioned, or pre-seeded for phase 1?
14. Are password complexity, password expiration, MFA, audit logging, or account lockout policies required?
15. Should Microsoft SMTP be used in this Azure branch too, replacing Resend before DB/auth migration continues?

## Runtime Validation Checklist

| Status | Check | Evidence needed |
| --- | --- | --- |
| [ ] | Target deployment URL resolves | Browser loads deployed app at target/staging host. |
| [ ] | Public origin configured | Invite links generated with the expected host. |
| [ ] | Postgres connection succeeds | Health/diagnostic endpoint or startup log confirms DB connectivity without exposing secrets. |
| [ ] | DB migrations applied | Schema version or table/function inventory confirmed in target DB. |
| [ ] | App auth works | Recruiter can log in, session persists, logout invalidates session. |
| [ ] | Candidate token access works | `/s/[token]` opens and candidate APIs validate token/session correctly. |
| [ ] | Email sends | Invite and debrief email deliver through the company mail system. |
| [ ] | AI works | Gemini-backed surfaces work with `GEMINI_API_KEY`. |
| [ ] | Logs visible | Integration team can retrieve errors with timestamp/request context. |
| [ ] | DB writes visible | Integration team can confirm session/invite/answer/auth records in target Postgres. |
| [ ] | Quality gates pass | `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run test:stability`. |

## Local Disposable DB Validation Option

ChatArbor's local setup uses a Docker container named `chatarbor-postgres` based on the `ankane/pgvector:latest` image. That image is a reasonable validation starting point because it is plain Postgres with the `vector` extension available, and it appears to match a pattern already used in another Rangam AI project.

Do not reuse the existing `chatarbor-postgres` container for Interview Coach validation. It has a persistent Docker volume mounted to `/var/lib/postgresql/data`, is tied to ChatArbor's Django app/database, and should be treated as project data rather than disposable test infrastructure.

Preferred local validation approach:

1. Create a new Interview Coach-specific container from `ankane/pgvector:latest` or an agreed Postgres version.
2. Use a separate container name, volume, DB name, and host port, for example port `5433`.
3. Run `db/migrations/001_initial_schema.sql` against that disposable DB.
4. Keep the container disposable until the migration is validated and the target company DB contract is confirmed.

Validation result as of May 5, 2026:

- Container: `interviewcoach-postgres-test`
- Image: `ankane/pgvector:latest`
- PostgreSQL version reported by container: `15.4`
- Host port: `5433`
- Database: `interviewcoach_test`
- Migration result: `db/migrations/001_initial_schema.sql` applied successfully.
- Idempotency result: migration reran successfully against the already-created schema; only expected `already exists` notices appeared.
- Smoke result: `db/validation/001_initial_schema_smoke.sql` passed and rolled back, leaving no smoke rows in checked tables.
- AI-quality revalidation result: after porting generation capture on May 5, 2026, the updated schema reapplied successfully and the smoke validation passed with `get_ai_generation_summary()` included.

## Notes For Roadmap

- The target runtime facts are now partially confirmed, but the checklist item should remain open until staging/UAT URL, deployment platform, secret store, logs, DB inspection path, and final DB env/user contract are answered.
- The Postgres client/config layer can still proceed before those answers by supporting both connection-string and split-env formats.
- Email drift should be reconciled early: this branch uses Resend, while current working app has moved to SMTP/Microsoft mail.
