## Documentation Index

> [!NOTE]
> ### Current Product Scope
> This repo is the recruiter-led Interview Coach app with a candidate practice experience entered via invite link.
> Recruiter-facing readiness interpretation is not part of the current shipped scope.

This folder contains project documentation for the current app. The docs are organized to support context, requirements, architecture, and quality, with an emphasis on present-day implementation clarity.

---

## Recommended Reading Order

### Project and context

1. [Project README](01-project/README.md)
2. [Project Charter](01-project/project-charter.md)
3. [Stakeholder Map](01-project/stakeholder-map.md)

### Requirements and users

4. [Recruiter Persona](02-requirements/personas/recruiter-persona.md)
5. [Candidate Persona](02-requirements/personas/candidate-persona.md)
6. [User Stories](02-requirements/user-stories.md)

### Current architecture and design contract

7. [Architecture README](04-architecture/README.md)
8. [Architecture Overview](04-architecture/architecture-overview.md)
9. [API Surface](04-architecture/api-surface.md)
10. [End-to-End Flow](04-architecture/e2e-flow.md)
11. [Routing and Rendering](03-design/ROUTING_AND_RENDERING.md)
12. [Screen State Model](03-design/SCREEN_STATE_MODEL.md)
13. [Code Organization](04-architecture/code-organization.md)
14. [Stability and Change Policy](04-architecture/stability-and-change-policy.md)

### Quality and release readiness

15. [Quality README](05-quality/README.md)
16. [Production Remediation Tracker](05-quality/production_remediation_tracker_2026-03-25.md)
17. [Production Execution Plan](05-quality/production_execution_plan_2026-03-26.md)
18. [Release Gate Checklist](05-quality/release-gate-checklist.md)
19. [QA Checklist](05-quality/QA-checklist.md)
20. [Implementation/Docs Alignment Review](05-quality/implementation-docs-alignment-review_2026-03-30.md)

---

## Document Status

| Document Area | Status | Notes |
|----------|--------|-------|
| Project docs | Active | Context and handoff artifacts |
| Requirements | Active | Current recruiter-led app scope |
| Current architecture docs | Active | Use for implementation decisions |
| Future-state architecture references | Reference only | Do not treat as live contract |
| Quality docs | Active | Mixed release, QA, and decision-support material |

---

## Notes

- Prefer current implementation docs over future-state references when making changes.
- If a doc and the code disagree, treat that as a cleanup task rather than assuming the doc wins automatically.
- Use the readiness docs only as reference unless recruiter-facing readiness is explicitly re-scoped back into the product.
