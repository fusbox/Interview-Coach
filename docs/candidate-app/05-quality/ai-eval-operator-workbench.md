# AI Eval Operator Workbench

Status: Ratified product direction and working implementation contract
Last updated: 2026-07-22

## Purpose

The AI eval surface is an operator workbench for improving Interview Coach outputs. Its primary job is to help a qualified reviewer move from an observed quality problem to a traceable remediation decision and then verify whether the change fixed the same failure class.

The workbench is not a candidate dashboard, a generic provider-log viewer, or primarily a model-comparison tool. Its initial allocation is:

- about 90% coach-delivered analysis, evaluation, immediate feedback, and post-round Coach Update quality;
- about 10% generated-question quality from role, job-description, optional processed-resume, stage, and plan context.

Same-input A/B model execution and blind pairwise review remain compatible future capabilities, but they may not delay the operator review and remediation loop.

## Operator Outcome

An operator must be able to answer five questions for one exact serving output:

1. What did the candidate see?
2. What immutable source facts and accepted engine facts produced it?
3. Which part is correct, weak, unsupported, unsafe, or unable to be assessed?
4. Which engine component or governed input should change?
5. What case and expected behavior will prove the remediation worked?

A review that ends only in a numeric score or free-form comment is incomplete. Every actionable finding must be mappable to a remediation target and a recheck case.

## In Scope

### Answer coaching

Candidate-led and invited practice use the same evaluator contract but separate ownership tables. The workbench must treat both as one `answer_coaching` surface while retaining audience and source identity for authorization and tracing.

The review unit is one immutable answer attempt plus one exact completed or terminal evaluator run. The detail view may expose:

- exact question, category, planned purpose, role, stage, and bounded JD context;
- exact submitted answer and response mode;
- answer usability;
- accepted exact evidence spans and observable markers;
- category-specific signals and missing-evidence signals;
- universal-criterion applicability, evidence references, and qualitative bands;
- technical-reference availability and technical-accuracy disposition;
- selected pattern gap and conditional verification result;
- feedback plan, claim-to-evidence links, and the exact candidate-safe coaching shown;
- provider/profile/prompt/evaluator/configuration identity, lifecycle, safe failure code, and bounded latency/token metadata.

The operator reviews both the engine interpretation and the candidate-facing language. Correct prose generated from incorrect evidence remains a failure. Correct evidence rendered as generic, unnatural, misleading, or unactionable coaching also remains a failure.

### Coach Update

The review unit is one immutable completed Coach Update artifact. The workbench must show the exact update shown to the candidate and let the reviewer drill into the accepted answer-evaluation runs used by the synthesis.

Review covers:

- practiced-question completeness and source consistency;
- synthesis fidelity to immediate coaching;
- appropriate progression, regression, or continuity language;
- one useful primary focus without pretending unanswered plan coverage was evaluated;
- coherent feedback-to-feedforward guidance;
- natural, specific, candidate-safe language;
- no score, ranking, hiring recommendation, unsupported improvement claim, or invented evidence.

### Question wording

Question quality is a separate rubric, not answer-evaluation criteria applied to a different output. The review unit is one immutable generated question set and its exact plan/context/configuration identity. Candidate baseline sets and recruiter-generated invitation sets both qualify; manually entered recruiter sets do not represent model output and are excluded from model-quality review.

Review covers:

- role, JD, and optional processed-resume grounding;
- stage, category, planned-purpose, and baseline-plan fit;
- clarity, accessibility, answerability, and natural wording;
- appropriate specificity without assuming unsupported candidate experience;
- set-level uniqueness, diversity, and coverage;
- legal, bias, privacy, and safety boundaries;
- strict slot, order, count, and schema validity.

## Out Of Scope For The Initial Workbench

- TTS, voice transcription, resume extraction/OCR, and parser quality;
- candidate-visible QA scores, evaluator internals, or model comparisons;
- recruiter access to candidate coaching or evaluator facts;
- enterprise BI and engagement reporting;
- automatic prompt/model promotion or rollback;
- LLM-as-judge replacing accountable human review;
- raw provider response or assembled-prompt retention;
- a new technical-reference retrieval system;
- same-input alternate-model execution and blind pairwise comparison.

An operational failure from an excluded AI service may be handled by that service's runbook and telemetry. It should not be forced into this coaching-quality workbench merely because a model was involved.

## Prior-Behavior Disposition

### Preserve

- V1's dedicated QA responsibility and productized operator surface, reimplemented as a separately granted individual capability rather than an inherited app role;
- searchable/filterable generation discovery;
- exact source/output/configuration inspection;
- surface-specific rubrics, reusable failure labels, and filtered export as a later controlled operation;
- the principle that a production problem can become a durable regression case.

### Reinterpret

