# Project Charter: Interview Coach for Recruiters
 
## Document Control
 
| Version | Date       | Author  | Changes       |
|---------|------------|---------|-------------|
| 0.1     | 2025-01-29 | Fu Chen | Initial draft |
 
---
 
## 1. Project Overview
 
### 1.1 Project Name
**Interview Coach for Recruiters** (working title)
 
### 1.2 Project Summary
A standalone web application that enables recruiters at Rangam to invite job candidates to complete AI-powered mock screening interviews. The platform provides candidates with a supportive practice environment while giving recruiters visibility into candidate preparation and readiness.
 
### 1.3 Background & Context
This project originated from an interview coaching application developed for integration into a Medicaid member job portal (MCO partnership). The core interview simulation and AI feedback engine has been validated through internal testing.
 
This "Recruiter Path" extracts and adapts the proven interview flow for use by staffing company recruiters with a general candidate population (not limited to Medicaid members). It serves dual purposes:
1. **Immediate value**: A tool for recruiters to help candidates prepare for screening calls
2. **Validation**: UAT of the core mock interview flow and AI feedback quality
 
### 1.4 Strategic Alignment
- Differentiates Rangam from competitors by offering candidate preparation tools
- Reduces recruiter time spent on unprepared candidates
- Creates potential future revenue stream (MSP licensing, ATS integration)
- Demonstrates innovation capability to clients and partners
 
---
 
## 2. Objectives & Success Criteria
 
### 2.1 Business Objectives
 
| Objective | Measurable Outcome |
|-----------|--------------------|
| Improve candidate preparation | Recruiters report candidates are better prepared for screening calls |
| Increase recruiter efficiency | Reduction in "no-show" or poorly prepared screening calls |
| Validate core interview engine | AI feedback quality confirmed through recruiter/candidate feedback |
| Build reusable platform | Architecture supports future ATS integration and MSP licensing |
 
### 2.2 Success Metrics
 
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Candidate completion rate | ≥ 60% | Sessions completed / invites sent |
| Recruiter adoption | ≥ 40% of Pilot Group | Weekly active users (1+ invite sent) |
| Candidate satisfaction | ≥ 4.2/5 rating | Post-session survey |
| Recruiter satisfaction | ≥ 4.0/5 rating | Monthly survey |
| **Time to Invite** (Efficiency) | < 2 minutes | Time from login to link generation |
| **Feedback Utility** (Quality) | ≥ 80% Positive | "Did this feedback help you?" (Yes/No) |
 
### 2.3 Non-Goals (Explicit Exclusions)
 
- [ ] Integration with external ATS systems (future phase)
- [ ] Candidate account management / profile building
- [ ] Resume analysis or optimization
- [ ] Job matching or recommendations
- [ ] Medicaid-specific compliance requirements
- [ ] MCO reporting and engagement tracking complexity
- [ ] White-labeling for external clients
 
---
 
## 3. Scope
 
### 3.1 In Scope
 
**Recruiter Capabilities:**
- [ ] Create and configure interview practice sessions
- [ ] Generate shareable invite links for candidates
- [ ] View list of invited candidates and their status
- [ ] Review completed session results and AI feedback
- [ ] Access candidate readiness indicators (TBD: scope of signals)
 
**Candidate Capabilities:**
- [ ] Access practice session via invite link (no account required)
- [ ] Complete AI-powered mock screening interview
- [ ] Receive real-time feedback on responses
- [ ] Review session summary and improvement suggestions
 
**Platform Capabilities:**
- [ ] Role-based access (Recruiter vs Candidate)
- [ ] Session configuration (role type, question count, difficulty)
- [ ] AI-generated competency-based questions
- [ ] Voice and text input for responses
- [ ] AI analysis and structured feedback
- [ ] Session persistence and retrieval
 
### 3.2 Out of Scope (V1)
 
- Batch invite management (V1.1)
- Custom question templates (V1.1)
- Team/organization management (V1.1)
- Analytics dashboard for recruiters (V1.1)
- ATS integration (V2)
- White-label/branding options (V2)
- Mobile native apps (evaluate post-V1)
 
---
 
## 4. Stakeholders
 
| Stakeholder | Role | Interest | Influence | Engagement Level |
|-------------|------|----------|-----------|------------------|
| [Nish] | Project Sponsor | Strategic direction, budget | High | Inform |
| [Fu] | Product Owner | Requirements, priorities | High | Collaborate |
| Recruiting Team Lead | Primary User Rep | Usability, adoption | High | Collaborate |
| Recruiters | End Users | Daily usability | Medium | Consult |
| Candidates | End Users | Experience quality | Medium | Test |
| IT/Security | Technical oversight | Compliance, security | Medium | Consult |
| [Fu] | Developer | Technical implementation | High | Responsible |
 
---
 
## 5. Constraints & Assumptions
 
### 5.1 Constraints
 
| Constraint | Impact | Mitigation |
|------------|--------|------------|
| Single developer | Limited velocity | Prioritize ruthlessly, reuse existing code |
| No dedicated UX designer | Design quality risk | Use existing design system, validate with users |
| Budget for AI API calls | Cost management | Monitor usage, implement rate limiting |
 
### 5.2 Assumptions
 
| Assumption | If False... |
|------------|-------------|
| Recruiters will adopt a new tool | Need change management / training |
| Candidates will complete sessions | Need to optimize for completion |
| Existing AI feedback quality is sufficient | Need additional prompt engineering |
| Voice input works reliably | Need robust text fallback |
| Magic links are secure enough | May need account requirement |
 
---
 
## 6. Risks
 
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low recruiter adoption | Medium | High | Early involvement, training, quick wins |
| Poor candidate completion rates | Medium | Medium | Optimize UX, clear expectations, mobile-friendly |
| AI feedback quality issues | Low | High | Eval framework, prompt iteration, human review |
| Security vulnerabilities | Low | High | Security review, penetration testing |
| Scope creep | High | Medium | Strict change control, documented scope |
 
---
 
## 7. High-Level Timeline
 
| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Discovery & Design** | 1 week | Charter, Personas, User Stories, Wireframes |
| **Architecture & Setup** | 1 week | Technical design, infrastructure, CI/CD |
| **Core Development** | 4 weeks | MVP features, integration |
| **Testing & QA** | 1 week | UAT, bug fixes, security review |
| **Pilot Launch** | 2 weeks | Limited rollout to select recruiters |
| **Full Launch** | TBD | General availability |
 
---
 
## Appendix A: Glossary
 
| Term | Definition |
|------|------------|
| **Candidate** | Job seeker invited by a recruiter to practice |
| **Recruiter** | Rangam staff member who invites and reviews candidates |
| **Session** | A complete mock interview (multiple questions) |
| **Invite** | A shareable link that grants candidate access to a session |
| **Readiness Signal** | Indicator of candidate's preparation level (scope TBD) |
| **Competency Blueprint** | AI-generated framework of skills relevant to a role |
