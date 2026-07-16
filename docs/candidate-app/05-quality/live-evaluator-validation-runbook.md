# Live Evaluator Validation Runbook

Status: Ratified implementation contract
Last updated: 2026-07-16

## Purpose

This runbook defines the explicit live-provider quality gate for the V2 evidence-first answer evaluator. It proves that the exact candidate-serving Google profile can traverse the provider-neutral runtime and produce inspectable, candidate-safe coaching without making ordinary tests, local development, previews, builds, or candidate routes call a model automatically.

This is validation evidence, not candidate-serving persistence and not a model-promotion decision.

## Scope

In scope:

- the exact `google_genai` / `google_gemini_2_5_flash_v1` profile;
- synthetic fixed golden cases for thin, off-topic, sensitive-disclosure, transferable-experience, voice-fairness, and confidently-wrong technical behavior;
- accepted and safely classified failed/rejected runtime outcomes;
- immutable configuration fingerprint, stage outcomes, latency, token metadata, deterministic appraisal facts, and candidate-safe projection;
- local ignored JSON artifacts for human review;
- offline same-input comparison between two compatible artifacts, including repeatability review of the same profile and future A/B review of different immutable profiles;
- explicit human judgment fields that remain `not_reviewed` until a reviewer records a decision outside the generated artifact.

Out of scope:

- automatic live calls from tests, CI, app startup, preview deployment, or candidate requests;
- capture of assembled prompts, raw provider output, credentials, candidate identity, session/profile ids, email, answer text, question text, job descriptions, resumes, or evidence-span quotes;
- serving-profile promotion or rollback decisions;
- adding or selecting a second model profile;
- technical-reference retrieval;
- Coach Update synthesis;
- rewriting candidate coaching content to make a golden case pass.

## Execution Guard

Live execution requires all of the following:

1. the dedicated `npm run qa:candidate:evaluator-live` command;
2. CLI acknowledgement `--confirm-live-provider`;
3. `CANDIDATE_EVALUATOR_LIVE_TEST=true`;
4. `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=google_genai`;
5. `CANDIDATE_ANSWER_ANALYSIS_PROFILE=google_gemini_2_5_flash_v1`;
6. a nonblank server-only `GEMINI_API_KEY`.

Missing or mismatched controls fail before evaluator assembly and make zero provider calls. The harness accepts no provider, profile, model, prompt, case content, or credential from URL/query data.

From PowerShell, supply the controls for the current terminal only:

```powershell
$env:CANDIDATE_EVALUATOR_LIVE_TEST="true"
$env:CANDIDATE_ANSWER_ANALYSIS_PROVIDER="google_genai"
$env:CANDIDATE_ANSWER_ANALYSIS_PROFILE="google_gemini_2_5_flash_v1"
$env:GEMINI_API_KEY="<server-only-key>"
cmd /c npm run qa:candidate:evaluator-live -- --confirm-live-provider
```

The command prints only the artifact path, safe configuration identity, counts, and gate result. It exits nonzero after writing the artifact when any live case or golden assertion fails. Run it twice to create two independent artifacts for repeatability review.

`cmd /c` is intentional in these PowerShell examples. On the current Windows/npm toolchain, invoking `npm run ... -- ...` directly from PowerShell can consume the forwarded acknowledgement or comparison arguments. Direct `npx tsx` invocation also works, but the documented npm command keeps the operation recognizable and auditable.

Compare two artifacts without a provider call:

```powershell
cmd /c npm run qa:candidate:evaluator-compare -- --baseline "AI-eval/candidate-v2/live/<baseline>.json" --candidate "AI-eval/candidate-v2/live/<candidate>.json"
```

Generated files use exclusive creation and never silently overwrite prior evidence. Remove `CANDIDATE_EVALUATOR_LIVE_TEST` after the run; it is not required for ordinary candidate-serving use of the approved Google profile.

## Synthetic Golden Suite

The first suite is `candidate_evaluator_golden_v1`. Every case is code-owned, synthetic, stable, and has a fixed input fingerprint.

| Case | Primary contract |
| --- | --- |
| Thin answer | Recognize insufficient answer evidence without inventing a strength. |
| Polished off-topic answer | Do not reward polish when the submitted content does not answer the question. |
| Sensitive disclosure | Detect unnecessary private health disclosure and produce a professional reframe without diagnosis or legal advice. |
| Transferable experience | Treat a relevant school/community example as usable evidence rather than requiring formal job-title experience. |
| Strong typed answer | Establish the content baseline for voice fairness. |
| Equivalent voice answer with fillers | Preserve the typed answer's core criterion bands; delivery may receive only a separate light note. |
| Confidently wrong technical answer | Use the supplied versioned technical reference, mark the misconception contradicted, and require accepted verification before coaching. |

The suite gate combines runtime invariants with bounded case-specific assertions. A failed assertion remains visible in the artifact and makes the command exit nonzero after the artifact is written. It must not be hidden by fallback coaching or a different case result.

## Artifact Contract

Generated artifacts live under ignored `AI-eval/candidate-v2/` paths by default. They contain:

- suite version and generation time;
- exact profile id, model, configuration fingerprint, and safe stage descriptors;
- per-case id, category, input fingerprint, accepted/failed/rejected outcome, safe error classification, stage attempts, latency, and token counts;
- answer-usability status, marker booleans, criterion applicability/bands, pattern-gap identity, verification status, and candidate-safe projection for accepted runs;
- named common and case-specific validation facts;
- suite-level voice-fairness and completeness checks;
- explicit retention declarations confirming that prompts and raw provider output were not captured.

