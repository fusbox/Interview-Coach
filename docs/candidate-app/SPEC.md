# Candidate App Spec

Status: Canonical product intent
Last updated: 2026-07-10

## Purpose

The candidate app helps a job seeker prepare for a target interview by creating a role-specific practice round, coaching each answer, summarizing what to strengthen, and showing ongoing interview preparedness.

This file is the product boundary. It should describe what the candidate experiences and what the app may claim. It should not describe database tables, implementation files, package scripts, or code-level architecture.

## Product Scope

The candidate app is part of the shared Interview Coach host at `interviewcoach.talentarbor.com`.

Candidate-facing routes are expected to include:

- `/` public Interview Coach landing page.
- `/candidate/setup` candidate-owned practice setup.
- `/candidate/session/[sessionId]` candidate-owned live practice session.
- `/candidate/summary/[sessionId]` candidate-owned session debrief, if summary remains a separate surface.
- `/candidate/dashboard` candidate-owned interview preparedness dashboard.

The production-quality candidate rebuild uses the `/candidate/*` namespace rather than the temporary `*2` route names from the original parallel-route plan. `/candidate` itself is not a product UI surface; it should redirect or guard to the appropriate candidate destination, usually `/candidate/dashboard`. Temporary paths such as `/practice2`, `/session2/[sessionId]`, and `/dashboard2` may remain only as compatibility redirects while links and tests move to the canonical namespace. Rebuilt candidate routes must keep the same candidate-facing product claims and privacy boundaries described in this spec unless this file is updated first.

Production V2 candidate surfaces should depend on tracked design-system wrappers and tokens, not directly on `.untracked/design-system` files. The untracked design-system pack may remain a reference while components are promoted slice by slice.

The V2 rebuild branch intentionally starts from a minimal app scaffold. Existing app code should be brought back only when a numbered slice requires it, with the source/reference named in the commit and handoff.

Recruiter, admin, and QA routes share the deployable app, but candidate practice data is candidate-owned. Recruiters and hiring-decision users should not see candidate-led practice content. Admin and QA access may exist only for support, quality, and operational review with appropriate privacy controls.

Recruiter-created invite flows may share question planning services with the candidate app. When recruiter question setup changes, invited-session answer feedback, retry/continue behavior, and summary behavior should remain stable unless a recruiter-facing product change is explicitly specified.

## Core Candidate Flows

### Public Entry

The public page introduces Interview Coach as a TalentArbor/Rangam gateway for visitors who arrive directly at `interviewcoach.talentarbor.com`.

The public page should:

- make the product name and preparation purpose clear in the first viewport;
- route job seekers to `https://talentarbor.com/job-seeker`;
- route employer/client visitors to `https://rangam.com/employers`;
- keep employee/recruiter login available as a low-prominence utility action;
- explain product value through coaching instead of scoring, flexible practice guided by the interview stage the candidate is preparing for, support for many job types beyond tech/corporate roles, and grounded guidance about interview question types, why they are used, and how strong answers are shaped;
- avoid abstract product metaphors or decorative visuals that do not map to a real user action or product state;
- state plainly that candidate-led practice is for preparation and review, not employer hiring decisions.

After login or verified host launch, the candidate should return to the intended candidate route when that integration contract is available.

### Practice Setup

In production, `/candidate/setup` should be launched from a trusted host-platform job context. Initial expected launch surfaces are job seeker job-search routes such as TalentArbor and RangamWorks job listings.

The host launch should prepopulate the target role, job description, and job/req context. Resume context may be supplied when the host platform has approved parsed/cleaned resume content.

Direct manual setup remains available for local development and may become a future standalone mode only if explicitly designed.

The candidate creates a practice round by providing:

- target role, required;
- job description, required;
- resume content, optional, supplied as pasted text or extracted text from an uploaded resume file or resume photo;
- what interview moment they are preparing for, required;
- question count, required.

