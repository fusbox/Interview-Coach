# Production Deployment Validation Checklist

Date: 2026-03-26  
Primary execution reference: [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)  
Primary status reference: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Release gate: [release-gate-checklist.md](./release-gate-checklist.md)

---

## Purpose

Use this checklist when validating a concrete deployment candidate for production.

This checklist assumes the application code and automated tests are already complete. It focuses on deployment-time proof.

---

## Current Validation Position

Validated in application scope:

- invite-batch consistency and retry model
- configured-origin contract
- durable metrics and SLO summaries

Still requiring deployment-team evidence:

- live Teams / alert delivery validation

---

## Release Candidate Record

- Release candidate SHA:
- Deployment target:
- Supabase project:
- Validation owner:
- Validation window:

---

## 1. Environment And Access Preconditions

- [ ] Release candidate is identified and available
- [ ] Required migrations are present in the target branch or release artifact
- [ ] Supabase access is available for migration and verification
- [ ] Deployment environment access is available for env review and smoke checks
- [ ] Alert destination owner is identified for the validation window

---

## 2. Migration Validation

Required migrations:

- [20260326_add_atomic_invite_batch.sql](../../supabase/migrations/20260326_add_atomic_invite_batch.sql)
- [20260328_add_invite_batch_tracking.sql](../../supabase/migrations/20260328_add_invite_batch_tracking.sql)

Validate:

- [ ] `public.create_invite_batch(jsonb)` exists in the target database
- [ ] `invite_batches` exists
- [ ] `invite_batch_candidates` exists
- [ ] service-role-backed app writes can use the RPC and tracking tables successfully

Capture:

- migration confirmation
- target database identifier
- any relevant SQL verification evidence

---

## 3. Production Contract Review

Confirm the deployed environment uses the intended production contract:

- [ ] trusted public origin is configured through `NEXT_PUBLIC_APP_URL` or accepted compatibility fallback `NEXT_PUBLIC_BASE_URL`
- [ ] `METRICS_BACKEND=supabase`
- [ ] `RATE_LIMIT_BACKEND=supabase`
- [ ] no production behavior depends on implicit fallback for origin or durable metrics

Capture:

- reviewed public origin value
- reviewed metrics backend value
- reviewed rate-limit backend value

---

## 4. Application Smoke Validation

### Invite And Origin

- [ ] recruiter invite creation succeeds
- [ ] generated invite links use the configured canonical origin
- [ ] resend uses the same canonical origin

### Invite Tracking And Retry

- [ ] create response returns a durable `batchId`
- [ ] failed batches are represented in `invite_batches` and `invite_batch_candidates`
- [ ] retry endpoint successfully retries only failed-and-retryable candidates
- [ ] parent/child retry lineage is recorded

### Durable Metrics

- [ ] `/api/recruiter/ops/metrics` is reachable for an authorized recruiter
- [ ] durable counters are visible after fresh traffic
- [ ] `sloSummary` is populated from durable data

Capture:

- invite link example
- one `batchId`
- retry evidence
- metrics snapshot evidence

---

## 5. Failure-Mode Validation

### Origin Contract

- [ ] missing configured production origin is known to fail fast in a production-like validation path

### Invite Consistency

- [ ] controlled failing batch does not leave mixed persisted state
- [ ] failed batch state is captured in tracking tables
- [ ] retry path succeeds after the failure condition is removed

### Metrics Contract

- [ ] production-like validation exists for rejecting unset or memory-backed metrics configuration

Capture:

- failure evidence
- retry evidence
- deployment or startup failure evidence where applicable

---

## 6. Alert Delivery Validation

This is the remaining open release-gate dependency.

- [ ] live Teams webhook is provisioned in the target deployment environment
- [ ] one real or safe test alert is emitted
- [ ] Teams destination receives it
- [ ] responder acknowledgement is confirmed
- [ ] validation evidence is attached to the release record

If this section is not complete:

- production remains blocked

---

## 7. Release-Gate Closeout

- [ ] [release-gate-checklist.md](./release-gate-checklist.md) is completed for the same release candidate
- [ ] [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md) still reflects the real open/closed state
- [ ] final release recommendation is recorded

Decision:

- [ ] `GO`
- [ ] `NO-GO`

Notes:

- Summary:
- Remaining risks:
- Follow-up items:
