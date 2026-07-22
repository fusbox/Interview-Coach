# Local Dev Bootstrap

Status: Active cleanroom V2 bootstrap
Last updated: 2026-07-22

## Purpose

This is the current local setup path for the candidate and recruiter V2 rebuild in this repo.

Older candidate docs and SQL helpers may still describe the V1 `/practice` -> `/session` -> `/summary` app. Treat those as reference material only. Current V2 work uses canonical `/candidate/*` routes, `candidate_practice_sessions` for durable rounds, and normalized answer-attempt/evaluator-run tables for immutable answer history.

## The Commands You Usually Need

### Fresh Local Smoke DB Setup

Use this when the local smoke Postgres container is new, reset, or missing current schema:

```powershell
npm run postgres:smoke:start
npm run db:migrate
npm run db:seed-candidate-dev
npm run db:smoke-candidate-readiness
```

Shortcut:

```powershell
npm run db:setup
npm run db:smoke-candidate-readiness
```

`db:setup` starts the smoke container, applies all current migrations, and seeds deterministic local candidate identities. `db:smoke-candidate-readiness` reruns the current candidate schema and fixture checks.

`db:setup` also seeds the local-only recruiter identity below. The recruiter seed command ignores
`DATABASE_URL` and always targets the disposable smoke database; it is disabled when
`NODE_ENV=production`.

```text
Email: recruiter-dev@talentarbor.local
Password: local-only-recruiter
```

Validate the recruiter fixture independently with:

```powershell
npm run db:seed-recruiter-dev
npm run db:smoke-recruiter-dev-seed
npm run db:smoke-recruiter-auth
```

The final command proves password verification, role recovery, hashed durable session recovery,
and revocation against the disposable database. It does not send invitations or email.

Validate the V2 invited-practice persistence foundation independently with:

```powershell
npm run test:recruiter-invites
npm run db:smoke-recruiter-invited-practice
```

The database command applies migration 023, proves recruiter-scoped create/replay/conflict,
recipient/session/token binding, immutable ownership, attempt lineage, forced rollback/retry,
candidate-table isolation, and real eight-connection convergence to one aggregate. It does not
create a browser invitation, call a model, or send email. Future runtime link creation requires a
nonblank `ENCRYPTION_SECRET` of at least 32 characters; plaintext invitation tokens are never
stored in Postgres.

Validate the authenticated recruiter create boundary and accepted question-set lineage with:

```powershell
npm run test:recruiter-invites
npm run db:smoke-recruiter-invitation-create
```

The database smoke applies migration 025, seeds the local recruiter, races eight exact question-set
claims to one durable winner, completes and replays the accepted set, rejects changed content and an
unauthorized recruiter, proves accepted-source immutability, and creates one aggregate through the
question-set-owned atomic wrapper. It cleans up its temporary batch and question set. It uses fixture
wording only and does not call Gemini or send email.

Validate the separate invitation-delivery ledger with:

```powershell
npm run test:recruiter-invites
npm run db:smoke-recruiter-invitation-delivery
```

The database smoke applies migration 026, races eight recipient-level delivery claims to one winner,
records provider acceptance, proves that accepted state is immutable, and confirms that a later action
cannot resend the accepted recipient. It does not contact an email provider.

Validate the invited link exchange, clean-route session, and initials signal with:

```powershell
npm run test:recruiter-invites
npm run db:smoke-invited-practice-access
```

The database smoke applies migration 027, exchanges one active invitation-token hash into a separately
hashed browser session, caps browser access to the invitation expiry, resolves the clean route, records a
mismatch, proves that a later submission cannot rewrite the first initials signal, and confirms that
revoking the source invitation immediately ends browser access. It uses no email provider and writes no
candidate profile or candidate-led session.

Validate invite-owned answers, evaluation claims, exact ownership, and completion with:

```powershell
npm run test:recruiter-invites
npm run db:smoke-invited-practice-live-runtime
```

The live-runtime smoke applies migration 028, races eight identical answer submissions and evaluator
claims to one durable winner, appends a feedback retry as attempt two, rejects a foreign recipient,
proves answer immutability, completes the invited session, and verifies that no candidate-owned answer
row was written.

`INVITED_PRACTICE_ACCESS_TTL_SECONDS` defaults to seven days and may not exceed seven days. The actual
cookie expiry is the earlier of that configured lifetime and the recruiter invitation token expiry.

