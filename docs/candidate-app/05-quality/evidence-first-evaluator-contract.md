# Evidence-First Evaluator Contract

Status: Ratified executable contract
Contract version: `candidate_evidence_first_v2`
Prompt bundle version: `candidate_evidence_first_prompts_v6`
Last updated: 2026-07-16

## Purpose

This contract turns one immutable submitted answer attempt into candidate-safe coaching without asking a model to make an opaque overall judgment. It is the V2 replacement for V1's score-centered analysis truth. The executable schemas and validators live in:

- `src/features/evaluation-v2/evidence-first-evaluator-contract.ts`;
- `src/features/evaluation-v2/evidence-first-evaluator.ts`.

This contract was ratified on 2026-07-14. The provider-neutral runtime and local fixture exercise the same typed evaluation case, extractor task, deterministic validation/appraisal, conditional verifier task, feedback-composer task, retry budget, and candidate-safe projection boundary. The fixture supplies deterministic stage adapters; it is not a production model. The code-owned Google Gen AI adapter and pinned Gemini profile have now passed mocked conformance, two credentialed synthetic gates, same-profile repeatability comparison, and one disposable-DB candidate-route reconciliation. The candidate answer-analysis route selects that runtime only from the exact server provider/profile/key contract and only after ownership and durable evaluator-run claim authorization. Technical-reference sourcing beyond the synthetic supplied-reference case, production observability, organizational deployment readiness, and serving-profile promotion remain separate fail-closed work.

Live-model quality validation is a separate explicit operation governed by the [Live Evaluator Validation Runbook](./live-evaluator-validation-runbook.md). It uses synthetic fixed inputs and emits only redacted review facts; it does not read candidate data or weaken the runtime's no-prompt/no-raw-output retention contract.

## Pipeline

```text
immutable answer attempt + exact question + role context
    -> model call 1: observable evidence extraction
    -> code: schema, identity, exact-span, category, privacy, and technical-reference validation
    -> code: applicability-first universal criterion appraisal
    -> code: category-specific pattern-gap selection
    -> optional verifier for risky or contradictory cases
    -> model call 2: feedback composition from accepted facts only
    -> code: grounding, intervention, safety, and projection validation
    -> candidate-safe feedback + internal QA/evaluator facts
```

The model extracts evidence and composes language. Code owns acceptance, applicability, qualitative bands, pattern-gap selection, safety gates, and the final projection boundary.

## Fixed Evaluation Unit

One evaluator case is fixed to one immutable `candidate_answer_attempts` row and one exact question occurrence. The input fingerprint covers the provider-visible question, submitted answer, role context, optional technical reference, and approved modality markers.

- Editing an unsubmitted draft creates no case.
- Feedback-triggered retry creates a new answer attempt and therefore a new case.
- Provider retry, timeout recovery, verification, and A/B comparison stay attached to the same answer attempt and fingerprint.
- A later session occurrence of the same planned question is a different case with cross-session lineage.

## Provider Input Policy

Included because it can be necessary to understand the answer:

- exact submitted answer text and modality;
- exact worded question, category, index, and planned purpose;
- target role and interview stage;
- job description;
- optional resume text;
- optional voice mechanics from an approved modality pipeline;
- optional versioned technical reference.

Excluded from provider input:

- candidate profile id, email, or display name;
- launch tokens, cookies, and host-session credentials;
- recruiter identity;
- self-reported confidence as performance evidence;
- earlier model prose, except when an explicit QA job compares retry outputs.

Question, answer, job-description, resume, and role text are all untrusted prompt data. Instructions embedded in those values must never override the evaluator policy.

Provider input is bounded before invocation: target role 120 characters, question text 4,000, planned purpose 1,000, answer text 20,000, job description 12,000, and resume text 24,000. The answer-submit and extraction/OCR boundaries must align with these limits before production wiring so a candidate is not allowed to submit content the evaluator will later reject.

## Evidence Extraction

The accepted extraction contract contains structured facts only:

