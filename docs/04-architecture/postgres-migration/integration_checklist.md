# Postgres Migration Integration Checklist

## Purpose

Use this checklist to confirm what **"migrate from Supabase to company Postgres"** means operationally, what evidence proves the migrated app works, and which gaps must be resolved before the app can be called ready.

The **"Current app"** column models the kind of answer needed from the integration team. It describes the app as it works today in this repo, where Supabase currently provides both database access and authentication/session behavior.

## How To Use

- Fill the **"Integration team response"** column with answers from the integration, infra, and auth owners.
- Treat unanswered auth, deployment, and DB privilege items as blockers for full Supabase removal.
- Keep database migration and auth migration separate in estimates, even if the final deployment must ship with both complete.
- Do not switch the current dirty AI-quality worktree to the Postgres branch. Use a separate worktree before implementation starts.

## Current Phase-1 Assumption

As currently understood, phase 1 is a standalone app hosted at `interviewcoach.talentarbor.com`. ATS identity or broader enterprise identity integration belongs to a later phase. Recruiter/admin auth should be app-owned email/password auth backed by Postgres, replacing the current Supabase Auth login while keeping the standalone app experience.

## Working Decisions And Assumptions

These are the current working answers as of May 4, 2026. They are safe to use for planning and implementation unless contradicted by the integration team.

| Topic | Working answer | Implementation impact |
| --- | --- | --- |
| Supabase scope | Treat phase 1 as full Supabase replacement, not database-only replacement. | Replace Supabase data access and Supabase Auth/session behavior. Do not plan to keep Supabase Auth as the steady-state phase-1 answer. |
| Recruiter/internal auth | Proceed with app-owned email/password auth backed by Postgres for phase 1. | Preserve the current `/login` mental model while replacing Supabase Auth. Magic links remain a fallback concept, but are not preferred because expired sessions would force users back through email. |
| Candidate access | Keep candidate access token-link based for phase 1. | Preserve `/s/[token]` style entry and `x-candidate-token` API protection. Port token storage/validation to Postgres. |
| Historical data | Fresh target DB is acceptable. Existing real sessions remain in the current Supabase project if needed later. | No bulk historical data migration is required for phase 1. Focus on schema creation and new-record validation. |
| SQL functions/procedures | Proceed assuming target Postgres allows functions/procedures. | Port existing RPC-style behavior into SQL functions where that remains the cleanest implementation. |
| DB env format | `DATABASE_URL` vs `POSTGRES_*` remains open. | Implement config that accepts both and normalizes internally, with `DATABASE_URL` preferred when present. |
| App DB user | Final user/privilege model remains open. | Code can proceed against env-provided credentials, but production should use a least-privilege app user rather than the generic `postgres` user. |
| Target host | Working host is `interviewcoach.talentarbor.com`. | Use that as the production-origin assumption. Expect staging branch, staging URL, or UAT domain to be confirmed separately. |
| Logs/DB inspection | Still open. | Not a coding blocker, but it is a deployment-readiness blocker. Someone must be able to inspect logs and confirm DB writes. |
| Acceptance ownership | After migration/auth code is ready, integration team should validate in the company deployment environment, then QA should run product validation. | We should provide automated tests plus a smoke/acceptance runbook; integration and QA own environment-level signoff. |

## Progress Notes

