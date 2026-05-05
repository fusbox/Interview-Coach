# Data Selection Checklist

Use this checklist when choosing the initial examples.

## General Rules

- Prefer examples that are realistic and representative.
- Include at least one normal/happy-path case.
- Include at least one edge or stress case.
- Redact direct identifiers before handoff.
- Preserve enough context for the evaluator to judge quality.
- Do not include raw invite links, candidate tokens, or raw audio.

## Question Generation Cases

Select one or more complete question-generation cases that include:

- target role
- job description
- optional resume context if it influenced generation
- prompt version if available
- model provider and model name if available
- generated output
- final accepted question set if different from raw generation

For the initial packet, include:

1. `QG-001`: technical or regulated-domain role with enough job context to test role grounding and domain specificity.
2. `QG-002`: frontline or operational role with enough job context to test plain-language adaptation, safety, and concrete role relevance.

Preferred sources:

- `ai_generations` where `surface = 'question_generation'`
- `invite_batches.questions_json` for final accepted invite question set
- `invite_batches.role`
- `invite_batches.job_description`

Use `ai_generations` when evaluating raw generation quality. Use `invite_batches.questions_json` when evaluating the final accepted question set that reached invite creation.

Important current limitation:

- `invite_batches.questions_json` is feature data, not source-level generation data.
- A lower question count in `invite_batches.questions_json` can reflect recruiter curation after generation, not malformed AI generation.
- Until the AI Quality Platform captures raw `ai_generations` consistently, treat invite-batch question sets as accepted product examples rather than raw model-generation evidence.

## Candidate Answer Feedback Cases

Select two answer-feedback cases:

1. `CAF-001`: typical answer with useful feedback
2. `CAF-002`: edge/stress answer

Useful edge cases include:

- thin answer
- off-topic answer
- answer with sensitive personal disclosure
- answer with direct PII
- resume-heavy context
- voice transcript with unclear phrasing
- feedback that recommended redo
- feedback with low confidence

Preferred sources until answer-feedback capture is fully implemented:

- `sessions.session_id`
- `sessions.target_role`
- `sessions.job_description`
- `sessions.intake_json` for candidate/resume context, redacted
- `questions.question_id`
- `questions.question_text`
- `questions.category`
- `answers.final_text`
- `answers.submitted_at`
- `eval_results.feedback_json`

When answer-feedback `ai_generations` capture is implemented, prefer:

- `ai_generations.input_snapshot`
- `ai_generations.prompt_snapshot`
- `ai_generations.raw_output`
- `ai_generations.parsed_output`
- `ai_generations.source_refs`
- `ai_generations.privacy_flags`
- `ai_generations.redaction_status`

## Exclusion Criteria

Do not include examples if they contain:

- unredacted candidate email, phone, SSN, or address
- raw resume text that is longer than needed for evaluation
- protected-class information unless the case is explicitly selected for safety testing and properly governed
- client-confidential details that are not needed for the eval
- raw audio
- secrets, tokens, invite URLs, or internal credentials