For deterministic browser validation, add the following to `.env.local` and restart the dev server:

```text
RECRUITER_INVITATION_DELIVERY_PROVIDER=fixture
```

The fixture is rejected in production. It proves the app's send/status/replay lifecycle only; it does
not prove SMTP acceptance or mailbox delivery. To validate real provider acceptance, use server-only
SMTP configuration and set the provider to `smtp`:

```text
RECRUITER_INVITATION_DELIVERY_PROVIDER=smtp
SMTP_HOST=<approved-host>
SMTP_PORT=587
SMTP_USERNAME=<approved-user>
SMTP_PASSWORD=<secret>
SMTP_FROM_EMAIL=Rangam Interview Coach <interviews@coach.rangam.com>
```

Each candidate receives a separate message. A successful row means the configured provider accepted
that one recipient, not that the message reached the mailbox. Do not commit `.env.local` or use the
fixture as deployment evidence.

### After This Branch Changes Practice Persistence Migrations

Use this when you already have the smoke DB running and only need the latest V2 practice-session, practice-intent, or answer-history shape:

```powershell
npm run db:apply-candidate-practice-sessions-schema
npm run db:smoke-candidate-practice-sessions-schema
npm run db:apply-candidate-practice-intents-schema
npm run db:smoke-candidate-practice-intents-schema
npm run db:apply-candidate-fixed-intent-launch
npm run db:smoke-candidate-fixed-intent-launch
npm run db:apply-candidate-answer-attempts-schema
npm run db:apply-candidate-answer-evaluator-run-claims-schema
npm run db:apply-candidate-answer-evaluator-configuration-schema
npm run db:smoke-candidate-answer-attempts-schema
npm run db:smoke-candidate-answer-evaluator-run-claims-schema
npm run db:smoke-candidate-answer-evaluator-configuration-schema
npm run db:apply-candidate-prep-context-propagation-schema
npm run db:smoke-candidate-prep-context-propagation-schema
npm run db:apply-candidate-coach-update-artifacts-schema
npm run db:apply-candidate-coach-update-configuration-identity
npm run db:smoke-candidate-coach-update-artifacts-schema
npm run db:smoke-candidate-coach-update-configuration-identity
npm run db:apply-candidate-practice-session-status-backfill
npm run db:apply-candidate-next-round-drafts-schema
npm run db:smoke-candidate-next-round-drafts-schema
npm run db:apply-candidate-prep-context-practice-paths-schema
npm run db:smoke-candidate-prep-context-practice-paths-schema
npm run db:apply-candidate-host-launch-setup-context
npm run db:smoke-candidate-host-launch-setup-context
npm run db:apply-candidate-setup-start-idempotency
npm run db:smoke-candidate-setup-start-idempotency
npm run db:apply-candidate-fixed-intent-launch
npm run db:smoke-candidate-fixed-intent-launch
npm run db:apply-candidate-direct-intent-idempotency
npm run db:smoke-candidate-direct-intent-idempotency
npm run db:smoke-candidate-direct-intent-concurrency
npm run db:apply-recruiter-invited-practice-foundation
npm run db:smoke-recruiter-invited-practice
```

`candidate_practice_sessions` remains the durable session boundary, `candidate_practice_intents` is the durable ready-round boundary for one-question or multi-question follow-up selections, and `candidate_answer_attempts` plus `candidate_answer_evaluation_runs` preserve immutable submission and evaluator lineage. Migration 021 makes a ready intent a 24-hour, versioned one-use launch identity and atomically creates exactly one owned follow-up session while consuming that intent; duplicate or response-lost starts replay the same session. Migration 022 gives direct one-question and fixed-set creation its own candidate-owned 24-hour replay ledger: exact keyed replay returns one immutable intent, changed content conflicts before mutation, and concurrent submissions serialize to one row. Migration 015 adds sequential evaluator generations, 60-second claim leases, stale-claim recovery, and candidate-coaching completion fences. Migration 016 adds immutable evaluator configuration manifests/fingerprints; earlier V2 development rows become `pre_manifest_v2`, while new rows must carry resolved configuration. Migration 010 propagates candidate-owned prep-context identity into intents and canonical dashboard/follow-up reads, migration 011 stores only versioned candidate-safe Coach Update artifacts over those source facts, migration 019 adds exact profile/configuration identity to new Coach Update claims and replay matching without inventing metadata for earlier V2 development rows, and migration 012 idempotently repairs answered sessions that historical writes left in `planned` status.