- input fingerprint and question category;
- answer usability;
- observable answer markers;
- exact answer spans with zero-based start/end offsets;
- allowlisted category signals;
- technical-accuracy status against a supplied reference;
- missing-evidence codes;
- sensitive-disclosure flags;
- unsafe-inference flags.

The provider supplies exact quote strings, usability status, allowlisted category signals, reference-bounded technical status, and safety flags. Code reattaches immutable schema/input/category identity, derives bounded reason codes, locates every quote in the submitted answer to attach zero-based offsets, clears evidence references from signals the provider marked unobserved, derives observable markers from grounded spans/signals, and derives missing-evidence codes from not-observed signals. The model does not author those deterministic fields.

Every hydrated span must satisfy `answer.slice(start, end) === quote`. A quote that cannot be located exactly, plus unknown, duplicate, mismatched, or unsupported references, rejects the extraction before it can drive coaching.

Unsafe inference is distinct from sensitive disclosure:

- A sensitive disclosure is candidate-provided private information. It may lead to a professional privacy reframe without evaluating the disclosed trait or circumstance.
- An unsafe inference is an evaluator attempt to infer or judge accent, native fluency, personality, charisma, appearance, or a protected trait. It rejects the extraction and is eligible for safe re-extraction.

The feedback-composition call does not receive exact evidence spans from a sensitive disclosure. It receives only the disclosure flag, privacy-reframe pattern, and non-content evaluator facts needed to write safe guidance.

## Applicability Before Band

Every universal criterion first receives one applicability state:

| Applicability | Meaning | Band allowed |
|---|---|---|
| `observed` | The answer and question provide usable evidence for the criterion. | `emerging`, `clear`, or `strong` |
| `not_elicited` | The question did not reasonably ask for this evidence. | No |
| `insufficient_data` | The input cannot support a defensible criterion judgment. | No |
| `unscoreable` | A required evaluation reference is unavailable. | No |

The universal criteria are:

1. `answer_focus`
2. `organization`
3. `evidence_specificity`
4. `role_skill_signal`
5. `impact_judgment_takeaway`

Missing, unelicited, private, unusable, or technically unverifiable evidence must not be converted to `emerging`. `Emerging` is an observed qualitative band, not a synonym for missing evidence. The bands are internal evaluator facts and contain no numeric score.

Category lenses interpret those same criteria for behavioral, screening, culture/fit, case/scenario, and technical/role-specific questions. A concise screening answer can be strong for focus and organization while specificity or impact remains `not_elicited`. Non-native grammar and voice filler markers do not alter content bands unless meaning cannot be recovered; an optional delivery note is separate.

## Technical Correctness

The evaluator may emit `supported` or `contradicted` technical accuracy only when the case supplies a versioned technical reference with known concept ids. Otherwise technical accuracy is `not_assessed`, and `role_skill_signal` is `unscoreable` rather than low. The provider adapter enforces this boundary after generation by replacing any provider-authored technical verdict and references with `not_assessed` and empty reference/evidence ids when the request carried no trusted technical reference.

Contradicted technical claims require verification before feedback composition. Partial concept coverage also triggers verification. The future technical-reference adapter must define source ownership, versioning, role-family coverage, expiry, and what happens when references disagree. This remains a production integration decision.

## Conditional Verification

Verification is required when accepted structured evidence would otherwise support a risky claim, currently:

- a technical claim is contradicted;
- technical reference coverage is partial;
- three or more criteria are marked strong from fewer than two evidence spans;
- an off-topic answer somehow receives a strong appraisal.

The verifier can accept, request re-extraction, or declare insufficient signal. Provider tasks call the reasons for independent review `reviewTriggers`, and provider output calls actual problems `unsupportedConclusionReasons`; a trigger must not be copied into an unsupported-reason field. A correctly extracted contradiction means the extractor conclusion is supported even though the candidate's technical claim is not. Candidate feedback cannot be composed from a pending or rejected appraisal.

## Feedback Composition And Projection

The feedback composer receives accepted spans, criterion appraisals, one selected pattern gap, missing-evidence facts, privacy flags, and approved voice markers. It does not receive candidate identity or the full raw answer again.

