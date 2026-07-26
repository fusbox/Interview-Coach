# Evidence-First Coaching Scenario Lab

Status: Current scenario-lab contract; V14/V15 is locally fixture-accepted and post-UI credentialed calibration remains
Last updated: 2026-07-26

## Purpose

The scenario lab is the rapid calibration loop for the evidence-first coaching engine. It provides an operator workspace to use a broad code-owned library or create synthetic practice scenarios and candidate responses, stage an exact scenario version, submit one or many cases through the same production evaluator, feedback, Coach Update, transcript-canvas, invited-summary, and candidate-dashboard projection code used by the app, and inspect every candidate-visible output without requiring setup, session navigation, or manual browser entry.

Its first priority is to expose where the engine identifies evidence correctly or incorrectly and where downstream coaching becomes ungrounded, contradictory, repetitive, unnatural, unsafe, or insufficiently useful. It is not a UI test runner and it is not a model A/B system.

## Three Separate Quality Lanes

| Lane | Primary question | Source | Output |
| --- | --- | --- | --- |
| Scenario lab | Does the coaching engine reason and communicate well across deliberately varied evidence? | Code-owned synthetic cases | Repeatable batch artifacts, hard assertions, coverage report, and review-ready coach output |
| AI-eval workbench | What is weak in exact output that was actually generated, and did a governed change fix it? | Immutable serving artifacts | Findings, remediation hypotheses, regression cases, and sequential rechecks |
| Browser/product validation | Does the user journey and rendered UI behave correctly? | App routes and persisted sessions | Functional, responsive, accessibility, recovery, and presentation evidence |

Passing one lane does not imply passing either of the others.

## Governing Invariants

- Scenario inputs are synthetic, code-owned, stable, and free of real candidate identity or data.
- The runner calls the production profile adapters and code-owned deterministic projections. It may not maintain a simplified duplicate evaluator.
- One immutable scenario input fingerprint identifies role context, question, answer, prior attempts, technical reference, and expected behavior.
- Expected results describe semantic facts, allowed classifications, required or forbidden coaching concepts, and cross-layer relationships. They do not snapshot exact model prose.
- Provider output must pass the same schemas, evidence attachment, safety validation, and candidate-safe projection as serving output.
- A scenario may expect safe failure. Provider-unavailable, invalid-schema, unsafe-inference, stale-evidence, exact-span, and technical-reference boundaries are valid test outcomes.
- Same-profile sequential runs may be compared for regression and drift. This is not alternate-profile A/B evaluation.
- Generated artifacts record suite, case, input fingerprint, immutable serving configuration identity, provider outcome, latency/token metadata, normalized internal facts, and candidate-visible projections. They never contain credentials, assembled prompts, raw provider responses, or real user data.
- Automated checks may prove contracts, grounding, consistency, and forbidden behavior. Naturalness and teaching quality still require operator judgment; the runner must make that review fast rather than pretending it is fully objective.

## Scenario Model

### Atomic answer case

Each atomic case contains:

- stable case id, title, tags, and rationale;
- audience applicability: candidate-led, invited, or both;
- role family, target role, bounded JD, optional processed-resume context, and interview stage;
- question category, exact question, and planned purpose;
- exact synthetic answer, answer mode, optional trusted technical reference, and optional STT-derived voice markers for delivery scenarios;
- optional prior attempts for the same stable question lineage;
- expected answer usability, observable markers, category signals, sensitive flags, technical status, criterion applicability/bands, intervention class, strength/gap facts, and required/forbidden coaching concepts.

### Round journey

A round journey groups already-defined atomic cases so accepted answer evaluations can be reused rather than paid for again. It adds:

- stable prep-context and question lineage;
- one-question or multi-question round shape;
- first-practice or repeat-practice posture;
- prior comparable attempts that are improved, unchanged, regressed, or mixed;
- answered, unavailable, and intentionally omitted evaluator outcomes where applicable;
- expected Coach Update source coverage, progression language, primary focus, feedforward priority, and dashboard/invited-summary projection behavior.

## Operator Workspace

`/qa/ai-eval` should add two workspaces without replacing the existing source inbox, review queue, or remediation workflow.

