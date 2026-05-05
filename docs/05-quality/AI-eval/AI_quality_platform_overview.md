# AI Quality Platform Overview

> Strategic framing: this should become a shared AI Quality Platform, not a recruiter-app feature. The recruiter app is the first client. The candidate-driven app and future AI-enabled products should plug into the same generation logging, dataset, scoring, and experiment infrastructure.

## Purpose

The product still needs AI outputs as feature data, but evaluation, observability, and release governance require those same outputs to also become operational quality data.

The goal is to let QA/QC, Data, and Engineering leaders evaluate all AI-generated content without manually looking up records, exporting ad hoc data, or running one-off scripts. Queries can power the workflow, but operators should interact with a productized UI.

## Remaining Platform Gaps

The first instrumentation pass now captures all five current app surfaces in `ai_generations`, and `/qa/ai-quality` provides an identity-gated read-only explorer. The remaining gaps are no longer basic capture gaps; they are evaluator workflow, data-shaping, governance, and automation gaps.

- Evaluators cannot yet export filtered generation sets from the QA UI.
- Generation rows are not yet grouped into named eval batches, planned test runs, experiments, or release-gate runs.
- Captured app outputs are not yet promotable into durable `eval_items` or reusable `eval_datasets`.
- Alternative model outputs do not yet have first-class storage linked to the same frozen input/prompt/context as the app baseline.
- Human review, blind pairwise comparison, reviewer assignment, adjudication, reusable labels, and reviewer agreement tracking are not implemented.
- Product variants and feature flags, such as a feedback disclosure setting, are not captured as first-class metadata.
- Candidate-visible rendered output is not captured separately from the full model output, which matters when the UI hides or summarizes generated content.
- Question generation captures the raw generated batch, but the platform still needs a clearer relationship between raw generated questions and recruiter-curated final question sets.
- Search and filtering are still too shallow for evaluator workflows; common filters need role, req ID, session, invite batch, candidate, created_by, date range, prompt version, product version, feature flag, redaction status, retention class, and reviewer/dataset state.
- Token usage, cost estimate, and some model parameters are provider-dependent and not yet consistently populated.
- Trace and correlation IDs exist as fields, but they are not yet operationalized into full request/session/run tracing.
- QA access is currently a lightweight identity gate and allowlist/metadata check, not durable database-managed role administration.
- Redaction exists, but the platform still needs redaction QA, audit logging, raw-restricted access workflows, and retention enforcement.
- Production failures are not automatically convertible into regression tests.
- Prompt, model, parser, UI rendering, product variant, rubric, and reviewer score versions are not yet tied together in one reusable eval result.

## Design Principles

1. Capture every AI generation at the source.
2. Preserve enough context to replay, evaluate, compare, and debug.
3. Separate raw generation capture from downstream product decisions.
4. Make eval datasets first-class, curated assets.
5. Support human review, deterministic checks, LLM-as-judge scoring, pairwise comparisons, and red-team testing.
6. Build operator UI for QA/QC, Data, Product, and Engineering.
7. Make every production failure eligible to become a regression test.
8. Design the platform for multiple apps and use cases, not only the recruiter-led app.
9. Capture product variants and feature flags whenever they can affect an AI output or the UI-visible interpretation of that output.
10. Distinguish model output, parsed output, and candidate-visible rendered output.
11. Treat every planned eval as a run with a stable identity, scope, inputs, outputs, and scoring state.

## Evaluator Use Cases

The platform should support more than one kind of AI evaluation. It is useful for model comparison, but it should also help Product, Data Science, QA/QC, and Engineering understand whether a prompt, product variant, or production change improves the candidate and recruiter experience.

Core use cases:

- Prompt strategy evaluation: compare two or more prompt versions for the same AI surface on the same frozen inputs.
- Model output comparison: run the same prompt and input context against the app baseline model and one or more alternative models.
- Production quality monitoring: inspect real `ai_generations` rows from current app usage to understand live quality and drift.
- Regression testing: turn a bad generation, malformed response, or production incident into a permanent case.
- Human review and scoring: have evaluators score outputs using surface-specific rubrics.
- Side-by-side preference testing: ask one or more reviewers to choose between two outputs for the same input, with rationale.
- Surface-specific quality checks: evaluate question generation, answer feedback, hints, strong responses, and session debriefs against criteria that match their actual UI purpose.
- Data Science benchmark sets: create frozen datasets that can be reused across prompt, model, provider, and pipeline experiments.
- Product-variant evaluation: compare candidate-visible behavior across feature flags, UI settings, or disclosure policies.
- Parser and schema reliability checks: measure whether model outputs remain parseable and UI-safe across prompts, models, and edge inputs.
- Privacy and redaction QA: verify that PII and sensitive hiring context are captured, masked, retained, and exposed appropriately.
- Release gating: require prompt/model/pipeline changes to meet safety, structure, usefulness, and reliability thresholds before release.
- Debugging and replay: inspect the captured prompt, input snapshot, context artifacts, raw output, parsed output, model metadata, trace fields, and errors behind a specific user-visible result.

