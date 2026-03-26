# Production Remediation Plan

Date: 2026-03-25  
Source review: [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)  
Status: Remediation execution complete for P0/P1 scope on 2026-03-26  
Owner: Engineering  

---

## Purpose

This document translates the 2026-03-25 production-readiness review into an execution plan that can be administered, tracked, and used as a release gate.

It is intentionally implementation-aware and repo-specific.

---

## Release Position

- Production: `Initial remediation gate satisfied; remaining work is P1/P2 hardening and backlog execution`
- Controlled staging: `GO`

---

## Execution Principles

1. Fix distributed-systems weaknesses before polishing structure.
2. Prefer narrow, testable application-service extraction over broad refactors.
3. Treat every P0 fix as incomplete until failure-mode tests and runbook updates land.
4. Preserve behavior for existing users unless the change is an explicit hardening gate.

---

## Workstreams

### Workstream A: Production Safety

Goal: remove the three release blockers identified in the review.

Scope:
- shared/distributed rate limiting
- transaction-safe invite creation flow
- fail-fast auth and environment contract validation

Exit criteria:
- no process-local protection remains in production code paths
- invite creation has deterministic partial-failure handling
- protected server behavior does not vary by environment shape

### Workstream B: Boundary Cleanup

Goal: reduce drift between route handlers, application logic, and infrastructure.

Scope:
- canonical app origin resolution
- route-to-application-service extraction for invite flows
- removal of hardcoded business defaults from feature-level UI
- tighter schema contracts

Exit criteria:
- invite-related routes are thin
- origin resolution is centralized
- critical contracts no longer use loose placeholder schemas

### Workstream C: Operability and Quality Uplift

Goal: make the system operable across restarts and scale-out, and easier to verify.

Scope:
- durable metrics
- SLO and alert alignment
- failure-mode integration coverage
- accessibility automation
- remediation/runbook/ADR documentation

Exit criteria:
- metrics survive restart and support incident analysis
- failure modes are covered by tests
- release gate checklist exists and is used

---

## Sequenced Delivery Plan

### Phase 0: Governance Setup

Target duration: 0.5 sprint

Tasks:
- create remediation tracker and issue breakdown
- confirm production gate criteria
- assign owners for each P0 workstream
- create ADR placeholders for:
  - rate-limit backend choice
  - invite consistency model
  - application boundary split

Deliverables:
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
- [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)

### Phase 1: P0 Hardening

Target duration: 1 sprint

Tasks:
- land shared rate-limit backend abstraction and production backend
- add startup env/auth contract validation
- centralize canonical app origin generation

Primary files/modules:
- `src/lib/server/rate-limit.ts`
- `src/lib/server/rate-limit/*`
- `src/lib/server/config/server-env.ts`
- `src/lib/server/url/get-app-origin.ts`
- invite-related API routes

Required validation:
- rate-limit backend tests
- env fail-fast tests
- origin contract tests

Phase 1 status on 2026-03-25:
- `P0-1` completed with deployed recruiter and candidate route `429` validation against the shared Supabase/Postgres limiter.
- `P0-2` completed for the initial-rollout stop point at deterministic mixed-result invite semantics.
- `P0-3` completed with production fail-fast env/auth coverage across privileged server seams.

### Phase 2: Invite Flow Consistency

Target duration: 1 sprint

Tasks:
- extract invite orchestration into application command handlers
- define deterministic partial-failure behavior
- add per-candidate batch result modeling
- add idempotent replay coverage for mixed-result batches

Primary files/modules:
- `src/app/api/recruiter/invites/route.ts`
- `src/lib/server/application/invites/*`
- `src/lib/server/infrastructure/supabase-invite-repository.ts`

Required validation:
- partial-batch failure integration tests
- idempotency/retry tests

Completion note for this rollout:
- stop at deterministic mixed-result reporting and recruiter-visible partial-failure handling
- do not expand Phase 2 into durable batch-job infrastructure unless future ATS integration requires it

### Phase 3: Boundary and Contract Cleanup

Target duration: 1 sprint

Tasks:
- remove residual hardcoded business identity defaults from feature flows
- tighten `z.any()` schema surfaces
- continue route-to-application-service extraction beyond invite flow