Slice 184 lands the first usable version of both workspaces. It favors exact scenario JSON in the editor and complete persisted layer JSON in run detail so contract work can proceed without prematurely hardening a bespoke form or prose renderer. Structured field editing, corpus filters, operator notes, and direct finding promotion remain later usability work; the stored scenario and run contracts do not depend on those presentation choices.

### Scenarios

The Scenarios workspace must support:

- browsing and filtering the broad code-owned baseline library;
- creating a blank operator-authored scenario or cloning a baseline scenario;
- editing synthetic role, JD, processed-resume, stage, audience, question, planned purpose, candidate response, answer mode, technical-reference, and prior-attempt context;
- composing one-question, multi-question, and repeat-practice journeys;
- tagging cases by category, role family, response pattern, evidence signal, risk, and intended output layer;
- validating missing/invalid fields and showing the expected provider-call/cost shape before submission;
- staging an exact immutable version while retaining the editable draft for later revision;
- submitting one staged scenario, selected staged scenarios, or an entire suite for execution;
- cloning a completed version into a new draft rather than mutating evidence that already produced a run.

The workspace must clearly state that scenario content is synthetic QA material and must not contain real candidate identity or records. Sensitive-disclosure scenarios are allowed when deliberately fictional and tagged. They cannot be scrubbed without destroying the test purpose, so scenario content and outputs remain protected by the separate individual AI-eval operator grant, explicit retention, and metadata-only access audit.

### Runs

The Runs workspace must support:

- queued, running, partially completed, completed, failed, and cancelled-before-start states;
- run-one, run-selected, and run-suite requests;
- progress by scenario and output layer without requiring the initiating tab to remain open;
- retry of incomplete cases without rerunning accepted immutable case/layer outputs;
- filters for suite, scenario, category, role family, response pattern, provider outcome, assertion result, output layer, configuration, and review status;
- one case page that places input context and every candidate-visible output together in pipeline order;
- the full question prompt and submitted answer at the top of every case result, including every referenced question/answer pair for a round journey;
- `pass`, `fail`, and `review_required` assertion summaries with exact reasons;
- operator notes and promotion of a representative failure into the existing workbench finding/remediation/regression flow;
- same-profile sequential comparison against an explicitly selected prior run.

Scenario submission creates an immutable scenario version. Run submission captures that version, suite manifest, serving profile/configuration identities, and execution request key. Exact replay converges; changed reuse fails. Draft deletion or later edits cannot alter a queued or completed run.

In contract mode, a submitted browser action targets and processes its own durable run request immediately, while the same request can also be recovered by `npm run qa:ai-eval:scenario-worker`. The worker claim, case, and layer records own recovery; the initiating tab does not own result integrity. Accepted terminal layers are not rerun, expired claims are recoverable, and a round journey can resolve its code-owned atomic dependencies even when the journey alone was selected. The deterministic fixture is intentionally not tuned to make every semantic expectation pass: mixed pass/fail results prove that the assertion layer detects mismatches, but neither a green fixture run nor a fixture failure is evidence about the production model.

### Candidate-visible output inventory

For each applicable case, the case page must show the exact text and state a candidate would receive:

- **Session:** acknowledgement, primary strength, biggest upgrade, redo prompt, named answer pattern and steps, delivery note when supported, intervention/action posture, and unavailable-coaching copy;
- **Transcript evidence:** accepted highlighted excerpts, their labels/messages, answer-level observations, prioritized absent signal, and the plain-transcript fallback reason when annotation is omitted;
- **Candidate Coach Update:** title, summary, primary focus, per-question acknowledgement/observation/next-practice focus, first/repeat comparison message, and unavailable state;
- **Invited completion summary:** the candidate-visible question, latest submitted response, immediate coaching projection, and any truthful unavailable state;
- **Candidate dashboard:** Coach Update preview/detail copy, Practice Next title/body/source, and Coach Plan/progress guidance derived from the scenario's plan and accepted evidence.

Internal evidence, appraisal, pattern-gap, claim-evidence, safety, and configuration layers should be available in a separate diagnostic view. They must not be mixed into the candidate-visible transcript as though the user saw them.

## Initial Coverage Manifest

The first corpus should use pairwise coverage rather than a combinatorial Cartesian product. A coverage report must fail when a required dimension is absent.

### Question and evidence dimensions

