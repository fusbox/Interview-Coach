# Candidate Integration PR Policy

Status: Historical reference

> [!WARNING]
> This file is archived historical context and does not govern current V2 implementation.

Date: 2026-05-14
Original status: Working review policy

## Purpose

This document defines the lightweight PR policy for candidate app work while it is integrated into the shared `Interview_Coach_AI` Azure repo.

The goal is to make the candidate branch reviewable without pretending every company-side Azure permission or production deployment detail is already settled.

## Branch And PR Shape

- Company repo: `Interview_Coach_AI`
- Candidate branch: `feature/candidate-app-integration`
- Current baseline branch: `feature/postgres-integration`
- Current candidate PR target: `feature/postgres-integration`
- Fu-Lab mirror remote: rehearsal only, not a deployable source of truth

Keep `feature/candidate-app-integration` stacked on the migrated Postgres recruiter branch until the integration team decides how candidate work should promote into `dev-Fu`, `staging`, and production.

## Draft Convention

Keep the company PR in draft while any of these are true:

- candidate work is still being assembled into the shared app
- TalentArbor login return behavior is not confirmed
- candidate identity handoff protocol is not confirmed
- reviewer ownership and branch policy are not yet agreed
- production/staging deployment path is not yet validated by the integration team

Move out of draft only after the branch has a reviewable candidate slice, the known blockers are explicit, and the reviewer can run or inspect the evidence below.

## Required PR Sections

Use this shape for the candidate integration PR. Keep the full validation path visible in the PR description so reviewers do not have to understand the entire docs tree before they can start.

```markdown
## Status

Draft PR for candidate integration review. Do not merge until reviewer ownership, route/auth boundaries, and deployment expectations are agreed.

## Do This

1. Confirm this PR source is `feature/candidate-app-integration`.
2. Confirm this PR target is `feature/postgres-integration`.
3. Read `docs/candidate-app/REVIEWER-HANDOFF.md`.
4. Get the branch running locally:

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

5. Use `docs/candidate-app/REVIEWER-HANDOFF.md` for the local `.env.local` values.
6. Open the manual validation routes:

   ```text
   http://localhost:3000/
   http://localhost:3000/practice
   http://localhost:3000/dashboard
   http://localhost:3000/recruiter
   http://localhost:3000/recruiter/dashboard
   ```

7. Do not complete the PR until the open blockers are accepted, deferred, or resolved.

## What Changed

## Why

## Linked Work Items

Planning: Fu-Lab Azure Boards #643

## Linked Docs

- docs/candidate-app/REVIEWER-HANDOFF.md
- docs/candidate-app/00-working-backlog.md
- docs/candidate-app/04-architecture/shared-host-routing-contract.md
- docs/candidate-app/02-requirements/candidate-login-redirect-contract.md
- docs/candidate-app/07-ops/candidate-integration-pr-policy.md
- docs/candidate-app/05-quality/recruiter-regression-checklist.md

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

## Review Notes
```

## Current Evidence Bundle

As of this policy update, the candidate branch includes:

- public `/` candidate landing page with TalentArbor login-start CTA targets
- candidate protected route boundaries for `/practice`, `/dashboard`, `/session/[sessionId]`, and `/summary/[sessionId]`
- candidate Postgres profile, identity, draft, session, resume, answer, summary, and dashboard persistence slices
- candidate practice setup UI MVP
- candidate live session UI MVP using recruiter session workspace patterns
- candidate dashboard UI MVP
- `/recruiter` create-page alias for ATS launch
- restored `/recruiter/dashboard` compatibility route for the migrated recruiter dashboard
- recruiter/admin/QA shared-host regression checks
- Fu-Lab rehearsal pipeline definition and passing pipeline history

## Recommended Review Order

1. Read [Candidate Integration Reviewer Handoff](../REVIEWER-HANDOFF.md).
2. Validate the Postgres recruiter baseline on `feature/postgres-integration`.
3. Review this candidate branch as the delta on top of that baseline.
4. Inspect candidate route, auth, DB, and UI changes.
5. Confirm open TalentArbor login return and identity handoff questions before treating the branch as merge-ready.

## Minimum Review Gate

Before merge approval, reviewers should have evidence for:

- `npm run lint`
- `npm run typecheck`
- `npm run test:candidate`
- `npm run build`
- candidate seeded DB/browser smoke in a controlled environment
- recruiter/admin/QA route preservation, including `/recruiter`, `/recruiter/dashboard`, `/recruiter/settings`, `/admin/feedback`, and `/qa/ai-quality`, plus denial of the retired `/recruiter/templates` surface
- no reintroduction of Supabase runtime dependencies for candidate persistence
- no production use of Fu-Lab placeholder secrets or mirror-pipeline assumptions

## Residual Blockers

- TalentArbor candidate login return parameter/state/callback behavior is still open.
- Candidate identity handoff protocol is still open.
- Company Azure Boards and pipeline policy permissions remain team-owned.
- Final deployment path still needs integration-team validation on the company Azure project.

## Branch Policy Direction

When the team is ready to protect the candidate branch, start with:

- required PR review
- comment resolution before merge
- build validation using the candidate integration pipeline
- linked work item recommended until company Boards access is available, then required if practical
- no direct pushes to protected shared branches

Do not require company work-item links until the team has a real way to create and maintain those work items in the company Azure project.
