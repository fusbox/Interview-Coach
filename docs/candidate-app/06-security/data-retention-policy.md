# Data Retention Policy

Date: 2026-05-07
Status: Initial working policy

## Purpose

This document defines the initial data retention posture for candidate data.

It is intentionally conservative because resumes, interview answers, and generated coaching are sensitive candidate data.

## Policy Principle

Retain the minimum data needed to provide candidate value, restore candidate sessions, support debugging, and satisfy agreed business requirements.

Do not retain raw resume files by default after successful normalization and redaction.

## Data Classes

### Candidate Profile

Examples:

- email
- display name
- workspace
- identity provider bindings

Initial retention:

- retain while the candidate account/profile is active
- delete or anonymize when candidate deletion policy is invoked

### Resume Data

Examples:

- pasted resume text
- extracted text
- normalized/redacted processed resume artifact
- original uploaded PDF/DOCX/images

Initial retention:

- retain processed resume artifact when needed for candidate reuse
- delete original uploaded files after successful extraction by default
- retain original files only if an explicit future policy permits it

Current pasted-text implementation:

- pasted resume text is normalized before draft persistence
- normalized pasted text is stored as a processed resume artifact inside draft resume context for the candidate-owned practice draft
- `processedArtifact.originalRetained` is false for the current pasted-text path
- no original file is created or retained for the pasted-text path

### Practice Drafts

Examples:

- target role
- job description
- resume context snapshot
- intake responses
- generation status

Initial retention:

- retain active drafts while candidate can resume them
- archive or purge abandoned drafts after a future inactivity threshold is defined

### Interview Sessions

Examples:

- questions
- answers
- transcripts
- feedback
- summaries
- completion state

Initial retention:

- retain completed session history for candidate dashboard value
- define candidate deletion/export behavior before production

### Logs And Telemetry

Examples:

- auth denials
- route errors
- generation failures
- extraction failures
- latency metrics

Initial retention:

- avoid raw resume text and raw answers in ordinary logs
- redact candidate identifiers where possible
- preserve operational metadata needed for support and reliability

## Requirements

- raw resume files are private and short-lived by default
- processed resume text is candidate-owned
- logs must not include raw resume text by default
- deletion behavior must be server-side and auditable
- future retention changes require a decision record or policy update

## Open Questions

- What formal retention periods does the company require?
- Will candidates be able to export all practice data?
- Will candidates be able to delete individual sessions?
- Are there jurisdiction-specific rules for job-seeker data that apply to this app?
