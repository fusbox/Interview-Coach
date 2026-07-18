# Postgres Migration Reviewer And Deployment Handoff

## Purpose

This handoff is for code reviewers and the integration/deployment team reviewing the Azure project `Interview_Coach_AI`, branch `feature/postgres-integration`.

The main point: the Interview Coach app was already fully functional before this migration work. In the Supabase/Vercel-backed version, recruiter invite creation, candidate practice, AI feedback, email delivery, admin feedback review, QA AI-quality review, and practice-again flows were all working. If the Rangam deployment had not required Supabase removal, the app would have been ready to run in that shape.

This branch removes the active Supabase runtime dependency and replaces it with a Postgres-backed runtime validated locally against a disposable plain Postgres database. Recruiter flows, candidate flows, AI generation capture, SMTP email, admin/QA access, resend/retry, chained practice-again attempts, and negative permission checks have all been validated without writing to Supabase.

Supabase references that remain in migration docs or the `supabase/` directory are historical schema/context material, not active runtime dependencies.

## Executive Summary

| Area | Current branch state |
| --- | --- |
| Runtime data store | Postgres via server-only `pg` helpers and Postgres repositories. |
| Internal-user auth | App-owned Postgres auth/session bridge for local/UAT; target production should use ATS/Okta or equivalent identity handoff. |
| Candidate auth | Preserved token-link flow at `/s/[token]`; candidate APIs enforce `x-candidate-token`. |
| Schema | Neutral executable migration lives at `db/migrations/001_initial_schema.sql`. |
| Email | SMTP/nodemailer; Office365 SMTP passed local smoke validation. |
| AI provider | Google Gemini via `GEMINI_API_KEY`; all five AI surfaces capture to Postgres-backed `ai_generations`. |
| Supabase | Active runtime fallback, packages, helper modules, service-role access, env requirements, and `User` type imports removed. |

## Architecture Before Migration

Supabase was not only a database in the original app. It provided several platform functions:

| Supabase responsibility | How the app used it |
| --- | --- |
| Product data store | `sessions`, `questions`, `answers`, `eval_results`, `candidate_tokens`, `recruiter_profiles`, `recruiter_templates`, `user_feedback`, invite tracking, metrics, rate limits, idempotency, and `ai_generations`. |
| Internal-user auth | Recruiter/admin/QA login, signup/callback, SSR session cookies, current-user lookup, and browser logout/login client behavior. |
| Trusted server access | Service-role operations for backend reads/writes, admin views, and candidate/invite workflows. |
| Authorization model | Supabase RLS and `auth.uid()` policies in schema/migration history, plus app-level checks. |
| RPC/function behavior | Invite batch creation, engagement increments, rate-limit consumption, metrics rollups/SLO summaries, and AI-generation summary functions. |
| Operational inspection | Supabase table inspection and deployment/runtime validation during development. |

Candidate access was already independent of Supabase Auth at the product level: candidates enter via `/s/[token]`, and candidate APIs use `x-candidate-token`.

## Migrated App Flow

The migrated product flow preserves the existing app behavior:

1. Internal recruiter/admin/QA user authenticates.
2. Recruiter creates an invite batch and generates interview questions.
3. App stores sessions, questions, candidate tokens, invite batch rows, idempotency rows, rate-limit rows, metrics, and AI-generation records in Postgres.
4. Invite/debrief email links are generated from the configured public origin and sent through SMTP.
5. Candidate opens `/s/[token]`, enters initials, starts practice, requests hints or strong responses, submits answers, receives answer feedback, and completes the session.
6. Completion generates session debrief content, persists the debrief, and can send a debrief email.
7. Candidate can use practice-again links for chained attempts.
8. Recruiter can review the session summary/transcript; candidate-facing AI coaching feedback is not exposed to recruiters.
9. Admin can review app feedback, and QA can inspect/export AI-generation records.

## Migration Work Completed

| Area | Completed work |
| --- | --- |
| Postgres foundation | Added server-only `pg` config/pool helpers that accept `DATABASE_URL` or split `POSTGRES_*` values, with SSL/pooling/query-timeout support. |
| Neutral schema | Added `db/migrations/001_initial_schema.sql` and validation SQL under `db/validation`, replacing Supabase Auth/RLS assumptions with app-owned user/session/role tables and server-side authorization. |
| Product repositories | Replaced runtime product repositories with Postgres-backed session, invite, template, feedback, and AI-quality repositories. Backend selector env vars now accept only `postgres` for the migrated runtime. |
| Operational stores | Replaced candidate-token, idempotency, rate-limit, and metrics runtime stores with Postgres-backed implementations. Local/test memory remains available only where intentionally supported. |
| Auth bridge | Added local/UAT app-owned auth using app users, scrypt password hashes, opaque hashed server sessions, role rows, login/logout routes, middleware redirects, profile loading, and provisioning script. |
| Browser/runtime cleanup | Removed runtime browser and server Supabase usage, Supabase auth middleware/helpers, Supabase repository implementations, Supabase package dependencies, Supabase env requirements, and Supabase `User` type imports. |
| AI quality | Ported all five AI surfaces to capture records in Postgres-backed `ai_generations`: question generation, answer feedback, hints, strong response, and session debrief. |
| Email | Preserved SMTP/nodemailer delivery and validated Office365 SMTP locally for invite and debrief emails. |
| Practice-again fix | Persisted issued candidate tokens into repeat-attempt metadata so attempt 2 can create attempt 3 and debrief email links point to the current attempt token. |
| Permissions | Validated owner-scoped recruiter review, cross-recruiter denial, recruiter-only admin/QA denial, QA export denial, and candidate-token missing/mismatch denial. |

