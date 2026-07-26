# AI-Assisted Coding Rules

- Ask for context first.
- Write or update the governing spec.
- Implement a small coherent slice.
- Run tests and applicable verification.
- Summarize changes, risks, and follow-ups.
- Never silently broaden scope.

For meaningful code slices, use `.agents/skills/senior-slice-pass` before implementation and before declaring completion. At a multi-slice commit or phase boundary, use `.agents/skills/senior-milestone-pass`. Before a deployment, pilot, migration, or production release decision, use `.agents/skills/senior-release-pass`.

When repository evidence conflicts with a plan, prioritize product intent and user safety, durable invariants, and current architecture evidence. Name the conflict and recommend course correction; do not implement known-bad behavior merely because it was planned.

For a ratified autonomous multi-slice milestone, read `docs/07-ops/autonomous-development-operating-model.md` and use `.agents/skills/autonomous-milestone-run`. Keep the limited-scope slice cadence inside the milestone, maintain one lead integrator, give subagents bounded non-overlapping assignments, and stop at the operating model's escalation conditions. Do not run two writing agents in the same dirty worktree or give more than one agent ownership of a shared file.

Start documentation work from `docs/README.md`. Read the canonical authority stack and only the subsystem documents needed for the active work. Content under `docs/reference-archive` is historical and must not be treated as current implementation direction unless the active milestone explicitly calls for prior-behavior review.
