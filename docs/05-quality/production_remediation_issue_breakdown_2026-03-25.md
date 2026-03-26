# Production Remediation Issue Breakdown

Date: 2026-03-25  
Source review: [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)  
Companion plan: [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)

---

## Usage

This document is written in a GitHub-issue style so the team can turn each item into tracked work without having to rewrite the engineering intent.

Each issue includes:
- goal
- scope
- dependencies
- acceptance criteria
- suggested implementation targets

---

## P0-1: Replace Process-Local Rate Limiting

Status: `Done`  
Priority: `P0`  
Suggested owner: Platform / backend

### Goal

Replace in-memory rate limiting with a shared backend that is correct across restarts and multi-instance deployment.

### Scope

- define backend abstraction
- implement production backend
- keep memory backend for local dev only
- migrate current API consumers

### Suggested targets

- `src/lib/server/rate-limit.ts`
- `src/lib/server/rate-limit/backend.ts`
- `src/lib/server/rate-limit/types.ts`
- invite and session API routes using `consumeRateLimit`

### Dependencies

- backend decision: Redis or Postgres
- env validation for backend credentials

### Acceptance Criteria

- production code path does not use process memory as the source of truth
- rate limits survive restart
- rate limits behave consistently across instances
- dev mode still works without production infra

### Required Tests

- backend TTL/reset behavior
- threshold denial consistency
- backend selection by env
- affected route regression coverage after async limiter conversion

### Current Progress

- added backend abstraction:
  - `src/lib/server/rate-limit/types.ts`
  - `src/lib/server/rate-limit/backend.ts`
- refactored `src/lib/server/rate-limit.ts` to select:
  - `memory` in local/test by default
  - `supabase` in production by default
- added Supabase/Postgres shared backend via RPC-backed bucket consumption
- landed migration:
  - `supabase/migrations/20260325_add_rate_limit_buckets.sql`
- updated invite and abuse-protection consumers to await async rate-limit decisions
- added focused tests for:
  - memory backend semantics
  - supabase backend selection
  - production memory-backend rejection
  - affected invite/session routes

### Completion Notes

- `P0-1` is complete.
- Applied and validated the shared rate-limit database path in Supabase production:
  - `public.rate_limit_buckets`
  - `public.consume_rate_limit_bucket(...)`
- Confirmed deployed recruiter-route throttling with `POST /api/recruiter/invites`:
  - observed `429`
  - response included `code: "RATE_LIMITED"`
- Confirmed deployed candidate/public-route throttling with `POST /api/session/start`:
  - observed `429`
  - response included `code: "RATE_LIMITED"`
- Production limiter semantics are now validated at:
  - code path
  - test coverage
  - database backend
  - deployed route behavior

---

## P0-2: Make Invite Creation Deterministic Under Partial Failure

Status: `Done`  
Priority: `P0`  
Suggested owner: Backend / application layer

### Goal

Move invite creation from route-level sequential multi-write behavior to a deterministic command flow with explicit partial-failure handling.

### Scope

- define invite batch application command
- separate persistence from provider side effects
- model per-candidate results
- support retry/idempotency cleanly

### Suggested targets

- `src/app/api/recruiter/invites/route.ts`
- `src/lib/server/application/invites/create-invite-batch.ts`
- `src/lib/server/application/invites/types.ts`
- `src/lib/server/infrastructure/supabase-invite-repository.ts`

### Dependencies

- command/result shape decision
- consistency model decision:
  - transactional persistence first
  - or resumable batch record with compensating actions

### Acceptance Criteria

- no silent partial success state
- per-candidate success/failure is explicit
- provider failure does not leave ambiguous batch outcome
- retries do not duplicate work unexpectedly

### Required Tests

- persistence failure at candidate N of batch
- provider failure after session persistence
- duplicate request with same idempotency key

### Current Progress

- extracted invite creation orchestration into:
  - `src/lib/server/application/invites/create-invite-batch.ts`
  - `src/lib/server/application/invites/types.ts`
- `POST /api/recruiter/invites` now returns explicit:
  - `results`
  - `failures`
  - `summary`
- mixed success/failure responses now use deterministic `207` status instead of collapsing into an opaque `500`
- recruiter create flow now surfaces partial failures while preserving preview/send for successful candidates
- added focused tests for:
  - mixed command results
  - recruiter invite route partial-failure behavior
  - replay of stored partial-failure result for duplicate idempotency key

### Completion Note

For the initial rollout, `P0-2` is complete at deterministic mixed-result semantics.

Durable batch-job infrastructure, all-or-nothing transaction semantics, and retry-failed-only tooling are intentionally deferred to future ATS integration work unless rollout evidence forces that investment earlier.

---

## P0-3: Add Production Fail-Fast for Auth and Required Server Env

