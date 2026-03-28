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
- `P0-R3` deployed durable-metrics enforcement and alert-to-paging validation, including deployment-team webhook ownership where applicable

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

## Section A: Migration Rollout For Invite Batch Consistency

Goal:

- apply and validate the invite-batch consistency migrations before treating the current tracked-retry model as rolled out

Migration file:

- [20260326_add_atomic_invite_batch.sql](../../supabase/migrations/20260326_add_atomic_invite_batch.sql)
- [20260328_add_invite_batch_tracking.sql](../../supabase/migrations/20260328_add_invite_batch_tracking.sql)

Steps:

1. Review the migration SQL and confirm it only introduces:
   - `public.create_invite_batch(jsonb)`
   - inserts into existing `sessions`, `questions`, and `candidate_tokens` tables
2. Review the tracking migration SQL and confirm it introduces only the tracked-batch persistence surfaces needed for recovery:
   - `invite_batches`
   - `invite_batch_candidates`
   - batch lineage / retry metadata
3. Apply both migrations in the target Supabase environment.
4. Verify the RPC exists and is callable by the service-role-backed server path.
5. Verify the tracking tables are present and writable by the service-role-backed server path.
6. Confirm no pre-existing RLS or function-permission issue blocks the RPC or tracked-batch writes.

Evidence to capture:

- [x] Migration applied successfully
- [x] RPC `public.create_invite_batch` exists
- [x] Service-role-backed call path succeeds in the target environment
- [x] No schema drift error is observed
- [ ] Tracking tables `invite_batches` and `invite_batch_candidates` exist
- [ ] Service-role-backed tracked-batch writes succeed in the target environment

Suggested validation queries/checks:

- confirm function presence in Supabase SQL editor or migration history
- confirm release environment is on the expected migration version

Rollback note:

- if the migration fails, stop rollout and keep production blocked on `P0-R1`

Validation status on 2026-03-27:

- migration was already applied in the target Supabase project
- deployed multi-recipient happy-path invite creation passed
- `P0-R1` is no longer blocked on Section A

Follow-on rollout note on 2026-03-28:

- the tracked-batch migration and recruiter retry endpoint landed in app code
- rollout is not complete until `20260328_add_invite_batch_tracking.sql` is applied in the target Supabase project and the retry endpoint is validated against those tables

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

- [x] `NEXT_PUBLIC_APP_URL` is explicitly set to the intended public origin
- [x] `NEXT_PUBLIC_BASE_URL` does not conflict with `NEXT_PUBLIC_APP_URL`
- [x] `METRICS_BACKEND` is explicitly pinned to `supabase`
- [x] `RATE_LIMIT_BACKEND` is explicitly pinned to `supabase`
- [ ] No production deployment is relying on implicit fallback for origin or metrics backend

Record here:

- Public origin value reviewed: Y
- Metrics backend value reviewed: Y
- Rate-limit backend value reviewed: Y
- Reviewer: Fu Chen

Failure rule:

- if any required production contract is missing or fallback-based, stop rollout and mark the release `NO-GO`

Validation status on 2026-03-27:

- production origin configuration was corrected and redeployed
- deployed invite-create and practice-session flows passed afterward
- `P0-R2` is no longer blocked on Section B for origin validation

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

- [x] Happy-path batch creation succeeds for multiple candidates
- [x] All expected sessions/questions/tokens are created for a successful batch
- [x] No partial-write state is observed from the happy-path batch
- [ ] Create response returns a durable `batchId`
- [ ] A failed batch is represented in `invite_batches` and `invite_batch_candidates`
- [ ] `POST /api/recruiter/invites/[batch_id]/retry` retries only failed-and-retryable candidates
- [ ] Parent/child retry lineage is recorded after a successful retry

Suggested smoke:

1. Submit a recruiter invite batch with at least two candidates.
2. Confirm the API returns `200`.
3. Confirm both candidate invites are present and usable.

Capture:

- request timestamp
- response status
- candidate/session identifiers
- returned `batchId`
- tracked batch row identifiers if verified in SQL

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

Validation status on 2026-03-27:

- satisfied by observed deployed failure when configured origin env was missing
- satisfied by successful redeploy after restoring configured origin env
- `P0-R2` failure-mode and recovery evidence is satisfied

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

Validation status on 2026-03-27:

- completed with a temporary fail trigger inside `public.create_invite_batch(...)`
- recruiter UI showed deterministic all-failure handling for the batch
- no new `sessions`, `questions`, or `candidate_tokens` rows were created
- `P0-R1` failure-mode evidence is satisfied

Follow-on validation needed on 2026-03-28:

- confirm the failed batch is persisted in tracking tables with per-candidate failure state
- confirm the retry endpoint creates a child batch only for retryable failed candidates and marks the original batch `retry_issued`

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

Owner note:
- If TEAMS_ALERT_WEBHOOK_URL provisioning is deployment-managed, product engineering may stop after handing off the tested Teams starter implementation and docs. Final completion evidence for this section must then be attached by the deployment team.

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
- if webhook provisioning has not yet been completed by the deployment team, record this section as an ownership handoff rather than a product-engineering miss

---

## Section F: Release Gate Closeout

Use this only after Sections A-E are complete.

- [x] Migration rollout evidence attached
- [x] Production env contract reviewed and recorded
- [x] Post-deploy smoke checks completed
- [x] Failure-mode validation evidence attached
- [x] Failure-mode validation evidence attached for `P0-R1`
- [ ] Invite tracking migration and retry-endpoint evidence attached
- [ ] Paging validation evidence attached
- [ ] [release-gate-checklist.md](./release-gate-checklist.md) rerun
- [ ] Tracker updated with final status for remaining open item `P0-R3`
- [ ] New production recommendation recorded

Final recommendation:

- [ ] `GO`
- [ ] `NO-GO`

Notes:

- Summary:
- Remaining risks:
- Follow-up work:

