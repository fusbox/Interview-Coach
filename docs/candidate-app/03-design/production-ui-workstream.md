# Production UI Workstream

Status: Active operating contract
Last updated: 2026-07-23

## Purpose

Production UI work may proceed in parallel with core V2 completion, but it must not create a second implementation of domain behavior or make the integration branch absorb unfinished visual experiments. This contract defines branch, worktree, ownership, and verification rules for moving accepted UI concepts into tracked product routes.

## Branch And Worktree Model

| Lane | Branch | Worktree | Owns |
| --- | --- | --- | --- |
| Core/integration | `feature/candidate-v2-rebuild` | `C:\tmp\Interview-Coach-Recruiter-postgres` | Domain contracts, persistence, providers, routes/API behavior, migrations, security, operations, canonical docs, and final integration |
| Production UI | `feature/candidate-v2-production-ui` | `C:\tmp\Interview-Coach-Recruiter-production-ui` | Accepted tracked surface composition, design-system evolution, presentation tests, responsive/accessibility validation, and UI-specific documentation |
| Exploratory UI | no tracked branch | `.untracked/ui-lab` | Disposable live mockups and visual experiments with no production imports |

Do not run two coding agents against the same dirty worktree. Start the UI branch from an accepted core milestone, keep commits small enough to review by surface, and merge or cherry-pick accepted UI commits back through the core/integration branch.

## Ownership Boundary

### Core Lane

- Owns types, repositories, services, route authorization, actions, provider calls, idempotency, persistence, and durable state transitions.
- Supplies explicit loading, empty, partial, success, failure, retry, stale, conflict, unauthorized, and recovered-state contracts.
- Does not restyle a surface concurrently owned by the UI lane unless correcting a blocking behavior defect.

### UI Lane

- Consumes existing read and mutation contracts; it does not bypass repositories/actions or add fixture-only production behavior.
- Owns layout, hierarchy, typography, color, motion, component composition, responsive behavior, focus management, and candidate-facing copy within ratified product meaning.
- May improve the design system when the change is reusable and documented. Surface-specific exceptions must be deliberate and narrowly scoped.
- Keeps demo/mock claims out of production. Preparedness scores, employer sharing, evaluator strictness, resume replacement, and reference-library behavior require separate product/data decisions.

## Shared-File Lock

The following are integration files and have one active writer at a time:

- `src/index.css`;
- shared design-system components and tokens;
- `src/app/**/page.tsx`, layouts, and route-level actions;
- shared candidate/invited session shells;
- `package.json` and lockfiles;
- `SPEC.md`, `DATA_CONTRACT.md`, and `HANDOFF.md`.

Before editing one, identify the owning lane in the current task update. If both lanes need it, land the core contract first, update the UI branch from that commit, and then apply the presentation change. Do not resolve shared-file conflicts by accepting one side wholesale.

## Surface Pass

Each production surface pass should:

1. Read its current route, component, tests, governing product/design contract, and relevant V1 behavior.
2. Inventory every supported state and action before replacing markup.
3. Separate behavior defects from presentation work; fix behavior on the core lane when practical.
4. Implement the smallest coherent surface or shared primitive.
5. Verify desktop and mobile layout, long text, zoom/reflow, keyboard/focus, reduced motion, loading, empty, error, recovery, and mutation-in-progress states.
6. Run focused tests plus typecheck/lint; run the broader candidate/recruiter and production browser gates when shared UI changes.
7. Commit the accepted surface independently and record any design-system override or unresolved product decision.

## Integration Gate

An accepted UI commit may enter the core branch when:

- no domain/persistence/provider logic was duplicated or moved into presentation code;
- behavior and ownership tests remain green;
- supported failure/recovery states remain truthful;
- desktop/mobile, overflow, and WCAG checks pass for the affected surface;
- public, candidate-led, invited, recruiter, and QA audience boundaries remain intact;
- shared-token or primitive changes have been checked against existing consumers;
- the canonical docs are updated on the integration branch.

Full milestone and release gates remain governed by the senior-pass skills and [Production Hardening And Deployment Controls](../07-ops/production-hardening-and-deployment-controls.md).
