## Documentation Index

> [!NOTE]
> ### Core Use Cases
> The primary enterprise use cases driving development are defined here:
> - **[UC-R0: Recruiter Login](02-requirements/use-cases/v2/UC-R0-Recruiter-Login.md)**
> - **[UC-R1: Recruiter Configures Session](02-requirements/use-cases/v2/UC-R1-Recruiter-Configures-an-Interview-Session.md)**
> - **[UC-R2: Recruiter Reviews Session](02-requirements/use-cases/v2/UC-R2-Recruiter-Reviews-a-Candidate-Interview-Session.md)**
> - **[UC-C1: Candidate Access](02-requirements/use-cases/v2/UC-C1-Candidate-Accesses-the-Interview-Session.md)**
> - **[UC-C2: Candidate Response](02-requirements/use-cases/v2/UC-C2-Candidate-Responds-to-a-Question.md)**
> - **[UC-C4: Feedback & Retry](02-requirements/use-cases/v2/UC-C4-Candidate-Reviews-AI-Feedback-and-Retries.md)**
> - **[UC-C5: Session Summary](02-requirements/use-cases/v2/UC-C5-Candidate-Views-Session-Summary-and-Concludes.md)**

This folder contains all project documentation for Interview Coach for Recruiters. Documents are organized to support discovery, requirements, architecture, quality, and delivery, with explicit status indicators to prevent ambiguity as the system evolves.

---

## Recommended Reading Order

### Project & Context

1. [Project README](01-project/README.md) - Entry point for charter, stakeholder, PRD, and handoff artifacts
2. [Project Charter](01-project/project-charter.md) - Why we are building this
3. [Stakeholder Map](01-project/stakeholder-map.md) - Who is involved and why

### Requirements & Users

4. [Recruiter Persona](02-requirements/personas/recruiter-persona.md) - Primary user
5. [Candidate Persona](02-requirements/personas/candidate-persona.md) - End user
6. [User Stories](02-requirements/user-stories.md) - What the system must support

### Architecture (System Contracts)

7. [Architecture Overview](04-architecture/architecture-overview.md) - System shape and intent
8. [End-to-End Flow](04-architecture/e2e-flow.md) - Full technical walkthrough of the recruiter-to-candidate process
9. [State & Streaming Contract](04-architecture/state-and-streaming-contract.md) - Canonical state model and streaming rules
10. [API Surface](04-architecture/api-surface.md) - Client/server contract
11. [Code Organization & Layering](04-architecture/code-organization.md) - Structural boundaries
12. [Stability & Change Policy](04-architecture/stability-and-change-policy.md) - Governance for architectural evolution
13. [Design Gates](04-architecture/design-gates.md) - Change-review gates for meaningful system changes
14. [Gate Decisions](04-architecture/gate-decisions.md) - Stable decision log for trust-sensitive behaviors

### Quality & Release Readiness

15. [Quality README](05-quality/README.md) - Entry point for review, QA, and ops quality docs
16. [Comprehensive Code Review](05-quality/comprehensive_code_review.md) - Production-readiness assessment
17. [Production Remediation Plan (2026-03-25)](05-quality/production_remediation_plan_2026-03-25.md) - Execution plan for current hardening work
18. [Production Remediation Tracker (2026-03-25)](05-quality/production_remediation_tracker_2026-03-25.md) - Live status board for remediation oversight
19. [Release Gate Checklist](05-quality/release-gate-checklist.md) - Production go/no-go administration
20. [QA Checklist](05-quality/QA-checklist.md) - Product-level quality gates

### Delivery Artifacts

21. Use Cases - Concrete scenarios derived from user stories
22. User Flows - Step-by-step interaction paths
23. Wireframes - UI structure and layout
24. Project Docs - PRD, handoff, and planning artifacts

---

### Document Status

| Document | Status | Stability | Last Updated |
|----------|--------|-----------|--------------|
| Project Charter | Draft | Stable Narrative | 2026-01-29 |
| Stakeholder Map | Draft | Stable Narrative | 2026-01-29 |
| Project Docs | In Progress | Working Artifacts | Varies |
| Recruiter Persona | Draft | Stable Narrative | 2026-01-29 |
| Candidate Persona | Draft | Stable Narrative | 2026-01-29 |
| User Stories | Draft | Stable Narrative | 2026-03-20 |
| Architecture Overview | Complete | Stable Narrative | 2026-01-31 |
| State & Streaming Contract | Locked | Contract (V1) | 2026-01-31 |
| API Surface | Locked | Contract (V1) | 2026-01-31 |
| Code Organization & Layering | Complete | Structural Guidance | 2026-01-31 |
| Stability & Change Policy | Locked | Governance | 2026-01-31 |
| Design Gates | Complete | Governance | 2026-01-30 |
| Gate Decisions | Locked | Governance Record | 2026-01-30 |
| Use Cases | Complete | Enterprise Template | 2026-03-12 |
| User Flows | In Progress | Working Design | Varies |
| Wireframes | In Progress | Working Design | Varies |
| Quality Docs | In Progress | Mixed | Varies |

---

## Notes

- Documents marked `Locked` require a gate decision update for material changes.
- Architecture documents define constraints that downstream artifacts must respect.
- Quality documents determine whether the implementation is fit to ship and operate.
- Project docs contain planning and handoff materials rather than system contracts.