| Date | Status | Note |
| --- | --- | --- |
| 2026-05-05 | In Progress | Added `getAuthenticatedRouteUser()` as the shared server route auth seam and moved the direct API-route Supabase auth checks for question generation, invite create/send/resend/retry, ops metrics, and recruiter profile onto it. These routes now authenticate through `getCachedUser()`, which can resolve app sessions when `APP_AUTH_BACKEND=postgres` and Supabase users during fallback. Typecheck, lint, and focused route/helper tests passed. |
| 2026-05-05 | In Progress | Removed the remaining browser-side Supabase profile/current-user calls from recruiter settings, recruiter invite creation, and ProfileGuard. Added `/api/recruiter/profile` as the app-auth-compatible profile contract, backed by Postgres when `APP_AUTH_BACKEND=postgres` and Supabase during migration fallback. ProfileGuard now runs under app auth instead of being skipped. Typecheck and focused auth/profile tests passed. |
| 2026-05-05 | In Progress | Wired first app-owned auth runtime path. Added `/api/auth/login` and `/api/auth/logout`, set/clear the HTTP-only app session cookie, taught `getCachedUser()` and middleware to use app sessions when `APP_AUTH_BACKEND=postgres`, switched login plus desktop/mobile logout away from browser Supabase auth, and added a server profile loader that reads Postgres in app-auth mode. Focused auth route tests, auth/RBAC tests, and typecheck passed. |
| 2026-05-05 | In Progress | Started app-owned recruiter auth foundation. Added app-user type, scrypt password hashing/verification, opaque hashed app-session tokens, Postgres app-auth store primitives, password-login orchestration, session lookup/revocation helpers, audit-event writes, and DB-role-aware RBAC. Focused auth/RBAC tests and typecheck passed. Later progress notes cover login/logout UI wiring; middleware remains open. |
| 2026-05-05 | In Progress | Ported the AI-quality generation capture workstream into `feature/postgres-integration`. `AI_GENERATION_REPOSITORY_BACKEND=postgres` now supports capture writes plus `/qa/ai-quality` reads, filtered pagination, aggregate summary widgets, and JSON/CSV export through Postgres-backed repositories. Focused AI-quality tests, answer submit/analysis route tests, typecheck, and disposable Docker schema smoke passed. |
| 2026-05-05 | In Progress | Added Postgres feedback repository and provider seam. `FEEDBACK_REPOSITORY_BACKEND=postgres` now captures candidate/recruiter feedback, preserves session/type update behavior when session context exists, supports recruiter-only feedback inserts, and returns the admin feedback view with session role/intake context. Typecheck, focused factory/UI tests, and disposable Docker Postgres integration tests passed. |
| 2026-05-05 | In Progress | Added Postgres template repository and provider seam. `TEMPLATE_REPOSITORY_BACKEND=postgres` now preserves recruiter-owned templates, shared-template visibility, template create/update/delete, and explicit admin manage-all behavior; template server actions now use the repository factory. Typecheck, focused factory/UI tests, and disposable Docker Postgres integration tests passed. |
| 2026-05-05 | In Progress | Added Postgres session repository and repository factory. `SESSION_REPOSITORY_BACKEND=postgres` now supports session create/read/update/delete, dashboard summaries, draft saves, answer/eval writes, analysis deletion, summary expiry, invitation sent timestamps, and atomic engagement increments through the neutral Postgres function. Shared candidate/recruiter/session call sites now go through the factory; focused unit tests, route/application tests, typecheck, and disposable Docker Postgres integration tests passed. |
| 2026-05-05 | In Progress | Added Postgres candidate-token backend. `CANDIDATE_TOKEN_BACKEND=postgres` now issues hashed candidate tokens and validates `x-candidate-token` against active session-bound rows; focused unit tests and disposable Docker Postgres integration tests passed, including expired/revoked rejection. |
| 2026-05-05 | In Progress | Added Postgres durable metrics backend. `METRICS_BACKEND=postgres` now writes counter/timing rollups and reads operational snapshots/SLO summaries through the neutral metrics SQL functions; focused unit tests and disposable Docker Postgres integration tests passed. |
| 2026-05-05 | In Progress | Added Postgres durable rate-limit backend. `RATE_LIMIT_BACKEND=postgres` now uses the neutral `consume_rate_limit_bucket()` SQL function; focused unit tests and disposable Docker Postgres integration tests passed, including concurrent consumption. |
| 2026-05-05 | In Progress | Added idempotency backend seam and Postgres implementation. `beginIdempotentRequest`, `completeIdempotentRequest`, and `releaseIdempotentRequest` now default to Supabase during migration but can use Postgres with `IDEMPOTENCY_BACKEND=postgres`; focused unit tests and disposable Docker Postgres integration tests passed. |
| 2026-05-05 | In Progress | Added invite repository factory/provider seam. Invite create, retry, and candidate token lookup now use `createInviteRepository()`, defaulting to Supabase until `INVITE_REPOSITORY_BACKEND=postgres` is intentionally set. |
| 2026-05-05 | In Progress | Added first Postgres invite repository implementation and optional Docker-backed integration test for tracked invite creation, token lookup, failure tracking, and retry marking. Runtime wiring remains on Supabase until migration slices are ready. |
| 2026-05-05 | Done | Validated `db/migrations/001_initial_schema.sql` against disposable Docker Postgres `interviewcoach-postgres-test` (`ankane/pgvector:latest`, PostgreSQL 15.4). Migration applied successfully, reran idempotently, and rollback-only smoke validation passed. |
| 2026-05-05 | In Progress | Investigated ChatArbor local Postgres setup as a validation option. Recommendation: reuse the `ankane/pgvector` image pattern in a new disposable Interview Coach container/volume, not the existing `chatarbor-postgres` container with ChatArbor data. |
| 2026-05-05 | In Progress | Drafted neutral executable initial schema at `db/migrations/001_initial_schema.sql`. It intentionally replaces Supabase Auth/RLS with app-owned auth tables and server-side authorization assumptions. |
| 2026-05-05 | In Progress | Added target schema reconciliation plan at [target_schema_reconciliation.md](./target_schema_reconciliation.md), using [db_schema.md](./db_schema.md), repo schema/migrations, and touchpoint inventory as source inputs. |
| 2026-05-05 | In Progress | Began Phase 1 implementation with a server-only Postgres foundation: env/config parsing, pooled `pg` client, and health-check helper. |
| 2026-05-04 | Done | Created a clean separate worktree at `C:\tmp\Interview-Coach-Recruiter-postgres` on `feature/postgres-integration`, tracking `azure/feature/postgres-integration`. |
| 2026-05-04 | Done | Confirmed the original `C:\dev\Interview-Coach-Recruiter` worktree remains reserved for AI-quality staged work and session-recovery unstaged work. |
| 2026-05-04 | Done | Copied `integration_checklist.md` and `previous_chat.md` into this Postgres migration branch under `docs/04-architecture/postgres-migration/`. |
| 2026-05-04 | Done | Set phase-1 working scope to full Supabase replacement, fresh target DB, candidate token-link access preserved, SQL functions/procedures allowed, and app-owned email/password auth backed by Postgres. |
| 2026-05-04 | Done | Created the Supabase touchpoint inventory at [supabase_touchpoint_inventory.md](./supabase_touchpoint_inventory.md). |
| 2026-05-04 | In Progress | Created target runtime facts artifact at [target_runtime_facts.md](./target_runtime_facts.md). Several deployment/integration facts remain open. |
| 2026-05-04 | Open | Deployment/log access, DB inspection path, staging/UAT URL, final Postgres env contract, and final production DB user remain integration-team confirmations. |

## Auth Decision

Phase 1 should use app-owned email/password auth backed by Postgres.

| Option | Decision | Security notes | Tradeoff |
| --- | --- | --- | --- |
| App-owned email/password auth backed by Postgres | Preferred phase-1 approach. | Requires password hashing, email verification if self-signup remains, password reset tokens, session table, secure HTTP-only cookies, rate limiting, logout invalidation, and DB-backed role checks. | Most familiar UX and most finishable without external identity dependencies, but the app owns more security plumbing. |
| Passwordless magic-link auth backed by Postgres and SMTP | Not preferred for phase 1. | Avoids password storage but still requires single-use hashed login tokens, short expiry, secure session cookies, and rate limiting. | Repeated access can become frustrating because expired sessions require users to request and retrieve another email link. |
| External standalone auth provider | Defer unless company requires it. | Security burden moves to provider, but callback/session integration and role mapping still need work. | Adds vendor/admin dependency and may be harder for Fu to finish without access to provider configuration. |

Implementation target: preserve the current recruiter login experience, replace Supabase Auth with app-owned users/sessions in Postgres, and keep candidate access token-link based.

## Scope And Ownership

