# Supabase Touchpoint Inventory

## Purpose

This inventory maps the runtime, schema, test, and documentation dependencies that must be replaced to fully unwire Supabase while preserving current app functionality.

Scope of this pass:

- Worktree: `C:\tmp\Interview-Coach-Recruiter-postgres`
- Branch: `feature/postgres-integration`
- Branch head during initial inventory: `5668696 bypass replay tour gate for 1 user`
- Latest reviewed head before this slice: `350c820 feat: remove direct profile lookups from pages`
- Date: initial inventory 2026-05-04; refreshed 2026-05-06 after porting AI-quality generation capture, browser profile/auth client cleanup, API-route auth seam work, server-page profile lookup cleanup, and app-auth middleware protected-page redirects.

## Replacement Direction

- Use app-owned email/password auth backed by Postgres for recruiter/admin users.
- Keep candidate access token-link based. Preserve `/s/[token]` entry and `x-candidate-token` API protection.
- Replace Supabase JS clients with server-only Postgres access through `pg`.
- Move authorization checks into server application code and DB constraints, not Supabase RLS semantics, unless company DB policy requires RLS.
- Preserve SQL functions/procedures where they provide useful atomic behavior.
- Remove Supabase packages and env vars only after all runtime/test imports are gone.

## Scan Commands Used

```powershell
rg -n "@supabase|supabase|Supabase|SUPABASE|createClient\(|createAdminClient\(|createBrowserClient\(|getCachedUser\(|\.auth\.|\.rpc\(|auth\.uid\(|METRICS_BACKEND|RATE_LIMIT_BACKEND" src supabase docs package.json
rg -l "createBrowserClient|supabase\.auth|auth\.getUser|signInWithPassword|signUp|signOut|exchangeCodeForSession|getCachedUser" src
rg -l "createAdminClient|SUPABASE_SERVICE_ROLE_KEY|\.rpc\(" src
rg -n "create table|create type|create or replace function|create policy|enable row level security|auth\.uid\(" supabase/schema.sql supabase/migrations
```

## Summary

| Area | Current dependency | Replacement direction | Risk | Status |
| --- | --- | --- | --- | --- |
| Supabase client wrappers | `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts` own current server auth fallback/session behavior. Browser Supabase clients have been removed from runtime app paths, and app-auth middleware mode now avoids importing Supabase/Postgres auth internals for protected-page redirects. | Replace remaining server wrapper/middleware fallback with app auth/session helpers and Postgres pool. | High | In progress |
| Recruiter auth | Supabase email/password, signup, auth callback, SSR cookies remain as fallback concepts; app-owned login/logout/session code now exists. | App-owned email/password auth, secure HTTP-only session cookie, DB-backed roles. | High | In progress |
| Candidate access | Candidate token data is still selectable through Supabase fallback, but the candidate auth model is app-token based and has a Postgres backend seam. | Pin candidate token/session/invite backends to Postgres and validate UX unchanged. | Medium | In progress |
| Product repositories | Session, invite, template, feedback repositories call Supabase query API directly. | Implement Postgres-backed repositories behind the same domain/application contracts. | High | In progress |
| Operational stores | Rate limits, metrics, idempotency, candidate tokens, and AI-quality generation records use service-role Supabase access and RPCs/tables. | Port tables/functions/backends to Postgres. | High | In progress |
| Schema/RLS | `supabase/schema.sql` and migrations contain app schema plus Supabase RLS and `auth.uid()` policies. Neutral migration SQL now exists separately. | Validate neutral Postgres migrations in target DB; replace RLS reliance with app authorization or explicit DB policy. | High | In progress |
| Browser Supabase usage | Login/logout/settings/create/profile guard/mobile dock used `createBrowserClient`. Those runtime browser paths now call app API routes instead. | Continue server-side auth/helper migration; no runtime `createBrowserClient` path should remain. | High | Done |
| Env/dependencies | Supabase packages and env vars are required by runtime and tests. | Remove after replacement paths land. | Medium | Open |
| Docs/tests | Production docs, runbooks, tests, and mocks assume Supabase. | Update after code migration and preserve E2E-only test seam. | Medium | Open |

