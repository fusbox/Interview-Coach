# Target Schema Reconciliation Plan

## Purpose

This document reconciles the current Supabase-backed schema sources into a neutral Postgres target plan for the phase-1 standalone app.

It is not executable DDL. Its job is to make the target database shape explicit before creating migration SQL.

## Source Inputs

| Source | Use | Confidence | Gaps |
| --- | --- | --- | --- |
| [db_schema.md](./db_schema.md) | Current exported Supabase `public` table snapshot. Best source for observed public tables and columns, including newer `ai_generations`. | Medium-high for table/column inventory. | Header says it is context-only and not runnable. Omits enum definitions, indexes, triggers, functions, RLS policies, auth schema, and executable ordering. |
| `supabase/schema.sql` | Original walking-skeleton schema, core enums, core tables, indexes, triggers, and RLS context. | High for original product tables and enum intent. | Stale relative to later migrations and live schema. Contains Supabase RLS/auth assumptions that should not carry forward unchanged. |
| `supabase/migrations/*.sql` | Incremental schema additions, operational functions, metrics/rate-limit functions, invite batch behavior, AI-quality generation capture, and indexes. | High for repo-known behavior. | Includes both historical Supabase/RLS assumptions and newer AI-quality migrations; neutral schema intentionally keeps table/function behavior without Supabase RLS. |
| [supabase_touchpoint_inventory.md](./supabase_touchpoint_inventory.md) | Runtime behavior inventory of app reads/writes and Supabase APIs to replace. | High for code-path scope in this branch. | Refreshed after porting AI-quality generation capture. |

## Target Principles

| Principle | Decision |
| --- | --- |
| Supabase replacement scope | Treat phase 1 as full Supabase replacement: database access, auth/session behavior, service-role reads/writes, and RPC/function calls. |
| Candidate entry | Preserve token-link candidate access. Candidates should not need accounts in phase 1. |
| Recruiter/admin/QA identity | Replace Supabase Auth with app-owned users, credentials, sessions, and roles in Postgres. |
| Authorization | Prefer server-side authorization in application code plus DB constraints. Do not depend on Supabase RLS semantics unless company DB policy requires RLS. |
| Historical data | Fresh target DB is acceptable for phase 1. Existing Supabase records remain in the current Supabase project if needed later. |
| SQL functions | Proceed assuming functions/procedures are allowed. Keep DB-side functions where atomicity is valuable, especially invite creation, rate limit consumption, metrics rollups, and engagement increments. User confirmed we can continue with the assumption that the company DB can accept/run queries/functions and that stored procedures are used. |
| Schema source of truth | Create new neutral Postgres migration SQL under a non-Supabase path. Keep `supabase/` as historical source material unless/until intentionally removed. |

## Extensions And Enums

| Target object | Source | Target action | Notes |
| --- | --- | --- | --- |
| `pgcrypto` extension | `supabase/schema.sql` | Keep. | Needed for `gen_random_uuid()`. Confirm target DB allows extension install or has it preinstalled. |
| `session_status` enum | `supabase/schema.sql`, `20260220_add_paused_status.sql`, `db_schema.md` | Keep, but consolidate values. | Include `NOT_STARTED`, `GENERATING_QUESTIONS`, `IN_SESSION`, `AWAITING_EVAL`, `ERROR`, `COMPLETED`, `PAUSED`, `REVIEWING`, `AWAITING_EVALUATION`. Decide whether both awaiting variants should remain or be normalized in app code. |
| `actor_type` enum | `supabase/schema.sql`, `db_schema.md` | Keep. | Values: `candidate`, `recruiter`, `system`. |
| `eval_status` enum | `supabase/schema.sql`, `db_schema.md` | Keep. | Values: `NONE`, `PENDING`, `COMPLETE`, `FAILED`. |
| `modality_type` enum | `supabase/schema.sql`, `db_schema.md` | Keep. | Values: `text`, `voice`. This supports the corrected answer modality behavior. |
| `tts_status` enum | `supabase/schema.sql`, `db_schema.md` | Keep. | Values: `NONE`, `GENERATING`, `READY`, `FAILED`. |
| `session_readiness_level` enum | `20260216_add_session_readiness.sql`, `db_schema.md` | Keep. | Values: `RL1`, `RL2`, `RL3`, `RL4`. `db_schema.md` only says `USER-DEFINED`, so migration history supplies the values. |

