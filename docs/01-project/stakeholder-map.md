# Stakeholder Map
 
## Document Control
 
| Version | Date       | Author  | Changes       |
|---------|------------|---------|---------------|
| 0.1     | 2025-01-29 | Fu Chen | Initial draft |
 
---
 
## 1. Primary Stakeholders (Direct Users)
 
### Recruiters (Internal)
| Attribute | Details |
|-----------|---------|
| **Who** | Rangam recruiting staff |
| **Count** | ~[20] recruiters |
| **Interest** | Tool that helps them place candidates faster |
| **Influence** | High (adoption determines success) |
| **Concerns** | Learning curve, time investment, candidate experience |
| **Needs** | Fast setup, clear results, reliable tool |
| **Engagement** | Collaborate (involve in design, pilot testing) |
 
### Candidates (External)
| Attribute | Details |
|-----------|---------|
| **Who** | Job seekers invited by recruiters |
| **Count** | Variable (depends on recruiter usage) |
| **Interest** | Better preparation, get the job |
| **Influence** | Medium (completion rates affect value) |
| **Concerns** | Time investment, privacy, usefulness |
| **Needs** | Easy access, helpful feedback, mobile-friendly |
| **Engagement** | Test (usability testing, feedback surveys) |
 
---
 
## 2. Secondary Stakeholders (Decision Makers)
 
### Project Sponsor
| Attribute | Details |
|-----------|---------|
| **Who** | [Nish/CEO] |
| **Interest** | ROI, strategic differentiation, innovation showcase |
| **Influence** | High (budget, go/no-go decisions) |
| **Concerns** | Cost, timeline, demonstrable value |
| **Needs** | Clear metrics, progress visibility |
| **Engagement** | Inform (regular updates, milestone reviews) |
 
### Recruiting Leadership
| Attribute | Details |
|-----------|---------|
| **Who** | Recruiting Manager / Director |
| **Interest** | Team productivity, candidate quality, adoption |
| **Influence** | High (drives team adoption) |
| **Concerns** | Change management, training burden |
| **Needs** | Evidence of value, easy rollout plan |
| **Engagement** | Collaborate (requirements input, pilot coordination) |
 
---
 
## 3. Stakeholder Matrix (Power/Interest)
 
```
                    HIGH INTEREST
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         │   KEEP        │    MANAGE     │
         │  SATISFIED    │    CLOSELY    │
         │               │               │
         │  IT/Security  │  Sponsor      │
         │               │  Recruiting   │
   LOW   │               │  Leadership   │   HIGH
  POWER  ├───────────────┼───────────────┤  POWER
         │               │               │
         │   MONITOR     │    KEEP       │
         │               │   INFORMED    │
         │               │               │
         │  (none)       │  Recruiters   │
         │               │  Candidates   │
         │               │               │
         └───────────────┼───────────────┘
                         │
                    LOW INTEREST
```
 
---
 
## 4. RACI Matrix
 
| Decision | Responsible | Accountable | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Feature scope & priority | Product Owner | Sponsor | Recruiters | Dev |
| UX/UI design approval | Dev | Product Owner | Recruiters | Sponsor |
| Technical architecture | Dev | Dev | IT/Security | Product Owner |
| Go-live decision | Product Owner | Sponsor | Leadership, IT | All |
 
---
 
## 5. Open Questions
 
- [x] Who is the official Project Sponsor?
- [x] Who is the Product Owner (decision maker for requirements)?
- [ ] Which recruiters should be in the pilot group?
- [ ] What is the approval process for go-live?