- Replace V1's broad `ai_generations` packet with references to exact V2 serving artifacts and just-in-time source reads.
- Replace one-to-five score sheets with structured correctness judgments, severity, confidence, findings, and remediation targets.
- Replace answer-feedback, hint, strong-response, and session-debrief surfaces with current V2 answer coaching and Coach Update boundaries.
- Treat question generation as set-level plus per-question review tied to the immutable plan and wording snapshot.

### Retire

- Raw-JSON-dump-first operator UX;
- candidate names, emails, recruiter identity, or broad record identifiers in queue views;
- normal retention of assembled prompts, raw provider output, raw resume uploads, or unsanitized resume content;
- generic overall scores that obscure which evaluation layer failed;
- the V1 source-app dimension and surfaces that no longer exist in V2.

### Defer

- approved alternate serving profiles;
- experiment runner, blind pairwise review, adjudication, and reviewer-agreement metrics;
- automated promotion/release gates driven directly by workbench state;
- large-scale sampling, drift dashboards, cost analytics, and enterprise reporting.

## Workbench Workflow

```text
eligible exact output
    -> select or promote into QA work queue
    -> inspect candidate-visible output and evidence lineage
    -> record structured review and findings
    -> group findings into a remediation hypothesis
    -> change prompt, rule, schema, context, or safety boundary
    -> run the same case or promoted regression case again
    -> record verification outcome
```

### Queue

The queue should support operator-oriented filtering by:

- surface and audience;
- lifecycle and safe failure code;
- provider, model/profile, prompt/evaluator version, and configuration fingerprint;
- interview stage and question category;
- work-item status, priority, assignment, failure label, and remediation state;
- created/completed date and opaque case identifier.

Candidate identity is not a queue filter. Production sampling, manually promoted outputs, provider/schema failures, golden cases, and incidents must have distinct selection reasons.

### Detail

The detail view should lead with what the user saw, then reveal the engine lineage in layers. Raw JSON may be available as a secondary diagnostic representation of already approved structured facts; it must not be the primary workflow.

For answer coaching, the recommended inspection order is:

1. question and submitted answer;
2. candidate-safe coaching;
3. usability, spans, markers, and category signals;
4. criterion applicability/bands and pattern-gap choice;
5. verifier and feedback-plan decisions;
6. configuration and lifecycle diagnostics.

For Coach Update, show the update first, its source practiced questions second, and the accepted answer-run drill-down third. For question wording, show the set and plan shape first, then bounded role/JD/processed-resume context and generation identity.

### Review

One review has an overall disposition:

- `acceptable`;
- `acceptable_with_observation`;
- `needs_improvement`;
- `unsafe_or_blocking`;
- `unable_to_assess`.

It also records severity (`informational`, `minor`, `major`, `blocking`), reviewer confidence (`low`, `medium`, `high`), and surface-specific layer judgments. A layer judgment is `correct`, `partly_correct`, `incorrect`, `not_applicable`, or `unable_to_assess`.

Submitted reviews are immutable. An in-progress draft may be revision-fenced and resumed by its reviewer. A later reviewer or adjudication pass creates another submitted review rather than rewriting history.

### Findings

Each finding identifies the faulty or uncertain layer, a reusable failure label, severity, a source reference, and a concise rationale. Initial failure-label families are:

- context missing, excessive, stale, or mismapped;
- usability classification error;
- evidence-span miss, false positive, or unsafe span;
- observable-marker miss or false positive;
- category-signal miss, false positive, or category mismatch;
- criterion applicability, evidence-link, or qualitative-band error;
- technical-reference or technical-accuracy error;
- pattern-gap priority error;
- verification skipped, unnecessary, or incorrect;
- feedback ungrounded, overclaimed, generic, contradictory, unnatural, unsafe, or unactionable;
- Coach Update source omission, contradiction, unsupported progression, or weak feedforward;
- question ungrounded, category/purpose mismatch, over-specific, ambiguous, inaccessible, repetitive, unsafe, or set-coverage weak;
- schema, lifecycle, serving, or candidate-projection failure.

The label vocabulary is versioned. Free-form notes supplement labels; they do not replace them.

### Remediation And Recheck

A remediation hypothesis records:

- one target component;
- the expected behavior change;
- the finding or findings it addresses;
- likely side effects or regression risks;
- the source cases and golden/edge cases that must pass;
- the changed configuration, code, prompt, schema, or reference version;
- lifecycle state: `observed`, `triaged`, `planned`, `changed`, `ready_for_recheck`, `verified`, `wont_fix`, or `duplicate`.

Initial target components include:

- context assembly;
- evidence-extraction prompt/schema;
- exact-span hydration/validation;
- marker derivation;
- category signal vocabulary/lens;
- deterministic criterion appraisal;
- pattern-gap prioritization;
- technical-reference policy;
- verifier rule/prompt;
- feedback-composition prompt/guard;
- candidate-safe projection;
- Coach Update synthesis/projection;
- question-plan rule;
- question-wording prompt/schema;
- UI rendering only;
- insufficient product specification or test coverage.