## New App-Owned Auth Tables

These tables do not exist in the Supabase public schema because Supabase Auth currently owns identity/session state.

| Target object | Source | Target action | Notes |
| --- | --- | --- | --- |
| `app_users` | Migration roadmap | Add. | Primary user record for recruiters, admins, and QA evaluators. Expected fields: `user_id`, normalized `email`, display name/profile basics as needed, `status`, timestamps. Consider lowercased email plus unique index; use `citext` only if target DB allows it. |
| `app_user_credentials` | Migration roadmap | Add. | Store password hash and password metadata. Current app-auth implementation uses Node `crypto.scrypt` with per-password random salt and encoded hashes. Never store plain passwords. |
| `app_sessions` | Migration roadmap | Add. | Server-side session records for secure HTTP-only auth cookies. Expected fields: hashed session token, user ID, expiry, revoked timestamp, user agent/IP metadata where useful. |
| `app_user_roles` | Migration roadmap | Add. | Store recruiter/admin/QA roles. Replaces Supabase metadata and hardcoded allowlists as the long-term source. |
| `password_reset_tokens` | Migration roadmap | Add. | Store hashed single-use reset tokens with expiry and used timestamp. |
| `email_verification_tokens` | Migration roadmap | Conditional add. | Needed only if self-sign-up remains. If users are admin-provisioned, verification may be handled out-of-band. |
| `auth_audit_events` | Migration roadmap | Add or defer. | Useful for login/reset/security visibility. Can be lean in phase 1 if time-constrained. |

## Product Tables

| Target object | Source | Target action | Notes |
| --- | --- | --- | --- |
| `sessions` | `db_schema.md`, `supabase/schema.sql`, migrations | Keep with modifications. | Replace `recruiter_id` meaning from Supabase `auth.users.id` to `app_users.user_id`. Preserve lineage, readiness, summary, invitation timestamps, and status values. |
| `questions` | `db_schema.md`, `supabase/schema.sql`, migrations | Keep. | Preserve `category`, TTS columns, question index constraint, and session FK. Keep unique `(session_id, question_index)` from base schema unless live data requires otherwise. |
| `answers` | `db_schema.md`, `supabase/schema.sql` | Keep. | Preserve draft/final fields and `modality_type`. Keep unique `(question_id, attempt_number)` unless multi-answer retries require a product change. |
| `eval_results` | `db_schema.md`, `supabase/schema.sql` | Keep. | Preserve feedback JSON and model metadata. Repositories should continue to write the answer-feedback state expected by practice recovery. |
| `candidate_tokens` | `db_schema.md`, `supabase/schema.sql` | Keep. | Preserve hash-at-rest token storage and session FK. Neutral schema adds `revoked_at` and `expires_at`; `PostgresCandidateTokenStore` validates raw token by hash and rejects expired/revoked rows. |
| `events` | `db_schema.md`, `supabase/schema.sql` | Keep. | Preserve append-only behavior, correlation ID, schema version/hash, and idempotency constraint from base schema. |
| `projection_session_now` | `db_schema.md`, `supabase/schema.sql` | Keep or replace after repository design. | If the app still needs `/now` projection behavior, keep. Otherwise repository can compute state from normalized tables. |
| `recruiter_profiles` | `db_schema.md`, `20240208_recruiter_profiles.sql` | Keep with FK replacement. | Replace FK to `auth.users(id)` with FK to `app_users(user_id)`. Preserve profile fields and updated-at trigger. |
| `recruiter_templates` | `db_schema.md`, `20240224_create_recruiter_templates.sql` | Keep with FK replacement. | Replace FK to `auth.users(id)` with FK to `app_users(user_id)`. `PostgresTemplateRepository` now validates the target shape and enforces recruiter-owned, shared, private, and admin manage-all behavior explicitly in application code. |
| `user_feedback` | `db_schema.md`, `src/lib/server/infrastructure/user_feedback_schema.sql` | Keep with FK replacement. | Replace FK to `auth.users(id)` with FK to `app_users(user_id)`. `PostgresFeedbackRepository` now validates feedback capture, session/type update behavior, recruiter-only feedback inserts, admin read shape, session FK, and JSON metadata. |
| `invite_batches` | `db_schema.md`, `20260328_add_invite_batch_tracking.sql` | Keep with FK addition. | `created_by` should reference `app_users(user_id)` once app auth exists. Preserve parent/retry lineage and status counts. |
| `invite_batch_candidates` | `db_schema.md`, `20260328_add_invite_batch_tracking.sql` | Keep. | Preserve candidate-level retry/error tracking. `session_id` should FK to `sessions` if target migration can enforce it without blocking failed candidate rows. |
| `ai_generations` | `db_schema.md`, AI-quality workstream | Keep. | Neutral schema includes all current capture columns, filter/export indexes, nullable FKs for reliable context links, and `get_ai_generation_summary()`. Postgres write/read repositories now validate the runtime shape behind `AI_GENERATION_REPOSITORY_BACKEND=postgres`. |