### Workflow 1: First-Pass Model Output Comparison Across All Surfaces

This workflow fits a Data Science evaluator, such as Kushal, who wants an initial impression of how an alternative model compares with the app baseline across all five current AI surfaces.

Today, the app can capture the baseline app generations in `ai_generations` and expose them through `/qa/ai-quality`. The comparison model run is not yet built into the platform, so the evaluator still needs a separate model runner, notebook, local harness, or second machine to replay the captured prompt/input payloads against the alternative model.

Step by step:

1. Define the evaluation scope.
   - Include all five surfaces: `question_generation`, `answer_feedback`, `hint`, `strong_response`, and `session_debrief`.
   - Choose a small first-pass case set, such as one frontline role, one professional role, and one edge case with thin or off-target answers.
   - Record the intended role, job description, candidate/resume context, fixed answer transcripts, app environment, baseline model, and alternative model.

2. Generate the app baseline outputs.
   - In the recruiter flow, create an invite setup with the selected role, job description, candidate data, and optional resume context.
   - Click question generation so the app creates a `question_generation` row.
   - Curate the question set as a recruiter would, then create/send the invite.
   - Open the candidate practice link and complete a full practice session.
   - For each question, trigger or view hints and strong responses, then submit the fixed answer text or controlled voice answer.
   - Finish the session so answer feedback rows and the session debrief are captured.

3. Collect the baseline records.
   - In `/qa/ai-quality`, filter by surface and inspect the rows created during the run.
   - Capture each row's `generation_id`, `surface`, `session_id`, `correlation_id`, `created_by`, `prompt_version`, `prompt_snapshot`, `input_snapshot`, `context_artifacts`, `model_provider`, `model_name`, `model_params`, `raw_output`, `parsed_output`, `status`, and `error_json`.
   - Treat each `ai_generation` row as a candidate eval item. For question generation, evaluate the raw generated batch, not only the recruiter-curated final question set.

4. Freeze the eval items.
   - Save the baseline records as a fixed comparison set.
   - Keep prompt snapshots and context artifacts together. The comparison is only meaningful if the alternative model sees the same prompt intent and the same available context.
   - Keep the expected output shape for each surface: question JSON for question generation, answer-feedback JSON for answer feedback, hint JSON, strong-response JSON, and Markdown for session debrief.

5. Run the alternative model.
   - Use the same prompt snapshot and input/context payload for each eval item.
   - If one person is working alone, one machine can run the app and another notebook or local process can call the comparison model, but this can also be done on one machine.
   - If there is an eval partner, one person can prepare the baseline/comparison outputs and the other can score them blind.
   - Record the comparison model provider, model name, parameters, raw output, parsed output, latency, errors, and any manual repair required to make output parseable.

6. Score the outputs.
   - Use the relevant surface rubric for each row.
   - For pairwise review, compare app baseline vs alternative model without showing the reviewer which model produced which output.
   - Score quality, grounding, safety, schema validity, tone, specificity, usefulness, and UI readiness.
   - Track failures such as malformed JSON, unsupported claims, generic coaching, weak role fit, prompt noncompliance, or unsafe hiring guidance.

7. Summarize the first-pass impression.
   - Report results by surface, not only as one overall score.
   - Highlight where the alternative model looks better, equivalent, worse, cheaper, faster, or less reliable.
   - Promote representative wins, losses, and edge cases into reusable eval datasets once dataset tables exist.

Data model and UI gaps surfaced by this workflow:

- `/qa/ai-quality` needs export support so evaluators do not have to copy payloads manually.
- The platform needs run labels or eval batch IDs to group rows from one planned test pass.
- The platform needs `eval_datasets`, `eval_items`, `eval_runs`, and `eval_scores` to connect baseline outputs, comparison outputs, and reviewer judgments.
- The explorer needs filtering/search by date range, `session_id`, `created_by`, role, prompt version, and model.
- Model comparison needs first-class storage for comparison model outputs, not only the app baseline output.
- Prompt snapshots should include any schema/parser requirements needed to rerun a comparable output.
- Question-generation eval needs a way to relate the raw generated batch to the recruiter-curated final question set without confusing one for the other.

### Workflow 2: Feedback Disclosure Slider Evaluation

This workflow fits a Product or Engineering evaluator testing a feature where the candidate chooses how much feedback they want to receive. The intended evaluation is not "which model is better?" but "does the app produce the right amount and type of coaching at each disclosure setting while preserving accuracy, grounding, and session coherence?"

