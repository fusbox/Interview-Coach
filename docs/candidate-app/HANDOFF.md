# Candidate App Handoff

Status: Active execution state
Last updated: 2026-06-22

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
- Dashboard Preparedness Map now renders as a release-oriented score-driven matrix: Answer Substance, Interview Structure, and Communication Delivery crossed with Behavioral, Culture/Fit, Technical/Role-Specific, Case/Scenario, and Screening categories when category data is available.
- Dashboard question coverage is now the category axis of the Preparedness Map matrix rather than a separate primary card group.
- Dashboard lane drilldowns now present one question/answer item per practiced question, preserving answer mode and transcript before opening candidate-safe coach-read detail copy.
- Dashboard category cards now use the same mobile-first drilldown pattern as lanes: tap category, review practiced Q/A cards, then tap a Q/A card for category-scoped feedback copy.
- Dashboard drilldown Q/A cards now cap long transcripts with Show more/less, surface submitted answer timestamps as Practiced, remove redundant inline guidance labels, and frame detail copy as My Read.
- Dashboard lane and category drilldowns now group Q/A cards by practice session, newest session first, with the newest group open by default and each session's answers sorted by submitted time.
- Dashboard question coverage cards now recompute merged state from weighted average category scores and sort lower-evidence categories before already-strong categories.
- Dashboard question coverage cards now distinguish each category question as Practiced or Upcoming, while category state/color remains based only on practiced/scored questions.
- Dashboard answer evidence now preserves submitted answer modality through Postgres answer persistence, candidate server-action submission, audio-analysis reconciliation, and a DB backfill for older voice-analysis rows; answer-analysis metadata remains only an older-row fallback so new voice submissions do not rely on diagnostic metadata to render voice-response badges.
- Dashboard My Read detail modals now preserve full coach-read content and format recognized evaluation sections into Overall Read, What Stood Out, For the Biggest Lift, and Next Step instead of truncating or exposing "Coach signals" language.
- Dashboard lane, category, and nested My Read modals now share the same viewport-constrained width rule across screen sizes to avoid breakpoint-driven wrapping jumps.
- Dashboard matrix row, category, and cell interactions reuse the existing drilldown surfaces so candidates can inspect evidence by performance lane, question category, or the intersection of both.
- Dashboard matrix now presents question categories as rows and Substance, Structure, and Delivery as the fixed three columns. Lane state labels and practiced/upcoming copy were removed from individual cells to reduce scan noise.
- Dashboard matrix column headers now use stable one-line sizing and visible full-button surfaces to avoid label clipping. Rows use a fixed height so row-label wrapping does not resize the grid. Hover/focus on a lane header highlights that column, hover/focus on a category row label highlights that row, and hovering/focusing a cell only targets that cell. Row/column highlights use a violet underlay that is not a preparedness-state color, and matrix cells opt out of outer borders/flat shadows while not-practiced cells use a quiet gray fill.
- Dashboard instant-read direction is now explicitly allowed in SPEC: the matrix remains the evidence-backed detail layer, but the candidate may first see a non-score graphical snapshot such as a constellation, compass, or related qualitative preparedness surface.
- Dashboard instant-read implementation now has a recallable nine-slice plan in [Instant Read Surface Plan](./04-architecture/instant-read-surface-plan.md). The current rendered snapshot is a first foothold, not the final interaction model: it derives a qualitative overall coach read, three lane nodes, and category coverage marks from the same selected-target-interview evidence as the matrix.
- Dashboard Preparedness Map now renders through one `PreparednessMapExperience` boundary: Quick View is the default instant-read view, Details is the explicit breakdown toggle, and existing lane/category/cell drilldowns are preserved behind the shared interaction contract.
- Dashboard Quick View copy now avoids candidate-visible implementation language such as "evidence map" and "signal"; the toggle uses short non-overflowing labels, and snapshot helper text now speaks in terms of practice, question types, and next focus.
- Dashboard Quick View now has a first Recharts-backed instant-read surface: a two-level Answer Skills ring for Substance, Structure, and Delivery plus their child dimensions, and a rounded Question Mix pie sized from planned question counts with practiced coverage reflected visually. It stays candidate-facing, non-score, and derived from the same selected-target-interview evidence as the matrix.
- Dashboard Quick View Answer Skills child slices now use dimension-level preparedness state from the score-driven read model when available instead of inheriting the parent lane color. Dimension states are weighted by score count across scoped selected-target sessions and fall back to parent-lane state only for legacy/scoreless rows.
- Dashboard Quick View Question Mix now has a clearer release contract: planned category counts determine the total pie distribution, each category can split into practiced and upcoming arcs, practiced arcs use the scored preparedness state, and upcoming arcs stay muted so unsubmitted planned questions do not read as weak performance.
- Dashboard Quick View Answer Skills and Question Mix pie slices now own the lane/category interaction model. Hover/focus updates the concise coach read in place, click/tap opens the same lane/category evidence surfaces used by Details, and the former lower lane/category cards are deprecated.
- Dashboard read model now preserves planned/generated question category coverage before any answer has been submitted or scored. Fresh active sessions can show a segmented Question Mix pie from generated question categories while keeping all category states `to practice` until scored practice evidence exists.
- Dashboard Practice Next now exposes a visible Upcoming practice items list. Active sessions show every unanswered planned question from the selected target interview first; completed-only contexts fall back to the non-strong Preparedness Map cells so the recommendation surface can prove what it understands instead of hiding all but one next action.
- Dashboard Practice Next now also has a release-basic coverage baseline: `PracticeCoverageBaseline` is derived from the same shared `QuestionPlan`, dashboard rows parse persisted `questionPlanSnapshot`, and completed-only contexts show missing planned category coverage before lower-scoring Preparedness Map cells.
- Shared question-category presentation now recognizes canonical planned category ids such as `culture_fit`, `technical_role_specific`, and `case_scenario`, so planned sessions do not fall through to General/empty dashboard categories.
- Candidate shell dimensions now match the recruiter shell more closely: desktop sidebar width uses `w-64`, and app-page main content uses the recruiter-style responsive padding rhythm while preserving the simpler two-link candidate navigation.
- Answer feedback now prefers `coachSignal` over legacy `oneBigUpgrade`; new generation asks for `coachSignal`, session feedback labels it "For the biggest lift", and dashboard/read-model adapters only use `oneBigUpgrade` as older-row fallback.
- Dashboard empty state now mirrors the populated dashboard grammar with a friendly start message, muted Answer Skills and Question Mix chart previews, and a Practice Next-style create-practice surface.
- Production `/practice` direction is now host-launched only; manual setup remains normal for local development.
- Platform launch prepProfile migration reference exists for future TalentArbor/RangamWorks job-listing integration.
- Interview preparedness signal contract exists with immutable lane ids and qualitative evidence states.
- Preparedness signal map documents the release pivot: Substance, Structure, and Delivery lanes derive from hidden numeric scores on completed sessions; Role Fit is out of release scope; Interview Range becomes the category axis in the Preparedness Map matrix.
- Question Category Contract now defines the category axis as interview-demand indicators: Screening, Behavioral, Culture/Fit, Scenario, and Technical/Role-Specific. It distinguishes Behavioral as real past examples from Scenario as imagined work situations, defines resume/JD usage by category, and separates category coverage from performance-lane scoring.
- Screening Basics question generation now has an explicit screening-only bucket for interest, background, and availability/logistics questions.
- Dashboard Preparedness Map now aggregates signals across all scoped selected-target-interview items, not only the latest session card.
- Latest clear/strong evidence promotes a signal immediately; repeated weak evidence can pull state down.
- Resume/JD context is treated as source evidence and framing, not as a standalone lane.
- Question planning now has a deterministic `QuestionPlan` service that maps interview stage plus question count into canonical category slots before AI question text generation.
- Candidate `/practice` now exposes interview stage and question count as first-class Interview Details controls. Its balanced-practice stage merges "not sure" and "no interview scheduled" into one candidate-facing card stored as `practice_only`.
- Candidate practice drafts and sessions now persist `interviewStage`, and candidate question snapshots use `QuestionPlan` ordering when a stage is present while preserving legacy `interviewType` ordering as fallback.
- Candidate-created sessions now persist the resolved `QuestionPlan` as `session.intakeData.questionPlanSnapshot`, including stage, normalized question count, category counts, and ordered slots. This snapshot is the immutable planned sampling contract for that round and is available for dashboard coverage/recovery logic without rebuilding from mutable setup state.
- Shared answer analysis now records `candidate_app` only for candidate-led sessions with candidate/prepProfile context and otherwise records `recruiter_app` for recruiter-invited sessions.
- Candidate-only answer feedback coaching (`coachSignal` / "For the biggest lift") is opt-in at the feedback drawer and enabled only from candidate session surfaces; recruiter-invited sessions keep the existing shared feedback flow without that candidate-only block.
- Recruiter `/recruiter/create` now has an Interview Details block for interview stage and question count, shows the AI/manual question-entry buttons directly once the step is visible, keeps those buttons disabled until job details are complete, and passes stage/count into the shared question-generation request for AI-quality observability and prompt context.
- Recruiter `/recruiter/create` now shows a category distribution confirmation before manual/generated question fields are revealed, using the shared deterministic question plan to summarize Screening, Behavioral, Culture/Fit, Case/Scenario, and Technical/Role-Specific counts.
- Recruiter `/recruiter/create` now renders the accepted/generated question editor as five plain-language sections in order: Screening, Behavioral, Culture/Fit, Case/Scenario, and Technical/Role-Specific. Manual entry fields are shaped from the confirmed `QuestionPlan`, and AI-generated screening questions are retained instead of dropped.
- Recruiter `/recruiter/create` now enforces the confirmed `QuestionPlan` after either manual or AI selection: zero-count sections stay hidden, generated AI output is trimmed/padded to the planned category counts, and the old two-question technical cap no longer controls the editor.
- Recruiter `/recruiter/create` now replaces the AI/manual action group with a compact accepted Question setup banner after confirmation, gives recruiters a Start over reset affordance that clears only question setup/question text, restores that banner plus the visible question editor when returning from later steps, hides Interview Details while a setup is accepted, updates the confirm-preview Configuration section to the five plain-language categories, and aligns question-confirmation/post-send modal styling with the multistep loader surface.
- Recruiter `/recruiter/create` now treats templates as a third question-entry path beside AI generation and manual entry: Use a Template opens a clickaway/tapaway modal, lists saved templates with category counts and created date, applies the selected template, and shows a Template questions loaded banner. Template use from `/recruiter/templates` enters the same banner/editor state, template-loaded editors show only populated question categories, and AI/template question fields are read-only while manual-entry question fields stay editable. The `/recruiter/templates` card chips now use the five plain-language question categories instead of STAR/PERMA/Tech.
- Shared question generation now repairs schema-valid provider responses that under-fill the confirmed `QuestionPlan`, preserving extra keyed category questions and generating deterministic role-specific fallback questions so recruiter and candidate planned sessions do not silently come back short.
- Shared question generation now uses a `QuestionPlan`-first prompt contract for planned requests: target role, JD, optional resume content, interview stage, and question count are explained as inputs, and provider output may be exact plan-shaped JSON rather than the old fixed 4 behavioral / 5 culture-fit / 1-2 technical pool.
- Candidate `/practice` now promotes interview stage and question count out of Advanced setup into a first-class Interview Details section, keeps the section visually aligned with recruiter planning controls, merges "not sure" and "no interview scheduled" into a single balanced-practice choice stored as `practice_only`, and leaves future Advanced setup hidden until additional intake/customization controls are explicitly scoped.
- Candidate session creation now normalizes `questionCount` through the shared `QuestionPlan` before generating questions, so persisted practice config, generated question count, and the stored plan snapshot share one resolved count.
- Candidate session landing now reads `session.intakeData.questionPlanSnapshot` when available and shows a compact practice-plan summary with resolved stage/count and nonzero category counts before the first question starts. If this UI is absent on a new session, check whether the session is still `NOT_STARTED` and whether the persisted `intakeData.questionPlanSnapshot` is present.
- Candidate session landing practice-plan persistence bug is fixed at the Postgres repository boundary: `PostgresSessionRepository.update()` now preserves arbitrary `session.intakeData` while overlaying repository-managed candidate/token/engagement fields, so newly created candidate sessions keep `questionPlanSnapshot` through the database round trip.
- Shared answer analysis no longer produces legacy `meta.readinessLevel` values. Historical stored analysis payloads may still contain that optional field, but new normal, mock, and fallback analysis outputs no longer write it.
- Practice Next browser validation is cleared for active and completed target-interview contexts: active sessions list all unanswered planned questions first, and completed-only contexts list missing planned category coverage before non-strong matrix improvement items.
- Dashboard Quick View spacing now uses one visual grammar across empty and populated states: the empty dashboard preview reuses the same instant-read surface structure, chart spacing, and dashboard column rhythm as the populated Preparedness Map, while keeping preview controls non-opening.
- Dashboard Quick View card-to-chart migration is resolved as Azure item 810: the Answer Skills ring and Question Mix pie now carry the previous lane/category card hover and open-detail behavior, while the lower duplicate card groups have been removed from the populated and empty Quick View surfaces.
- Dashboard Practice Next planned-coverage baseline is resolved as Azure item 809: active sessions list unanswered planned questions first, and completed-only contexts list missing planned category coverage before score-derived improvement cells.
- Dashboard Quick View focus-state refinement keeps parent lane slices on their own preparedness-state color when focused, applies lifted/glowing treatment without forcing green segments to blue, and restores the overall read when the segment is no longer hovered/focused or Escape is pressed.
- Dashboard Quick View modal opening now belongs to the chart segments instead of the deprecated selected-read action button: parent lane slices, outer dimension slices, and question mix slices open the existing lane/category drilldown modals directly, with outer dimensions still opening their parent lane modal.

