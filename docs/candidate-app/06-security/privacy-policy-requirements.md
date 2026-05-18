# Privacy Policy Requirements

Date: 2026-05-16
Status: Working requirements artifact

## Purpose

This document tracks privacy, cookie, AI-disclosure, and data-visibility requirements for the candidate-led Interview Coach app.

It is not legal advice. It is a product and engineering requirements artifact for surfacing policy gaps, review questions, and implementation constraints before production launch.

## Source Policies Reviewed

- TalentArbor privacy policy: https://talentarbor.com/privacy-policy
- TalentArbor cookie policy: https://talentarbor.com/cookie-policy
- TalentArbor Responsible AI Statement: https://talentarbor.com/ResponsibleAIStatement
- RangamWorks privacy policy: https://rangamworks.com/privacy-policy
- RangamWorks cookie policy: https://rangamworks.com/cookie-policy
- RangamWorks Responsible AI Statement: https://rangamworks.com/ResponsibleAIStatement

## Policy Fit Requirements

### Domain And Brand Coverage

Requirement:

- The policy surface that governs Interview Coach must explicitly cover `interviewcoach.talentarbor.com`.
- The governing policy should avoid stale or confusing domain references unless the referenced domain is still an active user-facing service.
- The policy should clarify the relationship between Rangam, TalentArbor, RangamWorks, and Interview Coach.

Current gap:

- The TalentArbor privacy policy references services connected to `jobs.rangam.com`.
- Interview Coach is expected to live at `interviewcoach.talentarbor.com`.
- `jobs.rangam.com` appears to be a legacy or redirecting domain, so legal/compliance should confirm whether it remains the intended policy scope anchor.

### Hosting And Vendor Alignment

Requirement:

- Policies must accurately describe hosting, subprocessors, analytics, AI providers, and any cross-border processing that affects Interview Coach.
- If Interview Coach app infrastructure differs from the broader website hosting model, the difference must be disclosed or reconciled.

Current gap:

- Current public policies reference AWS as primary hosting.
- Interview Coach deployment details must be confirmed against the final runtime environment.
- AI vendor language should explicitly cover Interview Coach if the app sends role, job description, resume context, answer transcripts, or audio-derived transcripts to an AI provider.

### Candidate Data Boundary

Requirement:

- Candidate-led practice data should be private to the candidate by default.
- Recruiters, employers, hiring managers, and other hiring-decision participants should not receive candidate app practice questions, answers, transcripts, coaching, summaries, audio, or resume context unless a future requirement explicitly changes that posture and receives policy review.
- Admin or support access, if any, must be narrow, logged, justified, and disclosed.

Initial product posture:

- Candidate app output visibility should remain conservative: no hiring-decision user should see candidate practice data.
- A separate review question should evaluate whether recruiter-led app visibility into candidate question and answer transcript text remains necessary.

### AI Feature Disclosure

Requirement:

- Interview Coach must disclose that AI is used to generate practice questions, analyze answers, and create coaching or summaries.
- The app should state that AI coaching is for preparation support and does not make hiring decisions.
- If any automated output is ever used for ranking, placement, screening, or hiring decisions, automated-decision notice, appeal, bias/fairness review, and human-review requirements must be re-evaluated before launch.

Current fit:

- RangamWorks policy language is closer to the Interview Coach risk model because it discusses AI vendors, training restrictions, opt-out, automated decision appeals, AI interactions, and retention.
- TalentArbor policy has broader AI fairness language but does not specifically identify Interview Coach or candidate interview-practice data flows.

### Resume Data

Requirement:

- The app must disclose that resume paste/upload is optional unless product requirements later make it mandatory.
- The app must disclose whether original files are retained.
- The default implementation should retain processed resume artifacts only when needed for candidate reuse and should delete original uploaded files after successful extraction.

Current fit:

- Current candidate retention policy aligns with this conservative model.
- Final blob storage, malware scanning, OCR/photo capture, and deletion implementation still need production review.

