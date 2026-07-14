# Candidate App Handoff

Status: Active execution state
Last updated: 2026-07-13

## Agent Bootstrap

- Active rebuild branch: `feature/candidate-v2-rebuild`.
- Current route target: canonical candidate routes under `/candidate/*`; `/practice2`, `/session2/[sessionId]`, and `/dashboard2` are compatibility redirects only.
- Before a meaningful candidate workflow slice, inspect the matching V1 behavior from `feature/candidate-module` and record what V2 preserves, reinterprets, retires, or defers.
- Use [SPEC](./SPEC.md) for product behavior, [DATA_CONTRACT](./DATA_CONTRACT.md) for durable shapes, [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md) for local DB/runtime commands, and [V1 SWOT And Rebuild Runway](./04-architecture/v1-swot-and-rebuild-runway.md) for the V1 reference rule.
- Default verification for candidate code changes: focused tests for touched modules, `npm run test:candidate`, `npm run typecheck`, `npm run build`, and `git diff --check`. Add DB smoke validation when migrations, seeds, or repository contracts change.
- Keep this file narrow. It should tell the next coding agent what is true now, what to do next, what is risky, and where to reconstruct older history.

## Current State

- The rebuild is intentionally cleanroom. Bring old app code back only when a numbered slice needs it, and favor V2 contracts over V1 code unless V1 is clearly more fit for the job.
- Public root, `/candidate/launch`, dev launch, `/candidate/setup`, `/candidate/practice/ready`, `/candidate/practice/ready/[intentId]`, `/candidate/session/[sessionId]`, and `/candidate/dashboard` exist.
- Host launch has dev-mode token minting, production token verification scaffolding, candidate launch-session storage, and fail-closed orchestration. Production TA/RW launch-context lookup is still the major missing adapter.
- `/candidate/setup` is the generic new-prep-context setup surface. It preserves unsubmitted local browser drafts, validates the typed setup contract before submit, writes durable setup-created practice sessions when candidate identity is available, and clears the submitted setup draft only after successful session creation. Follow-up practice setup must not be rendered through this generic setup surface.
- `candidate_practice_sessions` is the main V2 durable session boundary. It stores candidate ownership, setup snapshots, question-plan snapshots, optional wording state, progress state, answer drafts, pending answer submissions, accepted analysis snapshots, feedback action events, candidate-led completion snapshots, and follow-up attempt lineage. In explicit local dev host-launch mode, routes resolve deterministic `dev-host-launch-*` cookies to fixture candidate profiles without treating those cookie values as DB launch-session ids.
- The candidate session now enters a shared one-question live-practice shell driven by neutral session runtime facts. It provides role/question progress, typed-answer mode, durable exact-question and draft recovery, candidate-safe coaching, and a persistent candidate exit to `/candidate/dashboard` that does not reset progress. Candidate and invited adapters share the shell while retaining distinct completion and return behavior. Legacy `question_preview` progress is migrated to the equivalent live question; preview navigation and Back to plan are no longer candidate product UI.
- Initial and follow-up candidate-led rounds render through one production-shaped pre-session landing composition. Initial rounds transition from the durable session record; follow-up rounds retain the durable candidate-owned practice-intent POST boundary and show the selected questions. Both use candidate-led preparation/no-hiring-decision copy, pause-and-return reassurance, one primary action, and the 1.25-second "Entering practice space" overlay. The overlay fades in over the landing, holds while the live shell mounts underneath, then fades away; reduced-motion users receive the same orienting state without animation. A shared invited-practice module provides the future initials-confirmation -> invited landing variant with recruiter-visibility and original-invitation-return copy, but no invite route or persistence mutation is wired yet.
- The shared question-audio lifecycle defines landing Q1 prefetch, current/next prefetch, user-gesture unlock, and browser-session play-once memory. No production TTS transport is wired: V1's TTS route is coupled to legacy authorization and must not be copied. Production question wording, answer-analysis providers, media capture, staged feedback UI, summary generation, and invited route convergence remain pending.
- `/candidate/practice/ready` is the follow-up practice bridge. Query-pointer actions are validated against candidate-owned facts, durable `candidate_practice_intents` support one or many selected questions, `/candidate/practice/ready/[intentId]` renders staging, and `/candidate/practice/ready/[intentId]/start` creates follow-up `candidate_practice_sessions` with source intent, source question, session attempt, and question attempt lineage. Repeated practice is intentionally unlimited.
- `/candidate/dashboard` consumes typed V2 read models derived from candidate-owned `candidate_practice_sessions`. It chooses a selected target interview context before making dashboard claims, shows active-round resume state, Coach Update, Plan Progress, Practice from Feedback, latest-round review, focused-practice actions, and follow-up attempt rollups. Current focus remains stable through canonical role-scoped dashboard URLs; session exit/completion return to the session's role context, while bare/invalid URLs choose a fallback once and canonicalize. Plan Progress creates one durable multi-question intent for unanswered planned coverage, and Practice from Feedback resolves the coached-question intent; neither follow-up path uses generic setup. Attempt lineage is data infrastructure for later trend, recruiter, and BI uses; it is not a candidate-visible UI requirement while the surfaces remain scaffolds. URL target-role selection is a temporary navigation/recovery affordance, not durable prep-profile identity.
- QA/evaluation has a typed V2 export contract for answer-quality review and model A/B comparison. It derives redacted fixed cases, model/prompt/evaluator run snapshots, and same-input comparison snapshots. It intentionally does not include a candidate-app versus recruiter-app source axis because V2 AI calls should be evaluated as one interview-coach evaluator job.
- Current persistence posture: dashboard/session surfaces are read-time derivations until multi-round aggregation, query pressure, or analytics needs justify separate projection tables.

