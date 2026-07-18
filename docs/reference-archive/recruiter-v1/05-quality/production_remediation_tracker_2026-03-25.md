# Production Remediation Status

Date opened: 2026-03-25  
Primary review references:
- [implementation-docs-alignment-review_2026-03-30.md](./implementation-docs-alignment-review_2026-03-30.md)
- [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)
- [release-gate-checklist.md](./release-gate-checklist.md)

---

## Current Release Posture

- Production release status: `Blocked`
- Controlled staging / internal validation status: `Allowed with explicit risk acceptance`
- Current blocker: `P0-R3`
- Product-engineering scope: materially complete
- Remaining release-gate dependency: deployment-team completion of live alert delivery validation

This document is the status summary for remediation work. It is not intended to be a running engineering diary.

---

## Executive Summary

The application-side production-readiness program is substantially complete.

Completed outcomes include:

- shared rate limiting in production-backed code paths
- deterministic invite creation under failure
- fail-fast auth and server environment validation
- centralized canonical public-origin handling
- removal of residual recruiter/business identity fallback drift
- tightened runtime schema contracts
- durable metrics and SQL-backed SLO summary support
- route thinning on the highest-value recruiter and candidate entry paths
- accessibility coverage for critical recruiter and candidate flows
- persisted invite-batch reconciliation records plus safe retry endpoint
- a balanced automated test pyramid with unit, integration, and browser smoke coverage

The only remaining open release-gate item is the live paging / Teams delivery validation owned by the deployment team.

---

## Status Dashboard

| Severity | Total | Done | In Progress | Blocked | Not Started |
|----------|-------|------|-------------|---------|-------------|
| P0 | 6 | 5 | 1 | 0 | 0 |
| P1 | 4 | 4 | 0 | 0 | 0 |
| P2 | 2 | 2 | 0 | 0 | 0 |

---

## Work Item Status

| ID | Title | Status | Audience Note |
|----|-------|--------|---------------|
| P0-1 | Replace process-local rate limiting | Done | Shared Supabase/Postgres limiter is implemented, tested, and validated against deployed recruiter and candidate paths |
| P0-2 | Make invite creation deterministic under partial failure | Done | Deterministic mixed-result semantics are in place and no longer rely on opaque route failure |
| P0-3 | Add production fail-fast for auth and required server env | Done | Protected auth, provider, and encryption seams now fail fast under missing production config |
| P1-1 | Centralize canonical app origin resolution | Done | Invite generation, resend, and server-rendered email paths use one trusted origin policy |
| P1-2 | Remove residual hardcoded business defaults | Done | Recruiter/business fallback policy is centralized rather than scattered across UI flows |
| P1-3 | Tighten runtime schemas | Done | Critical request and provider-response contracts now use shared typed runtime validation |
| P1-4 | Land durable metrics path and SLO base layer | Done | Durable rollups and SQL-backed SLO summaries are live and validated; threshold tuning is normal ops follow-on work |
| P2-1 | Continue route-to-application-service extraction | Done | Invite, resend, session start, and base session routes now establish the thin-route/application-service boundary |
| P2-2 | Add accessibility automation for critical flows | Done | Recruiter preview/resend and candidate entry-path accessibility assertions are in CI |
| P0-R1 | Reopen invite batch consistency for durable recovery semantics | Done | Atomic persistence, tracked reconciliation state, and safe retry behavior are implemented and validated |
| P0-R2 | Enforce canonical app origin contract in production | Done | Production origin validation passed with trusted configured env and no request-host fallback |
| P0-R3 | Enforce durable metrics backend and validate paging integration | In Progress | App-side metrics contract and Teams starter are complete; live webhook provisioning and delivery evidence remain deployment-team owned |

---

## Closed Application-Scope Outcomes

### Invite Consistency And Recovery

Completed:

- atomic DB-side invite batch persistence
- deterministic recruiter-visible failure reporting
- durable `batchId` on create
- persisted `invite_batches` and `invite_batch_candidates`
- recruiter-safe retry path at `POST /api/recruiter/invites/[batch_id]/retry`
- happy-path, failure-path, and retry-path validation

Why it matters:

- no mixed partial-write state remains
- failed batches are now auditable and recoverable
- retry behavior is explicit rather than improvised

### Origin And Environment Trust Contract

Completed:

- production uses configured origin only
- `NEXT_PUBLIC_BASE_URL` remains the accepted compatibility fallback
- request-host fallback is not relied on in production
- fail-fast env policy is in place for privileged server behavior

Why it matters:

- candidate-facing links come from trusted configuration
- production startup no longer silently degrades through missing critical server config

### Durable Metrics, SLOs, And Operability Base Layer

Completed:

- durable metrics backend abstraction
- Supabase/Postgres rollups
- SQL-backed SLO summary functions
- recruiter ops metrics endpoint backed by durable data
- Teams alert starter implementation and test coverage

Why it matters:

- metrics survive restart and multi-instance deployment
- alert evaluation is backed by durable operational data
- release readiness is no longer dependent on in-memory process metrics

### Testing Posture

Completed:

- lower-layer expansion for recruiter and candidate surfaces
- workflow-level integration tests for invites, sessions, resend, metrics, and production contracts
- minimum Playwright browser pack for:
  - recruiter create invite
  - candidate practice flow
  - recruiter manage invites / resend
  - recruiter failed batch + retry operator path
  - recruiter auth and settings

Why it matters:

- failure and recovery paths now have durable automated evidence
- release confidence no longer depends only on manual walkthroughs

---

## Open Handoff Item

### P0-R3: Live Alert Delivery Validation

Status:

- app-side implementation complete
- release-gate evidence still open

Deployment-team responsibilities:

- provision the real Teams webhook destination
- validate live delivery from the production alert path
- confirm responder receipt and acknowledgement
- attach evidence to the release record

Product-engineering responsibilities already completed:

- Teams notification starter implementation
- alert payload shaping
- route-level integration
- automated tests
- documentation of ownership boundary and validation expectations

Release implication:

- production remains blocked until deployment-managed delivery evidence exists

---

## Evidence Index

Use these documents as the current supporting references:

- execution and review crosswalk:
  - [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)
- deployment-side release validation:
  - [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
- operational release gate:
  - [release-gate-checklist.md](./release-gate-checklist.md)
- environment contract:
  - [environment_variable_matrix.md](./environment_variable_matrix.md)
- alert policy and ownership:
  - [ops_alert_policy.md](./ops_alert_policy.md)
- testing strategy and current automation footprint:
  - [test_pyramid_plan_2026-03-29.md](./test_pyramid_plan_2026-03-29.md)

---

## Historical Planning References

Earlier planning artifacts were intentionally removed once their outcomes were folded into this tracker and the stable release documents.
