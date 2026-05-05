# Local LLM Run Instructions

## Goal

Run the filled cases through a local or alternative LLM and compare output quality against the rubrics.

## Inputs

The evaluator should receive:

- filled question-generation case
- two filled candidate-answer-feedback cases
- `05_eval_rubrics.md`
- `06_evaluator_response_sheet.md`

## Question Generation Run Prompt

Use the filled case context and this task:

```text
You are generating interview practice questions for a candidate.

Use only the supplied target role, job description, and optional resume context.

Return strict JSON in this structure:
{
  "behavioral": {
    "Conflict/Resolution": "complete question text",
    "Adaptability": "complete question text",
    "Initiative/Growth": "complete question text",
    "Role-Specific Scenario": "complete question text"
  },
  "culture": {
    "Positive Emotion": "complete question text",
    "Engagement": "complete question text",
    "Relationships": "complete question text",
    "Meaning": "complete question text",
    "Accomplishment": "complete question text"
  },
  "technical": [
    { "text": "question text" }
  ]
}

Rules:
- Do not mention STAR or PERMA in question text.
- Use plain, supportive language.
- Ground questions in the role and job description.
- Avoid illegal, biased, protected-class, or sensitive personal questions.
- Output JSON only.
```

## Candidate Answer Feedback Run Prompt

Use the filled case context and this task:

```text
You are an interview coach giving private, candidate-facing feedback.

Use only the supplied role, job description, interview question, candidate transcript, optional resume context, retry context, and progress.

Return strict JSON with:
- feedbackPlan
- ack
- scores
- contentPulse
- optional deliveryPulse
- nextAction
- recommendation
- meta
- transcript

Rules:
- Address the candidate directly.
- Ground feedback in what the candidate actually said.
- Give useful coaching, not a hiring decision.
- Do not rank, pass, fail, reject, or recommend submitting the candidate.
- Do not infer protected traits, personality, honesty, disability, or hiring suitability.
- Avoid repeating sensitive PII unless necessary.
- Respect modality: text feedback should not invent vocal delivery observations.
- Output JSON only.
```

## Scoring

After each run:

1. Validate JSON/schema by inspection or parser.
2. Score each dimension in `05_eval_rubrics.md`.
3. Fill `06_evaluator_response_sheet.md`.
4. Include raw model output, redacted if needed.

## Comparison Notes

The baseline app output is not automatically the gold answer. It is a reference output. The evaluator should score both the local model output and, if requested, the baseline output using the same rubric.

Useful comparisons:

- local model vs current app output
- prompt version A vs prompt version B
- small local model vs larger local model
- local model vs hosted model

## Return Package

Return:

- completed evaluator response sheet
- model outputs for all cases
- any schema validation errors
- recommendation for next evaluation round
