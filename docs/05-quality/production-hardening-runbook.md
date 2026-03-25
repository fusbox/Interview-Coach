# Production Hardening Runbook

Date: 2026-03-25  
Primary tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Primary execution plan: [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)

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
- [release-gate-checklist.md](./release-gate-checklist.md)
- [incident_runbook.md](./incident_runbook.md)
