# Production Evaluator Integration Contract

Status: Ratified
Contract target: `candidate_evidence_first_v2`
Last updated: 2026-07-16

Ratified on 2026-07-16. The Gemini Developer API is the approved first service mode. All proposed decisions below are implementation authority. Vertex AI remains a separate future profile if enterprise requirements later require it; it is not a runtime fallback.

## Purpose

This contract defines how the ratified provider-neutral evidence-first evaluator may call a production model without weakening answer durability, evidence validation, candidate safety, QA reproducibility, or provider-failure recovery.

It is intentionally separate from the provider-neutral [Evidence-First Evaluator Contract](./evidence-first-evaluator-contract.md). The evaluator contract defines what the pipeline means. This document proposes how one production provider implements its three model-owned stages.

No provider adapter, live credential, or production model call should land until this contract is ratified.

## Scope

In scope:

- production provider and serving-model posture;
- stage-specific generation profiles;
- prompt and structured-output rendering;
- credentials and environment selection;
- one-attempt transport and error classification;
- technical-reference behavior;
- safe configuration capture, telemetry, and retention;
- QA A/B isolation and provider-conformance evidence;
- candidate recovery when coaching cannot be prepared.

Out of scope:

- question-wording, Coach Update, TTS, speech-to-text, and media provider wiring;
- QA reviewer UI and export routes;
- raw prompt/output retention;
- technical-reference content authoring;
- provider credentials in source control or local fixtures;
- candidate visual redesign beyond the failure-action contract below.

## Evidence Reviewed

The recommendation is grounded in:

- V1 `AIService.analyzeAnswer`, `ai-config`, provider response parsing, AI-generation capture, and the session-scoped analysis route from `feature/candidate-module`;
- the original refactor pack's evidence extraction, deterministic appraisal, conditional verifier, feedback composition, model-routing, persistence, and golden-test direction;
- the landed V2 evaluator schemas, provider-neutral runtime, durable generation claims, local fault matrix, and candidate-safe projection boundary;
- the repository's existing `@google/genai` dependency, `GEMINI_API_KEY` deployment seam, and prior Gemini/Postgres AI smoke evidence.

Official capability checks on 2026-07-16 confirmed that the Google Gen AI SDK exposes abort, HTTP timeout, JSON response schema, token controls, seed, temperature, and thinking configuration; Gemini structured output still requires application validation; and Google recommends explicit stable model ids for production rather than `latest` aliases. See:

- [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models);
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output);
- [Google Gen AI GenerateContentConfig](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html);
- [Google Gen AI HttpOptions](https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpOptions.html).

## V1 Disposition

| V1 behavior | V2 disposition | Reason |
| --- | --- | --- |
| Session-scoped ownership and exact question/answer context assembly | Preserve | Correct trust and lineage boundary. |
| One shared server-side Google Gen AI client and model registry | Preserve, behind V2 stage adapters | Proven deployment seam without leaking provider code into domain logic. |
| Strict JSON response mode plus runtime schema parsing | Preserve and strengthen | Provider schema constrains syntax; code still owns semantic acceptance. |
| Typed empty/invalid JSON/schema provider errors | Preserve and expand | Needed for safe retry and telemetry classification. |
| One prompt containing extraction, scoring, coaching, and action selection | Retire | Conflicts with evidence-first separation and gives the model too much authority. |
| Model-owned scores and next action | Retire | Code owns appraisal, intervention validation, and candidate projection. |
| Mock or generic coaching returned as successful analysis when configuration/provider work fails | Retire | A saved answer must not acquire fabricated coaching truth. |
| Redacted assembled prompt and raw provider output stored by default | Retire | Redaction is not a sufficient reason to retain unnecessary sensitive artifacts. |
| Provider-specific fields and debug prompts attached to candidate session state | Retire | Internal provider facts cannot cross the candidate-safe projection boundary. |
| Audio attached directly to the answer-analysis call | Defer | Requires the separate approved media/transcription contract. |

## Proposed Decisions

### 1. Provider and service mode

Use the installed Google Gen AI SDK behind provider-specific stage adapters.

The first serving service mode is the Gemini Developer API using the existing server-only `GEMINI_API_KEY` seam. This choice reuses a deployment path already exercised by V1 and avoids introducing a second credential system before quality is proven. The deployed value should still be a dedicated organization-managed key/project for this service and environment, not a personal AI Studio key or an unnecessarily shared credential.

