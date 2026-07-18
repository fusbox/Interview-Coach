# GitHub Label Taxonomy

## Goal

Keep labels intentional and useful.

Use labels for work category and special routing when built-in issue `Type` is too coarse.
Use project fields for primary planning metadata.

## Recommended Labels

### Work Category Labels

- `hardening`
- `research`
- `policy`
- `chore`
- `enhancement` optional if you want a supplemental label for feature discovery work

### Cross-Cutting Labels

- `privacy`
- `security`
- `data-retention`
- `blocked:external`
- `decision-needed`

### Optional Priority Labels

Only use these if your team prefers label-based scanning in repo issue lists.

- `priority:high`
- `priority:medium`
- `priority:low`

## Labels To Avoid

Do not use:

- `area:recruiter-app`
- `area:candidate-app`

Why:

- the apps live in separate repos
- repository context already identifies the app
- app-area labels create redundant metadata and extra admin

## Rule Of Thumb

Use built-in `Type` for the broad bucket:

- `Bug`
- `Feature`
- `Task`

Use labels for the more specific work category:

- `hardening`
- `research`
- `policy`
- `chore`

Use project fields for planning and reporting metadata:

- `Status`
- `Priority`
- `Risk`
- `Domain`
- `Stream`
- `Effort`
