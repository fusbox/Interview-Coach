# Stability & Change Policy

## Purpose

This document defines how architecture artifacts are stabilized, evolved, and governed over time.

Its goals are to:
- prevent silent architectural drift
- make intentional change explicit and auditable
- distinguish current implementation truth from future-state thinking
- clarify when a doc change is routine versus architecture-significant

---

## Core Principle

Not all documents are equal.

Some documents describe the live system and should stay accurate enough to support implementation. Others preserve future-state or exploratory thinking and should not be mistaken for current truth.

The level of rigor applied to a change depends on what the document currently claims to represent.

---

## Document Stability Levels

### 1. Current implementation contract

These documents are intended to describe the live app and should be kept aligned with shipped behavior.

Characteristics:
- define route and interaction boundaries that currently exist
- support current engineering work
- are safe to use as the baseline for new app bootstrapping

Change policy:
- update promptly when implementation changes
- do not use them to document speculative future architecture
- behavioral changes with trust/privacy implications should still be reflected in gate decisions

Current documents:
- `api-surface.md`
- `../03-design/ROUTING_AND_RENDERING.md`
- `../03-design/SCREEN_STATE_MODEL.md`

### 2. Stable narrative

These documents describe the current system at a higher level.

Characteristics:
- explain intent and structure
- support onboarding and reasoning
- should remain accurate but are not the only source of truth

Change policy:
- may be updated as the system evolves
- must not contradict current implementation contract docs

Current documents:
- `architecture-overview.md`
- `e2e-flow.md`

### 3. Structural guidance

These documents guide where code belongs and how contributors should think about boundaries.

Characteristics:
- socially enforced through review and discipline
- intended to reduce sprawl and coupling

Change policy:
- may evolve with team learning
- significant shifts should be discussed when they affect maintainability or cross-layer coupling

Current documents:
- `code-organization.md`

### 4. Governance and decision ledger

These documents record higher-scrutiny decisions and review expectations.

Change policy:
- decision records are append-only in spirit
- supersede by annotation rather than silent rewrite when possible

Current documents:
- `gate-decisions.md`
- `design-gates.md`

### 5. Future-state reference

These documents preserve target-state architecture or earlier architectural aspirations that are not fully implemented in the live app.

Characteristics:
- useful for long-term design thinking
- unsafe to treat as present-day implementation truth

Change policy:
- may remain in the repo if clearly labeled
- must not be presented as current contract docs

Current documents:
- `state-and-streaming-contract.md`
- `vertical-slice-contracts.md`

---

## What Requires Higher-Scrutiny Update

A change deserves higher scrutiny if it affects:
- access or visibility boundaries
- privacy or data-retention behavior
- recruiter interpretation versus raw evidence boundaries
- resumability guarantees
- current route/auth/session ownership model

If the behavior changes materially, update:
- the current implementation docs
- any relevant gate/decision docs

---

## What Does Not Need Formal Escalation By Default

- cosmetic wording improvements
- framework-specific cleanup when intent stays the same
- explanatory updates that bring narrative docs back in line with implementation
- historical cleanup that removes stale references without changing live behavior

---

## Review Heuristic

When uncertain, ask:

> Is this doc describing what the app does now, or what we once hoped it would become later?

If the answer is "later," it should not be labeled or read as a current contract.

---

## Related Documents

- [README.md](./README.md)
- [api-surface.md](./api-surface.md)
- [gate-decisions.md](./gate-decisions.md)
- [../03-design/ROUTING_AND_RENDERING.md](../03-design/ROUTING_AND_RENDERING.md)
- [../03-design/SCREEN_STATE_MODEL.md](../03-design/SCREEN_STATE_MODEL.md)
