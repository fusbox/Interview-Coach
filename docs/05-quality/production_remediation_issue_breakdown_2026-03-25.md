# Production Remediation Issue Breakdown

Date: 2026-03-25  
Status: Historical acceptance-criteria reference  
Current status reference: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

---

## Purpose

This document preserves the issue-style decomposition of the remediation program.

It remains useful when someone wants the original engineering intent and acceptance criteria for a work item, but it is no longer maintained as an active worklog.

---

## Current Interpretation

Most items in the original breakdown are now complete. The only open release-gate dependency is:

- `P0-R3` live alert-delivery validation owned by the deployment team

For current release posture and ownership boundaries, use the tracker and execution plan.

---

## Original Work Item Set

### P0-1 Replace Process-Local Rate Limiting

Status: `Complete`

Delivered outcome:

- production-backed shared limiter
- multi-instance-safe semantics
- deployed recruiter and candidate route validation

### P0-2 Make Invite Creation Deterministic Under Partial Failure

Status: `Complete`

Delivered outcome:

- deterministic recruiter-visible results
- explicit per-candidate create outcome modeling
- replay-safe response behavior

Later follow-on also delivered:

- tracked reconciliation state
- safe retry endpoint

### P0-3 Add Production Fail-Fast For Auth And Required Server Env

Status: `Complete`

Delivered outcome:

- fail-fast production env contract across privileged server seams

### P1-1 Centralize Canonical App Origin Resolution

Status: `Complete`

Delivered outcome:

- centralized trusted-origin handling
- shared invite/resend/email origin policy

### P1-2 Remove Residual Hardcoded Business Defaults

Status: `Complete`

Delivered outcome:

- centralized recruiter/business fallback policy

### P1-3 Tighten Runtime Schemas

Status: `Complete`

Delivered outcome:

- shared typed runtime contracts on critical request and provider-response paths

### P1-4 Land Durable Metrics Path And SLO Base Layer

Status: `Complete`

Delivered outcome:

- durable metrics
- SQL-backed SLO summaries
- recruiter ops metrics backed by durable data

### P2-1 Continue Route-To-Application-Service Extraction

Status: `Complete for remediation scope`

Delivered outcome:

- thin-route/application-service boundary on the main invite and session entry paths

### P2-2 Add Accessibility Automation For Critical Flows

Status: `Complete for remediation scope`

Delivered outcome:

- CI-facing accessibility assertions on critical recruiter and candidate flows

### P0-R1 Invite Recovery And Reconciliation

Status: `Complete`

Delivered outcome:

- tracked invite batch persistence
- safe retry capability
- happy, failure, and retry validation

### P0-R2 Canonical Origin Enforcement In Production

Status: `Complete`

Delivered outcome:

- production trusted-origin contract validation

### P0-R3 Durable Metrics Enforcement And Paging Validation

Status: `Application scope complete; deployment validation still open`

Delivered in application scope:

- durable metrics enforcement
- Teams alert starter
- tests and documentation

Still open:

- deployment-managed live Teams delivery evidence

---

## Use Of This Document

Use this file when you want:

- the original acceptance-criteria shape of an item
- historical decomposition of the remediation program

Do not use it as:

- the current status dashboard
- the release approval checklist
- the deployment sign-off record
