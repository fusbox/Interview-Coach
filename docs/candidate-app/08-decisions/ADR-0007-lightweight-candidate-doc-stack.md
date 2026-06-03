# ADR-0007: Lightweight Candidate Documentation Stack

Date: 2026-06-01
Status: Accepted

## Context

The candidate integration effort has accumulated detailed working docs across product scope, dashboard design, data inventory, preparedness modeling, architecture, security, quality, and Azure operations.

Those docs remain useful, but the active development loop needs a smaller set of context anchors so AI-assisted sessions do not require re-reading the entire documentation tree and do not drift between product intent, data truth, and execution state.

## Decision

Adopt a four-part active documentation stack under `docs/candidate-app`:

- `SPEC.md` - product intent, route/user-flow boundaries, candidate-facing claims, and non-goals.
- `DATA_CONTRACT.md` - data vocabulary, schema/payload/state naming, `prepProfile`, preparedness lanes, signal states, and privacy-sensitive data rules.
- `HANDOFF.md` - ephemeral execution state, completed work, current context, immediate next step, and risks.
- `08-decisions/` - immutable ADRs for durable why-decisions.

Existing detailed docs remain available as reference until a release milestone. They should be treated as supporting material when they conflict with the active stack.

## Consequences

Benefits:

- Lower turn-to-turn context load.
- Clearer separation between product intent, system truth, execution state, and decision history.
- Reduced risk that old disposable specs or inventory notes override newer product decisions.
- Easier handoff across AI sessions and human reviewers.

Tradeoffs:

- The active stack must be kept current or it will become another layer of drift.
- Detailed docs still need light banners or links so readers know which source is canonical.
- Some duplication is acceptable during the transition to avoid deleting useful release-before-milestone context.

## Operating Rule

For candidate app implementation:

1. Read `SPEC.md` before broadening product behavior.
2. Read `DATA_CONTRACT.md` before changing schema, payload, state, or dashboard claim sources.
3. Read `HANDOFF.md` before choosing the next implementation slice.
4. Check ADRs before cross-cutting changes.
