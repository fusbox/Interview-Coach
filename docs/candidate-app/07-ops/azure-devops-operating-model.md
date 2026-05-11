# Azure DevOps Operating Model

Date: 2026-05-08
Status: Pragmatic collaboration model

## Purpose

This document defines a practical way to use Azure DevOps for the candidate app now that the team wants candidate work pushed as a branch in the existing Azure project.

The goal is not perfect enterprise DevOps on day one. The goal is enough shared context, traceability, and review structure that teammates can understand:

- what the app is
- what changed
- what needs integration-team input
- what work is active
- why a branch or PR exists
- what evidence supports a change

## Current Azure Reality

Working assumptions:

- Azure project/repo: existing `Interview_Coach_AI`
- Current migrated recruiter baseline branch: `feature/postgres-integration`
- Recommended candidate integration branch: `feature/candidate-app-integration`
- Candidate incubation repo: [C:\dev\Interview-Coach-Candidate](/c:/dev/Interview-Coach-Candidate)
- Production host: `https://interviewcoach.talentarbor.com`

The candidate repo can continue to incubate docs, UI, and implementation slices, but deployable work should be ported into the Azure branch that starts from the migrated recruiter/Postgres baseline.

## Recommended Branch Model

Use:

```text
feature/postgres-integration
feature/candidate-app-integration
feature/candidate-auth-handoff
feature/candidate-practice-setup
feature/candidate-dashboard
```

Recommended flow:

1. Start `feature/candidate-app-integration` from `feature/postgres-integration`.
2. Keep the first candidate branch focused on route shell, public landing, and protected route placeholders.
3. Split auth handoff, practice setup, dashboard, and resume ingestion into smaller branches from candidate integration.
4. PR back into `feature/candidate-app-integration` until the candidate slice is cohesive.
5. PR `feature/candidate-app-integration` into `feature/postgres-integration` when recruiter regression risk has been reviewed.

Avoid using the standalone candidate repo branch as the merge target for production. A standalone snapshot branch can be pushed for review only if clearly labeled as non-deployable context.

## Boards Strategy

Use Azure Boards as the shared collaboration surface, while [Working Backlog](../00-working-backlog.md) remains the repo-local mirror during active AI-assisted work.

Recommended process:

- Agile is sufficient at this stage.
- Area Paths:
  - `Interview Coach\Candidate`
  - `Interview Coach\Recruiter`
  - `Interview Coach\Shared Platform`
  - `Interview Coach\Integration`
- Iterations:
  - `Candidate Discovery`
  - `Candidate MVP Shell`
  - `Candidate Auth Handoff`
  - `Candidate Practice MVP`
  - `Candidate Dashboard MVP`

Use the hierarchy:

- Epic: durable outcome or release-sized capability
- Feature: meaningful module or integration capability
- User Story: user-visible behavior or integration contract
- Task: implementation, docs, test, or integration step
- Bug: defect
- Risk: use a tagged User Story or Bug if the process does not include a risk work item type

## Initial Azure Epics

- Candidate Public Funnel And Shared Host Routing
- Candidate Identity And Auth Handoff
- Candidate Practice Setup And Drafts
- Candidate Session Engine Integration
- Candidate Dashboard And History
- Resume Ingestion And Retention
- Shared Postgres And Backend Integration
- Quality, Security, And Observability
- Azure DevOps Collaboration And Release Readiness

## Work Item Fields

For Features and Stories, use this shape in the Description:

```markdown
## Outcome

## Scope

## Non-goals

## Acceptance Criteria

## Data / Systems Touched

## Security / Privacy Notes

## Test Evidence Needed

## Linked Docs

## Open Questions
```

Recommended tags:

```text
candidate
recruiter-regression-risk
auth-handoff
shared-host-routing
postgres
resume-data
ai-generation
security
accessibility
integration-team-needed
docs-ready
blocked
```

## Queries To Create First

Create saved shared queries:

- `Candidate - Active Work`
- `Candidate - Blocked / Needs Team Answer`
- `Candidate - Auth Handoff`
- `Candidate - Shared Host Routing`
- `Candidate - PR Ready / Review Needed`
- `Candidate - Security Privacy Risks`
- `Candidate - Docs Needing Review`
- `Candidate - Bugs`

These are more useful than a perfect board hierarchy if the team is still learning the process.

## Dashboard Strategy

Create one dashboard: `Interview Coach Candidate Integration`.

Useful widgets:

- Markdown widget: links to this code wiki, branch, PRs, and the five most important docs
- Query Results: active work
- Query Results: blocked items
- Query Results: integration-team questions
- Build History: candidate integration pipeline
- Pull Request widget if available
- Sprint burndown only after work is truly sprint-planned

The dashboard should answer, at a glance:

- What is being built?
- What branch/PR should I inspect?
- What does the integration team need to answer?
- What is blocked?
- What evidence exists?

## Wiki Strategy

The Fu-Lab Azure project can use a manually edited project wiki now. Use it as a lightweight navigation hub, not as the durable source of truth.

Current wiki:

```text
Name: Candidate Docs Hub
Project: Fu-Lab / Interview-Coach-Candidate
Purpose: navigation hub for planning context, company repo links, active contracts, and durable repo docs
```

Durable docs should still live in the repository under `/docs/candidate-app` and be reviewed through PRs. If the company Azure project later allows publishing docs as code wiki, publish the repo docs from the candidate integration branch.

Potential company code wiki later:

```text
Name: Interview Coach Candidate Docs
Repo: Interview_Coach_AI
Branch: feature/candidate-app-integration
Folder: /docs/candidate-app
```

Working rules:

- Keep the Fu-Lab wiki short and link-oriented.
- Do not duplicate durable docs into manually edited wiki pages.
- Let PR review control durable doc changes.
- Use the Azure dashboard Markdown widget as the short operational link hub.
- Keep exploratory notes in work item Discussion fields or promote them into repo docs when they become durable context.
- Add or update `.order` files later if a code wiki page order becomes noisy.

A code wiki is still useful later because docs remain versioned with the code branch and can be reviewed in PRs before the team treats them as shared truth.

## PR Policy

For `feature/candidate-app-integration`, start with lightweight guardrails:

- linked work item recommended or required once Boards are populated
- at least one reviewer once there is a real reviewer available
- build validation for lint, typecheck, tests, and build once pipeline exists
- comment resolution before merge
- no direct pushes to protected branches once the branch becomes team-owned

For `feature/postgres-integration`, keep protections stricter because recruiter behavior is already validated and is the deployment baseline.

## Pipeline Stages

Minimum useful pipeline:

1. Install
2. Lint
3. Typecheck
4. Unit/component tests
5. Build

Later pipeline:

1. Install
2. Lint/typecheck
3. Unit/component tests with coverage
4. Build
5. Browser smoke for `/`, `/recruiter`, `/practice`, `/dashboard`, `/admin/feedback`, and `/qa/ai-quality`
6. Staging deploy
7. Smoke after deploy
8. Approval before production

## Traceability Standard

Every meaningful PR should link:

- Azure Boards work item
- relevant repo doc
- route or data contract touched
- test evidence
- known residual risk

Suggested PR description fields:

```markdown
## What Changed

## Why

## Linked Work Items

## Linked Docs

## Verification

## Risks / Follow-Up
```

## What Not To Do Yet

- Do not create a work item for every tiny AI edit.
- Do not let Boards become a second documentation system.
- Do not use wiki pages as the only place decisions live.
- Do not create a mature sprint ritual before there are enough collaborators to benefit from it.
- Do not hide unresolved integration questions in chat; make them work items or explicit doc open questions.

## First Practical Pass

1. Create `feature/candidate-app-integration` from `feature/postgres-integration`.
2. Push a candidate docs/context commit first.
3. Create the Fu-Lab wiki hub with links to the company repo, branch, PR, dashboard, board queries, and durable repo docs.
4. Create the dashboard with a Markdown link hub and blocked-query widgets.
5. Create only the initial Epics and highest-value Features.
6. Create work items for unresolved external contracts:
   - TalentArbor login return target
   - candidate identity handoff
   - shared-host routing and `/recruiter` alias
   - candidate route auth and middleware
   - dashboard destination after portal launch
7. Link the first candidate integration PR to those work items.
8. Publish `/docs/candidate-app` from the company repo as code wiki later if company project access allows it.

## References

- Azure Boards features/epics hierarchy: https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/define-features-epics
- Azure Boards Delivery Plans: https://learn.microsoft.com/en-us/azure/devops/boards/plans/review-team-plans
- Azure Repos branch policies and linked work items: https://learn.microsoft.com/en-us/azure/devops/repos/git/branch-policies
- Publish code as wiki: https://learn.microsoft.com/en-us/azure/devops/project/wiki/publish-repo-to-wiki
- Markdown dashboard widget: https://learn.microsoft.com/en-us/azure/devops/report/dashboards/add-markdown-to-dashboard