### Voice And Audio

Requirement:

- Voice mode must disclose that microphone input is recorded in the browser, sent for transcription/analysis when submitted, and used to generate feedback.
- The app must state whether recorded audio files are retained.
- Any persistence of raw audio beyond transient feedback playback requires explicit product/legal review, a defined retention period, deletion controls, and updated notice copy.

Current fit:

- The current implementation does not persist candidate response audio as an app-side audio file or blob reference.
- Audio is currently used for in-session playback and transient analysis, while transcript and feedback are persisted.

### AI Quality And Operational Diagnostics

Requirement:

- AI-quality capture must avoid raw audio and should minimize raw resume, transcript, and job-description exposure.
- Retention classes and retention periods must be explicit for AI prompts, model outputs, transcripts, summaries, and diagnostic records.
- If authorized reviewers can inspect AI outputs or candidate content for QA, that access must be disclosed and controlled.

Current gap:

- The app has redaction and privacy flags, but final AI diagnostic retention and reviewer-access rules are not yet approved.

### Cookies, Analytics, And Session Monitoring

Requirement:

- Interview Coach should set only strictly necessary cookies by default for authentication, security, session state, CSRF, and return-path handling.
- Analytics, advertising, cross-context tracking, session replay, and detailed diagnostics should not run on protected candidate practice routes unless explicitly approved and consent-gated.
- Any cookie banner or preference center should accurately reflect the cookies and tags active on `interviewcoach.talentarbor.com`.

Current fit:

- The cookie policies recognize necessary, performance, functionality, and targeting cookies.
- RangamWorks has more explicit GTM and sale/share opt-out language.
- Protected candidate routes should avoid marketing pixels and should not capture resume, transcript, or answer content in analytics/session monitoring.

## Required App-Local Notices

### Practice Setup Notice

Display near the start of candidate practice:

> Interview Coach uses AI to generate practice questions and coaching based on the role, job description, resume information, intake responses, and answers you provide. Your practice data may be saved so you can return to your dashboard and review summaries. This tool is for interview preparation and does not make hiring decisions. See our Privacy Policy and Responsible AI Statement.

### Resume Notice

Display near resume paste/upload:

> Resume upload or paste is optional. We use resume content to tailor practice. Uploaded files are processed for extraction; the app retains the processed resume text needed for practice and does not retain the original file after successful extraction unless otherwise stated.

### Voice Notice

Display near microphone use:

> If you use voice mode, your browser records your answer so it can be transcribed, analyzed, and played back during feedback. Current recordings are not saved as audio files after you move past the question. You can use text mode instead.

### Persistent Audio Notice

Use only if a future feature saves audio beyond the active feedback moment:

> You can choose to save recordings for review. Saved recordings are retained for [X] days, then deleted automatically. You may delete them sooner from your dashboard.

## Open Review Questions

- Which policy will govern `interviewcoach.talentarbor.com` at launch?
- Should the TalentArbor policy be updated to reference TalentArbor platform domains instead of or in addition to `jobs.rangam.com`?
- Should RangamWorks AI/vendor/retention language be harmonized into the TalentArbor policy?
- Are Google Analytics, GTM, Dynatrace, session replay, advertising tags, or marketing pixels enabled on Interview Coach protected routes?
- Will any support, QA, admin, recruiter, employer, or hiring-decision user have access to candidate practice data?
- What are the approved retention periods for candidate profiles, practice drafts, sessions, transcripts, summaries, processed resume artifacts, AI-quality records, logs, and backups?
- Will candidates have self-service export and deletion controls at launch?
- Does any final deployment path differ from the hosting/vendor statements in the public policies?

## Related Documents

- [Data Retention Policy](data-retention-policy.md)
- [Candidate App Threat Model](threat-model.md)
- [Storage And Resume Ingestion](../04-architecture/storage-and-resume-ingestion.md)
- [Candidate Login Redirect Contract](../02-requirements/candidate-login-redirect-contract.md)
