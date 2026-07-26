# ADR-0001: Separate Candidate App Repository

Date: 2026-05-07
Status: Superseded by [ADR-0006](./ADR-0006-shared-host-and-azure-branch-integration.md) on 2026-05-08

## Supersession Note

This decision remains useful historical context for modular candidate boundaries, but the deployment/repository conclusion is no longer current.

New deployment guidance confirms that recruiter and candidate implementations will share `https://interviewcoach.talentarbor.com` and that candidate app code should be integrated as a branch in the existing Azure project/repo. See [ADR-0006: Shared Host And Azure Branch Integration](./ADR-0006-shared-host-and-azure-branch-integration.md).

## Context

The candidate-led app shares some practice-session concepts with the recruiter-led app, but it has different users, entry modes, dashboards, auth expectations, resume intake, and roadmap concerns.

## Decision

Develop the candidate-led Interview Coach as a separate repository and app.

Reuse only stable patterns and selected implementation slices from [C:\tmp\Interview-Coach-Recruiter-postgres](/c:/tmp/Interview-Coach-Recruiter-postgres), especially the migrated Postgres backend and reusable session-engine patterns.

## Consequences

- Candidate flows can evolve without recruiter route or UI coupling.
- Deployment separation is no longer the active target; modular code boundaries still matter inside the shared deployable app.
- Shared code should be extracted only after the shared boundary is proven.
- Duplicate implementation may exist briefly while boundaries mature.
