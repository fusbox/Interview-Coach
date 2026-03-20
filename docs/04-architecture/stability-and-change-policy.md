# Stability & Change Policy

## Purpose

This document defines how architectural artifacts are stabilized, evolved, and governed
over time.

Its goals are to:
- Prevent silent architectural drift
- Make intentional change explicit and auditable
- Balance flexibility with trust, security, and correctness
- Clarify when a change requires formal review versus routine iteration

This policy applies to all architecture-level documentation and the system behaviors they describe.

---

## Core Principle

**Not all documents are equal.**

Some documents define *meaning and authority* and must be treated as contracts.
Others describe *current structure* and may evolve more freely.

The level of rigor applied to a change depends on what the change affects—not who makes it
or how urgent it feels.

---

## Document Stability Levels

### 1. Locked for V1 (Contract Documents)

These documents define **system meaning, authority boundaries, or trust guarantees**.

They must not be changed casually.

**Characteristics**
- Define who owns truth
- Define what is persisted vs derived
- Define access, visibility, and interpretation boundaries
- Define guarantees such as “resume exactly” or privacy constraints

**Change Policy**
- Changes require a **Gate Decision entry**
- Relevant gates (Spec, Eval, Threat) should be re-evaluated
- Changes should be backward-compatible where possible, or explicitly versioned

**Current Documents**
- `state-and-streaming-contract.md`
- `api-surface.md`

---

### 2. Stable Narrative (Descriptive Architecture)

These documents describe the system at a high level but do not themselves define authority.

They should remain accurate but may be updated as the system evolves.

**Characteristics**
- Explain intent and structure
- Support onboarding and reasoning
- Do not introduce new constraints on their own

**Change Policy**
- May be updated to reflect accepted decisions
- Must not contradict Gate Decisions or Contract Documents
- Do not require Gate Decision updates unless reflecting a behavioral change

**Current Documents**
- `architecture-overview.md`

---

### 3. Structural Guidance (Engineering Discipline)

These documents guide how code is organized and how contributors should think about boundaries.

They are enforced socially (code review, design review), not through gates.

**Characteristics**
- Define layering and responsibility expectations
- Help prevent entropy and coupling
- Support long-term maintainability

**Change Policy**
- May evolve as the team gains experience
- Significant boundary changes should be discussed, but do not require Gate Decisions
  unless they alter system authority or trust

**Current Documents**
- `code-organization.md`

---

### 4. Decision Ledger (Always Append-Only)

The decision ledger records **why** the system is allowed to behave in certain ways.

It is never “locked,” but it is never rewritten.

**Characteristics**
- Append-only
- Historical record of reasoning
- Source of truth for architectural intent

**Change Policy**
- New decisions are appended
- Superseded decisions are annotated, not deleted
- Every entry includes scope, decision, rationale, and date

**Current Documents**
- `gate-decisions.md`

---

## What Requires a Gate Decision Update

A change requires a Gate Decision entry if it affects any of the following:

- **Access**
  - Who can see or modify data
  - How invite tokens or authentication work

- **Interpretation**
  - How readiness or outcomes are framed
  - Whether the system emits judgments, rankings, or recommendations

- **Persistence**
  - What facts are stored
  - What conclusions are derived
  - Where aggregation occurs (client vs server)

- **Comparability**
  - Any new ability to compare candidates or sessions

- **Guarantees**
  - Resume semantics
  - Privacy or data-retention posture
  - Determinism or reproducibility claims

If a change touches one or more of these areas, it must be recorded.

---

## What Does *Not* Require a Gate Decision

The following do **not** require Gate Decision updates on their own:

- UI layout or styling changes
- Performance optimizations that preserve behavior
- Refactoring that preserves authority boundaries
- Adding new additive API fields or events without semantic change
- Tooling, build, or deployment changes

---

## Review Heuristic

When uncertain, apply this test:

> “Would this change surprise a recruiter, candidate, or auditor if they understood the system’s intent?”

If the answer is “yes,” the change deserves a Gate Decision entry.

---

## Intentional Flexibility

This policy is designed to:
- Encourage experimentation within safe bounds
- Make high-impact decisions visible
- Avoid both paralysis and accidental overreach

The goal is not rigidity—it is **clarity under change**.

---

## Related Documents

- Architecture Overview
- State & Streaming Contract
- API Surface
- Code Organization & Layering
- Gate Decisions
