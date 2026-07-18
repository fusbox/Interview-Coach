# Code Organization & Layering

## Purpose

This document defines **how code is organized and where responsibilities live**
to preserve architectural intent over time.

It exists to:
- Prevent logic sprawl and accidental coupling
- Support independent evolution of UI and domain logic
- Make ownership boundaries clear to contributors

This is a structural guide, not a style guide.

---

## Layering Model (Top to Bottom)

1. **Domain Layer** — what the system *is*
2. **Server Layer** — what the system *does*
3. **Data Layer** — what the system *stores*
4. **Client Layer** — how the system *feels*
5. **Presentation Layer** — what the user *sees*

Dependencies flow downward only.

---

## Domain Layer (`/lib/domain`)

**Responsibilities**
- Event definitions and envelopes
- State machine and transition rules
- Canonical schemas and invariants
- Readiness levels and semantic constants

**Rules**
- No framework imports (React, Next.js, Supabase)
- No I/O
- No environment assumptions

If this layer changes, it should be because system meaning changed.

---

## Server / Orchestration Layer (`/lib/server`)

**Responsibilities**
- Enforce state transitions
- Coordinate AI workflows
- Append events
- Compute projections

**Rules**
- Calls domain logic and repositories
- No React imports
- No direct HTTP handling

This layer embodies system behavior.

---

## Data Access Layer (`/lib/db`)

**Responsibilities**
- All database reads and writes
- Repository abstractions
- Row Level Security assumptions

**Rules**
- No business logic
- No HTTP or UI concerns
- No AI orchestration

If a query becomes complicated, it belongs here.

---

## AI Integration Layer (`/lib/ai`)

**Responsibilities**
- Model invocation
- Prompt management
- Schema validation
- Retry and failure policies

**Rules**
- No UI assumptions
- No persistence logic outside validated outputs
- No session state decisions

AI is treated as an external dependency, not a decision-maker.

---

## Streaming Layer (`/lib/stream`)

**Responsibilities**
- SSE channel creation
- Message formatting
- Publish helpers

**Rules**
- Streaming communicates progress
- Streaming never mutates state

---

## Client Utilities (`/lib/client`)

**Responsibilities**
- Local draft persistence
- Offline reconciliation
- Client-side stream consumption
- Lightweight telemetry

**Rules**
- No business logic
- No readiness computation
- No server orchestration

Client utilities support UX, not correctness.

---

## API Routes (`/app/api`)

**Responsibilities**
- Authentication and access checks
- Input parsing and validation
- Delegation to orchestrators
- Response shaping

**Rules**
- No business logic
- No database queries
- No AI calls directly

Routes are adapters, not owners.

---

## UI Components (`/app/(candidate)` and `/app/(recruiter)`)

**Responsibilities**
- Render UI
- Manage ephemeral UI state
- Call APIs and hooks

**Rules**
- No domain logic
- No state machine decisions
- No cross-session assumptions

If a component needs domain knowledge, it should receive it from a projection.

---

## Explicit Anti-Patterns

The following are considered architectural violations:

- Computing readiness or summaries in the client
- Writing directly to the database from UI code
- Calling AI APIs from API routes without orchestration
- Persisting interpretation instead of facts
- Allowing UI state to implicitly become system state

---

## Change Discipline

Structural changes to this organization should be:
- Explicit
- Documented
- Intentional

If a change feels convenient but hard to explain, it likely violates the architecture.

---

## Related Documents

- Architecture Overview
- State & Streaming Contract
- Gate Decisions
- Dashboard Constitution
