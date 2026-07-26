# AI Eval Scenario Lab Milestone Evidence

Date: 2026-07-24
Slices: 184-187
Verdict: `accepted_local_calibration`

## Milestone Contract

The milestone establishes a rapid, durable calibration loop for the evidence-first coaching engine without changing candidate or recruiter serving behavior. An individually granted operator can stage exact synthetic scenario versions, queue deterministic or explicitly credentialed runs, recover provider work through generation-fenced checkpoints, inspect every candidate-visible session, summary, and dashboard projection, and compare compatible same-profile runs.

The browser never owns provider execution. Credentialed work requires the separate worker, an explicit database target, exact serving-profile and configuration identity, configured call and cost ceilings, the live environment gate, and `--confirm-live`.

## Senior Milestone Findings

1. **Serving and QA semantics remain aligned.** Scenario execution reuses the production evaluator, immediate-feedback, transcript-canvas, Coach Update, invited-summary, and candidate-dashboard projection seams. It does not maintain a QA-only coaching implementation.
2. **Run and operation recovery are durable.** Immutable scenario/run identity, request replay, renewable generation-fenced claims, accepted provider-operation checkpoints, and terminal layer persistence keep browser loss, stale workers, and response loss from silently duplicating accepted work.
3. **Access and content boundaries remain narrow.** Every route and mutation rechecks the separate individual grant. Scenario material is synthetic, source-detail access is audited, and workflow audit remains metadata-only.
4. **The credentialed calibration gate is complete.** Two initial four-case runs established representative operator acceptance. Slice 187 then landed the V9 remediation, completed a 13-case targeted run and all 32 V3 baseline cases without provider/runtime failure, corrected the sole remaining semantic assertion, and confirmed that correction with a one-case credentialed rerun.
5. **Fault isolation and representative regression are durable.** Deterministic tests cover output-layer provider faults without discarding independently completed layers. The contradicted-technical-evidence appraisal defect is now a focused evaluator regression. Future provider or teaching-quality findings should be promoted only when they represent a reusable engine or harness invariant.

## Verification Evidence

