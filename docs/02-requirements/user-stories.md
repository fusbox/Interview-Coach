# User Stories

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-01-29 | Fu Chen | Initial draft |
| 0.2 | 2025-03-19 | Fu Chen | Epics 1 & 2 - scope & implementation updates |
| 0.3 | 2026-03-20 | Fu Chen | Added missing acceptance criteria and aligned completion status to current implementation |

---

## Overview

User stories organized by persona, prioritized using MoSCoW (Must/Should/Could/Won't).

**Format:** As a [persona], I want [goal] so that [benefit].

---

## Epic 1: Recruiter Invite Management

### US-1.1: Create Interview Invite MUST
>
> As a **Recruiter**, I want to **create an interview practice invite** so that **I can send it to a candidate**.

#### Acceptance Criteria

- [x] Recruiter can paste the job description
- [x] Recruiter can optionally select the job role from a predefined list*
> *NOTE: We've implemented **template creation** for easy reuse of question sets by role*
- [x] Recruiter can optionally customize session settings (question count, difficulty)*
> *NOTE: Difficulty config now **out of scope** for this phase*
- [x] System generates a unique, shareable link
- [x] Link is easy to copy to clipboard
> *NOTE: Now addressed with **in-app email service** for send/resend*
- [x] Invite is saved to recruiter's invite list

---

### US-1.2: View Invite List MUST
>
> As a **Recruiter**, I want to **see a list of invites I've created** so that **I can track which candidates I've sent practice sessions to**.

#### Acceptance Criteria

- [x] Recruiter sees a list of all invites they've created
- [x] Each invite shows: role, creation date, status (pending/completed/expired)
- [x] List is sorted by most recent first
> *NOTE: All table columns fully sortable*

---

### US-1.3: View Invite Status MUST
>
> As a **Recruiter**, I want to **see if a candidate has completed their practice session** so that **I know whether to follow up or proceed with screening**.

#### Acceptance Criteria

- [x] Each invite shows current status: Not Started, In Progress, Completed
- [x] Completed invites show completion timestamp

---

### US-1.4: Resend/Copy Invite Link SHOULD
>
> As a **Recruiter**, I want to **resend an invite link** so that **I can follow up with candidates who haven't started**.

#### Acceptance Criteria

- [x] Recruiter can resend an invite via prefilled email action from dashboard views
- [x] Recruiter can open the invite in a new tab when needed
- [x] Invite actions are available from list and progress surfaces without recreating the session
- [x] Candidate receives the same secure session link when the invite is resent

---

## Epic 2: Recruiter Session Review

### US-2.1: View Completed Session Summary MUST
>
> As a **Recruiter**, I want to **view the transcript of a candidate's responses** so that **I can quickly assess readiness and decide how to proceed with screening**.

#### Acceptance Criteria

- [x] Recruiter can open results for any completed session
- [x] Session details show each question and the transcript of their voice or text answer
- [x] Details do not show coach feedback, which is intended as private guidance for skill development

**OUT OF SCOPE**
~~**Primary Readiness Indicator**~~

- [ ] Displayed as a categorical band, one of:
  - Ready
  - Strong Potential
  - More Practice Recommended
  - Incomplete
- [ ] Category definitions are consistent across all sessions
- [ ] Indicator language emphasizes preparation, not assessment or hiring decisions

**OUT OF SCOPE**
~~**Supporting Signals (Structured, Non-Numeric)**~~

- [ ] Display 2-3 short descriptors summarizing observed patterns
- [ ] Descriptors are written in plain language (<= 8 words each)
- [ ] Descriptors reflect communication quality and preparedness, not "pass/fail"
- [ ] Descriptors are generated using a constrained template (not free-form)

**OUT OF SCOPE**
~~**Descriptive Summary (Progressive Disclosure)**~~

- [ ] Recruiter can optionally expand to view a short narrative summary
- [ ] Narrative focuses on:
  - Strengths demonstrated
  - Areas to probe in live screening
- [ ] Narrative avoids evaluative language like "score," "rating," or "grade"

**Explicit Exclusions**

- [ ] No overall numeric score
- [ ] No per-question numeric scores
- [ ] No comparative ranking between candidates
- [ ] No hiring recommendations or submission decisions

---

## Epic 3: Candidate Session Access

### US-3.1: Access Session via Link MUST
>
> As a **Candidate**, I want to **access my practice session by clicking a link** so that **I don't need to create an account**.

#### Acceptance Criteria

- [x] Candidate clicks link and lands on the session entry flow
- [x] No account creation required
- [x] Candidate can complete required initials check before entering the landing screen
- [x] Session entry works from the invite link on mobile and desktop layouts
- [x] Candidate can return to the same link and resume from saved state

---

### US-3.2: Understand What This Is MUST
>
> As a **Candidate**, I want to **understand what this practice session is and how it will help me** so that **I feel confident proceeding**.

#### Acceptance Criteria

- [x] Entry and landing screens explain that this is a guided interview practice experience
- [x] Candidate sees clear language that this is practice and skill-building, not evaluation
- [x] Rangam branding is visible on the candidate entry flow
- [x] Privacy boundaries are explained, including that coaching feedback is only visible to the candidate
- [x] Candidate sees reassurance that progress is saved and can be resumed later

---

### US-3.3: Start Practice Session MUST
>
> As a **Candidate**, I want to **start my practice session** so that **I can begin preparing**.

#### Acceptance Criteria

- [x] Candidate can begin the session from a clear primary CTA on the landing screen
- [x] Begin action is gated until required entry steps are complete
- [x] System transitions candidate into the first interview question without account setup
- [x] First-question audio is prefetched/unlocked from user interaction to reduce startup friction

---

## Epic 4: Candidate Interview Practice

### US-4.1: View Interview Question MUST
>
> As a **Candidate**, I want to **see the interview question clearly** so that **I can think about my answer**.

#### Acceptance Criteria

- [x] Question text is prominently displayed in the session workspace
- [x] Current role context remains visible during the session
- [x] Candidate can see current question number and total question count
- [x] Progress bar updates as the candidate advances through the session

---

### US-4.2: Answer via Voice MUST
>
> As a **Candidate**, I want to **answer questions by speaking** so that **I can practice realistic verbal responses**.

#### Acceptance Criteria

- [x] Clear microphone button starts recording
- [x] Audio visualizer and recording state make it clear when recording is active
- [x] Candidate can stop recording when done
- [x] Candidate explicitly submits the recording before it is analyzed
- [x] Graceful error handling is shown if microphone access fails
- [x] Candidate can retry a captured recording before submission

---

### US-4.3: Answer via Text MUST
>
> As a **Candidate**, I want to **type my answer if I can't use voice** so that **I can still complete the practice**.

#### Acceptance Criteria

- [x] Candidate can switch between voice and text input modes during the session
- [x] Text input is available on the same question flow as voice input
- [x] Candidate can submit a typed answer for analysis and continue the session
- [x] Text mode supports mobile and desktop layouts

---

### US-4.4: Receive Feedback on Answer MUST
>
> As a **Candidate**, I want to **receive feedback after each answer** so that **I can learn and improve**.

#### Acceptance Criteria

- [x] Feedback is displayed after answer submission
- [x] Feedback is structured as practical coaching, not scoring
- [x] Feedback identifies what to improve in answer content and/or delivery
- [x] Candidate can view and play back their answer to contextualize feedback guidance
- [x] Candidate can move forward or retry from the feedback step
- [x] Tone is framed as supportive skill-building rather than judgment

---

### US-4.5: Redo an Answer SHOULD
>
> As a **Candidate**, I want to **redo an answer if I'm not satisfied** so that **I can practice until I feel confident**.

#### Acceptance Criteria

- [x] Candidate can choose to retry an answer after reviewing coach feedback
- [x] Retry keeps the candidate on the current question instead of advancing
- [x] Previous attempt content is cleared before the new retry attempt begins

---

### US-4.6: See Progress Through Session MUST
>
> As a **Candidate**, I want to **see how many questions remain** so that **I can pace myself**.

#### Acceptance Criteria

- [x] Session header shows current question number and total question count
- [x] Progress percentage is visible during the interview flow
- [x] Progress bar advances as questions are completed
- [x] Completion screen clearly indicates the session has ended

---

### US-4.7: Pause and Resume Session SHOULD
>
> As a **Candidate**, I want to **pause and come back later** so that **I can complete the session even if interrupted**.

#### Acceptance Criteria

- [x] Candidate can exit the session without losing progress
- [x] Session transitions to a saved state when the candidate exits early
- [x] Candidate can resume the saved session from the same invite link
- [x] Resume returns the candidate to the in-progress session rather than restarting from the beginning

---

## Epic 5: Candidate Session Completion

### US-5.1: Complete Session MUST
>
> As a **Candidate**, I want to **finish my practice session** so that **the recruiter knows I've prepared**.

#### Acceptance Criteria

- [x] Candidate can complete the last question and finish the session
- [x] Session transitions to a completed state after the final step
- [x] Recruiter-facing dashboards reflect completed session status
- [x] Candidate is routed to an end-of-session summary experience

---

### US-5.2: View Session Summary MUST
>
> As a **Candidate**, I want to **see a summary of my practice session** so that **I know how I did and what to focus on**.

#### Acceptance Criteria

- [x] Candidate sees a post-session summary screen after completion
- [x] Summary includes narrative coaching takeaways when available
- [x] Loading/skeleton states are shown while summary content is still being prepared
- [x] Candidate can start a new practice session from the summary screen
- [x] Candidate can provide end-of-session feedback from the summary screen

---

### US-5.3: Review Individual Answers SHOULD
>
> As a **Candidate**, I want to **review my answers and feedback** so that **I can study before my screening call**.

#### Acceptance Criteria

- [x] Candidate can review their transcript/audio while they are in the per-question feedback step
- [x] Candidate can revisit the current answer before choosing to continue or retry
- [ ] Candidate can browse all prior answers from the final summary screen
- [ ] Candidate can reopen all prior coach feedback after the session is complete

---

## Epic 6: Recruiter Authentication & Access

### US-6.1: Recruiter Login MUST
>
> As a **Recruiter**, I want to **log into the system** so that **I can access my invites and candidate results**.

#### Acceptance Criteria

- [x] Recruiter can sign in with email and password
- [x] Recruiter can create a new account from the same auth screen
- [x] Authentication failures are shown inline
- [x] Authenticated recruiter is redirected into the recruiter portal

---

### US-6.2: Recruiter Dashboard MUST
>
> As a **Recruiter**, I want to **see a dashboard when I log in** so that **I can quickly see my invites and recent activity**.

#### Acceptance Criteria

- [x] Recruiter lands on a dashboard after authentication
- [x] Dashboard shows aggregate invite/session stats
- [x] Dashboard includes candidate-level tracking and invite progress sections
- [x] Recruiter can navigate directly from the dashboard to create invites, manage invites, and review sessions

---

## Epic 7: System & Platform

### US-7.1: Mobile Responsive MUST
>
> As a **Candidate**, I want to **complete the session on my phone** so that **I can practice anywhere**.

#### Acceptance Criteria

- [x] Candidate entry, interview, feedback, and summary flows render on mobile layouts
- [x] Voice and text answer flows are usable on smaller screens
- [x] Core recruiter and admin screens also support responsive layouts for common tasks
- [ ] Formal cross-device QA matrix is documented

---

### US-7.2: Accessibility MUST
>
> As a **user with disabilities**, I want to **use the application with assistive technology** so that **I can participate fully**.

#### Acceptance Criteria

- [x] Forms use explicit labels and accessible names for primary controls
- [x] Keyboard users can operate major recruiter/candidate flows without mouse-only blockers
- [x] Dialogs and overlays use accessible focus management patterns
- [x] Key contrast issues in recruiter, admin, and candidate UI have been remediated
- [ ] Full automated/browser-based accessibility audit suite is in place

---

### US-7.3: Performance MUST
>
> As a **user**, I want to **have a fast, responsive experience** so that **I don't get frustrated waiting**.

#### Acceptance Criteria

- [ ] Page load < 3 seconds
- [ ] AI feedback returns < 10 seconds
- [x] Loading states prevent the UI from appearing frozen during operations

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
| ~~US-2.3~~ | ~~Export/Share Results~~ | ~~Recruiter~~ |
> *NOTE: Unnecessary - app is sufficiently robust to handle recruiter ops. Future integration can shift this need to the ATS.*

| ID | Story | Persona |
|----|-------|---------|

---

## Open Questions for Stakeholder Review