## Auth, Session, And Identity

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `src/lib/supabase/server.ts` | Creates user-scoped Supabase SSR client, service-role client, and fallback `getCachedUser()` via `supabase.auth.getUser()`. Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` while fallback remains. | `getCachedUser()` now resolves app sessions when `APP_AUTH_BACKEND=postgres`; new required route auth goes through `getAuthenticatedRouteUser()`. Later rename/retire the Supabase module after fallback runtime is removed. | Central seam. Keep E2E test mode behavior when replacing `getCachedUser()`. | In progress |
| `src/lib/supabase/middleware.ts` | Supabase mode still refreshes Supabase cookies and calls `supabase.auth.getUser()` when `sb-` cookies exist. App-auth mode now checks only for the app session cookie/E2E cookie and redirects missing-session recruiter/admin/QA page requests to login. | Retire Supabase fallback after app auth is the only runtime, and eventually rename/move this module out of `supabase/`. | Must preserve no-auth candidate/public route behavior. Middleware remains lightweight; layouts/route handlers provide authoritative DB-backed auth. | In progress |
| `src/middleware.ts` | Delegates all middleware behavior to the migration middleware module. | Later delegate to renamed app-auth middleware after Supabase fallback removal. | Keep static asset exclusions. | In progress |
| `src/app/login/page.tsx` | Previously called browser Supabase `signInWithPassword()` and `signUp()`. | Login now posts to `/api/auth/login`; self-sign-up is paused in app-auth mode until provisioning policy is decided. | Decide self-sign-up vs admin-provisioned users. If self-sign-up remains, add email verification. | In progress |
| `src/app/auth/callback/route.ts` | Exchanges Supabase auth code for session. | Remove or repurpose for email verification/password reset flows. Login should create app session directly after credential verification. | Delete only after all links/routes stop using it. | Open |
| `src/components/auth/LogoutButton.tsx` | Previously called browser Supabase `signOut()`. | Now calls `/api/auth/logout`, which revokes the app session and clears the cookie. | Desktop logout path moved. | Done |
| `src/components/layout/RecruiterMobileDock.tsx` | Previously called browser Supabase `signOut()`. | Now calls `/api/auth/logout`; prop typing accepts app-owned users and Supabase-shaped users during migration. | Mobile logout path moved. | Done |
| `src/components/layout/RecruiterSidebar.tsx` | Imports Supabase `User` type for recruiter identity. | Use app user type. | Type-only replacement, but linked to RBAC change. | Open |
| `src/components/auth/ProfileGuard.tsx` | Previously used browser Supabase `getUser()` and profile lookup from `recruiter_profiles`. | Now calls `/api/recruiter/profile`; the server endpoint resolves the current user and profile through the selected auth/data backend. | Guard no longer needs browser-direct DB access and now runs under app auth. | Done |
| `src/app/(recruiter)/recruiter/settings/page.tsx` | Previously used a browser Supabase client to read/write recruiter profile. | Now uses `/api/recruiter/profile` for load/save and hydrates saved state from the returned server record. | Preserve profile fields and save UX. | Done |
| `src/app/(recruiter)/recruiter/create/page.tsx` | Previously used browser Supabase `getUser()` and `recruiter_profiles` lookup. | Now fetches `/api/recruiter/profile` for current user email/profile and still loads templates through existing server actions. | Create-invite flow depends on current user email/profile for sender info. | Done |
| `src/app/(recruiter)/recruiter/layout.tsx` | Uses `getCachedUser()` and previously used Supabase profile lookup. | `getCachedUser()` can read app sessions when `APP_AUTH_BACKEND=postgres`; layout uses a server profile loader and always renders ProfileGuard. | Remaining work is replacing broader server-side auth helpers, not profile-guard bypass cleanup. | In progress |
| `src/app/(recruiter)/recruiter/page.tsx` | Uses `getCachedUser()` plus the app-auth-compatible profile helper. Direct Supabase profile lookup has been removed from the page. | Replace `getCachedUser()` with a neutral server-component auth helper after auth migration. Dashboard session/profile data can already select Postgres through repository/profile seams. | Dashboard/session list entry point. | In progress |
| `src/app/(recruiter)/recruiter/sessions/[id]/page.tsx` | Uses `getCachedUser()` plus repository factory for session reads. | Replace `getCachedUser()` with app auth helper after auth migration. Session data can already select Postgres with `SESSION_REPOSITORY_BACKEND=postgres`. | Must preserve recruiter ownership/admin access checks. | In progress |
| `src/app/(recruiter)/admin/layout.tsx` | Uses `getCachedUser()` and previously used Supabase profile lookup. | `getCachedUser()` can read app sessions when `APP_AUTH_BACKEND=postgres`; layout now uses DB-backed RBAC-compatible roles and a server profile loader. | Some admin child pages may still call Supabase directly. | In progress |
| `src/app/(recruiter)/admin/feedback/page.tsx` | Uses `getCachedUser()` plus the app-auth-compatible profile helper for timezone and the repository factory for feedback admin rows. Direct Supabase profile lookup has been removed from the page. | Replace `getCachedUser()` with a neutral server-component auth helper after auth migration. Feedback data can already select Postgres with `FEEDBACK_REPOSITORY_BACKEND=postgres`. | Admin-only data view; route-level authorization still depends on admin layout/RBAC migration. | In progress |
| `src/app/(recruiter)/recruiter/dev-eval/page.tsx` and `[id]/page.tsx` | Previously used `getCachedUser()` for internal dev-eval routes. | Retired by the AI-quality port in favor of `/qa/ai-quality` handoff/evaluator surfaces. | Confirm no deployment links still point to these routes before final cleanup. | Done |
| `src/lib/auth/rbac.ts` | Previously imported Supabase `User` directly and relied on hardcoded admin/QA allowlists plus metadata roles. | App-owned `AppUser` shape and DB-backed `roles` are now accepted while Supabase-shaped users remain compatible during migration. | Temporary allowlists still bridge migration but should not be final. Route/layout consumers still need app auth helper wiring. | In progress |
| `src/lib/e2e/test-mode.ts` | Uses Supabase `User` type for E2E fake user. | Replace with app user type while preserving E2E cookie behavior. | Important for local smoke tests without live auth. | Open |

## Auth Checks In API Routes And Server Actions

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `src/app/api/invite/send/route.ts` | Previously called `createClient().auth.getUser()` and recorded `missing_supabase_user`. | Now uses `getAuthenticatedRouteUser()`, which can resolve app sessions or Supabase fallback users through `getCachedUser()`. | Invite send is core recruiter flow. | Done |
| `src/app/api/invite/resend/route.ts` | Previously called `createClient().auth.getUser()`. | Now uses `getAuthenticatedRouteUser()`. | Preserve resend authorization and logging. | Done |
| `src/app/api/questions/generate/route.ts` | Previously called `createClient().auth.getUser()` before generating questions. | Now uses `getAuthenticatedRouteUser()` and preserves unauthorized metrics. | Core recruiter AI surface. | Done |
| `src/app/api/recruiter/invites/route.ts` | Previously called `createClient().auth.getUser()`; invite repository already goes through `createInviteRepository()`. | Now uses `getAuthenticatedRouteUser()`. Postgres invite repository can be selected with `INVITE_REPOSITORY_BACKEND=postgres` once final route-stack env is ready. | Batch invite creation still depends on idempotency and rate-limit backend selectors being pinned to Postgres for cutover. | Done |
| `src/app/api/recruiter/invites/[batch_id]/retry/route.ts` | Previously called `createClient().auth.getUser()`; retry app default already goes through `createInviteRepository()`. | Now uses `getAuthenticatedRouteUser()`. | Must preserve batch ownership. | Done |
| `src/app/api/recruiter/ops/metrics/route.ts` | Previously called `createClient().auth.getUser()` for GET/POST. | Now uses `getAuthenticatedRouteUser()`. Add stricter admin/ops role gating before production cutover if this endpoint is retained. | Operational visibility should not be broad recruiter access. | In progress |
| `src/app/actions/feedback.ts` | Uses `getCachedUser()` only to attach recruiter ID for `recruiter_` signals; feedback persistence uses repository factory. | Replace `getCachedUser()` with app session helper after auth migration. Feedback data can already select Postgres with `FEEDBACK_REPOSITORY_BACKEND=postgres`. | Candidate feedback remains unauthenticated; recruiter ID remains optional unless signal is recruiter-side and user is available. | In progress |
| `src/app/(recruiter)/recruiter/actions.ts` | Uses `getCachedUser()` plus repository factory for session list/delete. | Replace `getCachedUser()` with app session helper after auth migration. Session data can already select Postgres with `SESSION_REPOSITORY_BACKEND=postgres`. | Dashboard/session actions. | In progress |
| `src/app/(recruiter)/recruiter/templates/actions.ts` | Uses `getCachedUser()` and `isAdmin()` plus repository factory for template list/create/update/delete. | Replace `getCachedUser()`/hardcoded admin email with app session helper and DB roles after auth migration. Template data can already select Postgres with `TEMPLATE_REPOSITORY_BACKEND=postgres`. | Admin/shared template behavior is now explicit in repository scope. | In progress |

## Product Data Repositories

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `src/lib/server/infrastructure/supabase-session-repository.ts` | Direct `.from()` operations on `sessions`, `questions`, `answers`, `eval_results`; service-role access; RPC `increment_session_engagement`. | `PostgresSessionRepository` exists behind `createSessionRepository()` and `SESSION_REPOSITORY_BACKEND=postgres`. Keep Supabase implementation only as migration fallback until final cutover. | High blast radius: dashboard, candidate practice, answer save, analysis, debrief, recovery. Docker-backed Postgres integration coverage exists. | In progress |
| `src/lib/server/infrastructure/supabase-invite-repository.ts` | Direct `.from()` on `sessions`, `questions`, `candidate_tokens`, `invite_batches`, `invite_batch_candidates`; RPC `create_invite_batch`; Supabase client injection. | `PostgresInviteRepository` exists and is selected through `createInviteRepository()`. Keep Supabase implementation only as migration fallback until route dependencies move. | Core invite flow; batch retry/ownership must remain correct. | In progress |
| `src/lib/server/infrastructure/supabase-template-repository.ts` | Supabase client, `SupabaseClient` type, `auth.getUser()`, `recruiter_templates` table/RLS. | `PostgresTemplateRepository` exists behind `createTemplateRepository()` and `TEMPLATE_REPOSITORY_BACKEND=postgres`. Keep Supabase implementation only as migration fallback until final cutover. | Ownership/shared visibility/admin override are enforced explicitly by `userId` and `canManageAllTemplates`. Docker-backed Postgres integration coverage exists. | In progress |
| `src/lib/server/infrastructure/supabase-feedback-repository.ts` | Supabase client writes/reads `user_feedback` and joins `sessions`. | `PostgresFeedbackRepository` exists behind `createFeedbackRepository()` and `FEEDBACK_REPOSITORY_BACKEND=postgres`. Keep Supabase implementation only as migration fallback until final cutover. | Docker-backed Postgres integration coverage validates capture, update, recruiter-only insert, and admin view join shape. | In progress |
| `src/lib/server/infrastructure/user_feedback_schema.sql` | SQL schema for feedback table and policies. | Neutral `user_feedback` table, indexes, constraints, and app-owned user FK are included in `db/migrations/001_initial_schema.sql`; Supabase RLS policies remain historical only. | Admin-read authorization is handled in app route/layout code, not RLS. | In progress |
| `src/lib/server/ai-quality/ai-generation-repository.ts` | `SupabaseAiGenerationRepository` writes `ai_generations` through service-role Supabase access. | `PostgresAiGenerationRepository` exists behind `createAiGenerationRepository()` and `AI_GENERATION_REPOSITORY_BACKEND=postgres`. Keep Supabase implementation only as migration fallback until final cutover. | Capture must not block AI user flows; fallback capture behavior remains in `capture-ai-generation.ts`. Focused Postgres query/serialization tests exist. | In progress |
| `src/lib/server/ai-quality/ai-generation-read-repository.ts` | `SupabaseAiGenerationReadRepository` reads `ai_generations` through service-role access and optionally calls `get_ai_generation_summary`. | `PostgresAiGenerationReadRepository` exists behind `createAiGenerationReadRepository()` and supports list, page, summary, and find-by-id queries. | `/qa/ai-quality` widgets must count filtered total records, not just current page rows. Focused Postgres read tests exist. | In progress |
| `src/lib/server/api-handler-utils.ts` | Uses repository factory for session lookup. | Complete for session repository selection. Continue auth migration separately. | Shared API helper can select Supabase or Postgres by env. | Done |
| `src/lib/server/application/session/get-session.ts` | Uses repository factory. | Complete for session repository selection. | Application layer no longer names Supabase for session lookup. | Done |
| `src/lib/server/application/session/start-session.ts` | Uses repository factory. | Complete for session repository selection. | Candidate start path can select Supabase or Postgres by env. | Done |
| `src/lib/server/application/session/update-session.ts` | Uses repository factory. | Complete for session repository selection. | Candidate progress/update path can select Supabase or Postgres by env. | Done |
| `src/lib/server/application/invites/create-invite-batch.ts` | Previously dynamically imported `SupabaseInviteRepository`; now uses `createInviteRepository()`. | Complete for invite repository selection. Continue auth/idempotency/rate-limit migration separately. | Batch creation path can select Supabase or Postgres by env. | Done |
| `src/lib/server/application/invites/retry-invite-batch.ts` | Previously dynamically imported `SupabaseInviteRepository`; now uses `createInviteRepository()`. | Complete for invite repository selection. Continue auth/idempotency/rate-limit migration separately. | Retry path can select Supabase or Postgres by env. | Done |
| `src/lib/server/application/invites/send-invite-email.ts` | Uses repository factory for marking invitation sent. | Complete for session repository selection. Continue auth/email branch reconciliation separately. | Email sent-state write can select Supabase or Postgres by env. | Done |
| `src/lib/server/application/invites/resend-invite-email.ts` | Uses repository factory for marking invitation sent. | Complete for session repository selection. | Invite resend path can select Supabase or Postgres by env. Email provider is SMTP/nodemailer at the adapter layer. | Done |

## Candidate Token And Candidate Routes

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `src/lib/server/auth/candidate-token.ts` | Previously used `createAdminClient()` and `candidate_tokens`; now delegates through a candidate-token backend seam. | `CANDIDATE_TOKEN_BACKEND=postgres` selects `PostgresCandidateTokenStore`; Supabase remains the default during migration. | Candidate UX can stay unchanged. Postgres validates hash-at-rest tokens, session binding, `revoked_at`, and `expires_at`. | In progress |
| `src/app/(candidate)/s/[token]/page.tsx` | Previously used `SupabaseInviteRepository.getByToken()` directly; now uses `createInviteRepository()`. | Complete for invite repository selection. Candidate token validation deeper in APIs remains separate. | Initial candidate entry can select Supabase or Postgres by env. | Done |
| `src/app/(candidate)/s/[token]/layout.tsx` | Previously used `SupabaseInviteRepository.getByToken()` directly; now uses `createInviteRepository()`. | Complete for invite repository selection. Candidate token validation deeper in APIs remains separate. | Layout metadata/session lookup can select Supabase or Postgres by env. | Done |
| `src/app/(candidate)/s/[token]/practice-again/page.tsx` | Indirectly depends on invite/session repository behavior. | Validate after token repository port. | Debrief email link path. | Open |
| `src/app/api/session/[session_id]/questions/[question_id]/answer/route.ts` | Uses repository factory for draft saves. | Complete for session repository selection. Set `SESSION_REPOSITORY_BACKEND=postgres` with `CANDIDATE_TOKEN_BACKEND=postgres` when validating the migrated candidate route stack. | Candidate answer draft/read path. | Done |
| `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts` | Uses repository factory for analysis cleanup and session update; uses candidate token auth through shared path. | Complete for session repository selection. Set `SESSION_REPOSITORY_BACKEND=postgres` and `CANDIDATE_TOKEN_BACKEND=postgres` together when route dependencies are ready. | Core submit path; include session-recovery patch before final validation. | Done |
| `src/app/api/session/[session_id]/questions/[question_id]/analysis/route.ts` | Uses repository factory for feedback/session updates. | Complete for session repository selection. | Answer feedback path can select Supabase or Postgres by env. | Done |
| `src/app/api/session/[session_id]/questions/[question_id]/retry/route.ts` | Uses repository factory for analysis deletion. | Complete for session repository selection. | Retry behavior must preserve attempts. | Done |

## Operational Backends

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `src/lib/server/rate-limit.ts` | Backend names now include `memory`, `supabase`, and `postgres`; production still defaults to Supabase during migration. | Pin `RATE_LIMIT_BACKEND=postgres` for migrated environments once surrounding runtime dependencies are ready. Preserve memory local/test behavior only. | Production cannot use memory. | In progress |
| `src/lib/server/rate-limit/backend.ts` | `SupabaseRateLimitBackend` still calls RPC `consume_rate_limit_bucket`; `PostgresRateLimitBackend` now calls the neutral Postgres function directly through `pg`. | Keep both during migration, remove Supabase backend after full cutover. | Postgres implementation has been validated for concurrent consumption against disposable Docker Postgres. | In progress |
| `src/lib/server/metrics/backend.ts` | `MetricsBackendName` now includes `memory`, `supabase`, and `postgres`; `SupabaseDurableMetricsBackend` remains for migration fallback and `PostgresDurableMetricsBackend` now uses `pg`. | Pin `METRICS_BACKEND=postgres` in migrated environments and remove Supabase backend after full cutover. | Dashboard/ops route contract is preserved through the same snapshot and SLO summary shapes. | In progress |
| `src/lib/server/idempotency.ts` | Previously used `createAdminClient()` with `api_idempotency_keys`; now delegates through an idempotency backend seam. | `IDEMPOTENCY_BACKEND=postgres` selects `PostgresIdempotencyStore`; Supabase remains the default during migration. | Core protection for replay/retry. Final cutover needs route-stack validation with auth, rate-limit, idempotency, invite, and session backends pinned to Postgres. | In progress |
| `src/lib/server/auth/app-auth.ts`, `app-auth-config.ts`, `app-session.ts`, `app-session-cookie.ts`, `password.ts`, `postgres-app-auth-store.ts`, `current-user.ts` | New app-owned auth foundation replacing Supabase Auth concepts. Edge-safe config/cookie helpers are split from heavier auth/session modules for middleware use. | Uses scrypt password hashes, opaque hashed app-session tokens, `app_users`, `app_user_credentials`, `app_sessions`, `app_user_roles`, and `auth_audit_events`. `APP_AUTH_BACKEND=postgres` activates app-session lookup through `getCachedUser()`; `getAuthenticatedRouteUser()` now centralizes required API-route auth and auth-denial metrics. | Runtime login/logout, protected-page redirects, and key recruiter API routes are active through the migration seam. Remaining work is server components/actions, password reset/provisioning, and final Supabase fallback removal. | In progress |
| `src/lib/server/ai-quality/capture-ai-generation.ts` | Previously defaulted directly to `SupabaseAiGenerationRepository`. | Defaults through `createAiGenerationRepository()` so migrated environments can capture to Postgres with `AI_GENERATION_REPOSITORY_BACKEND=postgres`. | Capture fallback remains best-effort so AI surfaces can continue if persistence fails. | In progress |
| `src/lib/server/production-contract.integration.test.ts` | Production contract stubs Supabase-oriented env/backend values. | Update to Postgres env and app-auth requirements. | Important release guard. | Open |

## Schema, Migrations, And RLS

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `supabase/schema.sql` | Base DDL plus Supabase RLS, public policies, `auth.uid()`, Supabase-friendly comments. | Convert to neutral Postgres schema/migrations. Preserve tables/enums/constraints; remove or replace Supabase policies. | Do not copy permissive public policies blindly. | Open |
| `supabase/migrations/20240208_recruiter_profiles.sql` | `recruiter_profiles` plus RLS using `auth.uid()`. | Port table; map `recruiter_id` to app user id. Authorization in app code or neutral DB policy. | Auth identity migration hinge. | Open |
| `supabase/migrations/20240224_create_recruiter_templates.sql` | `recruiter_templates` plus RLS using `auth.uid()`. | Table/indexes are included in neutral schema; ownership/shared rules are now enforced by `PostgresTemplateRepository` instead of Supabase RLS. | Docker-backed template repository test validates recruiter-owned, shared, private, and admin paths. | In progress |
| `supabase/migrations/20260317_add_api_idempotency_keys.sql` | `api_idempotency_keys` plus policies using `auth.uid()`. | Table/constraints are included in neutral schema and validated locally; Supabase RLS policies are not carried forward. | Race-safety matters more than RLS here. `actor_id` remains UUID-shaped for now. | In progress |
| `supabase/migrations/20260317_add_atomic_engagement_increment.sql` | Function `increment_session_engagement`. | Included in neutral schema and called by `PostgresSessionRepository`. | Docker-backed session repository integration test validates the function path. | In progress |
| `supabase/migrations/20260325_add_metrics_rollups.sql` | Metrics rollup tables and functions. | Tables/functions are included in neutral schema and validated locally through `PostgresDurableMetricsBackend`. | Used by metrics backend and ops route. | In progress |
| `supabase/migrations/20260325_add_rate_limit_buckets.sql` | Rate-limit table and function `consume_rate_limit_bucket`. | Table/function are included in neutral schema and validated locally. | Atomic consumption validated through the Postgres backend integration test. | In progress |
| `supabase/migrations/20260326_add_atomic_invite_batch.sql` | Function `create_invite_batch`. | Port function or implement app transaction. | Core batch invite consistency. | Open |
| `supabase/migrations/20260328_add_invite_batch_tracking.sql` | Invite batch tracking tables. | Port tables and constraints. | Used by batch retry and send status. | Open |
| `supabase/migrations/20260429_add_ai_generations.sql`, `20260429_harden_ai_generations.sql`, `20260503_add_ai_generation_summary_rpc.sql` | AI-quality table, indexes, retention/source columns, and summary function. | Included in neutral schema, with no Supabase RLS dependency. Postgres read repository computes summary directly and the function is retained for compatibility/smoke validation. | AI-quality table is used by all five AI surfaces and `/qa/ai-quality`. | In progress |
| `supabase/fix_public_read.sql`, `supabase/fix_sessions_rls.sql`, `supabase/updates.sql` | Supabase policy repair scripts and `auth.uid()` assumptions. | Treat as historical context only unless specific data shape changes are still needed. | Avoid carrying old public access policy into new DB. | Open |

## Browser Supabase Usage

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `src/app/login/page.tsx` | Previously used `createBrowserClient` for sign in/sign up. | Login now posts to `/api/auth/login`; self-sign-up remains open until provisioning policy is decided. | Browser Supabase login path moved. | Done |
| `src/components/auth/LogoutButton.tsx` | Previously used `createBrowserClient` for sign out. | Now posts to `/api/auth/logout`. | Desktop logout moved. | Done |
| `src/components/layout/RecruiterMobileDock.tsx` | Previously used `createBrowserClient` for sign out. | Now posts to `/api/auth/logout`. | Mobile logout moved. | Done |
| `src/components/auth/ProfileGuard.tsx` | Previously used browser `getUser()` and DB query. | Now calls `/api/recruiter/profile`. | Avoid browser DB access entirely. | Done |
| `src/app/(recruiter)/recruiter/settings/page.tsx` | Previously used browser Supabase profile operations. | Now calls `/api/recruiter/profile` for load/save. | Profile UX. | Done |
| `src/app/(recruiter)/recruiter/create/page.tsx` | Previously used browser Supabase current-user/profile lookup. | Now calls `/api/recruiter/profile` for current user/profile state. | Invite creation depends on recruiter metadata. | Done |

## Packages, Env, And Configuration

| File | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `package.json` | Dependencies `@supabase/ssr`, `@supabase/supabase-js`; `pg` and `@types/pg` already present. | Remove Supabase packages after runtime/test imports are gone. Keep/use `pg`. | Package cleanup should be late in migration. | Open |
| `docs/05-quality/environment_variable_matrix.md` | Documents Supabase URL, anon key, service role, `METRICS_BACKEND=supabase`, `RATE_LIMIT_BACKEND=supabase`. | Replace with Postgres/app-auth env matrix. | Docs should change after implementation decisions are stable. | Open |
| Production/deployment docs | `docs/05-quality/production_deployment_validation_checklist_2026-03-26.md` and related docs require Supabase access/backends. | Replace with Postgres migration/app-auth validation. | Should align with integration team signoff path. | Open |
| Runtime env usage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. | Replace with `DATABASE_URL`/`POSTGRES_*`, app auth secrets, cookie/session env, and app DB user config. | Remove client-exposed DB/auth identifiers. | Open |
| Backend selector env | `SESSION_REPOSITORY_BACKEND`, `INVITE_REPOSITORY_BACKEND`, `TEMPLATE_REPOSITORY_BACKEND`, `FEEDBACK_REPOSITORY_BACKEND`, `AI_GENERATION_REPOSITORY_BACKEND`, `CANDIDATE_TOKEN_BACKEND`, `IDEMPOTENCY_BACKEND`, `RATE_LIMIT_BACKEND`, and `METRICS_BACKEND` now accept `postgres` in addition to migration fallback values. | Pin these to `postgres` in migrated environments and update production contract tests before final cutover. | Consider transitional Supabase compatibility only during migration. | In progress |

## Tests And Mocks

| File family | Supabase dependency | Replacement direction | Risk/notes | Status |
| --- | --- | --- | --- | --- |
| `src/lib/server/infrastructure/supabase-session-repository.test.ts` | Tests Supabase repository behavior/mocking. | Replace or port to Postgres repository tests. | Use query-level mocks or test DB strategy. | Open |
| API route tests under `src/app/api/**` | Many mock `@/lib/supabase/server` or Supabase repositories. | Replace with app auth/repository mocks. | Useful coverage should be preserved, not deleted blindly. | Open |
| `src/app/(recruiter)/recruiter/actions.test.ts` | Mocks Supabase auth/repository. | Replace with app auth/repository mocks. | Dashboard actions coverage. | Open |
| `src/app/(recruiter)/recruiter/settings/page.test.tsx` | Previously mocked `@supabase/ssr`. | Now mocks `/api/recruiter/profile` fetch responses. | UI behavior remains covered. | Done |
| `src/lib/server/rate-limit.test.ts` | Covers memory, Supabase, and Postgres backend selection/query contract. | Later update production default expectations when the branch cuts over from Supabase fallback to Postgres-only runtime. | Release guard. | In progress |
| `src/lib/server/metrics/backend.test.ts` and metrics integration tests | Covers memory, Supabase, and Postgres backend selection plus durable snapshot/SLO normalization. | Later update production default expectations when the branch cuts over from Supabase fallback to Postgres-only runtime. | Docker-backed Postgres metrics integration test now validates rollup writes, snapshot reads, and SLO reads. | In progress |
| `src/lib/server/auth/candidate-token.test.ts` | Covers Supabase fallback and Postgres backend selector/query behavior. | Later update production default expectations when the branch cuts over from Supabase fallback to Postgres-only runtime. | Docker-backed Postgres candidate-token integration test validates hash-at-rest storage, session binding, and expired/revoked rejection. | In progress |
| `src/lib/server/auth/app-auth.test.ts`, `src/lib/auth/rbac.test.ts`, `src/app/api/auth/*/route.test.ts`, `src/lib/supabase/middleware.test.ts` | New app-auth foundation, route, and middleware tests. | Preserve and expand as remaining browser UI, middleware, password reset, and product smoke paths are wired. | Covers password hashing, password login orchestration, session token hashing, session revocation, audit writes, app-role RBAC, login cookie setting, logout cookie clearing, and app-auth middleware redirect/allow behavior. | In progress |
| E2E test mode | `src/lib/e2e/test-mode.ts` returns Supabase-shaped user. | Return app-user shaped fake user. | Keep E2E smoke tests independent of live auth. | Open |

## Documentation Follow-Up

| File / area | Supabase dependency | Replacement direction | Status |
| --- | --- | --- | --- |
| `docs/02-requirements/use-cases/v2/UC-R0-Recruiter-Login.md` | Names Supabase Auth in recruiter login use case. | Update once app-owned auth lands. | Open |
| `docs/04-architecture/e2e-flow.md` | Names Supabase Postgres/Auth. | Update to company Postgres/app auth. | Open |
| `docs/04-architecture/state-and-streaming-contract.md` | Mentions Postgres/Supabase and RLS. | Update storage/auth boundary after migration. | Open |
| `docs/04-architecture/adr-rate-limit-backend.md` | Selects Supabase/Postgres RPC backend. | Revise to company Postgres implementation. | Open |
| `docs/04-architecture/adr-invite-batch-consistency.md` | References Supabase invite repository. | Revise repository details after port. | Open |
| `docs/05-quality/*production*`, `docs/05-quality/ops_alert_policy.md` | Supabase deployment/backend assumptions. | Update release validation and ops runbooks. | Open |

## Implementation Order Suggested By Inventory

1. Add neutral Postgres client and migration strategy.
2. Create app auth/user/session/role schema.
3. Port schema/functions without relying on Supabase RLS.
4. Replace `src/lib/supabase/server.ts` consumers with app auth helpers or repository access.
5. Port candidate token storage/validation.
6. Port session and invite repositories first.
7. Port templates, feedback, idempotency, rate limit, and metrics.
8. Replace remaining server components/actions and middleware Supabase auth usage.
9. Replace tests/mocks and production contract env expectations.
10. Remove Supabase packages/env/docs.

## Open Questions Carried From Checklist

- Final staging/UAT URL and deployment platform.
- Final env contract: `DATABASE_URL`, individual `POSTGRES_*`, or both.
- Final production DB user and privileges.
- Whether self-sign-up remains or users are admin-provisioned.
- Whether email verification is required for recruiter/admin users.
- DB inspection/log access path for integration validation.
