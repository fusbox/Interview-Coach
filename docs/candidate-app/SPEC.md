# Candidate App Spec

Status: Canonical product intent
Last updated: 2026-06-01

## Purpose

The candidate app helps a job seeker prepare for a target interview by creating a role-specific practice round, coaching each answer, summarizing what to strengthen, and showing ongoing interview preparedness.

This file is the product boundary. It should describe what the candidate experiences and what the app may claim. It should not describe database tables, implementation files, package scripts, or code-level architecture.

## Product Scope

The candidate app is part of the shared Interview Coach host at `interviewcoach.talentarbor.com`.

Candidate-facing routes are expected to include:

- `/` public Interview Coach landing page.
- `/practice` candidate-owned practice setup.
- `/session/[sessionId]` candidate-owned live practice session.
- `/summary/[sessionId]` candidate-owned session debrief.
- `/dashboard` candidate-owned interview preparedness dashboard.

Recruiter, admin, and QA routes share the deployable app, but candidate practice data is candidate-owned. Recruiters and hiring-decision users should not see candidate-led practice content. Admin and QA access may exist only for support, quality, and operational review with appropriate privacy controls.

## Core Candidate Flows

### Public Entry

The public page introduces Interview Coach and directs candidate calls to action through the approved TalentArbor candidate login path. After login, the candidate should return to the intended candidate route when that integration contract is available.

### Practice Setup

In production, `/practice` should be launched from a trusted host-platform job context. Initial expected launch surfaces are job seeker job-search routes such as TalentArbor and RangamWorks job listings.

The host launch should prepopulate the target role, job description, and job/req context. Resume context may be supplied when the host platform has approved parsed/cleaned resume content.

Direct manual setup remains available for local development and may become a future standalone mode only if explicitly designed.

The candidate creates a practice round by providing:

- target role, required;
- job description, required;
- resume content, optional;
- practice focus, optional advanced setup;
- question count, optional advanced setup.

The default setup should stay short. Advanced setup may expand inline, but it should not make setup feel like a long intake interview.

Candidate setup should clearly state:

- what data is used for coaching;
- that resume content is optional;
- that candidate-led practice is for coaching and preparation;
- that hiring-decision users should not use candidate-led practice content for selection decisions.

### Live Session

The live session should feel equivalent in quality to the recruiter-invited practice session experience while preserving candidate ownership.

Expected behavior:

- candidate sees an entry screen before the first question;
- question audio is prepared so the first question can play promptly;
- candidate can answer by voice or text;
- candidate can open hints and example/strong-response coaching;
- candidate can submit an answer and receive feedback through the shared feedback flow;
- candidate can retry when coaching indicates the answer needs work;
- candidate can continue or finish when the answer is ready enough to move on;
- candidate can pause/resume without losing progress;
- candidate can reach dashboard without weakening session ownership.

### Summary

After the final question, the candidate should route to summary immediately. The summary page owns the loading state while debrief content is generated or loaded.

The summary should:

- congratulate the candidate in a candidate-facing voice;
- summarize strengths;
- identify the primary growth area;
- provide momentum and next steps;
- collect candidate feedback separately from confidence measurement;
- offer low-emphasis navigation back to dashboard and practice setup.

### Dashboard

The dashboard should become the candidate's home base for interview preparedness.

The dashboard should be organized around a `prepProfile`: the candidate's preparation context for a target interview.

The dashboard should show:

- the target interview context currently being prepared;
- a fixed interview preparedness scaffold;
- the next practice action;
- recent or previous sessions;
- evidence-backed drilldowns;
- confidence trend when implemented.

The dashboard should not become a page of generic cards. It should visually answer:

- what successful preparation looks like for this interview;
- what evidence the candidate has already built;
- what is still thin or unpracticed;
- what the candidate should do next.

## Interview Preparedness Product Rules

Interview preparedness is not a score.

The candidate-facing scaffold uses stable top-level lanes:

- Role Fit
- Answer Substance
- Interview Structure
- Communication Delivery
- Interview Range

The lane scaffold should stay fixed. What varies is the signal mix underneath each lane, based on the target role, job description, resume context, practice focus, generated questions, answers, coaching feedback, and summaries.

Resume and job description context are source evidence. They are not standalone dashboard lanes.

Confidence is a self-reported trend. It is not performance evidence and is not a preparedness lane.

"Was this helpful?" feedback is product/coaching-output feedback. It is not confidence data and not performance evidence.

## Candidate-Facing Claims

The app may make claims such as:

- "You have practiced this area."
- "Your latest answer gives clear evidence here."
- "This area is starting to build evidence."
- "This is useful to practice next."
- "Your resume content was used to shape coaching for this role."

The app must not claim:

- that the candidate is hireable or not hireable;
- that the candidate is likely to be selected;
- that a numeric readiness score represents interview success;
- that a recruiter or hiring manager has reviewed candidate-led practice;
- that resume/JD alignment is definitive unless a specific extraction/evaluation contract supports that claim.

## Non-Goals For Current Release

- No candidate-facing numeric interview preparedness score.
- No hiring-decision assessment.
- No recruiter visibility into candidate-led practice content.
- No multi-role dashboard manager beyond what is needed to safely avoid mixed-role confusion.
- No inline modal mini-practice engine separate from the standard session route.
- No standalone resume-builder or career-navigator module inside this release.

## UX Guardrails

- Keep setup short and progressive.
- Use plain-language labels, not internal model or product-planning terms.
- Prefer graphical, evidence-backed preparedness views over long text blocks.
- Use microinteractions to reveal why an area matters and what evidence supports it.
- Keep one clear next action on the dashboard.
- Make empty states educational without overexplaining implementation.
- Avoid exposing raw AI internals, hidden scoring, or privacy-sensitive source content in candidate UI.

## Change Rule

Do not broaden candidate-facing scope or add new candidate claims without updating this file first.