Vertex AI remains a separate future provider profile, not an automatic fallback. If enterprise privacy, regional, identity, or procurement review requires Vertex AI, the app must select an explicit Vertex profile with its own credential and conformance evidence. It must not switch service modes at runtime after a request fails.

Required environment contract:

```text
CANDIDATE_ANSWER_ANALYSIS_PROVIDER=google_genai
CANDIDATE_ANSWER_ANALYSIS_PROFILE=google_gemini_2_5_flash_v1
GEMINI_API_KEY=<server secret>
```

- The key is server-only and must never use a `NEXT_PUBLIC_` name.
- Missing or invalid production configuration fails readiness and leaves the route provider-unavailable; it never selects a mock or fixture.
- `fixture` and `fault` remain explicit local-development modes and cannot inherit a live key.
- Provider, profile, and credential selection are read only from server environment, never request data, URLs, cookies, or persisted candidate state.

### 2. Serving model and promotion posture

Use one pinned serving profile across extractor, verifier, and composer for the first production integration:

```text
profile: google_gemini_2_5_flash_v1
provider: google_genai
model: gemini-2.5-flash
```

Rationale:

- V1 already exercised `gemini-2.5-flash` across real answer-feedback and Postgres capture paths.
- A single model removes provider/model variance while the V2 prompts, schemas, and QA corpus mature.
- Stage descriptors preserve the ability to split models later without changing the evaluator domain contract.
- The explicit stable id avoids silent behavior changes from `latest`; preview and experimental ids are prohibited for candidate-serving profiles.

The current official catalog lists newer stable Flash models. A newer candidate, initially `gemini-3.5-flash` when available in the target account, may run only under `purpose: qa_comparison` against the same fixed case and input fingerprint. Promotion requires the golden/conformance gates below and a new immutable profile id. Recency alone is not a promotion criterion.

### 3. Stage generation profiles

The initial effective profile is:

| Stage | Reasoning posture | Thinking budget | Temperature | Maximum output tokens | Candidate count | Seed |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Evidence extraction | low | 512 | 0 | 4096 | 1 | 0 |
| Conditional verification | medium | 1024 | 0 | 1536 | 1 | 0 |
| Feedback composition | low | 512 | 0.2 | 2048 | 1 | 0 |

For every stage:

- structured JSON output is required;
- thoughts are not returned or persisted;
- tools, grounding, search, URL retrieval, function calling, and provider model routing are disabled;
- the adapter maps the abstract reasoning posture to Gemini 2.5 Flash's numeric `thinkingBudget`, records both values in the immutable manifest, and always sets `includeThoughts: false`;
- unsupported generation settings fail profile construction rather than being silently ignored;
- seed provides best-effort repeatability only and must not be represented as deterministic output.

The runtime remains the only retry owner. Extractor and composer may each receive two runtime-owned invocations under the existing policy. The verifier receives one. A stage adapter performs exactly one provider transport per invocation.

### 4. Prompt ownership and injection boundary

Each stage receives only its existing typed task. Provider adapters do not accept arbitrary prompt strings from routes or callers.

Each renderer must:

1. Build `systemInstruction` only from the code-owned stage policy and stage prompt template.
2. Serialize the task input as a separate user-data JSON payload marked as untrusted data.
3. Keep question, answer, JD, resume, technical references, and prior extracted text out of system instructions.
4. Include the task's input fingerprint in the requested output.
5. Use stage-specific immutable prompt versions under the existing bundle version.
6. Reject undeclared renderer options and never concatenate caller-supplied instructions.

Initial stage prompt versions:

```text
candidate_evidence_extraction_google_v1
candidate_evidence_verification_google_v1
candidate_feedback_composition_google_v1
```

Assembled prompts are ephemeral. They are not written to evaluator rows, telemetry, logs, exceptions, or candidate state.

### 5. Structured output and application validation

Use `responseMimeType: application/json` plus a provider-compatible `responseJsonSchema` for each stage.

Provider structured output is a transport aid, not the acceptance boundary. The adapter must still:

- parse response text as JSON exactly once;
- validate with the existing strict Zod stage schema;
- preserve unknown-field rejection;
- let the evaluator perform fingerprint, exact-span, category, applicability, technical-reference, privacy, grounding, and candidate-language validation;
- reject empty candidates, safety-blocked responses, markdown-wrapped JSON, and schema-valid semantic drift safely;
- treat missing usage metadata as unavailable rather than fabricating counts or rejecting otherwise valid coaching.

