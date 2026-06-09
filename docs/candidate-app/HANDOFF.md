# Candidate App Handoff

Status: Active execution state
Last updated: 2026-06-09

## Completed

- Candidate implementation now targets the shared Interview Coach app/repo path, currently worked from `feature/candidate-module`.
- Candidate setup, session, summary, and dashboard routes exist in the shared app.
- Candidate `/practice` requires target role and job description; resume content is optional.
- Candidate sessions use the shared question-generation service and candidate-owned session creation.
- Candidate hints and example/strong-response coaching receive resume context when present.
- Candidate feedback and summary use the invite-session style flow closely enough for visible end-to-end testing.
- Candidate summary loads immediately and owns debrief generation/loading.
- `candidate_role_preparation_profiles` is the current persistence anchor for `prepProfile`.
- Dashboard loader reads `prepProfile` context where available and falls back for older rows.
- Dashboard currently renders the Preparedness Map concept with derived `prepProfile` signals, Practice Next, drilldowns, and recent activity.
- Dashboard read behavior now selects one current target interview context and filters stats, Practice Next, and recent activity away from unrelated role sessions.
- Dashboard exposes a first-pass target interview switcher backed by `?targetRole=` so local multi-role testing can switch contexts without mixing role evidence.
- Dashboard Preparedness Map now renders the release-oriented score-driven performance lanes: Answer Substance, Interview Structure, and Communication Delivery.
- Dashboard question coverage now renders separately from performance lanes as category cards for Behavioral, Culture/Fit, Technical/Role-Specific, Case/Scenario, and Screening when category data is available.
- Dashboard lane drilldowns now present one question/answer item per practiced question, preserving answer mode and transcript before opening candidate-safe coach-read detail copy.
- Dashboard category cards now use the same mobile-first drilldown pattern as lanes: tap category, review practiced Q/A cards, then tap a Q/A card for category-scoped feedback copy.
- Dashboard drilldown Q/A cards now cap long transcripts with Show more/less, surface submitted answer timestamps as Practiced, remove redundant inline guidance labels, and frame detail copy as My Read.
- Dashboard lane and category drilldowns now group Q/A cards by practice session, newest session first, with the newest group open by default and each session's answers sorted by submitted time.
- Dashboard question coverage cards now recompute merged state from weighted average category scores and sort lower-evidence categories before already-strong categories.
- Dashboard question coverage cards now distinguish each category question as Practiced or Upcoming, while category state/color remains based only on practiced/scored questions.
- Dashboard answer evidence now preserves submitted answer modality through Postgres answer persistence, candidate server-action submission, audio-analysis reconciliation, and a DB backfill for older voice-analysis rows; answer-analysis metadata remains only an older-row fallback so new voice submissions do not rely on diagnostic metadata to render voice-response badges.
- Dashboard My Read detail modals now preserve full coach-read content and format recognized evaluation sections into Overall Read, What Stood Out, For the Biggest Lift, and Next Step instead of truncating or exposing "Coach signals" language.
- Dashboard lane, category, and nested My Read modals now share the same viewport-constrained width rule across screen sizes to avoid breakpoint-driven wrapping jumps.
- Answer feedback now prefers `coachSignal` over legacy `oneBigUpgrade`; new generation asks for `coachSignal`, session feedback labels it "For the biggest lift", and dashboard/read-model adapters only use `oneBigUpgrade` as older-row fallback.
- Dashboard empty state now mirrors the populated dashboard grammar with a friendly start message, muted Preparedness Map preview lanes, muted question coverage preview cards, and a Practice Next-style create-practice surface.
- Production `/practice` direction is now host-launched only; manual setup remains normal for local development.
- Platform launch prepProfile migration reference exists for future TalentArbor/RangamWorks job-listing integration.
- Interview preparedness signal contract exists with immutable lane ids and qualitative evidence states.
- Preparedness signal map documents the release pivot: Substance, Structure, and Delivery lanes derive from hidden numeric scores on completed sessions; Role Fit is out of release scope; Interview Range becomes category cards.
- Screening Basics question generation now has an explicit screening-only bucket for interest, background, and availability/logistics questions.
- Dashboard Preparedness Map now aggregates signals across all scoped selected-target-interview items, not only the latest session card.
- Latest clear/strong evidence promotes a signal immediately; repeated weak evidence can pull state down.
- Resume/JD context is treated as source evidence and framing, not as a standalone lane.
- Question planning now has a deterministic `QuestionPlan` service that maps interview stage plus question count into canonical category slots before AI question text generation.
- Candidate `/practice` now exposes the stage control as "What are you preparing for?" with plain-language options: Not sure yet, First conversation or screening, First interview, Follow-up or final interview, and No interview scheduled.
- Candidate practice drafts and sessions now persist `interviewStage`, and candidate question snapshots use `QuestionPlan` ordering when a stage is present while preserving legacy `interviewType` ordering as fallback.
- Shared answer analysis now records `candidate_app` only for candidate-led sessions with candidate/prepProfile context and otherwise records `recruiter_app` for recruiter-invited sessions.
- Candidate-only answer feedback coaching (`coachSignal` / "For the biggest lift") is opt-in at the feedback drawer and enabled only from candidate session surfaces; recruiter-invited sessions keep the existing shared feedback flow without that candidate-only block.
- Recruiter `/recruiter/create` now has an Interview Details block for interview stage and question count, gates question creation behind Add Questions, and passes stage/count into the shared question-generation request for AI-quality observability and prompt context.

