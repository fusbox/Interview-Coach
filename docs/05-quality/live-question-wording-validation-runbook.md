# Live Question Wording Validation Runbook

Status: Ratified implementation contract
Last updated: 2026-07-18

## Purpose

This runbook defines the explicit credentialed quality gate for the pinned production question-wording profile. It uses one fixed synthetic setup and no candidate database rows. Ordinary tests, builds, local app startup, previews, and candidate requests never run this harness automatically.

## Execution Guard

Live execution requires all of the following:

1. `npm run qa:candidate:question-wording-live`;
2. CLI acknowledgement `--confirm-live-provider`;
3. `CANDIDATE_QUESTION_WORDING_LIVE_TEST=true`;
4. `CANDIDATE_QUESTION_WORDING_PROVIDER=google_genai`;
5. `CANDIDATE_QUESTION_WORDING_PROFILE=google_gemini_2_5_flash_question_wording_v2`;
6. a nonblank server-only `GEMINI_API_KEY`.

From PowerShell:

```powershell
$env:CANDIDATE_QUESTION_WORDING_LIVE_TEST="true"
$env:CANDIDATE_QUESTION_WORDING_PROVIDER="google_genai"
$env:CANDIDATE_QUESTION_WORDING_PROFILE="google_gemini_2_5_flash_question_wording_v2"
cmd /c npm run qa:candidate:question-wording-live -- --confirm-live-provider
```

The script loads `GEMINI_API_KEY` through the normal Next environment loader, including `.env.local`. Missing or mismatched controls fail before transport assembly. Remove the live-test flag after manual use; candidate-serving configuration does not require it.

## Synthetic Case

The code-owned case is a five-question first-interview round for a synthetic Warehouse Quality Inspector. It supplies a short synthetic JD and resume context and exercises Screening, Behavioral, Culture / Fit, Scenario, and Technical / Role-Specific slots.

The harness inspects the exact provider configuration and outbound synthetic envelope in memory. It does not read or write candidate identity, setup drafts, prep contexts, sessions, answers, evaluator rows, or Coach Update artifacts.

## Artifact Contract

Successful or safely classified failed runs write an ignored JSON artifact under:

`AI-eval/candidate-v2/question-wording/`

The artifact contains:

- safe synthetic case summary;
- exact profile/model/prompt/configuration identity;
- transport-attempt count, latency, and token counts;
- validated generated question text for human review;
- named automated validation facts;
- explicit privacy and retention declarations.

It does not contain the JD, resume text, provider request, assembled prompt, raw provider output, API key, candidate identity, or database identifiers. Files use exclusive creation and never silently overwrite prior evidence.

## Human Review

After the automated gate passes, review every question for:

- relevance to the synthetic role and JD;
- correct plan category;
- clear, respectful, focused wording;
- distinction from every other question in the round;
- resume use only as helpful transferable context, without unnecessary disclosure;
- no scoring, ranking, grading, hiring-decision, or implementation language.

The harness does not pretend these semantic judgments are fully automatable. A passing artifact reports `humanQuestionReview: required`.

## Failure Behavior

- Provider/runtime errors are reduced to safe error code and retryability only.
- Provider exception bodies are not printed or retained.
- A rejected or failed provider result makes the command exit nonzero after producing safe evidence when possible.
- An interrupted process may leave no artifact; rerun creates an independent execution.
- The harness performs one transport attempt and no hidden retry.

## Acceptance Evidence

Slice-level conformance requires guard tests, mocked accepted/failure artifacts, artifact privacy checks, focused question-wording tests, TypeScript, the candidate suite, and one credentialed accepted artifact. Release readiness separately requires disposable-DB/browser reconciliation and the broader deployment/release gates.

The first credentialed run on 2026-07-18 produced artifact `live_question_wording_d2e342492a3c518f` under configuration fingerprint `300555f7ae43ff7a24cc3c0b89320972a7781d098fb51d5803982cbd662e8404`. It completed in one transport attempt, passed every automated validation, and received a human review finding of relevant, category-aligned, distinct, appropriately grounded questions. Its behavioral and scenario prompts used related subparts within one competency rather than unrelated stacked questions.

## Disposable Integration Reconciliation

After the synthetic provider gate, run the integration checks against the disposable smoke database:

```powershell
npm run db:smoke-candidate-readiness
npm run db:reconcile-candidate-question-wording
$env:CANDIDATE_QUESTION_WORDING_BROWSER_TEST="true"
cmd /c npm run qa:candidate:question-wording-browser -- --confirm-live-provider
Remove-Item Env:CANDIDATE_QUESTION_WORDING_BROWSER_TEST
```

The DB reconciliation rolls back all writes and makes no live provider call. It proves accepted production-profile identity persists with the wording snapshot, repository recovery returns the immutable snapshot, provider failure creates no session and leaves trusted setup staging unconsumed, and a follow-up round copies exact source wording without another generation call.

The guarded browser reconciliation makes one live wording call using a synthetic role and the seeded primary candidate. It proves the generated session reaches the pre-session landing, the first saved question renders in the live session, and refresh recovers the same immutable wording. It cleans up its generated session and prep context and must never become an ordinary CI or startup side effect.

The first disposable integration reconciliation passed on 2026-07-18. The rolled-back DB harness confirmed persisted configuration identity, immutable repository recovery, no session or trusted-staging consumption on provider failure, and exact follow-up wording reuse with zero generation calls. The guarded browser harness then passed with three generated questions under configuration fingerprint `300555f7ae43ff7a24cc3c0b89320972a7781d098fb51d5803982cbd662e8404`, including ready landing, live Q1 rendering, and refresh recovery.
