# Production Remediation Issue Bodies

Date: 2026-03-25  
Source review: [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)  
Companion docs:
- [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)
- [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

---

## Usage

These are copy-paste-ready issue bodies for the first remediation wave.

They are written to support:
- GitHub issues
- Linear tickets
- sprint planning handoff

Each body includes:
- problem statement
- goal
- scope
- acceptance criteria
- implementation targets
- required tests
- documentation updates

---

## P0-3: Add Production Fail-Fast for Auth and Required Server Env

### Title

`P0-3: Add production fail-fast for auth and required server env`

### Body

#### Summary

Production-protected server behavior currently depends too much on environment shape and fallback behavior. We need a single server env contract and production fail-fast validation so auth-sensitive paths do not silently drift between dev, staging, and prod.

This is a P0 production blocker from the 2026-03-25 production-readiness review.

#### Problem

Current risks called out in the review:

- candidate token auth depends on environment shape
- protected server operations may fall back in ways that are acceptable for local development but not for production
- required server secrets are not enforced strongly enough as a startup contract

This creates two problems:

1. Production behavior can differ from expectations depending on missing env vars.
2. Failures can happen late at runtime instead of at boot.

#### Goal

Make required auth and server environment dependencies explicit and fail fast in production.

#### Scope

In scope:

- create a centralized server env contract module
- validate required production secrets at startup/import time
- review candidate-token protected operations for unsafe fallback behavior
- make production behavior deterministic

Out of scope:

- replacing the candidate token model itself
- invite-batch consistency work
- durable metrics work

#### Suggested implementation targets

- `src/lib/server/config/server-env.ts`
- `src/lib/server/auth/candidate-token.ts`
- protected server modules that depend on service-role or equivalent privileged env

#### Acceptance criteria

- production boot fails when required auth/service env is missing
- candidate token verification does not vary based on missing service-role env
- dev-only relaxed behavior, if any remains, is explicit and documented
- invite/auth-sensitive routes use the validated env contract rather than ad hoc `process.env` reads for required secrets

#### Required tests

- prod-mode missing service-role key fails
- invalid token verification path behaves consistently
- server env parser fails on missing required production secrets
- server env parser allows documented dev-only behavior where intended

#### Documentation updates required

- `docs/05-quality/environment_variable_matrix.md`
- `docs/05-quality/production_remediation_tracker_2026-03-25.md`
- `docs/05-quality/release-gate-checklist.md` if release criteria wording needs adjustment

#### Dependencies

- confirm production-required env inventory

#### Definition of done

- implementation merged
- tests added and passing
- environment docs updated
- tracker moved accordingly

---

## P1-1: Centralize Canonical App Origin Resolution

### Title

`P1-1: Centralize canonical app origin resolution for invite and candidate links`

### Body

#### Summary

Invite-link origin generation is currently too distributed. We need one trusted server utility for canonical app origin resolution so candidate-facing links do not drift by environment or route implementation.

This item supports the P0 hardening path and is planned for Sprint 1.

#### Problem

Current risks called out in the review:

- public-origin derivation trust can drift by environment
- invite links may be built from env or request normalization in inconsistent ways
- bad base URL configuration can produce wrong or unsafe links

#### Goal

Use one canonical server helper to derive public app origin for invite and candidate-facing URLs.

#### Scope

In scope:

- create a canonical origin helper
- validate allowed origin sources
- migrate invite send/resend and related email flows to it

Out of scope:

- redesigning token semantics
- changing candidate route structure

#### Suggested implementation targets

- `src/lib/server/url/get-app-origin.ts`
- `src/app/api/invite/send/route.ts`
- `src/app/api/invite/resend/route.ts`
- `src/lib/server/services/email-service.ts`

#### Acceptance criteria

- invite-link generation uses one shared server utility
- malformed app URL configuration fails deterministically
- request-host fallback, if allowed, is constrained and validated
- no ad hoc origin derivation remains in invite-related flows

#### Required tests

- valid env URL path
- malformed env URL path
- missing production app URL path
- untrusted request host path if request fallback is supported

#### Documentation updates required

- `docs/05-quality/environment_variable_matrix.md`
- `docs/05-quality/production_remediation_tracker_2026-03-25.md`
- `docs/04-architecture/api-surface.md` if public URL semantics become more explicit

#### Dependencies

- P0-3 server env contract work

#### Definition of done

- implementation merged
- all invite-related URL generation uses helper
- tests added and passing
- docs updated

---

## P0-1: Replace Process-Local Rate Limiting

Status: `Done` on 2026-03-25 after deployed recruiter and candidate route validation.

### Title

`P0-1: Replace process-local rate limiting with shared backend`

### Body

#### Summary

Rate limiting currently uses process-local memory and is not production-correct across restarts or multiple instances. We need a shared backend with deterministic TTL semantics and explicit backend selection by environment.

This is a P0 production blocker from the 2026-03-25 production-readiness review.

#### Problem

Current risks called out in the review:

- rate-limit correctness is process-local
- limits reset across restarts
- limits are inconsistent across multiple server instances

That means the current implementation is a development convenience, not a production control.

#### Goal

Replace process-local rate limiting with a shared backend for staging/production while retaining a local-only memory backend for development.

#### Scope

In scope:

- introduce a backend abstraction for rate-limit operations
- implement a shared production backend
- migrate current invite/auth-sensitive routes to the new abstraction
- add env-driven backend selection

Out of scope:

- tuning every threshold in this ticket
- durable metrics implementation

#### Suggested implementation targets

- `src/lib/server/rate-limit.ts`
- `src/lib/server/rate-limit/backend.ts`
- `src/lib/server/rate-limit/types.ts`
- current routes using `consumeRateLimit`

#### Acceptance criteria

- production code path does not use process memory as the source of truth for throttling
- rate-limit behavior survives restart
- rate-limit behavior is consistent across instances
- local development still works without production infra

#### Required tests

- threshold deny behavior
- TTL/reset behavior
- backend selection by env
- backend consistency behavior under repeated calls

#### Documentation updates required

- `docs/05-quality/ops_alert_policy.md`
- `docs/05-quality/incident_runbook.md`
- `docs/05-quality/environment_variable_matrix.md`
- `docs/05-quality/production_remediation_tracker_2026-03-25.md`

#### Dependencies

- shared backend decision: Redis or Postgres
- P0-3 env contract work for backend credentials

#### Definition of done

- implementation merged
- production backend selected and wired
- invite/auth-sensitive routes migrated
- tests passing
- docs updated

---

## P0-2: Make Invite Creation Deterministic Under Partial Failure

### Title

`P0-2: Make invite creation deterministic under partial failure`

### Body

#### Summary

Invite creation currently performs a multi-write, candidate-by-candidate flow that can leave partial success states under failure. We need an application command flow with explicit per-candidate outcomes and deterministic behavior under retry and provider failure.

This is a P0 production blocker from the 2026-03-25 production-readiness review.

#### Problem

Current risks called out in the review:

- invite creation is multi-write and non-transactional
- route handlers still perform substantial orchestration
- failure in the middle of batch processing can leave ambiguous state

#### Goal

Move invite creation to a deterministic application-service command flow with explicit per-candidate statuses and clear partial-failure handling.

#### Scope

In scope:

- create application command for invite batch creation
- define per-candidate result model
- separate persistence from provider side effects
- support retry/idempotency without ambiguous duplication

Out of scope:

- broad route-to-service extraction beyond invite flows
- redesign of candidate session token semantics unless strictly required by the invite flow changes

#### Suggested implementation targets

- `src/lib/server/application/invites/create-invite-batch.ts`
- `src/lib/server/application/invites/types.ts`
- `src/app/api/recruiter/invites/route.ts`
- `src/lib/server/infrastructure/supabase-invite-repository.ts`
- possibly invite send/resend routes as follow-on alignment

#### Acceptance criteria

- no silent partial-success state under mid-batch failure
- batch result includes per-candidate status and failure reason
- retry behavior is idempotent and documented
- route handler becomes thin enough that orchestration logic is testable directly at the application-service layer
- recruiter-visible partial failures are explicit while successful candidates remain actionable

#### Required tests

- persistence failure on candidate N in batch
- duplicate/idempotent retry behavior
- deterministic batch result shape for mixed success/failure outcomes
- replay of stored partial-failure result for duplicate idempotency key

#### Documentation updates required

- `docs/04-architecture/api-surface.md`
- `docs/04-architecture/e2e-flow.md`
- `docs/05-quality/incident_runbook.md`
- `docs/05-quality/production_remediation_tracker_2026-03-25.md`

#### Dependencies

- P0-3 env/auth contract work
- consistency-model decision from architecture review

#### Definition of done

- implementation merged
- failure-mode tests passing
- application command path is the source of truth
- docs updated

#### Stop Point For Initial Rollout

This item is complete for the initial rollout when invite creation has deterministic mixed-result semantics and idempotent replay coverage.

This item does not require:
- all-or-nothing transactional invite batches
- durable asynchronous batch job infrastructure
- recruiter-side retry-failed-only tooling beyond explicit visibility of failed candidates

---

## Optional Follow-On Issue: Sprint 1 Architecture Decision Confirmation

### Title

`Planning: confirm backend and consistency decisions for production remediation`

### Body

#### Summary

Before full implementation begins, confirm the proposed architecture decisions for:

- shared rate-limit backend
- invite batch consistency model
- application-service extraction direction

#### Goal

Convert the proposed ADRs into approved direction or annotate them with changes.

#### Suggested review docs

- [../04-architecture/adr-rate-limit-backend.md](../04-architecture/adr-rate-limit-backend.md)
- [../04-architecture/adr-invite-batch-consistency.md](../04-architecture/adr-invite-batch-consistency.md)
- [../04-architecture/adr-application-boundaries.md](../04-architecture/adr-application-boundaries.md)

#### Acceptance criteria

- architectural direction confirmed
- open questions reduced enough for Sprint 1 implementation
- tracker decision log updated