The provider supports only a JSON Schema subset. The implementation must generate or maintain a purpose-built provider schema that contains only supported keywords. It must not weaken the code-owned Zod schema. Contract tests must prove required fields, enums, arrays, nullability, and property names stay aligned so the two representations cannot drift silently.

### 6. Transport and failure classification

One adapter invocation performs one `models.generateContent` call with:

- the runtime `AbortSignal`;
- an SDK HTTP timeout no longer than the runtime-provided stage timeout;
- SDK/internal transport retries disabled;
- one pinned model and one response candidate;
- no fallback model, service mode, or request mutation.

The installed SDK version does not expose the newer retry-options surface. Provider wiring must either prove that version performs one HTTP attempt or upgrade deliberately and disable retries explicitly. An SDK upgrade that can change request serialization, retry behavior, schema handling, or model settings requires a profile/configuration-version bump and conformance rerun.

Safe classification:

| Condition | Runtime class | New evaluator run allowed |
| --- | --- | --- |
| Runtime/HTTP deadline | `timeout` | Yes |
| HTTP 429/quota throttle | `rate_limited` | Yes |
| HTTP 5xx/provider unavailable | `provider_5xx` | Yes |
| Authentication, missing key, unsupported service configuration | `misconfigured` | No until configuration changes |
| Other HTTP 4xx or unsupported model/request | `provider_4xx` | No until profile changes |
| Empty, invalid JSON, or stage-schema mismatch | `invalid_schema` | Only under the existing stage retry policy |
| Provider safety block | rejected with `PROVIDER_SAFETY_BLOCKED` | No automatic retry |
| Fingerprint, exact-span, unsafe-inference, verifier, or feedback-grounding rejection | `validation_rejected` | Only when the landed evaluator policy explicitly allows it |

The adapter must not include provider response bodies, candidate content, prompts, JD text, resume text, or credentials in thrown messages. Only safe provider status, operation, stage, and error code cross into runtime classification.

### 7. Candidate failure behavior

V1 preserved session progress during provider failure by returning generic fallback analysis. V2 preserves the useful continuity but retires fabricated feedback.

After a terminal analysis failure:

- the submitted answer remains durable and read-only;
- retryable failures may offer **Try coaching again** as the primary action;
- **Continue without coaching** remains available so provider failure cannot strand the session;
- nonretryable configuration, provider-4xx, safety, or validation failures make continue primary and do not present an endless retry loop;
- continuing records no coached-answer fact, creates no fallback evaluator result, and does not block later session completion or dashboard return;
- Coach Update remains unavailable for that answer until an accepted evaluator run exists.

The production route enforces a bounded server-side recovery policy: at most three candidate-serving evaluator generations for one answer attempt in ten minutes, excluding QA comparison. A new generation is never automatic after the route response; it requires an explicit candidate action and the durable claim rejects both a nonretryable terminal result and an exhausted window. Accepted internal coaching remains restorable without current provider availability.

### 8. Technical-reference posture

No live model may invent the reference used to judge technical or role-specific correctness in the same evaluator run.

For the first production integration:

- `technicalReference` is absent unless a separate trusted adapter supplies a versioned snapshot;
- without that snapshot, technical accuracy remains `not_assessed` and `role_skill_signal` may be `unscoreable` where correctness is required;
- the evaluator may still coach supported answer focus, organization, evidence specificity, practical explanation, and other non-correctness signals;
- candidate copy must not imply that technical correctness was verified;
- lack of broad reference coverage does not block initial production use, provided this fail-closed meaning is preserved.

A later technical-reference adapter must establish source ownership, stable concept ids, version, role/job-family coverage, expiry, disagreement handling, and immutable attachment to the question occurrence. A question-wording model output is acceptable only if its rubric/reference snapshot is versioned, schema-validated, and frozen with that question before the candidate answers. Dynamic web retrieval is not part of answer evaluation.

### 9. Configuration capture and reproducibility

The current evaluator row's provider/model/prompt/evaluator columns identify the pipeline profile but are not sufficient to reproduce stage configuration, especially for a failed run that has no accepted result.

Before live calls, every claim must persist a bounded immutable configuration manifest or equivalent fingerprint containing:

```ts
type EvaluatorConfigurationManifest = {
  schemaVersion: 1;
  configurationStatus: "resolved";
  profileId: string;
  pipelineProvider: "candidate_v2_evidence_first_pipeline";
  serviceMode: "gemini_api";
  adapterVersion: string;
  promptBundleVersion: string;
  evaluatorVersion: string;
  stages: Array<{
    stage: "evidence_extraction" | "verification" | "feedback_composition";
    provider: "google_genai";
    model: string;
    promptVersion: string;
    responseSchemaVersion: string;
    generation: {
      mode: "model";
      reasoningPosture: "low" | "medium";
      thinkingBudget: number;
      includeThoughts: false;
      temperature: number;
      maxOutputTokens: number;
      candidateCount: 1;
      seed: number;
      structuredOutput: true;
    };
  }>;
};
```

The manifest excludes keys, endpoints containing credentials, request content, prompts, and output. Its canonical hash becomes the configuration fingerprint. Any request-affecting change requires a new profile/configuration version; mutating an old profile in place is prohibited.

Deterministic local stages use an explicit `generation.mode: "deterministic"` shape because model settings do not apply. Evaluator rows created by earlier V2 slices are migrated once to `configurationStatus: "pre_manifest_v2"` with unknown service/adapter settings and no invented stages. New evaluator rows must be `resolved`; there is no V1 data accommodation.

The evaluator-run schema and repository persist this manifest and fingerprint at claim time. Do not hide the manifest only inside successful result JSON because failures and rejections also need reproducible configuration lineage.

### 10. Persistence, telemetry, and retention

Keep the landed policy:

- persist accepted parsed extraction, code appraisal, optional verifier result, accepted feedback composition, candidate-safe projection, stage attempts, token totals, latency, and configuration identity;
- persist safe terminal stage, disposition, and error codes for failures;
- do not persist assembled prompts, thoughts, unvalidated raw provider output, answer/JD/resume copies in telemetry, or provider exception bodies;
- do not copy internal evaluator artifacts into session/browser state;
- do not resurrect V1 `ai_generations` raw/prompt capture for normal V2 candidate coaching.

Raw-output capture remains a future opt-in QA exception requiring separate authorization, restricted storage, encryption, masking, retention expiry, deletion, access audit, and a non-candidate-serving purpose. Redaction alone does not authorize retention.

Production enablement also requires confirmation that the selected Google service mode, account, region, and data-handling terms are acceptable for candidate answer, JD, and optional resume processing. That organizational approval cannot be inferred from repository code.

### 11. QA and A/B isolation

Candidate-serving work uses `purpose: candidate_coaching` and may project at most one accepted result for one answer attempt/fingerprint.

Model comparison uses `purpose: qa_comparison` and must:

- reuse the exact fixed evaluator case and input fingerprint;
- identify each immutable profile/configuration fingerprint;
- never write candidate session coaching or alter the selected serving result;
- compare parsed accepted outputs, validation issues, stage metrics, and reviewer annotations;
- exclude source-app as an evaluator axis;
- keep failures visible rather than replacing them with the serving result.

A model/profile promotion requires:

1. provider adapter conformance;
2. the minimum golden set from the refactor pack, including thin, off-topic, sensitive, transferable-experience, voice-fairness, and confidently wrong technical cases;
3. no regression in exact-span, unsafe-inference, applicability, and candidate-language assertions;
4. same-input A/B review against the serving profile;
5. measured latency, token, failure, and retry rates within the 45-second runtime budget;
6. an explicit profile promotion decision and rollback profile.

### 12. Conformance and release gate

Provider-specific code is not ready merely because one live response parses. Required evidence:

- prompt renderers accept only typed stage tasks and keep untrusted content out of system instructions;
- provider schemas align with strict Zod contracts;
- one adapter invocation produces one transport attempt and honors abort/timeout;
- 429, 4xx, 5xx, timeout, empty, malformed, safety-blocked, and schema-invalid responses map to safe runtime classes;
- no prompt, answer, JD, resume, raw output, thought, or key appears in logs, telemetry, evaluator failure rows, URLs, or candidate responses;
- the full slice-116 local failure matrix remains green with the production adapter selected behind mocked transport;
- missing/mismatched production configuration fails closed;
- accepted results preserve the run-id and input-fingerprint completion fence;
- transient and nonretryable browser states both permit session continuity without fabricated coaching;
- a disposable-DB live-provider smoke reconciles one answer attempt, evaluator generations, configuration manifest, accepted internal result, candidate-safe projection, and no hidden session facts;
- deployment readiness verifies that the pinned model id is enabled in the target provider account and has not entered a removal window;
- the golden and A/B gates pass before the profile becomes candidate-serving.

## Recommended Implementation Runway After Ratification

