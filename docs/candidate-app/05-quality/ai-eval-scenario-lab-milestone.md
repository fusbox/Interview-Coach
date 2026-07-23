# AI Eval Scenario Lab Milestone Evidence

Date: 2026-07-23
Slices: 184-186
Verdict: `conditional`

## Milestone Contract

The milestone establishes a rapid, durable calibration loop for the evidence-first coaching engine without changing candidate or recruiter serving behavior. An individually granted operator can stage exact synthetic scenario versions, queue deterministic or explicitly credentialed runs, recover provider work through generation-fenced checkpoints, inspect every candidate-visible session, summary, and dashboard projection, and compare compatible same-profile runs.

The browser never owns provider execution. Credentialed work requires the separate worker, an explicit database target, exact serving-profile and configuration identity, configured call and cost ceilings, the live environment gate, and `--confirm-live`.

## Senior Milestone Findings

1. **Serving and QA semantics remain aligned.** Scenario execution reuses the production evaluator, immediate-feedback, transcript-canvas, Coach Update, invited-summary, and candidate-dashboard projection seams. It does not maintain a QA-only coaching implementation.
2. **Run and operation recovery are durable.** Immutable scenario/run identity, request replay, renewable generation-fenced claims, accepted provider-operation checkpoints, and terminal layer persistence keep browser loss, stale workers, and response loss from silently duplicating accepted work.
3. **Access and content boundaries remain narrow.** Every route and mutation rechecks the separate individual grant. Scenario material is synthetic, source-detail access is audited, and workflow audit remains metadata-only.
4. **The operator gate was representative, not exhaustive.** Two credentialed runs completed across eight representative scenarios on 2026-07-23. The operator reviewed the resulting outputs and accepted the milestone behavior. Durable run metadata recorded seven `review_required` cases and one semantic assertion failure, with no provider/runtime failure. The complete 32-case baseline was not executed in credentialed mode.
5. **Planned fault and promotion work remains open.** No operator-authored provider-fault scenario or promoted regression case exists in the accepted local evidence. The semantic failure and future representative defects still need triage through the remediation/regression workflow when their remediation value is established.

## Verification Evidence

- `npm run test:ai-eval-workbench`: 86 tests passed.
- `npm run test:candidate`: 662 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed.
- `npm run db:smoke-ai-eval-scenario-workspace`: passed after applying migrations `037-040`; it proved the 32-case baseline, draft replay/conflict/revision/staging, fixture execution/recovery, credentialed-run preview/queue/claim controls, provider-operation checkpoint recovery, immediate grant revocation, retention, and metadata-only audit without calling Gemini.
- Operator-executed credentialed evidence: two completed four-case runs, eight completed cases, zero runtime/provider failures, seven `review_required` outcomes, and one semantic assertion failure. The operator reviewed the outputs and accepted this representative gate.
- No additional credentialed provider call was made during the senior milestone audit.

## Bounded Deferrals

- Execute the complete current baseline through the credentialed profile before provider/model promotion or release evidence is claimed.
- Add deterministic provider-unavailable and malformed-output scenarios that prove every candidate-visible continue-without-coaching path.
- Triage the recorded semantic mismatch and promote only representative defects that warrant a durable remediation/regression case.
- Select a deployed worker/runtime, retention cleanup job, alert sink, grant/revoke procedure, and production masking evidence.
- Keep alternate-profile A/B deferred until the single-profile calibration loop is mature enough that comparison would change a concrete decision.

## Verdict

`conditional`: the scenario-lab architecture and representative live calibration are ready to commit and support continued engine-quality work. They are not evidence that the full corpus, provider-fault matrix, or release calibration is complete.