## Operational Tables

| Target object | Source | Target action | Notes |
| --- | --- | --- | --- |
| `api_idempotency_keys` | `db_schema.md`, `20260317_add_api_idempotency_keys.sql` | Keep with app-owned user UUIDs. | Current primary key is `(scope, actor_id, key_hash)`. The Postgres idempotency store has been validated with UUID actor IDs; keep candidate/session/test callers UUID-shaped or revisit the column type before broad route flips. |
| `rate_limit_buckets` | `db_schema.md`, `20260325_add_rate_limit_buckets.sql` | Keep. | Needed for durable production rate limiting. Reset index and atomic consume function are present in neutral schema and validated through the Postgres backend integration test. |
| `metric_counter_rollups` | `db_schema.md`, `20260325_add_metrics_rollups.sql` | Keep. | Needed for durable operational metrics. Validated through the Postgres durable metrics backend. |
| `metric_timing_rollups` | `db_schema.md`, `20260325_add_metrics_rollups.sql` | Keep. | Needed for durable latency metrics and SLO summaries. Validated through the Postgres durable metrics backend. |

## Functions And Procedures

| Target object | Source | Target action | Notes |
| --- | --- | --- | --- |
| `set_updated_at()` | `supabase/schema.sql` | Keep. | Shared trigger helper for `updated_at`. |
| `increment_session_engagement()` | `20260317_add_atomic_engagement_increment.sql` | Keep. | `PostgresSessionRepository` calls this neutral Postgres function for atomic engagement-time increments, and the Docker-backed session repository integration test validates the path. |
| `consume_rate_limit_bucket()` | `20260325_add_rate_limit_buckets.sql` | Keep. | Atomic DB function avoids race conditions for production rate limiting. Validated against disposable Docker Postgres for window reset, over-limit denial, and concurrent consumption. |
| `record_metric_counter_rollup()` | `20260325_add_metrics_rollups.sql` | Keep. | Used by `PostgresDurableMetricsBackend` counter writes and validated against disposable Docker Postgres. |
| `record_metric_timing_rollup()` | `20260325_add_metrics_rollups.sql` | Keep. | Used by `PostgresDurableMetricsBackend` timing writes and validated against disposable Docker Postgres. |
| `get_metric_counter_rollups()` | `20260325_add_metrics_rollups.sql` | Keep. | Used by operational metrics snapshot reads and validated against disposable Docker Postgres. |
| `get_metric_timing_rollups()` | `20260325_add_metrics_rollups.sql` | Keep. | Used by operational metrics snapshot reads and validated against disposable Docker Postgres. |
| `get_slo_session_start()` / `get_slo_session_progress()` / `get_slo_ai_reliability()` / `get_slo_ai_latency()` | `20260325_add_metrics_rollups.sql` | Keep. | Used by operational SLO summary reads and validated against disposable Docker Postgres. |
| `create_invite_batch()` | `20260326_add_atomic_invite_batch.sql`, current invite repository | Keep or replace with application transaction. | Current code uses this RPC to atomically create sessions, questions, and candidate tokens, then separately writes `invite_batches` and `invite_batch_candidates` tracking records. For plain Postgres, either keep the function plus tracking writes or move both steps into one application transaction. |

