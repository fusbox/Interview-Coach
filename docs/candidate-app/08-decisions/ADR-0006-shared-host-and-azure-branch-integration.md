# ADR-0006: Shared Host And Azure Branch Integration

Date: 2026-05-08
Status: Accepted

## Context

The earlier candidate app direction assumed a separate repo and potentially a separate Azure project/deployment. New deployment guidance confirms that recruiter and candidate Interview Coach implementations will share:

- app host: `https://interviewcoach.talentarbor.com`
- Azure project/repo path: existing `Interview_Coach_AI`
- top-level route space, with candidate routes beside `/recruiter`, `/admin`, and `/qa`

Recruiter launch from the ATS should land on `/recruiter`, which maps to the current recruiter create experience. Candidate authenticated launch should land on `/dashboard`.

## Decision

Candidate app deployable work should be integrated into the existing Azure project/repo, preferably on a branch created from the migrated recruiter Postgres branch:

```text
feature/candidate-app-integration
```

The standalone candidate repo remains useful as an incubation and design workspace, but it is no longer the preferred deployable repository shape.

The shared host should be treated as a single deployable Next app unless the integration team explicitly commits to a more complex path-proxy deployment model.

## Branch Strategy

Recommended branch path:

1. Keep `feature/postgres-integration` as the migrated recruiter/Postgres baseline.
2. Create `feature/candidate-app-integration` from `feature/postgres-integration`.
3. Port candidate app slices into that branch incrementally.
4. Target PRs into `feature/postgres-integration` until the team promotes the Postgres branch to the main integration baseline.
5. Use a standalone branch such as `candidate/standalone-snapshot` only if the team wants to inspect the current candidate repo state without treating it as the deployment path.

## Consequences

- Candidate routing must coexist with recruiter/admin/QA routing in one app.
- Candidate auth and recruiter auth need explicit boundaries and tests.
- Candidate docs should be publishable from the Azure repo branch so reviewers can inspect context near the code.
- The earlier separate-repo reasoning still matters for modularity, but not for deployment packaging.
- Integration work should favor small PRs that preserve recruiter behavior while adding candidate slices.

## Supersedes

This ADR supersedes the deployment/repo conclusion in [ADR-0001: Separate Candidate App Repository](./ADR-0001-separate-candidate-app-repository.md).

ADR-0001 remains historical context for why candidate app boundaries should stay modular and not become recruiter-specific conditionals scattered through the codebase.
