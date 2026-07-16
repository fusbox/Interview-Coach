# Candidate V2 Work Pass Checklist

Status: Active cleanroom V2 process
Last updated: 2026-07-16

Use this checklist at the start and end of each candidate V2 implementation pass.

## Start

1. Confirm the repository, branch, and push target:

   ```powershell
   git rev-parse --show-toplevel
   git branch -vv
   git remote -v
   git switch feature/candidate-v2-rebuild
   git pull --ff-only fusbox feature/candidate-v2-rebuild
   ```

2. Read the active context stack:

   - [HANDOFF](./HANDOFF.md): current truth, next slice, and open risks.
   - [SPEC](./SPEC.md): candidate product behavior and claim boundaries.
   - [DATA_CONTRACT](./DATA_CONTRACT.md): durable data and state contracts.
   - [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md): current runtime, DB, and validation commands.
   - [V1 SWOT And Rebuild Runway](./04-architecture/v1-swot-and-rebuild-runway.md): how V1 informs the clean rebuild.

3. For a meaningful slice, run `.agents/skills/senior-slice-pass` before implementation. At a multi-slice commit or phase boundary, run `.agents/skills/senior-milestone-pass`. Before deployment, pilot, migration, or release, run `.agents/skills/senior-release-pass`.

4. Inspect the matching V1 behavior on `feature/candidate-module`. Record what V2 will preserve, reinterpret, retire, or defer. Favor the ratified V2 contract when V1 behavior conflicts with product intent, durable invariants, privacy, or current architecture.

## During

- Implement one coherent numbered slice unless the user explicitly authorizes a combined pass.
- Keep candidate routes under `/candidate/*`; temporary `*2` paths are compatibility redirects only.
- Keep identity, candidate ownership, prep-context identity, immutable attempt lineage, idempotency, and recovery behavior explicit at every write boundary.
- Preserve candidate-safe projections: provider output and hidden evaluator facts must not leak into browser/session state.
- Update durable product behavior in `SPEC.md`, durable shapes in `DATA_CONTRACT.md`, and only current execution state in `HANDOFF.md`.
- Look at least one slice ahead for contracts, migrations, operations, and UX dependencies that would otherwise create rework.
- Do not broaden into recruiter/admin redesign, Azure integration, or legacy-data accommodation without an explicit slice decision.

## Verification

Run focused tests for the touched contract first. The default candidate closeout is:

```powershell
npm run test:candidate
npm run typecheck
npm run lint
git diff --check
```

When migrations, repositories, seeds, or database read models change:

```powershell
npm run db:smoke-candidate-readiness
```

When the dev server is not using `.next`, also run:

```powershell
npm run build
```

Use `npm run ci:candidate:with-db` for the full integrated local gate. Credentialed evaluator checks remain explicit, opt-in QA operations governed by the [Live Evaluator Validation Runbook](./05-quality/live-evaluator-validation-runbook.md); they are not ordinary unit-test steps.

## Closeout

- Re-run the applicable senior pass and resolve, deliberately defer, or surface every finding.
- Review the staged diff independently from the working tree so unrelated user changes stay uncommitted.
- Keep `HANDOFF.md` narrow: current truth, immediate slices, open risks, phase map, and compact completed history.
- Commit a coherent milestone and push `feature/candidate-v2-rebuild` to `fusbox` only unless the user changes the target.
- Summarize behavior, verification, residual risks, and the next recommended slice.
