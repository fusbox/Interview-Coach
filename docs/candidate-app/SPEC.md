# Candidate App Spec

Status: Canonical product intent
Last updated: 2026-06-27

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

Recruiter-created invite flows may share question planning services with the candidate app. When recruiter question setup changes, invited-session answer feedback, retry/continue behavior, and summary behavior should remain stable unless a recruiter-facing product change is explicitly specified.

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
- what interview moment they are preparing for;
- question count.

The default setup should stay short. Stage and question count are first-class practice configuration, not intake. Future advanced setup may expand inline for additional coaching customization, but it should not make setup feel like a long intake interview.

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
- a Coach Plan home-base surface that explains what the candidate is preparing for, why that plan fits the target interview, how much of the baseline has evidence, and what to practice next;
- a preparedness target that gives the candidate a fast, non-score read of progress toward the coach's baseline;
- three Coach Plan faces: Categories, Skills, and Question Set;
- coaching sheets that explain categories, skill lanes, and questions before showing deeper evidence;
- a matrix-backed interview preparedness map during transition while the Coach Plan surfaces mature;
- the next practice action;
- evidence-backed drilldowns by category, skill lane, question, or lane/category cell;
- confidence trend when implemented.

The dashboard should not become a page of generic cards. It should visually answer:

- what successful preparation looks like for this target interview;
- what evidence the candidate has already built;
- what is still thin or unpracticed;
- what the candidate should do next.

The Coach Plan is the intended release direction for the normal candidate dashboard experience. It should feel like a familiar home base with very visible post-practice debrief UI when applicable. The current matrix may remain as a transition/detail surface, but it should not receive more polish unless that work supports migration or validation.

### Coach Plan

The Coach Plan is the dashboard's primary home-base object.

It has fixed framing plus three faces.

Fixed framing should include:

- target role;
- interview stage;
- baseline question count;
- a short, list-friendly explanation of why this plan fits the role, JD, and stage;
- a preparedness target;
- compact progress and movement microcopy.

The fixed framing should be brief enough that the selected face remains visible. A richer plan reference may live behind an orientation/help affordance. That reference may explain the full plan, category meanings, response frameworks, the difference between selected round count and baseline count, and how candidates can practice flexibly without treating every round as a literal interview simulation.

The three faces are:

- Categories: interview-demand categories in the plan, what each category is trying to elicit, and how much category coverage has been practiced.
- Skills: the answer-quality lanes the coach uses to evaluate answers.
- Question Set: the planned coach sequence through the baseline question set.

First visit should default to Categories. After the candidate changes faces, the app may remember the last selected face for that prep context.

Desktop may use arrows for face-to-face navigation. Mobile should support swipe. Animation may use a light perspective treatment so the interaction reads as rotating between faces instead of a generic 2D carousel, but animation polish should not outrank clarity, accessibility, or mobile stability.

### Preparedness Target

The preparedness target is a qualitative visual read of progress toward the coach's baseline.

It should combine:

- baseline coverage: how many baseline questions have been answered at least once;
- aggregate current prep state for the practiced baseline questions;
- movement indicators from repeat practice, such as improved and watch counts;
- explainer text on hover, focus, or tap.

The target must not behave like a score. It may show `X/Y practiced` and a simple visual proportion of practiced baseline questions, but it must not expose numeric scoring averages, raw hidden scoring dimensions, or percentage copy as a candidate-facing grade. Repeat practice must not increase the coverage numerator, but repeat practice can improve or caution the aggregate current read.

The intended release visual is a simple rounded gauge. The filled arc shows the proportion of recommended baseline questions practiced at least once, and the fill color uses the aggregate qualitative prep-state color for practiced evidence. The center should show the prep-state chip and `X/Y practiced`. Supporting copy should summarize coverage in coach voice, such as "You've practiced 3 of the 5 questions I've recommended," followed by a short first-person coach observation that starts from "I see..." and frames clear/strong states as affirmation and emerging state as encouragement. Hover, focus, or tap may show a compact explainer with practiced/unpracticed context and state copy.

At zero practiced questions, the target should use a start-state treatment that explains the plan is ready but no practice evidence exists yet. It should point the candidate toward the first recommended practice action rather than showing an empty failure state.

### Coach Plan Faces

The Category face should show only categories present in the baseline plan. The category chart should be the main selector. Labels may appear next to segments when space allows. Selecting a segment or label opens a coaching sheet with non-sheet screen area available for clickaway/tapaway close.

The Category coaching sheet should start with role/stage/JD-specific teaching:

- why this category appears in this plan;
- what the question type is trying to learn;
- what a strong answer needs to do;
- common weak patterns to avoid.

The progress side may show planned questions, practiced questions, coach comments, and next practice guidance.

