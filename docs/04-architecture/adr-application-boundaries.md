# ADR: Application-Service Boundary for Route Orchestration

Status: Proposed  
Date: 2026-03-25  
Related review: [../05-quality/comprehensive_code_review_2026-03-25.md](../05-quality/comprehensive_code_review_2026-03-25.md)

---

## Context

The current architecture already has useful separation between:

- domain contracts
- server/infrastructure code
- feature-level UI

However, several route handlers still perform substantial orchestration directly, including combinations of:

- auth and request parsing
- idempotency
- persistence
- provider side effects
- metrics and logging
- response shaping

This makes correctness, reuse, and failure-mode testing harder than necessary.

---

## Decision

The repository will introduce an explicit application-service layer for command and query orchestration.

The intended responsibility split is:

- `domain/*`
  - pure domain rules and invariants
- `lib/server/application/*`
  - command and query orchestration
  - idempotency policy
  - retry and compensation decisions
  - composition of repositories/providers
- `lib/server/infrastructure/*`
  - Supabase and provider adapters only
- `app/api/*`
  - auth
  - request parse/validate
  - application-service invocation
  - response serialization
- `features/*`
  - UX state and rendering only

This is a direction of travel, not a big-bang rewrite.

The invite flows will be the first extraction target and reference implementation.

---

## Consequences

### Positive

- route handlers become easier to reason about
- orchestration logic gets direct unit-test coverage
- cross-cutting concerns can be standardized more easily

### Negative

- temporary duplication risk during migration
- one more conceptual layer for contributors to understand

### Constraints

- do not move logic purely for aesthetics
- extraction should be done where it materially improves correctness, operability, or testability

---

## Implementation Direction

Create:

- `src/lib/server/application/`

First vertical slice:

- `src/lib/server/application/invites/*`

Migration rule:

- new route-level orchestration should not be added directly to routes if it mixes persistence and side effects

---

## Validation Requirements

- invite route handlers become thin enough to review quickly
- application-service tests cover failure modes without requiring full route tests for every branch
- repository adapters no longer encode application policy

---

## Open Questions

1. Should query handlers also move into `application/*` in the same pass, or only command handlers first?
2. Should metrics and logging wrappers be standardized before or after invite flow extraction?
3. How much existing UI orchestration should eventually move into hooks or services versus remain in feature components?

---

## Follow-Up

Once the first extraction lands, update:

- [code-organization.md](./code-organization.md)
- [api-surface.md](./api-surface.md)
- [stability-and-change-policy.md](./stability-and-change-policy.md) if the boundary becomes normative
