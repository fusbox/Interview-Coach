# Candidate Production UI Milestone

Status: Local milestone pass; human visual review and release acceptance pending
Date: 2026-07-26
Scope: Slices 194 and 196

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
- **Defer:** invited, recruiter, QA, Coach Update detail, and remaining provisional-surface redesign; compatibility-token removal where provisional consumers remain; credentialed evaluator calibration.

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
