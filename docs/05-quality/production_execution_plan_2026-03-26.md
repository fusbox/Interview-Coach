# Production Execution Plan

Date: 2026-03-26  
Primary architecture/quality review: [implementation-docs-alignment-review_2026-03-30.md](./implementation-docs-alignment-review_2026-03-30.md)  
Primary status reference: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Deployment validation: [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)

---

## Purpose

This document explains the release-facing execution model that emerged from the 2026-03-26 production-gate reopen.

It is the stable reference for:

- what was required to satisfy the reopened blockers
- what is now complete in application scope
- what remains deployment-managed before production promotion

---

## Current Release Position

- Production: `NO-GO`
- Controlled staging / internal validation: `GO with explicit risk acceptance`

Reason:

- all application-owned reopened blockers are complete
- the remaining open item is deployment-team validation of live alert delivery under `P0-R3`

---

## Execution Model

The reopened production gate was resolved through three workstreams.

### Workstream 1: Invite Consistency And Recovery

Outcome: `Complete`

Delivered:

- DB-side atomic invite-batch persistence
- durable `batchId` on recruiter invite creation
- persisted reconciliation state in `invite_batches` and `invite_batch_candidates`
- recruiter-safe retry endpoint at `POST /api/recruiter/invites/[batch_id]/retry`
- happy-path, failure-path, and retry-path validation

Release significance:

- no ambiguous partial persisted state remains
- failed batches are recoverable and auditable
- recruiter retry behavior is backed by explicit server-side contract

### Workstream 2: Canonical Origin Enforcement

Outcome: `Complete`

Delivered:

- centralized trusted-origin handling
- production configured-origin enforcement
- compatibility support for `NEXT_PUBLIC_BASE_URL`
- removal of request-host fallback reliance in production

Release significance:

- candidate-facing links come from trusted configuration
- production behavior is no longer dependent on mutable request host input

### Workstream 3: Durable Metrics And Alerting Contract

Outcome: `Partially complete in deployment scope`

Completed in application scope:

- durable metrics backend support
- SQL-backed SLO summaries
- recruiter ops metrics route backed by durable data
- production metrics contract enforcement in app code
- Teams notification starter implementation and tests

Still open in deployment scope:

- provisioning the live Teams webhook destination
- validating actual alert delivery and responder acknowledgement

Release significance:

- instrumentation and alert evaluation are in place
- production promotion still requires live delivery evidence

---

## Review Crosswalk

This section maps the latest review themes to their current status.

### Hardening Strategy

Status: `Addressed`

- transaction-safe invite handling: complete
- reconciliation records: complete
- production canonical origin policy: complete

### Refactor Suggestions

Status: `Addressed for remediation scope`

- route thinning on the highest-value invite and session surfaces: complete for remediation scope
- hardcoded recruiter/org defaults cleanup: complete
- send vs resend metrics naming split: complete

### Gaps And Recommendations

Status: `Addressed in current application scope`

- partial invite-batch response contract coverage: complete
- durable metrics/SLO RPC compatibility coverage: complete
- shared multi-instance rate-limit reliability evidence: complete

### Mitigations

Status:

- invite tracking and safe retry: complete
- production origin env contract: complete
- recurring CI policy around log-redaction auditing: still a follow-on for the core dev / CI owners, not a release blocker within product-engineering scope

### Required Upgrades

Status:

- durable metrics requirement: complete in code and validated operationally
- alert-to-paging validation: still open in deployment scope
- release-gate rule tied to operational evidence: documented and active

### Punch List

Status: `Addressed for current remediation scope`

- recruiter accessibility and polish assertions are in place
- browser smoke now covers the minimum critical recruiter and candidate flows

### Repo Checklist

Status: `Addressed`

- deployment contract docs exist
- release gate exists and keeps production blocked while open items remain

---

## Remaining Handoff Item

### Live Teams / Paging Validation

Owner:

- deployment team / production operators

Why it remains open:

- the app can evaluate alerts and format Teams notifications
- production readiness still requires proof that the configured destination actually receives them

Required evidence:

- webhook is provisioned in the target deployment environment
- at least one real alert is delivered to the intended destination
- responder acknowledgement is confirmed and recorded

This is the only remaining open item preventing a production `GO`.

---

## Related Audience Documents

Use these as the companion set:

- current status:
  - [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
- release approval:
  - [release-gate-checklist.md](./release-gate-checklist.md)
- deployment validation:
  - [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
- operator guidance:
  - [production-hardening-runbook.md](./production-hardening-runbook.md)
- environment contract:
  - [environment_variable_matrix.md](./environment_variable_matrix.md)
- alert routing and ownership:
  - [ops_alert_policy.md](./ops_alert_policy.md)

---

## Historical Note

The earlier remediation plan from 2026-03-25 remains useful as a planning artifact, but current release posture should be read from this document, the tracker, and the release gate rather than from earlier implementation-phase planning notes.
