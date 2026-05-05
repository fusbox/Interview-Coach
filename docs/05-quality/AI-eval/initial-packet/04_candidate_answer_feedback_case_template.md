# Candidate Answer Feedback Eval Case Template

## Case Metadata

```yaml
case_id: "CAF-001"
surface: "candidate_answer_feedback"
source_record:
  ai_generation_id: ""
  session_id: ""
  question_id: ""
  answer_attempt: ""
  eval_result_attempt: ""
app_name: "recruiter_app"
prompt_version: ""
model_provider: ""
model_name: ""
redaction_status: "redacted"
created_at: ""
```

## Evaluation Objective

Evaluate whether the model provides candidate-facing coaching feedback that is grounded, useful, safe, schema-valid, and not usable as a hiring recommendation.

## Input Context

```yaml
target_role: ""
job_description: |
  [Paste redacted job description or representative excerpt.]
question:
  index: 0
  category: ""
  text: ""
candidate_answer:
  modality: "text | voice"
  transcript: |
    [Paste redacted candidate transcript or text answer.]
resume_context:
  present: false
  handling: "none | redacted_excerpt | source_ref_only"
  excerpt: |
    [Optional redacted resume excerpt if relevant.]
retry_context:
  present: false
  trigger: ""
  focus: ""
progress:
  current: 1
  total: 1
```

## Prompt Snapshot

```text
[Paste redacted prompt snapshot if available.
If unavailable, describe the prompt version and key instructions used.]
```

## Baseline App Feedback Output

Paste the current app output from `eval_results.feedback_json` or `ai_generations.parsed_output`.

```json
{
  "feedbackPlan": {
    "centralRead": "",
    "signal": {
      "valence": "strength | mixed | growth",
      "detectability": "clear | moderate | ambiguous | thin"
    },
    "primaryAnchor": {
      "source": "content | delivery | fallback",
      "signalType": "quote | behavior | pattern | effort | omission",
      "dimension": "",
      "candidateEvidence": "",
      "interviewerValue": ""
    },
    "intervention": {
      "type": "amplify_strength | sharpen_signal | repair_foundation | polish_response",
      "reason": ""
    }
  },
  "ack": "",
  "scores": {},
  "contentPulse": {
    "dimension": "",
    "headline": "",
    "body": "",
    "quote": ""
  },
  "deliveryPulse": null,
  "nextAction": {
    "label": "",
    "actionType": "redo_answer | next_question | stop_for_now"
  },
  "recommendation": "",
  "meta": {
    "tier": 1,
    "modality": "text | voice",
    "confidence": "low | medium | high",
    "readinessLevel": ""
  },
  "transcript": ""
}
```

## Local LLM Task

```text
Using only the supplied role, job description, question, transcript, and optional context, generate candidate-facing coaching feedback.

The output must:
- Be addressed to the candidate.
- Ground claims in the candidate answer.
- Provide useful coaching, not a hiring recommendation.
- Avoid ranking, pass/fail judgments, or recruiter decision guidance.
- Avoid unsupported claims about the candidate.
- Preserve the required JSON schema.
- Redact or avoid repeating sensitive personal data when not necessary.
```

## Evaluator Notes

```text
[Evaluator fills notes here.]
```
