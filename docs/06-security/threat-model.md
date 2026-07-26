# Candidate App Threat Model

Date: 2026-07-20
Status: Working threat model refreshed through the ratified transcript-first voice boundary

## Purpose

This document identifies the current security and privacy risks for the candidate Interview Coach app as it is being integrated into the shared recruiter Postgres repo.

It should be updated whenever auth, persistence, uploads, AI services, UI exposure, or deployment boundaries change.

Product/legal policy posture, app-local notices, consent moments, and retention requirements live in [Privacy, Disclosures, And Consent Requirements](privacy-disclosures-and-consent-requirements.md). This threat model should reference that artifact instead of duplicating disclosure copy or detailed retention policy.

## Scope And Assumptions

In scope:

- public and protected candidate routes on `interviewcoach.talentarbor.com`
- shared host route partitioning between candidate, recruiter, admin, QA, and invite-token paths
- candidate auth handoff, local dev auth, and mock auth controls
- candidate Postgres profile, draft, session, dashboard, and resume-context data
- resume paste, file-upload metadata, parser-agnostic extraction, and processed artifact retention
- candidate mutation rate limits, route metrics, structured logs, and seeded smoke paths
- planned candidate-led and invited browser audio capture, provider transcription, recoverable transcript drafts, and immutable voice answers
- Azure branch, PR, pipeline, and deployment-readiness controls that affect candidate integration safety

Out of scope for this pass:

- final TalentArbor/RangamWorks SSO implementation, because the callback/assertion protocol is still open
- final Azure Blob Storage account/container policy, malware scanning, and OCR/photo capture implementation
- polished candidate UI, which has not been built yet beyond route-level and feature-slice surfaces
- full enterprise incident management

Assumptions that materially affect risk:

- Production candidate auth mode is `external`; `dev`, `password`, and `mock` are local/test conveniences only.
- `interviewcoach.talentarbor.com` remains one deployable Next app rather than independently deployed candidate/recruiter apps behind a proxy.
- Candidate data is sensitive PII and interview-preparation content, but final legal/compliance retention requirements are not yet confirmed.
- Pasted/trusted-host text now uses a no-original processed-artifact boundary. Binary upload/photo extraction, malware scanning, and any temporary-storage controls still need platform decisions and evidence.
- AI prompt/response artifact retention is not approved for broad logging or diagnostics.

Open questions:

- What exact protocol will TalentArbor/RangamWorks use to hand identity to Interview Coach after login?
- Does `LoginWithType/2` support a return URL, callback URL, or signed state parameter?
- Which Azure storage account/container naming convention, retention policy, and malware scanning path will production use?
- What AI providers and diagnostic retention rules are approved for resume and interview content?

## System Model

### Primary Components

- Shared Next.js App Router application serving public, candidate, recruiter, admin, QA, and invite-token routes.
- Root middleware that protects recruiter routes, plus audience-specific server resolvers for authenticated candidates, invited candidates, recruiters, and QA operators.
- A short-lived host-token verifier and one-time exchange that creates an app-owned candidate launch session.
- Postgres repositories for candidate profiles, identities, practice drafts, sessions, dashboard read models, and resume context.
- Resume normalization and extraction services that turn paste/upload inputs into normalized processed text or safe failure codes.
- AI-backed session/question/coaching services reused through candidate-owned services and server actions.
- A provider-neutral transcription service with separate candidate-led and invited ownership adapters; raw audio is transient request material and is not application-persisted.
- Metrics, structured logging, alerts, seeded DB smoke checks, and candidate browser smoke checks.
- Azure branch/PR/pipeline controls for integrating candidate work into the shared Interview Coach repo.

### Data Flows And Trust Boundaries

