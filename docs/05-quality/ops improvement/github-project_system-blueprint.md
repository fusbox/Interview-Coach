# GitHub Project System Blueprint

## Recommended Shape

- One organization-level GitHub Project
- Two feeder repos
- One shared operating model

Project name:

```text
Interview Coach Product Board
```

Recommended starting template:

```text
Team planning
```

## Why This Shape

- keeps both repos visible together
- avoids duplicated setup and drift
- supports privacy, product, release, and hardening work in one system
- lets repository context separate work without requiring app-specific labels

## Type And Label Model

Use:

- built-in `Type` for `Bug`, `Feature`, and `Task`
- labels for work category like `hardening`, `research`, `policy`, and `chore`
- project fields for planning metadata

## Initial Milestones

Create these milestones in the relevant repos:

- `Recruiter App Pre-Release Hardening`
- `Candidate Dashboard Definition`
- `Candidate Dashboard MVP`

## Initial Project Fields

- `Status`
- `Priority`
- `Risk`
- `Domain`
- `Stream`
- `Effort`
- `Iteration`
- `Target date`
- `Start date`

## Core Views To Build First

- `Inbox`
- `This Week`
- `Recruiter Hardening`
- `Candidate Discovery`
- `Blocked`
- `Roadmap`
- `Recently Done`

## Recommended Built-In Workflows

- auto-add matching items from both repos
- set added items to `Inbox`
- mark closed items `Done`
- archive completed items after a delay

## Notes

Use the project as the control center, not the issue body.
