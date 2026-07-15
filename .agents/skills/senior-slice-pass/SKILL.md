---
name: senior-slice-pass
description: Review one implementation slice as a senior engineer before it is declared complete. Use for feature, refactor, bug-fix, schema, API, workflow, or UI slices where correctness depends on lifecycle state, data lineage, failure recovery, identity, privacy, or integration with adjacent behavior. Run before coding to frame risk and again after coding to find and fix in-scope gaps.
---

# Senior Slice Pass

Use this pass to anticipate defects the request did not name. It complements implementation; it is not permission to broaden scope silently.

## Priority Order

Resolve conflicts in this order:

1. Product intent and user safety
2. Durable invariants, ownership, and data integrity
3. Current architecture and repository evidence
4. Approved plans and specifications
5. Slice wording
6. Existing implementation

If new evidence contradicts a plan, name the conflict and recommend a correction. Do not implement known-bad behavior merely because it was planned.

## Before Implementation

1. Read the active product/working docs, adjacent contracts, tests, and current git state.
2. Inspect prior behavior when this is a rebuild or refactor. Classify it as `preserve`, `reinterpret`, `retire`, or `defer`.
3. State the slice goal, in-scope and out-of-scope boundaries, acceptance evidence, assumptions, and open product decisions.
4. Model the lifecycle: initial, draft, pending, successful, failed, retried, superseded, paused, resumed, and completed states that apply.
5. Trace important data from source action through persistence, provider/service use, read models, and user-visible effects.
6. Identify trust boundaries, sensitive data, ownership proof, and external dependencies.

## Counterfactual Review

Before completion, ask and verify the applicable questions:

- What if the same action is submitted twice, concurrently, or out of order?
- What if step A succeeds and step B fails? Can retry duplicate or corrupt A?
- What if the process stops after work is claimed but before completion is recorded?
- What survives refresh, navigation, a second tab, network loss, and later recovery?
- What happens with stale, malformed, unauthorized, deleted, or legacy data?
- What happens when a provider is slow, unavailable, returns invalid output, or succeeds after the client gives up?
- Can a user-visible claim be false during partial success?
- Can sensitive content reach URLs, logs, analytics, errors, or an unauthorized reader?
- Can existing callers, records, migrations, fixtures, or compatibility routes still work?
- Is the behavior observable enough to diagnose without reproducing it locally?

## Completion Gate

1. Add focused tests for state transitions and negative paths proportional to risk.
2. Run the repository's focused tests, broader relevant suite, typecheck/lint, build, and diff check as applicable.
3. Review the final diff for accidental scope, dead paths, stale docs, and unsupported claims.
4. Classify each finding:
   - `fix now`: required for this slice to be correct or not create near-term debt;
   - `defer`: name the reason, owner/phase, and trigger that makes it due;
   - `decision required`: implementation depends on unresolved product or architecture meaning.
5. Update the working/spec/handoff documents when the contract or risk picture changed.

Do not declare the slice complete with an unresolved `fix now` finding. Report what was not tested or audited.

## Output

Return: contract landed, prior-behavior disposition, findings and their classification, verification evidence, assumptions, and next risks. Keep findings ordered by product impact and likelihood.
