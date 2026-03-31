# ADR: Invite Batch Consistency Model

Status: Proposed  
Date: 2026-03-25  
Related review: [../05-quality/implementation-docs-alignment-review_2026-03-30.md](../05-quality/implementation-docs-alignment-review_2026-03-30.md)

---

## Context

Recruiter invite creation currently performs a multi-step, candidate-by-candidate flow that mixes:

- session persistence
- question persistence
- token creation
- provider side effects

This creates partial-success risk under mid-loop failure conditions. The production-readiness review identified this as a P0 issue.

The system needs a deterministic answer to:

> What does the system consider the batch outcome when one candidate row fails after others have already been written or sent?

---

## Decision

Invite creation will move to an application-command model with deterministic per-candidate outcomes.

The system will treat invite creation as:

1. A batch command with explicit per-candidate status
2. Persistence first, provider side effects second
3. A resumable and idempotent operation

The command result must model:

- batch status
- candidate row status
- session identifier
- retryability
- failure reason

Preferred consistency approach:

1. Persist all candidate/session artifacts first
2. Send emails second
3. Record send status per row

If database-level transactionality across all writes is not practical in the current stack, the fallback is:

- durable batch record
- resumable row-level status
- compensating/reconciliation behavior

The system must not rely on route-level sequential loops as the source of truth for batch progress.

---

## Consequences

### Positive

- deterministic failure handling
- cleaner idempotency semantics
- easier reconciliation and support triage

### Negative

- more application-layer complexity
- new result models and command abstractions
- larger test surface

### Constraints

- route handlers must become thin
- repository adapters must remain persistence-focused
- provider failure must not create ambiguous state

---

## Implementation Direction

Introduce:

- `src/lib/server/application/invites/create-invite-batch.ts`
- `src/lib/server/application/invites/types.ts`

Refactor:

- `src/app/api/recruiter/invites/route.ts`
- `src/lib/server/infrastructure/supabase-invite-repository.ts`

Later align:

- `src/app/api/invite/send/route.ts`
- `src/app/api/invite/resend/route.ts`

---

## Validation Requirements

- mid-batch persistence failure
- provider failure after persistence
- duplicate/idempotent retry behavior
- per-row reconciliation output

---

## Open Questions

1. Do we need a persisted batch table, or can current idempotency plus deterministic command output carry the first implementation?
2. Should resend use the same application-service pattern immediately, or follow after initial batch flow stabilization?
3. Is recruiter UI expected to surface partial batch outcomes directly in the first remediation pass?

---

## Follow-Up

Once implemented, update:

- [e2e-flow.md](./e2e-flow.md)
- [api-surface.md](./api-surface.md)
- [../05-quality/incident_runbook.md](../05-quality/incident_runbook.md)
- [../05-quality/production_remediation_tracker_2026-03-25.md](../05-quality/production_remediation_tracker_2026-03-25.md)
