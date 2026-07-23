# Interview Coach V2 Documentation

Status: Active V2 documentation index
Last updated: 2026-07-23

This subtree contains the cleanroom candidate V2 contracts and the recruiter/invited convergence direction that now follows them. The active stack is intentionally small; detailed docs are read only when their subsystem is in scope.

## Start Here

1. [HANDOFF](./HANDOFF.md): current implementation truth, next slice, phase progress, and risks.
2. [SPEC](./SPEC.md): product behavior and boundaries.
3. [DATA_CONTRACT](./DATA_CONTRACT.md): durable state, ownership, lineage, and payload shapes.
4. [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md): environment, database, migrations, dev identity, and validation.

For branch review or integration, start from HANDOFF and verify every command against Local Dev Bootstrap. `REVIEWER-HANDOFF.md`, `START-WORK-PASS.md`, and `10-agent-workflows/workpass.md` are transitional and must not override the active stack.

## Read By Concern

### Product And Entry

- [Practice Setup Scope](./02-requirements/practice-setup-scope.md)
- [Authenticated Candidate Access](./02-requirements/authenticated-candidate-access.md)
- [Host Launch Implementation](./09-dev/host-launch-api-implementation.md)
- [Recruiter V2 Delivery And Host Integration](./04-architecture/recruiter-v2-delivery-and-host-integration.md)
- [V1 SWOT And Rebuild Runway](./04-architecture/v1-swot-and-rebuild-runway.md)

### Session, Evaluation, And Dashboard

- [Question Category Contract](./04-architecture/question-category-contract.md)
- [Evidence-First Evaluator Contract](./05-quality/evidence-first-evaluator-contract.md)
- [Production Evaluator Integration](./05-quality/production-evaluator-integration-contract.md)
- [Evidence-First Dashboard Architecture](./04-architecture/evidence-first-dashboard-information-architecture.md)
- [Live Evaluator Runbook](./05-quality/live-evaluator-validation-runbook.md)
- [Live Coach Update Runbook](./05-quality/live-coach-update-validation-runbook.md)
- [AI Eval Operator Workbench](./05-quality/ai-eval-operator-workbench.md)
- [Evidence-First Coaching Scenario Lab](./05-quality/evidence-first-coaching-scenario-lab.md)

### Production UI

- [Production UI Workstream](./03-design/production-ui-workstream.md)
- [Design System Foundation](./03-design/design-system-foundation.md)
- [Coach Update Card Spec](./03-design/coach-update-v2-card-spec.md)
- [Pre-Session And Loader UX](./03-design/pre-session-and-loader-ux.md)

### Security, Operations, And Quality

- [Security And Privacy Index](./06-security/README.md)
- [Threat Model](./06-security/threat-model.md)
- [Privacy And Consent Requirements](./06-security/privacy-disclosures-and-consent-requirements.md)
- [Test Strategy](./05-quality/test-strategy.md)
- [Recruiter SMTP Live Validation](./05-quality/recruiter-smtp-live-validation-runbook.md)
- [Observability Plan](./07-ops/candidate-observability-plan.md)
- [Incident Runbook](./07-ops/candidate-incident-runbook.md)
- [Decision Records](./08-decisions/README.md)

## Working Rules

- V1 and the original refactor pack are references, not current contracts.
- If a detailed doc conflicts with HANDOFF, SPEC, DATA_CONTRACT, or a newer ADR, name and resolve the conflict before implementation.
- Put long validation evidence in a contract, runbook, or dated archive snapshot, not in HANDOFF.
- Treat `03-design` imports and `09-dev` probe output as local-only until explicitly classified.
- Do not add another planning document when an existing governing document can own the decision.

## Archive And Migration

- [Candidate reference archive](./reference-archive/README.md)
- [Repository documentation cleanup roadmap](../README.md#cleanup-and-promotion-roadmap)
- [Accepted initial V2 rebuild plan](../superpowers/plans/2026-07-06-parallel-v2-rebuild.md)

The 2026-07-23 cleanup pass archived the full Slice 1-186 handoff ledger and reduced the live handoff to current truth, parallel work lanes, release risks, and milestone ranges. The next cleanup wave should consolidate execution docs, archive the retired working backlog and superseded dashboard/planning material after link repair, classify tracked staging CSVs through a security pass, and then promote the remaining active tree to `docs/*`.
