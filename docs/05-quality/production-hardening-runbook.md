# Production Hardening Runbook

Date: 2026-03-25  
Primary status reference: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Deployment checklist: [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)  
Release gate: [release-gate-checklist.md](./release-gate-checklist.md)

---

## Purpose

This runbook describes how to operate the hardening and release-readiness process at handoff time.

It is intended for:

- engineering leads
- deployment operators
- reviewers approving a release candidate

It is not a live incident-response document. For that, use [incident_runbook.md](./incident_runbook.md).

---

## Current Operating Model

Use the following documents together:

1. status:
   - [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
2. deployment validation:
   - [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
3. final release approval:
   - [release-gate-checklist.md](./release-gate-checklist.md)

This runbook exists to make sure the same release candidate is validated consistently across those three documents.

---

## Release Validation Sequence

Run in this order:

1. identify the release candidate
2. complete deployment validation
3. review any open handoff-owned dependencies
4. complete the release gate
5. record the final production recommendation

---

## Operator Responsibilities

### Product Engineering

Responsible for:

- application implementation
- automated tests
- app-owned recovery behavior
- documentation of the production contract
- documentation of any deployment-team handoff boundary

### Deployment Team / Operators

Responsible for:

- environment provisioning
- migration application in the target environment
- real webhook / paging destination configuration
- final live alert-delivery validation
- production promotion decision support

---

## Validation Rules

### A release candidate is not ready for production unless:

- deployment validation checklist is complete
- release gate checklist is complete
- the current tracker still shows no open application-owned P0 items
- any deployment-managed evidence requirement is attached to the release record

### The current blocker remains:

- live Teams / alert delivery validation for `P0-R3`

Until that evidence exists:

- production remains `NO-GO`

---

## Update Discipline

When a release decision or release-relevant validation changes:

- update the tracker summary
- update the deployment validation record if new evidence was produced
- ensure the release gate reflects the same current posture

Do not use these docs as a running engineering scratchpad. They should read as current reference material for handoff and approval.

---

## Companion Update Rules

If the release contract changes, also update:

- [environment_variable_matrix.md](./environment_variable_matrix.md)
- [ops_alert_policy.md](./ops_alert_policy.md)
- [initial_slos_2026-03-26.md](./initial_slos_2026-03-26.md) if SLO interpretation changes
- relevant architecture docs under `docs/04-architecture` if system boundaries changed materially

If invite consistency or retry behavior changes, also update:

- [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
- [release-gate-checklist.md](./release-gate-checklist.md)

---

## Escalation Guidance

Escalate if:

- a release is being considered while the tracker still shows an open P0 blocker
- deployment validation evidence and release-gate evidence disagree
- webhook / paging ownership is unclear for the current release candidate
- a hardening change alters trust, privacy, or operational ownership boundaries without documentation updates

Recommended escalation path:

1. engineering lead
2. product owner
3. architecture or governance review if the trust boundary changed

---

## Historical Planning References

Earlier planning artifacts were intentionally removed once their contents were folded into the stable tracker, execution plan, and release documents.
