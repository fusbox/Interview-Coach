# Candidate Interview Coach Docs

> [!NOTE]
> ### Current Product Scope
> This repo contains the cleanroom candidate V2 rebuild on `feature/candidate-v2-rebuild`. During rebuild development, push this branch to `fusbox` only. Azure integration and deployment remain later release work governed by [ADR-0006](08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).

This folder is organized to keep reviewer handoff, product requirements, UX/design rules, and architecture contracts separate but aligned.

## Active Context Stack

Use these four anchors before digging into the detailed reference docs:

- [SPEC](SPEC.md): product intent, candidate-facing scope, route/user-flow boundaries, and non-goals.
- [DATA_CONTRACT](DATA_CONTRACT.md): data vocabulary, state names, schema/payload contracts, and interview-preparedness primitives.
- [HANDOFF](HANDOFF.md): current execution state, known gaps, immediate next slice, and risks.
- [Decision Records](08-decisions/README.md): durable why-decisions and supersession history.

The older detailed docs remain useful reference material. If they conflict with the active context stack, prefer the active stack unless an ADR says otherwise.

## Start Here

### Reviewing Or Merging

Read [Candidate Integration Reviewer Handoff](REVIEWER-HANDOFF.md).

That doc starts with:

- how to get the branch on your machine
- what to install
- how to set up the local smoke database
- what commands to run
- what routes to open
- what a manual validation pass looks like
- what is still blocked before merge

Minimum local command path:

```powershell
git fetch fusbox feature/candidate-v2-rebuild
git switch feature/candidate-v2-rebuild
git pull --ff-only fusbox feature/candidate-v2-rebuild
npm install
npm run db:setup
npm run db:smoke-candidate-readiness
npm run test:candidate
npm run typecheck
npm run dev
```

Use [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md) for `.env.local`, Gemini, failure-injection, and LAN/mobile details. Use [Candidate Integration Reviewer Handoff](REVIEWER-HANDOFF.md) for the current manual validation pass.

Then open:

```text
http://localhost:3000/
http://localhost:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
```

### Continuing Implementation

- [Handoff](HANDOFF.md): current execution state and immediate next slice
- [Parallel V2 Rebuild Implementation Plan](../superpowers/plans/2026-07-06-parallel-v2-rebuild.md): accepted first task sequence for the candidate V2 rebuild
- [Working Backlog](00-working-backlog.md): retired project artifact with historical work items and sequence
- [Candidate V2 Work Pass Checklist](START-WORK-PASS.md): repeatable work-pass process

Repository-local senior review skills provide the quality gates around implementation:

- `.agents/skills/senior-slice-pass`: frame and close one meaningful slice, including lifecycle, lineage, counterfactual, recovery, ownership, privacy, and verification review;
- `.agents/skills/senior-milestone-pass`: review integrated journeys and architecture before a multi-slice commit or phase transition;
- `.agents/skills/senior-release-pass`: judge deployment or pilot readiness across product, data, security, privacy, reliability, observability, accessibility, configuration, and rollback evidence.

The skills do not replace specialist security, database, framework, accessibility, or browser reviews. They decide when those deeper reviews are warranted and require findings to be fixed, deliberately deferred with a trigger, or surfaced as a product/architecture decision.

### Investigating A Specific Concern

Use the reference map below.

## Reference Docs

### Active context and working plan

- [SPEC](SPEC.md)
- [DATA_CONTRACT](DATA_CONTRACT.md)
- [HANDOFF](HANDOFF.md)
- [Parallel V2 Rebuild Implementation Plan](../superpowers/plans/2026-07-06-parallel-v2-rebuild.md)
- [Candidate Integration Reviewer Handoff](REVIEWER-HANDOFF.md)
- [Working Backlog](00-working-backlog.md)
- [Candidate Integration Work Pass Checklist](START-WORK-PASS.md)

### Product operating model

1. [Candidate App Operating Model](01-product/candidate-app-operating-model.md)

### Product requirements

2. [Practice Setup Scope](02-requirements/practice-setup-scope.md)
3. [Authenticated Candidate Access](02-requirements/authenticated-candidate-access.md)
4. [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)

### Design system and UI

5. [Design System Foundation](03-design/design-system-foundation.md)

### Architecture contracts

6. [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
7. [V1 SWOT And Rebuild Runway](04-architecture/v1-swot-and-rebuild-runway.md)
8. [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)
9. [Role Preparedness Data Inventory](04-architecture/role-preparedness-data-inventory.md)
10. [Interview Preparedness Signal Contract](04-architecture/preparedness-signal-contract.md)
11. [Preparedness Signal Map](04-architecture/preparedness-signal-map.md)
12. [Evidence-First Dashboard Information Architecture](04-architecture/evidence-first-dashboard-information-architecture.md)
13. [Reference Archive](reference-archive/README.md)

### Quality, security, and operations

14. [Test Strategy](05-quality/test-strategy.md)
15. [Accessibility Baseline](05-quality/accessibility-baseline.md)
16. [Recruiter Regression Checklist For Candidate PRs](05-quality/recruiter-regression-checklist.md)
17. [Evidence-First Evaluator Contract](05-quality/evidence-first-evaluator-contract.md)
18. [Production Evaluator Integration Contract](05-quality/production-evaluator-integration-contract.md)
19. [Live Evaluator Validation Runbook](05-quality/live-evaluator-validation-runbook.md)
20. [Security And Privacy Docs](06-security/README.md)
21. [Candidate App Threat Model](06-security/threat-model.md)
22. [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md)
23. [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)
24. [Candidate Observability Plan](07-ops/candidate-observability-plan.md)
25. [Candidate Incident Runbook](07-ops/candidate-incident-runbook.md)
26. [Candidate Integration PR Policy](07-ops/candidate-integration-pr-policy.md)

### Decisions and developer setup

27. [Decision Records](08-decisions/README.md)
28. [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

## Document Rules

- Requirements docs should describe what the user can do and what is intentionally out of scope.
- Architecture docs should describe durable data/state contracts and implementation boundaries.
- Future-state ideas should be explicitly labeled as future extensions instead of being mixed into current contracts.
- Keep [HANDOFF](HANDOFF.md) short and current. Promote durable product or data changes to [SPEC](SPEC.md), [DATA_CONTRACT](DATA_CONTRACT.md), or a new ADR.