Status: `Done`  
Priority: `P0`  
Suggested owner: Platform / backend

### Goal

Make protected server operations fail fast at startup when required auth/service dependencies are missing.

### Scope

- centralize required env parsing
- validate production-only hard requirements
- remove protected fallback behavior where unsafe

### Suggested targets

- `src/lib/server/config/server-env.ts`
- `src/lib/server/auth/candidate-token.ts`
- server bootstrap/import points for protected modules

### Dependencies

- final list of required production secrets

### Acceptance Criteria

- missing production secrets fail startup
- candidate token verification does not vary based on missing service-role env
- dev behavior is explicit and documented
- applied to protected auth, provider, and encryption seams

### Required Tests

- prod-mode missing service-role key
- invalid token verification paths
- env contract parser tests
- production import behavior for AI, email, and encryption configuration

### Completion Notes

- landed `src/lib/server/config/server-env.ts`
- fail-fast env access adopted in `src/lib/supabase/server.ts`
- removed anon fallback from `src/lib/server/auth/candidate-token.ts`
- production fail-fast coverage added for:
  - `src/lib/server/services/ai-config.ts`
  - `src/lib/server/services/email-service.ts`
  - `src/lib/server/encryption.ts`
- remaining URL/origin env cleanup moved to `P1-1`

---

## P1-1: Centralize Canonical App Origin Resolution

Status: `Done`  
Priority: `P1`  
Suggested owner: Backend / platform

### Goal

Use one trusted server utility to derive public app origin for invite links and candidate-facing URLs.

### Scope

- create canonical origin helper
- normalize env/request behavior
- apply allowlist validation
- remove split behavior between `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, and route-local fallbacks

### Suggested targets

- `src/lib/server/url/get-app-origin.ts`
- `src/app/api/recruiter/invites/route.ts`
- `src/app/api/invite/resend/route.ts`
- `src/lib/server/services/email-service.ts`

### Acceptance Criteria

- no ad hoc origin building remains in invite flows
- malformed or untrusted origin sources are rejected
- production origin behavior is deterministic
- one precedence rule is shared across invite creation, resend, and server email rendering

### Required Tests

- malformed env URL
- missing env URL in production
- untrusted request host fallback
- local request-origin normalization for `0.0.0.0` / `localhost` development flows

### Completion Notes

- `src/lib/server/url/get-app-origin.ts` introduced as the shared helper
- configured-origin precedence centralized in `src/lib/config/public-app-origin.ts`
- recruiter invite creation and resend route now use the shared origin resolver
- server-rendered email links and logo assets now use the shared origin resolver
- resend preview now uses the same configured-origin precedence as the actual resend email
- production no longer trusts request-host fallback when no configured public origin is available; that case now fails fast

---

## P1-2: Remove Residual Hardcoded Business Defaults

Status: `Done`  
Priority: `P1`  
Suggested owner: Frontend / product engineering

### Goal

Move business identity defaults out of scattered UI initialization logic into centralized configuration or profile-driven policy.

### Scope

- audit recruiter create/dashboard/profile default values
- centralize fallback policy

### Suggested targets

- `src/app/(recruiter)/recruiter/create/page.tsx`
- `src/app/(recruiter)/recruiter/page.tsx`
- `src/lib/recruiter-signature.ts`
- shared config helper if added

### Acceptance Criteria

- no new hardcoded org identity values in feature components
- fallback policy is centralized and documented

### Current Progress

- added shared recruiter/business default config:
  - `src/lib/config/recruiter-defaults.ts`
- updated recruiter signature normalization to consume shared defaults:
  - `src/lib/recruiter-signature.ts`
- removed recruiter create-flow company fallback literal:
  - `src/app/(recruiter)/recruiter/create/page.tsx`
- removed recruiter create-flow name fallback literal:
  - `src/app/(recruiter)/recruiter/create/page.tsx`

### Completion Notes

- `P1-2` is complete for the current recruiter-facing flows.
- Canonical recruiter/business fallback values now live in shared config rather than feature-level literals.
- Future profile-policy changes should update shared config or profile-normalization utilities, not page-level defaults.

---

## P1-3: Tighten Runtime Schemas

Status: `Done`  
Priority: `P1`  
Suggested owner: Backend / AI contracts

### Goal

Reduce loose `z.any()` contract surfaces and replace them with constrained runtime schemas.

### Scope

- audit domain and provider schemas
- tighten competency, blueprint, and rating structures
- normalize malformed provider data into one typed error family

### Suggested targets

- `src/lib/domain/schemas.ts`
- `src/lib/server/provider-response.ts`
- `src/lib/server/services/ai-service.ts`

### Dependencies

- coordinate with feedback-chain schema work where relevant

### Acceptance Criteria

- no critical-path `z.any()` remains in provider/domain contracts
- callers receive typed malformed-data failures

### Current Progress

- first schema-tightening slice landed in:
  - `src/lib/domain/schemas.ts`
  - `src/lib/server/services/tips-service.ts`
- replaced broad `z.any()` usage with permissive structured schemas for:
  - competencies
  - scoring dimensions
  - rating bands
- tightened the answer-submit route boundary to use the shared `AnalysisResultSchema`:
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
- added focused regression coverage for invalid analysis payload rejection:
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.test.ts`
- tightened the recruiter template repository boundary by validating persisted template question payloads:
  - `src/lib/server/infrastructure/supabase-template-repository.ts`
