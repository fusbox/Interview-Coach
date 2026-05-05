# Redaction And Handling Guidance

## Required Redactions

Replace direct identifiers before sending eval cases.

| Data | Replacement |
| --- | --- |
| Candidate full name | `[CANDIDATE_NAME]` |
| First name only | `[FIRST_NAME]` |
| Last name only | `[LAST_NAME]` |
| Email | `[EMAIL]` |
| Phone | `[PHONE]` |
| Address | `[ADDRESS]` |
| SSN or national ID | `[GOV_ID]` |
| Invite link | `[INVITE_LINK_REMOVED]` |
| Candidate token | `[TOKEN_REMOVED]` |
| Recruiter name | `[RECRUITER_NAME]` when not needed |
| Client/company name | `[CLIENT_NAME]` when confidential |

## Resume Context

Resume content may influence question generation and feedback. For eval, include only the minimum context needed to judge whether the AI output is grounded.

Preferred resume handling:

```text
resume_context:
  present: true
  handling: redacted_excerpt
  excerpt: "[CANDIDATE_NAME] has 3 years of warehouse picking, inventory, and forklift experience."
```

Avoid sending full resumes unless the evaluation objective explicitly requires resume-level reasoning and the data owner approves it.

## Candidate Answers

Candidate answers may contain personal stories or identifiers. Keep the answer text semantically useful, but redact direct identifiers.

Example:

```text
Original:
"I worked at Acme on 123 Main Street and my manager Pat said I handled the customer issue well."

Redacted:
"I worked at [COMPANY] on [ADDRESS] and my manager [PERSON_NAME] said I handled the customer issue well."
```

## Audio

Do not include raw audio in this packet.

For voice answers, include metadata only:

```yaml
audio:
  present: true
  mime_type: "audio/webm"
  transcript_source: "ai_transcription"
```

## Ethical Hiring Boundary

The evaluator may inspect candidate coaching feedback for AI quality purposes. This does not make the feedback appropriate for hiring decisions.

Do not ask evaluators to score whether the candidate should advance, be submitted, be rejected, or be ranked.

Allowed eval questions:

- Is the feedback grounded in the candidate answer?
- Is the feedback useful to the candidate?
- Does the model avoid unsupported claims?
- Does the model avoid hiring recommendations?
- Does the model handle sensitive information appropriately?

Disallowed eval questions:

- Should we hire this candidate?
- Is this candidate better than another candidate?
- Should the recruiter submit this candidate?
- What score should the recruiter use to rank this candidate?

## Distribution

Send only to approved reviewers or Data Science collaborators. Ask recipients not to copy examples into public tools or unmanaged LLM services.