This workflow should focus on `answer_feedback` and `session_debrief`, because those are the surfaces most directly affected by feedback disclosure.

Step by step:

1. Define the slider contract.
   - Name the settings, such as brief, balanced, and detailed.
   - Write the expected behavior for each setting before testing.
   - Decide whether the slider changes the model prompt, only changes what the UI reveals, or does both.
   - Define what should remain stable across settings, such as transcript accuracy, hidden scoring, answer grounding, next-action calibration, and safety.

2. Build a fixed test case.
   - Use the same role, job description, curated question set, candidate profile, resume context, and answer transcripts for every slider setting.
   - Prefer text answers for the first pass because copy/paste transcripts are easier to keep identical.
   - If testing voice, use the same audio file or the same controlled script for every setting.
   - Use separate candidate sessions for each slider setting so `session_id` can group the outputs.

3. Run identical practice sessions.
   - Start a practice session for the first slider setting.
   - Set the disclosure level before answering.
   - Submit the same answer for each matching question.
   - Complete the session so answer feedback and the session debrief are generated.
   - Repeat the same flow for each slider setting.

4. Collect the generated records.
   - In `/qa/ai-quality`, inspect `answer_feedback` rows for each question and the `session_debrief` row for each session.
   - Group rows by `session_id`, question text, and slider setting.
   - Compare the same question and answer across slider settings before comparing different questions.

5. Evaluate answer feedback.
   - Inspect `ack`, `feedbackPlan`, `scores`, `contentPulse`, optional `deliveryPulse`, `nextAction`, `recommendation`, `transcript`, and `meta`.
   - Confirm the visible coaching changes according to the slider setting.
   - Confirm the feedback remains grounded in the actual answer and does not invent evidence at any level.
   - Confirm hidden scores and next-action recommendations do not swing only because the candidate asked for more or less disclosure.
   - Confirm the app still handles text vs voice modality correctly.

6. Evaluate the session debrief.
   - Inspect the Markdown sections: Executive Summary, Core Strengths, Primary Growth Area, and Momentum & Next Steps.
   - Confirm the debrief matches the disclosure setting without becoming inaccurate, too sparse to be useful, or too detailed for the chosen level.
   - Confirm the debrief remains consistent with the per-question answer feedback and hidden telemetry.

7. Record findings.
   - Score each slider setting for disclosure fit, usefulness, grounding, tone, consistency, and UI readiness.
   - Flag any setting where the model changes the meaning of the coaching instead of only changing the level of disclosure.
   - Decide whether the prompt, UI rendering rules, or slider labels need adjustment.

Data model and UI gaps surfaced by this workflow:

- `ai_generations` should capture the disclosure setting as an explicit input or product variant, not only as text embedded in a prompt.
- If the slider only changes UI visibility, the platform should capture both the generated full feedback and the rendered candidate-visible feedback.
- If the slider changes the model prompt, `prompt_snapshot`, `model_params`, or a dedicated variant field should make that visible.
- The explorer needs session grouping and side-by-side comparison for the same question/answer across product variants.
- Eval records need product version, feature flag, and variant labels so outputs can be compared after the feature changes.
- Review UI should distinguish hidden evaluator-only fields, such as internal scores, from candidate-visible fields.

### Cross-Use-Case Platform Requirements

Across the evaluator use cases, the platform needs a few durable capabilities that are independent of any one workflow.

Data capture and identity requirements:

- Every planned test pass should have a run identity, owner, purpose, date range, environment, app version, product version, and notes.
- Every generation should be linkable to role, req ID, session, invite batch, candidate, question, answer, recruiter/user, and source operational records when those records exist.
- Every generation should distinguish baseline app output from comparison model output.
- Prompt, parser, schema, model, model parameters, product variant, feature flag, and UI-rendering versions should be queryable metadata, not only prose embedded in a prompt snapshot.
- `context_artifacts` should carry reusable context such as job description, resume/intake context, blueprint context, and eventually governed document pointers or hashes.
- The platform should support both redacted eval records and raw-restricted operational-debug records with clear retention and access rules.
- Token usage, cost, latency, status, malformed-output state, retries, and idempotency behavior should be consistently captured where provider/API support allows.

Dataset and experiment requirements:

- Operators should be able to create eval datasets from filtered production generations, hand-authored cases, synthetic cases, and incidents.
- Datasets should preserve frozen input, context, expected output shape, surface, product variant, and source references.
- Experiments should support prompt-only changes, model-only changes, parser/schema changes, product-variant changes, and combined changes.
- Experiment results should store every candidate output, not only aggregate scores.
- The same eval item should support many outputs: current app baseline, alternative model output, revised prompt output, and product-rendered output.
- Dataset promotion should support marking items as golden, edge, regression, red-team, calibration, or excluded.

