# Practice Setup Scope

Date: 2026-04-03
Status: Current product contract + future-extension seam

## Purpose

This document defines what `/practice` should let an authenticated candidate do before a practice session starts, and where the setup flow must leave clean extension points for future intake and guest-trial work.

## Current User Goal

As a candidate, I want to set up a practice interview around the role I am preparing for, use the job description as required role context, optionally add resume context, and start a guided session without having to manage question generation myself.

## Current `/practice` Scope

Current route/feature boundary:

- [Practice route](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/practice/page.tsx)
- [Practice route test](/c:/tmp/Interview-Coach-Recruiter-postgres/src/app/practice/page.test.tsx)
- [Practice setup feature](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/PracticeSetupPage.tsx)
- [Practice setup feature tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/PracticeSetupPage.test.tsx)
- [Practice setup form](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/PracticeSetupForm.tsx)
- [Practice setup form tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/PracticeSetupForm.test.tsx)
- [Practice setup schema](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/practice-setup-schema.ts)
- [Practice setup schema tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/practice-setup/practice-setup-schema.test.ts)

The route delegates rendering to `src/features/practice-setup`, keeping the page shell thin before server-backed draft lifecycle work begins.

The setup schema is the current shared contract for form/server boundary validation. It trims accepted text, requires `targetRole` and `jobDescription`, normalizes blank optional `resumeText` values to `null`, and rejects invalid payload shapes before draft persistence is added.

The setup form renders validation and future server submission errors through an announced alert region. Field-level errors set `aria-invalid` and are connected to the relevant input with `aria-describedby`.

When a candidate has an editable server-backed draft, `/practice` restores the latest draft and pre-fills the target role, job description, and resume text fields. The current implementation supports local candidate auth modes; external SSO restore uses the same draft read path once the callback/session boundary is finalized.

Submitting setup now saves the candidate's latest role, job description, resume text, and structured intake before session creation. If an editable draft was restored, the app updates that draft; if no editable draft exists, it creates a new candidate-owned draft. The draft then moves through generation and routes the candidate into the session experience.

### Required input

- Target role
- Job description text

### Optional input

- Resume text pasted directly into the app
- Resume file upload
- One or more photos of a printed resume, including multi-page capture

### System behavior

- Resume inputs should be normalized into extracted text before downstream question generation and coaching.
- Candidate-facing question generation should remain hidden.
- After setup submission, the app should show a generating/loading state and then route the candidate into the session experience.
- If the candidate leaves during setup, generation, session, or summary, returning later should restore the correct screen/state from persisted server data.

## Candidate Intake

The original PoC included a candidate intake flow for additional personalization. The first durable boundary now exists in the candidate-owned practice draft model, and `/practice` surfaces the MVP intake controls directly in setup.

Current implementation boundary:

- [Candidate practice draft repository](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-practice-draft-repository.ts)
- [Candidate practice draft repository tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-practice-draft-repository.test.ts)

Structured draft-level intake persists:

- confidence level
- interview type
- timeline
- concerns
- practice focus values

The current UI captures readiness/confidence, interview type, timeline, concerns, and selected focus areas. The setup action persists these fields before creating the session so downstream session and dashboard work can use the same draft context.

The first implementation keeps intake draft-specific. Future work can decide whether some answers should be promoted into reusable candidate profile preferences.

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
- Additional intake questionnaire depth beyond the MVP controls
- Candidate-authored question UX, unless we decide to bring that forward early
- Any recruiter-facing invite or review workflow
