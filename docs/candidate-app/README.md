# Candidate Interview Coach Docs

> [!NOTE]
> ### Current Product Scope
> This repo is the candidate-led Interview Coach incubation workspace. The deployment target is now the shared `interviewcoach.talentarbor.com` app in the existing Azure project, with candidate slices ported through the branch strategy in [ADR-0006](08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).

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
git fetch origin feature/postgres-integration feature/candidate-app-integration
git switch feature/candidate-app-integration
git pull --ff-only origin feature/candidate-app-integration
npm install
Copy-Item .env.example .env.local
npm run db:setup
npm run ci:candidate
npm run test:e2e:candidate-seeded
npm run dev
```

Use [Candidate Integration Reviewer Handoff](REVIEWER-HANDOFF.md) for the `.env.local` values and the full manual validation pass.

Then open:

```text
http://localhost:3000/
http://localhost:3000/practice
http://localhost:3000/dashboard
http://localhost:3000/recruiter
http://localhost:3000/recruiter/dashboard
```

### Continuing Implementation

- [Handoff](HANDOFF.md): current execution state and immediate next slice
- [Parallel V2 Rebuild Implementation Plan](../superpowers/plans/2026-07-06-parallel-v2-rebuild.md): accepted first task sequence for the candidate V2 rebuild
- [Working Backlog](00-working-backlog.md): retired project artifact with historical work items and sequence
- [Candidate Integration Work Pass Checklist](START-WORK-PASS.md): repeatable work-pass process

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
18. [Security And Privacy Docs](06-security/README.md)
19. [Candidate App Threat Model](06-security/threat-model.md)
20. [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md)
21. [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)
22. [Candidate Observability Plan](07-ops/candidate-observability-plan.md)
23. [Candidate Incident Runbook](07-ops/candidate-incident-runbook.md)
24. [Candidate Integration PR Policy](07-ops/candidate-integration-pr-policy.md)

### Decisions and developer setup

25. [Decision Records](08-decisions/README.md)
26. [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

## Document Rules

- Requirements docs should describe what the user can do and what is intentionally out of scope.
- Architecture docs should describe durable data/state contracts and implementation boundaries.
- Future-state ideas should be explicitly labeled as future extensions instead of being mixed into current contracts.
- Keep [HANDOFF](HANDOFF.md) short and current. Promote durable product or data changes to [SPEC](SPEC.md), [DATA_CONTRACT](DATA_CONTRACT.md), or a new ADR.