| Status | To confirm | Current app | Post-migration clarification | Fu's notes | Integration team response |
| --- | --- | --- | --- | --- | --- |
| [ ] | Is this database-only replacement, or full backend replacement? | Uses Supabase for Postgres data, auth, SSR cookies, browser login/logout, recruiter identity, service-role/admin access, RLS-oriented policies, and RPC functions. A DB connection string alone does not replace all of that. | Working assumption: full Supabase replacement for phase 1, including data access and auth/session replacement. | Since we don't use Supabase, will proceed as if we need full Supabase replacement | [Your response here]
| [ ] | Is historical Supabase data being migrated, or is this a fresh environment? | Current app stores real app records in Supabase tables. | Working assumption: fresh target DB, no bulk historical migration. Current Supabase records remain available in Fu's project if needed later. | May be out of int. team's purview. Current records will be retained/migrated as needed. | [Your response here]
| [ ] | Who owns the target database? | Supabase project ownership. App code assumes tables, functions, and policies already exist. | DBA/infra owner named, with who applies DDL, who grants privileges, and who confirms production readiness. Not a blocker for local code planning; blocker for deployment/cutover. | Is this a blocker if not provided? | [Your response here]
| [ ] | Who owns auth replacement? | Supabase email/password and Supabase SSR session cookies. Candidate flow is invite-token based. | Working assumption: app-owned email/password auth backed by Postgres for recruiter/admin users. Candidate access remains token-link based. Owner and final provisioning policy still need confirmation before implementation is complete. | As Product Owner, I'll look into viable auth approaches. | [Your response here]
| [ ] | Who owns deployment and runtime logs? | Vercel/Supabase visibility in the existing setup. I don't have access to the company deployment/backend. | Deployment owner, log location, escalation path, and whether user can access logs directly. Not a blocker for coding; blocker for environment validation. | Is this a blocker if not provided? | [Your response here]
| [ ] | Which branch is the migration branch? | Azure remote branch `feature/postgres-integration` exists, but it should be inspected in a separate worktree because the current worktree has staged AI-quality work and unstaged session-recovery work. | Confirm branch name and whether work should begin from that branch, current `dev-Fu`, or a new feature branch. | I'll proceed as if this is true. | [Your response here]

## Deployment And Runtime Environment

| Status | To confirm | Current app | Post-migration clarification | Fu's notes | Integration team response |
| --- | --- | --- | --- | --- | --- |
| [ ] | Target deployment URL where migrated app will run | Current local dev runs through Next. Current known deployed app has been Vercel-hosted. Public URL generation uses `NEXT_PUBLIC_APP_URL` with `NEXT_PUBLIC_BASE_URL` fallback. | Current phase-1 assumption: `https://interviewcoach.talentarbor.com`. Confirm whether there is also a staging URL and whether the TBD candidate-led app shares this host. | Will proceed assuming candidate-led app will share this host. | [Your response here]
| [ ] | Canonical public origin for invite links and email links | Current code requires explicit public origin in production for invite/debrief links. | Confirm value for `NEXT_PUBLIC_APP_URL` or successor env name. | Will proceed using current invite link shape: https://[hostname]/s/[token]. | [Your response here]
| [ ] | Deployment platform | Next.js deployed on Vercel. | Confirm whether target is Azure App Service, container, internal hosting, or other. Include build/start command and Node version. | npm | [Your response here]
| [ ] | Runtime environment variables and secret store | Current app needs Supabase env vars, `GEMINI_API_KEY`, SMTP vars, metrics/rate-limit backend config, and public URL config. | Confirm where secrets are stored, who can update them, and how values are promoted between dev/stage/prod. | See .env.example | [Your response here]
| [ ] | Postgres connection format | `pg` is installed and the server Postgres config/pool now supports `DATABASE_URL` or individual `POSTGRES_*` values. | Working approach: support both formats and normalize internally, preferring `DATABASE_URL` when present. | Proceed with flexible config until final env contract is answered. | [Your response here]
| [ ] | Network access from app runtime to DB | Supabase access is outbound HTTPS through Supabase clients. Plain Postgres requires TCP access from runtime to DB. | Confirm firewall, VPC/VNet, IP allowlist, SSL/TLS requirement, and whether local developer access is allowed. Not a blocker for local code; blocker for target deployment validation. | Is this a blocker if not provided? | [Your response here]
| [ ] | Logs for app/API/backend failures | Validation can use local terminal, Vercel logs, and Supabase table inspection. | Provide exact log viewer, required access, correlation/trace lookup method, and who can retrieve logs if user lacks access. Not a blocker for local code; blocker for target deployment validation. | Is this a blocker if not provided? | [Your response here]
| [ ] | Rollback plan | Current production rollback is tied to existing deployed app and Supabase-backed runtime. | Define rollback trigger, rollback owner, prior deployment target, DB rollback approach, and data-loss expectations. Not a blocker for local code; blocker before production release. | Is this a blocker if not provided? | [Your response here]

## Database Schema, Migrations, And Privileges

