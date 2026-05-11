# Practice Setup Scope

Date: 2026-04-03
Status: Current product contract + future-extension seam

## Purpose

This document defines what `/practice` should let an authenticated candidate do before a practice session starts, and where the setup flow must leave clean extension points for future intake and guest-trial work.

## Current User Goal

As a candidate, I want to set up a practice interview around the role I am preparing for, optionally add my job description and resume context, and start a guided session without having to manage question generation myself.

## Current `/practice` Scope

Current route/feature boundary:

- [Practice route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/practice/page.tsx)
- [Practice route test](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/practice/page.test.tsx)
- [Practice setup feature](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/PracticeSetupPage.tsx)
- [Practice setup feature tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/PracticeSetupPage.test.tsx)

The route delegates rendering to `src/features/practice-setup`, keeping the page shell thin before server-backed draft lifecycle work begins.

### Required input

- Target role

### Optional input

- Job description text
- Resume text pasted directly into the app
- Resume file upload
- One or more photos of a printed resume, including multi-page capture

### System behavior

- Resume inputs should be normalized into extracted text before downstream question generation and coaching.
- Candidate-facing question generation should remain hidden.
- After setup submission, the app should show a generating/loading state and then route the candidate into the session experience.
- If the candidate leaves during setup, generation, session, or summary, returning later should restore the correct screen/state from persisted server data.

## Future Extension: Candidate Intake

The original PoC included a candidate intake flow for additional personalization. That capability is expected to return in this app, but it is not yet scoped tightly enough to build.

For now, `/practice` should reserve a clean extension point for intake responses without forcing the first implementation to finalize:

- which questions are asked
- whether intake is required or optional
- whether intake is reusable profile data or session-specific context
- how much of the intake should influence question generation versus coaching tone

## Future Extension: Candidate-Authored Questions

The original PoC also allowed candidates to add questions they specifically wanted to practice, in addition to AI-generated questions.

This should be treated as a supported future option in the session setup model, but it does not need to be surfaced in the first `/practice` screen if we choose to ship a simpler setup path first.

## Explicit Deviations from the Recruiter App

- No invite-batch creation.
- No recruiter-authored candidate list.
- No pre-session invite email service.
- Question generation is hidden from the candidate instead of shown as a review/edit step.
- Candidate setup belongs to an authenticated user-owned draft/session object, not an anonymous invite token flow.

## Reused Behavior from the Recruiter App

The candidate app should preserve the recruiter app's strongest stateful-session patterns:

- resume from the correct screen after refresh
- resume from the correct screen after returning later
- resume from the same state on another authenticated device
- derive current screen from persisted draft/session state rather than trusting local component state alone

## Out of Scope for the First `/practice` Pass

- Guest trial flow
- Full candidate dashboard implementation
- Finalized intake questionnaire UX
- Candidate-authored question UX, unless we decide to bring that forward early
- Any recruiter-facing invite or review workflow
