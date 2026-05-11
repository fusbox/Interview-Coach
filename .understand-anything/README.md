## Argument Shape

```text
/understand [path] [--full|--auto-update|--no-auto-update|--review]
```

## Flag Usage

- No `--full`: reuse/update behavior. If a graph exists and the commit changed, it tries an incremental update. If no graph exists, it does a full analysis.
- `--full`: force a full rebuild, ignoring the existing graph.
- `--auto-update`: writes `{ "autoUpdate": true }` to `.understand-anything/config.json`.
- `--no-auto-update`: writes `{ "autoUpdate": false }` to `.understand-anything/config.json`.
- No auto-update flag: leaves the existing config alone.
- `--review`: runs the fuller graph-reviewer path instead of default deterministic validation.

You can also pass a path:

```text
/understand C:\tmp\Interview-Coach-Recruiter-postgres --full --no-auto-update
/understand . --review
/understand C:\dev\Interview-Coach-Candidate --full
```

## Skills

- `/understand`: builds or refreshes the project knowledge graph.
- `/understand-dashboard`: opens the interactive dashboard for a generated graph.
- `/understand-chat`: asks questions against the generated codebase graph.
- `/understand-diff`: analyzes git diffs or PR-style changes.
- `/understand-domain`: extracts business/domain knowledge from the codebase.
- `/understand-explain`: deep-dives a specific file, function, component, or flow.
- `/understand-knowledge`: analyzes a knowledge base/wiki-style document set.
- `/understand-onboard`: generates onboarding guidance for a person joining the project.

## Commit Guidance

Commit the shared graph artifacts in `.understand-anything/` so collaborators can inspect the same project map. Keep local scratch out of git:

- `.understand-anything/intermediate/`
- `.understand-anything/tmp/`
- `.understand-anything/diff-overlay.json`

## Suggested Use

Use `/understand-dashboard` as a visual map of the shared repo. Good starter questions:

- Which files control candidate login redirect?
- How does recruiter auth differ from candidate auth?
- Where is Postgres access centralized?
- What changed when Supabase was removed?

Use `/understand-explain src/app/page.tsx` before editing unfamiliar files.

For Himanshu or integration/deployment handoff, useful entry questions include:

- Show candidate public landing and login redirect flow.
- Show recruiter `/recruiter` alias and `/recruiter/create` relationship.
- Show backend/env/db dependencies touched by candidate app integration.
- Run diff impact for this PR.

Before opening a PR, run `/understand-diff` and include a human summary of changed domains, touched routes, auth/session risk, deployment/env implications, and tests run.
