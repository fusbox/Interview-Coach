# Supabase Touchpoint Inventory

## Purpose

This inventory maps the Supabase dependencies that existed before the Postgres migration and records their current replacement status. For the code-review and deployment-facing summary, start with [postgres_migration_handoff.md](./postgres_migration_handoff.md). This file is the detailed appendix for reviewers who want to confirm no active Supabase runtime dependency remains.

Scope of this pass:

- Worktree: `C:\tmp\Interview-Coach-Recruiter-postgres`
- Branch: `feature/postgres-integration`
- Initial inventory: 2026-05-04
- Latest refresh: 2026-05-06 after Supabase runtime fallback removal

## Current State

The migrated runtime no longer imports Supabase packages or helper modules from `src`. Supabase remains only as historical schema/source material in the `supabase/` directory and in older docs that describe pre-migration architecture.

Validation for this refresh:

```powershell
rg -n "@/lib/supabase|@supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE_KEY|createAdminClient|Supabase[A-Za-z]+Repository|supabase-[a-z-]+|METRICS_BACKEND.*supabase|RATE_LIMIT_BACKEND.*supabase|APP_AUTH_BACKEND.*supabase" src package.json package-lock.json .env.example
npx tsc --noEmit
npx vitest run src/lib/server/auth/current-user.test.ts src/lib/server/auth/middleware.test.ts src/lib/server/auth/candidate-token.test.ts src/lib/server/auth/recruiter-profile.test.ts src/lib/server/rate-limit.test.ts src/lib/server/metrics/backend.test.ts src/lib/server/idempotency.test.ts src/lib/server/infrastructure/session-repository.test.ts src/lib/server/infrastructure/invite-repository.test.ts src/lib/server/infrastructure/template-repository.test.ts src/lib/server/infrastructure/feedback-repository.test.ts src/lib/server/ai-quality/ai-generation-repository.test.ts src/lib/server/ai-quality/ai-generation-read-repository.test.ts src/app/api/recruiter/invites/route.test.ts src/lib/server/metrics-pipeline.integration.test.ts src/lib/server/production-contract.integration.test.ts
```

Results:

- Runtime Supabase scan over `src`, package files, and `.env.example`: no active references.
- TypeScript: passed.
- Focused tests: 16 files / 63 tests passed.

## Replacement Direction

- Target deployment should use ATS-launched enterprise identity handoff for internal users, potentially Okta or equivalent.
- App-owned Postgres auth remains the local/UAT bridge and Supabase-removal proof.
- Candidate access remains token-link based: `/s/[token]` entry plus `x-candidate-token` API protection.
- Runtime data access uses server-only Postgres access through `pg`.
- Authorization is enforced in server application code plus DB constraints, not Supabase RLS semantics.
- SQL functions/procedures are preserved where they provide useful atomic behavior. Current working assumption: target Postgres can accept/run SQL queries, functions, and stored-procedure-style logic.

## Summary