The Skills face should use three lane-level targets: Answer Substance, Interview Structure, and Communication Delivery. Child dimensions should not be first-pass tap targets. They should appear in the lane coaching sheet so candidates can understand what rolls up into the lane without needing to tap small chart segments.

The Question Set face should default to the planned coach sequence. Answered questions should be visible. Unanswered questions should be hidden by default with a reveal option. The basis is answered/unanswered, not current-round membership, so paused sessions do not reveal questions the candidate has not yet encountered unless the candidate chooses to reveal them.

Opening a question should show the full question and answer transcript first. Future feedback annotation may highlight answer phrases, bracket sections, or mark milestones with color-coded annotations that reveal coaching detail progressively.

### Coach Update And Debrief

When new answer feedback is created, the dashboard should show a Coach Update entry. The update should feel like the coach has a fresh read from the latest practice.

The Coach Update opens a sparse guided debrief sequence, not a trapping wizard. Each step should be skimmable and offer escape routes:

- close or not now;
- skip to recommended practice;
- open the relevant Coach Plan face;
- open detail only on demand.

The first debrief read should lead with coach priority rather than an analytic axis. For example, it should explain the most important change in plain language, then support that read with chips such as **Structure** improved, **Case / Scenario** still unpracticed, or **Next:** client-impact question.

The guided sequence should end with Practice Next.

### Practice Next

Practice Next should remain the main action surface.

The coach may recommend one primary task or a pair of primary tasks. If a practiced answer or lane is below clear or unscoreable and unanswered baseline questions remain, the dashboard should present both:

- one improvement/remediation task;
- one new-coverage task.

When order matters, the coach should recommend an order and explain why. When there is no clear dependency, both primary tasks may be presented as useful next options.

Alternatives should be secondary. They should mainly let candidates keep momentum by browsing unanswered questions. After all baseline questions have at least one answer, alternatives may shift toward polishing clear areas to strong or improving specific dimensions.

## Interview Preparedness Product Rules

Interview preparedness is not a candidate-facing score.

The candidate-facing performance scaffold uses stable top-level lanes:

- Answer Substance
- Interview Structure
- Communication Delivery

The lane scaffold should stay fixed. Lane state may be derived from hidden answer-evaluation scoring, but the dashboard must present the result qualitatively and evidence-first.

Interview range is represented through the category axis of the preparedness map, not as a lane. Expected categories are:

- Behavioral
- Culture / Fit
- Scenario
- Technical / Role-Specific
- Screening

Behavioral questions ask for real past examples. Scenario questions ask what the candidate would do in an imagined work situation. Culture/Fit questions ask about motivation, values, work style, and role alignment. Screening questions ask about basic interest, background, qualifications, availability, or logistics. Technical/Role-Specific questions ask about job-specific knowledge, tools, processes, or judgment.

Category coverage should distinguish practiced questions from generated-but-unanswered upcoming questions. Category state and lane/category cell state should be based on practiced/scored answers only; unanswered upcoming questions should not count as zero-score evidence.

The dashboard may expose lane-only, category-only, and lane/category-cell drilldowns. All three views must reuse the same evidence-safe interaction model: practiced question and candidate answer cards first, then candidate-safe "My Read" detail copy.

For the release matrix view, question categories should render as rows and the fixed performance lanes should render as columns: Substance, Structure, and Delivery. This keeps the matrix narrow enough for mobile while preserving the row/column/cell drilldown model.

What varies by target interview is the question mix, evidence, drilldown content, and next practice recommendation, based on the target role, job description, resume context, interview stage, generated questions, answers, coaching feedback, and summaries.

The app distinguishes the selected practice round from the coach's baseline coverage expectation for the interview moment. The selected round may contain fewer questions than the baseline. In that case, the generated round should use an appropriate sample of the baseline mix, while the dashboard can still show remaining planned coverage as upcoming/to-practice areas. The current release baseline is deterministic by interview stage; future revisions may adjust that baseline using structured role/JD signals such as industry, role family, level, compliance risk, or client-facing intensity.

The candidate should understand that a practice round is not always a literal simulation of the whole interview. It is a flexible way to practice answering questions within the coach's broader baseline plan. Candidates may practice fewer questions than the baseline when time or focus requires it.

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
- Keep Coach Plan fixed framing compact and list-friendly.
- Use neutral UI structure for labels and coach voice for interpretation.
- In narrative coach copy, refer to app concepts naturally: "answer structure" rather than "Structure" as a standalone noun.
- In chips, labels, headings, and fragments, app terms may be capitalized and emphasized, such as **Structure** improved.

## Change Rule

Do not broaden candidate-facing scope or add new candidate claims without updating this file first.

Shared services used by both candidate-led and recruiter-invited sessions must preserve recruiter-invited user-facing behavior unless this SPEC or a recruiter-app spec explicitly changes that behavior.
