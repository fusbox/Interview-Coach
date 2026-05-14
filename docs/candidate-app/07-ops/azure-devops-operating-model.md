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
  - `Interview-Coach-Candidate`
  - `Interview-Coach-Candidate\Candidate`
  - `Interview-Coach-Candidate\Recruiter`
  - `Interview-Coach-Candidate\Shared Platform`
  - `Interview-Coach-Candidate\Integration`
  - `Interview-Coach-Candidate\Quality`
- Iterations:
  - `Interview-Coach-Candidate`
  - `Interview-Coach-Candidate\Candidate Discovery`
  - `Interview-Coach-Candidate\Candidate MVP Shell`
  - `Interview-Coach-Candidate\Candidate Auth Handoff`
  - `Interview-Coach-Candidate\Candidate Practice MVP`
  - `Interview-Coach-Candidate\Candidate Dashboard MVP`

Use only paths that already exist in the Fu-Lab Azure project. If a future item needs a path outside this list, define that path in Azure first or place the item in `Interview-Coach-Candidate` and note the desired path in History.

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

## CSV Import Rules

Use Azure's tree import shape for parent/child relationships. Do not include a `Parent` column in import files; Azure treats `Parent` as a computed, read-only field and rejects updates to it.

For linked imports, use title hierarchy columns:

```csv
ID,Work Item Type,Title 1,Title 2,State,Assigned To,Area Path,Iteration Path,Tags,Acceptance Criteria,History
739,Feature,Smoke and regression testing,,Active,Fu Chen <fu@rangam.com>,Interview-Coach-Candidate\Quality,Interview-Coach-Candidate\Candidate Practice MVP,candidate;quality;regression,"Acceptance copy","History copy"
,User Story,,QSO-S08 - Add seeded setup-to-summary smoke readiness,New,Fu Chen <fu@rangam.com>,Interview-Coach-Candidate\Quality,Interview-Coach-Candidate\Candidate Practice MVP,candidate;quality;smoke;postgres,"Acceptance copy","History copy"
```

Rules:

- Parent rows put the title in `Title 1`.
- Child rows go immediately below the parent row and put the title in `Title 2`.
- Grandchild task rows use `Title 3` when needed.
- New items leave `ID` blank.
- New items set `State` to `New`; do not create new items directly as `Active` or `Resolved`.
- New items must include `Tags`.
- Use only existing `Area Path` and `Iteration Path` values. If a path is missing, create it in Azure first or use the parent `Interview-Coach-Candidate` path.
- Titles containing commas must be quoted.

## Queries To Create First

Create saved shared queries:

- `Candidate - Active Work`
- `Candidate - Blocked / Needs Team Answer`
- `Candidate - Integration Team Questions`
- `Candidate - Auth Handoff`
- `Candidate - Shared Host Routing`
- `Candidate - PR Ready / Review Needed`
- `Candidate - Security Privacy Risks`
- `Candidate - Docs Needing Review`
- `Candidate - Bugs`

These are more useful than a perfect board hierarchy if the team is still learning the process.

Create these under **Shared Queries / Candidate Integration** so dashboard widgets and teammates can find the same set.

Default columns for every query:

```text
ID
Work Item Type
Title
State
Assigned To
Tags
Area Path
Iteration Path
Changed Date
```

Default sort:

```text
State ASC
Changed Date DESC
ID ASC
```

Use the Query Editor UI where possible. The WIQL below is written as a precise reference for the same filters.

### Candidate - Active Work

Purpose: show the work currently moving or needing near-term attention.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate\Candidate'
    AND [System.State] IN ('Active', 'New')
    AND [System.WorkItemType] <> 'Task'
ORDER BY
    [System.State],
    [System.ChangedDate] DESC,
    [System.Id]
```

Notes:

- Excluding tasks keeps the dashboard widget readable.
- If a task is the actual visible blocker, tag it `blocked` and it will appear in the blocked query below.

### Candidate - Blocked / Needs Team Answer

Purpose: surface blocked work and external decisions the integration/deployment team needs to answer.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.State] NOT IN ('Closed', 'Removed')
    AND (
        [System.Tags] CONTAINS 'blocked'
        OR [System.Tags] CONTAINS 'integration-team-needed'
        OR [System.AssignedTo] = 'Himanshu Sagar <himanshusagar@rangam.com>'
    )
ORDER BY
    [System.ChangedDate] DESC,
    [System.Id]
```

Notes:

- This query intentionally includes all candidate-project area paths because integration blockers may sit under Candidate, Shared Platform, Integration, or Recruiter.
- Keep assignment to Himanshu only for items truly owned by the integration/deployment path; otherwise rely on tags.

### Candidate - Integration Team Questions