- Browser -> public `/`: public marketing/funnel request over HTTPS. No candidate-private data should load here.
- TalentArbor -> `/candidate/launch?token=...`: the server verifies the short-lived signed assertion, rejects replay, resolves trusted host identity/context, creates its own candidate launch session, sets an HttpOnly cookie, and redirects to a clean canonical candidate URL.
- Browser -> candidate protected route: the route resolves the app-owned launch cookie to one opaque candidate profile id and fails closed when the session is absent, invalid, expired, or revoked.
- Browser -> `/candidate/dev/launch`: explicit nonproduction fixture mode enters the same launch-session boundary and is unavailable when `NODE_ENV=production`.
- Candidate route/server action -> candidate profile repository -> Postgres: feature code resolves `candidate_profile_id` and queries candidate-owned rows using profile-scoped predicates.
- Practice setup/resume input -> processor -> Postgres: pasted/trusted-host source text and uploaded PDF/DOCX bytes are request-only; only candidate-reviewed processed text, safe label, hashes, bounded redaction counts, and exact policy provenance enter `candidate_resume_processed_artifacts`. Accepted text is then snapshotted into setup/session context.
- Candidate file upload/photo -> extraction/OCR: PDF/DOCX extraction and photo OCR are request-scoped with source disposal before persistence. Any future temporary object storage requires an explicit private hard-TTL and disposal contract rather than candidate-visible paths.
- Candidate session services -> AI provider: role, JD, resume context, answers, and coaching prompts cross to AI services. Candidate input must be treated as untrusted prompt content.
- Browser voice capture -> audience-owned transcription route -> approved transcription provider -> recoverable transcript draft: the route proves owner/session/slot, validates bounded media, and never sends raw audio to the evaluator.
- Runtime -> logs/metrics/alerts: candidate routes, auth denials, rate limits, AI errors, and smoke signals should emit safe operational data only.
- Developer/Azure pipeline -> build/test/deploy branch: CI validates lint, typecheck, tests, build, and smoke readiness before candidate integration is reviewed.

### Diagram

```mermaid
flowchart TD
    Browser["Candidate browser"]
    Public["Public home"]
    AudienceBoundary["Audience-specific access boundary"]
    TalentArbor["TalentArbor host"]
    Launch["Launch verifier and exchange"]
    CandidateRoutes["Candidate routes"]
    RecruiterRoutes["Recruiter and QA routes"]
    AppSession["Candidate app session"]
    Postgres["Postgres"]
    ResumeService["Resume services"]
    AIProvider["AI provider"]
    Logs["Logs metrics alerts"]
    Azure["Azure branch pipeline"]

    Browser --> Public
    TalentArbor --> Launch
    Launch --> AppSession
    Launch --> Postgres
    Browser --> AudienceBoundary
    AudienceBoundary --> CandidateRoutes
    AudienceBoundary --> RecruiterRoutes
    CandidateRoutes --> AppSession
    AppSession --> Postgres
    CandidateRoutes --> ResumeService
    ResumeService --> Postgres
    CandidateRoutes --> AIProvider
    CandidateRoutes --> Logs
    Azure --> CandidateRoutes
```

## Assets

- Candidate identity and email: ties practice data to a real person and drives account ownership.
- External identity assertions and auth session state: compromise can become account takeover or cross-account access.
- Candidate drafts, sessions, answers, coaching, summaries, and dashboard history: private interview-preparation content.
- Transient raw voice recordings, candidate-authorized transcripts, and transcription provenance: highly sensitive practice content even when the raw audio is not retained.
- Resume text, transient uploaded files/photos, extracted text, and accepted processed artifacts: high-sensitivity employment and personal history data.
- AI prompts and responses: may contain resume text, job details, candidate answers, and coaching feedback.
- Postgres credentials and schema state: controls all durable app data.
- Logs, metrics, alerts, and smoke artifacts: operationally useful but must not become a secondary data leak.
- Build pipeline, PR branch, and deployment settings: integrity controls for shared-host production exposure.

## Evidence Anchors