## Recommended Next Slice

The next commit milestone productizes the candidate session experience before returning to dashboard composition. These slices should preserve the proven V1 interaction contracts while deriving from V2 session, answer, feedback, and completion sources.

96. Productize answer capture and mutation states. Replace scaffold controls with candidate-ready typed-answer behavior, explicit saving/analyzing/retryable-error states, draft recovery, and protected transitions around idempotent submit/analysis routes. Keep voice/photo unavailable until their privacy, permission, storage, and provider contracts are deliberately wired.

97. Implement the staged evidence-first feedback experience. Preserve V1's useful acknowledgement, explore/skip, focused coaching, retry/continue, and last-question finish cadence, but render only V2 candidate-safe coaching facts and evidence-first feedback content. Do not introduce hidden-score language, legacy feedback truth, or a second answer lifecycle.

98. Close and browser-validate the production candidate session arc. Prove setup or follow-up staging -> pre-session landing -> live questions -> feedback actions -> pause/resume or completion -> selected-context dashboard, including reload/new-tab recovery, focus/scroll transitions, disabled/loading/error states, and draft preservation boundaries. This is the commit boundary before final dashboard information architecture and visual composition begin.

## Open Decisions And Risks

- Production `/candidate/launch` remains fail-closed until the TA/RW launch-context lookup adapter is implemented and configured.
- Host-launch replay protection, secret rotation, token lifetime policy, issuer/audience guarantees, and exact production cookie/session behavior are not fully specified.
- Identity-backed setup draft persistence remains pending; local browser setup preservation does not satisfy the production new-device requirement.
- Resume ingestion still needs product and technical decisions for upload, OCR/photo capture, PDF extraction, PII handling, storage, and when extracted text becomes the setup payload.
- Production question-wording and answer-analysis providers need prompts, credentials, retry/error handling, observability, redaction, and QA capture policy.
- The shared audio lifecycle has no production TTS adapter or authorization contract. Preserve the prefetch/play-once boundary while replacing V1's legacy candidate-token route with a V2 identity-owned transport.
- The candidate completion mutation and dashboard destination are fixed, but the final feedback-stage finish CTA and transition presentation remain an open product decision.
- Follow-up practice intent creation plus session creation works, but production transaction hardening around intent consume/session create remains pending.
- Dashboard role-context selection currently uses readable URL metadata. Move toward opaque `prepProfileId`, `targetInterviewId`, or host job/profile identity when available.
- Dashboard Coach Update/detail surfaces are scaffolds over sound read models. Final interaction design, queue/builder surfaces, coach bundles, trend views, and multi-round preparedness aggregation remain unbuilt.
- Candidate-visible attempt counts are deliberately deferred. Keep attempt lineage and rollups available in data/read models, but do not spend current UI scope on count chips, labels, or charts before the core session and dashboard surfaces are productized.
- Sensitive data can still be too visible in AI-quality/debug surfaces until masking/redaction work lands.
- Historical candidate implementation tests are not fully restored on the cleanroom branch; keep `npm run test:candidate` scoped to deliberately restored surfaces.

## Major Rebuild Phase Map

