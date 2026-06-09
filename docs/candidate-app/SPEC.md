# Candidate App Spec

Status: Canonical product intent
Last updated: 2026-06-09

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
- what interview moment they are preparing for, optional advanced setup;
- question count, optional advanced setup.

The default setup should stay short. Advanced setup may expand inline, but it should not make setup feel like a long intake interview.

Question planning should stay deterministic and explainable before any AI question text is generated. The app may use target role, job description, resume context, interview stage, and question count to choose the intended category mix, but it should not imply that the generated question set alone defines overall interview preparedness.

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

The candidate-led feedback flow may show candidate-only coaching elements such as "For the biggest lift." Recruiter-invited sessions share core answer analysis, but their existing user-facing feedback behavior should remain stable unless a recruiter-app change is explicitly specified.

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
- a fixed interview preparedness scaffold for answer performance;
- question coverage across the kinds of interview questions practiced for that target interview;
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

Interview preparedness is not a candidate-facing score.

The candidate-facing performance scaffold uses stable top-level lanes:

- Answer Substance
- Interview Structure
- Communication Delivery

The lane scaffold should stay fixed. Lane state may be derived from hidden answer-evaluation scoring, but the dashboard must present the result qualitatively and evidence-first.

Interview range is represented separately as question coverage, not as a lane. Expected category cards are:

- Behavioral
- Culture / Fit
- Technical / Role-Specific
- Case / Scenario
- Screening

Category coverage should distinguish practiced questions from generated-but-unanswered upcoming questions. Category state should be based on practiced/scored answers only; unanswered upcoming questions should not count as zero-score evidence.

What varies by target interview is the question mix, evidence, drilldown content, and next practice recommendation, based on the target role, job description, resume context, interview stage, generated questions, answers, coaching feedback, and summaries.

Resume and job description context are source evidence. They are not standalone dashboard lanes.

Role Fit is out of current-release dashboard scope unless a specific future extraction/evaluation contract supports candidate-facing claims.

Confidence is a self-reported trend. It is not performance evidence and is not a preparedness lane.

"Was this helpful?" feedback is product/coaching-output feedback. It is not confidence data and not performance evidence.

## Candidate-Facing Claims

The app may make claims such as:

- "You have practiced this area."
- "Your latest answer gives clear evidence here."
- "This area is starting to build evidence."
- "This is useful to practice next."
- "Your resume content was used to shape coaching for this role."
- "You practiced this kind of question."
- "This question is upcoming in an unfinished round."

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

Shared services used by both candidate-led and recruiter-invited sessions must preserve recruiter-invited user-facing behavior unless this SPEC or a recruiter-app spec explicitly changes that behavior.