| Area | Prior Supabase dependency | Current replacement | Status |
| --- | --- | --- | --- |
| Supabase client wrappers | `src/lib/supabase/server.ts` and `src/lib/supabase/middleware.ts` owned SSR auth/session behavior and service-role access. | Files removed. `src/middleware.ts` delegates to app-auth middleware, and current-user lookup uses app-session cookies plus E2E cookie support. | Done |
| Recruiter auth | Supabase email/password, signup/callback, SSR cookies, browser login/logout. | Local/UAT app-owned auth uses Postgres app users, scrypt credentials, hashed server sessions, roles, login/logout routes, and provisioning. Target production should replace/bypass with ATS/Okta handoff. | Done for bridge; target identity open |
| Candidate access | Product flow was already token-link based, but token lookup could use Supabase fallback. | Candidate tokens are issued/validated through Postgres, stored hashed at rest, and checked against active session-bound rows. | Done |
| Product repositories | Supabase query API repositories for sessions, invites, templates, feedback, and AI generations. | Runtime repositories are Postgres-backed and selected through the existing factory contracts. | Done |
| Operational stores | Supabase service-role/RPC paths for rate limits, metrics, idempotency, candidate tokens, and AI-generation records. | Postgres implementations are active; memory remains only for local/test rate-limit and metrics paths. | Done |
| Schema/RLS | `supabase/schema.sql` and migrations contained app schema plus Supabase RLS and `auth.uid()` policies. | Neutral executable schema exists at `db/migrations/001_initial_schema.sql`; authorization moved to app code and DB constraints. | Done locally; target DB validation open |
| Browser Supabase usage | Login/logout/settings/create/profile guard/mobile dock used browser Supabase clients. | Browser paths call app API routes and no longer import Supabase. | Done |
| Env/dependencies | `@supabase/ssr`, `@supabase/supabase-js`, and Supabase env vars were runtime dependencies. | Packages removed; `.env.example` uses Postgres/app-auth/SMTP env. | Done |
| Docs/tests | Tests and docs previously mocked/described Supabase as current runtime. | Core migration docs and touched tests now reflect Postgres runtime. Broader historical docs may still mention Supabase as prior-state context. | Core done; broader docs optional |

## Auth, Session, And Identity

| File / area | Prior dependency | Current state | Status |
| --- | --- | --- | --- |
| `src/lib/server/auth/current-user.ts` | Re-exported Supabase `getCachedUser()`. | Resolves app-session cookie through Postgres app-auth store, with E2E cookie support. | Done |
| `src/lib/server/auth/middleware.ts` | Replaces deleted Supabase middleware. | Redirects unauthenticated recruiter/admin/QA page requests to `/login?next=...`; public candidate pages remain open. | Done |
| `src/middleware.ts` | Delegated to Supabase migration middleware. | Delegates to app-auth middleware. | Done |
| `src/app/auth/callback/route.ts` | Exchanged Supabase auth code for session. | Supabase exchange removed. Future ATS/Okta callback/handoff can use this route or a new route if needed. | Done for Supabase removal; target identity open |
| `src/app/login/page.tsx` | Browser Supabase sign-in/sign-up. | Posts to `/api/auth/login` for local/UAT bridge. | Done for bridge; target UI cleanup open |
| `src/components/auth/LogoutButton.tsx`, `src/components/layout/RecruiterMobileDock.tsx` | Browser Supabase sign-out. | Post to `/api/auth/logout`. | Done for bridge; target UI cleanup open |
| `src/components/layout/RecruiterSidebar.tsx`, `src/components/layout/RecruiterMobileDock.tsx`, `src/lib/auth/rbac.ts`, `src/lib/e2e/test-mode.ts` | Supabase `User` type assumptions. | Use app-owned `AppUser` shape with DB-backed `roles`. | Done |
| `scripts/provision-app-user.mjs` | Not applicable. | Provisions local/UAT app users, credentials, roles, recruiter profile, and audit event directly in Postgres. | Done |

## Routes, Actions, And Pages

| Area | Prior dependency | Current state | Status |
| --- | --- | --- | --- |
| Recruiter API auth | Direct `createClient().auth.getUser()` checks in invite/question/profile/ops routes. | Routes use `getAuthenticatedRouteUser()` and app-session current-user lookup. | Done |
| Recruiter pages/actions | Server components/actions used Supabase current-user/profile paths. | Pages/actions use app-session current-user plus Postgres profile/repository helpers. | Done |
| Admin/QA pages | Layouts used Supabase current-user/profile paths. | Layouts use app-session current-user, app roles, and Postgres profile/repository helpers. | Done |
| Candidate routes | Candidate entry and APIs could select Supabase repositories during migration. | Candidate entry, token validation, session reads/writes, answer submission, feedback, hints, strong response, debrief, and practice-again use Postgres stores. | Done |
| AI quality routes | AI generation capture/read/export could select Supabase repositories during migration. | All five AI surfaces and `/qa/ai-quality` read/export use Postgres repositories. | Done |

