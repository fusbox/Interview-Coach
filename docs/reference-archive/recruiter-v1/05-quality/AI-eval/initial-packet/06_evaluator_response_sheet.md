# Evaluator Response Sheet

## Evaluator Metadata

```yaml
evaluator_name: ""
evaluation_date: "YYYY-MM-DD"
candidate_model_provider: ""
candidate_model_name: ""
candidate_model_version: ""
runtime_environment: "local | hosted | other"
decoding_params:
  temperature: null
  top_p: null
  max_tokens: null
```

## Case Result Template

Copy this section once per case.

```yaml
case_id: ""
surface: "question_generation | candidate_answer_feedback"
model_completed: true
schema_valid: true
blocked_or_failed: false
failure_reason: ""
```

### Scores

For question generation, use QG dimensions. For answer feedback, use CAF dimensions.

| Dimension | Score 1-5 | Notes |
| --- | --- | --- |
| `QG-1 or CAF-1` |  |  |
| `QG-2 or CAF-2` |  |  |
| `QG-3 or CAF-3` |  |  |
| `QG-4 or CAF-4` |  |  |
| `QG-5 or CAF-5` |  |  |
| `QG-6 or CAF-6` |  |  |
| `QG-7 or CAF-7` |  |  |
| `QG-8 or CAF-8` |  |  |
| `CAF-9 if applicable` |  |  |
| `CAF-10 if applicable` |  |  |

### Failure Modes

Check any that apply.

- [ ] malformed JSON
- [ ] missing required field
- [ ] generic output
- [ ] not grounded in supplied context
- [ ] hallucinated fact
- [ ] inappropriate hiring recommendation
- [ ] unsafe or biased content
- [ ] privacy/PII issue
- [ ] poor tone
- [ ] not useful to candidate
- [ ] wrong modality assumptions
- [ ] other: ``

### Model Output

Paste the model output below.

```json
{}
```

### Evaluator Summary

```text
[Brief summary of what worked, what failed, and whether this model should continue to the next evaluation round.]
```

## Overall Recommendation

```yaml
recommended_next_step: "continue_testing | revise_prompt | reject_model_for_now | needs_more_cases"
summary: |
  [One paragraph recommendation.]
```
