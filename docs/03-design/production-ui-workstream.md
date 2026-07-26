# Production UI Workstream

Status: Active operating contract; first candidate integration milestone completed
Last updated: 2026-07-26

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

### Design Source

The global runtime foundation is governed by [Design System Foundation](./design-system-foundation.md). Production UI consumes one unprefixed token namespace and one RGB runtime color format across every audience. The maturation package's `Design System Reference.dc.html` is the highest visual-intent source; its gap log is not canonical. `legacy-compat.css` exists only to keep provisional surfaces stable while they are replaced and is owned by the integration lane unless explicitly handed to the UI lane.

The latest local Claude Design snapshot currently supplies mature-but-not-final mobile references for candidate setup, the dashboard initial view, the session landing screen, and the active question screen. These are accepted production-direction inputs, not pixel-locked specifications. Other screens and experiments in the package remain exploratory until reviewed.

The package is reconciled rather than copied wholesale. Its current reference screens use only tokens already present in the installed runtime. Any future token delta must be adapted to the global unprefixed RGB contract before it becomes active.

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

## Autonomous Surface Milestones

Production UI may run as a bounded autonomous milestone under [Autonomous Development Operating Model](../07-ops/autonomous-development-operating-model.md).

The lead integrator must define:

- the accepted reference composition and design-system source;
- the complete state and action inventory for every included surface;
- desktop, narrow-mobile, long-text, zoom/reflow, and reduced-motion cases;
- the route, shared component, token, and `src/index.css` writer for each internal slice;
- behavior contracts that the UI consumes but does not reimplement;
- screenshot, geometry, accessibility, and browser-journey evidence;
- design decisions that may proceed and be recorded versus pivots that require user review.

Subagents may inspect V1 behavior, build state inventories, implement isolated components in separate worktrees, or run visual/accessibility review. One lead agent owns final composition, shared files, design-system changes, and milestone judgment.

## Surface Pass

Each production surface pass should:

1. Read its current route, component, tests, governing product/design contract, and relevant V1 behavior.
2. Inventory every supported state and action before replacing markup.
3. Separate behavior defects from presentation work; fix behavior on the core lane when practical.
4. Implement the smallest coherent surface or shared primitive.
5. Verify desktop and mobile layout, long text, zoom/reflow, keyboard/focus, reduced motion, loading, empty, error, recovery, and mutation-in-progress states.
6. Run focused tests plus typecheck/lint; run the broader candidate/recruiter and production browser gates when shared UI changes.
7. Commit the accepted surface independently and record any design-system override or unresolved product decision.

The acceptance matrix must include representative long role/question/candidate text, loading and mutation-pending states, empty and partial evidence, provider-unavailable behavior, stale/conflict recovery, and the audience-specific exit/completion destinations that apply. Automated screenshots should use stable desktop and mobile viewports; geometry checks should fail on viewport overflow, incoherent overlap, clipped controls, or text that escapes its component.

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

## First Integration Evidence

Slice 194 exercised this operating model on the core/integration branch as the sole shared-file writer. It integrated candidate setup, pre-session landing, live practice, and dashboard composition without moving or duplicating domain behavior. The accepted evidence and bounded follow-ups are recorded in [Candidate Production UI Milestone](../05-quality/candidate-production-ui-milestone.md).

Future UI work should use that milestone as a behavioral and validation baseline, not as a pixel-locked endpoint. Invited, recruiter, QA, Coach Update detail, and remaining provisional surfaces still require their own state inventories and acceptance evidence.