Artifacts never contain provider-input fields, source-text snapshots, or evidence-span quotes. The explicitly approved candidate-safe projection may naturally paraphrase or briefly echo synthetic case content because that projection is the behavior under review. Case ids and fingerprints are the review join keys. Generated output is not committed by default because it may change with provider behavior and is review evidence rather than source code.

## Comparison Contract

`npm run qa:candidate:evaluator-compare` compares two generated artifacts offline and makes no provider call. Comparison requires the same suite version, case ids, and input fingerprints. It records:

- baseline and candidate artifact/profile/configuration identity;
- whether the comparison is same-profile repeatability or different-profile A/B;
- per-case outcome, validation, latency/token deltas, and both candidate-safe projections;
- mismatched/missing case, safety, schema/golden, latency, and token flags;
- `not_reviewed` human preference by default.

A generated comparison is evidence for review, not an automatic promotion decision. A different model may enter this path only after it has its own explicit immutable QA-only profile; this slice does not add one.

## Failure And Privacy Behavior

- Provider/runtime errors are reduced to existing safe disposition, stage, error code, retryability, and attempt metadata.
- Provider exception bodies are not printed or written.
- The artifact is written even when one or more cases fail or are rejected, then the command exits nonzero.
- A process interruption may leave no artifact; re-running creates a new independent validation execution and does not affect candidate evaluator rows.
- The live harness does not use candidate identity, candidate DB ownership, or candidate-serving generation claims. The separate disposable-DB/browser smoke remains required before release promotion to prove those application boundaries end to end.

## Acceptance Evidence

Slice implementation is complete when:

- guard tests prove zero transport calls for every missing/mismatched opt-in input;
- mocked live execution proves accepted and safely failed/rejected artifacts;
- privacy tests reject prohibited keys/content and prove generated artifacts contain only the approved shape;
- golden tests prove all required cases and voice-pair comparison are represented;
- comparison tests prove same-input enforcement and no provider invocation;
- ordinary candidate tests, lint, typecheck, and build remain network-free;
- a real live run is reported separately when a developer supplies the credential and affirmative controls.

## Slice 123 Execution And Browser Remediation Evidence

Initial credentialed validation on 2026-07-16 used the exact `google_gemini_2_5_flash_v1` profile and configuration fingerprint `40871f5aebf797c2d3024618bacc41c4cda1642fdc235d9541ab4fcbff47532e`.

- Baseline artifact `live_eval_d11f65859ab1b663`: 7 requested, 7 accepted, 7 passed, gate passed.
- Repeat artifact `live_eval_ace848d1ec423fd5`: 7 requested, 7 accepted, 7 passed, gate passed.
- Comparison artifact `live_compare_7aedda029702f6e0`: same-profile repeatability, 7 of 7 comparable, no safety, golden, latency, or token regression flag; human preference remains `not_reviewed`.

The first credentialed attempts were retained as ignored local evidence and treated as contract findings rather than hidden failures. They exposed an over-complex provider schema, brittle model-authored offsets and derived markers, underspecified sensitive/voice/length boundaries, and one QA-language false positive. That correction kept exact quotes and bounded semantic classifications model-owned while moving immutable identity, offsets, marker derivation, missing-evidence derivation, and sensitive intervention anchors under code ownership.

A disposable-DB candidate browser flow then submitted one typed answer through the same live profile. Reconciliation proved one immutable answer attempt, one completed candidate-coaching generation, the exact approved manifest/fingerprint, accepted internal stage artifacts, a matching candidate-safe session projection, and visible staged coaching. The synthetic gate and browser flow persisted no key, assembled prompt, raw provider output, or copied hidden evaluator facts in candidate session state.

The broader manual browser protocol subsequently exposed a valid Q1 whose composer returned `affirm_and_continue` together with a useful biggest upgrade. The strict validator correctly refused the contradictory internal shape, but candidate coaching became unavailable. Application code now normalizes that usable-answer combination to `polish_then_continue` without changing candidate wording or weakening evidence checks. Credentialed reruns then exposed adjacent brittle boundaries: a grounded candidate-owned school-grade outcome was mistaken for coach scoring, an unobserved category signal carried contradictory evidence ids, a verifier copied the expected technical-contradiction trigger into its unsupported-reasons field, and one voice-case composer response failed schema validation without a useful field diagnostic. The prompt now distinguishes coach-owned evaluation from grounded candidate outcomes, verifier triggers from unsupported conclusions, and a supported extractor contradiction from a supported candidate claim. Code clears citations from unobserved signals, still requires every observed signal to cite accepted evidence, and adds content-free schema issue paths to invalid-schema error codes.

The current validated configuration is evaluator contract `candidate_evidence_first_v2`, prompt bundle `candidate_evidence_first_prompts_v6`, Google adapter `google_genai_evidence_first_adapter_v10`, and fingerprint `466f1d3d7f5395346ba8172b952c35c5a5f1a9f182f4ce2014495c208f26ae93`. Final artifacts `live_eval_196fb6fd160ace41` and `live_eval_79d9b3263cd85691` each accepted and passed 7 of 7; repeatability comparison `live_compare_7a8db71ebade7af2` found all seven cases comparable and retains the required human-review flag. Superseded failed artifacts remain ignored diagnostic evidence.

- Baseline artifact `live_eval_196fb6fd160ace41`: 7 requested, 7 accepted, 7 passed, gate passed.
- Repeat artifact `live_eval_79d9b3263cd85691`: 7 requested, 7 accepted, 7 passed, gate passed.
- Comparison artifact `live_compare_7a8db71ebade7af2`: same-profile repeatability, 7 of 7 comparable; the only flag is the intentionally unresolved `needs_human_review`, and human preference remains `not_reviewed`.

The earlier v5 fingerprint and intermediate failed gates remain historical evidence and are superseded for serving-profile review by the v8/v5/v2 fingerprint above.