## Current State And Context

The current dashboard is useful as a visual shell and read-model proof, but it is not yet the final interview-preparedness product.

Known current behavior:

- Dashboard target-interview scoping is a first pass based on unfinished-session priority, explicit target-role selection, and target role title.
- Preparedness Map UI now consumes the score-driven release read model when answer score payloads are available, while older scoreless rows retain the legacy fallback path.
- Matrix row headers, lane column headers, and matrix cells now open first-pass modals using the same Q/A card and coach-read interaction as lane drilldowns.
- Matrix axis affordances are now explicit: row and column headers are actionable controls, and the grid uses continuous row/column hover/focus underlays instead of tiny transparent pills or per-cell axis highlighting.
- Question coverage cards can include generated-but-unanswered questions as Upcoming coverage context; unanswered questions do not count as zero-score practice evidence.
- Dashboard Q/A evidence now reads answer modality from persisted `answers.modality` before analysis metadata. Submit and analysis recovery paths persist/reconcile voice modality canonically, and migration 005 backfills older voice-analysis rows.
- Dashboard My Read detail copy is now structurally formatted from existing candidate-safe evaluation text; no additional model call is made for the formatting pass.
- Practice Next prefers `coachSignal` and uses "biggest lift" language. Older rows with `oneBigUpgrade` still map through a compatibility fallback. The visible list now differentiates literal active-session upcoming questions, completed-session planned coverage gaps, and score-derived improvement cells.
- Previous sessions are filtered to the selected target interview role, but same-title/different-JD switching still needs a real profile manager later.
- Drilldowns now show session-grouped, capped Q/A evidence cards instead of raw source-ref preview rows. Browser validation item #1 is cleared; category chart state/order now follows the score-driven release contract.
- Empty dashboard state is now a visual preview of the eventual dashboard rather than a sparse placeholder checklist, and it uses the same two-chart vocabulary as populated Quick View.
- Quick View pie slices now open lane/category details directly, the lower guidance card is the selected-read surface, and overall read is the persistent default whenever no segment is hovered, focused, tapped, or armed. Full-page tests cover parent lane, outer dimension, and category-slice modal opening; the next pass should continue validating this on real mobile and desktop browser surfaces before resolving DASH-S24.
- Confidence measurement has not landed.
- Runtime PII/sensitive-data scrubbing and QA masking are still open hardening items.
- Host launch token/auth details are not finalized, so platform launch schema changes are documented but not implemented.
- Recruiter create now exposes interview-stage/question-count planning, category distribution confirmation, and five-section question editing as a first pass. The recruiter stage list omits the candidate-facing "Not sure yet" option and labels the balanced `practice_only` plan as "General practice." The accepted editor now follows the confirmed plan for both AI and manual entry, accepted setup survives navigation back from later create steps, template-loaded editors show only populated template categories, AI/template question text is locked, manual-entry question text remains editable, and Start over clears only question setup/question text while leaving job details intact.
- Question generation has a server-side plan repair guard: if the model returns a valid but under-filled planned response, the service adds deterministic fallback questions and the recruiter create page preserves extra keyed generated questions instead of remapping through fixed legacy templates.
- `interviewStage` plus `questionCount` is the new setup contract for planned generation. Legacy `interviewType` is still present for older candidate setup/read fallback and should not be deleted until older-row behavior is reviewed.
- Legacy answer-analysis `meta.readinessLevel` remains tolerated by the domain schema for older rows but is no longer produced by the active AI service. Dashboard preparedness should continue to use score-driven lane/category state, not readiness-level metadata.

