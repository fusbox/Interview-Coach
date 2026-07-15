# AI-Assisted Coding Rules

- Ask for context first.
- Write or update the governing spec.
- Implement a small coherent slice.
- Run tests and applicable verification.
- Summarize changes, risks, and follow-ups.
- Never silently broaden scope.

For meaningful code slices, use `.agents/skills/senior-slice-pass` before implementation and before declaring completion. At a multi-slice commit or phase boundary, use `.agents/skills/senior-milestone-pass`. Before a deployment, pilot, migration, or production release decision, use `.agents/skills/senior-release-pass`.

When repository evidence conflicts with a plan, prioritize product intent and user safety, durable invariants, and current architecture evidence. Name the conflict and recommend course correction; do not implement known-bad behavior merely because it was planned.