### Full Candidate Quality Check

Use this before packaging candidate V2 work:

```powershell
npm run test:candidate
```

When you also need database readiness:

```powershell
npm run db:smoke-candidate-readiness
```

The heavier combined path is:

```powershell
npm run ci:candidate:with-db
```

That runs lint, typecheck, candidate tests, build, DB readiness, and the seeded browser smoke.

## Current DB Script Map

Current candidate V2 local development depends on these scripts:

| Need | Command |
| --- | --- |
| Start disposable local Postgres | `npm run postgres:smoke:start` |
| Apply all current migrations | `npm run db:migrate` |
| Apply only host-launch schema | `npm run db:apply-candidate-host-launch-schema` |
| Apply host-launch one-time exchange hardening | `npm run db:apply-candidate-host-launch-exchange-hardening` |
| Apply host-launch setup staging and host prep identity | `npm run db:apply-candidate-host-launch-setup-context` |
| Apply only V2 practice-session schema | `npm run db:apply-candidate-practice-sessions-schema` |
| Apply only V2 practice-intent schema | `npm run db:apply-candidate-practice-intents-schema` |
| Apply atomic fixed-intent session launch | `npm run db:apply-candidate-fixed-intent-launch` |
| Apply direct-intent creation idempotency | `npm run db:apply-candidate-direct-intent-idempotency` |
| Apply only V2 answer-attempt/evaluator-run schema | `npm run db:apply-candidate-answer-attempts-schema` |
| Apply transcript-first voice persistence | `npm run db:apply-voice-transcription-foundation` |
| Apply immutable voice transcription claims | `npm run db:apply-voice-transcription-claims` |
| Validate voice persistence, claim concurrency, replay, conflict, and stale recovery | `npm run db:smoke-voice-transcription-claims` |
| Apply candidate processed-resume artifacts | `npm run db:apply-candidate-resume-processed-artifacts` |
| Allow processed PDF/DOCX provenance | `npm run db:apply-candidate-resume-document-upload` |
| Allow processed photo-OCR provenance | `npm run db:apply-candidate-resume-photo-ocr` |
| Apply setup-owned resume selection recovery | `npm run db:apply-candidate-setup-resume-selections` |
| Apply durable resume-ingestion admission/operation leases | `npm run db:apply-candidate-resume-ingestion-operations` |
| Validate processed-resume ownership, provenance, review fencing, admission limits, replay, and stale recovery | `npm run db:smoke-candidate-resume-processed-artifacts` |
| Apply evaluator-run generations and claim fencing | `npm run db:apply-candidate-answer-evaluator-run-claims-schema` |
| Apply immutable evaluator configuration manifests | `npm run db:apply-candidate-answer-evaluator-configuration-schema` |
| Apply only V2 prep-context propagation schema | `npm run db:apply-candidate-prep-context-propagation-schema` |
| Apply only V2 Coach Update artifact schema | `npm run db:apply-candidate-coach-update-artifacts-schema` |
| Apply Coach Update profile/configuration claim identity | `npm run db:apply-candidate-coach-update-configuration-identity` |
| Repair historical answered sessions left `planned` | `npm run db:apply-candidate-practice-session-status-backfill` |
| Apply durable next-round draft schema | `npm run db:apply-candidate-next-round-drafts-schema` |
| Apply intentional same-role/JD practice-path schema | `npm run db:apply-candidate-prep-context-practice-paths-schema` |
| Apply recruiter invited-practice aggregate schema | `npm run db:apply-recruiter-invited-practice-foundation` |
| Apply recruiter accepted question-set lineage | `npm run db:apply-recruiter-invitation-question-sets` |
| Apply recruiter per-recipient delivery attempts | `npm run db:apply-recruiter-invitation-delivery-attempts` |
| Apply invited link exchange and initials evidence | `npm run db:apply-invited-practice-access-and-entry` |
| Seed local primary/alternate candidates | `npm run db:seed-candidate-dev` |
| Validate host-launch schema | `npm run db:smoke-candidate-host-launch-schema` |
| Validate host-launch replay and identity-only session schema | `npm run db:smoke-candidate-host-launch-exchange-hardening` |
| Validate host-launch setup staging and host prep identity | `npm run db:smoke-candidate-host-launch-setup-context` |
| Validate V2 practice-session schema | `npm run db:smoke-candidate-practice-sessions-schema` |
| Validate V2 practice-intent schema | `npm run db:smoke-candidate-practice-intents-schema` |
| Validate fixed-intent ownership, expiry, replay, and atomicity | `npm run db:smoke-candidate-fixed-intent-launch` |
| Validate direct-intent replay, conflict, rollback, cross-candidate isolation, and intentional repractice | `npm run db:smoke-candidate-direct-intent-idempotency` |
| Validate direct-intent serialization with concurrent database connections | `npm run db:smoke-candidate-direct-intent-concurrency` |
| Validate V2 answer-attempt/evaluator-run schema | `npm run db:smoke-candidate-answer-attempts-schema` |
| Validate evaluator-run generation, lease, and completion fencing | `npm run db:smoke-candidate-answer-evaluator-run-claims-schema` |
| Validate evaluator configuration manifest, fingerprint, and immutability | `npm run db:smoke-candidate-answer-evaluator-configuration-schema` |
| Validate V2 prep-context propagation and ownership | `npm run db:smoke-candidate-prep-context-propagation-schema` |
| Validate V2 Coach Update artifact lifecycle and ownership | `npm run db:smoke-candidate-coach-update-artifacts-schema` |
| Validate Coach Update configuration-aware claim identity and immutability | `npm run db:smoke-candidate-coach-update-configuration-identity` |
| Validate durable next-round draft launch | `npm run db:smoke-candidate-next-round-drafts-schema` |
| Validate intentional same-role/JD practice paths | `npm run db:smoke-candidate-prep-context-practice-paths-schema` |
| Validate recruiter invited-practice aggregate | `npm run db:smoke-recruiter-invited-practice` |
| Validate recruiter question-set and aggregate creation | `npm run db:smoke-recruiter-invitation-create` |
| Validate recruiter delivery claim, acceptance, and stale recovery | `npm run db:smoke-recruiter-invitation-delivery` |
| Validate invited token exchange, clean-route access, initials replay, and revocation | `npm run db:smoke-invited-practice-access` |
| Validate invite-owned answer/evaluator replay, ownership, immutability, and completion | `npm run db:smoke-invited-practice-live-runtime` |
| Validate recruiter dashboard ownership, latest-attempt projection, distinct-question progress, and content exclusion | `npm run db:smoke-recruiter-dashboard` |
| Validate recruiter transcript ownership, latest submitted answers, and draft/coaching/timing exclusion | `npm run db:smoke-recruiter-transcript` |
| Validate local candidate fixtures | `npm run db:smoke-candidate-dev-seed` |
| Run current candidate DB readiness chain | `npm run db:smoke-candidate-readiness` |
| Reconcile question wording across setup, persistence, recovery, trusted failure, and follow-up reuse | `npm run db:reconcile-candidate-question-wording` |
| Apply setup-start request idempotency to an existing local DB | `npm run db:apply-candidate-setup-start-idempotency` |
| Run rollback-only setup-start lease/fence/staging smoke | `npm run db:smoke-candidate-setup-start-idempotency` |
| Run focused setup-start idempotency tests | `npm run test:candidate:setup-idempotency` |
| Run focused fixed-intent launch tests | `npm run test:candidate:fixed-intent-launch` |
| Run focused direct-intent creation idempotency tests | `npm run test:candidate:direct-intent-idempotency` |
| Run the integrated question-generation/follow-up milestone tests | `npm run test:candidate:question-follow-up-milestone` |
| Run the integrated database readiness and wording reconciliation gate | `npm run db:smoke-candidate-question-follow-up-milestone` |

