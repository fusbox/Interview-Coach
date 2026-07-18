# Live Coach Update Validation Runbook

Status: Ratified implementation contract
Last updated: 2026-07-17

## Purpose

This runbook defines the explicit credentialed validation gate for the first V2 Coach Update serving profile. It proves the exact Google profile can synthesize candidate-safe language from accepted coaching facts, then separates that provider check from disposable-database reconciliation through completion, artifact persistence, replay, and dashboard reads.

This is validation evidence, not automatic deployment approval and not permission to call a provider from ordinary tests, builds, local startup, or dashboard reads.

## Scope

In scope:

- exact `google_genai` / `google_gemini_2_5_flash_coach_update_v1` selection;
- one fixed synthetic case containing first-practice and repeat-practice coaching facts;
- one provider transport attempt with exact model, schema, timeout, and generation settings;
- request exclusion of current/prior raw answers, candidate/session/prep identity, evaluator-run ids, credentials, and source-completion identity;
- strict structured-output, mapping, prohibited-language, telemetry, and privacy checks;
- a redacted ignored JSON artifact containing only safe configuration identity, outcome, latency/tokens, candidate-facing synthesis language, and validation facts;
- a separate disposable-DB completed-round reconciliation through the real completion/repair route, immutable artifact row, duplicate replay, and refreshed dashboard read.

Out of scope:

- a second model or profile;
- technical-reference retrieval;
- background generation jobs;
- final Coach Update or dashboard visual design;
- raw request, prompt, response, answer, identity, credential, JD, or resume retention;
- automatic serving promotion.

## Execution Guard

Live execution requires all of the following:

1. dedicated `npm run qa:candidate:coach-update-live` command;
2. CLI acknowledgement `--confirm-live-provider`;
3. `CANDIDATE_COACH_UPDATE_LIVE_TEST=true`;
4. `CANDIDATE_COACH_UPDATE_PROVIDER=google_genai`;
5. `CANDIDATE_COACH_UPDATE_PROFILE=google_gemini_2_5_flash_coach_update_v1`;
6. a nonblank server-only `GEMINI_API_KEY`.

Missing or mismatched controls fail before transport assembly and make zero provider calls. The harness accepts no provider, profile, model, prompt, case content, or credential from a URL or request payload.

```powershell
$env:CANDIDATE_COACH_UPDATE_LIVE_TEST="true"
$env:CANDIDATE_COACH_UPDATE_PROVIDER="google_genai"
$env:CANDIDATE_COACH_UPDATE_PROFILE="google_gemini_2_5_flash_coach_update_v1"
cmd /c npm run qa:candidate:coach-update-live -- --confirm-live-provider
```

The script loads `GEMINI_API_KEY` from the server environment or `.env.local`, writes with exclusive creation under ignored `AI-eval/candidate-v2/coach-update/`, and prints only the artifact path, safe configuration identity, outcome, call count, and gate status. Remove `CANDIDATE_COACH_UPDATE_LIVE_TEST` after validation; it is not a serving control.

## Artifact Contract

The local review artifact contains:

- exact provider, profile, model, prompt/evaluator versions, and configuration fingerprint;
- accepted, failed, or rejected safe disposition;
- one-call count, latency, and token counts;
- generated title, summary, primary focus, and first/repeat comparison language;
- automated request, mapping, telemetry, and privacy validation facts;
- an explicit human language-review checklist.

It does not contain candidate identity, database/session/profile/attempt/run ids, question text, current or prior answer text, provider request, assembled prompt, raw provider output, exception body, or credential. The candidate-facing synthetic language is retained because it is the behavior under review. An automated pass still requires human review for grounding, usefulness, first/repeat meaning, and misleading progress claims.

## Durable Reconciliation

The synthetic gate never reads or writes candidate rows. Reconcile the application path separately against the disposable database:

1. Start `npm run dev:candidate` with the exact Coach Update tuple and the approved answer-analysis tuple.
2. Use only deliberately entered test content.
3. Complete or replay one candidate-owned round whose latest answered occurrences all have accepted evaluator runs under the current serving configuration.
4. Confirm the completion response remains `200`, reports `coach_update_completed`, and preserves the role-scoped dashboard route.
5. Inspect `candidate_coach_update_artifacts` for one new exact-profile completed attempt with immutable source and synthesis fingerprints, source attempt/run arrays, relational `profile_id`/`configuration_fingerprint` claim identity, matching safe metadata in `validation_json`, and candidate-safe content.
6. Repeat the identical completion request. Confirm it returns the completed artifact, creates no later generation, and emits no second Coach Update runtime telemetry/provider call.
7. Read and refresh the selected prep-context dashboard. Confirm both reads recover the persisted live title/focus and do not show the unavailable state.
8. Exercise an ineligible or provider-unavailable path. Completion must remain durable, partial synthesis must remain absent, and dashboard copy must stay truthful.

Stale-source fencing is deterministic and network-free: the generation service re-reads its source after synthesis and rejects a changed completion or synthesis fingerprint before persistence. Keep this covered by `candidate-coach-update-generation.test.ts`; do not mutate durable candidate evidence merely to force a live race.

## Slice 132 Evidence

The first credentialed synthetic run passed on 2026-07-17:

- final artifact `live_coach_update_f18cc81d46d244d5`;
- exact configuration fingerprint `c98abf8bce3ce0f407b1db0e6359a0b85775adb789a2aaae44fce2dd679e6859`;
- one accepted transport call in 3.5 seconds;
- 599 input and 180 output tokens;
- all automated privacy, configuration, telemetry, structure, and mapping checks passed;
- human review found the summary and primary focus grounded, the first-practice wording truthful, the repeat-practice wording comparative without assuming improvement, and no score/rank/hiring claim.

Disposable-DB reconciliation then used one previously entered five-question round with the current accepted evaluator fingerprint. The senior post-pass found two configuration-identity gaps in the initial evidence: profile/configuration existed only in terminal validation rather than replay claims, and the manifest carried a prompt version label without hashing the exact code-owned system instruction. Migration 019 therefore added immutable relational `profile_id` and `configuration_fingerprint` claim fields with future-insert enforcement while deliberately leaving earlier V2 development rows null rather than inventing history; the manifest now fingerprints the instruction text, response schema, and generation settings. The final migration-aware completion created generation 4 with the current fingerprint in matching physical and validation fields. An identical replay left the rollup at four total historical artifacts, maximum generation 4, one completed current exact-profile artifact, and one current-profile runtime telemetry event. Two dashboard reads returned `200` and recovered the live title and primary focus without unavailable copy.

A different completed round with superseded evaluator fingerprints remained durably completed but reported all five answered occurrences unavailable for current repair; Coach Update synthesis was not attempted and no artifact was created. This is the expected fail-closed eligibility boundary.

The durable validation row contains candidate-owned answers because Coach Update detail is a candidate-owned transcript surface. Those answers were not sent to the Coach Update provider and were not copied into the redacted live-validation artifact or committed documentation.

## Acceptance Evidence

The profile passes this gate when:

- guard tests prove zero transport assembly for every missing or mismatched control;
- mocked tests prove accepted and safely failed artifacts plus privacy-key detection;
- the credentialed artifact passes automated checks and human language review;
- durable completion creates one exact-profile accepted artifact from current evaluator evidence;
- replay produces no new generation or provider telemetry;
- refreshed dashboard reads recover the artifact;
- stale-source and unavailable paths remain fail closed without undoing completion;
- focused and broad candidate tests, typecheck, lint/build as applicable, and diff checks pass.