## Indexes And Triggers To Preserve

| Target object | Source | Target action | Notes |
| --- | --- | --- | --- |
| Session indexes | `supabase/schema.sql`, migrations | Keep. | `idx_sessions_recruiter_id`, `idx_sessions_status`, `idx_sessions_parent_id`, `idx_sessions_readiness`, `idx_sessions_invitation_sent_at`. |
| Candidate token index | `supabase/schema.sql`, neutral schema | Keep. | `idx_candidate_tokens_session_id`, `idx_candidate_tokens_expires_at`, and token hash unique constraint remain required. |
| Event indexes | `supabase/schema.sql` | Keep. | `idx_events_session_time`, `idx_events_correlation_id`. |
| Question indexes/constraints | `supabase/schema.sql` | Keep. | `idx_questions_session_id`, question index check, likely unique `(session_id, question_index)`. |
| Answer indexes/constraints | `supabase/schema.sql` | Keep. | `idx_answers_session_id`, `idx_answers_question_id`, attempt check, likely unique `(question_id, attempt_number)`. |
| Eval indexes/constraints | `supabase/schema.sql` | Keep. | `idx_eval_session_id`, `idx_eval_question_id`, `idx_eval_status`, attempt check, likely unique `(question_id, attempt_number)`. |
| Template indexes | `20240224_create_recruiter_templates.sql` | Keep. | `idx_recruiter_templates_recruiter_id`, `idx_recruiter_templates_is_shared`. |
| Idempotency expiry index | `20260317_add_api_idempotency_keys.sql` | Keep. | Needed for cleanup/expiry reads. |
| Rate-limit reset index | `20260325_add_rate_limit_buckets.sql` | Keep. | Needed for cleanup/maintenance. |
| Invite batch indexes | `20260328_add_invite_batch_tracking.sql` | Keep. | Preserve created-by/date, parent batch, candidate batch/index, and candidate status indexes. |
| Updated-at triggers | `supabase/schema.sql`, profile/template migrations | Keep. | Preserve triggers for `sessions`, `answers`, `eval_results`, `projection_session_now`, `recruiter_profiles`, `recruiter_templates`, and consider `rate_limit_buckets`/metrics rollups if functions do not manage timestamps. |
| AI-quality indexes | AI-quality workstream | Keep. | Neutral schema includes created date, surface/status, surface/date, status/date, session, trace/correlation, created_by/date, retention, and `source_refs` GIN indexes for QA explorer filter/export use cases. |

## Supabase-Specific Objects To Remove Or Replace

| Object/pattern | Source | Target action | Notes |
| --- | --- | --- | --- |
| `auth.users` FKs | `db_schema.md`, profile/template/user feedback migrations | Replace. | Use `app_users(user_id)`. |
| `auth.uid()` policies | `supabase/schema.sql`, migrations | Replace. | Authorization moves into server app code and DB-backed roles. |
| Supabase RLS public candidate policies | `supabase/schema.sql`, fix scripts | Do not carry forward as-is. | Candidate access should be token-validated in app code, not broad public table reads. |
| Supabase service role | Runtime code | Replace. | Server-only Postgres pool plus explicit authorization checks. |
| Supabase RPC calls | Runtime code and migrations | Replace with direct Postgres functions or repository transactions. | Function names may remain, but invocation path changes from Supabase RPC to SQL queries. |