Active docs now use this lighter stack:

- [SPEC](./SPEC.md) for product intent and scope.
- [DATA_CONTRACT](./DATA_CONTRACT.md) for system primitives and naming.
- [HANDOFF](./HANDOFF.md) for this active execution snapshot.
- [Decision Records](./08-decisions/README.md) for durable why-decisions.
- [Platform Launch PrepProfile Migration](./04-architecture/platform-launch-prepprofile-migration.md) for future host-platform schema integration.
- [Preparedness Signal Map](./04-architecture/preparedness-signal-map.md) for low-level signal and lane evidence tracing.
- [Question Category Contract](./04-architecture/question-category-contract.md) for interview-demand category definitions, resume/JD usage, and category indicator semantics.
- [Instant Read Surface Plan](./04-architecture/instant-read-surface-plan.md) for the nine-slice dashboard snapshot trajectory.

Older detailed docs remain available as reference and should not be deleted before a release milestone.

## Immediate Next Step

Resolve the dashboard preparedness presentation contract before adding more visual polish.

Recommended next implementation slice:

1. Browser-validate DASH-S24 / Azure 811 on desktop and mobile-sized viewports: green parent lane slices should stay green on hover/focus, chart segment activation should open the matching modal, the guidance card should return to overall read on mouseout/blur/Escape/tapaway, and mobile should keep first-tap reveal plus second-tap modal open.
2. Define when, where, and how snapshot versus current-state UI appears. This remains the last large unspec'd dashboard behavior before the current release scope can settle.
3. Continue product tuning of matrix cell state and category-scoped My Read copy against more realistic sessions.
4. Add dev-only dashboard seed scenarios once the UI is mature enough to validate quickly: multiple fake candidates, active/paused/resumed sessions, partially answered plans, completed multi-round histories, and changing session-over-session evidence.
5. Continue recruiter `/recruiter/create` browser validation: confirm generated and manual planned-section question behavior persists invites/templates correctly, including read-only AI/template fields, editable manual fields, the five-category Configuration preview, back-navigation restoration behavior, and 7/10/Other question counts that allocate multiple case/scenario or technical slots.
6. Keep recruiter-invited answer feedback behavior stable while shared generation/planning changes continue.
7. Browser-validate candidate `/practice` Interview Details parity: stage/count should be visible without Advanced setup, the merged balanced-practice card should post `practice_only`, and generated candidate sessions should still receive a deterministic question plan.
8. Keep recruiter resume-aware question generation parked until batch-invite UX and candidate-specific resume context are deliberately scoped.
9. Keep completed-session route recovery queued as lower priority until dashboard release behavior is otherwise stable.
10. Queue the new candidate experience extensions: generation-to-session coaching carousel, optional target interview date, and bite-sized practice paths.

