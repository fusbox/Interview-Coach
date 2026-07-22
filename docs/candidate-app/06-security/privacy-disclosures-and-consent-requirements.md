# Privacy, Disclosures, And Consent Requirements

Date: 2026-07-20
Status: Working requirements artifact

## Purpose

This document is the candidate Interview Coach source of truth for privacy, cookie, AI-disclosure, consent, data-visibility, and retention requirements.

It is not legal advice. It is a product and engineering artifact for surfacing policy gaps, review questions, and implementation constraints before production launch.

## Source Policies Reviewed

- TalentArbor privacy policy: https://talentarbor.com/privacy-policy
- TalentArbor cookie policy: https://talentarbor.com/cookie-policy
- TalentArbor Responsible AI Statement: https://talentarbor.com/ResponsibleAIStatement
- RangamWorks privacy policy: https://rangamworks.com/privacy-policy
- RangamWorks cookie policy: https://rangamworks.com/cookie-policy
- RangamWorks Responsible AI Statement: https://rangamworks.com/ResponsibleAIStatement

## Policy Fit Requirements

### Domain And Brand Coverage

Requirements:

- The policy surface that governs Interview Coach must explicitly cover `interviewcoach.talentarbor.com`.
- The governing policy should avoid stale or confusing domain references unless the referenced domain is still an active user-facing service.
- The policy should clarify the relationship between Rangam, TalentArbor, RangamWorks, and Interview Coach.

Current gaps:

- The TalentArbor privacy policy references services connected to `jobs.rangam.com`.
- Interview Coach is expected to live at `interviewcoach.talentarbor.com`.
- `jobs.rangam.com` appears to be a legacy or redirecting domain, so legal/compliance should confirm whether it remains the intended policy scope anchor.

### Hosting And Vendor Alignment

Requirements:

- Policies must accurately describe hosting, subprocessors, analytics, AI providers, and any cross-border processing that affects Interview Coach.
- If Interview Coach app infrastructure differs from the broader website hosting model, the difference must be disclosed or reconciled.
- AI vendor language should explicitly cover Interview Coach if the app sends role, job description, resume context, answer transcripts, or audio-derived transcripts to an AI provider.

Current gaps:

- Current public policies reference AWS as primary hosting.
- Interview Coach deployment details must be confirmed against the final runtime environment.
- AI provider, prompt/response retention, diagnostic retention, and reviewer-access rules are not yet approved.

### Candidate Data Boundary

Requirements:

- Candidate practice data should be private to the candidate by default.
- Recruiters, employers, hiring managers, and other hiring-decision participants should not receive candidate app practice questions, answers, transcripts, coaching, summaries, audio, or resume context unless a future requirement explicitly changes that posture and receives policy review.
- Admin and QA access is allowed for authorized operational support and quality review, but it must be narrow, logged, justified, role-controlled, and disclosed.
- Support access outside approved admin/QA roles must be explicitly reviewed before production enablement.

Initial product posture:

- Candidate app output visibility should remain conservative: no hiring-decision user should see candidate practice data.
- Business operations users, recruiters, employers, and hiring-decision users should not see candidate practice data.
- Authorized admin and QA users may see candidate practice data only under approved support/quality controls.
- A separate review question should evaluate whether recruiter-led app visibility into candidate question and answer transcript text remains necessary.

### AI Feature Disclosure

Requirements:

- Interview Coach must disclose that AI is used to generate practice questions, analyze answers, and create coaching or summaries.
- The app should state that AI coaching is for preparation support and does not make hiring decisions.
- If any automated output is ever used for ranking, placement, screening, or hiring decisions, automated-decision notice, appeal, bias/fairness review, and human-review requirements must be re-evaluated before launch.

Current fit:

- RangamWorks policy language is closer to the Interview Coach risk model because it discusses AI vendors, training restrictions, opt-out, automated decision appeals, AI interactions, and retention.
- TalentArbor policy has broader AI fairness language but does not specifically identify Interview Coach or candidate interview-practice data flows.

## Data Classes And Retention Posture

### Retention Principle

Retain the minimum data needed to provide candidate value, restore candidate sessions, support debugging, and satisfy agreed business requirements.

Do not retain raw resume files by default after successful normalization and redaction.

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