- Shared host route ownership is documented in [shared-host-routing-contract.md](../04-architecture/shared-host-routing-contract.md).
- Broad audience separation lives in [middleware.ts](../../src/middleware.ts); feature routes still resolve and enforce their own server-side identity contracts.
- Candidate host-token validation and one-time exchange live in [production-host-launch-verifier.ts](../../src/features/candidate-auth-v2/production-host-launch-verifier.ts) and [host-launch-orchestrator.ts](../../src/features/candidate-auth-v2/host-launch-orchestrator.ts).
- App-owned candidate session persistence and protected-request resolution live in [candidate-launch-session-repository.ts](../../src/features/candidate-auth-v2/candidate-launch-session-repository.ts) and [candidate-launch-session-resolver.ts](../../src/features/candidate-auth-v2/candidate-launch-session-resolver.ts).
- Candidate profile/launch constraints live in migrations [002](../../db/migrations/002_candidate_identity_schema.sql), [006](../../db/migrations/006_candidate_host_launch_schema.sql), [017](../../db/migrations/017_candidate_host_launch_exchange_hardening.sql), and [018](../../db/migrations/018_candidate_host_launch_setup_context.sql).
- Candidate setup draft minimization lives in [candidate-setup-draft-store.ts](../../src/features/candidate-setup-v2/candidate-setup-draft-store.ts).
- Processed artifact ownership and immutable review provenance live in [candidate-resume-text-artifact-repository.ts](../../src/features/candidate-setup-v2/candidate-resume-text-artifact-repository.ts) and migrations [032](../../db/migrations/032_candidate_resume_processed_artifacts.sql) through [036](../../db/migrations/036_candidate_resume_ingestion_operations.sql).
- Resume text privacy processing and PDF/DOCX extraction live in [candidate-resume-text-processing.ts](../../src/features/candidate-setup-v2/candidate-resume-text-processing.ts) and [candidate-resume-document-processing.ts](../../src/features/candidate-setup-v2/candidate-resume-document-processing.ts).
- Candidate session ownership and answer idempotency live in [candidate-practice-session-repository.ts](../../src/features/candidate-session-v2/candidate-practice-session-repository.ts) and [candidate-answer-history-repository.ts](../../src/features/candidate-session-v2/candidate-answer-history-repository.ts).
- Invited-candidate bearer exchange is isolated in [invited-practice-token-vault.ts](../../src/features/recruiter-invites-v2/invited-practice-token-vault.ts); recruiter access remains isolated in [recruiter-auth-middleware.ts](../../src/features/recruiter-auth-v2/recruiter-auth-middleware.ts).
- Candidate observability guidance lives in [candidate-observability-plan.md](../07-ops/candidate-observability-plan.md).
- Privacy, disclosure, consent, and retention requirements live in [privacy-disclosures-and-consent-requirements.md](privacy-disclosures-and-consent-requirements.md).
- Voice capture, transcription, answer lineage, and recovery invariants live in [voice-answer-transcription-contract.md](../04-architecture/voice-answer-transcription-contract.md).
- Candidate CI is defined in [azure-pipelines.candidate.yml](../../azure-pipelines.candidate.yml).

## Attacker Model

Realistic capabilities:

- unauthenticated internet user can load `/`, trigger public CTAs, and attempt unsafe `next` values
- unauthenticated or partially authenticated candidate can attempt protected candidate routes
- authenticated candidate can manipulate route params, draft IDs, session IDs, upload metadata, setup text, JD text, resume text, and answers
- recruiter/admin/QA user can use their own app routes but should not gain candidate dashboard/session access through route confusion
- malicious document content can be supplied through active upload extraction or OCR flows
- developer or misconfigured environment can accidentally enable local auth modes outside intended environments

Non-capabilities:

- attacker is not assumed to have Azure project admin rights, production DB credentials, or TalentArbor identity-provider signing keys
- attacker is not assumed to control trusted server environment variables
- attacker is not assumed to access private blob storage directly unless storage policy is misconfigured

## Priority Threats

### T1. Cross-Candidate Data Access

Abuse path:

An authenticated candidate guesses or obtains another candidate's draft/session/summary ID, then calls a protected route or server action that fails to constrain reads and writes by `candidate_profile_id`.

Risk:

- Likelihood: medium. IDs are not intended to be public, but route params and server actions are attacker-controlled.
- Impact: high. Resume text, answers, coaching, and dashboard history are sensitive.
- Priority: high.

Existing mitigations:

- Candidate repositories use profile-scoped predicates such as `practice_draft_id = $1 and candidate_profile_id = $2`.
- Dashboard loader tests assert profile-scoped queries.
- Candidate route loaders resolve a candidate profile before loading private data.

Gaps and follow-ups:

- Continue adding negative ownership tests whenever new candidate routes/actions are introduced.
- Verify final external SSO callback cannot resolve the wrong candidate profile for a provider subject.

### T2. Launch Token Leakage, Replay, Or Redirect Confusion

Abuse path:

An attacker obtains a token-bearing launch URL, retries an already exchanged token, supplies an untrusted redirect, or causes the launch URL/query to enter logs, analytics, referrers, or browser history.

Risk:

- Likelihood: medium. Token-bearing URLs cross host and browser boundaries.
- Impact: high. A valid unexchanged token can establish candidate access.
- Priority: high.

Existing mitigations:

- Launch assertions have a code-capped short lifetime and verified issuer/product/source claims.
- SHA-256 token fingerprints plus optional issuer-scoped `jti` make exchange one-time without persisting the raw token.
- The server selects a canonical entry route, sets an HttpOnly app cookie, and redirects away from the token-bearing URL.
- Diagnostics record only a random request id and allowlisted outcome/reason fields.

Gaps and follow-ups:

- Confirm upstream access-log and query-string redaction on the TalentArbor and deployment sides.
- Ratify issuer/source values, mint-per-click behavior, signing-key rotation, and the final launch-link construction.

### T3. Dev Host Launch Enabled In Production

Abuse path:

The dev host-launch fixture is accidentally enabled in production, allowing locally minted fixture identities to establish candidate sessions.

Risk:

- Likelihood: low to medium. The code has production guardrails, but deployment config mistakes are realistic.
- Impact: high. Auth bypass can expose candidate data.
- Priority: high.

Existing mitigations:

- The dev route requires an explicit mode and secret.
- The dev route rejects `NODE_ENV=production`.
- Feature code still receives the same app-owned launch-session identity shape, so the fixture does not create a second authorization model.

Gaps and follow-ups:

- Deployment checklist and startup smoke should prove `CANDIDATE_HOST_LAUNCH_DEV_MODE` is absent or false.
- Production route smoke should prove `/candidate/dev/launch` is unavailable.

### T4. Resume Data Leakage Through Storage, Logs, Parser Errors, Or Diagnostics

Abuse path:

A candidate uploads or pastes resume content; raw text, parser errors, storage URLs, or original file locations are persisted into logs, metrics, public metadata, diagnostics, or AI-quality review artifacts.

Risk:

- Likelihood: medium. Resume content touches parsers, Postgres, future blob storage, AI prompts, and support/debug surfaces.
- Impact: high. Resumes contain sensitive employment and personal data.
- Priority: high.

Existing mitigations:

- The current upload/photo controls do not put selected source bytes or paths into the setup payload or browser draft storage.
- Pasted/trusted-host text uses a candidate-owned bounded processor; raw paste is neither browser-draft nor database state, and identity-backed setup reloads only an exact accepted artifact.
- PDF/DOCX upload proves same-origin candidate identity before reading an actually bounded 5 MiB stream, checks actual signature/container structure, bounds PDF pages and DOCX expansion/entries, rejects encrypted/traversal/unsupported containers, zero-fills app-owned buffers, and permits persistence only after disposal succeeds.
- Observability plan forbids raw resume text, raw extracted text, uploaded file contents, and provider auth payloads in ordinary logs.
- The ratified V2 ingestion contract requires one server-owned parse, direct-PII-scrub, normalize, candidate-review, and processed-artifact boundary for paste, documents, photos, and trusted-host text. Direct-PII v5 combines exact authenticated aliases and their bounded name variants with header-only inference for unknown names corroborated by one strong contact signal. An ambiguous first span is removed generically only when another span on that same delimited line is a recognized contact signal; likely role, organization, and section titles remain excluded. Real multiline/bullet-delimited street addresses and header postal codes are removed while coarse city/state may remain.
- The ratified contract excludes raw source paths from durable drafts and requires source disposal on every successful or failed terminal outcome before processing can report success.

Gaps and follow-ups:

- Trusted-host lookup is not wired even though the shared text processor supports its source contract.
- Ordered photo OCR and PDF/DOCX extraction have local automated safe-failure/disposal evidence. Production still lacks approved OCR subprocessor posture, deployed throttling/resource/disposal evidence, representative-device/file evidence, parser isolation, and a malware-control decision.
- If synchronous in-memory processing is insufficient, private encrypted hard-TTL temporary storage and deletion-retry/quarantine controls require implementation and security review.
- AI diagnostic artifact retention and redaction rules remain open.

### T5. Prompt Injection Through Resume, JD, Or Candidate Answers

Abuse path:

A candidate includes adversarial instructions in resume text, job descriptions, or answers that attempt to override system prompts, leak hidden instructions, or influence generated coaching incorrectly.

Risk:

- Likelihood: medium. Candidate-provided text is intentionally sent into AI-backed flows.
- Impact: medium. Primary harm is integrity of generated practice/coaching output and possible prompt/config leakage if prompts are poorly separated.
- Priority: medium.

Existing mitigations:

- Architecture treats resume/JD/answers as candidate content rather than trusted instructions.
- Ordinary logs should not include prompt/response bodies.

Gaps and follow-ups:

- Add prompt-contract tests for adversarial resume/JD/answer content.
- Keep system/developer instructions separated from candidate-provided text in all generation services.

### T6. Shared Host Route Or Auth Boundary Collision

Abuse path:

Candidate top-level routes, recruiter routes, admin/QA routes, invite-token paths, middleware, cookies, or generic APIs collide under the shared host and cause the wrong auth boundary or data model to handle a request.

Risk:

- Likelihood: medium. The shared host intentionally mixes actor contexts in one Next app.
- Impact: high if route collision crosses actor data boundaries; medium if it only breaks navigation.
- Priority: high.

Existing mitigations:

- Shared host contract reserves `/recruiter/**`, `/admin/**`, `/qa/**`, `/s/[token]`, and candidate top-level route ownership.
- Middleware separates candidate protected prefixes from recruiter/admin/QA protected prefixes.
- Route collision tests cover public, candidate, recruiter, admin, QA, and invite-token contexts.

Gaps and follow-ups:

- New generic `/api/**` routes should be avoided unless ownership resolution is explicit and tested.
- Candidate UI build-out should continue using top-level candidate paths without touching recruiter/admin/QA ownership.

### T7. Upload Or Mutation Abuse Causing Availability Or Cost Impact

Abuse path:

An attacker or overactive client repeatedly triggers practice generation, answer analysis, session progress, uploads, or extraction workflows to exhaust AI budget, parser CPU/memory, DB writes, or future blob storage.

Risk:

- Likelihood: medium. Public and candidate-protected flows can be automated.
- Impact: medium to high depending on AI/provider costs and parser workload.
- Priority: medium.

Existing mitigations:

- Candidate mutation boundary rate-limits practice generation, session progress, answer submit/analyze, and question retry by candidate, operation, and subject.
- Shared API routes already use IP-based rate-limit helpers for several recruiter-era generation endpoints.
- Resume document extraction caps request bytes, PDF pages, DOCX entries and declared expansion, and rejects extreme compression ratios before text extraction.

Gaps and follow-ups:

- Resume document upload still needs per-candidate throttling, parser process isolation or equivalent containment, a malware-scanning decision, and deployed CPU/memory/timeout evidence.
- Candidate-specific AI generation endpoints should retain rate-limit coverage as UI wiring expands.

### T8. Deployment Control Gaps In Shared Production Host

Abuse path:

Candidate changes merge or deploy without sufficient build validation, reviewer visibility, route regression checks, or linked work-item context, causing a production regression in recruiter or candidate routes.

Risk:

- Likelihood: medium while Azure Boards/wiki/pipeline permissions are split between Fu-Lab and the company project.
- Impact: medium to high because recruiter and candidate share one host.
- Priority: medium.

Existing mitigations:

- Candidate CI script and pipeline definition exist.
- Working backlog, PR checklist, Azure operating model, and seeded smoke paths exist.
- Candidate branch targets the shared Azure repo branch.

Gaps and follow-ups:

- Azure pipeline still needs to be wired in the company project.
- Branch policy and reviewer expectations still depend on company project permissions and reviewer availability.

### T9. Voice Audio Leakage, Misattribution, Replay, Or Cost Abuse

Abuse path:

An attacker or broken client uploads oversized or mislabeled media, reuses an operation key with different audio, submits audio against another owner/session/slot, causes duplicate provider calls, or leaks audio/transcript content through logs, diagnostics, QA exports, or provider errors. A coupled implementation could also accept a voice answer before a durable transcript exists or evaluate provider-rewritten wording as the candidate's answer.

Risk:

- Likelihood: medium once recording is exposed because all route, media, and operation fields are attacker-controlled.
- Impact: high because voice and transcript content is sensitive, provider calls incur cost, and misattribution can corrupt immutable answer/evaluator history.
- Priority: high before voice enablement.

Required mitigations:

- Keep recording UI absent unless the exact runtime tuple is available; keep production release blocked until provider-processing approval, deployed-browser evidence, and operational gates pass.
- Require explicit disclosure and user gesture before microphone permission; retain complete text fallback.
- Prove audience owner, session, and question slot before parsing media or calling a provider.
- Enforce code-owned MIME, byte, duration, rate, and request-time limits; use binary/multipart transport rather than base64 JSON.
- Use separate candidate-led and invited transcription persistence with strong foreign keys, hashed idempotency keys, audio fingerprints, leases, immutable terminal states, and exact replay/conflict behavior.
- Never application-persist raw audio or place it in logs, metrics, QA artifacts, support records, URLs, answer history, or evaluator input.
- Persist a recoverable transcript before immutable answer creation; require a same-audience completed source run, nonblank candidate-authorized transcript, and server-resolved quick-submit or review provenance for every voice answer.
- Separate transcription from evaluation and reject transcript rewriting, coaching, scoring, or delivery claims at the transcription boundary.
- Pin and live-validate an approved provider profile; use metadata-only failure codes and telemetry.