## Open Reconciliation Questions

| Question | Why it matters | Current working answer |
| --- | --- | --- |
| Should `AWAITING_EVAL` and `AWAITING_EVALUATION` both remain? | Duplicate status meanings can cause recovery bugs and query drift. | Preserve both initially to avoid breaking code, then normalize in a later app cleanup if safe. |
| Should `create_invite_batch()` stay as a DB function? | A function keeps atomic session/question/token creation close to the DB, but tracked-batch behavior also needs invite batch and candidate status rows. | Current `PostgresInviteRepository` keeps `create_invite_batch()` for source-compatible batch creation and uses application transactions for tracked batch rows/status updates. Revisit only if this split becomes hard to validate or operate. |
| Should metrics/SLO tables remain in phase 1? | They add migration scope but support operational visibility. | Keep unless product/integration explicitly cuts ops metrics from phase 1. |
| Should `ai_generations` have strict FKs? | FKs improve integrity but can block logging if related records are missing or pruned. | Prefer nullable FKs where reliable; preserve logging even when context is partial. |
| What should production DB role own? | Determines whether app can create schema/functions or only read/write existing objects. | Code can proceed flexibly; integration team must confirm before migration execution. |

## Implementation Progress

The first executable draft now lives at `db/migrations/001_initial_schema.sql`.

It includes extensions, enums, app auth tables, product tables, operational tables, constraints, indexes, triggers, and functions in intended dependency order.

Disposable validation passed on May 5, 2026 against `interviewcoach-postgres-test`, a Docker container using `ankane/pgvector:latest` with PostgreSQL 15.4. The migration applied successfully, reran successfully against the existing schema, and passed rollback-only smoke validation via `db/validation/001_initial_schema_smoke.sql`. After the AI-quality port, the updated schema reapplied successfully and smoke validation passed with the AI-generation summary function included.

Repository validation has now exercised the neutral `sessions`, `questions`, `answers`, `eval_results`, `candidate_tokens`, `recruiter_templates`, `user_feedback`, and `ai_generations` tables through Postgres-backed stores. The session repository test specifically covers session create/read/update/delete, dashboard summary counts, draft saves, answer feedback persistence, analysis deletion, summary expiry metadata, invitation sent timestamp updates, and atomic engagement increments. The template repository test covers recruiter-owned templates, shared-template visibility, private-template exclusion, create/update/delete behavior, and explicit admin manage-all behavior. The feedback repository test covers capture, session/type updates, recruiter-only inserts, and the admin view join shape. The AI-quality repository tests cover capture insert serialization plus QA explorer list, page, summary, and row mapping behavior.

The Level 2 local product-flow smoke now also validates the route-stack shape against the repeatable smoke DB: app-owned recruiter login, Postgres invite batch creation, candidate `/s/[token]` access, candidate session fetch, initials, draft save, answer submit, answer analysis through local mock fallback, and DB row verification for invite tracking, sessions, questions, answers, eval results, candidate tokens, idempotency, rate limits, metrics, and `ai_generations`.

## Next Implementation Cut

1. Extend local product smoke to cover browser-visible login/create-invite/candidate UX, not only route-stack HTTP calls.
2. Validate Gemini-backed AI-quality capture with a real `GEMINI_API_KEY`: question generation, hints, strong response, answer feedback, and session debrief.
3. Validate SMTP-backed `/api/invite/send`, invitation-sent timestamps, resend, and debrief email with target Microsoft/Office365 SMTP env values.
4. Validate QA explorer UI reads/exports against the smoke DB records created by product-flow smoke.
5. Validate the same migration against a company-provided development or integration Postgres database once credentials/access are available.
6. Review repository implementation feedback to decide whether `create_invite_batch()` remains a DB function or moves into an application transaction.
7. Revisit this plan after remaining server components/actions, middleware, and fallback repositories are moved off Supabase.
8. Confirm with the integration team whether the production app DB user can create extensions, enums, functions, triggers, and indexes, or whether DBA-owned DDL application is required.
