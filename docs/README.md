## Documentation Index

> [!IMPORTANT]
> ### Use Cases (v2) - Active Work
> We are currently migrating all use cases to a new enterprise template. Below are the individual flows:
> - **[UC-R0: Recruiter Login](02-requirements/use-cases/v2/UC-R0-Recruiter-Login.md)**
> - **[UC-R1: Recruiter Configures Session](02-requirements/use-cases/v2/UC-R1-Recruiter-Configures-an-Interview-Session.md)**
> - **[UC-R2: Recruiter Reviews Session](02-requirements/use-cases/v2/UC-R2-Recruiter-Reviews-a-Candidate-Interview-Session.md)**
> - **[UC-C1: Candidate Access](02-requirements/use-cases/v2/UC-C1-Candidate-Accesses-the-Interview-Session.md)**
> - **[UC-C2: Candidate Response](02-requirements/use-cases/v2/UC-C2-Candidate-Responds-to-a-Question.md)**
> - **[UC-C4: Feedback & Retry](02-requirements/use-cases/v2/UC-C4-Candidate-Reviews-AI-Feedback-and-Retries.md)**
> - **[UC-C5: Session Summary](02-requirements/use-cases/v2/UC-C5-Candidate-Views-Session-Summary-and-Concludes.md)**

This folder contains all project documentation for Interview Coach for Recruiters. Documents are organized to support discovery, requirements, architecture, and delivery, with explicit status indicators to prevent ambiguity as the system evolves.

---

## Recommended Reading Order

### Discovery & Context

1. [Project Charter](01-discovery/project-charter.md) — Why we are building this
2. [Stakeholder Map](01-discovery/stakeholder-map.md) — Who is involved and why

### Requirements & Users

3. [Recruiter Persona](02-requirements/personas/recruiter-persona.md) — Primary user
4. [Candidate Persona](02-requirements/personas/candidate-persona.md) — End user
5. [User Stories](02-requirements/user-stories.md) — What the system must support

### Architecture (System Contracts)

6. [Architecture Overview](04-architecture/architecture-overview.md) — System shape and intent
7. [State \& Streaming Contract](04-architecture/state-and-streaming-contract.md) — Canonical state model and streaming rules
8. [API Surface](04-architecture/api-surface.md) — Client/server contract
9. [Code Organization \& Layering](04-architecture/code-organization.md) — Structural boundaries
10. [Stability & Change Policy](04-architecture/stability-and-change-policy.md) — Governance for architectural evolution

### Delivery Artifacts (In Progress)
11. Use Cases — Concrete scenarios derived from user stories
12. User Flows — Step-by-step interaction paths
13. Wireframes — UI structure and layout
14. Implementation Plan — Vertical slices and build order

---

### Document Status

| Document                      | Status       | Stability            | Last Updated 
--------------------------------|--------------|----------------------|-------------
| Project Charter               | ✅ Draft    | Stable Narrative     | 2026-01-29
| Stakeholder Map               | ✅ Draft    | Stable Narrative     | 2026-01-29
| Recruiter Persona             | ✅ Draft    | Stable Narrative     | 2026-01-29
| Candidate Persona             | ✅ Draft    | Stable Narrative    | 2026-01-29
| User Stories                  | ✅ Draft    | Stable Narrative    | 2026-01-29
| Architecture Overview         | ✅ Complete | Stable Narrative    | 2026-01-31
| State & Streaming Contract    | 🔒 Locked   | Contract (V1)       | 2026-01-31
| API Surface                   | 🔒 Locked   | Contract (V1)       | 2026-01-31
| Code Organization & Layering  | ✅ Complete | Structural Guidance | 2026-01-31
| Stability & Change Policy     | 🔒 Locked   | Governance          | 2026-01-31
| Use Cases                     | ⚠️ Drafting (v2) | Enterprise Template | 2026-03-10
| User Flows                    | ⏳ Pending  | —                   | —
| Wireframes                    | ⏳ Pending  | —                   | —

---

## Notes

- Documents marked 🔒 Locked require a Design Gate Decision update for material changes.
- Architecture documents define constraints that downstream artifacts must respect.
- User flows, wireframes, and implementation plans should align to the contracts defined above.

