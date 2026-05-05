# Initial AI Eval Packet

## Purpose

This packet is for Data Science and human evaluators who are comparing the recruiter app's current AI behavior against an alternative model, prompt, or runtime.

The current filled examples cover two AI surfaces:

1. Question generation
2. Candidate answer feedback

The broader AI quality platform should also cover these app surfaces, but this initial packet does not yet include filled examples for them:

3. Hints
4. Strong response generation
5. Session debrief

Today, without a platform UI, evaluators should treat this packet as a manual comparison workflow:

1. Trigger AI content in the app.
2. Capture the app input, app output, and rendered prompt/debug context when available.
3. Run the same input and, where possible, the same rendered prompt through a comparison model.
4. Score both outputs with the same rubric.
5. Return outputs, scores, and failure notes.

## Initial Case Set

Use these filled examples for the first comparison pass:

| Case ID | Surface | Source | Purpose |
| --- | --- | --- | --- |
| `QG-001` | `question_generation` | Security Engineer invite batch | Technical/regulated-domain role grounding and specificity. |
| `QG-002` | `question_generation` | Warehouse Associate invite batch | Plain-language, frontline-role adaptation and safety. |
| `CAF-001` | `candidate_answer_feedback` | Manufacturing Engineer answer/feedback | Happy-path coaching quality and role grounding. |
| `CAF-002` | `candidate_answer_feedback` | IT Project Coordinator answer/feedback | Thin-answer edge case, low-evidence handling, redo guidance. |

Important source limitation:

- The question-generation examples come from `invite_batches.questions_json`.
- That is feature data, not raw generation data.
- Lower question counts in invite-batch data can reflect recruiter curation after generation, not malformed AI output.
- Raw generation replay will become more reliable after the AI Quality Platform captures `ai_generations` at source for every AI call.

## Evaluator Recipe

### Step 1: Choose A Surface

Start with one of the two surfaces included in this packet:

- `question_generation`
- `candidate_answer_feedback`

For hints, strong responses, or session debriefs, use the handoff capture sheet and the same comparison method, but expect the rubric to be provisional until we add dedicated examples and scorecards.

### Step 2: Capture The App Baseline

For each case, capture:

- surface name
- role/job context
- candidate/resume context, if it was used
- question/transcript/context, if applicable
- current app output
- rendered app prompt or debug prompt, if available
- model/provider metadata, if available

Use the lean handoff artifact:

- `../handoff/case-capture-sheet.md`

If the rendered prompt is available from the hidden app debug inspector, include it as `prompt_snapshot`. If it is not available, briefly describe what app instructions were visible or inferable.

### Step 3: Run The Comparison Model

Use the same prompt snapshot whenever possible.

If the rendered app prompt is unavailable:

- Use the surface task in the filled case file.
- Use the same input context.
- Keep output-format requirements the same.
- Record the fact that the prompt is reconstructed, not app-exact.

Do not add extra context to the comparison model that the app model did not receive.

### Step 4: Score Both Outputs

Score the app output and the comparison-model output independently.

Use:

- `05_eval_rubrics.md` for question generation and candidate answer feedback.
- `../handoff/model-comparison-score-sheet.md` to record scores and notes.

The baseline app output is not automatically the gold answer. It is a reference output.

### Step 5: Return The Results

Return:

- completed score sheet
- app baseline output
- comparison-model output
- schema or format failures
- hallucination, grounding, privacy, bias, or safety notes
- recommendation on whether the case is useful for broader eval calibration
- recommendation on whether the comparison model should continue to more cases

## Handoff Artifacts

The evaluator-facing handoff kit lives in:

```text
docs/05-quality/AI-eval/handoff/
```

Use the artifacts in this order:

| File | Use |
| --- | --- |
| `README.md` | Recipe-card workflow for manual model comparison. |
| `data-handling.md` | Redaction and handling rules for test cases and outputs. |
| `surface-run-recipes.md` | Surface-specific instructions for what to trigger and capture. |
| `case-capture-sheet.md` | Lean template for capturing app inputs, app outputs, and prompt snapshots. |
| `model-comparison-score-sheet.md` | Lean return sheet for evaluator scores and comparison notes. |

## Engineering Templates

The remaining files in this `initial-packet` folder are fuller engineering/platform templates. They are useful for building the future AI Quality Platform, but evaluators do not need to fill every field during the manual handoff workflow.

| File | Use |
| --- | --- |
| `00_packet_manifest.template.yaml` | Packet inventory, case list, source IDs, redaction posture, and comparison notes. |
| `01_data_selection_checklist.md` | Guidance for choosing source examples. |
| `02_redaction_and_handling.md` | Full redaction and handling policy. |
| `03_question_generation_case_template.md` | Rich source template for one question-generation case. |
| `04_candidate_answer_feedback_case_template.md` | Rich source template for one answer-feedback case. |
| `05_eval_rubrics.md` | Scoring rubric for included surfaces. |
| `06_evaluator_response_sheet.md` | Full evaluator response template. |
| `07_local_llm_run_instructions.md` | Earlier local-model run guidance. |
| `case-template.*.json` | Machine-readable case templates for future platform workflows. |
| `evaluator-response-template.json` | Machine-readable response template for future platform workflows. |

## Safety Boundary

This packet should contain redacted evaluation examples, not raw production records.

Do not include:

- candidate email
- phone number
- address
- full resume text unless explicitly approved
- raw audio
- invite link or candidate token
- recruiter identifiers unless necessary and approved
- client-confidential details that are not needed for evaluation

For candidate answer feedback, preserve this product boundary:

> Candidate coaching feedback is for candidate improvement and AI quality evaluation. It must not be used by recruiters as a hiring recommendation, ranking, pass/fail signal, or selection input.