Review and scoring requirements:

- Reviewers need scorecards that are versioned per surface and per evaluation goal.
- Reviews should support single-output scoring, side-by-side pairwise preference, blind model comparison, comments, reusable failure labels, severity, and confidence.
- The system should support reviewer assignment, progress state, adjudication, disagreement tracking, and reviewer agreement metrics.
- Scorecards should separate candidate-visible quality from hidden/evaluator-only diagnostics.
- Automated checks should coexist with human review, including JSON validity, required-field checks, safety checks, redaction checks, grounding checks, duplication checks, and rubric/judge scores.

Operator UI requirements:

- Generation Explorer needs filtering, search, pagination, saved views, exports, record detail, JSON inspection, and grouping by run/session/correlation ID.
- Evaluators need side-by-side comparison views for baseline vs comparison model, prompt version A vs B, and product variant A vs B.
- The UI should show when content was raw-generated, recruiter-curated, parsed, or candidate-visible rendered.
- The UI should make redaction status, retention class, privacy flags, and raw-restricted access obvious.
- Dataset Builder should allow adding one row, adding filtered samples, adding stratified samples, and cloning datasets.
- Experiment Runner should allow selecting dataset, prompt version, model/provider, model parameters, parser/schema version, product variant, and evaluator set.
- Quality Dashboard should summarize pass rates, reviewer backlog, failure modes, drift, cost, latency, malformed output rate, redaction quality, and comparison results.

Governance and release requirements:

- QA/evaluator access should move from hardcoded allowlists to database-managed roles or identity-provider group claims.
- Sensitive data access should be auditable.
- Production incidents should be promotable into regression cases with linked trace/correlation/session data.
- Release gates should be able to block changes based on thresholds for safety, parseability, usefulness, grounding, bias/legal risk, and human high-severity findings.
- Eval reports should be readable by Data Science, QA/QC, Engineering, and Product leaders.

## Core Design

Build an internal **AI Quality Center** with three layers:

1. Instrumentation layer
2. Evaluation layer
3. Operator UI layer

## 1. Instrumentation Layer

Every AI call should create an `ai_generation` record immediately.

```ts
type AiGeneration = {
  generation_id: string;
  app_name: "recruiter_app" | "candidate_app" | string;
  surface:
    | "question_generation"
    | "answer_feedback"
    | "hint"
    | "strong_response"
    | "session_debrief";
  input_snapshot: unknown;
  context_artifacts: unknown[];
  prompt_snapshot?: unknown;
  prompt_version: string;
  model_provider: string;
  model_name: string;
  model_params: Record<string, unknown>;
  raw_output: unknown;
  parsed_output: unknown;
  latency_ms: number;
  token_usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  cost_estimate?: number;
  trace_id?: string;
  correlation_id?: string;
  source_refs: unknown[];
  created_by?: string;
  session_id?: string;
  invite_batch_id?: string;
  candidate_id?: string;
  status: "success" | "failed" | "partial";
  error_json?: unknown;
  privacy_flags: string[];
  redaction_status: "raw" | "redacted" | "not_applicable";
  retention_class: "eval_redacted" | "eval_raw_restricted" | "operational_debug";
  retention_until?: string;
  created_at: string;
};
```

This is the source-level generation record. It should not absorb every future eval concept. Planned comparison outputs, reviewer scores, datasets, review assignments, product variants, and rendered-output captures should become their own eval-layer objects linked back to `generation_id`.

### Question-Generation Capture

`/api/questions/generate` writes an `ai_generation` record immediately when the recruiter generates questions.

If the recruiter later creates an invite batch, that generation should be linked to `invite_batches`. If the recruiter never sends the invite, the generation remains eval-ready.

This is different from relying only on `invite_batches.questions_json`, which represents the final question set that reached invite creation.

Open requirement: the platform should explicitly relate the raw generated batch to the recruiter-curated final question set so evaluators can choose which artifact they are scoring.

### Resume Context Requirement

Optional resume content impacts all AI-generated content to varying degrees:

- Question generation may use candidate/resume context for role-specific tailoring.
- Answer feedback may need to distinguish between a weak answer and missing context that was never provided to the model.
- Hints and strong responses may be more personalized when resume context exists.
- Session debriefs currently use role/job-description context, answer transcripts, and hidden answer-level telemetry. They should only capture resume artifacts if a future prompt explicitly uses resume context.

Any resume-derived context that influences a generation must be captured as part of the eval/replay record.

Depending on privacy policy, this can be handled in one of three ways:

1. Store the raw resume excerpt used by the model in `input_snapshot`.
2. Store a redacted resume excerpt in `context_artifacts`.
3. Store a pointer to a governed document artifact, plus hash/version metadata, retention policy, and redaction status.