- replaced the duplicated strong-response route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/response/generate/route.ts`
- added focused route coverage for the shared strong-response request schema:
  - `src/app/api/response/generate/route.test.ts`
- replaced the duplicated question-generation route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/questions/generate/route.ts`
- unified the tips request contract by removing service/domain duplication and moving the route onto a shared domain request schema:
  - `src/lib/domain/schemas.ts`
  - `src/lib/server/services/tips-service.ts`
  - `src/app/api/tips/generate/route.ts`
- added focused route coverage for the shared tips request schema:
  - `src/app/api/tips/generate/route.test.ts`
- verified the analysis route now uses the shared domain request schema and aligned its focused tests to the current auth path:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/analysis/route.ts`
  - `src/app/api/analysis/route.test.ts`
- replaced the duplicated invite send and invite resend route request schemas with shared domain schemas:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/invite/send/route.ts`
  - `src/app/api/invite/resend/route.ts`
- added focused resend-route coverage for the shared invite resend request schema:
  - `src/app/api/invite/resend/route.test.ts`
- replaced the duplicated question retry and question analysis route request schemas with shared domain schemas:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/retry/route.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/analysis/route.ts`
- verified focused retry and question-analysis route coverage after the shared-schema consolidation:
  - `src/app/api/session/[session_id]/questions/[question_id]/retry/route.test.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/analysis/route.test.ts`
- replaced the duplicated TTS route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/tts/route.ts`
- replaced the duplicated recruiter invite-create route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/recruiter/invites/route.ts`
- replaced the duplicated answer-submit route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
- enriched the shared provider malformed-response path with explicit error kinds:
  - `src/lib/server/provider-errors.ts`
  - `src/lib/server/provider-response.ts`
- updated AI-service fallback handling to distinguish malformed provider output from runtime failures in logs and metrics:
  - `src/lib/server/services/ai-service.ts`
- added focused malformed-response coverage:
  - `src/lib/server/services/provider-response.test.ts`
  - `src/lib/server/services/ai-service.test.ts`
- propagated malformed-response classification through the remaining provider-backed services and question-generation route:
  - `src/lib/server/services/strong-response-service.ts`
  - `src/lib/server/services/tips-service.ts`
  - `src/lib/server/services/email-service.ts`
  - `src/app/api/questions/generate/route.ts`
- added focused classification coverage for those seams:
  - `src/lib/server/services/strong-response-service.test.ts`
  - `src/lib/server/services/tips-service.test.ts`
  - `src/lib/server/services/email-service.test.ts`
  - `src/app/api/questions/generate/route.provider.test.ts`
- intentionally left the draft-save route payload local:
  - `src/app/api/session/[session_id]/questions/[question_id]/answer/route.ts`
  - rationale: it is a one-off persistence payload with no shared consumer surface, so centralizing it would be overengineering rather than risk reduction

### Completion Notes

- `P1-3` is complete for the current remediation scope.
- No remaining `z.any()` usage surfaced in `src`.
- Critical recruiter/candidate route request contracts now flow through shared domain schemas where centralization reduces drift.
- Provider-backed malformed output is normalized through one typed error family and classified distinctly from generic runtime failure in the critical AI/service/route seams.
- Future schema changes should be treated as normal contract evolution, not unresolved remediation backlog.

---

## P1-4: Land Durable Metrics Path and SLO Base Layer

Status: `In Progress`  
Priority: `P1`  
Suggested owner: Platform / ops

### Goal

Move metrics from process memory into a durable backend and define minimal SLO-backed operational visibility.

### Scope

- durable metrics export or persistence
- route/provider/session correlation
- initial SLO definitions

### Suggested targets

- `src/lib/server/metrics.ts`
- ops routes
- structured logging/correlation utilities

### Acceptance Criteria

- metrics survive restart
- candidate-affecting failures can be correlated across logs and metrics
- initial SLO thresholds are documented

### Current Progress

- baseline assessment completed for the existing metrics path:
  - `src/lib/server/metrics.ts`
  - `src/app/api/recruiter/ops/metrics/route.ts`
  - `src/lib/server/alerts.ts`
- current implementation findings:
  - counters and timings are held in process-local `globalThis` maps
  - the ops metrics route returns only the local process snapshot
  - metrics are lost on restart and do not aggregate across instances
  - dashboard/error counts are useful for local introspection but are insufficient for durable incident analysis or SLO reporting
- bounded design note added:
  - `docs/05-quality/durable_metrics_plan_2026-03-25.md`
  - selected direction: dual-write with Supabase/Postgres durable rollups while preserving the current instrumentation API
- first implementation slice landed:
  - `src/lib/server/metrics/backend.ts`
  - `src/lib/server/metrics/types.ts`
  - `src/lib/server/metrics.ts`
  - `src/app/api/recruiter/ops/metrics/route.ts`
  - `supabase/migrations/20260325_add_metrics_rollups.sql`
- current implementation state:
  - in-memory metrics behavior remains intact for local/test ergonomics
  - optional Supabase durable writes are available behind `METRICS_BACKEND=supabase`
  - the recruiter ops metrics route now reads the durable-aware snapshot helper
- deployed validation completed:
  - rollup migration applied successfully in Supabase production
  - durable counter rollups confirmed
  - durable timing rollups confirmed for AI-backed operations
  - deployed environment is writing through the Supabase durable metrics path

### Remaining Work

- document the minimum SLO set against the durable metric names now validated in production
- update alert-policy and runbook language from local-snapshot assumptions to durable operational truth
- decide whether any threshold recalibration is required immediately or can wait for more history

### Current Progress Update

- initial SLO proposal added:
  - `docs/05-quality/initial_slos_2026-03-26.md`
- proposed first SLO set:
  - session start availability
  - in-session progress reliability
  - AI assist reliability
  - AI assist latency
- current follow-up gap:
  - submit-outcome instrumentation is now landed in:
    - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
  - metric family:
    - `session_submit_total`
  - tagged outcomes:
    - `success`
    - `replay_success`
    - `invalid_request`
    - `request_in_progress`
    - `idempotency_mismatch`
    - `error`
- remaining work is now operationalization rather than missing instrumentation:
    - wire the new metric family into SLO queries/dashboard views
    - decide whether `analysisIncluded` remains part of the long-term low-cardinality tag set
- SQL-backed SLO summary functions are now added in:
  - `supabase/migrations/20260325_add_metrics_rollups.sql`
  - `get_slo_session_start(...)`
  - `get_slo_session_progress(...)`
  - `get_slo_ai_reliability(...)`
  - `get_slo_ai_latency(...)`
- the recruiter ops metrics route now returns `sloSummary` alongside `snapshot`, `dashboard`, and `alerts`

### Next Slice

- operationalize the new submit metric family in durable queries/dashboard views
- apply and validate the updated metrics rollup migration with the new SLO summary functions
- finalize the minimum SLO/dashboard set around:
  - invite creation/send
  - candidate session start/completion
  - AI request success/error/malformed-response outcomes
  - submit success/failure outcomes
  - auth and rate-limit denials

---

## P2-1: Continue Route-to-Application-Service Extraction

Status: `Not Started`  
Priority: `P2`  
Suggested owner: Backend / architecture

### Goal

Reduce route handler orchestration and move business commands into application services.

### Scope

- establish `application/*` pattern
- start with invite flows
- identify next candidate routes

### Suggested targets

- `src/lib/server/application/*`
- invite routes first

### Acceptance Criteria

- invite routes become reference examples for thin-route structure
- new route logic does not couple parse, persistence, metrics, and provider behavior directly

---

## P2-2: Add Accessibility Automation for Critical Flows

Status: `Not Started`  
Priority: `P2`  
Suggested owner: Frontend / QA

### Goal

Catch keyboard, announcement, and focus regressions in recruiter and candidate critical flows.

### Scope

- recruiter create + preview/send
- candidate session flows
- async feedback states and modal/sheet behaviors

### Suggested targets

- existing component tests
- Playwright or equivalent E2E tests if present

### Acceptance Criteria

- keyboard/focus regressions are covered
- async error/success announcements are verified
- critical flows have accessibility assertions in CI

---

## Suggested Dependency Order

1. P0-3 auth/env fail-fast
2. P1-1 canonical origin helper
3. P0-1 shared rate limiting
4. P0-2 invite command flow
5. P1-3 schema tightening
6. P1-4 durable metrics
7. P2-1 boundary extraction
8. P2-2 accessibility automation

---

## Tracking Convention

For each issue, track:

- Status: `Not Started | In Progress | Blocked | Done`
- Owner
- Target sprint
- PR/branch links
- Follow-up docs updated: `Yes/No`
