# Production Hardening Runbook

Date: 2026-03-25  
Primary tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Primary execution plan: [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)
Current release checklist: [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)

---

## Purpose

This runbook is for administering the hardening effort itself.

Use it when:

- planning remediation execution
- running weekly status reviews
- deciding whether production remains blocked
- verifying that completed remediation work also updated tests and docs

This runbook is complementary to the operational incident runbook. It is about governance and execution discipline, not live incident response.

---

## Current Release Run Sequence

Use this sequence for the 2026-03-26 production-gate reopen work.

Primary operator checklist:

- [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)

Run in this order:

1. Preconditions and ownership
- record the release candidate SHA
- name the validation owner
- confirm Supabase, deployment, and paging access before any rollout step

2. Migration rollout
- apply [20260326_add_atomic_invite_batch.sql](../../supabase/migrations/20260326_add_atomic_invite_batch.sql)
- apply [20260328_add_invite_batch_tracking.sql](../../supabase/migrations/20260328_add_invite_batch_tracking.sql)
- verify `public.create_invite_batch(...)` exists and is callable
- verify `invite_batches` and `invite_batch_candidates` exist and are writable
- stop immediately if the migration or RPC validation fails

3. Production contract review
- confirm `NEXT_PUBLIC_APP_URL` is explicitly set
- confirm `METRICS_BACKEND=supabase`
- confirm `RATE_LIMIT_BACKEND=supabase`
- do not continue if any production contract still relies on fallback behavior

4. Post-deploy smoke validation
- create a recruiter invite and inspect the generated link origin
- validate resend uses the same canonical origin
- validate atomic multi-candidate invite creation on the deployed build
- confirm invite create returns a durable `batchId`
- validate `POST /api/recruiter/invites/[batch_id]/retry` against a controlled failed batch
- open `/api/recruiter/ops/metrics` and confirm durable counters and `sloSummary`

5. Failure-mode evidence
- capture proof that production-like startup fails without `NEXT_PUBLIC_APP_URL`
- capture proof that production-like startup fails without `METRICS_BACKEND` or with `METRICS_BACKEND=memory`
- validate that a controlled failing invite batch does not leave mixed persisted state
- validate that the failed batch is persisted with per-candidate failure state and can be retried safely through the tracked retry path

6. Paging exercise
- trigger one safe alerting scenario
- confirm alert emission, pager delivery, responder acknowledgement, and incident-note capture
- keep `P0-R3` open if paging delivery is not objectively confirmed

7. Release-gate closeout
- rerun [release-gate-checklist.md](./release-gate-checklist.md)
- update [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
- record the new production recommendation

Stop conditions:

- migration fails
- required env contract is missing
- origin smoke shows request-host-derived links
- invite failure-mode validation shows partial persisted state
- paging validation does not reach the responder

---

## Weekly Review Procedure

Run this review at least once per week while remediation is active.

### 1. Update the tracker

Open:

- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

Verify:

- current status for each item
- assigned owners
- current sprint targets
- active blockers

### 2. Confirm P0 posture

Ask:

- Is any P0 item still not started or in progress?
- Did any change claim to close a P0 item without tests?
- Did any implementation land without updating related docs?

If yes:

- production remains blocked

### 3. Review implementation evidence

For any item marked done, confirm:

- code merged
- tests added or updated
- docs updated
- follow-up operational implications captured

Do not accept:

- “done in code, docs later”
- “tested manually only” for P0 items

### 4. Review decision needs

Check whether any open item needs a decision on:

- backend choice
- consistency model
- strictness of env validation
- observability backend

Record these in the tracker decision log.

### 5. Check release status

Open:

- [release-gate-checklist.md](./release-gate-checklist.md)

Confirm whether the release posture changed.

---

## Completion Rules

### A remediation item may move to `In Progress` only when:

- an owner is assigned
- implementation scope is bounded
- dependencies are understood

### A remediation item may move to `Done` only when:

- implementation is merged
- required tests are passing
- relevant docs are updated
- tracker notes reflect the outcome

---

## Required Companion Updates by Work Type

### If rate limiting changes

Update:

- [ops_alert_policy.md](./ops_alert_policy.md)
- [incident_runbook.md](./incident_runbook.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

### If invite consistency behavior changes

Update:

- [../04-architecture/e2e-flow.md](../04-architecture/e2e-flow.md)
- [../04-architecture/api-surface.md](../04-architecture/api-surface.md)
- [incident_runbook.md](./incident_runbook.md)
- [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

### If auth/env startup policy changes

Update:

- [environment_variable_matrix.md](./environment_variable_matrix.md)
- [incident_runbook.md](./incident_runbook.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

### If architecture boundaries change materially

Update:

- [../04-architecture/code-organization.md](../04-architecture/code-organization.md)
- [../04-architecture/api-surface.md](../04-architecture/api-surface.md)
- [../04-architecture/gate-decisions.md](../04-architecture/gate-decisions.md) if trust-sensitive behavior changed

### If metrics durability or SLO wiring changes

Update:

- [ops_alert_policy.md](./ops_alert_policy.md)
- [release-gate-checklist.md](./release-gate-checklist.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
- [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)

---

## Escalation Rules

Escalate when:

- a P0 item slips by more than one sprint
- a remediation item is marked blocked without a named decision owner
- a release is being considered while any P0 item lacks objective evidence
- a hardening change introduces a new trust, privacy, or interpretation boundary

Escalation path:

1. Engineering lead
2. Product owner
3. Architecture/governance review if a boundary or trust guarantee changed

---

## Administrative Checklist

Use this at the end of each weekly review.

- [ ] Tracker status updated
- [ ] Blockers recorded
- [ ] Decision log updated if needed
- [ ] P0 release posture confirmed
- [ ] Any completed item verified against tests and docs
- [ ] Next sprint targets assigned

---

## Related Documents

- [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)
- [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
- [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
- [release-gate-checklist.md](./release-gate-checklist.md)
- [incident_runbook.md](./incident_runbook.md)