Without this, the eval platform can score outputs but cannot reliably explain or reproduce why the model produced them.

### Product Variant And Rendered Output Requirement

Some evaluations are about product behavior, not only model quality. For example, a feedback disclosure slider may leave the model prompt unchanged but change what the candidate sees. In that case, the platform needs to preserve both:

1. The full generated and parsed model output.
2. The candidate-visible rendered output after feature flags, disclosure settings, UI filtering, or product rules are applied.

Product variant metadata should be explicit enough to compare two otherwise identical practice sessions:

- product version
- app environment
- feature flags
- experiment or variant name
- candidate-selected settings
- UI-rendering policy
- rendered output snapshot when it differs from `parsed_output`

## 2. Evaluation Layer

Add first-class evaluation objects.

| Object | Purpose |
| --- | --- |
| `eval_datasets` | Named sets such as `Warehouse Associate Question Generation v1`. |
| `eval_items` | Frozen examples from production, synthetic cases, DS-authored cases, edge cases, and incident-derived failures. |
| `eval_item_sources` | Links from eval items back to `ai_generations`, sessions, questions, answers, invite batches, incidents, or manually-authored source files. |
| `eval_scorecards` | Versioned rubrics per AI surface. |
| `eval_runs` | A planned execution of one dataset against a baseline, prompt, model, parser/schema, or product variant. |
| `eval_run_items` | Per-item execution state inside a run. |
| `eval_outputs` | Baseline app outputs, comparison model outputs, revised prompt outputs, and product-rendered outputs for the same eval item. |
| `eval_scores` | Code checks, LLM judge scores, human labels, reviewer comments, and pairwise preferences. |
| `eval_failures` | Categorized issues such as irrelevant, hallucinated, too generic, unsafe, biased, wrong tone, malformed JSON, or missing coaching value. |
| `eval_reviews` | Reviewer assignments, status, blind-review state, adjudication, and reviewer agreement metadata. |
| `eval_product_variants` | Feature flags, disclosure settings, app versions, UI-rendering policies, and other product conditions under test. |
| `eval_audit_events` | Access and mutation history for sensitive eval records and raw-restricted data. |

## 3. Operator UI Layer

QA/QC, Data, Product, and Engineering should not need SQL for routine eval operations. They need product workflows.

### Generation Explorer

Filter all AI outputs by:

- app
- surface
- role
- req ID
- session ID
- invite batch ID
- candidate ID
- recruiter/evaluator
- date range
- model
- prompt version
- parser/schema version
- product version
- feature flag or variant
- run label
- source reference
- failure mode
- latency
- redaction status
- retention class
- reviewer status
- dataset inclusion

The explorer should support pagination, saved filters, CSV/JSON export, row detail inspection, run/session grouping, and side-by-side comparison launches.

### Dataset Builder

Operators should be able to:

- add a generation to an eval set
- add all generations from a filtered result set
- sample by role, surface, date range, model, status, or failure mode
- stratify samples across surfaces, roles, prompt versions, and product variants
- sample production generations
- add synthetic edge cases
- mark examples as golden
- mark examples as edge, regression, red-team, calibration, or excluded
- clone datasets for new model comparisons
- promote production incidents into regression cases
- preserve raw-generated, curated, parsed, and rendered-output relationships

Example operator actions:

> Add this generation to eval set.
>
> Sample 50 production question-generation calls for Warehouse Associate roles.
>
> Mark this item as golden after QA review.

### Review Queue

Human review should support:

- scorecard-based scoring
- side-by-side output comparison
- blind model comparison
- reviewer comments
- reusable failure labels
- severity and confidence
- adjudication
- assignment and progress state
- reviewer agreement tracking
- escalation for legal, safety, or bias concerns
- separation between candidate-visible content and evaluator-only diagnostics

### Experiment Runner

Operators should be able to choose:

- dataset
- prompt version
- model provider
- model name
- model parameters
- parser/schema version
- app, product, or pipeline version
- feature flag or product variant
- baseline source, such as captured app output or regenerated app prompt
- evaluator set

Then the system should run the experiment and compare results.

Experiment output should be stored per item, not only summarized. Runs should support prompt-only, model-only, product-variant, parser/schema, and combined comparisons.

### Quality Dashboard

Dashboards should show:

- pass rate
- regression trend
- score by AI surface
- top failure modes
- cost
- latency
- malformed output rate
- redaction quality
- duplicate-generation/idempotency health
- reviewer backlog
- production drift
- model/prompt comparison results
- product-variant comparison results

### Release Gate

Prompt, model, or pipeline changes should be able to define release thresholds.

