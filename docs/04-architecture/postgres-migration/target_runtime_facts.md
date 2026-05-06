# Target Runtime Facts

## Purpose

This document captures the runtime facts needed before the Postgres migration can be validated in the company environment. It separates facts confirmed from this branch, current working assumptions, and open confirmations for the integration/infra team.

For the code-review and deployment-facing summary, start with [postgres_migration_handoff.md](./postgres_migration_handoff.md). This file remains the runtime/env appendix.

Scope of this pass:

- Worktree: `C:\tmp\Interview-Coach-Recruiter-postgres`
- Branch: `feature/postgres-integration`
- Branch head during review before this handoff slice: `4cc0c63 docs update target identity handoff`
- Date: 2026-05-06

## Current Classification

| Category | Status | Summary |
| --- | --- | --- |
| Production host | Working assumption | `https://interviewcoach.talentarbor.com` |
| Staging/UAT host | Open | Needs integration-team answer |
| Deployment platform | Open | Repo is Next.js and Azure branch exists, but target hosting shape is not confirmed |
| Node version | Confirmed for GitHub CI, open for deployment | GitHub quality workflow uses Node 22; target deployment Node runtime still needs confirmation |
| Build/start commands | Confirmed from repo | `npm ci`, `npm run build`, `npm run start` |
| Database connectivity | Working approach | Support `DATABASE_URL` and individual `POSTGRES_*`, preferring `DATABASE_URL` |
| Auth approach | Updated working direction | Target deployment should use ATS-launched enterprise identity handoff, potentially Okta or equivalent. App-owned Postgres auth remains the local/UAT bridge and Supabase-removal proof. |
| Account provisioning | Local/UAT bridge | Operator/developer provisioning with `npm run auth:provision-user`; target production user lifecycle should be owned upstream by ATS/enterprise identity. |
| SQL functions/procedures | Working assumption | Target DB can accept/run SQL queries, functions, and stored-procedure-style logic |
| Candidate access | Working decision | Keep token-link access at `/s/[token]`, backed by Postgres token storage |
| Email provider | Implemented in branch, target config open | Branch uses SMTP/nodemailer. Target should use Microsoft/Office365 SMTP with explicit SMTP env values. |
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
| Current email implementation in this branch | `src/lib/server/services/email-service.ts`, `package.json` | Uses `nodemailer` with `SMTP_*` env vars. `SMTP_USERNAME` and `SMTP_PASSWORD` are production-required; `SMTP_HOST` currently defaults to AWS SES if omitted, so Microsoft/Office365 deployments must set it explicitly. |
| Current auth/data provider | Postgres repositories plus app-owned auth/session bridge | Runtime Supabase fallback has been removed. App-owned auth proves Supabase Auth can be removed for local/UAT; target production identity should be ATS/Okta or equivalent. |
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
| Auth | ATS-launched enterprise identity handoff | Medium | Updated May 6, 2026. Internal users are expected to launch from the ATS, likely with Okta or equivalent identity passed through by an integration-owned service. |
| Session storage | Postgres-backed app sessions or equivalent server session | Medium-high | Needed to replace Supabase SSR cookies. Current app-auth session storage proves the app can run without Supabase; final session creation may come from ATS/Okta rather than password login. |
| Email | Microsoft/Office365 SMTP | Medium-high | Branch supports SMTP now. Confirm final host/port/from identity and that SMTP auth is enabled for the sender mailbox. |
| AI provider | Google Gemini | High | Existing app uses `GEMINI_API_KEY` and Google GenAI SDK. |
| Runtime install/build | `npm ci`, `npm run build`, `npm run start` | High | Confirmed by package scripts and GitHub workflow. |

## Target Environment Variables

