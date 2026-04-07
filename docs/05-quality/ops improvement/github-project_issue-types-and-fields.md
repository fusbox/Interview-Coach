# GitHub Project Type Usage And Fields

## Recommended Built-In Type Usage

Use GitHub's built-in issue `Type` field as the top-level bucket.

- `Bug`
- `Feature`
- `Task`

## Why Use Type This Way

- `Bug` captures broken behavior
- `Feature` captures new product capability or user-facing enhancement
- `Task` captures everything else operationally useful that is not a bug or feature

## Recommended Label Mapping

Because custom org issue types are not available in the current org setup, use labels for the next layer of categorization.

Recommended work-category labels:

- `hardening`
- `research`
- `policy`
- `chore`
- `enhancement` optional if you want an extra non-Type tag for feature discovery work

Recommended issue creation mapping:

- hardening work -> `Type = Task` + label `hardening`
- research work -> `Type = Task` + label `research`
- policy work -> `Type = Task` + label `policy`
- chores / cleanup -> `Type = Task` + label `chore`
- product ideas -> `Type = Feature`
- broken behavior -> `Type = Bug`

## Recommended Issue Fields

Use project fields for planning metadata.

### Priority

Type:

```text
single select
```

Values:

- `P0`
- `P1`
- `P2`
- `P3`

### Risk

Type:

```text
single select
```

Values:

- `Critical`
- `High`
- `Medium`
- `Low`

### Domain

Type:

```text
single select
```

Values:

- `Privacy`
- `Security`
- `Data`
- `UX`
- `Ops`
- `AI`
- `Platform`

### Stream

Type:

```text
single select
```

Values:

- `Recruiter Pre-Release`
- `Candidate Dashboard Discovery`
- `Candidate MVP`
- `Shared Ops`
- `Backlog`

### Effort

Type:

```text
single select
```

Values:

- `XS`
- `S`
- `M`
- `L`
- `XL`

### Start date

Type:

```text
date
```

### Target date

Type:

```text
date
```

## Recommended Workflow Field

### Status

Type:

```text
single select
```

Values:

- `Inbox`
- `Ready`
- `In Progress`
- `Blocked`
- `Done`

Meaning:

- `Inbox`
  Newly captured work that has not been triaged yet. It may still be vague, duplicated, oversized, or missing metadata.

- `Ready`
  Triaged and shaped enough that someone could pick it up without needing another planning pass. The problem is clear, the item has enough context to execute, the relevant fields are set, and it is not blocked. `Ready` does not mean someone is actively working on it yet. It means the item is available to start when capacity opens up.

- `In Progress`
  Someone is actively working on the item now.

- `Blocked`
  Work cannot proceed meaningfully right now because it is waiting on a decision, dependency, access, or external input.

- `Done`
  The intended work is complete enough to close out operationally.

## Recommended Iteration Field

### Iteration

Use GitHub's iteration field for weekly or biweekly planning.

## Field Design Notes

- Issue forms collect narrative context.
- Built-in `Type` gives the first layer of structure.
- Labels provide work category when custom issue types are unavailable.
- Project fields drive filtering, planning, and charts.
- Do not use labels where a project field is more appropriate.

## Practical Rule For `Ready`

An item is `Ready` when a teammate unfamiliar with it could pick it up and understand:

- what problem is being solved
- what good enough looks like
- what constraints or risks matter
- what the next execution step should be
