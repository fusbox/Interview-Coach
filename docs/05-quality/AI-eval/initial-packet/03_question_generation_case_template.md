# Question Generation Eval Case Template

## Case Metadata

```yaml
case_id: "QG-001"
surface: "question_generation"
source_record:
  ai_generation_id: ""
  invite_batch_id: ""
app_name: "recruiter_app"
prompt_version: ""
model_provider: ""
model_name: ""
redaction_status: "redacted"
created_at: ""
```

## Evaluation Objective

Evaluate whether the model can generate a complete, role-grounded, safe, and useful interview question set from recruiter-provided job context.

## Input Context

```yaml
target_role: ""
job_description: |
  [Paste redacted job description or representative excerpt.]
resume_context:
  present: false
  handling: "none | redacted_excerpt | source_ref_only"
  excerpt: |
    [Optional redacted resume excerpt if used by the original generation.]
question_requirements:
  behavioral_count: 4
  culture_count: 5
  technical_count: "1-2"
```

## Prompt Snapshot

```text
[Paste redacted prompt snapshot if available from ai_generations.prompt_snapshot.
If unavailable, describe the prompt version and generation instructions used.]
```

## Baseline App Output

Paste the generated output used as the current app/reference output.

```json
{
  "behavioral": {
    "Conflict/Resolution": "",
    "Adaptability": "",
    "Initiative/Growth": "",
    "Role-Specific Scenario": ""
  },
  "culture": {
    "Positive Emotion": "",
    "Engagement": "",
    "Relationships": "",
    "Meaning": "",
    "Accomplishment": ""
  },
  "technical": [
    { "text": "" }
  ]
}
```

## Final Accepted Question Set

If the recruiter edited or accepted a final set, paste it here. If same as baseline output, write `same as baseline`.

```json
[]
```

## Local LLM Task

```text
Using only the provided target role, job description, and optional resume context, generate interview questions in the required JSON structure.

Do not mention STAR or PERMA in the question text.
Use plain, supportive language appropriate for the target role.
Avoid illegal, biased, protected-class, or hiring-decision language.
Output strict JSON only.
```

## Evaluator Notes

```text
[Evaluator fills notes here.]
```