A recheck links the remediation to a later exact output/configuration and records whether the expected failure class is fixed, unchanged, regressed, or unable to assess. This is sequential verification, not yet a blind A/B experiment.

## Source And Persistence Boundary

The workbench must not copy candidate, answer, JD, resume, or coaching content into QA workflow tables. Those tables store references, review decisions, remediation state, and non-content configuration identity. Authorized detail reads resolve the exact immutable source just in time.

The source matrix is:

| Surface | Exact source |
| --- | --- |
| Candidate-led answer coaching | `candidate_answer_attempts` plus one `candidate_answer_evaluation_runs` row |
| Invited answer coaching | `invited_practice_answer_attempts` plus one `invited_practice_answer_evaluation_runs` row |
| Coach Update | one `candidate_coach_update_artifacts` row and its accepted evaluator-run references |
| Candidate question wording | one prep-context baseline wording snapshot, anchored by its owned role profile/source session |
| Recruiter question wording | one generated `recruiter_invitation_question_sets` row; manual sets excluded |

The older `candidate_qa_eval_case`/run/comparison TypeScript export is a historical answer-only compatibility contract. It may supply migration ideas, but it must not become the workbench's authoritative source because it omits current evidence layers, invited persistence, Coach Update, and question wording.

Recommended durable workflow tables are:

- `ai_eval_work_items`: source kind/reference, selection reason, status, priority, assignment, and copied non-content configuration/filter facts;
- `ai_eval_reviews`: revision-fenced draft or immutable submitted review, reviewer, rubric version, disposition, severity, confidence, and surface-specific structured judgments;
- `ai_eval_failure_label_catalog`: versioned active/retired reusable failure labels bound to one review layer;
- `ai_eval_findings`: immutable submitted finding rows with failure-label version, layer, source reference, and rationale;
- `ai_eval_remediations`: hypothesis, target component, owner, lifecycle, changed configuration/code reference, risk, and verification note;
- a finding/remediation link and recheck link so one engine change may address several reviewed cases without duplicating their source content.

Core workflow fields should be relational and queryable. Surface-specific layer judgments may use schema-validated `jsonb` because answer coaching, Coach Update, and question wording have intentionally different rubrics that will evolve. Database checks must enforce valid surface/source combinations and exactly one source reference.

## Access, Privacy, And Audit

QA access is an explicit cross-owner trust boundary, not candidate ownership or organizational RBAC. Only an active app user with one active, manually provisioned `ai_eval_operator_grants` record may open the workbench or source details. `recruiter`, `admin`, and legacy `qa` roles do not imply this access, alone or in combination. Grant and revoke history is immutable and metadata-audited. The initial operating posture may have only one named operator; the boundary must still remain independently revocable and must not be weakened into an app-role shortcut.

Every source-detail read, review mutation/submission, finding mutation, remediation mutation/link, grant/revoke, and future export must create a metadata-only audit event. Queue views use opaque case identifiers and exclude names, emails, launch identity, recruiter identity, and invitation tokens. Detail views expose only content needed for the selected rubric:

- exact submitted answer is permitted for answer-grounding review;
- only already processed/PII-scrubbed resume text may be shown, collapsed by default;
- JD and answer content remain untrusted text and must not be copied into logs, URLs, analytics, or error messages;
- raw file/photo/audio inputs, assembled prompts, provider credentials, raw provider responses, and bearer/session material remain prohibited;
- broad export is deferred until redaction, audit, retention, and authorization behavior are separately accepted.

## Same-Input A/B Decision Gate

After the queue, detail, structured review, remediation, and recheck loop are usable, estimate A/B as an enhancement. Fold it into the same milestone only if all of the following are true:

- one exact governed input can be reconstructed from immutable source facts without retaining a raw prompt or prohibited payload;
- an alternate profile is explicitly approved for QA-only execution;
- the result can attach to the existing work item/recheck lineage without changing serving behavior;
- blind pairwise UI does not delay remediation work;
- token/cost, retention, provider, and access controls are accepted.

Otherwise defer the runner. Configuration identity and recheck lineage must still be designed so later comparison outputs can attach without replacing the workbench schema.

## Acceptance Sequence

1. Ratify this workflow, rubric boundaries, source matrix, access policy, and A/B gate.
2. Add durable work-item/review/finding/remediation schema plus individually granted authorization and source read models.
3. Land the smallest useful queue and detail workbench for all three surfaces.
4. Land review submission, finding capture, remediation mapping, and recheck linkage.
5. Run a QA milestone audit with representative candidate-led, invited, Coach Update, failed-output, and question-set cases.
6. Decide whether A/B is a small follow-on or a deferred enhancement based on the working foundation.
