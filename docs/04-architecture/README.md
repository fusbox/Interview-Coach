# Architecture Documentation

This folder explains how the system is structured, where architectural boundaries live, and which documents describe current implementation versus future-state direction.

Use this section when you need to:
- understand the current system shape
- reason about client/server/data ownership
- check architectural constraints before changing behavior
- distinguish live contracts from aspirational architecture

---

## How To Read This Section

Start with the current implementation docs first. Use future-state references only when you are explicitly evaluating longer-term evolution.

Recommended starting order:

1. [architecture-overview.md](./architecture-overview.md)
2. [code-organization.md](./code-organization.md)
3. [api-surface.md](./api-surface.md)
4. [e2e-flow.md](./e2e-flow.md)

Then add design-state docs for session flow:

5. [../03-design/ROUTING_AND_RENDERING.md](../03-design/ROUTING_AND_RENDERING.md)
6. [../03-design/SCREEN_STATE_MODEL.md](../03-design/SCREEN_STATE_MODEL.md)

---

## Document Map

### Current implementation references

#### [architecture-overview.md](./architecture-overview.md)
High-level mental model for the current app.

#### [code-organization.md](./code-organization.md)
Layering and responsibility guidance for the current repo.

#### [api-surface.md](./api-surface.md)
Current implemented route surface and access rules.

#### [e2e-flow.md](./e2e-flow.md)
End-to-end journey from recruiter invite creation through candidate practice.

#### [../03-design/ROUTING_AND_RENDERING.md](../03-design/ROUTING_AND_RENDERING.md)
Current route-vs-screen boundary for the live session experience.

#### [../03-design/SCREEN_STATE_MODEL.md](../03-design/SCREEN_STATE_MODEL.md)
Canonical state-driven screen model used by the candidate session experience.

### Governance and change control

#### [stability-and-change-policy.md](./stability-and-change-policy.md)
How architecture docs should be changed and which ones are current contract versus reference.

#### [design-gates.md](./design-gates.md)
Review gates for meaningful system changes.

#### [gate-decisions.md](./gate-decisions.md)
Decision ledger for trust-sensitive behavior changes.

### Target-state or future-evolution references

#### [state-and-streaming-contract.md](./state-and-streaming-contract.md)
Future-state architecture reference. Useful for long-term evolution discussion, but not the live implementation contract.

#### [vertical-slice-contracts.md](./vertical-slice-contracts.md)
Walking-skeleton / target-state reference for an earlier projection-oriented architecture direction.

### ADRs

#### [adr-rate-limit-backend.md](./adr-rate-limit-backend.md)
Accepted decision for rate-limit backend hardening.

#### [adr-invite-batch-consistency.md](./adr-invite-batch-consistency.md)
Proposed decision for invite-batch consistency behavior.

#### [adr-application-boundaries.md](./adr-application-boundaries.md)
Proposed decision for application-service extraction patterns.

---

## Recommended Reading Paths

### For onboarding

- [architecture-overview.md](./architecture-overview.md)
- [code-organization.md](./code-organization.md)
- [api-surface.md](./api-surface.md)
- [e2e-flow.md](./e2e-flow.md)

### For feature implementation

- [code-organization.md](./code-organization.md)
- [api-surface.md](./api-surface.md)
- [../03-design/ROUTING_AND_RENDERING.md](../03-design/ROUTING_AND_RENDERING.md)
- [../03-design/SCREEN_STATE_MODEL.md](../03-design/SCREEN_STATE_MODEL.md)

### For session lifecycle or resume changes

- [../03-design/SCREEN_STATE_MODEL.md](../03-design/SCREEN_STATE_MODEL.md)
- [../03-design/ROUTING_AND_RENDERING.md](../03-design/ROUTING_AND_RENDERING.md)
- [api-surface.md](./api-surface.md)
- [stability-and-change-policy.md](./stability-and-change-policy.md)

### For future-state architecture discussion

- [state-and-streaming-contract.md](./state-and-streaming-contract.md)
- [vertical-slice-contracts.md](./vertical-slice-contracts.md)
- [architecture-overview.md](./architecture-overview.md)
- [gate-decisions.md](./gate-decisions.md)

---

## Change Expectations

Not every document here has the same weight.

- Treat [api-surface.md](./api-surface.md), [../03-design/ROUTING_AND_RENDERING.md](../03-design/ROUTING_AND_RENDERING.md), and [../03-design/SCREEN_STATE_MODEL.md](../03-design/SCREEN_STATE_MODEL.md) as the most trustworthy current implementation references.
- Treat [gate-decisions.md](./gate-decisions.md) as the decision log for trust-sensitive behavior.
- Treat [state-and-streaming-contract.md](./state-and-streaming-contract.md) and [vertical-slice-contracts.md](./vertical-slice-contracts.md) as future-state references until implementation catches up.
