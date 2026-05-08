# Candidate App Operating Model

Date: 2026-05-07
Status: Working model

## Purpose

This document defines how this repo should be planned, specified, implemented, reviewed, tested, shipped, and observed.

The goal is to make AI-assisted development fast without letting it become vague. The workflow should feel lightweight while still producing software that is traceable, secure, testable, and maintainable.

## Operating Principle

Vibe-coded work should still be spec-led, test-aware, and reviewable.

That means every meaningful implementation slice should connect:

- product intent
- acceptance criteria
- architecture boundary
- data contract
- test evidence
- security and privacy considerations
- deployment and observability expectations

## Working Doc Set

The project should use these living documents:

- [Working Backlog](../00-working-backlog.md)
- [Candidate App Operating Model](./candidate-app-operating-model.md)
- [Authenticated Candidate Access](../02-requirements/authenticated-candidate-access.md)
- [Candidate Login Redirect Contract](../02-requirements/candidate-login-redirect-contract.md)
- [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md)
- [Postgres Candidate Data Contract](../04-architecture/postgres-candidate-data-contract.md)
- [Storage And Resume Ingestion](../04-architecture/storage-and-resume-ingestion.md)
- [Test Strategy](../05-quality/test-strategy.md)
- [Accessibility Baseline](../05-quality/accessibility-baseline.md)
- [Candidate App Threat Model](../06-security/threat-model.md)
- [Data Retention Policy](../06-security/data-retention-policy.md)
- [Azure DevOps Operating Model](../07-ops/azure-devops-operating-model.md)
- [Decision Records](../08-decisions/README.md)
- [Local Dev Bootstrap](../09-dev/local-dev-bootstrap.md)

These documents should stay current enough to guide work. They do not need to describe every low-level implementation detail.

The [Working Backlog](../00-working-backlog.md) is the only document intended to change during most implementation passes. The other documents are ground-truth orientation docs and should change only when the product or architecture direction changes.

## Current Deployment Context

As of 2026-05-08, the candidate-led app is no longer expected to deploy as a separate Azure project.

The working deployment target is the shared `https://interviewcoach.talentarbor.com` host, with recruiter/admin/QA and candidate routes in one deployable app. Candidate app code should be integrated through the existing Azure project/repo branch path described in [ADR-0006](../08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).

This does not change the product principle that candidate features should stay modular and candidate-owned. It does mean routing, auth, cookies, API namespaces, and PR strategy must be reviewed against the shared host contract.

## Work Item Shape

Each feature should start with a small feature brief.

Recommended fields:

- user outcome
- candidate-facing scope
- non-goals
- acceptance criteria
- data touched
- external systems touched
- security and privacy notes
- test plan
- observability plan
- rollout notes

## Definition Of Ready

A feature is ready to build when:

- the user goal is written in candidate language
- acceptance criteria are testable
- auth and ownership assumptions are explicit
- data persistence requirements are clear
- failure states are named
- the implementation boundary is known
- open product decisions are called out

## Definition Of Done

A feature is done when:

- code is implemented behind the agreed route, component, or service boundary
- lint, typecheck, build, and relevant tests pass
- new behavior has unit, integration, or browser coverage appropriate to risk
- privacy-sensitive data handling is reviewed
- generated AI output paths have fallback behavior
- docs are updated if a contract changed
- the related Azure Boards work item is linked to the PR
- route ownership is checked against the [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md)
- deployment and rollback expectations are clear

## AI Collaboration Rules

AI assistance should be used deliberately:

- start by reading local docs and relevant code
- update or create a brief for ambiguous work
- implement in small slices
- run local checks before claiming completion
- summarize changed files and remaining risk
- avoid importing patterns from the recruiter app unless the candidate boundary justifies it
- prefer [C:\tmp\Interview-Coach-Recruiter-postgres](/c:/tmp/Interview-Coach-Recruiter-postgres) as the pattern source for backend code
- when porting to Azure, prefer small integration PRs from the candidate branch into the migrated recruiter/Postgres baseline

AI output is not inherently trusted. It becomes useful after it is anchored to requirements, reviewed, and verified.

## Documentation Rules

- Requirements docs describe user-facing behavior and scope.
- Architecture docs describe durable contracts and implementation boundaries.
- Quality docs describe how confidence is established.
- Security docs describe abuse paths, data sensitivity, and mitigations.
- Ops docs describe delivery, deployment, monitoring, and incident response.

Future ideas should be marked as future extensions. Current docs should not quietly mix aspiration with implemented truth.

## External References

- NIST Secure Software Development Framework: https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Azure Boards documentation: https://learn.microsoft.com/en-us/azure/devops/boards/
- Azure Pipelines approvals and checks: https://learn.microsoft.com/en-us/azure/devops/pipelines/process/approvals