The default setup should stay short. Stage and question count are first-class practice configuration, not intake. Future advanced setup may expand inline for additional coaching customization, but it should not make setup feel like a long intake interview.

Setup submission must produce a typed payload before any session-generation side effect runs. The payload should include normalized `targetRole`, normalized `jobDescription`, nullable normalized `resumeText`, `interviewStage`, `questionCount`, and the resume capture mode. The first server transition may create a provisional candidate session route id and return `/candidate/session/[sessionId]` as the next route shape. That transition should carry the setup snapshot, the deterministic `questionPlanSnapshot`, and any provisional fixture `questionWordingSnapshot` so later persistence and generation can trace from one explicit setup input to one explicit planned category sequence to one exact worded-question sequence. It must not persist a durable practice session, call the production question-generation provider, or imply that the full session runtime exists until the durable draft, provider generation, and live-session boundaries are explicitly implemented.

Setup draft preservation should begin before session creation. Once the candidate has supplied the required role and job description, setup should create or restore an editable draft, autosave normalized setup fields, and restore the same draft when the candidate revisits or reloads. Production persistence must be identity-backed so the same candidate can return from another authenticated device; local browser persistence is acceptable only as a development bridge while the verified host-launch identity boundary is being built.

During a practice session, intelligent statefulness should restore the candidate to the meaningful point where they left off. When a candidate has opened a question surface, pause/resume, refresh, or a new tab/device recovery should restore the active session view and current question index, not only the session setup and draft text. Text answer drafts should recover with the same question context.

Setup draft state remains editable and restorable until a setup submission successfully creates the next session boundary. Failed submissions must preserve the draft so the candidate can retry without losing work. Successful session creation should clear the setup draft for that candidate so returning to `/candidate/setup` starts a new prep context instead of re-opening an already-submitted setup.

When the candidate chooses an interview stage, the setup surface should recommend a default question count for that stage while still allowing the candidate to choose a different count. Recommendation help text should use first-person coach voice and explain that the coach will guide further practice after the first session.

Resume upload and resume photo capture must normalize to text before downstream generation and coaching. The first UI may expose the file/photo capture and review-text surface before OCR or parser wiring lands, but it must not imply that raw files or photos are the coaching payload.

Question planning should stay deterministic and explainable before any AI question text is generated. The app may use target role, job description, resume context, interview stage, and question count to choose the intended category mix, but it should not imply that the generated question set alone defines overall interview preparedness.

Question wording must be requested from the explicit setup snapshot plus the carried `questionPlanSnapshot`. Provider or fixture output must be parsed through a typed result boundary that maps every question back to exactly one plan slot in order. Results that skip, duplicate, reorder, or misclassify plan slots must fail closed rather than being repaired silently. Until a provider is deliberately wired, the wording boundary should expose an explicit unavailable state instead of fabricating live-session questions.

Candidate setup should clearly state:

- what data is used for coaching;
- that resume content is optional;
- that candidate-led practice is for coaching and preparation;
- that hiring-decision users should not use candidate-led practice content for selection decisions.

Setup and session-launch transitions should include progress/loading UI so candidates understand when the app is preparing the plan, extracting resume text, generating questions, or moving into the session.

### Live Session

The live session should feel equivalent in quality to the recruiter-invited practice session experience while preserving candidate ownership.

During the cleanroom rebuild, `/candidate/session/[sessionId]` may first render a planned-session shell before the live runtime is restored. When a candidate-owned durable practice-session id can be resolved through the verified launch-session identity, that shell should recover the persisted setup snapshot, carried `questionPlanSnapshot`, optional `questionWordingSnapshot`, wording status, provisional progress, answer drafts, and pending answer submissions from `candidate_practice_sessions`. Browser session storage remains only a local/development bridge when durable identity or durable session recovery is unavailable. The shell should show the target role, interview stage, question count, resume inclusion state, role/JD context, the carried `questionPlanSnapshot`, and the carried provisional `questionWordingSnapshot` when present. It may create the provider-free question-wording request, show the explicit wording-unavailable state while provider wiring is absent, render deterministic fixture wording as a scaffold-only read-only preview after strict slot parsing, and open a read-only question preview from that wording snapshot for local validation. Provisional progress includes planned/not-started, read-only-question-preview, and started-live-question scaffold state plus the current question index; durable sessions should save that progress on navigation or live start so pause/resume, refresh, and cross-tab recovery return to the active question surface. The question shell may expose a local answer-draft surface with text entry and visible voice/photo affordances; text drafts should persist through the durable practice-session boundary when identity is available and stay component-local for browser-bridge sessions. The scaffold may start from carried local or stored wording before production provider wiring lands, typed draft submission may save a candidate-owned pending-analysis answer submission after ownership verification, and an analysis handoff route may read that saved pending submission before returning an explicit provider-not-configured unavailable state or, in explicit local dev validation mode, a deterministic fixture coaching snapshot. Answer-submit and answer-analysis mutations should be idempotent per candidate-owned practice session and question slot: V2 contracts use the candidate profile as actor, slot-scoped `candidate_answer_submit` or `candidate_answer_analysis` scopes, explicit `Idempotency-Key` values when supplied, deterministic fallback keys from the submitted payload when not supplied, replay for completed matching work, retryable `409` for matching in-flight work, and nonretryable `409` for key reuse with a different payload. The provider adapter should use the saved answer, the exact slot-mapped question, and setup context to request coaching, then accept only provider output that maps back to the same answer and evidence contract. Valid provider output may be persisted as an isolated V2 analysis snapshot, and the live question shell may show its candidate-safe coach feedback as a read-only current-answer surface. After that feedback appears, the live shell should provide the next executable transition: continue to the next live question, or finish the session on the last question. Finishing must call the candidate-owned completion route before routing to `/candidate/dashboard`. That pending submission, analysis request, provider adapter, analysis snapshot, feedback transition, and completion action must not create summaries, dashboard evidence, or legacy final answer rows until those lifecycles land. Media capture must stay disabled or unavailable until deliberately wired.

The production candidate flow should be setup submission, then a pre-session landing page, then the live session after the candidate chooses to continue. V1 does not have dual preview/live modes, and V2 should not make scaffold preview mode part of the production candidate session by default. If a preview capability is later designed, it should have a distinct product purpose and should not be a read-only mirror of the active session UI.

Read-only question preview navigation belongs only to the scaffold pre-live preview state. Once the candidate starts live practice, the session should show live-answer controls and must not expose previous/next preview controls.

Submitting an answer should not by itself advance to the next question. Submit saves the answer and requests coaching; after coaching is ready, the next transition should be driven by the feedback action contract, such as continue, retry/revise, finish, or pause. The current scaffold may execute the continue/finish transitions directly from the coach-feedback stub while the richer staged feedback UI is still being designed.

After coaching is ready, the candidate-facing interaction should preserve the useful V1 cadence without copying V1 content. The flow may start with a brief acknowledgement, then reveal answer-content coaching, optional delivery coaching when warranted, and a final next step. Intermediate feedback stages should let the candidate continue exploring coaching or skip ahead; the final next step should decide whether retry, continue, finish, or pause is the most appropriate next action. Retry should become the primary action only when the coaching read indicates revision would help. Continue should become finish on the last question. Feedback copy, visible coaching concepts, and evidence mapping should come from the V2 evaluation specs rather than legacy scoring or legacy field names.

Downstream session, summary, and dashboard surfaces should consume candidate-safe coaching facts derived from the accepted analysis snapshot. Those facts may include qualitative bands, coach copy, observed/excluded evidence counts, and coverage context, but they should not show raw scores, averages, or hidden readiness calculations as product language.

QA/evaluation should be built for evaluator review and model-response comparison, not as another candidate dashboard surface. The V2 export shape should start with a fixed QA case from setup context, one exact worded question, and one submitted answer; attach one or more model/prompt/evaluator runs to that case; and compare two runs only when they share the same case id and input fingerprint. This supports A/B comparison of different model responses to the same prompt/context. It should not include a source-app/app-name axis because V2 AI calls serve the same interview-coach evaluator job across the rebuilt surfaces.

The first completed-round bridge should keep the candidate review question-first. It may seed a sparse dashboard Coach Update, a post-round review list, and a next-practice recommendation from completed-session facts. It should lead with practiced questions, the candidate's own answer text, and coach observation/focus when available. It should also show skipped or unanswered planned questions as missing practice evidence, not as poor performance. The first dashboard implementation may use the Coach Update panel as an anchor link into the latest-round review; the richer opened Coach Update/debrief interaction should wait until the V2 feedback content contract is deliberately designed. The bridge should not claim durable dashboard preparedness, generate a summary narrative, expose hidden scores, or reuse recruiter-oriented feedback models.

The first V2 dashboard route boundary should consume completed-round facts as a read-time projection from candidate-owned `candidate_practice_sessions`. This keeps the dashboard traceable to setup -> question wording -> answer submission -> accepted coaching -> completion, and avoids creating a second durable dashboard truth before multi-round aggregation requirements are clear. If later dashboard performance or trend computation requires persistence, that should be a deliberate projection-table slice with clear invalidation rules.

The dashboard should make the learning loop legible without turning it into analytics UI. Before showing the learning loop, the dashboard should choose one selected target interview context and keep Coach Update, plan progress, practice-from-feedback guidance, stats, active-round resume state, and latest-round review scoped to that context. The visible dashboard should name the selected role context and offer an obvious way to switch when more than one target interview context exists. When the selected context has an unfinished round, the dashboard should show that active round as first-class resume state with the role, answered progress, current question position, and route back into the session. Coach Update is the feedback side: what the latest practice showed for the selected role. The next-practice area is the feedforward side: what to try next for that same role. That feedforward area must distinguish plan progress from feedback-based practice. Plan progress means the broader Coach Plan for the selected role context: resume an unfinished round, finish planned questions that still lack practice evidence, or start the first role plan. Practice from feedback means a focused next step based on what the coach observed in answers the candidate already practiced for that role. When both are relevant, the dashboard should make both visible while keeping the priority clear, usually by asking the candidate to finish already-planned practice before treating feedback focus as the whole plan. This pairing follows the self-regulated learning framing from the referenced learning-analytics paper: learners need indicators for reflection/monitoring and indicators for planning/recommendation. V2 should express that through candidate-friendly product language, not academic labels, scores, rankings, or durable dashboard conclusions.

The dashboard may temporarily express the selected target interview context in the URL for direct links, refresh recovery, and browser validation. That URL value is a selection affordance, not the durable product identity of a preparation context. Production should prefer an opaque `prepProfileId` or `targetInterviewId` once the host-job/profile boundary exists, especially when role titles, employer/client hints, or job metadata could become sensitive in browser history, logs, analytics, or referrer headers.

When the candidate selects a next action from feedback, the app may persist that selected action so refresh, new tab recovery, and future action execution can resume from the candidate's chosen state. A persisted feedback action should be tied to a saved coaching result for the same answer slot and question index. Persisting the selected action is not the same as executing it: retry, continue, finish, pause, summary generation, and dashboard updates remain separate product transitions.

Completing a candidate-led round should create a durable completion snapshot from server-recovered session facts. The snapshot should distinguish answered questions from skipped or unanswered questions, preserve the final completed progress state and current index, and route the candidate to `/candidate/dashboard` as the next home-base surface. Completion does not by itself create a summary, dashboard evidence, QA export, or legacy invited-session mutation.

The V2 durable persistence boundary for setup-created practice rounds is `candidate_practice_sessions`. It stores the setup snapshot, carried question plan snapshot, optional question wording snapshot or wording status, provisional progress state, answer drafts, pending answer submissions, answer idempotency records, answer analysis snapshots, selected feedback actions, and the candidate-led completion snapshot with candidate ownership and optional links to role profile and host-launch session context. `/candidate/setup/start` should persist through this boundary when candidate identity is available; if no candidate identity is available, local development may continue to return the browser-bridge provisional session result. If candidate identity resolves but durable persistence fails, the transition should fail closed instead of silently falling back. This boundary does not by itself wire provider calls, dashboard reads, or the live `sessions`/`questions` runtime.

`/candidate/setup/start` should distinguish candidate-correctable setup contract errors from startup infrastructure failures. Invalid setup payloads should return `400` with structured field errors that the setup UI can show before or after POST. Candidate identity lookup, database schema, and durable persistence failures should return a fail-closed startup error, not an invalid-setup response.

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

For the parallel V2 rebuild, candidate-owned session completion should return the candidate to the dashboard home base so post-practice Coach Update and next-practice guidance are the first follow-up surfaces. Recruiter-invited completion behavior should remain summary-oriented unless a recruiter-facing change is explicitly scoped.

The candidate-led feedback flow may show candidate-only coaching elements such as "For the biggest lift." Recruiter-invited sessions share core answer analysis, but their existing user-facing feedback behavior should remain stable unless a recruiter-app change is explicitly specified.

Candidate-led and recruiter-invited candidate sessions should converge around shared runtime facts where practical: question identity, prompt text, category, submitted answer, coaching facts, current position, and completion behavior. Candidate-led host launch, profile ownership, setup drafts, resume capture, and browser-bridge recovery are candidate-app concerns and should not leak into invited-session product behavior.

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

The selected target interview context should be changed through a compact prep-context switcher rather than a persistent sidebar/mobile dock on `/candidate/dashboard`. The switcher should show the selected role, a compact rounded-end gauge filled to practiced-question coverage and colored by qualitative prep state, and a last-practiced timestamp formatted in the browser's local timezone when available. The gauge should not show `X/Y` text in the center because coverage should support, not compete with, the preparedness read. The footer action should be `Prep for a new role` and route to `/candidate/setup`. This keeps `Next practice round` as the only persistent dashboard action while still allowing candidates to start preparing for a different role.

Cross-role reminders are allowed only as a secondary surface. They should not appear inside the selected role's Coach Update, Plan Progress, Practice from Feedback, or latest-round review because that creates mixed-role guidance. For example, an unfinished Packaging Associate round may be useful to remind the candidate about while viewing a CSR dashboard, but it should be visually and semantically separate from the CSR Coach Plan.

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

Category identity should use a reusable dashboard chip palette where categories need to be scanned as categories rather than as prep-state reads. Initial palette usage applies to Category face labels, Question Set face/modal category markers, and Next Practice Round queued-question category chips. The Coach Update carousel nav indicator and category sheet header are intentionally excluded for now.

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

- close or click away;
- use the question-level practice actions;
- open the relevant Coach Plan face;
- open detail only on demand.

The first debrief read should lead with the latest practiced questions rather than an analytic axis. The opened Coach Update should use the same question-feedback surface as Question Set: full question, candidate answer/transcript, coach observation, and one focused way to strengthen or keep using the answer pattern. The Coach Update card itself should stay sparse and should not preview tactical guidance before the candidate opens it. The card is itself the action target; it should not carry a separate `Review update` button.

The opened Coach Update should feel personal and space-efficient: a coach-avatar motif plus one short context-setting statement should replace redundant eyebrow/title copy, and the header should avoid explanatory help text when the controls can carry the interaction model. Question navigation should act like a carousel indicator, and only the current question should receive the full `Q# / category` chip treatment. Non-current questions may be dots. Desktop should provide explicit previous/next controls around the carousel indicator; mobile can use swipe or tap navigation. The swipe/drag behavior is Embla-backed, while the dashboard component owns the local accessibility contract: a named carousel region, named slides, disabled previous/next states, current dot/chip state, a polite live status, hidden non-current slides, and suppressed tab stops inside non-current feedback cards. Feedback slides should share the same scroll viewport and keep the action block anchored to the bottom of the slide so different question lengths do not produce visibly different bottom scroll endpoints. The Coach Update card should avoid repeated visible eyebrows and should only use icons when they improve scanning without consuming too much transcript width. Category should appear once in the debrief navigation rather than being repeated inside the question card. The coach observation card should include both the current read and the strengthening guidance separated as distinct text blocks, rather than splitting guidance into a second card. Choosing, swiping, or stepping to a different question should reset the feedback content scroll to the top. The coach observation region should be accessible as `Coach observation`.

The next Coach Update card iteration should treat each carousel item as one contained feedback card, with adjacent cards peeking and subtle edge fades indicating swipeability. The current exploratory direction applies the in-session active-question gradient to the full Coach Update sheet/modal, including the main header, while active and peek cards stay white/paper. The modal header should be a quiet identity bar containing only an inline `MessageSquareQuote` coach mark, the shorter title, and close action; the coach mark and title should be vertically centered and should not use a filled avatar/badge surface. Carousel navigation belongs at the top edge of the card/content area and should be visually smaller than the header identity. Arrow controls should keep a 36px tap target while rendering as transparent hit areas around the icon rather than visible circular buttons. The active card should feel more interactive than static dashboard surfaces by using broad gray shadow with a subtle blue temperature, smooth scale/opacity changes as cards move in and out of view, and Embla snap-list dot navigation instead of a category pill indicator. The active dot should use the same primary-blue value as the inactive dot border, and nav arrows should use the same blue theme. The card header should stay compact and self-contained with `Q#`, category chip, prep-state chip, and the question prompt using reduced text size and line height for mobile fit, without the prior `surface-sky` nested header treatment. The answer transcript is the primary content area and preserves the shared transcript text styling as the future annotation surface. The compact coach observation area may temporarily tell the candidate to keep the annotated guidance in mind for the next practice attempt. On mobile, the opened Coach Update should behave as a top-anchored full-width sheet with a small bottom tapaway gap, matching the category/lane modal posture. This Coach Update presentation is intentionally separate from the Question Set modal until the pattern is validated.

The guided sequence should end with Practice Next.

### Practice Next

Practice Next should remain the main action surface, but it should not collapse every recommendation into the same meaning. The candidate should be able to tell whether the next action is:

- **Plan progress**: finish or continue practice that belongs to the selected role's Coach Plan, including an unfinished round or planned questions without practice evidence;
- **Practice from feedback**: work on something the coach noticed in a submitted answer.

Unanswered planned questions are missing practice evidence, not evidence of weak performance. Feedback-based guidance should not hide unfinished plan coverage, and unfinished plan coverage should not erase useful coaching from answers the candidate did practice.

The coach may recommend one primary task or a pair of primary tasks. If a practiced answer or lane is below clear or unscoreable and unanswered baseline questions remain, the dashboard should present both:

- one improvement/remediation task;
- one new-coverage task.

When order matters, the coach should recommend an order and explain why. When there is no clear dependency, both primary tasks may be presented as useful next options.

Alternatives should be secondary. They should mainly let candidates keep momentum by browsing unanswered questions. After all baseline questions have at least one answer, alternatives may shift toward polishing clear areas to strong or improving specific dimensions.

Question-level feedback surfaces may expose two practice actions before full queue persistence lands:

- **Practice this now** as the immediate one-question practice affordance;
- **Add this to my next round** / **Added** as the candidate-visible queue affordance.

The first implementation may keep the add/added state local to the current dashboard surface. Durable queue persistence, the expanded next-round surface, and actual one-question session launch behavior should be implemented as follow-on slices.

When the local queue state exists in a dashboard visit, shared question-feedback surfaces should reflect it consistently. Coach Update and Question Set feedback surfaces should use the same per-question queue switch: `Add Q# to my next round.` followed by a toggle control. The switch should present as a compact centered label/control group rather than a second button-shaped CTA. Turning the switch on adds that question to Next Practice Round; turning it off removes it without scrolling the current feedback surface. Removing the same question from the Next Practice Round surface should turn the switch off everywhere that question appears during the visit.

The first `Next practice round` surface is dashboard-local and bucketed by the currently selected interview prep context. When the selected prep context changes, any opened next-round surface should close, but each role's queued questions and **Added** states should be preserved independently during the visit. Queue counts, opened surface contents, source feedback button states, per-question removal, and clear-all should always read and update only the selected role's bucket. When the queue has at least one question, opening the surface shows the queued questions with Q number, question text, category, and current prep-state chip. Removing the last queued question for the selected role closes the surface and returns the source question feedback action to **Add this to my next round**. Until the session-launch contract lands, the surface may keep `Start practice` as a provisional route to `/candidate/setup`.

The dashboard header should be persistent while the candidate scrolls, using sticky or fixed positioning as needed by the shell. It should use a compact candidate-initial avatar badge as the upper-left identity anchor instead of a visible page title, and it should keep the `Next practice round` action available in the viewport. The avatar badge uses a white surface, muted neutral border, and initials derived from the candidate display name or email. The header fade should be soft, with no hard bottom border or backdrop-filter boundary. Opening should visually connect the button to the expanded surface: the surface should use the same radius, open from the measured button position, slide downward as it expands, and leave the button label and count badge in the same size, font, and center alignment as the button. The opened surface may place its outer top edge above the trigger by the modal top padding value, then position the carried-over title row at that padding offset with the trigger's measured height; this preserves title alignment while giving the modal enough top breathing room. The opened next-round label should remain visually lighter than primary page content so it reads as a carried-over control label rather than a competing page title. The opened surface should use a single full-width centered title row rather than a separate inline label, so the title cannot drift from the trigger's positioning model. The reference package in `docs/candidate-app/morphing-button-to-modal` shows the intended reserved-footprint/morph pattern; implementation may land in stages as long as the persistent header and same-radius opening direction remain intact.

Per-question removal is immediate and uses a smaller, quieter red clear affordance aligned with the queued question metadata row. In queued question cards, the Q number should be plain left-aligned text with a trailing colon, with pill chips reserved for category and prep state, and the question text should use the same text size, weight, line height, and spacing as the shared Coach Update / Question Set feedback question text. The opened next-round surface header should carry the primary `Start practice` CTA directly below the carried-over title row, without extra explanatory heading/body copy. `Clear all` is a medium-weight, borderless, red ghost-style secondary action paired with `Cancel`; both footer actions should have equal width, and `Clear all` requires confirmation before removing every queued question.

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
- Candidate surfaces should be intentionally stateful. Preserve unsubmitted or in-progress candidate work by default, but define explicit reset boundaries when a user action completes or replaces that work, such as successful setup submission creating a session.
- Landing on a candidate page, screen, or view should set scroll position to the top unless a specific interaction pattern intentionally preserves scroll. Any exception should be deliberate and documented by the slice that introduces it.
- Candidate draft state should be preserved on revisit by default, including reloads and new-device return flows once durable identity-backed storage is available. Local-only preservation is not enough for production setup, session-planning, or dashboard queue drafts.
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

Parallel V2 route work may rebuild candidate-facing UI and composition from the design-system direction, but it must not broaden candidate claims, expose hidden scores, or weaken candidate ownership boundaries.