## Code Review Focus

Reviewers should focus on these seams:

| Area | What to check |
| --- | --- |
| Repository behavior | Postgres implementations preserve the existing domain contracts without changing route behavior. |
| Auth seam | App-owned auth is acceptable as local/UAT bridge, but target production identity should be an ATS/Okta handoff that creates or maps to an app session. |
| Candidate access | Token-link candidate entry remains simple and account-free; raw tokens are not stored in plaintext, and candidate APIs enforce session-bound token checks. |
| Schema | Neutral DDL includes the tables/functions/indexes/triggers needed by the product and does not carry forward Supabase `auth.uid()` or broad public RLS assumptions. |
| Operational stores | Idempotency, rate limiting, metrics, candidate tokens, and AI-quality capture are not forgotten hidden dependencies. |
| Runtime cleanup | No runtime path should require Supabase packages, Supabase env vars, Supabase auth helpers, service-role access, or direct Supabase client access. |
| Validation | Local smoke evidence is strong; target-environment validation still belongs to the integration/deployment team. |

## Deployment Workflow

Recommended deployment sequence:

1. Provision a dev/UAT Postgres database.
2. Confirm who applies DDL and whether the app DB user can create extensions, enums, functions, triggers, and indexes.
3. Apply `db/migrations/001_initial_schema.sql`.
4. Configure runtime secrets and environment variables.
5. For local/UAT bridge testing, provision at least one app user with the direct `node scripts/provision-app-user.mjs ...` command shown below.
6. For target production UX, implement or connect the ATS/Okta identity handoff so internal users land on `/recruiter/create` with recruiter/admin/QA roles mapped.
7. Run quality gates: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, and `npm run test:stability`.
8. Run the Postgres smoke scripts or their target-environment equivalents.
9. Manually validate the core product flows in the target environment.
10. Confirm DB writes and logs through integration-owned tooling.
11. Have QA run product regression before production cutover.
12. After target validation, decide whether to retire, archive, or keep historical Supabase schema/docs material for provenance.

## Runtime Contract

Database config supports either:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db-name>
```

or:

```env
POSTGRES_HOST=
POSTGRES_PORT=5432
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
```

Required target env values:

```env
NEXT_PUBLIC_APP_URL=https://interviewcoach.talentarbor.com
ENCRYPTION_SECRET=<stable per environment, at least 32 characters>
GEMINI_API_KEY=<Google Gemini key>
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=interviews@coach.rangam.com
SMTP_PASSWORD=<mailbox/app password as provided by admin>
SMTP_FROM_EMAIL=Rangam Interview Coach <interviews@coach.rangam.com>
```

Optional selector guardrails should use `postgres` if set:

```env
APP_AUTH_BACKEND=postgres
SESSION_REPOSITORY_BACKEND=postgres
INVITE_REPOSITORY_BACKEND=postgres
TEMPLATE_REPOSITORY_BACKEND=postgres
FEEDBACK_REPOSITORY_BACKEND=postgres
AI_GENERATION_REPOSITORY_BACKEND=postgres
CANDIDATE_TOKEN_BACKEND=postgres
IDEMPOTENCY_BACKEND=postgres
RATE_LIMIT_BACKEND=postgres
METRICS_BACKEND=postgres
```

`RATE_LIMIT_BACKEND` and `METRICS_BACKEND` also support `memory` for local/test usage; production defaults to Postgres and rejects memory.

## Reviewer Local Quickstart

Use this path when a reviewer wants to run the migrated branch locally against the disposable smoke database.

```powershell
cd <repo-root>

npm run postgres:smoke:start
npm run db:apply-schema
npm run db:smoke-schema

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
$env:GEMINI_API_KEY = "<real key for AI surfaces, or a placeholder for auth-only review>"

$env:APP_USER_PASSWORD = "interviewcoach-local-user-password"
node scripts/provision-app-user.mjs --smoke-defaults --email fu@rangam.com --roles recruiter,admin,qa --first-name Fu --last-name Box --timezone America/Chicago