Gaps and follow-ups:

- Exact code-owned media limits, provider profile, provider-side audio-retention approval, and credentialed acceptance are implementation and release gates.
- Voice-marker extraction and delivery coaching require a separate evidence, persistence, and privacy contract.

## Minimum Security Requirements

- no Supabase runtime secrets or clients
- no public blob access for candidate files
- no public upload URLs or unsafe storage paths persisted in candidate draft metadata
- no raw parser errors persisted in candidate draft metadata
- no raw session token storage
- no cross-candidate data access
- no production dev, mock, or password candidate auth
- no unvalidated file uploads
- no raw resume text, extracted text, answers, generated coaching, provider auth payloads, or prompt bodies in ordinary logs
- no raw voice audio, transcript text, audio fingerprints, or transcription-provider output in ordinary logs, metrics, or QA artifacts
- no generic shared-host route or API ownership changes without route/auth regression tests
- no candidate UI release claim until candidate-facing UI workflows are actually built and smoke-tested

## Manual Review Focus Paths

- [src/middleware.ts](../../src/middleware.ts): broad route-audience separation.
- [production-host-launch-verifier.ts](../../src/features/candidate-auth-v2/production-host-launch-verifier.ts): signature, claim, expiry, issuer, audience, and launch-token validation.
- [host-launch-orchestrator.ts](../../src/features/candidate-auth-v2/host-launch-orchestrator.ts): one-time exchange, host-context lookup, and app-session creation.
- [candidate-launch-session-resolver.ts](../../src/features/candidate-auth-v2/candidate-launch-session-resolver.ts): protected-request cookie resolution and denial.
- [candidate-launch-session-repository.ts](../../src/features/candidate-auth-v2/candidate-launch-session-repository.ts): session hashing, expiry, and persistence.
- [candidate-resume-text-artifact-repository.ts](../../src/features/candidate-setup-v2/candidate-resume-text-artifact-repository.ts): candidate ownership, exact-policy artifacts, review fencing, and accepted-artifact resolution.
- [candidate-resume-document-processing.ts](../../src/features/candidate-setup-v2/candidate-resume-document-processing.ts): content inspection, extraction bounds, source disposal, and safe failure handling.
- [candidate-practice-session-repository.ts](../../src/features/candidate-session-v2/candidate-practice-session-repository.ts): candidate-owned session reads and mutations.
- [candidate-answer-history-repository.ts](../../src/features/candidate-session-v2/candidate-answer-history-repository.ts): immutable attempt lineage, ownership, and idempotency.
- [candidate-dashboard-read-model.ts](../../src/features/candidate-dashboard-v2/candidate-dashboard-read-model.ts): candidate-scoped dashboard aggregation.
- [invited-practice-token-vault.ts](../../src/features/recruiter-invites-v2/invited-practice-token-vault.ts): invitation bearer-token hashing and exchange boundary.
- [recruiter-auth-middleware.ts](../../src/features/recruiter-auth-v2/recruiter-auth-middleware.ts): recruiter audience and session isolation.
- [azure-pipelines.candidate.yml](../../azure-pipelines.candidate.yml): CI gate coverage before shared-host integration.

## Quality Check

- Entry points covered: public `/`, candidate protected routes, TalentArbor login start/callback, candidate server actions, resume paste/upload/extraction, AI calls, recruiter/admin/QA shared host routes, invite-token preservation, pipeline/deployment path.
- Trust boundaries covered: browser/app, public/protected, candidate/recruiter/admin/QA, app/Postgres, app/blob storage, app/AI provider, app/TalentArbor, runtime/logs, developer/Azure pipeline.
- Runtime vs CI/dev separated: production auth, local dev auth, mock auth, seeded smoke, and Azure pipeline are called out separately.
- Assumptions and open questions are explicit.
- Current UI status is explicit: the functional V2 surface set exists, but production UI integration and release evidence remain incomplete.

## References

- NIST SSDF: https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