| Status | To confirm | Current app | Post-migration clarification | Fu's notes | Integration team response |
| --- | --- | --- | --- | --- | --- |
| [ ] | Can target DB accept the app schema? | Schema starts in `supabase/schema.sql` and continues through migrations in `supabase/migrations`. | Confirm DDL can be applied, including enums, tables, indexes, constraints, triggers, and SQL functions. Not a blocker for drafting DDL; blocker for applying to target DB. | Is this a blocker if not provided? | [Your response here]
| [ ] | Are SQL functions/procedures allowed? | Calls RPC/functions for invite batch creation, engagement increment, rate limits, metrics rollups, SLO summaries, and AI-generation summary. | Confirm functions are allowed. If not, identify which functions must move into application code. | Will proceed assuming functions/procedures are allowed | [Your response here]
| [ ] | Which DB user should the app use? | Supabase service-role currently acts as privileged server access. Provided `POSTGRES_USER=postgres` may be placeholder or admin-level. | Working approach: code accepts env credentials; production should use a least-privilege app user. `postgres` can be treated as temporary/dev unless integration team confirms otherwise. | Proceed with flexible config until final DB user contract is answered. | [Your response here]
| [ ] | Does target DB need RLS? | Supabase schema enables RLS and policies in several tables, but server code often uses service-role/admin access. | Working approach: move authorization into server application code and do not depend on Supabase RLS semantics. Preserve DB constraints; recreate RLS only if company DB policy requires it. | | [Your response here]
| [ ] | Tables to recreate | Current tables include `sessions`, `questions`, `answers`, `eval_results`, `candidate_tokens`, `events`, `projection_session_now`, `recruiter_profiles`, `recruiter_templates`, metrics rollups, rate-limit buckets, invite batch tables, idempotency keys, and `ai_generations`. | DDL applied and verified with table/index/function inventory. | | [Your response here]
| [ ] | Required migrations | Migrations include recruiter profiles/templates, session lineage/readiness, paused status, idempotency, engagement increment, metrics, rate limits, invite batches, and AI-quality generation capture. | List which migrations apply to target DB and which are superseded by cleaned-up schema. | | [Your response here]
| [ ] | Seed/test data | Creates data through recruiter invite creation and candidate practice flows. | Confirm whether seed data will be provided or whether validation should create records through the app. | | [Your response here]
| [ ] | DB inspection path | I can inspect Supabase tables directly. Target DB access is not available yet. | Provide SQL console, read-only DB credentials, approved query runner, or named person who confirms writes. | | [Your response here]
| [ ] | Backup and restore | Supabase provides managed backup/restore behavior outside the app code. | Confirm backup cadence, point-in-time recovery, restore owner, and whether staging/prod backups can be tested. | | [Your response here]

## Data Access Replacement

| Status | To confirm | Current app | Post-migration clarification | Fu's notes | Integration team response |
| --- | --- | --- | --- | --- | --- |
| [ ] | Server Postgres client layer | No shared `pg` client is currently wired for app persistence. | Add server-only DB module using `pg`, pooling, TLS config, query timeout, and safe error handling. | | [Your response here]
| [ ] | Session repository | `SupabaseSessionRepository` handles session reads/writes, answers, eval results, question updates, debrief state, and engagement increment RPC. | Postgres implementation exists behind `SESSION_REPOSITORY_BACKEND=postgres`; Supabase remains the default migration fallback until the full route stack is validated and production env is pinned to Postgres. | Postgres session repository implemented and validated locally; keep open until full app cutover removes Supabase fallback. | [Your response here]
| [ ] | Invite repository | `SupabaseInviteRepository` creates sessions/questions/tokens, invite batches, candidate tracking, retries, and batch lookup. | Implement Postgres-backed invite repository, including transactional behavior for batch creation/send tracking. | | [Your response here]
| [ ] | Template repository | `SupabaseTemplateRepository` relies on current user, RLS, and optional service-role/admin access for ownership behavior. | Postgres implementation exists behind `TEMPLATE_REPOSITORY_BACKEND=postgres`; it uses explicit `userId` and `canManageAllTemplates` scope to preserve recruiter-owned templates, shared visibility, and admin override. Supabase remains the default migration fallback until auth cutover. | Implemented locally and validated with focused unit/UI tests plus disposable Docker Postgres integration test. | [Your response here]
| [ ] | Feedback repository | `SupabaseFeedbackRepository` persists app feedback and exposes the admin feedback view by joining sessions. | Postgres implementation exists behind `FEEDBACK_REPOSITORY_BACKEND=postgres`; it preserves candidate/recruiter feedback capture, session/type update behavior, recruiter-only feedback inserts, and admin read shape with session role/intake context. Admin layout can resolve app-auth users, but the admin feedback page still has a direct Supabase profile/timezone lookup to replace. | Implemented locally and validated with focused unit/UI tests plus disposable Docker Postgres integration test. | [Your response here]
| [x] | AI-quality repository | AI-quality capture writes and reads `ai_generations`; Supabase remains available only as a migration fallback. | Postgres-backed write/read/export/summary queries exist for `/qa/ai-quality` behind `AI_GENERATION_REPOSITORY_BACKEND=postgres`. | Focused AI-quality tests passed; full route validation still belongs in product smoke. | [Your response here]
| [ ] | Metrics backend | Durable metrics backend now supports Supabase and Postgres. Local/test can use memory; `METRICS_BACKEND=postgres` selects the Postgres backend. | Postgres backend preserves counter/timing rollup writes, operational snapshot reads, and SLO summary reads through neutral SQL functions. Final production env should be pinned to Postgres during the broader cutover. | Implemented locally and validated with focused unit tests plus disposable Docker Postgres integration test. | [Your response here]
| [ ] | Rate-limit backend | Production rate limiting expects a durable backend. Supabase remains the default production backend during migration; `RATE_LIMIT_BACKEND=postgres` now selects the Postgres backend. | Postgres backend preserves the atomic `consume_rate_limit_bucket()` behavior and rejects memory in production. Final production default/env pin should move to Postgres during the broader cutover. | Implemented locally and validated with focused unit tests plus disposable Docker Postgres integration test, including concurrent requests. | [Your response here]
| [ ] | Idempotency store | `src/lib/server/idempotency.ts` now uses a backend seam. Supabase remains the default during migration; `IDEMPOTENCY_BACKEND=postgres` selects the Postgres store. | Postgres implementation preserves reserve, pending duplicate, conflict, complete/replay, and pending release behavior against `api_idempotency_keys`. Final cutover needs route-stack validation with auth, rate-limit, idempotency, invite, and session backends pinned to Postgres. | Implemented locally and validated with focused unit tests plus disposable Docker Postgres integration test. | [Your response here]
| [ ] | Candidate token store | Candidate links now use a backend seam. Supabase remains the default during migration; `CANDIDATE_TOKEN_BACKEND=postgres` selects the Postgres store. | Postgres backend preserves random raw token issuance, hash-at-rest storage, session-bound validation, and active-token checks for `revoked_at`/`expires_at`. Full validation should run with candidate token, invite, and session repository backends pinned to `postgres`. | Implemented locally and validated with focused unit tests plus disposable Docker Postgres integration test. | [Your response here]

## Authentication, Authorization, And Identity