- all five categories: screening, behavioral, culture/fit, scenario, and technical/role-specific;
- all five universal criteria across `emerging`, `clear`, `strong`, `insufficient_data`, `not_elicited`, and `unscoreable` where logically applicable;
- answered question, example, personal action, outcome/takeaway, reasoning, role connection, problem framing, priority, stakeholder awareness, tradeoff, motivation, self-awareness, and direct technical-answer signals;
- first attempt plus improved, unchanged, regressed, and mixed repeat history;
- one-question and multi-question rounds;
- typed baseline and equivalent voice transcript where modality fairness is relevant.

### Technical-framing matrix

The baseline suite includes a code-owned multi-role matrix spanning frontline/warehouse, customer service, administrative operations, skilled trades, healthcare support, people management, sales/service, and technical professional work. Each matrix row records:

- a realistic technical/role-specific prompt;
- whether strict factual correctness requires a trusted reference;
- the answer evidence expected to support `role_skill_signal`;
- the expected `technicalAccuracy` posture;
- coaching concepts that are required or forbidden.

Most rows intentionally omit a trusted reference and assert that relevant knowledge, practical application, reasoning, or verification awareness can support role-skill coaching while `technicalAccuracy` remains `not_assessed`. At least one trusted-reference row proves supported/contradicted correctness and at least one safety-sensitive row proves that the coach recommends approved-procedure verification without inventing a rule. This matrix evaluates framing and evaluator behavior; a credentialed V2 question-wording gate separately measures whether the provider actually produces the intended question distribution.

### Deliberately difficult answer patterns

- very short but insufficient;
- concise and fully sufficient;
- polished but off-topic;
- partially answers one clause of a compound question;
- verbose or rambling with useful evidence buried inside;
- vague but enthusiastic;
- memorized-sounding generalities with no grounded example;
- team result with no personal action;
- action with no result or learning;
- result claim with no supporting action;
- scenario answer that jumps to a solution without framing, priority, stakeholders, or tradeoffs;
- generic culture/fit language that invites unsupported personality inference;
- transferable school, volunteer, caregiving, gig, or adjacent-industry experience;
- strong content with non-native grammar, code-switching, transcription punctuation loss, or filler words;
- sensitive health, disability, family, age, immigration, compensation, conflict, or protected-class disclosure requiring coaching toward a direct and honest answer that omits private detail rather than inference, legal advice, or an unsafe-candidate characterization;
- direct technical answer with no trusted reference;
- technically correct, partly correct, confidently wrong, internally contradictory, and unverifiable technical answers when a trusted reference is present;
- refusal, empty-equivalent, copied question, prompt-injection text, and content attempting to direct the evaluator;
- evidence excerpt repeated more than once, paraphrased only, or unsafe to annotate.

### Role and context dimensions

The initial corpus must include frontline/warehouse, customer service, healthcare support, skilled trade or field work, sales, administrative/operations, people management, and technical/professional work. Entry-level and career-change postures must appear across multiple role families. No role family may become the implicit quality baseline.

Resume context must include absent, directly relevant, transferable, sparse, and potentially distracting-but-non-authoritative cases. Interview stages must cover not-sure/general, screening, first interview, and follow-up/final.

## Pipeline Under Test

One selected batch runs these layers in order:

1. evidence extraction and code-owned evidence attachment;
2. category-aware appraisal, applicability, and conditional technical verification;
3. feedback planning and candidate-safe immediate coaching;
4. in-session acknowledgement, observation, next-practice focus, and action projection;
5. transcript-canvas accepted spans, answer-level signals, and absent-signal fallback;
6. round-level Coach Update synthesis and first/repeat progression language;
7. invited completion summary where the shared runtime consumes the same coaching facts;
8. candidate dashboard Coach Update, Practice Next, and Coach Plan projections that are derived from those facts.

The lab evaluates data and copy contracts, not HTML layout. It must make contradictions between layers visible, such as immediate coaching praising a signal that Coach Update later calls absent, or dashboard guidance introducing a focus unsupported by the accepted evaluation.

## Automated Assertions

Every run must produce machine-readable pass/fail results for:

- schema and immutable configuration identity;
- exact evidence-span containment and ambiguity handling;
- expected marker, category-signal, sensitive-content, technical-status, applicability, and allowed-band behavior;
- no coach-assigned score, rank, pass/fail, hiring-decision, accent, fluency, diagnosis, legal-advice, protected-trait inference, or unsupported technical-correctness claim;
- when technical accuracy is `not_assessed`, no direct or indirect assertion of correct technical understanding and no upgrade that demands an exact factual value without a trusted reference;
- candidate-safe output grounded only in accepted facts;
- required and forbidden coaching concepts per case;
- category-appropriate intervention and pattern-gap selection;
- typed/voice content parity when delivery evidence is unavailable;
- immediate-feedback, Coach Update, transcript-canvas, invited-summary, and dashboard cross-layer consistency;
- truthful first-practice versus repeat-practice language;
- no false improvement/regression claim when comparable evidence is missing;
- improvement recognition when separately evaluated prior and current attempts support it;
- mixed-round summaries that do not promote a generic or thin answer into evidence shared by every answer;
- technical-boundary summaries that preserve supported, contradicted, and not-assessed distinctions rather than flattening them into generic technical praise;
- safe continuation and honest unavailable states for planned fault cases;
- coverage-manifest completeness.

The automated result is `pass`, `fail`, or `review_required`. `review_required` is correct for naturalness, nuance, prioritization, and teaching usefulness that cannot be established from deterministic facts alone.

Generated-language assertions are provenance-aware. They inspect app-authored coaching claims, not the candidate's question/answer transcript or other user-provided context. A word such as `score`, `grade`, `rank`, `pass`, or `fail` must never cause rejection merely because the candidate supplied it and a downstream surface faithfully recapitulates that context. The safety boundary rejects the app assigning or implying the prohibited judgment. It does not make candidate context unspeakable.

Sensitive-disclosure coverage stays semantic rather than phrase-fixture-driven. The evaluator may identify a broad disclosure category when private detail is present, but candidate coaching must not call the answer or candidate unsafe. It should explain that the question can be answered directly and honestly without the sensitive detail and help the candidate construct that professional response. Do not add an expanding lexical fallback catalog as a substitute for this general policy.

## Runner Modes

### Contract mode

Runs deterministic accepted fixtures with no provider call. It proves orchestration, schemas, semantic assertion wiring, cross-layer projections, artifact safety, and coverage on ordinary test runs. Explicit fault adapters for provider-unavailable and invalid-output candidate fallbacks remain a calibration-corpus extension; until they land, live operation failures are inspected as truthful failed run/operation evidence rather than fabricated candidate-visible coaching.

### Credentialed live mode

Runs selected ids/tags or the full corpus against the exact serving evaluator and Coach Update profiles. It requires explicit environment gates and CLI confirmation, supports bounded concurrency and resumable per-case artifacts, and reports estimated/actual calls, tokens, latency, failures, and unreviewed outputs. Ordinary tests, builds, app startup, and browser routes never trigger it.

Credentialed execution follows these additional invariants:

- A browser action may create an immutable queued run only after showing a server-derived preview and receiving an explicit operator acknowledgement. It never performs a provider call.
- A live worker must have `AI_EVAL_SCENARIO_LIVE_ENABLED=true`, valid serving evaluator and Coach Update configuration, configured input/output token rates, a configured per-run estimated-cost ceiling, and an explicit `--confirm-live` process argument. Missing or inconsistent controls fail closed before a run claim or provider call.
- The preview freezes the selected scenario fingerprints, exact evaluator and Coach Update configuration identities, minimum/maximum provider-call envelope, conservative input/output token envelope, configured price snapshot, and maximum estimated cost with the run request. Later rate or profile changes require a new run.
- A live run is rejected before creation when its maximum call or estimated-cost envelope exceeds the configured process ceiling. The worker independently rechecks the stored preview against its current configuration before execution.
- Accepted evaluator results and accepted Coach Update synthesis results are checkpointed as validated, prompt-free, raw-response-free provider operations before downstream projection work continues. A recovered worker reuses those checkpoints and never reruns a completed operation.
- Provider-operation failures retain only safe error classification, bounded attempt metadata, token/latency data when available, and retry posture. Retryable work is delayed and bounded; exhausted or non-retryable work makes the run terminal rather than creating a hot retry loop.
- The database claim prevents concurrent workers from intentionally duplicating an operation. A narrow at-least-once billing window remains if the provider accepts a request and the process dies before Postgres records the accepted checkpoint; this cannot be made transactional without provider-supported idempotency.
- Bounded concurrency applies to independent scenario cases within one claimed run. One run-level worker claim plus operation-level claims fence stale or concurrent workers, and claim renewal keeps long batches recoverable.
- Actual metrics are derived from accepted runtime attempt/token records and Coach Update validation metadata. They are diagnostic cost evidence, not candidate-facing data and not a billing authority.