Phase A: Host launch, identity, and setup foundation. Status: scaffolded for dev and partially scaffolded for production. Landed: token verifier boundaries, launch route shell, dev host launch, launch-session schema/repository, setup contract/UI, setup-start durable session creation, local draft preservation, and setup reset-after-submit behavior. Remaining: TA/RW launch-context adapter, host replay/rotation hardening, identity-backed setup drafts, resume/OCR ingestion, and production access/session details.

Phase B: Planned session and question generation foundation. Status: scaffolded with deterministic planning and fixture wording. Landed: setup-to-session handoff, carried question-plan snapshots, provider-free wording contract, strict slot-mapped wording validation, fixture wording, production-shaped pre-session landing, and migration from obsolete preview progress into live practice. Remaining: production question-wording provider, prompt/context policy, retry/error states, and observability.

Phase C: Live session runtime and answer-analysis foundation. Status: shared live shell landed; answer and feedback productization is the active milestone. Landed: shared runtime vocabulary and live-practice component, candidate/invited completion adapters, dashboard exit without progress reset, exact-question recovery, durable answer drafts, typed answer lifecycle, idempotent submit/analysis boundaries, pending submissions, fixture provider analysis, candidate-safe coaching facts, feedback action persistence, candidate-led completion snapshots, and the shared audio lifecycle seam. Remaining: candidate-ready mutation states, production provider credentials/prompts, production TTS transport, media analysis, staged evidence-first feedback, retry execution polish, post-round presentation, and invited route wiring.

Phase D: Candidate dashboard, Coach Update, and follow-up practice. Status: data-flow foundation landed; final surface composition follows the session-productization milestone. Landed: dashboard read model, stable/canonical selected target-interview scoping, active-round resume, Coach Update seed/detail, Plan Progress versus Practice from Feedback split, latest-round question review, focused-practice intent pointers, plan-aware multi-question intent creation for unfinished coverage, durable one-or-many practice intents, follow-up ready staging, live follow-up session creation, and attempt lineage rollups. Remaining: final dashboard information architecture, Coach Update interaction, candidate-managed queue/builder UI, coach bundles, multi-round progress/coverage, later trend/attempt presentation, and any justified dashboard projections.

Phase E: QA/evaluation and model comparison. Status: typed export contract only. Landed: redacted QA case shape, model/prompt/evaluator run snapshot, same-input A/B comparison snapshot, and candidate-safe validation flags. Remaining: persistence/export routes, QA UI, reviewer annotations, provider metadata policy, raw payload retention policy, and operational masking.

Phase F: Shared invited/candidate runtime convergence. Status: first shared runtime boundary landed. The live-practice shell and completion/return adapters are audience-neutral; invited initials, landing copy, route/auth, permissions, employer visibility, and recruiter-created session constraints remain separate and largely unwired.

Phase G: Recruiter/admin route rebuild or preservation decision. Status: deferred. Future work should decide which recruiter surfaces remain from V1, which move under `/recruiter/*`, and which need V2 shared read models rather than direct legacy mutation paths.

Phase H: Production hardening, privacy, accessibility, and observability. Status: ongoing risk stream. Future work includes host-launch security, audit/event strategy, sensitive-data masking, provider failure handling, accessibility/performance passes, route-level error recovery, deployment env docs, and release validation.

Phase I: Retirement and cleanup. Status: ongoing discipline. Future work includes removing temporary redirects, stale V1 routes/helpers, provisional browser bridges that have durable replacements, fixture-only paths, obsolete tests/docs, and historical scripts once replacement behavior is verified.

## Recent Completed Slices

95. Establish the real shared live-practice shell. Replaced the candidate preview/live scaffold with one audience-neutral, one-question workspace driven by `SessionRuntimeFacts`. Candidate-led practice now shows role and question progress, typed answer capture, candidate-safe coaching, exact-question/draft recovery, and a persistent Return to dashboard exit that leaves durable progress intact; invited adapters can instead return to the original invitation boundary. Legacy preview progress migrates to the same live question, and candidate UI no longer exposes preview navigation, Back to plan, or a resume-session detour. Preserved the 1.25-second landing transition as "Entering practice space" and, after browser validation, matched v0.5's stronger sequencing: fade in over landing, mount live practice beneath the overlay, then fade out. Added an optional shared audio lifecycle contract for Q1 landing prefetch, current/next question prefetch, user-gesture unlock, and browser-session play-once memory without copying V1's legacy TTS authorization route. Validation remediation also canonicalized role-scoped dashboard return links so Current focus stays stable, routed the green feedback action to focused-practice staging, changed Finish planned practice to create one plan-aware durable intent for all unanswered questions instead of opening generic setup, made both practice-intent JSONB parameters explicitly serialized so node-postgres cannot reinterpret the items array as a PostgreSQL array, made the focused-practice session-creation redirect relative so internal bind hosts and ports cannot leak into browser navigation, and made that explicit Start action create its follow-up session at live Q1 because focused-ready is already the round's landing surface. The destination session now owns the one-time routed entry transition so it can mount Q1 beneath the overlay and perform the real fade-out after navigation. Final candidate finish CTA presentation, production TTS transport, production media, and invited route wiring remain deferred.