The V1-style `postgres:smoke:*` product scripts still exist because the repo also contains recruiter and mature shared-session surfaces. Do not use them as the default validation path for the cleanroom candidate V2 rebuild unless a slice explicitly says to compare or validate against V1 behavior.

For the manual setup-to-follow-up milestone protocol, use the [Question Generation And Follow-Up Launch Runbook](../05-quality/question-generation-and-follow-up-launch-milestone-runbook.md).

## Local Dev Host Launch

The current preferred browser path is host-launch-shaped, even in local development.

Add these to `.env.local`:

```text
CANDIDATE_HOST_LAUNCH_DEV_MODE=true
CANDIDATE_HOST_LAUNCH_DEV_SECRET=local-only-shared-secret
```

Local dev host launch uses deterministic fixture identities and does not require TA MSSQL access. To exercise the production `/candidate/launch` assembly in an authorized environment, supply all five required TA connection values in server-only configuration:

```text
CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER=<server>
CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE=<database>
CANDIDATE_HOST_LAUNCH_TA_SQL_USER=<least-privilege-reader>
CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD=<secret>
CANDIDATE_HOST_LAUNCH_TA_SQL_PORT=1433
```

Optional bounded controls are `CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT`, `CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE`, `CANDIDATE_HOST_LAUNCH_TA_SQL_CONNECT_TIMEOUT_MS`, `CANDIDATE_HOST_LAUNCH_TA_SQL_REQUEST_TIMEOUT_MS`, and `CANDIDATE_HOST_LAUNCH_TA_SQL_POOL_MAX`. Keep credentials in `.env.local` or the deployment secret store, never in committed docs or scripts. The app will not assemble production launch dependencies unless verifier config, `DATABASE_URL`, and the complete required TA connection set are all valid.