Purpose: keep unresolved external contracts visible without mixing them into all blocked work.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.State] NOT IN ('Resolved', 'Closed', 'Removed')
    AND (
        [System.Tags] CONTAINS 'integration-team-needed'
        OR [System.Title] CONTAINS 'Confirm'
        OR [System.Title] CONTAINS 'handoff'
        OR [System.Title] CONTAINS 'return'
    )
ORDER BY
    [System.ChangedDate] DESC,
    [System.Id]
```

Notes:

- Use this for the dashboard's integration-team questions widget.
- Prefer tagging the item `integration-team-needed`; the title clauses are a fallback for older items.

### Candidate - Auth Handoff

Purpose: focus the SSO, TalentArbor login, local-dev auth, and identity handoff workstream.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.State] NOT IN ('Closed', 'Removed')
    AND (
        [System.Tags] CONTAINS 'auth-handoff'
        OR [System.Title] CONTAINS 'auth'
        OR [System.Title] CONTAINS 'login'
        OR [System.Title] CONTAINS 'identity'
        OR [System.Title] CONTAINS 'SSO'
    )
ORDER BY
    [System.State],
    [System.ChangedDate] DESC,
    [System.Id]
```

### Candidate - Shared Host Routing

Purpose: track the route contract for `interviewcoach.talentarbor.com`, including `/`, `/recruiter`, candidate top-level routes, admin, and QA.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.State] NOT IN ('Closed', 'Removed')
    AND (
        [System.Tags] CONTAINS 'shared-host-routing'
        OR [System.Title] CONTAINS 'shared host'
        OR [System.Title] CONTAINS 'route'
        OR [System.Title] CONTAINS '/recruiter'
    )
ORDER BY
    [System.State],
    [System.ChangedDate] DESC,
    [System.Id]
```

### Candidate - PR Ready / Review Needed

Purpose: show work that has implementation evidence and is ready for review, plus documentation/reviewer handoff items.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.State] IN ('Active', 'Resolved')
    AND (
        [System.Tags] CONTAINS 'docs-ready'
        OR [System.Title] CONTAINS 'review'
        OR [System.Title] CONTAINS 'PR'
        OR [System.Title] CONTAINS 'policy'
    )
ORDER BY
    [System.State],
    [System.ChangedDate] DESC,
    [System.Id]
```

Notes:

- Use `Resolved` for stories/features that are implemented and waiting for acceptance or PR review.
- Use `Closed` only after acceptance/review is complete.

### Candidate - Security Privacy Risks

Purpose: keep security, privacy, resume-data, redirect, and ownership-review items visible.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.State] NOT IN ('Closed', 'Removed')
    AND (
        [System.Tags] CONTAINS 'security'
        OR [System.Tags] CONTAINS 'resume-data'
        OR [System.Title] CONTAINS 'privacy'
        OR [System.Title] CONTAINS 'security'
        OR [System.Title] CONTAINS 'redirect'
        OR [System.Title] CONTAINS 'ownership'
    )
ORDER BY
    [System.State],
    [System.ChangedDate] DESC,
    [System.Id]
```

### Candidate - Docs Needing Review

Purpose: identify docs and handoff items that need reviewer or team validation.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.State] NOT IN ('Closed', 'Removed')
    AND (
        [System.Tags] CONTAINS 'docs-ready'
        OR [System.Title] CONTAINS 'doc'
        OR [System.Title] CONTAINS 'wiki'
        OR [System.Title] CONTAINS 'runbook'
        OR [System.Title] CONTAINS 'checklist'
    )
ORDER BY
    [System.State],
    [System.ChangedDate] DESC,
    [System.Id]
```

### Candidate - Bugs

Purpose: keep defects separate from planned backlog work.

Query type: Flat list of work items.

Filter:

```wiql
SELECT
    [System.Id],
    [System.WorkItemType],
    [System.Title],
    [System.State],
    [System.AssignedTo],
    [System.Tags],
    [System.AreaPath],
    [System.IterationPath],
    [System.ChangedDate]
FROM WorkItems
WHERE
    [System.TeamProject] = @project
    AND [System.AreaPath] UNDER 'Interview-Coach-Candidate'
    AND [System.WorkItemType] = 'Bug'
    AND [System.State] NOT IN ('Closed', 'Removed')
ORDER BY
    [System.State],
    [System.ChangedDate] DESC,
    [System.Id]
```

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
6. Candidate Postgres smoke readiness
7. Seeded candidate browser smoke for setup/session/summary

The Fu-Lab rehearsal pipeline should use a non-secret placeholder `GEMINI_API_KEY` so `next build` can compile production AI routes without granting the mirror project a real provider credential. Production or staging pipelines should use a secured Azure variable or variable group once AI-provider calls are exercised outside deterministic smoke fixtures.

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
