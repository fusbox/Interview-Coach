# Candidate Interview Coach Docs

> [!NOTE]
> ### Current Product Scope
> This repo is the candidate-led Interview Coach incubation workspace. The deployment target is now the shared `interviewcoach.talentarbor.com` app in the existing Azure project, with candidate slices ported through the branch strategy in [ADR-0006](08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).

This folder is organized to keep reviewer handoff, product requirements, UX/design rules, and architecture contracts separate but aligned.

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

- [Working Backlog](00-working-backlog.md): current source of truth for work items and sequence
- [Candidate Integration Work Pass Checklist](START-WORK-PASS.md): repeatable work-pass process

### Investigating A Specific Concern

Use the reference map below.

## Reference Docs

### Active working plan

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

6. [Current Foundation](04-architecture/current-foundation.md)
7. [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
8. [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
9. [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)
10. [Candidate Session Engine Port Plan](04-architecture/session-engine-port-plan.md)
11. [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
12. [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)

### Quality, security, and operations

13. [Test Strategy](05-quality/test-strategy.md)
14. [Accessibility Baseline](05-quality/accessibility-baseline.md)
15. [Recruiter Regression Checklist For Candidate PRs](05-quality/recruiter-regression-checklist.md)
16. [Candidate App Threat Model](06-security/threat-model.md)
17. [Data Retention Policy](06-security/data-retention-policy.md)
18. [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)
19. [Candidate Observability Plan](07-ops/candidate-observability-plan.md)
20. [Candidate Incident Runbook](07-ops/candidate-incident-runbook.md)
21. [Candidate Integration PR Policy](07-ops/candidate-integration-pr-policy.md)

### Decisions and developer setup

22. [Decision Records](08-decisions/README.md)
23. [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

## Document Rules

- Requirements docs should describe what the user can do and what is intentionally out of scope.
- Architecture docs should describe durable data/state contracts and implementation boundaries.
- Future-state ideas should be explicitly labeled as future extensions instead of being mixed into current contracts.
