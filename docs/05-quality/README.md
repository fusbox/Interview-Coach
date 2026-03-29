# Quality Documentation

This folder holds the quality, release-readiness, operability, and AI-quality references for the repo.

The documents here do not all serve the same audience. Some are current release references, while others are preserved as historical planning or review artifacts.

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

### Release And Remediation Status

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

### Operations And Runtime Quality

- [environment_variable_matrix.md](./environment_variable_matrix.md)
  Current environment-variable contract and deployment guidance.

- [ops_alert_policy.md](./ops_alert_policy.md)
  Current alert definitions, routing intent, and delivery ownership notes.

- [incident_runbook.md](./incident_runbook.md)
  Live incident-response guide for current alert classes.

- [initial_slos_2026-03-26.md](./initial_slos_2026-03-26.md)
  Current SLO proposal aligned to the durable metrics implementation.

### Product And AI Quality

- [QA-checklist.md](./QA-checklist.md)
  Product-quality and release-readiness QA checklist.

- [feedback-chain-spec.md](./feedback-chain-spec.md)
  Target behavior for answer-level coaching feedback.

- [readiness-band-definition.md](./readiness-band-definition.md)
  Canonical meaning of readiness bands.

- [readiness-eval-scenarios.md](./readiness-eval-scenarios.md)
  Regression scenarios for readiness interpretation.

---

## Historical Artifacts

These documents are preserved for traceability and planning context. They are not the primary source of current release status.

- [comprehensive_code_review.md](./comprehensive_code_review.md)
- [comprehensive_code_review_2026-03-26.md](./comprehensive_code_review_2026-03-26.md)
- [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)
- [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)
- [production_remediation_sprint1_board_2026-03-25.md](./production_remediation_sprint1_board_2026-03-25.md)
- [production_remediation_phase2_board_2026-03-25.md](./production_remediation_phase2_board_2026-03-25.md)
- [durable_metrics_plan_2026-03-25.md](./durable_metrics_plan_2026-03-25.md)
- [code_review_request.md](./code_review_request.md)

Use these when you need:

- the original review or remediation framing
- acceptance-criteria history
- retrospective context for why work was sequenced the way it was

---

## Reading Paths

### For Release Approval

Read in this order:

1. [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
2. [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)
3. [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)
4. [release-gate-checklist.md](./release-gate-checklist.md)
5. [environment_variable_matrix.md](./environment_variable_matrix.md)
6. [ops_alert_policy.md](./ops_alert_policy.md)

### For Test Coverage And Automation

Read in this order:

1. [test_pyramid_plan_2026-03-29.md](./test_pyramid_plan_2026-03-29.md)
2. [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
3. [QA-checklist.md](./QA-checklist.md)

### For AI And Coaching Quality

Read in this order:

1. [feedback-chain-spec.md](./feedback-chain-spec.md)
2. [QA-checklist.md](./QA-checklist.md)
3. [readiness-band-definition.md](./readiness-band-definition.md)
4. [readiness-eval-scenarios.md](./readiness-eval-scenarios.md)
5. [debug/ai_context.md](./debug/ai_context.md)