| Status | To confirm | Current app | Post-migration clarification | Fu's notes | Integration team response |
| --- | --- | --- | --- | --- | --- |
| [ ] | Recruiter login method | `/login` can now post email/password credentials to `/api/auth/login` for app-owned auth when `APP_AUTH_BACKEND=postgres`; Supabase remains available as migration fallback. Self-sign-up is not implemented in app auth yet. | Decide whether phase 1 allows self-sign-up or uses admin-provisioned users only. | Proceeding with email/password, not magic link. | [Your response here]
| [ ] | Auth callback/session exchange | Current `/auth/callback` exchanges Supabase auth code for a session. | Remove Supabase auth-code exchange. Login should verify credentials server-side, create a durable app session, and set a secure HTTP-only cookie. Password reset/email verification flows get their own token routes if needed. | | [Your response here]
| [ ] | Middleware/session refresh | Current `src/middleware.ts` delegates to Supabase SSR middleware and refreshes Supabase cookies. | Replace with app session validation, protected-route handling, and redirect-to-login behavior. | | [Your response here]
| [ ] | Current-user helper | `getCachedUser()` can now return an app-session user when `APP_AUTH_BACKEND=postgres`, a Supabase user during fallback, or an E2E test user. API routes that need a required user now go through `getAuthenticatedRouteUser()` for shared auth-denial metrics. | Continue converging server components/actions on provider-neutral user helpers, then retire the Supabase wrapper once no fallback runtime needs it. | | [Your response here]
| [x] | Browser-side Supabase usage | Login, desktop logout, mobile dock logout, settings, recruiter create, and ProfileGuard now use app API routes instead of browser Supabase clients. | Remaining Supabase auth work is server-side route/helper migration, not browser-client cleanup. | | [Your response here]
| [ ] | Recruiter profile ownership | Current `recruiter_profiles.recruiter_id` maps to Supabase `auth.uid()`. | For app-owned auth, map `recruiter_profiles.recruiter_id` to the app user ID in a new users/auth table. | | [Your response here]
| [ ] | Admin access | Admin check is hardcoded email allowlist in `src/lib/auth/rbac.ts`. | For phase 1, DB-managed roles are likely cleaner than provider claims. Temporary allowlist can remain only as a bridge. | | [Your response here]
| [ ] | QA evaluator access | QA access accepts admin users, metadata roles, and hardcoded email allowlist. | For phase 1, store QA/admin roles on app user records or a user_roles table. | | [Your response here]
| [ ] | Candidate authentication | Candidate practice flow is token-link based, not Supabase login. Candidate API calls use `x-candidate-token`. | Working assumption: candidate remains token-only for phase 1. Later ATS integration can issue, broker, or decorate these links without forcing candidate accounts now. | | [Your response here]
| [ ] | Service-role replacement | `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` for trusted server operations. | Replace with server-side Postgres pool plus explicit app authorization checks. No privileged secret should reach client code. | | [Your response here]

## Product Flow Acceptance Tests

| Status | To confirm | Current app | Post-migration clarification | Fu's notes | Integration team response |
| --- | --- | --- | --- | --- | --- |
| [ ] | Recruiter auth smoke | Current path: login/sign up, land on recruiter create/dashboard. | User can sign in to target app as recruiter test user and reach recruiter create page. |
| [ ] | Recruiter profile/settings | Current settings/profile guard now go through `/api/recruiter/profile`, which uses the authenticated app user id and writes `recruiter_profiles` through the app-auth-compatible server helper. | User can create/update recruiter profile and see settings persist after reload/sign-out/sign-in. |
| [ ] | Invite creation | Current flow creates sessions, questions, candidate tokens, and invite batch records. | Create invite in target app; confirm session/questions/token/batch rows in target DB. |
| [ ] | Email send | Current email uses SMTP/nodemailer env vars. The target Microsoft/Office365 deployment must set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL` explicitly. | Send invite email successfully from target deployment and confirm link host is correct. |
| [ ] | Candidate starts practice | Current candidate opens token link and starts/resumes session without login. | Candidate link opens on target candidate host, token validates, and session starts. |
| [ ] | Candidate submits answers | Current answer submission writes answers, eval results, session status, and recovery state. | Submit text and voice answers; confirm DB writes and UI progresses. |
| [ ] | AI surfaces | Current app calls Gemini for question generation, answer feedback, hints, strong response, and session debrief; AI-quality instrumentation records `ai_generations`. | Trigger all five surfaces and confirm target DB records, UI output, and errors/fallbacks. |
| [ ] | Session debrief/email | Current completion can generate debrief and send email. | Complete practice session and confirm debrief renders/sends correctly. |
| [ ] | Recruiter session review | Current recruiter can view sessions and evidence scoped to authenticated user/admin behavior. | Recruiter can view completed session and cannot view records outside their scope unless admin. |
| [ ] | Admin/QA pages | Current admin and `/qa/ai-quality` are protected by RBAC helpers and service-role reads. | Admin/QA user can access permitted routes; unauthorized recruiter cannot. |
| [ ] | Invite send/resend/retry flows | Current invite send/resend/retry routes depend on auth, rate limiting, idempotency, email delivery, and invite batch persistence. | Exercise send, resend, retry failure path if available, and verify durable records. |
| [ ] | Recovery path | Current app has an unstaged session-recovery patch workstream for answer submitted but feedback failed. | Decide whether this patch must merge before migration validation, then test recovery behavior on target stack. |

## Observability And Operations

| Status | To confirm | Current app | Post-migration clarification | Fu's notes | Integration team response |
| --- | --- | --- | --- | --- | --- |
| [ ] | Application logs | Current Logger emits structured server logs with redaction. | Logs visible in target platform with request IDs/correlation IDs and no secrets/PII leakage. |
| [ ] | Metrics/SLO dashboard | Current metrics can be memory or Supabase durable backend; production contract expects durable backend. | Confirm durable metrics backend in target stack and validate `/api/recruiter/ops/metrics` if retained. |
| [ ] | AI quality records | Current `/qa/ai-quality` reads all `ai_generations` through service-role server access. | Confirm QA users can inspect target AI records and export filtered JSON/CSV. |
| [ ] | Error alerting | Current docs include ops alert policy, but app-level alert routing depends on deployment config. | Confirm where production errors, AI failures, auth failures, and rate-limit spikes alert. |
| [ ] | PII/redaction | Current app has log redaction and AI-quality redaction, but DB records still include candidate/recruiter domain data. | Confirm PII handling expectations, DB access restrictions, and data-retention owner. |
| [ ] | Performance/load | Current app relies on Supabase managed connection behavior. Plain Postgres introduces pooling and connection limits. | Confirm DB connection limit, pool size, timeout, slow query logging, and expected concurrent usage. |

## Communication Questions To Send

Use these to disambiguate scope with the integration team:

1. We are proceeding as if phase 1 is full Supabase replacement, not database-only replacement. Please correct this if that is not the intended scope.
2. We are proceeding with app-owned email/password auth for recruiter/admin access in phase 1. Are there company password, session, MFA, account provisioning, or audit requirements we must satisfy?
3. We plan to keep candidate practice token-link based with no candidate login for phase 1. Are there security or ATS-integration requirements that would block this?
4. We are proceeding as if the target Postgres DB is fresh, with no bulk historical Supabase data migration. Please correct this if existing records must be migrated.
5. We are proceeding as if Postgres SQL functions/procedures are allowed. Please confirm if there are restrictions.
6. We can support both `DATABASE_URL` and individual `POSTGRES_*` values, preferring `DATABASE_URL` when present. Please confirm the production env contract when known.
7. We can develop against the provided DB credentials, but production should use a least-privilege app user. Who will provide the final app DB user?
8. We are assuming production host `https://interviewcoach.talentarbor.com`. What staging, UAT, or branch deployment URL should we validate against during integration?
9. Who can view app logs and confirm target DB writes during integration validation?
10. What are the final Microsoft/Office365 SMTP host, port, sender format, and SMTP-auth policy for `interviews@coach.rangam.com`?
11. After migration/auth code is ready, should the integration team validate unit/integration behavior in the company deployment environment before QA performs product testing?

