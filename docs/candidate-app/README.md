# Candidate Interview Coach Docs

> [!NOTE]
> ### Current Product Scope
> This repo is the candidate-led Interview Coach incubation workspace. The deployment target is now the shared `interviewcoach.talentarbor.com` app in the existing Azure project, with candidate slices ported through the branch strategy in [ADR-0006](08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).

This folder is organized to keep product requirements, UX/design rules, and architecture contracts separate but aligned.

## Recommended Reading Order

### Active working plan

- [Working Backlog](00-working-backlog.md)

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
10. [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
11. [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)

### Quality, security, and operations

12. [Test Strategy](05-quality/test-strategy.md)
13. [Accessibility Baseline](05-quality/accessibility-baseline.md)
14. [Candidate App Threat Model](06-security/threat-model.md)
15. [Data Retention Policy](06-security/data-retention-policy.md)
16. [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)

### Decisions and developer setup

17. [Decision Records](08-decisions/README.md)
18. [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

## Document Rules

- Requirements docs should describe what the user can do and what is intentionally out of scope.
- Architecture docs should describe durable data/state contracts and implementation boundaries.
- Future-state ideas should be explicitly labeled as future extensions instead of being mixed into current contracts.
