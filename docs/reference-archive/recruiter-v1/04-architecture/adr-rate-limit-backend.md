# ADR: Shared Rate-Limit Backend

Status: Accepted  
Date: 2026-03-25  
Related review: [../05-quality/implementation-docs-alignment-review_2026-03-30.md](../05-quality/implementation-docs-alignment-review_2026-03-30.md)  

---

## Context

The current rate-limit implementation is process-local. It relies on in-memory state and therefore does not provide correct protection across:

- process restarts
- multiple server instances
- horizontally scaled environments

This is acceptable for local development but not acceptable as a production protection boundary.

The production-readiness review identified this as a P0 issue.

---

## Decision

Production and staging rate limits will be backed by a shared store.

The architecture will use:

1. A backend abstraction for rate-limit operations
2. A production backend backed by shared infrastructure
3. A memory backend retained only for local development and isolated test scenarios

The backend contract must support:

- deterministic key semantics
- TTL/window expiry
- restart-safe behavior
- consistent enforcement across instances

Selected backend:

1. Postgres via Supabase RPC-backed bucket consumption

Redis remains a possible future optimization, but Postgres/Supabase is the selected implementation for the current hardening wave because it reuses an existing production dependency and avoids introducing new infrastructure during remediation.

---

## Consequences

### Positive

- rate limiting becomes a real production control
- abuse and retry behavior become consistent across instances
- restart behavior no longer silently resets protections

### Negative

- more database-side implementation complexity than a Redis counter
- more environment and startup validation
- more operational surface area around migration rollout

### Constraints

- the production backend must be selected explicitly by environment
- memory backend must not be the default in production

---

## Implementation Direction

Introduce:

- `src/lib/server/rate-limit/backend.ts`
- `src/lib/server/rate-limit/types.ts`

Refactor:

- `src/lib/server/rate-limit.ts`

Apply first to:

- invite send routes
- invite resend routes
- any public or abuse-sensitive candidate routes currently using process-local throttling

---

## Validation Requirements

- multi-instance consistency tests
- TTL expiry tests
- restart behavior tests
- production env validation for backend configuration

---

## Open Questions

1. Do we want an explicit scheduled cleanup path for expired `rate_limit_buckets` rows, or is opportunistic overwrite sufficient for the current volume?
2. Should all throttles move at once, or should invite/auth-sensitive routes migrate first?

---

## Follow-Up

Once implemented, update:

- [../05-quality/ops_alert_policy.md](../05-quality/ops_alert_policy.md)
- [../05-quality/incident_runbook.md](../05-quality/incident_runbook.md)
- [../05-quality/production_remediation_tracker_2026-03-25.md](../05-quality/production_remediation_tracker_2026-03-25.md)
