# Candidate App Threat Model

Date: 2026-05-07
Status: Initial working threat model

## Purpose

This document identifies the first security and privacy risks for the candidate-led Interview Coach app.

It should be updated whenever auth, persistence, uploads, AI services, or deployment boundaries change.

## Security Posture

Security should be built into each feature slice, not handled as a release cleanup step.

Reference baselines:

- NIST Secure Software Development Framework
- OWASP ASVS
- OWASP Top 10

## Assets

Sensitive assets include:

- candidate identity
- email address
- resume text
- uploaded resume files
- resume photos
- practice session answers
- generated feedback
- coaching summaries
- auth session tokens
- SSO identity assertions
- AI provider request and response artifacts

## Trust Boundaries

Initial boundaries:

- browser to Next.js app
- public routes to protected routes
- app server to Postgres
- app server to blob storage
- app server to AI providers
- app server to RangamWorks SSO
- app server to Azure monitoring and logs

## Primary Abuse Cases

### Candidate Data Access Across Accounts

Risk:

One candidate accesses another candidate's sessions, resume assets, or dashboard history.

Mitigations:

- require candidate context on protected routes
- enforce `candidate_profile_id` in every server query
- test not-found and forbidden paths separately
- avoid trusting route params alone

### Resume Data Leakage

Risk:

Resume content appears in logs, analytics, prompts, screenshots, or diagnostic exports without controls.

Mitigations:

- redact logs by default
- store raw files behind private blob paths
- accept only private relative upload storage paths in app metadata; reject public URLs, protocol-relative paths, query strings, fragments, backslashes, and parent traversal
- avoid raw resume text in client telemetry
- document AI artifact capture rules
- define retention periods

### Prompt Injection Through Candidate Inputs

Risk:

Resume or job description text attempts to override system behavior or leak hidden instructions.

Mitigations:

- separate candidate-provided content from system instructions
- treat resume/JD as untrusted data
- include prompt tests for adversarial inputs
- do not expose secrets or internal prompts in generated output

### Upload Abuse

Risk:

Candidate uploads malicious, oversized, or unsupported files.

Mitigations:

- enforce file type and size limits
- scan or validate files before extraction if platform tooling supports it
- process uploads server-side
- collapse parser errors to safe reason codes; never persist raw parser messages, local file paths, storage URLs, or resume content as failure details
- store originals privately
- fail safely with recoverable draft state

### Weak Dev Auth Reaching Production

Risk:

Mock auth or local password shortcuts are enabled outside local/test environments.

Mitigations:

- require explicit env flags
- fail closed in production
- test production config behavior
- log auth backend selection without secrets

### Broken Deployment Controls

Risk:

Unreviewed or unverified changes deploy to staging or production.

Mitigations:

- branch policies
- required build validation
- linked work items
- environment approvals and checks
- rollback process

## Minimum Security Requirements

- no Supabase runtime secrets or clients
- no public blob access for candidate files
- no public upload URLs or unsafe storage paths persisted in candidate draft metadata
- no raw parser errors persisted in candidate draft metadata
- no raw session token storage
- no cross-candidate data access
- no production mock auth
- no unvalidated file uploads
- no raw resume text in ordinary application logs

## Open Questions

- What compliance or retention requirements apply to candidate resumes?
- Will uploaded files need malware scanning before OCR or parsing?
- What AI providers are approved for resume and interview content?
- What redaction level is required for AI-quality debugging?

## References

- NIST SSDF: https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