1. Completed in slice 118: extend the evaluator descriptor and durable claim with the immutable configuration manifest/fingerprint; add migration, repository, replay, and QA-export coverage.
2. Completed in slice 119: implement code-owned Google stage profiles, prompt renderers, provider-compatible response schemas, client/config assembly, safe provider-error mapping, and mocked transport conformance tests.
3. Completed in slice 120: wire the `google_genai` adapters into the existing route without changing claim, runtime, completion-fence, or projection ownership.
4. Completed in slice 121: add the continue-without-coaching and bounded recovery policy.
5. Completed through slices 122-123 for the pinned baseline: run the local fault matrix, two credentialed golden gates, same-profile repeatability comparison, and disposable-DB candidate-route reconciliation. Different-profile A/B, human review, and serving-profile promotion remain separate decisions.

The opt-in live-provider harness and redacted review-artifact boundary are governed by the [Live Evaluator Validation Runbook](./live-evaluator-validation-runbook.md). Generated artifacts are local quality evidence, not candidate records or automatic model-promotion decisions.

## Ratified Decisions

1. Use Google Gen AI plus the existing server-only Gemini API key seam for the first adapter. Vertex AI is a separate future profile if enterprise requirements later require it.
2. Use `gemini-2.5-flash` as the pinned serving baseline. Newer stable Flash models remain QA-only candidates until promoted by evidence.
3. Use the specified stage profiles and keep every retry under runtime ownership.
4. Use continue-without-coaching instead of V1-style fallback feedback, including the enforced three-generations-per-ten-minutes recovery cap.
5. Persist a bounded immutable configuration manifest before live calls.
6. Permit technical and role-specific coaching without correctness claims when no trusted versioned technical reference exists.
7. The Gemini Developer API's organizational data-handling posture is acceptable for the first production service mode.

## Slice 119 Conformance Result

The code-owned profile is `google_gemini_2_5_flash_v1`. Slice 119 first landed adapter version `google_genai_evidence_first_adapter_v1`; credentialed and manual-browser findings advanced the request-affecting contract to `google_genai_evidence_first_adapter_v10`. The extractor, optional verifier, and composer each call the injected standard `models.generateContent` transport exactly once per adapter invocation. The existing provider-neutral runtime remains the sole owner of stage retry and aggregate timeout behavior.

System instructions contain only code-owned stage policy and templates. Question, answer, role, JD, resume, technical-reference, and extracted candidate content are serialized only inside a separately marked `untrusted_candidate_data` user envelope. Caller-provided task policy values are ignored by the renderer. Responses request `application/json` plus a provider-compatible subset of each strict Zod schema; application parsing remains authoritative and rejects invalid JSON, Markdown-wrapped JSON, unknown fields, and all other schema drift.

The standard SDK assembly receives server-selected key material only when `google_genai` plus the exact profile are selected. Keys are not returned in the evaluator assembly or configuration manifest. Provider status, abort, safety-block, finish-reason, empty-output, and schema failures normalize to bounded safe codes without retaining provider exception bodies. Safety blocks are nonretryable rejected runs; malformed output remains eligible only for the runtime's existing bounded retry. No candidate-serving route selects this adapter yet, and no credential or live provider call was added.

## Slice 120 Route Integration Result

The candidate answer-analysis route now selects the conformed Google runtime only when `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=google_genai`, `CANDIDATE_ANSWER_ANALYSIS_PROFILE=google_gemini_2_5_flash_v1`, and a nonblank server-side `GEMINI_API_KEY` are all present. Missing or mismatched configuration leaves the route provider-unavailable and never falls back to fixture coaching. Explicit local fixture and fault modes retain their existing nonproduction host-launch gate.

Provider work remains downstream of candidate identity, session ownership, exact answer-attempt recovery, and the durable evaluator-run claim. The runtime refuses to invoke Google without the claimed evaluator-run id. A fresh replay, completed-run projection repair, failed ownership check, or unavailable configuration makes zero Google transport calls. Accepted output must match the claimed run id and shared input fingerprint; the internal accepted run is completed before the candidate-safe session projection is written. Terminal provider failures persist only bounded safe codes and stage-attempt metadata and return generic candidate-safe route content without provider bodies, prompts, credentials, or candidate context.

Mocked route integration proves exact environment assembly, success ordering, replay, pre-ownership denial, safe terminal failure, and runtime-owned retry. No repository credential, live model call, technical-reference source, candidate failure-UI change, or Coach Update provider adapter was added.

## Slice 121 Recovery Result

