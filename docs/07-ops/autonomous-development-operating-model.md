# Autonomous Development Operating Model

Status: Canonical delivery operating contract
Last updated: 2026-07-26

## Purpose

Interview Coach development may use a larger autonomous execution cadence without abandoning the limited-scope slice discipline that has kept the rebuild reliable.

The human review boundary moves from every slice to a ratified milestone:

1. the user ratifies one bounded milestone and its authority envelope;
2. the lead agent decomposes it into small internal slices;
3. each meaningful slice receives the senior slice pass and proportionate verification;
4. the integrated result receives the senior milestone pass;
5. the user reviews the milestone evidence and working product;
6. deployment, pilot, migration, and release decisions still require the senior release pass.

Autonomy is permission to execute within an approved contract. It is not permission to invent product meaning, weaken safety, or absorb unrelated debt.

## Authority Order

Resolve conflicts in this order:

1. Product intent and user safety
2. Durable invariants, ownership, privacy, and data integrity
3. Current repository behavior and tests
4. `SPEC.md` and `DATA_CONTRACT.md`
5. Ratified ADRs and active subsystem contracts
6. The active milestone in `HANDOFF.md`
7. Historical plans, V1 behavior, and reference material
8. Existing implementation details

Historical material may explain prior behavior but cannot silently override current truth. Name conflicts and revise the governing contract before implementation.

## Milestone Contract

Every autonomous milestone must establish:

- intended product or operational outcome;
- canonical documents and repository evidence;
- included journeys, routes, services, data, and audiences;
- explicit exclusions;
- durable invariants and user-facing claims;
- acceptance states and required evidence;
- external dependencies and assumptions;
- autonomy and escalation boundaries;
- worktree, branch, shared-file, and push ownership;
- time, provider-cost, and remediation-loop budgets when applicable.

Use [Autonomous Milestone Template](./autonomous-milestone-template.md). Keep the active instance in `HANDOFF.md` unless long-lived evidence justifies a dedicated quality artifact.

## Decision Authority

### Proceed

The lead agent may proceed without interruption when work:

- implements a ratified contract;
- adds focused tests, recovery states, accessibility behavior, or observability;
- performs an internal refactor without changing public behavior or durable meaning;
- corrects an evident in-scope defect;
- applies the accepted design system and composition direction;
- updates current documentation to match verified behavior.

### Proceed And Record

The lead agent may make a reversible decision and record it in the milestone evidence when work:

- introduces a small internal abstraction that reduces real duplication;
- adds a reusable semantic design token or primitive;
- corrects a stale plan in favor of current product intent or repository evidence;
- changes implementation sequencing without changing milestone scope;
- defers a bounded noncritical concern with an owner and activation trigger.

### Stop And Ask

The lead agent must stop before:

- creating new product meaning or changing a candidate-facing claim;
- changing identity, authorization, privacy, consent, retention, or provider-data posture;
- changing durable schema semantics, ownership, or lineage beyond the ratified milestone;
- performing a destructive or difficult-to-reverse migration;
- adding a production dependency, external service, or material recurring cost;
- overriding an accepted design direction in a way that changes the product experience;
- resolving contradictory canonical requirements without a clear authority winner;
- broadening into another milestone, audience, or subsystem;
- exceeding an agreed time, cost, or remediation budget.

## Lead Agent And Subagents

One lead agent owns the milestone contract, integration decisions, shared files, final verification, and milestone verdict.

Subagents receive bounded assignments with:

- one objective;
- required source documents;
- explicit files or read-only scope;
- expected evidence;
- prohibited scope;
- a return format and completion condition.

Use [Subagent Assignment Template](./subagent-assignment-template.md) for writing or high-risk investigation work.

Useful specialist roles include prior-behavior investigator, contract/data-lineage reviewer, implementation worker, test/failure-path reviewer, UI/accessibility validator, and independent milestone auditor.

Subagent findings are advisory until the lead agent verifies and integrates them. A subagent must not silently change the milestone contract.

## Worktree And File Ownership

- Do not run two writing agents in the same dirty worktree.
- Use separate worktrees for genuinely parallel implementation.
- Assign one writer to every shared file at a time.
- Record shared-file claims in the active milestone before concurrent work begins.
- Land dependency contracts before consumers.
- Do not resolve integration conflicts by accepting one side wholesale.
- Keep exploratory UI in `.untracked/ui-lab`; production routes consume only accepted tracked work.

The production UI lane has additional ownership rules in [Production UI Workstream](../03-design/production-ui-workstream.md).

## Internal Slice Cadence

For each meaningful internal slice:

1. read the active milestone, governing contract, adjacent code/tests, and relevant prior behavior;
2. run the opening senior slice pass;
3. state scope, exclusions, assumptions, lifecycle, lineage, and acceptance evidence;
4. implement the smallest coherent contract;
5. run focused and proportionate broader verification;
6. run the closing senior slice pass;
7. fix every in-scope `fix now` finding;
8. update governing docs and milestone status;
9. create a reversible checkpoint when the slice is stable.

The user need not review every internal checkpoint unless an escalation condition is reached.

## Acceptance Evidence

The milestone defines which evidence applies:

- unit, integration, route, and repository tests;
- fresh-install and upgrade-shaped database smokes;
- deterministic browser journeys;
- desktop/mobile screenshots and geometry checks;
- keyboard, focus, reflow, contrast, reduced-motion, and accessibility checks;
- provider-fixture and credentialed-provider gates;
- fault injection, retry, replay, concurrency, and recovery evidence;
- typecheck, lint, optimized build, and diff checks;
- metadata-only operational evidence and runbook validation.

A passing build is not end-to-end evidence. User-visible claims must be supported by the state and persistence that produce them.

## UI Autonomy Gate

Before replacing a production surface:

1. identify the accepted visual reference and design tokens;
2. inventory loading, empty, partial, success, failure, retry, stale, conflict, unauthorized, and recovered states;
3. include representative long text and narrow viewport stress cases;
4. verify layout, overflow, hierarchy, contrast, focus, motion, and interaction behavior;
5. capture desktop and mobile evidence;
6. record reusable design-system changes and narrow exceptions;
7. keep subjective product meaning and major composition pivots inside the ratified design envelope.

Automated geometry and accessibility checks reduce review burden but do not replace milestone-level human judgment of taste.

## Git And Reversibility

- Start from a named accepted baseline.
- Keep internal commits coherent by contract.
- Do not mix unrelated cleanup with implementation.
- Preserve existing user changes and uncommitted work.
- Record migrations and rollback or forward-repair assumptions.
- Run the milestone pass before push or phase movement.
- Push only when the milestone contract grants that authority or the user confirms it.

## Milestone Completion

The lead agent returns:

- milestone outcome and commit range;
- internal slice and prior-behavior disposition summary;
- acceptance evidence;
- findings fixed during slice and milestone reviews;
- unresolved decisions;
- bounded deferrals with owner and trigger;
- untested areas and external dependencies;
- rollback or forward-repair posture;
- one verdict: `ready`, `conditional`, or `hold`.

Only a `ready` or explicitly accepted `conditional` milestone should become the next development baseline.