## Current State And Context

The current dashboard is useful as a visual shell and read-model proof, but it is not yet the final interview-preparedness product.

Known current behavior:

- Dashboard target-interview scoping is a first pass based on unfinished-session priority, explicit target-role selection, and target role title.
- Preparedness Map UI now consumes the score-driven release read model when answer score payloads are available, while older scoreless rows retain the legacy fallback path.
- Question coverage cards now open a first-pass modal using the same Q/A card and coach-read interaction as lane drilldowns.
- Question coverage cards can include generated-but-unanswered questions as Upcoming coverage context; unanswered questions do not count as zero-score practice evidence.
- Dashboard Q/A evidence now reads answer modality from persisted `answers.modality` before analysis metadata. Submit and analysis recovery paths persist/reconcile voice modality canonically, and migration 005 backfills older voice-analysis rows.
- Dashboard My Read detail copy is now structurally formatted from existing candidate-safe evaluation text; no additional model call is made for the formatting pass.
- Practice Next prefers `coachSignal` and uses "biggest lift" language. Older rows with `oneBigUpgrade` still map through a compatibility fallback.
- Previous sessions are filtered to the selected target interview role, but same-title/different-JD switching still needs a real profile manager later.
- Drilldowns now show session-grouped, capped Q/A evidence cards instead of raw source-ref preview rows. Browser validation item #1 is cleared; category-card state/order now follows the score-driven release contract.
- Empty dashboard state is now a visual preview of the eventual dashboard rather than a sparse placeholder checklist.
- Confidence measurement has not landed.
- Runtime PII/sensitive-data scrubbing and QA masking are still open hardening items.
- Host launch token/auth details are not finalized, so platform launch schema changes are documented but not implemented.
- Recruiter create now exposes interview-stage/question-count planning as a first pass. It still uses the existing STAR/PERMA/Technical editor once question creation is opened; category-section parity, distribution explanation, and reset/start-over UX are not yet landed.

Active docs now use this lighter stack:

- [SPEC](./SPEC.md) for product intent and scope.
- [DATA_CONTRACT](./DATA_CONTRACT.md) for system primitives and naming.
- [HANDOFF](./HANDOFF.md) for this active execution snapshot.
- [Decision Records](./08-decisions/README.md) for durable why-decisions.
- [Platform Launch PrepProfile Migration](./04-architecture/platform-launch-prepprofile-migration.md) for future host-platform schema integration.
- [Preparedness Signal Map](./04-architecture/preparedness-signal-map.md) for low-level signal and lane evidence tracing.

Older detailed docs remain available as reference and should not be deleted before a release milestone.

## Immediate Next Step

Harden the remaining dashboard data-contract seams before adding more visual polish.

Recommended next implementation slice:

1. Continue the recruiter `/recruiter/create` redesign after the stage/count gate: map generated/manual questions into plain-language category sections and add the category distribution confirmation step.
2. Keep recruiter-invited answer feedback behavior stable while shared generation/planning changes continue.
3. Continue product tuning of category-scoped My Read copy against more realistic sessions.
4. Keep completed-session route recovery queued as lower priority until dashboard release behavior is otherwise stable.

## Current Risks

- Same-title/different-JD prep profiles are not distinguishable in the dashboard until a profile switcher or stricter profile selector lands.
- Practice Next still relies on active/latest completed-session prioritization and does not yet synthesize a coach-configured next round from cross-session lane/category patterns.
- `QuestionPlan` now informs both candidate `/practice` and recruiter `/recruiter/create` generation context, but recruiter create still needs the richer category-section UI and distribution confirmation flow.
- Category coverage cards now have drilldowns and score-driven ordering, but category-scoped coach-read copy remains first-pass and needs product tuning against more realistic sessions.
- Legacy `oneBigUpgrade` can still exist in persisted payloads, but current read paths should treat it as compatibility fallback only.
- Sensitive data can still be too visible in AI-quality/debug surfaces until masking/redaction work lands.

## Refresh Rule

At the end of each meaningful work session, rewrite this file so the next session can resume without reading the full doc set.