- `npm run test:ai-eval-workbench`: 90 tests passed.
- `npm run test:candidate:evaluator-configuration`: 135 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run db:smoke-ai-eval-scenario-workspace`: passed after applying migrations `037-040`; it proved the 32-case baseline, draft replay/conflict/revision/staging, fixture execution/recovery, credentialed-run preview/queue/claim controls, provider-operation checkpoint recovery, immediate grant revocation, retention, and metadata-only audit without calling Gemini.
- Credentialed targeted run `41156027-047d-4a52-923e-2f5bf5f06aab`: 13 of 13 cases completed, zero execution failures, run result `review_required`.
- Credentialed complete-baseline run `3beb6f8f-b319-4e1c-80c6-e00a0b522c29`: 32 of 32 cases completed, zero execution failures, and one semantic assertion that exposed the contradicted-technical-evidence appraisal defect.
- Credentialed confirmation run `0af3f5ad-04da-43e1-bab1-0952c2719e0e`: `confidently_wrong_database_indexing` completed with zero execution failure and no semantic failure; `review_required` remains only for operator judgment of teaching quality and naturalness.
- All three V9 confirmation runs used profile `google_gemini_2_5_flash_v1+google_gemini_2_5_flash_coach_update_v1` and configuration fingerprint `50cb6026239b5699db464326b07e0c30995ac6583185a6dd4e757d95702277f1`.

## Bounded Deferrals

- Select a deployed worker/runtime, retention cleanup job, alert sink, grant/revoke procedure, and production masking evidence.
- Prove the selected worker, cleanup, alert, grant/revoke, and masking controls in the deployed environment before treating this local calibration as release evidence.
- Keep alternate-profile A/B deferred until the single-profile calibration loop is mature enough that comparison would change a concrete decision.

## Slice 187 Follow-Up

On 2026-07-24, credentialed V9 run `41156027-047d-4a52-923e-2f5bf5f06aab` completed all 13 requested cases with zero execution failures and a run-level `review_required` result. Fresh complete-baseline run `3beb6f8f-b319-4e1c-80c6-e00a0b522c29` then completed all 32 V3 cases with zero execution failures under configuration fingerprint `50cb6026239b5699db464326b07e0c30995ac6583185a6dd4e757d95702277f1`.

The complete run retained one semantic failure in `confidently_wrong_database_indexing`: the trusted-reference path correctly produced `technicalAccuracy: contradicted`, verification, revision-oriented coaching, and the `technical_accuracy_contradicted` gap, but the deterministic appraisal promoted `impact_judgment_takeaway` to `clear` because it counted the candidate's false no-cost claim as a valid tradeoff signal. The appraisal now preserves that observed evidence while preventing a signal supported only by contradicted spans from promoting the quality band. Focused evaluator and scenario coverage is green. Run `0af3f5ad-04da-43e1-bab1-0952c2719e0e` confirmed the corrected case without semantic failure.

## Verdict

`accepted_local_calibration`: the scenario-lab architecture, complete V9 corpus, deterministic provider-fault behavior, semantic remediation, and targeted confirmation are accepted for continued engine-quality and serving work. This is not deployment, organizational provider approval, or production-release evidence.

## Slice 190 Staged Calibration

Focused V11/V5 run `5acbf16b-1b6e-44c8-8219-20583ff8c730` requested 11 technical-framing cases plus seven journey dependencies. Fifteen of eighteen cases completed; three failed execution and three completed with semantic assertion failures.

- `application_support_diagnostic_workflow` and `healthcare_approved_procedure_verification` reached accepted extraction, then lost every downstream layer when first-pass feedback composition used ungrounded technical-correctness language. V4 had completed both but leaked praise such as `strong, practical diagnostic workflow` and `strong understanding of professional boundaries`; V5 improved safety but regressed coaching availability.
- `skilled_trade_equipment_verification` accepted answer evaluation, then lost only Coach Update because synthesized language failed the same candidate-language boundary. V4 completed but relied on looser validation.
- `technical_reference_boundary_journey` correctly distinguished supported, contradicted, and not-assessed evaluator facts, but Coach Update praised the not-assessed `/26` choice as strong understanding and asked when it would be optimal. V4 was no safer: it called the answer good subnetting understanding. V5's stronger assertion correctly made the persistent defect visible.
- `confidently_wrong_database_indexing` correctly remained `contradicted`, but V5 promoted organization from V4's `emerging` to `strong` because false technical assertions were counted as multiple organization signals.
- `generic_culture_fit_answer` moved from V4's `usable`/strong-focus appraisal to `thin`/emerging, matching the ratified thin-answer contract; its old expectation was stale rather than the evaluator behavior.
- V5 Coach Update also exposed internal `technical accuracy was not assessed` wording in five otherwise completed outputs. V4 was more generic and did not show that status leak.
- Two completed atomic appraisals also need operator attention after the fix-now boundary: `administrative_record_control` lost V4's correctly observed specific-detail marker despite naming concrete record and meeting checks, while `sales_crm_follow_through` lost V4's reasoning signal despite explaining that follow-up is scheduled while the conversation is fresh. Both remained within their broad scenario expectations, but V5 coaching became less precise. Promote them to tighter reusable assertions only after the V12 focused rerun shows whether the misses persist.

V12/V6 remediation permits one code-directed rewrite only after repairable generated-language rejection, sends no rejected prose back to the provider, aggregates attempt metadata, and revalidates the rewrite through the same fail-closed boundary. It also blocks internal assessment-status wording, catches the observed subnet-praise construction, caps contradicted technical organization at `clear`, and updates the generic culture-fit expectation to `thin`. This section records staged remediation only; accepted V9/V3 calibration remains authoritative until focused and complete credentialed V12/V6 confirmation.

The first complete V6 non-provider gate also exposed and corrected a baseline-persistence defect before execution: suite V6 had advanced without advancing the immutable per-scenario baseline version, so Postgres correctly rejected the changed `generic_culture_fit_answer` payload as version drift. Baseline payload version and active-picker history visibility are now independent contracts: V6 persists as scenario version 6 while V5 remains visible and V1-V4 remain hidden. Contract-fixture run `833ae5e5-ae18-4732-abe4-5498632d0cac` then completed all 40 cases and all 228 candidate-visible/output layers with zero execution failures. Seventeen layer assertions failed because the deterministic adapter deliberately does not emulate production evaluator reasoning; those results prove assertion plumbing and are not coaching-quality regressions or credentialed acceptance.

Credentialed focused V12/V6 run `9d0a6f58-e84f-41f7-ac38-e53a406f2046` completed all 13 expanded cases and all 24 live provider operations on their first attempt. The bounded repair path was not needed. It proved the technical-language availability fix, but operator review identified two remaining semantic defects: the mixed-technical assertion demanded candidate-facing disclosure of an internal `not_assessed` boundary, and model-owned intervention selection kept looking for routine polish after otherwise sufficient answers. The generic culture-fit answer also regressed from V5's correct `thin` read to provider-authored `usable` despite being very short and containing no example, action, outcome, takeaway, role signal, or category-specific development evidence.

Slice 191 stages V13/V7 as the stable policy correction. Code now normalizes only that bounded underdeveloped-short-answer condition, derives `move_on`, `polish`, or `remediate` from accepted qualitative bands, and reattaches the exact intervention, signal, anchor, and allowed feedback fields in the provider-neutral validator. Strong-only evidence means good enough: no upgrade, redo prompt, or pattern prescription survives. Clear evidence permits one optional refinement without retry pressure. Emerging evidence requires remediation. Coach Update V4 receives the same per-question posture plus one code-selected round-primary framing and a grounded strong-response-pattern example; it may synthesize connected prose but may not stack facts into a different valence. The mixed-technical assertion now enforces supported and contradicted findings plus the existing ungrounded-correctness prohibition without requiring internal disclaimer language. V7 is a new immutable scenario version. Focused credentialed cases `#10`, `#39`, and `#40`, followed by the complete baseline, remain the serving-promotion gate.