## Migration Roadmap

This roadmap is intentionally broader than the items we are fully confident about today. It captures the work needed to fully unwire Supabase while preserving current app functionality.

### Phase 0 - Workstream Isolation And Discovery

| Status | Work item | Notes / done when |
| --- | --- | --- |
| [x] | Create or use a separate worktree for `feature/postgres-integration`. | Done: `C:\tmp\Interview-Coach-Recruiter-postgres` created and tracks `azure/feature/postgres-integration`. Original dirty worktree was not switched. |
| [x] | Inspect the Azure `feature/postgres-integration` branch. | Done: active branch is `feature/postgres-integration`; latest reviewed/pushed head is `0d16be9 feat: centralize api route auth seam`. |
| [x] | Inventory every Supabase touchpoint. | Done: implementation inventory created at [supabase_touchpoint_inventory.md](./supabase_touchpoint_inventory.md) and refreshed through browser-client cleanup and API-route auth seam work. |
| [x] | Confirm full Supabase replacement as phase-1 scope. | Working decision captured: phase 1 should fully replace Supabase, including data access and auth/session behavior. Treat any Supabase runtime dependency as temporary debt. |
| [ ] | Confirm target runtime facts. | In progress: current facts and open confirmations are documented in [target_runtime_facts.md](./target_runtime_facts.md). Still needs integration-team answers for staging/UAT URL, deployment platform, secret store, logs, DB inspection path, final Postgres env contract, and production DB user. |
| [x] | Define acceptance ownership. | Working model captured: local automated tests first, integration-team validation in company deployment environment second, QA product testing third. |

### Phase 1 - Postgres Foundation

| Status | Work item | Notes / done when |
| --- | --- | --- |
| [ ] | Add server-only Postgres client module. | In progress: added first-pass `pg` config/client helpers with `DATABASE_URL` preference, individual `POSTGRES_*` fallback, SSL mode support, pooling, query timeout, idle-client logging, and config tests. Still needs route/repository adoption. |
| [ ] | Add DB health/diagnostic helper for integration validation. | In progress: added a health helper that confirms connectivity and current database name without exposing secrets or PII. Disposable Docker validation also confirmed direct DB connectivity. Still needs a protected route or CLI wrapper once auth/ops access shape is decided. |
| [ ] | Define migration application strategy. | Decide whether migrations are applied manually by DBA, via script, or through deployment pipeline. First draft now lives under neutral `db/migrations/`, and local disposable validation passed; execution ownership remains open. |
| [ ] | Consolidate target schema. | In progress: reconciliation plan created at [target_schema_reconciliation.md](./target_schema_reconciliation.md), first executable draft added at `db/migrations/001_initial_schema.sql`, and disposable Postgres validation passed. Still needs repository implementation feedback and later company DB validation. |
| [ ] | Add app auth tables. | In progress: initial schema draft includes `app_users`, `app_user_credentials`, `app_sessions`, `app_user_roles`, password reset tokens, email verification tokens, and auth audit events. App-auth store primitives now read/write credentials, sessions, and audit events; login/logout route wiring exists. Still needs provisioning/password-reset policy and integration validation. |
| [ ] | Add role/permission model. | In progress: initial schema draft includes `app_user_roles` with recruiter/admin/QA roles. RBAC now accepts app-owned DB roles while preserving the current Supabase-shaped user compatibility. |
| [ ] | Preserve product data tables. | In progress: initial schema draft includes sessions, questions, answers, eval_results, projection_session_now, candidate_tokens, events, recruiter_profiles, recruiter_templates, invite_batches, invite_batch_candidates, user feedback, idempotency keys, metrics rollups, rate-limit buckets, and ai_generations. |
| [ ] | Port SQL functions/procedures. | In progress: initial schema draft ports invite batch creation, engagement increment, rate-limit consumption, metrics counter/timing rollups, SLO summary functions, and AI-generation summary. Repository implementation may replace some DB functions with app transactions if cleaner. |
| [ ] | Decide RLS posture. | Working approach is server-side authorization plus DB constraints, not Supabase RLS semantics, unless company DB policy requires RLS. |
| [ ] | Define production DB user privileges. | Code can run with provided creds while developing; production should use a least-privilege app user rather than generic `postgres`. |