To browser-validate the current submit -> analysis -> read-only coaching surface without production provider credentials, also add:

```text
CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fixture
```

The fixture provider is accepted only with explicit local dev host-launch mode. If the variable is missing, answer analysis remains fail-closed with provider-not-configured behavior.

The shared candidate-led and invited recording UI is available only when an exact voice-transcription runtime is configured. For deterministic local browser validation without a provider call, use:

```text
SESSION_VOICE_TRANSCRIPTION_PROVIDER=fixture
SESSION_VOICE_TRANSCRIPTION_PROFILE=fixture_voice_transcription_v1
SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED=true
```

The fixture is blocked when `NODE_ENV=production` or `VERCEL_ENV=production`. It returns a deterministic transcript, so use it to validate permission-independent UI states, quick submit, Review/edit, immutable answer append, evaluator invocation, refresh recovery, and typed fallback rather than transcription fidelity.

The current Developer API profile is:

```text
SESSION_VOICE_TRANSCRIPTION_PROVIDER=google_genai
SESSION_VOICE_TRANSCRIPTION_PROFILE=google_gemini_2_5_flash_voice_transcription_v1
GEMINI_API_KEY=<server-only-key>
```

The server exposes recording controls only when this exact provider/profile/key tuple resolves. Chromium capture prefers truthful WebM/Opus and falls back to truthful MP4/AAC; both containers passed the guarded Developer API matrix on 2026-07-21 without MIME relabeling or transcoding. Follow the [live voice-transcription runbook](../05-quality/live-voice-transcription-validation-runbook.md), then run `npm run test:voice-transcription-seam` and `npm run db:smoke-voice-transcription-claims`.

For browser validation, restart the dev server after changing the tuple. Validate candidate-led and invited sessions through both voice paths: quick Submit Answer, then Review with a transcript correction. Confirm Retry creates no durable answer before submission, refresh after transcription recovers the transcript draft but not local playback, accepted voice answers receive ordinary content coaching with no delivery claims, a failed transcription leaves Type fully usable, and pause/exit warns only while unsaved local audio is at risk. Exact runtime configuration is local implementation enablement, not production approval; Google-side audio processing/retention approval and deployed desktop/mobile evidence remain release gates.

Resume-photo OCR is independently configured. To validate the page queue, ordering, safe failure, review, and acceptance behavior without sending images to a provider, use:

```text
CANDIDATE_RESUME_OCR_PROVIDER=fixture
CANDIDATE_RESUME_OCR_PROFILE=fixture_resume_photo_ocr_v1
CANDIDATE_RESUME_OCR_FIXTURE_ENABLED=true
```

The fixture is blocked in production and returns deterministic page text; it does not validate OCR fidelity or provider image support. For a credentialed local OCR check, replace that tuple with:

```text
CANDIDATE_RESUME_OCR_PROVIDER=google_genai
CANDIDATE_RESUME_OCR_PROFILE=google_gemini_2_5_flash_resume_photo_ocr_v1
GEMINI_API_KEY=<server-only-key>
```

