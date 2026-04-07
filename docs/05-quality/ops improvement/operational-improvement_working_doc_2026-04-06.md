# Operational Improvement Working Document

Date: 2026-04-06

## What This Is

This document is the source instruction and execution guide for setting up a lightweight, scalable GitHub-based operating system for the Interview Coach apps.

It is written so that:

- the current team can use it directly
- a new contributor could follow it without prior GitHub Projects experience
- the same system can be cloned for another app or repo with minimal changes

This guide assumes a two-repo setup:

- recruiter-led app repo
- candidate-led app repo

The recommended operating model is:

- one org-level GitHub Project as the control center across both repos
- repo-level issue forms for consistent intake
- built-in GitHub issue `Type` plus labels for work categorization
- project fields for planning structure
- built-in project workflows for automation
- GitHub Actions only after the taxonomy is stable

## Why This System

The goal is to stop losing ideas, reduce ad hoc planning, and make project administration repeatable.

This system is designed to do three things at once:

1. help PM-style planning stay visible and structured
2. help dev work stay actionable and easy to triage
3. make the routine low-touch enough to feel close to autopilot

## Key Design Principles

- GitHub Issues are the source of truth for work items.
- GitHub Project fields, not issue body markdown, should drive views and reporting.
- Issue forms should gather narrative context, not serve as the only structure.
- Use built-in `Type` for the broad GitHub-native buckets: `Bug`, `Feature`, and `Task`.
- Use labels for the next layer of work categorization: `hardening`, `research`, `policy`, `chore`, and cross-cutting tags like `privacy` or `security`.
- Since the apps are in separate repos, repo context should replace `area:recruiter-app` and `area:candidate-app` labels.
- Automate with built-in GitHub workflows first. Add Actions later only where native automation stops.

## Recommended Artifact Set

Use the following files in this folder as the implementation kit:

- [System Blueprint](./github-project_system-blueprint.md)
- [Issue Types And Fields](./github-project_issue-types-and-fields.md)
- [Label Taxonomy](./github-project_label-taxonomy.md)
- [Project Views And Workflows](./github-project_views-and-workflows.md)
- [Issue Form Config](./github-project_issue-template-config.yml)
- [Hardening Issue Form](./github-project_issue-form_hardening-risk-gap.yml)
- [Product Issue Form](./github-project_issue-form_product-ux-idea.yml)
- [Research Issue Form](./github-project_issue-form_research-decision.yml)
- [Weekly Triage Checklist](./weekly-triage-checklist.md)
- [Seed Issues](./seed-issues.md)

## What GitHub Already Supports

GitHub already provides most of what this system needs:

- Projects with table, board, roadmap, fields, and workflows
- built-in workflows to auto-add items, set status, mark done, and archive
- issue forms for standardized intake
- the built-in issue `Type` field
- project custom fields

Practical note:

- richer org-level issue types and org issue fields may not be available in every org setup
- this guide assumes the fallback model that works today in a standard org: built-in `Type`, labels, and project fields

If richer issue-type management becomes available later, this system can be upgraded without changing its overall shape.

## Recommended Starting Template

If creating a new GitHub Project from a template, start with:

- `Team planning`

Reason:

- it is the best base for backlog, execution, hardening, and medium-term planning
- it adapts better than `Bug tracker`, `Feature release`, or `Product launch` as a master system

Do not use the template as-is. Use it only as the starting shell.

## Setup Instructions

Follow these steps in order.

### Step 1: Create The Org-Level Project

Create one organization-level GitHub Project to manage work across both repos.

Use the guidance in [System Blueprint](./github-project_system-blueprint.md).

Recommendation:

- Project name: `Interview Coach Product Board`
- Template: `Team planning`

Why org-level:

- keeps both repos visible in one place
- makes privacy, release, and product work easier to coordinate
- avoids duplicated project systems

### Step 2: Define Built-In Type Usage And Project Fields

Set up the meaning of `Type` and the project fields before tuning views. This is what allows issue creation to systematically drive project views later.

Use:

- [Issue Types And Fields](./github-project_issue-types-and-fields.md)

Important design choice:

- issue forms collect narrative
- built-in `Type` handles the broad GitHub-native categories
- labels handle the extra work categories
- project fields drive planning, filtering, and reporting