This is the migrated runtime contract after Supabase removal. Names may still be adjusted by the integration team during target deployment.

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
| `ENCRYPTION_SECRET` | Required for encrypted-at-rest invite token metadata | Candidate invite tokens are encrypted into session intake metadata. Must be stable per environment and at least 32 characters. | Existing, now explicit in local smoke |
| `GEMINI_API_KEY` | Required for production AI | Question generation, feedback, hints, strong response, debrief | Existing |
| `SMTP_HOST` | Required for target Microsoft SMTP | Microsoft/enterprise SMTP host | Branch default is AWS SES, so set explicitly for company deployment |
| `SMTP_PORT` | Required for target Microsoft SMTP | Expected `587` | Branch supports configurable port |
| `SMTP_USERNAME` | Required in production | SMTP auth user | Branch fails fast in production if missing |
| `SMTP_PASSWORD` | Required in production | SMTP secret | Branch fails fast in production if missing |
| `SMTP_FROM_EMAIL` | Required for target sender identity | Verified sender | Set explicitly to avoid relying on fallback sender |
| `APP_AUTH_BACKEND` | Optional | Postgres-only guardrail for app-owned auth/session cookies. A future value or adapter may be needed for ATS/Okta identity handoff. | Runtime accepts `postgres` only |
| `SESSION_REPOSITORY_BACKEND` | Optional | Postgres-only guardrail for session repository implementation. | Runtime accepts `postgres` only |
| `INVITE_REPOSITORY_BACKEND` | Optional | Postgres-only guardrail for invite repository implementation. | Runtime accepts `postgres` only |
| `TEMPLATE_REPOSITORY_BACKEND` | Optional | Postgres-only guardrail for recruiter template repository implementation. | Runtime accepts `postgres` only |
| `FEEDBACK_REPOSITORY_BACKEND` | Optional | Postgres-only guardrail for app feedback repository implementation. | Runtime accepts `postgres` only |
| `AI_GENERATION_REPOSITORY_BACKEND` | Optional | Postgres-only guardrail for AI-quality generation write/read repository implementation. | Runtime accepts `postgres` only |
| `CANDIDATE_TOKEN_BACKEND` | Optional | Postgres-only guardrail for candidate token implementation. | Runtime accepts `postgres` only |
| `IDEMPOTENCY_BACKEND` | Optional | Postgres-only guardrail for idempotency store implementation. | Runtime accepts `postgres` only |
| `RATE_LIMIT_BACKEND` | Required in production | Supported values: `memory` for local/test or `postgres` for durable runtime. Production defaults to `postgres`; `memory` is rejected in production. | Supabase value removed |
| `METRICS_BACKEND` | Required in production | Supported values: `memory` for local/test or `postgres` for durable runtime. Production defaults to `postgres`; `memory` is rejected in production. | Supabase value removed |
| `APP_USER_PASSWORD` | Provisioning only | One-time shell variable consumed by `npm run auth:provision-user`; do not store as a persistent deployment secret. | Added |

Supabase env vars are no longer part of the migrated runtime contract:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Resend provider env vars are no longer expected for this branch. Any remaining "resend" names in code refer to the product action of resending an invite, not the Resend email vendor.

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
13. What is the ATS launch contract: URL, request method, identity token format, trusted issuer, signing/validation keys, required claims, and replay protection?
14. How should ATS/Okta groups or claims map to recruiter/admin/QA roles?
15. Should standalone login/create-account/settings-profile/logout UI be disabled immediately in target deployment, hidden behind a local/UAT flag, or removed after integration validates the ATS launch path?
16. What are the final Microsoft/Office365 SMTP host, port, sender format, and SMTP-auth policy for `interviews@coach.rangam.com`?

## Runtime Validation Checklist

| Status | Check | Evidence needed |
| --- | --- | --- |
| [ ] | Target deployment URL resolves | Browser loads deployed app at target/staging host. |
| [ ] | Public origin configured | Invite links generated with the expected host. |
| [ ] | Postgres connection succeeds | Health/diagnostic endpoint or startup log confirms DB connectivity without exposing secrets. |
| [ ] | DB migrations applied | Schema version or table/function inventory confirmed in target DB. |
| [ ] | Internal auth works | For local/UAT, provision user with `npm run auth:provision-user`; recruiter can log in, session persists, logout invalidates session. For target deployment, ATS/Okta launch creates an authenticated app session and lands the user on `/recruiter/create`. |
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