```text
Do not deploy unless:
- Question relevance >= configured threshold
- Safety pass rate = 100%
- JSON validity = 100%
- Answer-feedback usefulness >= configured threshold
- Redaction checks pass for sensitive records
- Product-variant behavior matches expected disclosure/rendering policy
- No unresolved high-severity human review findings
```

### Incident Debugger

Operators should be able to trace one bad candidate or recruiter experience end to end.

```text
UI action
-> API route
-> AI call
-> prompt version
-> input snapshot
-> context artifacts
-> raw model response
-> parser/validator result
-> stored product data
-> user-visible outcome
-> eval dataset/run/review state
```

## Leadership Ownership Model

### QA/QC

QA/QC owns scorecards and acceptance thresholds. They define what "good" means for each AI output.

### Data Science

Data Science owns datasets, judge calibration, model comparison, and local LLM benchmarking. They can run current production models against local LLM candidates on the same frozen eval set.

### Product

Product owns product-variant definitions, candidate-visible experience expectations, disclosure policies, and release-readiness interpretation for user-facing AI changes.

### Engineering

Engineering owns instrumentation, trace integrity, prompt/model versioning, CI gates, replayability, and platform integration. Their job is to make every AI behavior reproducible enough to investigate.

### Privacy And Security

Privacy and Security own sensitive-data handling expectations, raw-restricted access policies, redaction QA, auditability, and retention posture.

## AI Surfaces For This App

### Question Generation

Evaluate:

- role relevance
- job-description grounding
- category fit
- question diversity
- legal/safety risk
- clarity
- candidate appropriateness
- duplication
- resume-context use when applicable
- raw generated batch quality before recruiter curation
- relationship between generated questions, deleted questions, edited questions, and final sent question set

### Answer Feedback

Evaluate whether the feedback:

- references the candidate's actual answer
- gives actionable coaching
- avoids fake claims
- matches the rubric
- uses supportive tone
- produces valid structured JSON
- handles missing, thin, or off-topic answers appropriately
- uses resume context only when it was actually provided to the model
- keeps hidden telemetry scores coherent with visible feedback
- preserves correct modality handling for text vs voice
- behaves correctly under product variants such as feedback disclosure settings

### Hints

Evaluate whether hints:

- are useful
- are role-relevant
- avoid giving away a scripted answer
- help the candidate improve their own response
- reflect available resume/context data appropriately
- remain stable under eager loading and repeated candidate navigation

### Strong Responses

Evaluate:

- realism
- role fit
- STAR/PERMA alignment
- specificity
- non-genericness
- whether the response models a strong but plausible candidate answer
- whether personalization is grounded in provided candidate/resume context
- whether the candidate-visible example remains appropriate for the selected question, role, and context

### Session Debrief

Evaluate:

- holistic accuracy
- consistency with per-question feedback
- no overclaiming
- useful next steps
- fair treatment of missing or incomplete answers
- consistency with role, job-description context, answer transcripts, and hidden answer-level telemetry
- correct use of resume/candidate context only if the prompt actually receives that context
- fit with any candidate-selected feedback disclosure or product-variant policy

## Improvement Over Generic Eval Tools

Do not only adopt a generic eval tool. Use established patterns, but make the system domain-native.

Every eval item should know:

- hiring role
- req ID
- job description
- question category
- candidate context
- resume-context availability and handling
- app surface
- prompt version
- model version
- parser/schema version
- product version
- feature flag or product variant
- raw-generated vs recruiter-curated vs candidate-visible rendered state
- redaction status and retention class
- source references, run ID, dataset ID, and reviewer state

Every model comparison should support:

- current production models
- local LLM candidates
- Azure OpenAI
- OpenAI
- AWS Bedrock
- future providers
- prompt-only comparisons
- parser/schema comparisons
- product-variant comparisons
- side-by-side blind review

Every human review should produce reusable labels, not just comments.

Every production failure should be convertible into a regression test.

Every prompt/model release should produce an eval report leaders can read.

## Practical Roadmap

### Current Progress Snapshot

This roadmap is the working progress tracker for the AI Quality Platform.

Done:

- Strategic platform framing, target surfaces, ownership model, and long-term roadmap are documented.
- Evaluator use cases and two concrete evaluator workflows are documented.
- `ai_generations` exists as the source-level AI generation capture table.
- `ai_generations` is hardened with RLS, prompt snapshots, source references, retention classes, and retention metadata.
- Server-side capture plumbing exists through typed records, a Supabase repository, fail-soft capture helper, and redaction utilities.
- Question generation is instrumented to capture mock fallback, successful Gemini generations, malformed output, and provider failures.
- Answer feedback is instrumented to capture text/voice modality metadata, prompt snapshots, successful feedback JSON, malformed output, and provider failures.
- Hints are instrumented to capture source inputs, prompt snapshots, successful hint JSON, malformed output, and provider failures.
- Strong responses are instrumented to capture source inputs, prompt snapshots, successful strong-response JSON, malformed output, and provider failures.
- Session debriefs are instrumented to capture redacted session summary context, prompt snapshots, successful debrief Markdown, malformed output, and provider failures.
- Duplicate-generation controls are in place for eager hints and answer feedback through client in-flight deduplication and server idempotency keys.
- Redaction now uses structured known values plus heuristic organization detection so names, locations, and company references are removed more reliably.
- `context_artifacts` is operationalized for reusable resume, job description, and blueprint context, while `input_snapshot` is being kept closer to the direct prompt inputs for each surface.
- `created_by` is populated for recruiter-triggered generation and candidate-session surfaces when the owning session can be resolved.
- A full-field SQL export query exists for inspecting current `ai_generations` records during platform validation.
- The first identity-gated `/qa/ai-quality` view exists for browsing recent `ai_generations`, filtering by surface/status/limit, and inspecting full generation payloads.
- `/qa/ai-quality` supports filtered JSON and CSV export through a gated server route.
- Manual evaluator handoff artifacts exist for interim Data Science review while the productized platform is still being built.

Not done yet:

- The read-only AI Quality Center view is a first slice; it does not yet support saved filters, richer filters, persistent run labels, dataset promotion, or reviewer workflow.
- Evaluation objects such as `eval_datasets`, `eval_items`, `eval_item_sources`, `eval_runs`, `eval_run_items`, `eval_outputs`, `eval_scores`, `eval_failures`, `eval_reviews`, `eval_product_variants`, and `eval_audit_events` are not implemented yet.
- Product variant, feature flag, app/product version, parser/schema version, and rendered-output capture are not first-class yet.
- Alternative model outputs are not stored in the platform yet.
- Human review queues, scorecards, blind comparison, adjudication, reviewer agreement tracking, and dataset promotion workflows are not implemented yet.
- Automated evaluators, pairwise model comparison, red-team checks, experiment runners, and CI/release gates are not implemented yet.
- Token usage, cost, trace/correlation usage, retention enforcement, and audit logging are not fully operationalized yet.
- QA/evaluator access is not yet separated into durable database-managed roles; the first product slice should use a lightweight identity gate and then evolve to role management.

Next implementation sequence:

1. Add explicit capture for product variants, feature flags, parser/schema version, app/product version, and candidate-visible rendered output where it differs from parsed output.
2. Add saved filters and durable run labels after the explorer's URL-backed filters are validated.
3. Add dataset, eval item, run, output, scorecard, score, review, product-variant, and audit tables after operators can inspect and export captured generations.
4. Add comparison output storage and side-by-side review before attempting fully automated experiment running.
5. Add automated evaluators, model-comparison runs, red-team checks, and release gates after datasets and scorecards are stable enough to reuse.

### Phase 1: Capture AI Generations

Done:

- `ai_generations` table exists with RLS, source references, prompt snapshots, trace/correlation fields, retention fields, and redaction status.
- All five current AI surfaces are instrumented at source: question generation, answer feedback, hints, strong responses, and session debrief.
- Redaction, context artifacts, error serialization, provider-failure capture, malformed-output capture, mock fallback capture, and fail-soft persistence exist.
- Eager hint and answer-feedback duplicate-generation controls are in place.
- Full-field SQL export query exists for validation outside the UI.

Not done yet:

- Product variant, feature flag, app/product version, parser/schema version, run label, and candidate-visible rendered output are not consistently captured.
- Token usage, cost estimate, and model parameters are not consistently populated across providers/surfaces.
- Trace ID and correlation ID are stored but not yet connected into an operational trace view.
- Raw-generated question batches are not yet first-class linked to recruiter-curated final question sets.
- Redaction QA, raw-restricted access, audit logging, and retention enforcement are not complete.

To do:

- Add a standard product/eval context payload for app environment, product version, feature flags, variant labels, disclosure settings, parser/schema version, and run label.
- Add rendered-output capture where candidate-visible content differs from `parsed_output`.
- Add queryable role, req ID, question, and answer identifiers where they are currently embedded only inside JSON.
- Normalize model parameter capture and fill token/cost fields when provider support is available.
- Add trace/correlation conventions that connect UI action, API route, AI call, stored generation, and eval run.
- Add raw-to-curated question-set linkage.
- Add redaction validation checks, audit events, raw-restricted access paths, and retention jobs.

### Phase 2: Build Read-Only AI Quality Center

Done:

