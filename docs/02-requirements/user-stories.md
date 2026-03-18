# User Stories

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-01-29 | Fu Chen | Initial draft |

---

## Overview

User stories organized by persona, prioritized using MoSCoW (Must/Should/Could/Won't).

**Format:** As a [persona], I want [goal] so that [benefit].

---

## Epic 1: Recruiter Invite Management

### US-1.1: Create Interview Invite ⭐ MUST
>
> As a **Recruiter**, I want to **create an interview practice invite** so that **I can send it to a candidate**.

#### Acceptance Criteria

- [x] Recruiter can paste the job description
- [x] Recruiter can optionally select the job role from a predefined list
  *(NOTE: Implemented template creation for easy reuse of question sets by role)*
- [x] Recruiter can optionally customize session settings (question count, difficulty)
  *(NOTE: Difficulty config now out of scope for this phase)*
- [x] System generates a unique, shareable link
- [x] Link is easy to copy to clipboard
  *(NOTE: Now addressed with in-app email service for send/resend)*
- [x] Invite is saved to recruiter's invite list

---

### US-1.2: View Invite List ⭐ MUST
>
> As a **Recruiter**, I want to **see a list of invites I've created** so that **I can track which candidates I've sent practice sessions to**.

#### Acceptance Criteria

- [x] Recruiter sees a list of all invites they've created
- [x] Each invite shows: role, creation date, status (pending/completed/expired)
- [x] List is sorted by most recent first
  *(NOTE: All table columns fully sortable)*

---

### US-1.3: View Invite Status ⭐ MUST
>
> As a **Recruiter**, I want to **see if a candidate has completed their practice session** so that **I know whether to follow up or proceed with screening**.

#### Acceptance Criteria

- [x] Each invite shows current status: Not Started, In Progress, Completed
- [x] Completed invites show completion timestamp

---

### US-1.4: Resend/Copy Invite Link 📋 SHOULD
>
> As a **Recruiter**, I want to **resend an invite link** so that **I can follow up with candidates who haven't started**.

---

## Epic 2: Recruiter Session Review

### US-2.1: View Completed Session Summary ⭐ MUST
>
> As a **Recruiter**, I want to **see the transcript of a candidate’s responses** so that **I can quickly assess readiness and decide how to proceed with screening**.

#### Acceptance Criteria

- [ ] Recruiter can open results for any completed session
- [ ] Summary is understandable in ≤ 30 seconds
- [ ] Summary includes exactly one primary readiness indicator
- [ ] Summary does not display numeric scores, percentages, grades, or rankings

**Primary Readiness Indicator**

- [ ] Displayed as a categorical band, one of:
  - Ready
  - Strong Potential
  - More Practice Recommended
  - Incomplete
- [ ] Category definitions are consistent across all sessions
- [ ] Indicator language emphasizes preparation, not assessment or hiring decisions

**Supporting Signals (Structured, Non-Numeric)**

- [ ] Display 2–3 short descriptors summarizing observed patterns
- [ ] Descriptors are written in plain language (≤ 8 words each)
- [ ] Descriptors reflect communication quality and preparedness, not “pass/fail”
- [ ] Descriptors are generated using a constrained template (not free-form)

**Descriptive Summary (Progressive Disclosure)**

- [ ] Recruiter can optionally expand to view a short narrative summary
- [ ] Narrative focuses on:
  - Strengths demonstrated
  - Areas to probe in live screening
- [ ] Narrative avoids evaluative language like “score,” “rating,” or “grade”

**Explicit Exclusions**

- [ ] No overall numeric score
- [ ] No per-question numeric scores
- [ ] No comparative ranking between candidates
- [ ] No hiring recommendations or submission decisions

---

### US-2.2: View Detailed Question Results 📋 SHOULD
>
> As a **Recruiter**, I want to **see how a candidate answered each question** so that **I can identify specific strengths and areas to probe**.

---

### US-2.3: Export/Share Results 💭 COULD
>
> As a **Recruiter**, I want to **export or share session results** so that **I can include them in candidate files**.

---

## Epic 3: Candidate Session Access

### US-3.1: Access Session via Link ⭐ MUST
>
> As a **Candidate**, I want to **access my practice session by clicking a link** so that **I don't need to create an account**.

**Acceptance Criteria:**

- [ ] Candidate clicks link and lands on session start page
- [ ] No account creation required
- [ ] Page clearly shows what to expect (time, purpose)
- [ ] Works on mobile and desktop browsers

---

### US-3.2: Understand What This Is ⭐ MUST
>
> As a **Candidate**, I want to **understand what this practice session is and how it will help me** so that **I feel confident proceeding**.

**Acceptance Criteria:**

- [ ] Landing page explains: what this is, how long it takes, how it helps
- [ ] Clear that this is practice, not a test
- [ ] Shows who sent the invite (recruiter/Rangam branding)
- [ ] Privacy information is accessible

---

### US-3.3: Start Practice Session ⭐ MUST
>
> As a **Candidate**, I want to **start my practice session** so that **I can begin preparing**.

---

## Epic 4: Candidate Interview Practice

### US-4.1: View Interview Question ⭐ MUST
>
> As a **Candidate**, I want to **see the interview question clearly** so that **I can think about my answer**.

---

### US-4.2: Answer via Voice ⭐ MUST
>
> As a **Candidate**, I want to **answer questions by speaking** so that **I can practice realistic verbal responses**.

**Acceptance Criteria:**

- [ ] Clear microphone button to start recording
- [ ] Visual indicator that recording is active
- [ ] Ability to stop recording when done
- [ ] Confirmation before submitting answer
- [ ] Graceful handling of microphone permission denial

---

### US-4.3: Answer via Text ⭐ MUST
>
> As a **Candidate**, I want to **type my answer if I can't use voice** so that **I can still complete the practice**.

---

### US-4.4: Receive Feedback on Answer ⭐ MUST
>
> As a **Candidate**, I want to **receive feedback after each answer** so that **I can learn and improve**.

**Acceptance Criteria:**

- [ ] Feedback displayed after answer submission
- [ ] Feedback is constructive and actionable
- [ ] Feedback identifies strengths and areas to improve
- [ ] Tone is encouraging, not judgmental

---

### US-4.5: Redo an Answer 📋 SHOULD
>
> As a **Candidate**, I want to **redo an answer if I'm not satisfied** so that **I can practice until I feel confident**.

---

### US-4.6: See Progress Through Session ⭐ MUST
>
> As a **Candidate**, I want to **see how many questions remain** so that **I can pace myself**.

---

### US-4.7: Pause and Resume Session 📋 SHOULD
>
> As a **Candidate**, I want to **pause and come back later** so that **I can complete the session even if interrupted**.

---

## Epic 5: Candidate Session Completion

### US-5.1: Complete Session ⭐ MUST
>
> As a **Candidate**, I want to **finish my practice session** so that **the recruiter knows I've prepared**.

---

### US-5.2: View Session Summary ⭐ MUST
>
> As a **Candidate**, I want to **see a summary of my practice session** so that **I know how I did and what to focus on**.

---

### US-5.3: Review Individual Answers 📋 SHOULD
>
> As a **Candidate**, I want to **review my answers and feedback** so that **I can study before my screening call**.

---

## Epic 6: Recruiter Authentication & Access

### US-6.1: Recruiter Login ⭐ MUST
>
> As a **Recruiter**, I want to **log into the system** so that **I can access my invites and candidate results**.

---

### US-6.2: Recruiter Dashboard ⭐ MUST
>
> As a **Recruiter**, I want to **see a dashboard when I log in** so that **I can quickly see my invites and recent activity**.

---

## Epic 7: System & Platform

### US-7.1: Mobile Responsive ⭐ MUST
>
> As a **Candidate**, I want to **complete the session on my phone** so that **I can practice anywhere**.

---

### US-7.2: Accessibility ⭐ MUST
>
> As a **user with disabilities**, I want to **use the application with assistive technology** so that **I can participate fully**.

---

### US-7.3: Performance ⭐ MUST
>
> As a **user**, I want to **have a fast, responsive experience** so that **I don't get frustrated waiting**.

**Acceptance Criteria:**

- [ ] Page load < 3 seconds
- [ ] AI feedback returns < 10 seconds
- [ ] No UI freezing during operations

---

## Priority Summary

### Must Have (MVP)

| ID | Story | Persona |
|----|-------|---------|
| US-1.1 | Create Interview Invite | Recruiter |
| US-1.2 | View Invite List | Recruiter |
| US-1.3 | View Invite Status | Recruiter |
| US-2.1 | View Completed Session Summary | Recruiter |
| US-3.1 | Access Session via Link | Candidate |
| US-3.2 | Understand What This Is | Candidate |
| US-3.3 | Start Practice Session | Candidate |
| US-4.1 | View Interview Question | Candidate |
| US-4.2 | Answer via Voice | Candidate |
| US-4.3 | Answer via Text | Candidate |
| US-4.4 | Receive Feedback on Answer | Candidate |
| US-4.6 | See Progress Through Session | Candidate |
| US-5.1 | Complete Session | Candidate |
| US-5.2 | View Session Summary | Candidate |
| US-6.1 | Recruiter Login | Recruiter |
| US-6.2 | Recruiter Dashboard | Recruiter |
| US-7.1 | Mobile Responsive | All |
| US-7.2 | Accessibility | All |
| US-7.3 | Performance | All |

### Should Have (V1.1)

| ID | Story | Persona |
|----|-------|---------|
| US-1.4 | Resend/Copy Invite Link | Recruiter |
| US-1.5 | Delete/Archive Invite | Recruiter |
| US-2.2 | View Detailed Question Results | Recruiter |
| US-4.5 | Redo an Answer | Candidate |
| US-4.7 | Pause and Resume Session | Candidate |
| US-5.3 | Review Individual Answers | Candidate |

### Could Have (Future)

| ID | Story | Persona |
|----|-------|---------|
| US-2.3 | Export/Share Results | Recruiter |

---

## Open Questions for Stakeholder Review

1. **Readiness Signals**: Should recruiters see a "readiness" indicator? What form?
2. **Transcript Visibility**: Should recruiters see full answer transcripts, or just summaries?
3. **Invite Expiration**: Should invites expire? After how long?
4. **Multiple Attempts**: Can candidates retake? What does recruiter see?
5. **Question Customization**: Should recruiters customize questions, or just pick a role?
6. **Candidate Identity**: How do we associate invites with specific candidates (name, email)?