npm run dev
```

Then sign in at `/login` with:

```text
fu@rangam.com
interviewcoach-local-user-password
```

The provisioning command is idempotent. Re-running it for the same email updates profile fields, replaces roles, and resets the password hash to the current `APP_USER_PASSWORD` value.

Important: use the direct `node scripts/provision-app-user.mjs ...` command for reviewer/UAT provisioning. In some Windows/npm shells, `npm run auth:provision-user -- --email ... --roles ...` can forward only option values while dropping the flag names, causing the provisioner to fail with `Unexpected positional argument`. The direct `node` command avoids that wrapper ambiguity.

## Validation Evidence

The branch was validated against a disposable Docker Postgres DB:

| Fact | Value |
| --- | --- |
| Container | `interviewcoach-postgres-smoke` |
| Image | `ankane/pgvector:latest` |
| Host port | `5434` |
| Database | `interviewcoach_smoke` |
| Local app URL | `http://127.0.0.1:3100` during smoke runs |
| Smoke user | `fu@rangam.com` with recruiter/admin/QA roles |

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

Manual validation was also completed against the Postgres-migrated local app:

- Recruiter create/send invite
- Invite resend
- Dashboard/session details review
- Admin user-feedback review
- QA AI-quality review
- Candidate session completion
- Two additional practice-again attempts

Reported result: All pass.

Most recent automated verification from the Supabase-sunset checkpoint:

- Runtime Supabase scan over `src`, package files, and `.env.example`: no active references.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- Focused auth/repository/operational-store/API tests: 16 files / 63 tests passed.
- `npm run test:coverage`: 85 files / 288 tests passed.
- `npm run test:stability`: 20/20 iterations passed.

## Remaining Integration Work for the Team

These items are not blocked on proving local app functionality; they are target-environment ownership items:

- Confirm hosting platform, staging/UAT URL, production URL, Node runtime, build/start commands, and secret store.
- Confirm DB networking, SSL/TLS mode, firewall/IP allowlists, least-privilege DB user, and migration execution owner.
- Confirm backup/restore, rollback plan, slow-query visibility, app logs, error alerting, and DB inspection path.
- Implement or finalize ATS/Okta identity handoff, trusted claims, signature/key validation, replay protection, session lifetime, role/group mapping, and landing route.
- Decide whether transitional login/create-account/logout/settings identity UI is hidden by config, removed after identity integration, or retained only for local/UAT fallback.
- Validate Microsoft/Office365 SMTP in the company environment.
- Validate `NEXT_PUBLIC_APP_URL` so invite and debrief links use `https://interviewcoach.talentarbor.com` or the confirmed target host.
- Decide whether the separate session-recovery hardening patch should merge before production cutover.
- Decide whether to archive or remove the historical `supabase/` schema/migration directory after reviewers no longer need original schema provenance.

## Open Deployment Questions

1. What staging/UAT URL should be used before production?
2. What exact hosting runtime will run the Next app, and is Node 22 approved?
3. Will production use `DATABASE_URL`, split `POSTGRES_*`, or both?
4. What SSL/TLS mode and DB certificate requirements apply?
5. Who applies schema/functions/triggers/indexes to the company DB?
6. Who provides the least-privilege app DB user?
7. What is the ATS/Okta handoff contract and role mapping?
8. Where can reviewers/integration confirm app logs and DB writes?
9. What is the final SMTP policy for `interviews@coach.rangam.com`?
10. Who owns final archival/removal of historical Supabase schema material after target validation?

## Bottom Line

This branch takes the app from "working Supabase-backed product" to "working Postgres-backed product validated independent of Supabase." The remaining work is to deploy that path in the company environment, connect enterprise identity, and prove DB/log/email behavior there.

## Appendix: Working Docs

These documents were useful while building and validating the migration. They are preserved as supporting material, but the handoff above should be treated as the review/deployment starting point.

| Doc | Notes |
| --- | --- |
| [integration_checklist.md](./integration_checklist.md) | Historical planning/checklist artifact. It contains progress notes, backlog items, and open questions from earlier migration phases. |
| [supabase_touchpoint_inventory.md](./supabase_touchpoint_inventory.md) | Historical touchpoint inventory showing what Supabase runtime dependencies were removed or replaced. |
| [target_runtime_facts.md](./target_runtime_facts.md) | Runtime/env appendix with more detail on deployment facts, validation checklist, and local disposable DB evidence. |
| [target_schema_reconciliation.md](./target_schema_reconciliation.md) | Schema provenance appendix explaining how Supabase schema/migrations were reconciled into the neutral Postgres migration. |
| [local_postgres_smoke.md](./local_postgres_smoke.md) | Detailed local validation evidence and repeatable smoke-command notes. |
| [app_user_provisioning.md](./app_user_provisioning.md) | Local/UAT app-user provisioning runbook for the temporary app-owned auth bridge. |