The hidden feedback plan carries the central read, signal posture, primary anchor, and intervention. For a usable answer, application code normalizes the internally contradictory combination of `affirm_and_continue` plus a non-empty biggest upgrade to `polish_then_continue`; candidate-facing wording and evidence references are unchanged. Provider prose is bounded in the prompt and sentence/word-clipped by the adapter before strict schema validation so deterministic retries do not repeat an otherwise valid over-length response. Other missing or incompatible intervention content remains fail-closed. Candidate feedback may carry:

- acknowledgement;
- one grounded strength when evidence supports it;
- one biggest upgrade;
- one redo prompt;
- one answer-pattern suggestion;
- an optional light delivery note for an observed voice marker.

Validation rejects:

- a strength claim without accepted evidence-span ids;
- an unknown criterion, pattern-gap, or span anchor;
- missing upgrade/redo content for the selected intervention;
- a delivery note without voice evidence;
- coach-owned scores, grades, pass/fail results, numeric ratings, ranking, other-candidate comparison, or protected/style-based judgments. Grounded candidate-owned outcomes such as a school grade, a percentage improvement, or a passed inspection are not coach scoring and may be referenced when supported by accepted evidence.

Only `candidate_safe_feedback` crosses the candidate UI boundary. The hidden feedback plan, extractor output, criterion facts, and verifier facts remain internal evaluator/QA data. Downstream dashboard reads may derive qualitative coaching facts from accepted appraisals, but they must not parse evaluator prose as evidence truth.

## Runtime And Retry Policy

The initial runtime policy reserves a 45-second server budget:

| Stage | Timeout | Maximum attempts | Retry classes |
|---|---:|---:|---|
| Evidence extraction | 12 seconds | 2 | timeout, rate limit, provider 5xx, invalid schema |
| Conditional verification | 12 seconds | 1 | timeout, rate limit, provider 5xx |
| Feedback composition | 12 seconds | 2 | timeout, rate limit, provider 5xx, invalid schema |

The 45-second budget is a hard ceiling over all attempts; a stage must use the remaining budget rather than assuming every listed timeout is still available. The verifier has one attempt and therefore no stage-local transport retry. A failed verifier may be retried only through a new explicit evaluator run.

Each stage adapter performs exactly one transport attempt when invoked. The runtime, not an SDK or adapter, owns attempt counting, timeouts, retry eligibility, aggregate-budget enforcement, and terminal classification. An adapter receives the structured task, current attempt number, bounded timeout, and abort signal. It returns an untrusted structured value plus optional token counts; provider-specific prompt assembly and transport details stay behind that port. Hidden SDK retries must be disabled for future live adapters so persisted attempt metadata remains truthful.

Policy/safety rejection, unsupported evidence, and fingerprint mismatch are not transport retries. A provider safety block is recorded as a nonretryable rejected stage with a bounded safe code. It terminates without candidate feedback unless a deliberately bounded safe re-extraction path applies to a different validation failure.

The production route must begin or claim a durable evaluator run before calling a provider. Client replay of the same logical analysis request must recover the same fresh requested run or its accepted completed result. Each immutable answer attempt and evaluation purpose has sequential evaluator generations. An explicit analysis retry after a retryable terminal failure creates the next generation against the same answer attempt and input fingerprint; it may retain the logical request key, but it must never reuse the failed run id or create a new answer attempt. A nonretryable terminal result blocks a later generation at the claim boundary rather than relying on UI suppression.

Candidate coaching claims use a 60-second durable lease, which exceeds the 45-second aggregate runtime budget and leaves a bounded completion margin. Claiming serializes on the answer attempt and evaluation purpose. It expires abandoned requested generations before creating the next one, permits at most one fresh requested candidate-coaching generation per answer attempt and input fingerprint, permits at most one accepted completed candidate-coaching result for that same unit, and caps candidate coaching at three generations for one answer attempt in a rolling ten-minute window. The evaluator-run id is the completion fence. A run made terminal by failure, rejection, or lease expiry cannot later complete, and a late result from it cannot overwrite or compete with a newer accepted generation. QA-comparison runs retain independent provider/model/prompt variants and do not inherit the candidate-serving cap or single-accepted constraint.

