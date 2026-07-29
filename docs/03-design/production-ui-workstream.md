# Production UI Workstream

Status: Active operating contract; first candidate integration milestone completed
Last updated: 2026-07-27

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

#### Candidate setup source contract

For `/candidate/setup`, `Candidate Setup Mobile A.dc.html` is production-ready visual authority after removing preview-only phone/OS chrome and authoring runtime. There is no separate desktop reference. Desktop and tablet are deliberate responsive derivations of the mobile hierarchy using the same DOM, controls, states, copy, and design-system roles.

- Preserve the current V2 setup state machine, draft recovery, trusted-host read-only context, resume processing/review/privacy boundary, duplicate-context choice, validation focus, idempotent start, and route transition.
- Reproduce the mobile brand row, coach spotlight, Role/Resume/Interview details panels, compact round summary, in-flow start action, and two-destination Dashboard/New role navigation.
- Use the 56rem form-flow frame for the desktop header, spotlight, and form. The 70rem workflow frame remains available for builders with a compact context rail, while the 76rem default remains reserved for broad dashboard and operations workspaces.
- Treat Paste text, Upload resume, and Take photo as one mutually exclusive mode selector. Only the active mode receives the selected surface; hover and keyboard focus must remain distinguishable from selection. Restore the last explicit mode with an unsubmitted draft without retaining raw source bytes.
- Keep the photo workspace unframed inside the Resume panel. Its capture, existing-photo, review, and fallback controls provide the hierarchy; it must not inherit a decorative wash, oversized radius, or accent stripe.
- Close the setup flow with one spotlight labeled `Your practice round`. Its glass summary presents Resume, Stage, Recommended, and Selected in that order, using the same accepted-artifact label/fallback contract as the pre-session landing. On wider screens, a compressed summary occupies the left column and the Start practice action occupies the right; on mobile they stack in that reading order. Start practice remains in normal flow and is not a second mobile footer competing with the navigation dock.
- Keep setup as one continuous semantic form on mobile and desktop. A full-height vertical timeline occupies the left rail, marks Role, Resume, and Interview details with numbered nodes, updates its active node when a section reaches the reading position, and distinguishes completed from merely visited work.
- Guide progression with explicit actions and preserve the complete scroll chain: valid Role/JD to Resume; accepted resume or explicit continue-without-resume to Interview details; stage to count; count to Start practice. Do not advance on processing, review-required, or failure states, steal keyboard focus, or animate when reduced motion is requested. Manual scrolling remains available and downstream content is not conditionally removed.
- Keep resume submission action-first. Before processing, show the enabled action without coach-voiced explanatory copy. During processing, the status rail explains contact-detail removal and preparation; after processing, it tells the candidate to review and edit the prepared text before acceptance. Editing previously accepted text returns the same rail to review with `Use this resume`, removes resume inclusion from the round summary, and keeps Start practice unavailable until the replacement version is accepted. Errors remain explicit and recoverable.
- Present Role, Resume, and Interview details as blue eyebrow labels. All three section panels use `--surface-alt`, while their text-entry and inactive-selection surfaces use `--surface-base`. Coach interpretation uses the reusable **coach-voice surface**: `--surface-base`, a 2px primary-blue edge, the surface compass mark, 24px `--radius-card`, and restrained `--shadow-raised-1` elevation. Resume processing/review status and the stage-specific count recommendation share this composition. Selected input-mode, stage, and count controls use opaque `--primary-soft` plus a tight inset/outer contour; input-mode and stage controls use 16px `--radius-widget`, while the shorter count controls keep their compact role. Inactive mode, stage, and count controls change border color only on hover, with no hover fill. Primary actions on neutral surfaces use the shared short neutral-first, faint-blue drop shadow through `--elevation-cta`. The closing spotlight's Start practice action uses the reusable opaque-white, brand-blue `.on-color-action` treatment; its four-fact summary uses `.on-color-glass`.
- On mobile, show the candidate navigation dock on arrival and near the top, hide it during deliberate downward reading, and reveal it on upward movement or keyboard focus. Wider header navigation remains stable.
- Use only 3, 5, 7, and 10 as promoted count choices. The planner may accept intermediate counts, but they do not express a distinct setup strategy and eight mobile pills would weaken target sizing and choice clarity.
- Install and use the authored calm, surface, and CTA light/dark compass SVG variants as the app's coach identity. Calm belongs on the spotlight; surface uses the theme's primary-blue needle half on light coach-voice surfaces; CTA remains its own authored treatment. Do not replace them with a general icon.
- Exclude the preview bezel, status bar, home indicator, dark-mode preview control, `<x-dc>`/`sc-*` runtime, and mock-only state handlers.
- Verify the full resume state family, missing/invalid fields, preparing/failure states, duplicate-context dialog, narrow-mobile reflow, desktop derivation, keyboard order, focus visibility, zoom, overflow, and reduced motion.

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