Restart the dev server, enter through the candidate dev-launch route, and choose Take photo. Validate one page and a multi-page batch: add pages in the wrong order, correct them with the arrow controls, remove one page, add it again, and choose `Review photo text`. Confirm only scrubbed normalized text appears, candidate edits are possible, `Use this resume` is required before practice can start, and revisiting setup never restores selected image files. Also deny camera access or run on desktop and confirm Choose photos, Upload resume, and Paste text remain usable. Do not run the live profile with real candidate resumes until the Google subprocessor/privacy posture is organizationally approved.

Question audio is independently opt-in. To browser-validate the shared candidate-led and invited TTS lifecycle, add the exact serving tuple and restart the dev server:

```text
SESSION_QUESTION_AUDIO_PROVIDER=google_genai
SESSION_QUESTION_AUDIO_PROFILE=google_gemini_2_5_flash_tts_v1
GEMINI_API_KEY=<server-only-key>
```

The landing warms question one, live entry prepares the current and next question, and the visible `Read aloud` control remains the reliable recovery action when browser autoplay is unavailable. The browser sends only `questionKey`; candidate, invited-session, or ready-intent ownership is proved before the server resolves persisted wording. A failed or missing audio provider never blocks text practice. Successful automatic playback is remembered only in the current browser tab for that session question; it is deliberately not synchronized across devices.

Validate one candidate initial round, one candidate follow-up ready intent, and one invited round on desktop and mobile. Confirm first-entry playback after `Start practice`, next-question playback, explicit replay, no automatic repeat after same-tab refresh, and new-tab recovery through `Read aloud`. Then remove or misspell `SESSION_QUESTION_AUDIO_PROFILE`, restart, and confirm the same session remains fully usable as text practice without a broken audio control. Restore the exact profile after the failure check.

Initial-round question wording is selected independently. Ordinary local development uses the deterministic wording fixture when explicit dev host-launch mode is enabled. To exercise the pinned production profile through setup, the pre-session landing, durable session recovery, and the first live question, use the guarded disposable-DB browser reconciliation instead of leaving live configuration in `.env.local`:

```powershell
npm run db:smoke-candidate-readiness
$env:CANDIDATE_QUESTION_WORDING_BROWSER_TEST="true"
cmd /c npm run qa:candidate:question-wording-browser -- --confirm-live-provider
Remove-Item Env:CANDIDATE_QUESTION_WORDING_BROWSER_TEST
```

The runner loads `GEMINI_API_KEY` from `.env.local`, pins the approved `google_gemini_2_5_flash_question_wording_v1` profile, starts an isolated dev server on a free port, uses the seeded primary candidate, and cleans up its session and prep context. It refuses to run without the explicit flag and confirmation argument. The companion `db:reconcile-candidate-question-wording` command uses a rolled-back transaction and no live provider call to prove accepted configuration persistence, immutable recovery, accepted setup replay without another provider call, changed-request conflict, failed-claim retry generation, fail-closed trusted staging, and exact follow-up source-wording reuse.

To deliberately browser-validate real candidate-serving coaching with the pinned Gemini profile, replace the fixture selection and restart the dev server:

```text
CANDIDATE_ANSWER_ANALYSIS_PROVIDER=google_genai
CANDIDATE_ANSWER_ANALYSIS_PROFILE=google_gemini_2_5_flash_v1
GEMINI_API_KEY=<server-only-key>
```

The route still performs identity, ownership, immutable answer-attempt, and durable evaluator-claim checks before calling Gemini. Do not commit `.env.local`, expose the key through a `NEXT_PUBLIC_*` variable, or use this mode when ordinary fixture behavior is sufficient.

The synthetic credentialed quality gate is intentionally separate from browser development. See the [Live Evaluator Validation Runbook](../05-quality/live-evaluator-validation-runbook.md). Its `CANDIDATE_EVALUATOR_LIVE_TEST=true` flag is an execution acknowledgement and must not remain ordinary local configuration. On PowerShell, use the runbook's `cmd /c npm run ... -- --confirm-live-provider` form so npm receives the forwarded confirmation argument.

To validate answer-analysis failure and recovery through the real local evaluator lifecycle, temporarily replace the fixture value and add one allowlisted fail-first mode:

```text
CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fault
CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE=provider_5xx_once
```

