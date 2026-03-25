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
- remaining work:
  - update operational docs and tracker state
  - apply and validate the migration in deployed environments

---

## P0-2: Make Invite Creation Deterministic Under Partial Failure

Status: `In Progress`  
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

Status: `Not Started`  
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

---

## P1-3: Tighten Runtime Schemas

Status: `Not Started`  
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

---

## P1-4: Land Durable Metrics Path and SLO Base Layer

Status: `Not Started`  
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