Primary files/modules:
- recruiter create/dashboard flows
- `src/lib/domain/schemas.ts`
- provider-response and AI-service contracts

Required validation:
- schema contract tests
- route thinness review
- regression checks on recruiter flows

Phase 3 status on 2026-03-25:
- `P1-2` completed with shared recruiter/business defaults replacing feature-local fallback literals.
- `P1-3` completed with:
  - critical route request-schema consolidation into shared domain contracts
  - removal of the remaining surfaced `z.any()` usage in `src`
  - typed malformed-provider classification across the critical AI/service/route seams

### Phase 4: Operability and Quality Uplift

Target duration: 1 sprint

Tasks:
- replace memory-backed metrics with durable export path
- define SLOs and alert thresholds
- add accessibility automation for recruiter and candidate critical flows
- update release runbook and gate checklist

Primary files/modules:
- `src/lib/server/metrics.ts`
- ops routes and logging/correlation utilities
- Playwright/E2E or comparable higher-level tests

Required validation:
- metrics durability checks
- alert/runbook review
- accessibility CI checks

Phase 4 completion note on 2026-03-26:
- `P1-4` completed.
- Durable metrics now cover:
  - restart-safe rollups
  - multi-instance aggregation
  - submit-outcome instrumentation for in-session progress reliability
  - SQL-backed SLO summaries
  - recruiter ops summary payloads backed by durable data
- Threshold recalibration and denominator tuning are now operational follow-on work, not unresolved remediation work.

---

## Repo-Specific Module Plan

### New modules to add

- `src/lib/server/rate-limit/backend.ts`
- `src/lib/server/rate-limit/types.ts`
- `src/lib/server/config/server-env.ts`
- `src/lib/server/url/get-app-origin.ts`
- `src/lib/server/application/invites/create-invite-batch.ts`
- `src/lib/server/application/invites/resend-invite.ts`
- `src/lib/server/application/invites/types.ts`

### Existing modules to refactor first

- `src/app/api/recruiter/invites/route.ts`
- `src/app/api/invite/send/route.ts`
- `src/app/api/invite/resend/route.ts`
- `src/lib/server/infrastructure/supabase-invite-repository.ts`
- `src/lib/server/auth/candidate-token.ts`
- `src/lib/domain/schemas.ts`
- `src/lib/server/metrics.ts`

---

## Testing Plan

### Must-add tests before production

1. Shared rate-limit semantics
- TTL behavior
- multi-instance consistency
- restart behavior

2. Invite batch failure modes
- failure during persistence mid-batch
- provider failure after persistence
- idempotent retry behavior

3. Auth/env contract tests
- production boot with missing secrets
- candidate token validation consistency

4. Origin generation tests
- malformed app URL
- untrusted request host
- missing production origin

### Next-sprint quality tests

1. Accessibility flow checks
- recruiter create flow
- invite preview/send flow
- candidate session controls and async feedback states

2. Operability tests
- durable metrics write/read behavior
- correlation id propagation in error paths

---

## Risks and Dependencies

### Key technical dependencies

- decision on shared rate-limit backend
- decision on invite-batch consistency model
- agreement on env validation strictness in production

### Risks

- partial refactor of invite flow can increase complexity if route logic and application logic coexist too long
- schema tightening may surface latent malformed payload handling
- durable metrics work can sprawl if backend/vendor choice is not bounded early

Mitigation:
- keep each workstream behind clear acceptance criteria
- avoid parallel refactors of invite flow and schema contract unless necessary

---

## Administrative Cadence

### Weekly review

- update status in the remediation tracker
- record blockers and decision needs
- confirm whether any P0 item is drifting in scope

### Release review

- production remains blocked while any P0 item is not complete
- staging can continue only with explicit risk acceptance recorded

---

## Definition of Done

### P0 complete

- shared limiter is live in production code paths
- invite creation is deterministic under partial failure
- env/auth contract fails fast in production

### P1 complete

- origin helper is canonical
- hardcoded business defaults are centralized or removed
- critical schemas are tightened
- invite routes are thin

### P2 complete

- route-to-application-service follow-on work is landed where scoped
- accessibility automation covers critical paths
- ADRs, runbook, and release gate checklist are in place

---

## Related Documents

- [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)
- [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
