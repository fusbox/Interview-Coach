# Production Deployment Validation Checklist

Date: 2026-03-26  
Primary execution plan: [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)  
Primary tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Release gate: [release-gate-checklist.md](./release-gate-checklist.md)

---

## Purpose

Use this checklist to close the remaining deployment-side work for:

- `P0-R1` invite-batch atomic persistence rollout
- `P0-R2` deployed canonical-origin contract validation
- `P0-R3` deployed durable-metrics enforcement and alert-to-paging validation

This document is intentionally operational. It assumes the local code and focused tests are already complete.

---

## Preconditions

Before starting:

- [ ] Local implementation is merged or otherwise available in the release candidate branch
- [ ] Focused tests passed locally for:
  - invite batch
  - origin contract
  - metrics contract
- [ ] `npx tsc --noEmit` passed on the release candidate
- [ ] Release candidate SHA is recorded
- [ ] Supabase access is available for migration application and RPC verification
- [ ] Deployment environment access is available for env review and post-deploy smoke checks
- [ ] Paging destination and on-call responder are identified for the validation window

Record here:

- Release candidate SHA:
- Supabase project/environment:
- Validation owner:
- Validation window:

---

## Section A: Migration Rollout For Atomic Invite Batch

Goal:

- apply and validate the new `create_invite_batch(...)` RPC before treating `P0-R1` as closed

Migration file:

- [20260326_add_atomic_invite_batch.sql](../../supabase/migrations/20260326_add_atomic_invite_batch.sql)

Steps:

1. Review the migration SQL and confirm it only introduces:
   - `public.create_invite_batch(jsonb)`
   - inserts into existing `sessions`, `questions`, and `candidate_tokens` tables
2. Apply the migration in the target Supabase environment.
3. Verify the RPC exists and is callable by the service-role-backed server path.
4. Confirm no pre-existing RLS or function-permission issue blocks the RPC.

Evidence to capture:

- [ ] Migration applied successfully
- [ ] RPC `public.create_invite_batch` exists
- [ ] Service-role-backed call path succeeds in the target environment
- [ ] No schema drift error is observed

Suggested validation queries/checks:

- confirm function presence in Supabase SQL editor or migration history
- confirm release environment is on the expected migration version

Rollback note:

- if the migration fails, stop rollout and keep production blocked on `P0-R1`

---

## Section B: Deployment Contract Review

Goal:

- confirm the deployed environment matches the new production hardening contract before traffic validation

Required env/settings:

- `NEXT_PUBLIC_APP_URL`
- `METRICS_BACKEND=supabase`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ENCRYPTION_SECRET`
- `RATE_LIMIT_BACKEND=supabase`

Checks:

- [ ] `NEXT_PUBLIC_APP_URL` is explicitly set to the intended public origin
- [ ] `NEXT_PUBLIC_BASE_URL` does not conflict with `NEXT_PUBLIC_APP_URL`
- [ ] `METRICS_BACKEND` is explicitly pinned to `supabase`
- [ ] `RATE_LIMIT_BACKEND` is explicitly pinned to `supabase`
- [ ] No production deployment is relying on implicit fallback for origin or metrics backend

Record here:

- Public origin value reviewed:
- Metrics backend value reviewed:
- Rate-limit backend value reviewed:
- Reviewer:

Failure rule:

- if any required production contract is missing or fallback-based, stop rollout and mark the release `NO-GO`

---

## Section C: Post-Deploy Application Smoke Checks

Goal:

- verify the deployed app is actually exercising the new contracts

### C1. Canonical Origin Validation

Checks:

- [ ] Recruiter invite creation succeeds when `NEXT_PUBLIC_APP_URL` is configured
- [ ] Generated invite links use the configured canonical origin
- [ ] Resend flow uses the same canonical origin
- [ ] No request-host-derived origin appears in generated links

Suggested smoke:

1. Create a recruiter invite from the target environment.
2. Inspect the returned invite link.
3. Trigger resend for the same invite.
4. Inspect the resend link or email output.

Capture:

- one example invite link
- one example resend link or rendered email link

### C2. Atomic Invite Batch Validation

Checks:

- [ ] Happy-path batch creation succeeds for multiple candidates
- [ ] All expected sessions/questions/tokens are created for a successful batch
- [ ] No partial-write state is observed from the happy-path batch

Suggested smoke:

1. Submit a recruiter invite batch with at least two candidates.
2. Confirm the API returns `200`.
3. Confirm both candidate invites are present and usable.

Capture:

- request timestamp
- response status
- candidate/session identifiers

### C3. Durable Metrics Validation

Checks:

- [ ] `/api/recruiter/ops/metrics` is reachable for an authorized recruiter
- [ ] Durable counters are visible after fresh traffic
- [ ] Durable SLO summary remains populated after deploy rollover or fresh process start

Suggested smoke:

1. Trigger one recruiter invite create.
2. Trigger one candidate/session-start path if safe.
3. Open `/api/recruiter/ops/metrics`.
4. Confirm expected counter movement and `sloSummary` presence.

Capture:

- metrics timestamp
- observed counter changes
- observed `sloSummary` snapshot

---

## Section D: Failure-Mode Validation

Goal:

- gather objective evidence for the reopened production blockers, not just happy-path confidence

### D1. Origin Failure Contract

Checks:

- [ ] Non-production environments still allow local request-origin normalization where intended
- [ ] Production deployment would fail without `NEXT_PUBLIC_APP_URL`

Validation options:

- preferred: validate in a production-like ephemeral environment by removing `NEXT_PUBLIC_APP_URL`
- fallback: use deployment tooling or startup logs showing the process fails fast when the variable is missing

Evidence to capture:

- startup failure log or deployment failure screenshot/text

### D2. Metrics Failure Contract

Checks:

- [ ] Production deployment would fail without `METRICS_BACKEND`
- [ ] Production deployment would fail with `METRICS_BACKEND=memory`

Validation options:

- preferred: ephemeral production-like deployment with bad env values
- fallback: deployment startup logs from a controlled validation environment

Evidence to capture:

- one failure log for unset `METRICS_BACKEND`
- one failure log for `METRICS_BACKEND=memory`

### D3. Invite Batch Failure Behavior

Checks:

- [ ] Batch write failure does not leave mixed persisted state
- [ ] Failure response is deterministic and replay-safe through idempotency

Validation options:

- preferred: staging-only forced DB error or temporary controlled constraint violation
- fallback: DB-side manual verification during a controlled failing batch scenario

Evidence to capture:

- failed request timestamp
- response status/body summary
- DB verification that no subset of the failed batch was persisted

---

## Section E: Alert-To-Paging Validation

Goal:

- close the remaining non-code portion of `P0-R3`

Preconditions:

- on-call responder is aware of the exercise
- paging route and escalation target are known
- validation window is approved

Exercise options:

1. Preferred: game-day style failure injection against a non-production environment wired to the same alerting path.
2. Acceptable fallback: manual trigger of the alert route if the paging integration supports a safe test event.

Minimum validation:

- [ ] Trigger one alert condition that should route to paging
- [ ] Confirm alert is emitted
- [ ] Confirm paging destination receives it
- [ ] Confirm responder acknowledges it
- [ ] Confirm incident notes are recorded

Recommended target alert:

- one of:
  - `ai_error_spike`
  - `invite_delivery_failures`
  - `auth_abuse_spike`

Record here:

- Alert exercised:
- Trigger method:
- Pager destination:
- Time sent:
- Time received:
- Responder:
- Acknowledged:

Failure rule:

- if alert generation works but paging delivery does not, `P0-R3` remains open

---

## Section F: Release Gate Closeout

Use this only after Sections A-E are complete.

- [ ] Migration rollout evidence attached
- [ ] Production env contract reviewed and recorded
- [ ] Post-deploy smoke checks completed
- [ ] Failure-mode validation evidence attached
- [ ] Paging validation evidence attached
- [ ] [release-gate-checklist.md](./release-gate-checklist.md) rerun
- [ ] Tracker updated with final status for `P0-R1`, `P0-R2`, `P0-R3`
- [ ] New production recommendation recorded

Final recommendation:

- [ ] `GO`
- [ ] `NO-GO`

Notes:

- Summary:
- Remaining risks:
- Follow-up work:
