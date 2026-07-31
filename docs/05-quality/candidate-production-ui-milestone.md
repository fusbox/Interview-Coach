# Candidate Production UI Milestone

Status: Local milestone pass; human visual review and release acceptance pending
Date: 2026-07-31
Scope: Slices 194, 196, 205, and 206 plus the Coach Desk opened-surface migration

## Outcome

Slice 194 completed the first autonomous production-UI pilot over the stable V2 candidate contracts. It did not change evaluator meaning, preparedness derivation, persistence ownership, launch behavior, queue semantics, or practice-intent lifecycle.

The integrated candidate path now includes:

- one shared TalentArbor Interview Coach brand header on setup and pre-session surfaces;
- production-shaped setup, initial and follow-up landing, live-question, and dashboard composition;
- canonical question-preparedness presentation with coverage separate from highest-earned achievement and latest-attempt feedback;
- explicit candidate route loading and error states;
- required-field focus, question-change focus, stable recording announcements, long-text containment, and mobile/desktop reflow;
- launch mutation locking on follow-up landing;
- strict revalidation of stored answer-analysis projections before dashboard derivation.

Malformed or lineage-mismatched session analysis projections are dropped before dashboard derivation. Preparedness may still be reconstructed from a separately validated accepted evaluator run; otherwise the question remains evaluation unavailable. Invalid stored data cannot crash the dashboard or become a candidate-facing claim on its own.

## Prior-Behavior Decisions

- **Preserve:** required setup inputs and draft recovery; role-scoped feedback/feedforward loop; unfinished-round recovery and follow-up actions; orienting pre-session landing and transition; one-question-at-a-time coaching cadence.
- **Reinterpret:** V1 navigation and dense intake through the lean global system; dashboard modules through an evidence-first hierarchy and opaque prep-context identity; the mature shared session runtime through the active-question composition.
- **Retire:** title-keyed prep identity, browser-only queue semantics, local-only setup drafts, same-answer retry mutation, preview-era live-session presentation, and score-like dashboard summaries.
- **Defer:** invited, recruiter, QA, and remaining provisional-surface redesign; compatibility-token removal where provisional consumers remain; credentialed evaluator calibration.

## Verification

- focused session focus regression: 39 tests passed;
- complete candidate suite: 98 files, 676 tests passed;
- deterministic seeded browser journey: 3 Chromium journeys passed, covering the coached setup-to-dashboard loop, completion when immediate coaching is unavailable, and cross-browser resume review/recovery/consumption;
- `npm run typecheck` passed;
- `npm run lint` passed with no warnings;
- optimized `npm run build` passed;
- `npm run docs:check` passed;
- `git diff --check` passed.

Manual browser review covered setup, dashboard, pre-session landing, and live session at desktop and narrow-mobile viewports. The checked surfaces had no axe violations, horizontal overflow, incoherent overlap, or browser/runtime errors. Required-field validation moved focus to the first invalid control; live-session navigation moved focus to the changed question heading; long role text remained contained.

Screenshots are local evidence under `output/playwright/slice-194/` and are not tracked product assets.

## Bounded Findings

1. Candidate progress-only updates are optimistic and fire-and-forget. Browser state and durable answer drafts reduce interruption risk, but a failed progress `PUT` is not surfaced while the landing screen promises saved progress. This is a release-bound truthfulness gap, not a reason to weaken current candidate recovery behavior.
2. Compatibility redirects, prototype routes, and provisional styles remain only where their consumers were outside this milestone.
3. The checked dashboard correctly renders malformed prior development analysis as evaluation unavailable. No V1 data compatibility or invented provider history is required.
4. Human visual review, zoom/screen-reader review, invited/recruiter/QA surface replacement, and deployed performance evidence remain outside this local milestone.

## Verdict

`local pass`: Slice 194 is safe to commit as one coherent candidate production-UI milestone.

This is not a release verdict. The next evaluator gate is focused and complete credentialed V14/V15 calibration over representative candidate-visible outputs. A later senior release pass still owns host acceptance, deployed provider/email evidence, manual accessibility, performance, observability, dependency disposition, rollback, and production approval.

## Slice 196 Setup Refinement

Slice 196 replaces the provisional setup composition with the authored `Candidate Setup Mobile A.dc.html` hierarchy while preserving the complete live setup contract. The translation uses the official calm compass SVG, a shared Dashboard/New role navigation component, one coach spotlight, compact role/resume/interview panels, promoted 3/5/7/10 count choices, and an in-flow start action. Desktop is a responsive derivation of the same DOM rather than a separate design. Human review replaced the provisional 70rem main-plus-rail composition with the design-system-native 56rem form-flow frame and a continuous, scroll-aware vertical Role/Resume/Interview details timeline on mobile and desktop.

Behavior retained unchanged includes draft and accepted-resume recovery, trusted-host read-only context, PDF/DOCX/photo/paste processing and review, direct-PII protection, validation focus, duplicate-context choice, idempotent setup start, recoverable failure, and successful transition into practice. Human review exposed that the resume selector's mixed native `<button>`/`<label>` rendering and delayed file-input change event could make Paste text continue to look selected after another source was activated. The Slice 196 refinement uses one button primitive for every mode, separates interaction feedback from selection, activates an empty upload/photo mode before its picker returns, and persists exactly one explicit input mode in the unsubmitted browser draft without retaining raw file or photo sources. It also removes the obsolete tinted pill/side-stripe wrapper that intruded into the photo workspace and adds direction-aware mobile dock behavior. The dock yields after deliberate downward scrolling and returns on upward movement, near-top recovery, or keyboard focus; desktop header navigation does not move. A subsequent human pass retired the competing fixed Start practice footer, restored the action to normal flow after its summary/guidance context, reduced the obsolete bottom reserve, and added a complete guided sequence: Role/JD continuation to Resume, accepted resume or explicit no-resume continuation to Interview details, stage to count, and count to Start practice. Manual scrolling remains available; timeline state changes on section arrival and does not pretend that a merely visited step was completed.

Focused evidence:

- 21 resume/setup test files and 153 tests passed;
- 3 candidate design-system tests passed;
- 2 coach-avatar asset-selection and semantics tests passed;
- TypeScript, lint, optimized build, and documentation links passed;
- Chromium review at 320x568, 390x844, and 1440x1000 showed no horizontal overflow;
- Chromium mode-state review proved that Paste, Upload, and Photo each receive the same soft-primary selected surface and tight contour without a visible resting border, every inactive mode receives the same transparent surface and neutral border, hidden picker inputs do not appear as duplicate controls, and reload restores the persisted mode;
- focused navigation tests proved initial visibility, downward-scroll hiding, upward/near-top reveal, and focus-triggered reveal;
- Chromium mobile review proved the photo controls render without the obsolete background intrusion, Start practice remains in flow with its validation context, and the dock hides/reveals without competing fixed controls;
- Chromium desktop and narrow-mobile review confirmed the 56rem form-flow frame, continuous vertical timeline, aligned header/spotlight/form geometry, and no horizontal overflow down to the smallest browser viewport available in the test surface;
- browser interaction review confirmed Role/JD continuation marks only Role complete and arrives at Resume, explicit no-resume continuation marks only Resume complete and arrives at Interview details, manual scrolling changes the active orientation without falsely completing upcoming work, and the preserved stage/count guidance leaves Start practice visible without submitting the form;
- focused setup tests proved only accepted resume review, stage choice, and count choice advance to their intended next target;
- long role text, final-stage recommendation, and a deliberately different selected count remained contained and semantically distinct;
- the only browser console failure observed was a development-only missing favicon; no application-runtime error occurred.

Automated verification after the form-flow refinement: 44 focused presentation and setup tests, 154 resume/setup contract tests, TypeScript, lint, documentation-link validation, and `git diff --check` all pass.

The latest resume and interview-detail refinement makes the paste entry state action-first: the lone `Upload` action replaces premature coach narration, processing alone explains contact-detail removal, and the prepared state asks the candidate to review and edit before acceptance. Role, Resume, and Interview details now use the shared blue eyebrow pattern. Resume processing/review status and count recommendation now establish the reusable coach-voice surface: white `--surface-base`, a 2px primary-blue edge, surface compass identity, and restrained `--shadow-raised-1` elevation. Their parent section panels use `--surface-alt` to expose that layer cleanly. Selected mode, stage, and count controls use full-opacity `--primary-soft` with a tight raised contour and transparent geometry-preserving border while retaining separate hover/focus treatments. The compact Stage/Recommended/Selected summary uses `--surface-base` with slight elevation, and the final action aligns to the right edge of the flow. Primary actions now share the shorter neutral-first, faint-blue `--elevation-cta` drop shadow instead of the diffuse blue glow. The expanded resume/setup contract suite covers the action-first, processing, review-copy, coach-voice, and setup-hierarchy lifecycle.

The closing shape-and-surface pass replaces the former 28px card tier with a documented 12/16/24/32px non-pill ramp. Setup now assigns 32px to the spotlight, 24px to section panels and coach-voice surfaces, 16px to resume/stage selectors and the summary, and 12px to input areas and short surfaces. Role now matches Resume and Interview details with an alternate parent and base input surfaces; inactive resume, stage, and count controls share a border-only hover; stage option titles receive stronger typographic emphasis; and the summary moves to `--surface-base`. Coach-voice surfaces use a new light/dark surface compass variant with a primary-blue needle half so the identity remains legible on white without borrowing the CTA mark.

The closing setup composition is now a second 32px spotlight stacked below Interview details. Its `Your practice round` label introduces a compact glass summary ordered Resume, Stage, Recommended, and Selected; accepted resume artifacts use the same candidate-facing label and `Included` fallback as the pre-session landing, while an omitted resume reads `Not included`. The spotlight's desktop interior uses a compressed summary-left/action-right split, and mobile stacks those regions. Start practice uses the reusable opaque-white, brand-blue `.on-color-action` treatment rather than a setup-only override.

The accepted-resume edit recovery closes a state gap without relaxing the privacy gate. Editing processed upload, photo, or pasted text now returns the coach-voice status to review, removes resume inclusion from the summary, and blocks Start practice until `Use this resume` succeeds. Confirmation preserves the prior accepted artifact as immutable history, creates a replacement version, and advances the active setup selection atomically; privacy-changing edits remain awaiting review. Browser drafts retain only the last accepted artifact, never the unconfirmed edited text.

Verification for this recovery: 158 resume/setup contract tests, the disposable Postgres resume-ingestion smoke including accepted-edit replacement, TypeScript, lint, documentation-link validation, and `git diff --check` pass.

The local verdict remains `pass with human visual acceptance pending`. Manual screen-reader, zoom, high-contrast, software-keyboard, and device picker review remain part of the human/release evidence boundary.

## Slice 205 Live Session Refinement

Slice 205 replaces the remaining preview-era live-session composition with the authored `Candidate Session Mobile A.dc.html` hierarchy while preserving the shared candidate-led/invited runtime. One compact sticky header contains role, question position, audience-safe exit, and segmented progress. The question and response surfaces use the shared cutout primitive; audio, answer-mode, and assistance controls occupy their intended notches without changing route or mutation ownership.

Pre-answer assistance now follows the ratified runtime contract from the prior app generations without copying their browser-only cache. Question wording remains wording-only. When a question becomes current, the shared candidate-led/invited shell automatically requests Hints; Strong response makes no request until the candidate opens it. The server derives the immutable question, role/JD, and accepted processed-resume context, fences duplicate work with a durable claim, persists validated output as a candidate-owned question artifact, and replays it across reload, recovery, and tabs. Both controls expose truthful loading, unavailable, and retry states. Assistance remains excluded from evaluator evidence and recruiter transcript reads.

The voice composer now follows the authored state sequence rather than embedding the former utility form inside the new surface: ready status, elapsed recording time, waveform field, 84px recording instrument, recording gate, captured-recording playback, full-width Submit answer, paired Retry and Review actions, editable transcript review, and recoverable failure. Elapsed time has no target, countdown, or automatic three-minute stop; transport byte limits and a generous server-only abuse ceiling remain technical safeguards. Immediate retry still discards the unresolved browser recording; post-feedback retry remains an immutable new answer attempt. Purple `--accent-alt` is intentionally restricted to Strong response and voice Review. It is not a general V2 surface family.

The closing geometry pass gives both cutout control groups one design-system-owned centering rule: 36px visible controls retain 44px effective targets and sit centrally in the 44px notch instead of leaning toward the surface. The shared cutout primitive also owns the mockup's complete depth construction: rounded recess backing, direction-aware inset contour, then the shaped edge and raised shadow. Text and voice now share one 14.25rem resting composer height, and flex-column geometry places that composer at the safe viewport bottom while retaining its normal-flow footprint. The text textarea and compact footer flex inside that footprint, matching the mockup's stable mode swap without discarding truthful failure/recovery expansion. Routine dirty, saving, and successful autosave states are silent; failures, answer acceptance, and coaching remain visible.

Assistance interaction is elevated above the page rather than confined inside the notch. Resting Hints and Strong response controls use their supportive green and session-purple semantic surfaces. Once opened, a fixed interaction layer covers the complete session while the drawer remains aligned to the question surface's exact top and inline edges; it is intentionally not centered. Both controls stay available as toggles, the active toggle closes the drawer, and changing content uses direction-aware horizontal motion. Drawer open and close use a short vertical crossfade; focus containment, scroll blocking, Escape, clickaway dismissal, focus restoration, forced-color support, and reduced-motion fallbacks are acceptance requirements.

The answer-mode isolation regression closes a cross-mode state leak. Editable text now comes only from the text-draft channel, voice submission comes only from the authorized transcript, and the locked answer view comes only from the accepted answer or its active pending mode. An accepted text or voice answer clears the obsolete text draft locally and in the same durable session update. Focused tests cover text-draft-to-voice submission, stored-voice-to-text submission, and pending-draft ordering before voice acceptance; the five relevant session/repository suites pass 65 tests.

Focused verification:

- the dedicated question-assistance suite covers migration shape, durable claim/replay/retry, provider validation, ownership-scoped routes, automatic Hints, on-demand Strong response, and shared-shell audience routing;
- 87 question-wording/provider/setup tests passed;
- 167 voice-transcription and answer-lifecycle tests passed;
- 69 question-audio and candidate/invited route tests passed;
- browser inspection confirmed the compact one-column question/voice composition, long-role containment, absence of horizontal overflow in the available embedded viewport, and removal of the programmatic static-heading focus halo.

Credentialed V2 wording calibration and physical-device microphone/voice review remain release gates.

## Slice 206 Post-Answer Coaching Refinement

Slice 206 restores the v0.5-shaped submit-to-feedback rhythm without restoring
its legacy evaluator or scoring semantics. One shared body-level progress
overlay now covers the real answer-acceptance and initial-analysis interval for
candidate-led and invited practice. Typed submissions use three fixed timed
steps at the original 3,000ms cadence; voice submissions use four at 2,500ms,
adding `Noting your speaking delivery...`. The sequence is deliberately
modality-based and does not branch on evaluator markers or pretend to expose
provider pipeline stages. Save failure returns to the editable mode-owned
draft, analysis failure returns to the accepted-answer recovery actions, and
recovered coaching-ready work skips the loader.

Accepted coaching now opens in one elevated modal work surface with the
existing acknowledgement-first stages, persisted actions, immutable
answer-attempt identity, directional stage motion, contained scrolling, body
scroll lock, focus movement, and keyboard focus containment. The candidate-safe
feedback fields and retry/continue/finish contract are unchanged.

Prompt bundle V15 and Google adapter V16 make one bounded presentation change:
the acknowledgement must be a natural candidate-directed sentence that names
one accepted detail or pattern when evidence supports it and matches the
code-owned move-on, polish, or remediate posture. It may not invent praise,
introduce another finding, or change evaluator meaning. The deterministic
fixture mirrors that tone for local UI review.

Focused verification: 91 loader, shared-session, staged-feedback, interaction,
evaluator, and Google-adapter tests pass; lint passes with no warnings.
Credentialed V15/V16 tone calibration and human mobile/desktop feedback-flow
review remain acceptance gates.

## Slice 207 Session Feedback And Voice Refinement

Slice 207 removes the remaining duplicate work between voice acceptance and
the shared post-answer experience. A quick voice submit now enters the shared
four-step progress overlay immediately while transcription remains part of the
same accepted-answer operation. The separate transcript loader is retained
only for the explicit Review path, where transcript review is the action the
candidate requested; the retired voice save/transcript presentation is removed
from the quick-submit path rather than hidden.

The staged feedback surface now has its own 32px
`--radius-feedback-modal` shape role and a taller, viewport-bounded work area.
Its visible header contains only the coach avatar and progress indicator.
Acknowledgement, coaching, and next-step stage names remain available to
assistive technology but are no longer visible scaffold headings. Candidate
feedback copy uses promoted body typography across every stage. Theme-specific
coach-avatar assets occupy one image layer so only the active light or dark
variant can render.

Follow-up practice entry now has one routed transition owner. The source landing
does not start a competing overlay, and the destination route uses the same
entry transition during its Next.js loading fallback and mounted session
handoff. Browser timing checks showed one continuous `Entering practice space`
sequence with no intervening generic skeleton.

Voice is the default answer mode whenever voice is available and the candidate
has no explicit persisted text preference. Recording visualization now samples
the active microphone stream through a transient Web Audio analyser; no sampled
level data is stored, transmitted, or connected to an audio output. Cleanup
cancels animation sampling, disconnects the analyser, and closes its audio
context.

Verification:

- 70 focused session, loader, feedback, transition, and analyser tests pass;
- the 692-test candidate regression suite passes;
- zero-warning lint and documentation-link checks pass;
- browser validation confirms direct typed submit-to-shared-loader behavior,
  all three promoted feedback stages, one correctly layered coach avatar, the
  32px/672px desktop modal geometry, a skeleton-free follow-up entry sequence,
  and voice as the initial answer mode;

Physical microphone input remains the human validation gate for confirming that
the rendered bars respond naturally to real speech amplitude on target mobile
and desktop devices.

## Dashboard Coach Desk Home Migration

The accepted Phase 1 Coach Desk composition now replaces the provisional
production dashboard home without replacing its domain behavior. The route
continues to consume the canonical dashboard read model, state-priority rule,
Coach Update lifecycle and repair action, immutable Coach Update detail,
Coach Plan reference, durable question-practice actions, selected opaque prep
context, and next-round builder. The migrated home owns only composition:
transparent header over a tokenized blue canvas, glass role and queue controls,
an accessible Practice/Progress switcher, one state-owned lifecycle stage, one
truthful quiet secondary region, and the Strong-of-plan progress rail.

Unfinished round and cold start received the same closing parity review as the
ready and after-review states. Both use the borderless raised neutral-glass
material, `--radius-card`, `--shadow-raised-2`, one `36px` circular glass icon,
semantic typography, and grouped spacing. Unfinished round retains actual
answered/current-question progress and one Resume action. Cold start retains
the canonical plan count, first-question context, primary start action, and a
lower-emphasis Plan path. Neither surface renders a made-up saved-state row or
fixture-only fact. The opened Coach Update and Coach Plan migration described
below now completes the bounded dashboard composition pass. The former
`CandidateDashboardPriorityExperience` is no longer mounted by the route. The
live Coach Desk imports the extracted Coach Update dialog directly; the old
module remains compatibility cleanup rather than a production route dependency.

Verification:

- five focused dashboard/design-system files pass 31 tests, including cold
  start, unfinished round, roving tab focus, and Strong-only checked badges;
- the complete candidate regression suite passes 99 files and 697 tests;
- the optimized production build and zero-warning lint pass;
- documentation links and `git diff --check` pass;
- authenticated browser review covers ready, Progress, and after-review at
  320px, 390px, and 1440px in light and forced-dark themes with no horizontal
  overflow, page errors, failed requests, or WCAG 2.2 A/AA axe violations;
- computed production geometry confirms 36px dashboard icons, 44px header
  controls, full-pill role/queue shapes, 24px raised-card radii, 32px spotlight
  radius, and the intended light/dark glass fills and elevations.

The browser pass found one responsive defect before acceptance: a long role
name could wrap and grow the role pill above 44px at 320px. The production rule
now truncates that label on one line and preserves the control height. The
production Next.js build completes successfully.

## Dashboard Opened-Surface Migration

The production Coach Desk now mounts the accepted opened Coach Update and Coach
Plan compositions instead of leaving those interactions on the provisional
dashboard treatment. This remains a presentation slice over the existing read
and mutation contracts.

Coach Update extracts one route-owned dialog with question context outside the
answer-review nest. The nest contains only `Your answer` and the immutable
transcript; accepted whole-answer observation and one white `--surface-base` `Try next`
remain separate question-owned guidance. Exact accepted transcript annotations
open on hover, click, keyboard activation, and tap. The carousel uses a compact
scrollable question picker, removes noncurrent slides from focus and active
height, and restores focus even when opening the update replaces its unseen
launcher with the reviewed launcher.

Coach Plan defaults to Questions and exposes Categories as a secondary context
lens. Question tabs show the highest earned state, preserve upcoming-wording
reveal, and reuse the same answer-review component only when an exact immutable
Coach Update item matches the question. Category `Strong X of Y` counts require
rated Strong preparedness and never become a parallel practiced-count model.
Both sheets use `--radius-feedback-modal`; contained answer reviews use
`--radius-card`.

Verification:

- five focused dashboard files pass 27 tests, including route wiring, roving
  navigation, noncurrent action suppression, transcript fallback, and focus
  restoration after launcher replacement;
- the complete candidate suite passes 99 files and 697 tests;
- the optimized production build, zero-warning lint, documentation links, and
  `git diff --check` pass;
- authenticated browser review covers both opened surfaces at 320px and 1280px
  in light and forced-dark themes, with no horizontal page overflow; both
  opened surfaces return zero axe violations at 320px;
- the browser pass verified hover annotation reveal, dark annotation contrast,
  active-slide height, Escape dismissal, body-scroll restoration, and focus
  return.
