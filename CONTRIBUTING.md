# Contributing

## Expectations

- Keep changes narrow and reviewable.
- Do not revert unrelated user changes in a dirty worktree.
- Prefer incremental remediation over large speculative rewrites.
- Treat security, auth, idempotency, and session correctness as release-sensitive surfaces.

## Setup

1. Install dependencies with `npm install`.
2. Configure local environment variables and the disposable database using [Candidate Local Dev Bootstrap](docs/candidate-app/09-dev/local-dev-bootstrap.md).
3. For legacy recruiter-only environment details, consult the archived [Environment Variable Matrix](docs/reference-archive/recruiter-v1/05-quality/environment_variable_matrix.md).
4. Start the app with `npm run dev`.

## Required Checks Before Opening a PR

Run:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run test:stability
```

If you want the repo-standard combined gate:

```bash
npm run ci:quality
```

## Change Guidelines

- Add or update tests for behavior changes, especially on:
  - API auth/validation/error-envelope paths
  - session mutation concurrency
  - repository mappers
  - provider-boundary parsing
- Keep public API errors sanitized.
- Do not introduce new mutable endpoints without explicit authn/authz and rate-limit decisions.
- Do not add optimistic UI mutations without rollback or reconciliation behavior.
- Prefer shared domain/application helpers over duplicating route logic.

## PR Checklist

- [ ] The change has a clear problem statement and bounded scope.
- [ ] New or changed behavior is covered by tests where practical.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:coverage` passes.
- [ ] `npm run test:stability` passes for concurrency-sensitive work.
- [ ] Docs were updated if scripts, env vars, or workflows changed.
- [ ] No secrets were added to source, fixtures, logs, or screenshots.

## Commit Guidance

- Use concise, imperative commit messages.
- Prefer one logical change per commit.
- Separate mechanical refactors from behavior changes when possible.

## High-Risk Areas

- `src/app/api/**`
- `src/features/session/**`
- `src/lib/server/**`
- `supabase/migrations/**`

Changes in these areas should be reviewed for correctness, abuse resistance, and regression risk, not just style.