Relational columns own run identity, purpose, generation, provider/model/prompt/evaluator versions, input fingerprint, lease and lifecycle timestamps, and terminal error classification. Accepted versioned stage artifacts and validation metadata remain bounded JSON objects because they are immutable aggregate outputs read together. They should not be normalized into stage tables until a demonstrated query, reporting, or retention requirement justifies that additional write and migration complexity.

An accepted evaluator-run result is the internal record. It contains accepted extraction, deterministic criteria and pattern gap, conditional verifier result, accepted feedback composition, candidate-safe feedback, stage-attempt metadata, aggregate latency/token totals, and explicit no-prompt/no-raw-output retention markers. The session compatibility snapshot is a separate candidate-safe projection containing answer identity, candidate-facing coaching, and the minimal interaction directive needed to render retry/continue behavior. Extractor facts, criterion appraisals, pattern gaps, verifier facts, and the hidden feedback plan must not be copied into session/browser state.

### Production Provider Failure Validation Gate

The fixture-backed candidate session proves the presentation contract through automated failure injection, but it cannot browser-validate real provider behavior. Production provider integration is not complete until a development-only, server-controlled fault injector can exercise these cases without weakening shared configuration, accepting a public query flag, or exposing failure controls outside explicit development mode:

| Failure case | Required behavior |
| --- | --- |
| Provider timeout or retryable 5xx after answer persistence | Keep the accepted answer locked and durable, show coaching as temporarily unavailable, and do not create another answer attempt. |
| Explicit candidate retry after terminal analysis failure | Create or claim a new evaluator run for the same immutable answer attempt and fingerprint; retry analysis only. |
| Refresh, navigation, or new-tab recovery while analysis is failed | Recover the saved answer and truthful retryable coaching state without reopening answer submission or losing the candidate's place. |
| Malformed extraction or feedback output | Fail closed with a safe reason code, persist no candidate-safe coaching, and expose no raw provider output or prompt content. |
| Process termination or abandoned pending run | Reopen through the defined stale-claim policy; do not strand the answer indefinitely or duplicate evaluator work. |
| Concurrent retry or client replay | Resolve to one valid run claim or a replay of its result; do not create duplicate answer attempts or conflicting accepted coaching. |
| Provider succeeds after the client or route times out | Accept the result only through a valid evaluator-run transition; a stale late result must not overwrite a newer accepted run. |
| Missing credentials or provider misconfiguration | Return candidate-safe unavailable behavior and diagnosable metadata without leaking configuration details. |
| Completed accepted internal result while provider is unavailable or changed | Repair the candidate-safe session projection from the immutable accepted result without another provider call. |
| Nonretryable terminal result or three generations inside ten minutes | Keep the answer locked, refuse a new generation at the claim boundary, and let the candidate continue or finish without coaching. |

Verification order:

1. Repository and route tests prove run claims, idempotency, stale recovery, late results, and safe error mapping.
2. Browser validation uses fail-once timeout/5xx and malformed-output modes to prove saved-answer recovery, refresh/new-tab behavior, and analysis-only retry.
3. Database reconciliation proves one answer attempt, correctly linked evaluator runs, one accepted candidate-safe result at most, and metadata-only failure telemetry.

The fault injector should be added with the production provider adapter and removed or disabled by construction in preview/production builds. Do not simulate this gate by deleting ordinary developer credentials or corrupting the shared database state.