This is the single most important design decision in the system.

### Step 3: Set The Label Taxonomy

Keep labels intentional and useful.

Use:

- [Label Taxonomy](./github-project_label-taxonomy.md)

Important clarification:

- delete `area:recruiter-app` and `area:candidate-app`
- use the built-in repository context in the project instead

This keeps the label set smaller and avoids redundant metadata.

Also:

- do not try to force all work categorization into the built-in `Type` field
- reserve `Type` for `Bug`, `Feature`, and `Task`
- use labels like `hardening`, `research`, and `policy` for the next layer of meaning

### Step 4: Build Views And Built-In Workflows

Once the field structure is in place, configure the project views and built-in workflows.

Use:

- [Project Views And Workflows](./github-project_views-and-workflows.md)

Build these first:

- Inbox
- This Week
- Recruiter Hardening
- Candidate Discovery
- Blocked
- Roadmap

Then turn on the native workflows for:

- auto-add to project
- set new items to `Inbox`
- mark closed items `Done`
- auto-archive `Done`

### Step 5: Install The Repo Issue Forms

Use issue forms to standardize intake in each repo.

Files to copy into `.github/ISSUE_TEMPLATE/`:

- [Issue Form Config](./github-project_issue-template-config.yml)
- [Hardening Issue Form](./github-project_issue-form_hardening-risk-gap.yml)
- [Product Issue Form](./github-project_issue-form_product-ux-idea.yml)
- [Research Issue Form](./github-project_issue-form_research-decision.yml)

Recommended manual `Type` mapping when creating issues:

- Hardening / Risk Gap -> `Task`
- Product / UX Idea -> `Feature`
- Research / Decision -> `Task`

Then let the form-applied labels carry the more specific category.

### Step 6: Create Milestones

Create the initial milestones.

Use:

- [System Blueprint](./github-project_system-blueprint.md)

Start with:

- `Recruiter App Pre-Release Hardening`
- `Candidate Dashboard Definition`
- `Candidate Dashboard MVP`

Milestones should be used only for real release or phase boundaries.

### Step 7: Seed The System With Real Work

Create the first issues so the project becomes operational immediately.

Use:

- [Seed Issues](./seed-issues.md)

This is important. A system with no real work in it will not get adopted.

### Step 8: Start The Cadence

Once the project exists and the first issues are added, begin the operating cadence immediately.

Use:

- [Weekly Triage Checklist](./weekly-triage-checklist.md)

The minimum viable routine is:

- capture ideas as issues
- triage once a week
- keep active work small
- log decisions separately in docs

## How To Clone This System For Another App

If someone else wanted to copy this operating model for another app:

1. create a new org-level or team-level GitHub Project using the same structure
2. reuse the built-in `Type` mapping and field model from [Issue Types And Fields](./github-project_issue-types-and-fields.md)
3. reuse the labels from [Label Taxonomy](./github-project_label-taxonomy.md)
4. reuse the views and workflows from [Project Views And Workflows](./github-project_views-and-workflows.md)
5. copy the issue form YAML files into the new repo's `.github/ISSUE_TEMPLATE/`
6. adapt only the `Stream` values, milestone names, and seed issues

Everything else should remain mostly the same.

## PM And DevOps Operating Notes

From a PM lens:

- `Inbox` is the intake queue
- `This Week` is the active commitment
- `Roadmap` is the medium-term planning view
- `Candidate Discovery` and `Recruiter Hardening` are purpose-built lenses for different work streams

From a devops lens:

- native GitHub workflows should do the basic routing
- structured fields should make risk and hardening visible
- labels should express work category cleanly when custom issue types are unavailable
- recurring review should prevent silent backlog drift
- release hardening should always have a dedicated view

## What To Avoid

- using labels as the primary taxonomy
- creating a separate project for every concern too early
- relying only on issue body text for structure
- over-automating before the field taxonomy settles
- mixing durable decisions with work-item tracking in the same place

## Recommended Next Step After Setup

After the GitHub system is in place, the best next operational follow-up is:

- create a recruiter app hardening issue for in-session feedback persistence
- create a candidate app decision issue for dashboard data retention and disclosures
- start using the project for all new work immediately

That is what will make the system real.
