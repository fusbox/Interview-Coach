# Autonomous Milestone Template

Status: Reusable operating template
Last updated: 2026-07-26

Use this template inside the active milestone section of `HANDOFF.md`. Create a separate milestone artifact only when detailed evidence must remain available after the handoff is compacted.

## Outcome

One observable product or operational result.

## Canonical Inputs

- `HANDOFF.md`
- `SPEC.md`
- `DATA_CONTRACT.md`
- Applicable ADRs, subsystem contracts, tests, and current implementation
- Relevant V1/reference behavior, explicitly classified as `preserve`, `reinterpret`, `retire`, or `defer`

## Scope

- Included journeys:
- Included audiences:
- Included routes/services/data:
- Shared files:

## Exclusions

- Explicitly out of scope:
- Deferred product work:
- External dependencies not being solved:

## Durable Invariants

- Identity and ownership:
- State and persistence:
- Data lineage:
- Privacy and provider boundaries:
- Candidate-facing claims:

## Authority Envelope

- Agent may proceed:
- Agent may proceed and record:
- Agent must stop and ask:
- Dependency additions allowed:
- Push authority:
- Provider/cost budget:
- Maximum remediation loops:

## Internal Slice Map

| Slice | Outcome | Dependencies | Owner/worktree | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  | pending |  |

## State And Acceptance Matrix

| Journey/state | Expected behavior | Evidence | Status |
| --- | --- | --- | --- |
| Happy path |  |  | pending |
| Loading/pending |  |  | pending |
| Empty/first use |  |  | pending |
| Failure/retry |  |  | pending |
| Refresh/revisit |  |  | pending |
| Duplicate/concurrent |  |  | pending |
| Unauthorized/stale |  |  | pending |
| Mobile/reflow |  |  | pending |
| Keyboard/accessibility |  |  | pending |

## Escalation Triggers

- Product meaning conflict:
- Security/privacy/identity change:
- Durable schema or lineage change:
- External dependency unknown:
- Time/cost threshold:
- Validation failure threshold:

## Verification

- Focused tests:
- Broader suites:
- Database smokes:
- Browser/device checks:
- Accessibility:
- Provider/live gates:
- Typecheck/lint/build/diff:

## Completion Evidence

- Baseline and commit range:
- Contract landed:
- Findings fixed:
- Bounded deferrals:
- Untested areas:
- Rollback/forward-repair posture:
- Verdict:
