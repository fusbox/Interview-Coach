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
   - [Candidate Integration Reviewer Handoff](./REVIEWER-HANDOFF.md)
   - [Working Backlog](./00-working-backlog.md)
   - [Shared Host Routing Contract](./04-architecture/shared-host-routing-contract.md)
   - [Candidate Login Redirect Contract](./02-requirements/candidate-login-redirect-contract.md)
   - [Candidate Integration PR Policy](./07-ops/candidate-integration-pr-policy.md)

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

Use [Candidate Integration PR Policy](./07-ops/candidate-integration-pr-policy.md) for the full PR template. At minimum, include this in the PR description:

```markdown
## Status

Draft PR for candidate integration review. Do not merge until reviewer ownership, route/auth boundaries, and deployment expectations are agreed.

## Do This

1. Confirm source branch: `feature/candidate-app-integration`.
2. Confirm target branch: `feature/postgres-integration`.
3. Read `docs/candidate-app/REVIEWER-HANDOFF.md`.
4. Run:

   ```powershell
   npm install
   Copy-Item .env.example .env.local
   npm run db:setup
   npm run ci:candidate
   npm run test:e2e:candidate-seeded
   npm run dev
   ```

5. Use `docs/candidate-app/REVIEWER-HANDOFF.md` for local `.env.local` values.
6. Manually check `/`, `/practice`, `/dashboard`, `/recruiter`, and `/recruiter/dashboard`.

## What Changed

## Why

## Planning
Planning: [Fu-Lab Azure Boards 643](PASTE-WORK-ITEM-URL)

## Linked Docs

## Verification

## Recruiter Regression Review

- Shared host route ownership checked:
- Auth/cookie boundaries checked:
- Recruiter/admin/QA route risk:
- Invite-token `/s/[token]` risk:
- Shared API/data risk:
- Verification run:
- Residual risk:

## Open Questions / Blockers

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
