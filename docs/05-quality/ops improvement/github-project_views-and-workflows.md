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
Repository = Interview-Coach-Recruiter AND (Label = hardening OR Label = policy OR Type = Bug)
```

Purpose:

- release-risk management

### 4. Candidate Discovery

Layout:

```text
table
```

Filter:

```text
Repository = interviewcoach AND (Label = research OR Label = policy OR Type = Feature)
```

Purpose:

- dashboard and privacy/product discovery

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
Status = Done
```

Sort:

```text
updated descending
```

Purpose:

- closeout and reporting

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