- pasted resume content
- extracted resume content
- normalized/redacted processed resume artifact
- original uploaded PDF/DOCX/images

Requirements:

- The app must disclose that resume paste/upload is optional unless product requirements later make it mandatory.
- The app must disclose whether original files are retained.
- The default implementation should retain processed resume artifacts only when needed for candidate reuse.
- Original uploaded files should be deleted after successful extraction by default.
- Original files may be retained only if an explicit future policy permits it.

Current V2 implementation truth:

- pasted and extracted resume text are candidate-owned, bounded, deterministically direct-PII-scrubbed, normalized, and explicitly reviewed before acceptance; the current policy removes exact authenticated identity aliases plus trusted abbreviated/surname-first variants, accepts one strong contact signal as bounded header-only corroboration for an unknown name, and generically removes only an ambiguous first span sharing a delimited line with another contact signal; street addresses and postal codes are removed without broadly removing role, employer, school, or work-location language, coarse city/state may remain, and raw paste is not stored in browser setup drafts or Postgres;
- trusted-host text uses the same processor and artifact contract, but host-side resume lookup is not wired;
- PDF/DOCX upload uses candidate-owned bounded in-memory acquisition, actual signature/container validation, extraction, app-buffer disposal before persistence, the shared PII processor, and explicit review/acceptance;
- photo capture sends at most four explicitly ordered, byte-validated image pages to the exact configured OCR provider; app-owned image/request buffers are disposed before only scrubbed normalized review text may persist;
- selected source files are not written into browser draft storage or the setup payload;
- document extraction and ordered photo OCR have automated local lifecycle evidence but still need deployed parser/provider throttling/resource/disposal, accessibility, representative-device, and organizational subprocessor evidence.

Ratified V2 processing requirement:

- paste, PDF/DOCX, photo, and trusted-host text use one server-owned parse, direct-PII-scrub, normalize, candidate-review, and processed-artifact boundary;
- raw documents/photos are request-scoped and deleted on success and every terminal failure;
- no raw source path or private blob is a durable candidate-draft field;
- only safe source metadata, policy versions, a source fingerprint, and the candidate-reviewed processed text may persist;
- PII-scrubbed resume text remains sensitive candidate data and keeps the same candidate access, retention, and disclosure protections.

Open production dependencies:

- proof that bounded in-memory processing is sufficient, or approved private hard-TTL temporary-storage controls when it is not
- parser isolation or equivalent malicious-document containment and a malware-scanning decision
- per-candidate upload throttling and deployed CPU/memory/timeout evidence
- organizational approval of the exact OCR provider/profile and its candidate-data handling
- deployed disposal implementation evidence
- organizational approval of the deterministic PII policy and residual-PII review behavior

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

- retain completed session history for candidate review value
- define candidate deletion/export behavior before production

### Voice And Audio

Requirements:

- Voice mode must disclose that microphone input is recorded in the browser and sent to an approved provider to create the transcript used for the answer; the candidate may submit directly or choose Review before submission.
- The app must state whether recorded audio files are retained.
- Any application persistence of raw audio requires explicit product/legal review, a defined retention period, deletion controls, and updated notice copy.

Current fit:

- Current V2 answer UI exposes voice only when the exact approved runtime tuple is configured; question text-to-speech is a different capability and does not capture candidate audio.
- The ratified voice contract keeps response audio transient only during the dedicated transcription operation. A recoverable transcript draft is persisted before the candidate may submit it for coaching.

### AI Quality And Operational Diagnostics

Requirements:

- AI-quality capture must avoid raw audio and should minimize raw resume, transcript, and job-description exposure.
- Retention classes and retention periods must be explicit for AI prompts, model outputs, transcripts, summaries, and diagnostic records.
- If authorized reviewers can inspect AI outputs or candidate content for QA, that access must be disclosed and controlled.

Current gap:

- The app has redaction and privacy flags, but final AI diagnostic retention and reviewer-access rules are not yet approved.

### Logs And Telemetry

Examples:

- auth denials
- route errors
- generation failures
- extraction failures
- latency metrics

Requirements:

- avoid raw resume content and raw answers in ordinary logs
- redact candidate identifiers where possible
- preserve operational metadata needed for support and reliability
- extraction failures must use safe reason codes instead of raw parser output