### Same-profile regression mode

Compares two artifacts with the same suite, case fingerprints, and profile/configuration identities. It highlights changed normalized facts, assertion outcomes, candidate-visible copy, latency, and token use. It does not choose a model winner and must not be described as A/B evaluation.

The operator explicitly selects the prior run. Comparison is available only when both runs used credentialed-live mode, the same evaluator and Coach Update configuration fingerprint, and the same scenario input-fingerprint set. The comparison is a derived read; it does not create a third provider run or copy either run's content into workflow tables.

## Artifacts and Review

Run artifacts are durable QA records and may also be exported to an ignored QA-artifact directory for offline inspection. The workspace index should let an operator filter by failure, category, role family, answer pattern, output layer, configuration, and `review_required`, then inspect every candidate-visible layer for one case together.

Code owns the scenario inputs and semantic expectations. Generated prose is never committed as an unquestioned golden snapshot. After human review, a scenario expectation may be tightened and a representative failure may be promoted into the existing workbench remediation/regression process. Synthetic scenario execution does not replace review of real serving output.

## Implementation Boundary

Slice 184 landed the scenario-workspace foundation:

- durable operator-owned drafts, immutable submitted versions, suite membership, run requests, per-case/layer outcomes, and candidate-visible output artifacts;
- separately granted authorization, ownership-neutral operator access, audit, retention posture, idempotent submission, and run lifecycle claims;
- `/qa/ai-eval` Scenarios and Runs navigation, baseline browsing, author/clone/edit/stage/submit flows, run status, and result-detail shells;
- typed atomic-answer and round-journey schemas;
- a coverage manifest and validator;
- a first broad baseline corpus built by extending the current twelve cases rather than replacing them;
- deterministic fixture execution sufficient to prove staging, submission, recovery, and every result surface without a live provider.

The implemented V6 baseline contains 40 synthetic cases: the twelve evaluator golden cases, twenty-four supplemental atomic cases spanning all required role/stage/resume/category dimensions, and four round journeys. Eight supplemental cases form the multi-role technical-framing matrix. V6 preserves V5's independent evaluation of every declared prior attempt and semantic assertions for no-reference technical claims, progression/regression language, mixed answer usability, and supported/contradicted/not-assessed technical boundaries. It updates the generic culture-fit expectation to the ratified `thin` contract and caps contradicted technical organization at `clear`. Coverage validation fails if a required dimension is absent. Baseline scenario payload changes advance both the immutable suite version and each baseline scenario's persisted version number; the active-picker visibility floor is an independent contract so advancing V6 does not hide V5 evidence. Migration `039` adds individually granted operator drafts, exact draft-revision staging, immutable versions/suites, ownership-fenced idempotent runs, renewable targeted/global claims, terminal case/layer evidence, 30-day run retention, and metadata-only mutation audit. Operator-authored content is visible only to its owner; baseline content is shared across granted operators. The Scenario picker currently exposes baseline V5 and later only. Baseline V1-V4 remain immutable in persistence and historical run evidence so they can be restored without reconstructing data, but they are not selectable or cloneable in the active lab UI. The latest operator-authored revision remains available under `Custom` so hiding baseline history does not break authoring.

Slice 185 landed the live execution boundary:

- one shared pipeline runner over production evaluator, feedback, transcript-canvas, Coach Update, invited-summary, and dashboard projection seams;
- explicitly gated credentialed live mode with id/tag selection, bounded concurrency, resumable artifacts, and cost/call preview;
- same-profile sequential comparison;
- compact JSON plus human-readable report output;
- workspace progress/recovery and candidate-visible result inspection;
- focused tests proving execution does not depend on the initiating browser and no real identity, assembled prompt, credential, or raw provider payload reaches artifacts.

