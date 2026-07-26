# Candidate Production UI Milestone

Status: Local milestone pass; human visual review and release acceptance pending
Date: 2026-07-26
Scope: Slice 194

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
