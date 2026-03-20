# Architecture Documentation

This folder explains how the system is structured, where architectural boundaries live, and which documents should be treated as guidance versus contract.

Use this section when you need to:
- understand the current system shape
- reason about client/server/data ownership
- check architectural constraints before changing behavior
- onboard into the codebase beyond feature-level docs

---

## How To Read This Section

Start here, then choose the document that matches your question:

1. Read [architecture-overview.md](./architecture-overview.md) for the high-level mental model.
2. Read [code-organization.md](./code-organization.md) to understand where responsibilities belong in the codebase.
3. Read the contract documents before changing session state, resume behavior, privacy boundaries, or client/server interaction patterns.

If you are making a behaviorally significant change, do not rely on the overview alone. Check the locked contract documents and the change policy.

---

## Document Map

### [architecture-overview.md](./architecture-overview.md)
Best starting point for most readers.

Covers:
- major system components
- how client, server, storage, and AI layers relate
- core architectural goals and boundaries

Read this when:
- you are new to the system
- you want the big picture before reading implementation details

### [code-organization.md](./code-organization.md)
Explains how the repository is layered and where logic should live.

Covers:
- domain vs server vs data vs client responsibilities
- dependency direction
- organizational rules that prevent logic sprawl

Read this when:
- you are adding or moving code
- you want to know the correct home for new logic

### [api-surface.md](./api-surface.md)
Defines the architectural API surface between clients and the server.

Covers:
- candidate and recruiter API responsibilities
- action-oriented route expectations
- streaming boundaries at the architectural level

Read this when:
- you are changing route behavior
- you are introducing new client/server interactions
- you need to check whether a concern belongs in transport, orchestration, or projection

### [state-and-streaming-contract.md](./state-and-streaming-contract.md)
Core contract for state ownership, persistence, resume behavior, and streaming semantics.

Covers:
- server-owned truth
- facts vs projections
- resumability guarantees
- streaming as transport rather than business logic

Read this when:
- you are changing session lifecycle behavior
- you are touching resume/hydration guarantees
- you are changing what is persisted versus derived

### [vertical-slice-contracts.md](./vertical-slice-contracts.md)
Defines the walking-skeleton contract for session hydration and minimal endpoint behavior.

Covers:
- `/now` projection shape
- minimal vertical-slice endpoint contracts
- assumptions that support progressive enhancement

Read this when:
- you are aligning implementation to the core session slice
- you want a concrete contract view to pair with the higher-level architecture docs

### [e2e-flow.md](./e2e-flow.md)
Describes the end-to-end journey from recruiter invite creation through candidate practice.

Covers:
- plain-language system flow
- route, API, and persistence touchpoints
- how major steps connect across the stack

Read this when:
- you want to trace the lifecycle of a session end to end
- you are debugging a cross-layer issue

### [stability-and-change-policy.md](./stability-and-change-policy.md)
Defines how architecture docs should be changed and which ones are effectively locked.

Covers:
- document stability levels
- which docs are contract documents
- when a change should trigger higher scrutiny

Read this when:
- you are planning an architectural change
- you are unsure whether a doc update is descriptive or contract-altering

### [design-gates.md](./design-gates.md)
Defines the review gates that meaningful system changes are expected to pass.

Covers:
- spec, evaluation, threat, performance, and observability gates
- required evidence for each gate
- default expectations for change review

Read this when:
- you are preparing a significant product or system change
- you want to know what evidence is expected before a change is considered done

### [gate-decisions.md](./gate-decisions.md)
Records stable gate decisions for trust-sensitive system behaviors.

Covers:
- decision scope rules
- active gate decisions and rationale
- system behaviors that are intentionally constrained

Read this when:
- you are changing a behavior that touches trust, privacy, interpretation, or authority boundaries
- you need to understand why a prior architectural decision exists

---

## Recommended Reading Paths

### For onboarding
Read in this order:
- [architecture-overview.md](./architecture-overview.md)
- [code-organization.md](./code-organization.md)
- [e2e-flow.md](./e2e-flow.md)

### For feature implementation
Read in this order:
- [code-organization.md](./code-organization.md)
- [api-surface.md](./api-surface.md)
- [vertical-slice-contracts.md](./vertical-slice-contracts.md)

### For session lifecycle or resume changes
Read in this order:
- [state-and-streaming-contract.md](./state-and-streaming-contract.md)
- [api-surface.md](./api-surface.md)
- [stability-and-change-policy.md](./stability-and-change-policy.md)

### For architecture review or governance
Read in this order:
- [stability-and-change-policy.md](./stability-and-change-policy.md)
- [design-gates.md](./design-gates.md)
- [gate-decisions.md](./gate-decisions.md)
- [state-and-streaming-contract.md](./state-and-streaming-contract.md)
- [architecture-overview.md](./architecture-overview.md)

---

## Change Expectations

Not every document in this folder has the same weight.

- Treat [state-and-streaming-contract.md](./state-and-streaming-contract.md) and [api-surface.md](./api-surface.md) as architectural contracts.
- Treat [gate-decisions.md](./gate-decisions.md) as the architectural decision log for trust-sensitive behavior changes.
- Treat [architecture-overview.md](./architecture-overview.md) and [e2e-flow.md](./e2e-flow.md) as descriptive narrative that should stay accurate but should not silently redefine system authority.
- Use [stability-and-change-policy.md](./stability-and-change-policy.md) when you are unsure how formally a change should be handled.
