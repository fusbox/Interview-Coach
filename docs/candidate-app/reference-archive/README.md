# Candidate App Reference Archive

Status: Historical reference
Last updated: 2026-07-18

This folder holds useful but non-current candidate app material.

Use these files to understand V1 behavior, earlier candidate-module planning, or migration history. Do not treat them as current execution instructions for the cleanroom `/candidate/*` rebuild.

## Architecture References

- [Handoff Pre-Compaction Snapshot](handoff-pre-compaction-2026-07-12.md): full detailed handoff and completed-slice ledger before the active handoff was compressed into a resumption contract.
- [Handoff Pre-Compaction Snapshot, 2026-07-18](handoff-pre-compaction-2026-07-18.md): Slices 85-133, the production host-launch/evaluator/Coach Update milestone, full phase narrative, and the open-risk ledger before the second compaction.
- [Current Foundation](architecture/current-foundation.md): earlier standalone candidate repo foundation notes.
- [Candidate-Driven Implementation Plan](architecture/candidate-driven-implementation-plan.md): pre-cleanroom shared-host plan.
- [Practice Session Draft Contract](architecture/practice-session-draft-contract.md): server-backed `/practice` draft model from the V1/interim candidate app.
- [Postgres Candidate Data Contract](architecture/postgres-candidate-data-contract.md): earlier candidate Postgres contract centered on V1 drafts/sessions.
- [Candidate Session Engine Port Plan](architecture/session-engine-port-plan.md): V1 session-engine reuse inventory.

## SQL References

- [V1 master query](sql/master_query.v1.sql): old inspection query for `/practice` through `/summary` data. It is not the current V2 `candidate_practice_sessions` inspection query.

## Active Docs

Current local setup lives in [Local Dev Bootstrap](../09-dev/local-dev-bootstrap.md).

Current execution state lives in [HANDOFF](../HANDOFF.md).
