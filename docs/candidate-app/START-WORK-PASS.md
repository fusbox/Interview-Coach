# Candidate Integration Work Pass Checklist

Use this checklist at the start and end of each candidate integration pass.

## Start

1. Confirm branch:

   ```powershell
   git switch feature/candidate-app-integration
   git pull --ff-only azure feature/candidate-app-integration
   ```

2. Read:

   - [AZURE-INTEGRATION-NOTE.md](./AZURE-INTEGRATION-NOTE.md)
   - [Working Backlog](./00-working-backlog.md)
   - [Shared Host Routing Contract](./04-architecture/shared-host-routing-contract.md)
   - [Candidate Login Redirect Contract](./02-requirements/candidate-login-redirect-contract.md)

3. Confirm the active Fu-Lab Azure Boards item under planning Feature `643`.

4. If opening or updating a company Azure PR, use a full external planning hyperlink, not a bare `#643` reference:

   ```markdown
   Planning: [Fu-Lab Azure Boards 643](PASTE-WORK-ITEM-URL)
   ```

## During

- Keep candidate routes aligned with the shared host contract.
- Keep recruiter/admin/QA routes working.
- Namespace new candidate APIs under `/api/candidate/**` unless a shared API boundary is deliberately reviewed.
- Call out integration-team questions in the work item and PR.
- Keep docs changes near the code or contract they explain.

## Before PR

Include this in the PR description:

```markdown
## What Changed

## Why

## Planning
Planning: [Fu-Lab Azure Boards 643](PASTE-WORK-ITEM-URL)

## Linked Docs

## Verification

## Risks / Follow-Up
```

## Verification

Run the checks that match the change. For docs-only changes, run:

```powershell
git diff --check
```

For code changes, run the relevant local quality gates before marking the work item resolved:

```powershell
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

## Closeout

- Push the branch.
- Update the Fu-Lab Azure Boards item with PR link, changed docs/code, and verification.
- Keep PRs as draft when they are context-only, exploratory, or waiting on integration-team answers.
- Mark the work item resolved only after the acceptance criteria are evidenced.