- `/qa/ai-quality` exists as an identity-gated, read-only explorer.
- The explorer reads `ai_generations` through a server-side service-role repository.
- Current filters cover surface, status, and row limit.
- Search, counted pagination, URL-backed filter state, and page-level grouping by session, correlation ID, or surface are available.
- The detail panel exposes full generation payloads for inspection.
- Filtered JSON and CSV exports are available from the explorer.
- Summary widgets use filtered aggregate counts and average latency instead of current-page rows.
- QA allowlist/metadata role checks allow evaluator access without admin access.

Not done yet:

- No saved filters, role/req/session/candidate filters, prompt/model filters, feature-variant filters, retention/redaction filters, or reviewer/dataset filters.
- No durable run labels or side-by-side comparison launcher.
- No raw-generated vs curated vs rendered-output display state.
- QA access is not yet database-managed.

To do:

- Add column controls, saved filters, and deep links.
- Add filters for date range, role, req ID, session ID, invite batch ID, candidate ID, created_by, prompt version, model, product variant, redaction status, retention class, and dataset/review state.
- Add durable run labels and source-reference grouping beyond the current page-level session/correlation/surface grouping.
- Add detail tabs for input, context artifacts, prompt, raw output, parsed output, rendered output, errors, trace, privacy, and source links.
- Add database-managed QA/evaluator roles and access audit events.

### Phase 3: Add Dataset Builder And Human Review Queues

Done:

- Manual handoff artifacts and example filled cases exist for interim Data Science review.
- Surface-level evaluation criteria are documented.

Not done yet:

- Dataset, eval item, eval output, scorecard, score, review, failure label, product-variant, and audit tables are not implemented.
- Operators cannot promote a generation into a dataset from the UI.
- Review queues, blind pairwise scoring, assignment, adjudication, and reviewer agreement tracking are not implemented.
- Candidate-visible rendered output cannot be reviewed separately from full model output.

To do:

- Implement `eval_datasets`, `eval_items`, `eval_item_sources`, `eval_outputs`, `eval_scorecards`, `eval_scores`, `eval_failures`, `eval_reviews`, `eval_product_variants`, and `eval_audit_events`.
- Add "add to dataset" from a single generation and from filtered/sampled explorer results.
- Support golden, edge, regression, red-team, calibration, and excluded dataset labels.
- Add scorecard-driven single-output review and side-by-side blind review.
- Add reviewer assignment, status, comments, severity, confidence, reusable failure labels, adjudication, and agreement metrics.
- Preserve raw-generated, curated, parsed, rendered, baseline, and comparison-output relationships.

### Phase 4: Add Automated Evaluators

Done:

- Provider response parsing and schema validation already create failure signals for malformed model output.
- Captured generations include enough prompt/input/output/error context to seed automated checks.

Not done yet:

- No automated eval jobs, LLM-as-judge scoring, pairwise judges, red-team suites, or recurring drift checks exist.
- No structured automated score storage exists beyond generation status/error fields.
- No evaluator calibration or judge-quality tracking exists.

To do:

- Add deterministic checks for required fields, JSON validity, schema conformity, empty output, duplicate questions, malformed Markdown, unsafe links, and parser failures.
- Add redaction checks for PII leakage and raw-restricted data exposure.
- Add grounding checks that verify output references only available question, answer, role, job description, resume/intake, and blueprint context.
- Add LLM-as-judge scorecards calibrated against human review.
- Add pairwise judges for baseline vs alternative model, prompt A vs B, and product variant A vs B.
- Add scheduled production drift sampling.

Red-team coverage should include:

- PII leakage
- prompt injection
- bias/discrimination
- harmful content
- malformed output
- unsafe hiring guidance
- unsupported claims about candidates

### Phase 5: Add Experiment Runner And CI Gates

Done:

- Baseline app outputs can be captured and manually replayed outside the platform.
- The roadmap defines prompt/model/product comparison as a target workflow.

Not done yet:

- The platform cannot yet run alternative models, store comparison outputs, or score experiment results end to end.
- CI/release gates do not consume eval results.
- Eval reports are not generated for leaders.

To do:

- Add experiment setup for dataset, prompt version, model provider, model name, model parameters, parser/schema version, product variant, and evaluator set.
- Store comparison outputs per item in `eval_outputs`.
- Support prompt-only, model-only, parser/schema, product-variant, and combined experiment runs.
- Add cost, latency, quality, safety, parseability, grounding, and reviewer-preference comparisons.
- Add release thresholds and CI checks for prompt/model/pipeline changes.
- Generate eval reports that summarize wins, losses, risks, and release recommendations by surface.

## Target End State

The AI Quality Platform should make quality measurable, repeatable, and operational:

- Data Science can compare local LLM quality against production models.
- QA/QC can define and enforce quality standards.
- Engineering can debug and replay AI behavior.
- Product leaders can see whether quality is improving.
- Production incidents become regression tests.
- Future AI apps inherit the same platform instead of rebuilding eval plumbing.