- Earlier schema-validation container: `interviewcoach-postgres-test`
- Repeatable local smoke container: `interviewcoach-postgres-smoke`
- Image: `ankane/pgvector:latest`
- Host port: `5434` for the repeatable smoke container
- Database: `interviewcoach_smoke`
- Migration result: `db/migrations/001_initial_schema.sql` applied successfully.
- Idempotency result: migration reran successfully against the already-created schema; only expected `already exists` notices appeared.
- Smoke result: `db/validation/001_initial_schema_smoke.sql` passed and rolled back, leaving no smoke rows in checked tables.
- AI-quality revalidation result: after porting generation capture on May 5, 2026, the updated schema reapplied successfully and the smoke validation passed with `get_ai_generation_summary()` included.
- App-user provisioning validation: `fu@rangam.com` provisioned successfully into `interviewcoach-postgres-smoke` on May 6, 2026 with recruiter/admin/QA roles.
- HTTP app-auth smoke: local Next dev server on port `3100` returned `200` for `/api/auth/login`, `/recruiter`, `/qa/ai-quality`, and `/admin/feedback` using the smoke DB and Postgres backend selectors.
- Product-flow smoke: `npm run postgres:smoke:product` passed against `http://127.0.0.1:3100` on May 6, 2026 after starting the app with a local-only `ENCRYPTION_SECRET`. The script logged in, created a Postgres-backed invite batch, opened `/s/[token]`, fetched the candidate session, submitted initials, started practice, saved a draft, submitted one answer, ran answer analysis through the local mock fallback, and verified Postgres rows for questions, answer, eval result, candidate token, idempotency, rate-limit, metrics, and `ai_generations`.
- AI-surface smoke: `npm run postgres:smoke:ai` passed against `http://127.0.0.1:3100` on May 6, 2026 after starting the app with a real `GEMINI_API_KEY`. The script logged in, generated recruiter questions, created a Postgres-backed invite, opened `/s/[token]`, generated hints and a strong response, submitted/analyzed one answer, completed the session to generate the debrief, verified successful `gemini` / `gemini-2.5-flash` `ai_generations` rows for `question_generation`, `hint`, `strong_response`, `answer_feedback`, and `session_debrief`, and confirmed `/qa/ai-quality` plus JSON export returned `200`.
- Email-send smoke: `npm run postgres:smoke:email` passed against `http://127.0.0.1:3100` on May 6, 2026 with Office365 SMTP env values and intentional recipient `fusbox@gmail.com`. The script logged in, created invite batch `eb13a647-e9cf-48d1-ac84-632c8427491a`, sent the invite through `/api/invite/send`, received provider message id `<4ebd8382-3e15-bf17-d17e-e02e5d5bf234@coach.rangam.com>`, completed the candidate session, sent the debrief email, and verified `invitation_sent_at`, `summary_narrative`, `intake_json.summary_expires_at`, and success metrics in Postgres.
- Browser-visible recruiter smoke: Playwright CLI drove `/login` through the visible recruiter create-invite flow on May 6, 2026. Login, create steps, preview modal, visible delivered state, dashboard visibility, and DB verification passed for session `019dfd5f-e191-7320-ab8d-836b4c8f0b6d`. The browser pass also cleaned up stale Resend-vendor copy and two non-blocking browser warnings.
- Browser-visible candidate smoke: Playwright CLI drove `/s/[token]` through initials, welcome/readiness, hints, strong example response, text-mode answer submission, answer feedback for three questions, and final debrief on May 6, 2026. DB verification passed for session `019dfd69-a227-776c-b2bd-c2a2d084a88c`: `COMPLETED`, `current_question_index = 3`, three answers, three eval results, `summary_narrative` present, and successful AI-generation rows for `hint`, `strong_response`, `answer_feedback`, and `session_debrief`. This pass also confirmed visible candidate smoke needs `GEMINI_API_KEY` because the candidate UI touches TTS and AI surfaces.
- Practice-again chain smoke: `npm run postgres:smoke:practice-again` passed against `http://127.0.0.1:3100` on May 6, 2026. It created a Postgres-backed invite, created attempt 2 from attempt 1, created attempt 3 from attempt 2, fetched attempts 2 and 3 with their own issued tokens, and verified three active candidate-token rows plus encrypted invite-token metadata on repeat-attempt session rows.
- Profile/settings smoke: `npm run postgres:smoke:profile-settings` passed against `http://127.0.0.1:3100` on May 6, 2026. It logged in with app-owned auth, loaded `/recruiter/settings`, fetched and updated `/api/recruiter/profile`, verified the saved profile row in Postgres, and restored the original smoke-user profile.
- Invite resend/retry smoke: `npm run postgres:smoke:resend-retry` passed against `http://127.0.0.1:3100` on May 6, 2026. It created a Postgres-backed invite, resent it through Office365 SMTP to the intentional smoke recipient, verified `invitation_sent_at` and resend success metrics, seeded a failed retryable batch, retried it through the route stack, and verified parent/child batch state, child session creation, and completed retry idempotency in Postgres.
- Recruiter review smoke: `npm run postgres:smoke:recruiter-review` passed against `http://127.0.0.1:3100` on May 6, 2026. It created a Postgres-backed invite/session, submitted a candidate answer, opened `/recruiter/sessions/[id]` as the owning recruiter, verified the visible review contract, confirmed the page does not expose candidate AI feedback pulse labels, and verified the owner-scoped session plus answer rows in Postgres.
- Negative-permissions smoke: `npm run postgres:smoke:negative-permissions` passed against `http://127.0.0.1:3100` on May 6, 2026. It provisioned a recruiter-only second user, verified missing and mismatched candidate-token denials, cross-recruiter review/resend denial, admin/QA page redirects, QA export `403`, anonymous protected-page redirect, and owner/role state in Postgres.
- Manual full-flow validation: user ran comprehensive manual validation on May 6, 2026 against the Postgres-migrated local app. Recruiter create/send invite, resend, dashboard/session details review, admin user-feedback review, QA AI-quality review, candidate session completion, and two additional practice-again attempts all worked.

Repeatable commands:

```powershell
npm run postgres:smoke:start
npm run db:apply-schema
npm run db:smoke-schema
npm run postgres:smoke:product
npm run postgres:smoke:ai
npm run postgres:smoke:email
npm run postgres:smoke:practice-again
npm run postgres:smoke:profile-settings
npm run postgres:smoke:resend-retry
npm run postgres:smoke:recruiter-review
npm run postgres:smoke:negative-permissions
```

See [local_postgres_smoke.md](./local_postgres_smoke.md).

## Notes For Roadmap

- The target runtime facts are now partially confirmed, but the checklist item should remain open until staging/UAT URL, deployment platform, secret store, logs, DB inspection path, and final DB env/user contract are answered.
- The Postgres client/config layer can still proceed before those answers by supporting both connection-string and split-env formats.
- Email code is now SMTP-based in this branch, and real Office365 SMTP delivery passed locally against the disposable Postgres smoke DB. Target deployment still needs final Microsoft/Office365 SMTP env values because omitting `SMTP_HOST` would fall back to the old AWS SES host default.
