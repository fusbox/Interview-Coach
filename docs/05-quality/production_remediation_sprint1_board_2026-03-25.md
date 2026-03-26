# Production Remediation Sprint 1 Board

Date: 2026-03-25  
Source tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Source issue breakdown: [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)

---

## Sprint Goal

Establish the production hardening foundation by closing the auth/env contract gap, centralizing canonical origin handling, and replacing process-local throttling with a shared rate-limit architecture.

This sprint should create the base layer required before invite-batch consistency work begins.
This sprint also established the stop point for initial invite-batch semantics so Sprint 2 does not expand prematurely into batch-job infrastructure.

---

## In-Scope Items

### 1. P0-3: Production Fail-Fast for Auth and Required Server Env

Owner: Platform / backend  
Status: Done

Primary deliverables:
- `server-env` contract module
- production startup validation for required secrets
- candidate-token protected path review and fallback removal where unsafe

Acceptance criteria:
- production boot fails when required auth/service env is missing
- candidate token verification does not vary based on missing service-role env

### 2. P1-1: Canonical App Origin Resolution

Owner: Backend / platform  
Status: Done

Primary deliverables:
- trusted origin helper
- invite/send/resend flows migrated to canonical origin utility

Acceptance criteria:
- no ad hoc invite-link origin building remains in invite flows
- malformed or untrusted origin sources fail deterministically

### 3. P0-1: Shared Rate Limiting

Owner: Platform / backend  
Status: Done

Primary deliverables:
- backend abstraction
- production backend selection
- invite routes migrated off process-local limiter

Acceptance criteria:
- process-local rate limiting no longer acts as production protection
- rate-limit semantics survive restart and scale-out

---

## Out of Scope

Do not expand Sprint 1 into:

- full invite-batch orchestration rewrite
- durable metrics implementation
- broad application-service extraction beyond the minimum needed to support Sprint 2 planning
- large AI schema cleanup

These are later-phase items and should not dilute P0 closure.

---

## Recommended Task Order

1. Finalize env inventory and production secret contract
2. Land `server-env` validation module
3. Implement canonical origin helper
4. Select shared limiter backend
5. Land rate-limit abstraction
6. Migrate invite routes to shared limiter
7. Add test coverage for env/origin/limiter behavior

---

## Suggested PR Breakdown

### PR 1: Server Env Contract

Contents:
- `server-env` module
- production validation rules
- tests for missing/invalid env

### PR 2: Canonical Origin Utility

Contents:
- `get-app-origin` helper
- invite route adoption
- origin contract tests

### PR 3: Shared Rate-Limit Backend

Contents:
- limiter backend abstraction
- production backend integration
- route migration
- TTL/multi-instance tests

---

## Risks

### Risk 1

Backend choice for shared throttling is delayed.

Mitigation:
- decide Redis vs Postgres at sprint start
- do not let implementation begin without that decision

### Risk 2

Env validation is made too permissive to avoid deployment friction.

Mitigation:
- production strictness must remain non-negotiable
- dev-only relaxations should be explicit and tested

### Risk 3

Origin helper remains half-adopted, leaving mixed link-generation behavior.

Mitigation:
- treat migration as incomplete until invite send and resend paths both use the helper

### Risk 4

Invite-batch consistency work starts before the new shared limiter migration is applied in the target environment.

Mitigation:
- apply `20260325_add_rate_limit_buckets.sql` before production promotion
- keep `P0-1` open until rollout validation is complete

---

## Exit Criteria

Sprint 1 is complete only when:

- [x] `P0-3` is done
- [x] `P1-1` is done
- [x] `P0-1` is done
- [x] tests for these items are merged and passing
- [x] tracker and runbook docs are updated with outcomes

### Progress Snapshot

- `P0-3` completed:
  - server env contract
  - production fail-fast auth/provider/encryption seams
- `P1-1` completed:
  - canonical origin helper
  - invite/resend/email/previews aligned
- `P0-1` completed:
  - Supabase/Postgres backend selected
  - async limiter abstraction landed
  - migration applied and database path validated
  - focused route coverage passing locally
  - deployed recruiter and candidate `429 RATE_LIMITED` smoke tests passed

If any item above is incomplete:

- [x] Condition cleared on 2026-03-25; Sprint 1 exit criteria are satisfied

### Sprint 2 Planning Note

- `P0-2` has now reached the agreed initial-rollout stop point:
  - deterministic mixed-result invite creation
  - recruiter-visible partial failures
  - idempotent replay for partial results
- Sprint 2 should not reopen batch semantics unless ATS integration or rollout evidence justifies durable batch records or retry-failed-only tooling

---

## Review Cadence

Use this board during:

- sprint kickoff
- mid-sprint check
- sprint close-out review

Update the canonical tracker after each review:

- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