### Phase 2 - Data Access Replacement

| Status | Work item | Notes / done when |
| --- | --- | --- |
| [x] | Implement Postgres session repository. | Done behind migration flag: `SESSION_REPOSITORY_BACKEND=postgres` preserves session create/read/update/delete, dashboard summaries, answer draft/final text, eval result persistence, analysis deletion, debrief summary expiry, invitation sent timestamp, and engagement increment behavior. Shared route/application/page call sites now use the repository factory. Supabase remains accepted/default until final cutover. |
| [ ] | Implement Postgres invite repository. | In progress: added `PostgresInviteRepository` preserving session/question/token creation, candidate token lookup, invite batch tracking, failure tracking, and retry marking. Optional integration test validates against disposable Docker Postgres. Invite create, retry, and candidate token lookup use a provider seam, and direct invite API auth now uses the app-auth-compatible route seam. Still needs end-to-end route-stack validation with all relevant backend selectors pinned to `postgres`. |
| [x] | Implement Postgres template repository. | Done behind migration flag: `TEMPLATE_REPOSITORY_BACKEND=postgres` preserves recruiter-owned template create/update/delete, shared-template list visibility, and explicit admin manage-all behavior. Template server actions now use the repository factory. Supabase remains accepted/default until final cutover. |
| [x] | Implement Postgres feedback repository. | Done behind migration flag: `FEEDBACK_REPOSITORY_BACKEND=postgres` preserves app feedback capture and admin feedback read shape. Supabase remains accepted/default until final auth/data cutover. |
| [x] | Implement Postgres AI-quality repositories. | Done behind migration flag: `AI_GENERATION_REPOSITORY_BACKEND=postgres` preserves capture writes, read filters, pagination counts, grouped views, summary widgets, selected-record reads, and JSON/CSV export. Supabase remains accepted/default until final cutover. |
| [x] | Port candidate token issue/validate. | Done behind migration flag: `CANDIDATE_TOKEN_BACKEND=postgres` issues random raw tokens, stores only token hashes, validates by `x-candidate-token`, enforces session binding, and rejects expired/revoked rows. Supabase remains accepted/default during migration. |
| [x] | Port idempotency store. | Done behind migration flag: `IDEMPOTENCY_BACKEND=postgres` uses the Postgres table/constraints and preserves reserve, pending duplicate, conflict, complete/replay, and pending release behavior. Supabase remains the default until the surrounding auth/rate-limit/session repository paths are migrated. |
| [x] | Port rate-limit backend. | Done behind migration flag: `RATE_LIMIT_BACKEND=postgres` uses the neutral Postgres function and preserves window reset, over-limit denial, and concurrent atomic consumption. Supabase remains accepted/default during migration until production env is intentionally pinned to Postgres. |
| [x] | Port metrics backend. | Done behind migration flag: `METRICS_BACKEND=postgres` uses the neutral Postgres metrics functions and preserves counter/timing writes, rollup reads, and operational SLO summaries. Supabase remains accepted during migration until production env is intentionally pinned to Postgres. |
| [ ] | Replace direct Supabase query calls in routes/pages/actions. | In progress: direct API-route `auth.getUser()` checks for question generation, invite create/send/resend/retry, ops metrics, and recruiter profile now go through `getAuthenticatedRouteUser()`. Remaining work includes server components/actions, Supabase fallback repositories, admin feedback timezone lookup, auth callback/middleware, and final package/env cleanup. |

### Phase 3 - App-Owned Recruiter Auth

| Status | Work item | Notes / done when |
| --- | --- | --- |
| [ ] | Define account provisioning policy. | Decide whether recruiters can self-sign-up, are admin-created, or are seeded by integration. This drives email verification and invite/admin flows. |
| [x] | Implement password hashing. | Done: app auth foundation uses Node `crypto.scrypt` with per-password random salt and stores only encoded hashes. |
| [ ] | Implement login route/server action. | In progress: `/api/auth/login` verifies credentials, creates a hashed server-side session, records auth audit events, and sets the HTTP-only app session cookie. Still needs route-level rate limiting, account lockout behavior updates, and product smoke against a seeded user. |
| [x] | Implement logout. | Done: `/api/auth/logout` revokes the server-side session by hashed token and clears the cookie. Desktop sidebar and mobile dock now call it. Product smoke with seeded app-auth users remains under validation. |
| [ ] | Implement session validation middleware. | Replace Supabase SSR middleware with app session lookup, protected-route handling, and redirect-to-login behavior. |
| [ ] | Replace `getCachedUser()`. | In progress: `getCachedUser()` already resolves app sessions under `APP_AUTH_BACKEND=postgres`, and `getAuthenticatedRouteUser()` wraps required route auth. Remaining work is to move server components/actions to the neutral helper shape and then retire the Supabase-named module. |
| [ ] | Replace RBAC helpers. | In progress: helpers now accept app-owned users with `roles` while still accepting Supabase-shaped users during migration. Route/layout consumers still need to move to app auth helpers. |
| [ ] | Implement password reset. | Use single-use hashed reset tokens, expiry, email delivery, and rate limiting. |
| [ ] | Implement email verification if self-sign-up remains. | If users are admin-provisioned only, document why verification can be skipped or handled out-of-band. |
| [x] | Replace browser Supabase auth clients. | Done for current runtime browser clients: login posts to `/api/auth/login`, desktop/mobile logout post to `/api/auth/logout`, and settings/create/ProfileGuard read/write profile state through `/api/recruiter/profile`. Self-sign-up/provisioning policy remains a separate auth work item. |
| [ ] | Preserve E2E test auth seam. | Keep local E2E mode useful without live auth credentials. |
| [ ] | Add auth tests. | In progress: focused tests cover scrypt password hashing/verification, successful/failed password login orchestration, hashed session lookup/revocation, audit writes, DB-role RBAC, login cookie setting, and logout cookie clearing. Still need middleware, password reset, lockout/rate-limit, browser UI, and product smoke tests. |

### Phase 4 - Candidate Flow Preservation