The pre-provider development harness uses the same typed fixture adapters and runtime as ordinary local coaching. It is selected only by `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fault` plus an allowlisted `CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE`, requires explicit local host-launch mode, and is unavailable when `NODE_ENV=production`. Each non-success mode fails the first evaluator run for one fixed input fingerprint and then permits a new explicit evaluator generation to traverse the normal successful fixture path. This makes analysis-only recovery deterministic without request/query controls or mutable shared database corruption. Allowlisted provider/runtime modes cover timeout, rate limit, provider 5xx/unavailable, misconfiguration, invalid extraction schema, input-fingerprint mismatch, exact-span mismatch, unsafe inference, verifier rejection, and invalid feedback schema. Stale claims, concurrency, and late completion are evaluator-run repository/route states rather than provider outputs and must be proven at that boundary.

Slice 121 closes the candidate-serving recovery contract. Server and client share a bounded `pending | recoverable | retryable | unavailable` capability shape with no provider details. The durable claim query enforces the three-generation window and nonretryable terminal policy under the existing answer/purpose advisory lock. Refresh and second-tab reads derive recovery from candidate-owned evaluator history plus current runtime availability; only completed rows with accepted candidate-safe validation markers are restorable. Accepted internal results can repair the session projection without a currently configured provider. Candidate UI keeps the submitted answer read-only and offers continue or finish without coaching whenever retry is unavailable; that path creates no evaluator result, candidate-safe analysis snapshot, or coached-answer fact.

## Persistence, Redaction, And Observability

Persist by default:

- answer-attempt id and input fingerprint;
- pipeline profile plus provider/model/prompt/evaluator versions for every stage;
- lifecycle status and timestamps;
- parsed accepted extraction, appraisal, pattern gap, verifier result when used, and candidate-safe feedback;
- bounded per-stage attempt outcomes plus aggregate latency/token totals;
- validation flags, reason/error codes, latency, and token usage.

Do not persist by default:

- assembled prompts;
- launch or identity secrets;
- unvalidated raw model output;
- duplicate answer, JD, or resume content in logs or analytics.

Operational telemetry is metadata-only. It may identify the evaluator run, answer attempt, fingerprint, stage, provider/model/prompt version, outcome, error code, latency, and token counts. It must not emit answer, JD, resume, prompt, or feedback content.

## QA And A/B Capture

QA begins with one fixed, redacted case. Each run records the exact pipeline profile and accepted parsed stage outputs. A/B comparison is valid only when both runs share the case id and input fingerprint. It compares model/prompt/pipeline responses to the same input, not two candidate answers and not candidate-app versus recruiter-app behavior.

Human review should be able to inspect:

- exact answer/question mapping;
- span grounding;
- applicability and band decisions;
- technical-reference and verifier use;
- pattern-gap selection;
- feedback grounding and safety validation;
- latency/token metadata;
- reviewer preference, issue codes, and notes.

Raw provider-output retention remains opt-in and should require a defined access, masking, encryption, expiry, and deletion policy.

## V1 Disposition

- Preserve: exact question/answer/context assembly, staged candidate-controlled feedback cadence, modality-aware delivery notes, retries, and QA metadata.
- Reinterpret: hidden numeric score truth becomes applicability-first evidence and qualitative bands; feedback is composed only after code accepts evidence.
- Retire: a model directly judging the whole answer, score averages as candidate truth, missing evidence mapped to low performance, app-source distinctions for the shared evaluator job, and legacy feedback prose as durable evidence.
- Defer: production model/provider choice, technical-reference service, raw-output retention, media evaluator input, development fault-injection/browser recovery integration, QA review UI, and final dashboard aggregation.

## Review Decisions

The next implementation slice should not wire production analysis until these decisions are accepted or revised:

1. Keep the two-call extractor/composer model with a conditional verifier, or choose a different latency/cost contract.
2. Keep the universal criteria and internal `emerging` / `clear` / `strong` bands as written.
3. Confirm that `thin` but usable answers may still receive observed criterion bands while non-answers, unclear transcripts, and sensitive disclosures may not.
4. Confirm technical role-skill evaluation fails to `unscoreable` when no versioned reference exists.
5. Confirm raw prompts and unvalidated outputs are not retained by default.
6. Define the technical-reference source and ownership before technical production evaluation.
7. Decide whether accepted internal criterion bands may appear directly in future candidate UI or only through composed coaching and derived dashboard facts.