## Cookies, Analytics, And Session Monitoring

Requirements:

- Interview Coach should set only strictly necessary cookies by default for authentication, security, session state, CSRF, and return-path handling.
- Analytics, advertising, cross-context tracking, session replay, and detailed diagnostics should not run on protected candidate practice routes unless explicitly approved and consent-gated.
- Any cookie banner or preference center should accurately reflect the cookies and tags active on `interviewcoach.talentarbor.com`.

Current fit:

- The cookie policies recognize necessary, performance, functionality, and targeting cookies.
- RangamWorks has more explicit GTM and sale/share opt-out language.
- Protected candidate routes should avoid marketing pixels and should not capture resume, transcript, or answer content in analytics/session monitoring.

## Required App-Local Notices

### Footer Disclosure And Company Footer Placeholder

Implemented on the public home page, candidate app shell pages such as `/practice` and `/dashboard`, and the candidate summary page:

> Interview Coach uses AI for practice coaching. Practice data is protected by app security and access controls, and is not used to make hiring decisions.

Each footer includes an empty company-footer placeholder with an integration note that the approved company footer belongs there.

### Practice Setup Notice

Display near the start of candidate practice:

> Interview Coach uses AI to generate practice questions, coaching, and summaries from the role, job description, and any resume content you include. Practice content is saved to support session continuity and your own review.

Candidates must acknowledge:

> I understand Interview Coach uses AI for practice coaching and may save my practice content for session continuity, summaries, and my own review.

### Resume Notice

Display near resume paste:

> Resume content is optional. Include only what you want used for practice. Access to practice data is limited by app security controls and approved support or quality-review permissions.

### Voice Notice

Display as a first-time voice notice before triggering browser microphone permission:

> Your browser will ask for microphone permission after you continue. Interview Coach sends the response you record to create a transcript for this practice question.

> Submit Answer uses the transcript created from your recording. Choose Review first if you want to play back the recording or correct the transcript. Text mode is always available. The transcript may be saved for feedback and review, but Interview Coach does not save a separate audio file.

Invited practice must add the already-governing visibility fact: the submitted transcript may be visible to the inviting recruiter, while private coaching is not. Candidate-led practice must not imply recruiter visibility.

### Session Entry Notice

Display on the landing screen before the candidate starts the generated session:

> Your answers are used to provide coaching and may be saved for session continuity, summaries, and your own review. They are protected by access controls and are not shared with recruiters or employers for hiring decisions.

### Summary Notice

Display near the summary footer:

> This summary is saved for your own review. Practice summaries are protected by access controls and are not shared with recruiters, employers, or hiring-decision users.

### Runtime PII And Sensitive Data Scrubbing Review

Current sanitizing should be treated as an MVP risk reducer, not a production-grade privacy boundary. Before production exposure, the team should vet runtime scrubbing for sensitive candidate content before AI provider calls and before writing AI-quality diagnostics, logs, prompt snapshots, or operational traces.

Review surfaces include resume content, job descriptions, typed answers, voice transcripts, AI prompts and responses, summaries, debug inspectors, AI-quality records, logs, and observability payloads.