Candidate answer recovery now uses one provider-neutral capability contract: `pending`, `recoverable`, `retryable`, or `unavailable`. The submitted answer remains locked in every state. Fresh claims may be checked but not duplicated; transient terminal runs can create a later generation only when their persisted validation allows it; configuration, safety, validation, malformed-completed-result, and exhausted-cap outcomes provide continue or finish without coaching instead of an endless retry.

The candidate-serving claim query serializes and enforces both nonretryable terminal policy and the three-generations-per-ten-minutes cap. These controls do not apply to `qa_comparison`. Current runtime availability is derived server-side so missing configuration stays unavailable across refresh and second-tab recovery, while an accepted internal run remains recoverable even if the current provider is absent or has changed. Projection repair parses and fingerprints the stored accepted result and performs no provider transport. Candidate responses and browser/session state contain only the bounded recovery capability; provider code, configuration detail, hidden evaluator facts, and failure bodies remain internal.

## Slice 122 Live Validation Harness Result

The exact pinned Google profile now has an explicit opt-in live quality gate over `candidate_evaluator_golden_v1`. It uses seven synthetic code-owned cases covering thin, off-topic, sensitive-disclosure, transferable-experience, typed/voice fairness, and confidently-wrong technical behavior. Live assembly requires the dedicated command, CLI confirmation, affirmative server environment flag, exact provider/profile, and nonblank key. Ordinary tests, builds, previews, app startup, and candidate routes make no automatic validation call.

Generated ignored JSON artifacts contain the immutable configuration manifest/fingerprint, safe stage outcomes, validation facts, deterministic appraisal summaries, candidate-safe projection, and latency/token metadata. They contain no provider-input fields, evidence quotes, credential, candidate identity, database identifiers, assembled prompt, or raw provider output. Artifact schemas recompute configuration identity, verify candidate-projection fingerprints, require unique case ids, and derive summary/gate counts from case facts. Files use exclusive creation and cannot silently overwrite earlier evidence.

The offline comparison command makes no provider call. It verifies same suite/case/fingerprint input, distinguishes same-profile repeatability from a future different-profile A/B review, records safe output and metric deltas, and leaves human preference unreviewed. At the end of slice 122, a second profile, promotion decision, live credential execution, and disposable-DB/browser reconciliation remained separate work; slice 123 below closes the live execution and reconciliation items only.

## Slice 123 Credentialed Conformance Result

The pinned `google_gemini_2_5_flash_v1` profile passed two independent seven-case credentialed gates under current configuration fingerprint `466f1d3d7f5395346ba8172b952c35c5a5f1a9f182f4ce2014495c208f26ae93`. The offline same-profile comparison found all seven cases comparable; its only flag is the deliberately unresolved human review, and preference remains `not_reviewed`.

Failed live and browser attempts were treated as interface evidence. Gemini rejected the original over-complex serving schema, and accepted generations showed that model-authored offsets, derived markers, missing-evidence codes, immutable envelope identity, intervention discriminants, observed-signal citation cleanup, ambiguous verifier field names, unsupported technical verdicts without references, and prose length compliance were brittle or redundant. The production boundary asks the model for exact quotes, bounded semantic classifications, and candidate-facing language. Application code reattaches immutable identity, computes exact offsets, clears citations from unobserved signals, derives grounded markers and missing-evidence codes, owns sensitive-intervention anchors, forces technical accuracy to `not_assessed` when no trusted reference was supplied, normalizes usable affirm-plus-upgrade feedback to a polish intervention, sentence/word-clips generated prose to contract bounds, distinguishes grounded candidate outcomes from coach-owned scoring, records content-free schema issue paths, and validates the strict internal contract. Verifier tasks distinguish review triggers from unsupported-conclusion reasons and explicitly treat a correctly extracted contradiction as support for the extractor conclusion rather than the candidate claim. Request-affecting changes advanced the evaluator contract to `candidate_evidence_first_v2`, prompt bundle to `candidate_evidence_first_prompts_v6`, and adapter to `google_genai_evidence_first_adapter_v10`.

One local candidate browser submission then used that exact profile after ownership and durable claim. The disposable database showed one immutable answer attempt, one completed generation, the approved configuration manifest/fingerprint, accepted internal stage artifacts, and a matching candidate-safe session projection; the UI rendered staged coaching. This closes the credentialed implementation gate for the pinned baseline. It does not approve deployment account/data-handling readiness, technical-reference retrieval, a second comparison profile, human qualitative preference, or automatic serving promotion.