Allowlisted modes are `timeout_once`, `rate_limited_once`, `provider_5xx_once`, `provider_unavailable_once`, `misconfigured_once`, `invalid_extraction_schema_once`, `fingerprint_mismatch_once`, `span_mismatch_once`, `unsafe_inference_once`, `verifier_rejected_once`, `invalid_feedback_schema_once`, and `success`. A non-success mode fails the first evaluator run for each fixed answer fingerprint, including every runtime-owned attempt permitted for that run. `timeout_once` injects the runtime's safe timeout classification immediately so browser checks remain fast; the real elapsed-deadline and abort behavior is covered by evaluator-runtime tests. Clicking **Try coaching again** creates the next evaluator generation for the same saved answer and succeeds through the ordinary fixture adapters. The mode is read only from server environment, never a URL or request body, and is disabled outside explicit local development and whenever `NODE_ENV=production`. Restarting the dev server resets the bounded in-memory fail-first ledger; set the provider back to `fixture` after validation.

For a browser check, submit one answer and confirm the first analysis attempt leaves the answer read-only with the saved-answer recovery message. Refresh or open the same session in another tab and confirm the same answer and **Try coaching again** state recover. Retry coaching once and confirm feedback appears without another answer submission. Database reconciliation should show one `candidate_answer_attempts` row and two `candidate_answer_evaluation_runs` generations for that answer: one terminal failure/rejection and one completed result.

Coach Update synthesis is selected independently from answer analysis. In explicit local mode it defaults to its typed deterministic fixture even when answer analysis uses `google_genai` or answer-analysis fault injection. To exercise its production-shaped failure boundary without live credentials, temporarily add:

```text
CANDIDATE_COACH_UPDATE_PROVIDER=fault
CANDIDATE_COACH_UPDATE_FAULT_MODE=provider_5xx
```

Allowlisted fault modes are `timeout`, `rate_limited`, `provider_5xx`, `provider_unavailable`, `misconfigured`, `invalid_json`, `invalid_schema`, `fingerprint_mismatch`, `question_mapping_mismatch`, `unsafe_candidate_language`, and `success`. The controls are read only from server environment, are never accepted through a URL or request payload, and are disabled when `NODE_ENV=production`. A fault must not block round completion or dashboard return; it should create a classified terminal artifact attempt and leave the dashboard in its existing truthful unavailable state. Remove both Coach Update variables to return to the independent local fixture.

To exercise the production Coach Update adapter with the same server-only Gemini credential, set the exact serving tuple and restart the app:

```text
CANDIDATE_COACH_UPDATE_PROVIDER=google_genai
CANDIDATE_COACH_UPDATE_PROFILE=google_gemini_2_5_flash_coach_update_v1
GEMINI_API_KEY=<server-only-key>
```

This profile is independent from answer-analysis selection. A realistic live round therefore normally sets both the answer-analysis tuple and the Coach Update tuple. The Coach Update call runs only after the round is durably completed and every answered occurrence has accepted evaluator evidence. Missing or mismatched configuration leaves Coach Update unavailable without rolling back completion and never falls back to fixture output. The request excludes current/prior raw answers, candidate and database identity, JD/resume content, raw evaluator artifacts, and hidden evaluator plans. Keep ordinary development on the fixture unless live synthesis is the purpose of the test.

Run the credentialed synthetic gate separately before treating browser behavior as provider evidence. See the [Live Coach Update Validation Runbook](../05-quality/live-coach-update-validation-runbook.md). Its `CANDIDATE_COACH_UPDATE_LIVE_TEST=true` value is a one-command acknowledgement, not an ordinary `.env.local` setting. After the synthetic gate, use the runbook's disposable-DB protocol to reconcile completion, exact profile/configuration metadata, replay without another call, and refreshed dashboard recovery.

Then start the app:

```powershell
npm run dev
```

Open the dev launch route:

```text
http://localhost:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
```

Alternate candidate:

```text
http://localhost:3000/candidate/dev/launch?candidate=alternate&next=/candidate/setup
```

Mobile LAN testing uses the same path with your workstation IP:

```text
http://<workstation-lan-ip>:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
```

If Next logs a blocked cross-origin warning for `/_next/*`, add the workstation origin to `allowedDevOrigins` in `next.config` only if the page fails to load or hot reload becomes unusable.

## Dev Server Options

Use `npm run dev` for the current host-launch-shaped flow.

`npm run dev:candidate` still exists as a convenience wrapper. It sets `DATABASE_URL` to the smoke DB and defaults older candidate auth env values, but it is not the primary V2 launch path because it does not exercise the host redirect shape by itself.

## Seeded Local Candidates

The deterministic local candidates are:

| Candidate | Email | Host-launch shortcut |
| --- | --- | --- |
| Primary | `candidate-dev-primary@talentarbor.local` | `candidate=primary` |
| Alternate | `candidate-dev-alt@talentarbor.local` | `candidate=alternate` |

The dev host launch maps deterministic host-style candidate ids to these seeded candidate profiles.

## Troubleshooting

### Setup Submit Returns `503`

Most likely causes:

- smoke DB is not running;
- `.env.local` has `DATABASE_URL` but migrations have not been applied;
- deterministic candidate fixtures are missing;
- a practice persistence migration changed but the local tables were not updated.

Run:

```powershell
npm run postgres:smoke:start
npm run db:migrate
npm run db:seed-candidate-dev
npm run db:smoke-candidate-readiness
```

For a known practice persistence migration delta, the narrower check is:

```powershell
npm run db:apply-candidate-practice-sessions-schema
npm run db:smoke-candidate-practice-sessions-schema
npm run db:apply-candidate-practice-intents-schema
npm run db:smoke-candidate-practice-intents-schema
npm run db:apply-candidate-answer-attempts-schema
npm run db:apply-candidate-answer-evaluator-run-claims-schema
npm run db:smoke-candidate-answer-attempts-schema
npm run db:smoke-candidate-answer-evaluator-run-claims-schema
npm run db:apply-candidate-prep-context-propagation-schema
npm run db:smoke-candidate-prep-context-propagation-schema
npm run db:apply-candidate-coach-update-artifacts-schema
npm run db:apply-candidate-coach-update-configuration-identity
npm run db:smoke-candidate-coach-update-artifacts-schema
npm run db:smoke-candidate-coach-update-configuration-identity
npm run db:apply-candidate-practice-session-status-backfill
npm run db:apply-candidate-next-round-drafts-schema
npm run db:smoke-candidate-next-round-drafts-schema
npm run db:apply-candidate-prep-context-practice-paths-schema
npm run db:smoke-candidate-prep-context-practice-paths-schema
```

### Browser Opens The Session But Data Does Not Recover

Check that you entered through `/candidate/dev/launch` and that the `ic_candidate_launch_session` cookie exists. Directly opening `/candidate/setup` can still render the UI, but durable candidate-owned recovery depends on the launch-session identity boundary.

### PowerShell Shows `Terminate batch job (Y/N)?`

That prompt appears when the dev server was started through `cmd /c`, including nested npm scripts. It is normal on Windows. Press `Y` to stop the batch process.

## Reference Archive

Historical V1/interim docs and the old all-in-one local SQL query live under:

- [Reference Archive](../reference-archive/README.md)
- [V1 master query](../reference-archive/sql/master_query.v1.sql)

Use those files when comparing against V1 behavior. Do not treat them as current bootstrap instructions.

## Acceptance Checklist

For current V2 local development:

- smoke Postgres is running;
- `db:migrate` has applied through `036_candidate_resume_ingestion_operations.sql`;
- local candidate dev seed is present;
- `db:smoke-candidate-readiness` passes;
- the app is launched with `npm run dev`;
- browser entry starts at `/candidate/dev/launch?...next=/candidate/setup`;
- candidate route recovery works through the launch-session cookie.

For the repeatable candidate-led browser gate, run:

```powershell
npm run test:e2e:candidate-seeded
```

The runner uses deterministic local providers, selects a genuinely free port, isolates Next output from an already-running development server, and restores generated TypeScript references when it exits. It covers the complete coached text loop, refresh/new-tab draft recovery, Coach Update transcript evidence, and provider-unavailable continuation through the quiet dashboard fallback. It does not call Gemini.

For the optimized production-shell gate, run:

```powershell
npm run test:e2e:candidate-production
```

This separate runner builds and starts isolated production output with database, host-launch, and Gemini credentials blank. It checks the public page at desktop/mobile, WCAG 2.2 A/AA axe rules, horizontal overflow, local regression budgets, and production denial of dev/prototype routes. It does not prove authenticated candidate behavior or TalentArbor integration; use the [TA Host Launch Live Acceptance](./host-launch-live-acceptance.md) protocol for that evidence.

The seeded browser runner accepts ordinary Playwright filters after `--`. For a focused resume milestone rerun without repeating the full practice loops:

```powershell
npm run test:e2e:candidate-seeded -- --grep "resume review recovers"
```