| Status | Work item | Notes / done when |
| --- | --- | --- |
| [ ] | Preserve `/s/[token]` invite entry. | Candidate should still open one link and enter practice without creating an account. |
| [ ] | Preserve initials/intake/resume behavior. | Candidate entry should stay low-friction and match current product intent. |
| [ ] | Preserve answer submission and recovery behavior. | Include the session-recovery patch decision before final migration validation. |
| [ ] | Preserve TTS/candidate API authorization. | Any candidate API using `x-candidate-token` and `x-session-id` should keep equivalent protection. |
| [ ] | Preserve practice-again links. | Debrief email links should resolve to the new host and validate token/session state correctly. |

### Phase 5 - Supabase Unwiring And Runtime Cleanup

| Status | Work item | Notes / done when |
| --- | --- | --- |
| [ ] | Remove `src/lib/supabase/*` runtime dependency. | Delete or retire Supabase server/middleware helpers after replacements are in place. |
| [ ] | Remove Supabase packages. | Remove `@supabase/ssr` and `@supabase/supabase-js` once no runtime/test imports remain. |
| [ ] | Replace Supabase `User` types. | Components, RBAC, tests, and E2E helpers should use app-owned user types. |
| [ ] | Remove Supabase env requirements. | Update `.env.example`, environment matrix, production contract tests, and runbooks to remove `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. |
| [ ] | Rename backend configuration values. | Replace `METRICS_BACKEND=supabase` and `RATE_LIMIT_BACKEND=supabase` with Postgres-oriented names or values. |
| [ ] | Update docs that name Supabase as current auth/data provider. | Requirements, architecture, deployment validation, incident runbooks, and quality docs should reflect standalone Postgres/app-auth reality. |
| [ ] | Retire or convert `supabase/` migrations. | Either move target SQL to a neutral migrations directory or clearly mark Supabase files as historical source material. |

### Phase 6 - Product And Operational Validation

| Status | Work item | Notes / done when |
| --- | --- | --- |
| [ ] | Run unit and integration tests locally. | Include auth, repositories, invite send/resend/retry, candidate token auth, AI surfaces, metrics, rate limit, idempotency, and QA explorer. |
| [ ] | Run full product smoke locally. | Recruiter login, profile/settings, invite creation, email send, candidate practice, hints, strong response, answer feedback, session debrief, recruiter review, QA explorer. |
| [ ] | Validate deployment env. | Confirm DB connection, SMTP, Gemini, public origin, auth secrets, cookie security, logs, and target host. Local disposable Docker schema validation passed; company deployment environment validation remains open. |
| [ ] | Validate in staging/UAT. | Integration team should confirm app writes to company Postgres and logs are available in the target environment. |
| [ ] | Validate permissions. | Recruiter cannot see unauthorized sessions; admin and QA routes are role-gated; candidate tokens cannot access other sessions. |
| [ ] | Validate operational controls. | Backups, rollback plan, secret rotation path, DB connection limits, slow query visibility, alerting, and PII handling are confirmed. |
| [ ] | QA product validation. | QA runs full product regression after integration validates environment behavior. |

## Work That Can Continue Now

These items can proceed locally without waiting for the remaining integration answers:

- Replace remaining server component/action `getCachedUser()` usage with provider-neutral helpers where doing so does not force deployment-policy decisions.
- Port recruiter dashboard/profile timezone lookups that still call Supabase directly.
- Add app-auth middleware/protected-route handling to replace Supabase SSR cookie refresh.
- Add account provisioning/seeding support for phase-1 app users, while keeping self-sign-up disabled until policy is confirmed.
- Implement password reset route/token flow, unless the team confirms all users will be manually provisioned and reset handled out-of-band for phase 1.
- Run a local full-stack smoke with backend selectors pinned to `postgres` against the disposable Docker DB.
- Update production contract/env tests toward Postgres/app-auth/SMTP expectations.
- Continue removing stale Supabase assumptions from tests/docs that are no longer runtime dependencies.

## Coalesced Open Questions

These are the remaining questions that materially affect deployment readiness:

1. Hosting: What platform will host the app, what staging/UAT URL should be used, and is Node 22 approved there?
2. Secrets/env: Where are runtime secrets managed, and is the final DB env contract `DATABASE_URL`, split `POSTGRES_*`, or both?
3. Network/DB access: Can the app runtime reach Postgres over TCP, what SSL mode/cert is required, and who provides the least-privilege app DB user?
4. Migration execution: Who applies DDL/functions/triggers/indexes to the company DB, and what rollback process exists?
5. Auth policy: Are recruiter/admin/QA users seeded/admin-provisioned or self-signup, and are MFA, password complexity, expiration, lockout, audit, or verification rules required?
6. Email: What are the final Microsoft/Office365 SMTP host, port, sender format, and SMTP-auth requirements for `interviews@coach.rangam.com`?
7. Observability: Who can view app logs, query target DB records for validation, inspect failed requests by correlation ID, and receive production alerts?
8. Acceptance: Which checks belong to local development, integration-team environment validation, and QA product regression before production cutover?

## Senior Readout

With confidence, a senior engineer can say:

- The provided Postgres credentials are enough to begin the database access layer and migration planning, but not enough to declare the full migration ready.
- The current app depends on Supabase as a platform, not only as a database, so phase 1 should be estimated as full platform replacement.
- Phase-1 recruiter/admin auth should be app-owned email/password backed by Postgres, with secure server-side sessions and DB-backed roles.
- Keeping candidate token-link access is feasible and likely desirable for phase 1; it should be ported to Postgres rather than redesigned.
- The safest implementation order is: isolate the branch, inventory Supabase touchpoints, add Postgres infrastructure, port schema/functions and repositories, implement app-owned auth/session, port operational DB utilities, then remove Supabase dependencies and env requirements.
- Full Supabase removal requires auth, data access, operational backends, and browser-client cleanup. Database work can proceed now, but deployment acceptance cannot be complete until all runtime Supabase dependencies are removed and validated.
- The user should not be the sole validator unless they are given target app access, test identities, logs, and a way to confirm DB writes. A realistic signoff path is local automated tests, integration-team validation in the company deployment environment, then QA product testing.
