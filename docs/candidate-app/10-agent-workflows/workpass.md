/workpass

1. Read `docs/candidate-app/HANDOFF.md`, then the linked `SPEC.md`, `DATA_CONTRACT.md`, architecture, and V1 references required by the next slice.
2. Run `.agents/skills/senior-slice-pass` to establish product intent, prior-behavior disposition, lifecycle/data lineage, assumptions, boundaries, counterfactuals, and acceptance evidence.
3. If repository evidence conflicts with the staged plan, record the conflict and revise the working docs before implementation.
4. Implement the smallest coherent slice and keep unrelated debt out of scope.
5. Run focused tests, `npm run test:candidate`, `npm run typecheck`, `npm run build`, and `git diff --check` as applicable. Add DB smoke validation for schema/repository work and browser validation for user journeys.
6. Run the closing half of `.agents/skills/senior-slice-pass`; classify findings as fix now, defer with owner/trigger, or decision required.
7. Update `SPEC.md`/`DATA_CONTRACT.md` for durable changes and `HANDOFF.md` for current state, risks, completed work, and exact next slices.
8. Before a multi-slice commit boundary, run `.agents/skills/senior-milestone-pass`. Before a deployment, pilot, migration, or release decision, run `.agents/skills/senior-release-pass`.
9. Summarize changed files, verification evidence, assumptions, untested areas, and residual risk.