[OpenAI privacy-filter](https://github.com/openai/privacy-filter) is a workable candidate to evaluate as a runtime data-minimization layer, but it should not be assumed to provide guaranteed anonymization or compliance by itself. The review should confirm deployment fit, runtime performance, model or dependency provenance, maintenance posture, false-positive and false-negative behavior, self-hosting constraints, failure handling, test coverage, and whether the resulting policy language can accurately describe what the app does.

Any selected approach should define whether failures are fail-closed or degraded-mode, what metadata can be retained without storing raw sensitive spans, and which app surfaces must call the scrubber before AI generation or persistence.

## Consent Requirements

### Required Before Practice Starts

The candidate should affirm or be clearly notified that:

- AI is used to generate questions, analyze answers, and create coaching.
- Practice data may be saved to support session continuity, summaries, and the candidate's own review.
- The tool supports interview preparation and does not make hiring decisions.
- Candidate practice data is private to the candidate by default.

### Required Near Resume Input

Resume paste/upload should be optional and accompanied by notice that:

- resume content is used to tailor practice
- processed resume content may be retained for practice continuity and candidate review value
- original uploaded files are not retained after successful extraction by default

### Required Near Voice Mode

Voice mode should disclose that:

- microphone input is recorded only after the candidate explicitly starts voice capture
- the audio is sent to an approved provider to create a transcript
- **Submit Answer** authorizes transcription and submission without requiring review; **Review** optionally pauses for playback, confirmation, or correction
- the submitted transcript may be saved according to the applicable candidate-led or invited-session history contract
- Interview Coach does not persist a separate raw-audio file under the ratified first-release contract
- text mode is available as an alternative

V0.5/V1 transient-audio behavior is reference evidence, not current V2 behavior. V2 now implements the dedicated, audience-owned, transcript-first operation in [Voice Answer And Transcription Contract](../04-architecture/voice-answer-transcription-contract.md). Browser speech recognition is not the transcript authority, raw audio is not sent to the evaluator, and transcription completion does not itself submit an answer. Exact runtime configuration is necessary but not sufficient for production release; provider-processing approval and deployed evidence remain required.

Provider-side audio processing and retention must be reviewed and approved even though Interview Coach does not persist raw audio. Ordinary logs, metrics, QA exports, and support artifacts must exclude audio bytes, transcript text, audio fingerprints, and provider raw output.

The first Google Developer API profile passed local credentialed WAV, truthful WebM/Opus, and truthful MP4/AAC synthetic-audio privacy-envelope gates on 2026-07-21: each request contained only audio, fixed transcription instructions, and an English language hint. This is implementation evidence, not organizational approval of Google-side audio processing/retention or deployed secret/network behavior. Production release remains blocked until those approvals and deployed browser/operations gates are satisfied.

### Consent Escalation Triggers

Explicit product/legal review is required before:

- persisting raw candidate-response audio at any application boundary
- sharing candidate practice content with recruiters, employers, or hiring-decision users
- enabling protected-route analytics, advertising pixels, session replay, or detailed behavioral monitoring
- using AI outputs for ranking, placement, screening, or hiring decisions
- retaining original resume files beyond successful extraction

## Implementation Checklist

- Add practice setup AI/data notice. Implemented for MVP.
- Add resume notice near paste input. Implemented for MVP.
- Add voice notice near microphone controls or first voice-mode use. Implemented behind the exact voice runtime tuple; production approval and deployed evidence remain open.
- Add session-entry privacy notice. Implemented for MVP.
- Add summary privacy notice and candidate footer placeholders. Implemented for MVP.
- Link to the governing Privacy Policy and Responsible AI Statement from notices where feasible.
- Confirm candidate data visibility remains unavailable to business operations, recruiters, employers, and hiring-decision users.
- Confirm authorized admin/QA visibility controls, logging, and disclosure language before production.
- Confirm protected routes do not load marketing/session-replay tags without approval.
- Confirm logs and diagnostics avoid raw resume, answer, audio, prompt, and provider-auth payloads.
- Confirm runtime PII and sensitive-data scrubbing behavior before AI provider calls and AI-quality or observability persistence.
- Confirm final SSO, hosting, AI provider, and cookie behavior match public policy statements.

## Open Review Questions

- Which policy will govern `interviewcoach.talentarbor.com` at launch?
- Should the TalentArbor policy be updated to reference TalentArbor platform domains instead of or in addition to `jobs.rangam.com`?
- Should RangamWorks AI/vendor/retention language be harmonized into the TalentArbor policy?
- Are Google Analytics, GTM, Dynatrace, session replay, advertising tags, or marketing pixels enabled on Interview Coach protected routes?
- What role controls, audit logging, and disclosure language are required for authorized admin/QA access to candidate practice data?
- What are the approved retention periods for candidate profiles, practice drafts, sessions, transcripts, summaries, processed resume artifacts, AI-quality records, logs, and backups?
- Will candidates have self-service export and deletion controls at launch?
- Does any final deployment path differ from the hosting/vendor statements in the public policies?

## Related Documents

- [Candidate App Threat Model](threat-model.md)
- [Storage And Resume Ingestion](../04-architecture/storage-and-resume-ingestion.md)
- [Candidate Login Redirect Contract](../02-requirements/candidate-login-redirect-contract.md)
- [ADR-0005: Processed Resume Retention By Default](../08-decisions/ADR-0005-processed-resume-retention-by-default.md)
