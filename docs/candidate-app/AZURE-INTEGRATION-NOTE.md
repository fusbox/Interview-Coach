# Candidate App Azure Integration Note

Date: 2026-05-08

## Purpose

These docs were brought into the company Azure integration branch so reviewers can inspect candidate app planning context next to the deployable recruiter/Postgres baseline.

## Current Branch Context

- Company Azure repo: `Interview_Coach_AI`
- Candidate integration branch: `feature/candidate-app-integration`
- Source baseline: `feature/postgres-integration`
- Temporary planning Board item: Fu-Lab Azure Boards `#643`

## Why The Board Item Is External For Now

Planning is temporarily tracked in a separate Azure DevOps project because work item creation access is not currently available in the company Azure project.

Code branches and PRs remain in the company Azure repo. Until company-project work item access is available, PR descriptions should reference:

```text
Planning: Fu-Lab Azure Boards #643
```

## What To Read First

1. [README.md](./README.md)
2. [Working Backlog](./00-working-backlog.md)
3. [Shared Host Routing Contract](./04-architecture/shared-host-routing-contract.md)
4. [Candidate Login Redirect Contract](./02-requirements/candidate-login-redirect-contract.md)
5. [Azure DevOps Operating Model](./07-ops/azure-devops-operating-model.md)
6. [ADR-0006: Shared Host And Azure Branch Integration](./08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md)

## Source-Of-Truth Rule

These docs should become the candidate integration branch's durable planning context. Avoid creating duplicate long-form wiki pages. If a company Azure code wiki becomes available, publish this folder as the wiki source.