94. Build the production-shaped pre-session landing experience. Replaced the candidate planned-session scaffold with a shared initial/follow-up landing composition grounded in durable session or practice-intent facts. Initial rounds show role, stage, question count, resume inclusion, pause/recovery, candidate-led practice disclosure, and one Start practice action; follow-up rounds add the selected question list and retain their durable POST mutation. Both pass through a brief preparing-practice transition that does not claim to generate an existing round or enter an interview room. Fixture preview moved behind development tools. Added an unwired shared invited variant that preserves V1's initials -> landing sequence, explicitly treats initials as a possible-misinvitation signal rather than identity proof, points return behavior to the original invitation, and separates recruiter answer visibility from candidate-only AI coaching. Refined the landing into a calm, grid-led readiness surface with the canonical TalentArbor logo header, a compact page heading and guidance, and a bento-style round widget. The role occupies a full `--candidate-primary-wash` title band; stage, question count, and resume render as equal-width two-row fact columns without separators; blue and neutral border segments follow the surface they touch; and a short top-down neutral/blue shadow defines the widget edge. The reassurance widget uses `--candidate-accent-wash` with accessible dark-neutral text, establishing a distinct supportive purpose rather than an accidental second blue. Native 24px card silhouettes and the 12px action radius remain intact. The primary action uses the system's semantic CTA elevation: a short dark-neutral shadow with a nearly imperceptible blue tint. Treat the broader masonry/bento language as an active visual direction to test across later candidate surfaces before promoting the custom widget, border, or reassurance treatments into shared design-system primitives. The landed typography pairs Atkinson Hyperlegible Next for body/UI legibility with IBM Plex Sans for display character; permanent typography specimen documentation remains deferred. Deferred: invite-token route wiring, initials persistence/match reporting, exact affirmative-consent requirements, dedicated optional pre/post confidence persistence, and shared-component promotion.

93. Re-scope the real candidate UI build runway before implementing attempt UI. Inspected V1 setup/session, shared feedback, summary, and dashboard behavior alongside the refactor pack. Preserve V1's pre-session entry, one-question live workspace, mode parity, pause/resume, staged feedback actions, and explicit completion transitions; reinterpret its candidate summary and dashboard against V2 destinations and evidence-first facts; retire preview-as-product, duplicate runtimes, and legacy score-driven truth; defer candidate-visible attempt counts, production media, and trend UI. Staged slices 94-98 as the next candidate-session productization commit milestone.

92. Consume follow-up attempt context in dashboard/session read models. `candidate-completed-round-read-model` reads `setupSnapshot.followUpPractice` and exposes follow-up session/question attempt context. `candidate_dashboard_v2_read_model` derives selected-context attempt rollups. Tests prove repeated follow-up practice remains linked to the source question and does not inflate baseline coverage.

91. Create live follow-up sessions from durable practice intents. `/candidate/practice/ready/[intentId]/start` resolves identity, loads a ready candidate-owned intent, creates a normal follow-up `candidate_practice_sessions` row, marks the intent consumed with the created session id, and redirects to `/candidate/session/[sessionId]`. Repeated practice is intentionally unlimited and carries session/question attempt lineage.

90. Create durable follow-up practice intents from dashboard actions. `candidate-practice-intent-creation` converts one or many resolved follow-up items into a ready `candidate_practice_intents` row. `POST /candidate/practice/ready/intents` supports future builders/queues, and the existing pointer bridge can create one-item durable intents when persistence is available.

89. Add durable follow-up practice intents for one or many selected questions. Added `candidate_practice_intents`, migration/script/smoke wiring, repository, fail-closed durable intent builder, and `/candidate/practice/ready/[intentId]`. The durable route validates candidate ownership and supports the same staging surface for one-question and multi-question follow-up practice.