Local Slice 191 verification is accepted:

- `npm run test:candidate:evaluator-configuration`: 141 tests passed.
- `npm run test:candidate:coach-update`: 141 tests passed.
- `npm run test:ai-eval-workbench`: 103 tests passed.
- `npm run test:candidate`: 658 tests passed.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build`: passed.
- `npm run db:smoke-ai-eval-scenario-workspace`: passed with 40 baseline scenarios plus worker/retention lifecycle guarantees.

This evidence accepts the deterministic contract and local integration only. It does not promote V13/V7 as the serving calibration before the credentialed gate.

## Slice 192 Question-Preparedness Supersession

Product review after Slice 191 clarified that each canonical practice-plan question needs a transparent progress band, while one weaker criterion must not automatically force remediation. Slice 192 stages prompt bundle V14 and adapter V15. Application code now derives a question result from all five universal criteria, excludes `not_elicited`, returns `incomplete` for an unusable answer or two unavailable criteria, caps one unavailable criterion at `clear`, caps a trusted technical contradiction at `emerging`, and leaves technical `not_assessed` neutral. Category signals remain non-numeric evidence lenses and may use an exact span, whole-answer meaning, or meaningful absence.

The candidate dashboard projection reads immutable attempts and accepted evaluator runs at request time, maps follow-up attempts back to their canonical baseline question, and selects the highest earned rated band. It retains the latest attempt separately so immediate coaching and Coach Update remain truthful even when a later retry is weaker. Unanswered questions stay neutral, and a submitted answer without an accepted evaluator run is `evaluation_unavailable`, not weak.

Local non-provider verification is accepted:

- `npm run test:candidate:evaluator-configuration`: 153 tests passed.
- `npm run test:candidate`: 675 tests passed.
- `npm run test:ai-eval-workbench`: 103 tests passed.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build`: passed.
- `npm run db:smoke-ai-eval-scenario-workspace`: passed with 40 immutable baseline scenarios, fixture execution/recovery, provider-operation checkpoint recovery, access revocation, metadata-only audit, and guarded retention.

No credentialed provider run was performed. By product direction, focused and complete V14/V15 calibration waits for production UI integration and representative live candidate runthroughs. V9 remains the last accepted credentialed serving evidence; V14/V15 is the current locally accepted deterministic contract.
