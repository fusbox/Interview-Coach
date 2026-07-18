# Quality Documentation

This folder holds the current quality, release-readiness, operability, and product-quality references for the repo.

The goal of this section is present-day clarity. These docs should describe the live recruiter-led app as it exists now, plus a few explicitly labeled reference artifacts for future decisions.

---

## Start Here

If you need the current release posture, begin with:

1. [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
2. [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)
3. [release-gate-checklist.md](./release-gate-checklist.md)

If you need deployment-time validation detail, add:

4. [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
5. [production-hardening-runbook.md](./production-hardening-runbook.md)

If you need current test strategy and coverage shape, add:

6. [test_pyramid_plan_2026-03-29.md](./test_pyramid_plan_2026-03-29.md)

---

## Current Source-Of-Truth Documents

### Release and remediation status

- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
  Current status summary for remediation and release posture.

- [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)
  Stable explanation of the reopened production-gate workstreams and what remains open.

- [release-gate-checklist.md](./release-gate-checklist.md)
  Release approval checklist for a concrete release candidate.

- [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
  Deployment-time validation checklist for migrations, env contract, smoke checks, and live alert evidence.

- [production-hardening-runbook.md](./production-hardening-runbook.md)
  Operating guide for handoff, release validation flow, and ownership boundaries.

### Testing

- [test_pyramid_plan_2026-03-29.md](./test_pyramid_plan_2026-03-29.md)
  Current testing strategy and implemented unit / integration / E2E posture.

### Operations and runtime quality

- [environment_variable_matrix.md](./environment_variable_matrix.md)
  Current environment-variable contract and deployment guidance.

- [ops improvement/operational-improvement_working_doc_2026-04-06.md](./ops%20improvement/operational-improvement_working_doc_2026-04-06.md)
  Master setup and execution guide for GitHub operations, cadence, backlog hygiene, and repeatable project-management routines.

- [ops_alert_policy.md](./ops_alert_policy.md)
  Current alert definitions, routing intent, and delivery ownership notes.

- [incident_runbook.md](./incident_runbook.md)
  Live incident-response guide for current alert classes.

- [initial_slos_2026-03-26.md](./initial_slos_2026-03-26.md)
  Current SLO proposal aligned to the durable metrics implementation.

### Product and AI quality

- [QA-checklist.md](./QA-checklist.md)
  Current UX and product-quality contract for the live app.

- [feedback-chain-spec.md](./feedback-chain-spec.md)
  Target behavior for answer-level coaching feedback.

- [implementation-docs-alignment-review_2026-03-30.md](./implementation-docs-alignment-review_2026-03-30.md)
  Audit of where code and docs currently align or drift.

### Reference-only documents

- [readiness-band-definition.md](./readiness-band-definition.md)
  Inactive future-state reference for recruiter-facing readiness.

- [readiness-eval-scenarios.md](./readiness-eval-scenarios.md)
  Future-state regression scenarios for readiness if that concept is ever reactivated.

- [readiness-disposition-plan_2026-03-31.md](./readiness-disposition-plan_2026-03-31.md)
  Decision support for how to quarantine or remove dormant readiness code.

---

## Reading Paths

### For release approval

Read in this order:

1. [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
2. [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)
3. [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
4. [release-gate-checklist.md](./release-gate-checklist.md)
5. [environment_variable_matrix.md](./environment_variable_matrix.md)
6. [ops_alert_policy.md](./ops_alert_policy.md)

### For test coverage and automation

Read in this order:

1. [test_pyramid_plan_2026-03-29.md](./test_pyramid_plan_2026-03-29.md)
2. [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
3. [QA-checklist.md](./QA-checklist.md)

### For current product and coaching quality

Read in this order:

1. [QA-checklist.md](./QA-checklist.md)
2. [feedback-chain-spec.md](./feedback-chain-spec.md)
3. [implementation-docs-alignment-review_2026-03-30.md](./implementation-docs-alignment-review_2026-03-30.md)
4. [debug/ai_context.md](./debug/ai_context.md)

### For readiness cleanup decisions

Read in this order:

1. [readiness-disposition-plan_2026-03-31.md](./readiness-disposition-plan_2026-03-31.md)
2. [readiness-band-definition.md](./readiness-band-definition.md)
3. [readiness-eval-scenarios.md](./readiness-eval-scenarios.md)