88. Rehome follow-up practice staging away from generic setup. Added `/candidate/practice/ready` for follow-up staging, moved Coach Update question-level practice actions there, and restored `/candidate/setup` to generic new-prep-context setup only. Captured future practice builder, fast path, plan-aware queue, coach bundles, and foundational guidance ideas in the spec.

87. Validate follow-up practice intents against durable candidate-owned facts. The resolver upgrades Coach Update practice intent pointers only when the current candidate owns the source session, the source question key exists, selected target context matches when present, and the requested intent matches actual answer/coaching evidence.

86. Teach the app how to parse Coach Update practice intent pointers. Added a fail-closed parser that accepts only stable intent, source practice-session id, and question key values, and does not echo arbitrary URL content, answer text, coach text, JD text, resume text, or score-like values.

85. Shape the focused-practice action boundary from Coach Update detail. Coached answers expose `practice_from_feedback`; skipped/unanswered planned questions expose `practice_missing_evidence`. Action hrefs carry only stable source metadata and deliberately do not prefill setup, launch one-question practice, persist queue state, or put sensitive content in URLs.

## Completed Phase Summary

- Slices 1-3: pre-reset repairs and temporary V2 route shells.
- Cleanroom reset decision: from slice 4 onward, the rebuild intentionally starts from minimal app code and brings old app behavior back only when a numbered slice requires it.
- Slices 4-16: canonical route scaffold, first tracked design-system primitives, public root rebuild, layout tokens, design-system import, and temporary-route redirects.
- Slices 17-29: `/candidate/setup` UI, typed setup payload, local draft preservation, host-launch contract scaffolding, dev/prod launch boundaries, launch context, launch-session schema, and setup-to-session server transition.
- Slices 30-40: planned-session shell, deterministic question planning, provider-free wording boundary, fixture wording, preview shell, setup reset boundary, browser progress, and first durable `candidate_practice_sessions` persistence boundary.
- Slices 41-50: durable setup-created session creation, durable session recovery, answer-draft shell/persistence, answer lifecycle stub, setup-start validation, local dev host-launch hardening, cross-tab recovery, and active progress persistence.
- Slices 51-73: live-question runtime boundary, typed answer submission, idempotency, analysis adapter, fixture provider, accepted analysis snapshots, coaching facts, feedback interaction contract, feedback action persistence, completion snapshots, completed-round read model, QA export contract, and live-session phase packaging.
- Slices 74-84: first dashboard read model and UI, feedback/feedforward split, dashboard recovery fixes, live completion routing, selected-context scoping/switching, active-round resume state, latest-round review, Coach Update detail contract, and first opened Coach Update surface.
- Slices 85-92: focused-practice action boundary, safe intent parsing, durable candidate-owned intent validation, follow-up staging, durable one-or-many intents, intent creation routes, live follow-up session creation, and attempt-context read consumption.
- Slice 93: V1/refactor-plan UI readiness synthesis, explicit attempt-UI deferral, and the production candidate-session surface runway.

## Archive Pointers

- Full pre-compaction handoff snapshot: [handoff-pre-compaction-2026-07-12](./reference-archive/handoff-pre-compaction-2026-07-12.md).
- Historical V1/interim architecture and SQL references: [Reference Archive](./reference-archive/README.md).
- Current local setup and DB commands: [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md).

## Deprecation Check

For each future candidate workflow or dashboard refactor slice:

- Name the old surface or helper being superseded.
- Search call sites before removing or replacing behavior.
- Classify the old code as `keep as transition`, `remove now`, or `mark for retirement`.
- Keep tests aligned with that classification.
- Record transition/retirement status here when it affects future work.

## V1 Reference Rule

Before each meaningful candidate workflow slice:

- Inspect the matching V1 behavior from `feature/candidate-module` without switching the active rebuild worktree when possible.
- Record the V1 files checked and the behavior contract learned from them.
- State whether each relevant V1 behavior is `preserve`, `reinterpret`, `retire`, or `defer`.
- If V1, the original refactor pack, and the current V2 contract disagree, name the divergence before implementation so the user can steer.

V1 is a behavior reference, not a default source-code donor. The cleanroom V2 contracts remain the landing structure.

## Refresh Rule

At the end of each meaningful work session, rewrite this file so the next session can resume without reading the full doc set.