## Current Risks

- Same-title/different-JD prep profiles are not distinguishable in the dashboard until a profile switcher or stricter profile selector lands.
- Practice Next now exposes active-session pending questions, completed-session planned category gaps, and non-strong matrix cells, but the completed-session coach-configured next round still needs product tuning before it can confidently generate a planned follow-up session from cross-session patterns.
- Dashboard matrix cell state is derived from currently available lane-specific category score states; browser validation against real sessions should confirm whether the state feels interpretable before adding more visual polish.
- The matrix is likely too analytical as the first dashboard read; the next design decision is how to give candidates an encouraging instant-read surface while keeping the matrix available as the evidence-backed detail view.
- The instant-read plan must be reloaded before dashboard snapshot work: [Instant Read Surface Plan](./04-architecture/instant-read-surface-plan.md). The current snapshot is a low-risk Recharts implementation with qualitative labels, lane/category tap targets, no new persistence, and no hidden scoring exposed. The Answer Skills ring now uses dimension-level state when score-driven analysis is available, while legacy/scoreless rows still fall back to parent-lane state. The Question Mix pie now carries planned distribution plus practiced/upcoming coverage; future polish should not collapse those meanings back into a single category-color segment.
- The current design prototype explores a front/back card: front snapshot, back matrix. Its category labels were removed from the constellation front so the snapshot stays fast; category distribution can still be represented by quieter dots or later interaction.
- Matrix axis orientation is still a product/design decision, not a settled rule. Categories-as-rows fits portrait mobile, while lanes-as-rows may foreground the coaching domains more clearly.
- The prototype's inline guidance card competes with the current nested modal drilldown model. Decide whether it becomes a lightweight selected-cell preview, replaces first-level modals, or coexists as an overview affordance while modals keep deeper Q/A evidence.
- `QuestionPlan` now informs both candidate `/practice` and recruiter `/recruiter/create` generation context, recruiter create shows a distribution confirmation, and the editor renders only the planned plain-language category sections. Server-side generation repair and recruiter mapping preserve planned category counts, but high-count browser/product validation should still sample 7/10/Other cases.
- Candidate session `questionPlanSnapshot` is now available for future comprehensive To Practice logic. The next implementation should decide whether dashboard gaps compare current scored evidence against the persisted session plan, an evolving prep profile plan, or both.
- Candidate `/practice` now makes stage/count first-class controls, but browser validation should still confirm the promoted section works with candidate draft restore, question generation, and local/dev auth identities.
- Category coverage cards now have drilldowns and score-driven ordering, but category-scoped coach-read copy remains first-pass and needs product tuning against more realistic sessions.
- Legacy `oneBigUpgrade` can still exist in persisted payloads, but current read paths should treat it as compatibility fallback only.
- Sensitive data can still be too visible in AI-quality/debug surfaces until masking/redaction work lands.

## Refresh Rule

At the end of each meaningful work session, rewrite this file so the next session can resume without reading the full doc set.