Migration `040` freezes the server-derived cost/call preview and explicit live acknowledgement with each credentialed run, adds run-level and provider-operation claim generations, and checkpoints validated evaluator and Coach Update results before downstream projection work. `/qa/ai-eval` previews and queues selected, tagged, or full-corpus live runs but never calls a provider. The separately invoked worker revalidates exact profile/configuration identity, configured token prices and ceilings, and the explicit process confirmation before claiming work. Same-profile comparison is a derived read and refuses mismatched scenario fingerprints or configuration identity.

Out of scope:

- alternate-profile execution, blind pairwise review, or model promotion;
- replacing `/qa/ai-eval` or browser/product validation;
- an automated judge that can self-certify naturalness or teaching quality;
- candidate-facing UI changes;
- full Cartesian coverage or an arbitrary scenario generator whose inputs drift between runs.

Slice 186 completed a representative credentialed calibration gate: two four-case runs completed without provider/runtime failure, and the operator reviewed and accepted all eight cases. Seven remained `review_required` and one recorded a semantic assertion failure. This proves the live execution and inspection loop, not exhaustive provider quality. The complete baseline, deterministic provider-fault cases, semantic-failure triage, and representative regression promotion remain bounded quality work; see [Scenario Lab Milestone Evidence](./ai-eval-scenario-lab-milestone.md).

The first complete 32-case credentialed run exposed a bounded remediation set for Slice 187: generated-language validation must distinguish app-authored judgments from user-provided recapitulation; one failed round was a cascade from an atomic Coach Update rejection and must preserve independent completed layers; trusted technical references and STT-derived voice markers must reach the production evaluator seam; generic culture/fit language must not be promoted into a concrete example; the sensitive-disclosure expectation must use the evaluator's broad category vocabulary; and each run result must lead with its immutable question/answer input. These are calibration and workbench corrections, not permission to weaken the semantic expectations.

The V9 confirmation run completed all 32 cases without provider/runtime failure. One semantic assertion remained: a confidently wrong technical answer was correctly marked `contradicted`, but its false no-cost claim still promoted `impact_judgment_takeaway` from `emerging` to `clear`. The deterministic appraisal now distinguishes presence from correctness: it retains the observed tradeoff evidence while preventing a signal supported only by contradicted spans from promoting the quality band. A one-case credentialed rerun then cleared the semantic assertion; its remaining `review_required` result correctly denotes human review of teaching quality and naturalness.

The workspace submits durable run requests to a server-side runner. The initiating browser must not own provider execution, recovery, or artifact integrity. A local CLI worker may process requests during development; deployment requires an accepted durable worker/runtime rather than best-effort work after an HTTP response. Service-loop, health, graceful-shutdown, and maintenance-only deletion requirements are governed by [AI-Eval Worker And Retention Operations](../07-ops/ai-eval-worker-and-retention.md).

## Slice 184-186 Evidence

- `npm run test:ai-eval-workbench` covers the scenario schemas, baseline coverage, semantic assertion application, draft factory, production projection reuse, live policy/cost preview, worker recovery, operation checkpoints, same-profile comparison, migrations, and route rendering alongside the existing operator workbench.
- `npm run db:smoke-ai-eval-scenario-workspace` applies migrations `037-041` and proves the versioned 40-case V7 baseline, draft exact replay/conflict/revision/staging, fixture run recovery, live preview/queue/claim, accepted provider-operation checkpoint recovery without an accidental second attempt, guarded terminalization, immediate grant revocation, retention operations, and content-free audit metadata. It does not call Gemini.
- `npm run qa:ai-eval:scenario-worker` processes queued or recoverable contract-fixture runs outside the initiating browser.
- Contract mode uses production-owned deterministic evaluator, immediate-feedback, transcript-canvas, Coach Update, invited-summary, and candidate-dashboard projection seams. It does not call Gemini and cannot certify provider behavior, naturalness, teaching usefulness, or release readiness.
- Slice 186 used the explicit live worker for two durable four-case runs. The operator reviewed and accepted the eight representative outputs. This evidence must not be described as complete corpus calibration: the 32-case credentialed baseline, explicit fault paths, and representative regression promotion remain open.
