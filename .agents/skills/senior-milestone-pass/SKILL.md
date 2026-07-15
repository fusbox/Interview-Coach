---
name: senior-milestone-pass
description: Audit an integrated multi-slice milestone before commit, push, review, or movement into the next rebuild phase. Use when several individually valid changes now form an end-to-end workflow, shared module, data contract, migration set, or architectural boundary and need cross-slice correctness, drift, compatibility, and operational review.
---

# Senior Milestone Pass

Review the integrated result, not a stack of isolated slice summaries. A milestone can fail even when every slice passed alone.

## Priority Order

Use: product intent and safety, then durable invariants, repository evidence, approved architecture/specs, staged plans, and implementation. Surface plan drift instead of hiding it.

## Establish Scope

1. Identify the base commit, milestone commits and uncommitted changes, affected domains, migrations, routes, and user journeys.
2. Reconstruct the intended outcome from current specs, handoff, decision records, and prior implementation when relevant.
3. List explicit exclusions and unresolved external dependencies.
4. Map which slice introduced each durable contract and which consumers now rely on it.

## Integration Review

Audit these lenses with repository evidence:

- **Journey continuity:** entry, progress, interruption, recovery, completion, and destination work end to end.
- **Contract alignment:** types, API payloads, persistence, providers, read models, and UI use the same vocabulary and semantics.
- **State ownership:** one authoritative writer/read source exists for each state; temporary bridges do not silently become product truth.
- **Data lineage:** source actions, attempts/revisions, provider runs, feedback, completion, and projections remain traceable.
- **Failure composition:** partial success across boundaries is retryable and does not duplicate, strand, or misstate work.
- **Concurrency and idempotency:** claims are atomic where needed and valid across multiple app instances.
- **Identity/privacy:** every cross-route read and mutation proves ownership; sensitive data has deliberate URL, log, provider, and retention treatment.
- **Migration/compatibility:** new and existing records, migration ordering, rollback assumptions, fixtures, and temporary routes are accounted for.
- **Shared architecture:** shared modules are genuinely audience-neutral; candidate, invited, recruiter, admin, and QA differences stay in adapters.
- **Deprecation:** superseded code has a keep, remove, or retirement classification and no hidden callers.
- **Operations:** failures are diagnosable; configuration and local/preview/prod behavior do not accidentally diverge.
- **Verification:** tests cover cross-slice behavior, not only units; browser or DB smoke evidence exists where the contract requires it.

Use counterfactuals: duplicate requests, reordered responses, provider timeout after persistence, process termination, stale tabs, legacy records, unavailable dependencies, multi-instance races, and recovery on another browser/device.

## Findings And Remediation

Classify each finding as `fix before milestone`, `defer with owner/trigger`, or `decision required`. Fix high-confidence in-scope issues before recommending commit. Do not sweep unrelated debt into the milestone.

Update current specs, handoff/current-state summaries, phase status, risks, and archive/deprecation pointers when evidence changed.

## Verdict

Return one verdict:

- `ready`: no known milestone-blocking gap;
- `conditional`: safe to commit with named, bounded deferrals;
- `hold`: correctness, data, security, migration, or product meaning is unresolved.

Include the milestone contract, highest-risk findings, verification evidence, untested areas, plan drift, and recommended next slice order.
