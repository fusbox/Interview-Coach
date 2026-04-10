# GitHub Project Views And Workflows

## Core Views

Create these views first.

### 1. Inbox

Layout:

```text
table
```

Filter:

```text
Status = Inbox
```

Recommended columns:

- Title
- Repository
- Type
- Priority
- Risk
- Domain
- Stream
- Effort
- Assignee
- Created date

Purpose:

- intake and triage

### 2. This Week

Layout:

```text
board
```

Group by:

```text
Status
```

Filter:

```text
Iteration = Current AND Status != Done
```

Purpose:

- execution surface

### 3. Recruiter Hardening

Layout:

```text
table
```

Filter:

```text
repo:Rangam-Fu/Interview-Coach-Recruiter label:hardening,policy
```

Purpose:

- release-risk management

Operational note:

- if a recruiter-app bug belongs in this hardening lane, also label it `hardening` or `policy`

### 4. Candidate Discovery

Layout:

```text
table
```

Filter:

```text
repo:Rangam-Fu/interviewcoach label:research,policy
```

Purpose:

- dashboard and privacy/product discovery

Operational note:

- if a candidate-app feature belongs in this discovery lane, also label it `research` or `policy`

### 5. Blocked

Layout:

```text
table
```

Filter:

```text
Status = Blocked
```

Purpose:

- unblock review

### 6. Roadmap

Layout:

```text
roadmap
```

Date field:

```text
Target date
```

Group by:

```text
Stream
```

Purpose:

- medium-term planning

### 7. Recently Done

Layout:

```text
table
```

Filter:

```text
Status:Done
```

Purpose:

- closeout and reporting

Operational note:

- GitHub Projects currently supports `updated` as a filter qualifier, but not as a sortable table field in this view
- if you want this view to focus on very recent work, add an additional filter such as `updated:>@today-14d`

## Built-In Workflows

Turn on these native GitHub workflows first.

### Auto-add

Automatically add matching issues and pull requests from both repos to the project.

### Default Status

Set newly added items to:

```text
Inbox
```

### Done On Close

When an issue is closed, set:

```text
Status = Done
```

### Done On Merge

When a pull request is merged, set:

```text
Status = Done
```

### Auto-Archive

Archive completed items after an agreed delay.

Recommended:

```text
7 to 14 days
```

## Optional Later Automation

Only add Actions after the taxonomy has stabilized.

Good later automations:

- set `Stream` based on repository
- set `Domain` defaults based on labels or title patterns
- auto-assign current iteration
- report missing fields