## Repositories And Operational Stores

| Prior file / dependency | Current replacement | Status |
| --- | --- | --- |
| `src/lib/server/infrastructure/supabase-session-repository.ts` | `PostgresSessionRepository` | Done; Supabase file removed |
| `src/lib/server/infrastructure/supabase-invite-repository.ts` | `PostgresInviteRepository` | Done; Supabase file removed |
| `src/lib/server/infrastructure/supabase-template-repository.ts` | `PostgresTemplateRepository` | Done; Supabase file removed |
| `src/lib/server/infrastructure/supabase-feedback-repository.ts` | `PostgresFeedbackRepository` | Done; Supabase file removed |
| `src/lib/server/infrastructure/user_feedback_schema.sql` | `db/migrations/001_initial_schema.sql` | Done; stale Supabase/RLS helper removed |
| `SupabaseAiGenerationRepository` / `SupabaseAiGenerationReadRepository` | `PostgresAiGenerationRepository` / `PostgresAiGenerationReadRepository` | Done; Supabase classes removed |
| `supabase-candidate-token-store.ts` | Postgres candidate-token store in `candidate-token.ts` | Done; Supabase file removed |
| `supabase-idempotency-store.ts` | Postgres idempotency store in `idempotency.ts` | Done; Supabase file removed |
| `SupabaseRateLimitBackend` | `PostgresRateLimitBackend` | Done; Supabase backend removed |
| `SupabaseDurableMetricsBackend` | `PostgresDurableMetricsBackend` | Done; Supabase backend removed |

## Schema, Migrations, And RLS

| Source | Current role | Notes |
| --- | --- | --- |
| `db/migrations/001_initial_schema.sql` | Target executable schema | Use this for migrated Postgres environments. It includes app-owned auth/session/role tables, product tables, operational tables, indexes, triggers, and SQL functions. |
| `db/validation/*` | Local validation SQL | Used by repeatable disposable-DB smoke checks. |
| `supabase/schema.sql`, `supabase/migrations/*.sql` | Historical source material | Keep only if reviewers need provenance for original table/function intent. Do not deploy these files to the company Postgres environment. |
| Supabase RLS / `auth.uid()` policies | Not part of migrated runtime | Authorization is handled by app code plus DB constraints unless company DB policy later requires explicit RLS. |

## Packages, Env, And Configuration

| Item | Current state | Status |
| --- | --- | --- |
| `@supabase/ssr`, `@supabase/supabase-js` | Removed from `package.json` and `package-lock.json`. | Done |
| Supabase env vars | Removed from `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. | Done |
| Postgres env vars | `.env.example` includes `DATABASE_URL` plus split `POSTGRES_*` fallback. | Done |
| Backend selector env vars | Existing names remain, but migrated runtime accepts `postgres` only for repository/auth/idempotency/candidate-token selectors. Rate-limit and metrics accept `memory` for local/test and `postgres` for durable runtime. | Done |
| SMTP env vars | `.env.example` models Office365 SMTP values without storing a password. | Done |

## Remaining Historical Cleanup

These are not blockers to proving the migrated app works, but they affect repository neatness:

1. Decide whether to archive or delete the historical `supabase/` directory after reviewers no longer need original schema provenance.
2. Update broad non-migration docs that still describe Supabase as the active provider, especially older architecture, production validation, and quality/ops documents.
3. Decide target UI cleanup after ATS/Okta handoff: hide or remove standalone login/create-account/logout/settings identity fields.
4. Replace app-owned login bridge with enterprise identity handoff in the target deployment path.

## Open Questions Carried From Checklist

See [integration_checklist.md](./integration_checklist.md#coalesced-open-questions) for deployment-level open questions: hosting/runtime, DB connection and privileges, migration execution, identity handoff, observability, SMTP policy, target UI posture, and acceptance ownership.
