# Local Postgres Smoke

## Purpose

Use this runbook to prove the migration branch is functional against a disposable plain Postgres database before the final company AWS/database/deployment details are available.

This proves the branch as built. It does not prove the final hosted environment, network path, managed DB privileges, TLS policy, secret store, SMTP policy, or production URL.

## Smoke DB

The local smoke database is a disposable Docker container with known local-only credentials:

| Item | Value |
| --- | --- |
| Container | `interviewcoach-postgres-smoke` |
| Image | `ankane/pgvector:latest` |
| Host port | `5434` |
| Database | `interviewcoach_smoke` |
| User | `postgres` |
| Password | `interviewcoach-local-smoke-password` |

The connection string is:

```text
postgresql://postgres:interviewcoach-local-smoke-password@127.0.0.1:5434/interviewcoach_smoke
```

These credentials are intentionally local and disposable. Do not use them outside the local smoke container.

## One-Time Setup

```powershell
npm run postgres:smoke:start
npm run db:apply-schema
npm run db:smoke-schema
```

What this does:

- Starts or creates the disposable Docker Postgres container.
- Applies `db/migrations/001_initial_schema.sql`.
- Runs `db/validation/001_initial_schema_smoke.sql` inside a rollback transaction.

## Provision A Smoke User

```powershell
$env:APP_USER_PASSWORD = "interviewcoach-local-user-password"
npm run auth:provision-user -- --smoke-defaults --email fu@rangam.com --roles recruiter,admin,qa --first-name Fu --last-name Box --timezone America/Chicago
```

This creates a Postgres-backed app user with recruiter, admin, and QA roles. The provisioner is idempotent for the same email.

## App Env For Local Smoke

Use these env values when starting the app against the smoke DB:

```powershell
$env:DATABASE_URL = "postgresql://postgres:interviewcoach-local-smoke-password@127.0.0.1:5434/interviewcoach_smoke"
$env:APP_AUTH_BACKEND = "postgres"
$env:SESSION_REPOSITORY_BACKEND = "postgres"
$env:INVITE_REPOSITORY_BACKEND = "postgres"
$env:TEMPLATE_REPOSITORY_BACKEND = "postgres"
$env:FEEDBACK_REPOSITORY_BACKEND = "postgres"
$env:AI_GENERATION_REPOSITORY_BACKEND = "postgres"
$env:CANDIDATE_TOKEN_BACKEND = "postgres"
$env:IDEMPOTENCY_BACKEND = "postgres"
$env:RATE_LIMIT_BACKEND = "postgres"
$env:METRICS_BACKEND = "postgres"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:3000"
$env:ENCRYPTION_SECRET = "interviewcoach-local-smoke-encryption-secret-32plus"
$env:GEMINI_API_KEY = "<real key for AI surfaces, or a placeholder for auth-only smoke>"
```

SMTP variables are required only if the smoke includes actual email delivery.
`ENCRYPTION_SECRET` is required before invite creation because candidate invite tokens are encrypted into session intake metadata. The value above is local-only and disposable; do not use it outside the smoke container.

For real local email smoke, also set the Office365 SMTP values in the server process:

```powershell
$env:SMTP_HOST = "smtp.office365.com"
$env:SMTP_PORT = "587"
$env:SMTP_USERNAME = "<mailbox>"
$env:SMTP_PASSWORD = "<password>"
$env:SMTP_FROM_EMAIL = "<from address>"
$env:SMOKE_EMAIL_RECIPIENT = "<recipient for test emails>"
```

`SMOKE_EMAIL_RECIPIENT` is optional. If omitted, `npm run postgres:smoke:email` sends to `SMTP_USERNAME`.

## Smoke Levels

### Level 1 - Database And Auth

Done when:

- Smoke DB starts.
- Schema applies.
- Rollback schema smoke passes.
- App user provisions.
- `/api/auth/login` accepts the provisioned user.
- Authenticated recruiter/admin/QA pages do not redirect to login.

Current result as of May 6, 2026:

- `npm run postgres:smoke:start`: passed.
- `npm run db:apply-schema`: passed.
- `npm run db:smoke-schema`: passed.
- `npm run auth:provision-user -- --smoke-defaults ...`: passed for `fu@rangam.com`.
- Local HTTP smoke on `http://localhost:3100`: `/api/auth/login`, `/recruiter`, `/qa/ai-quality`, and `/admin/feedback` all returned `200`.

### Level 2 - Recruiter And Candidate Data Flow

Done when:

- Recruiter login and invite creation work through the app route stack.
- Questions are persisted to Postgres.
- Candidate link opens through `/s/[token]`.
- Candidate can start practice and submit an answer.
- Session, question, answer, eval, token, idempotency, rate-limit, metric, and AI-generation rows are visible in the smoke DB.

Repeatable command after the app is running on port `3100` with the env values above:

```powershell
npm run postgres:smoke:product
```

Current result as of May 6, 2026:

- `npm run postgres:smoke:product`: passed against `http://127.0.0.1:3100`.
- Recruiter login succeeded for `fu@rangam.com`.
- Invite batch `7b89aa1e-6c67-4fa3-a3b9-e994f5e420aa` completed with candidate session `019dfd3f-9937-7ea5-94c0-cdec2204b61e`.
- Candidate link opened through `/s/[token]`.
- Candidate session fetched, initials submitted, session started, draft saved, answer submitted, and answer analysis completed.
- Verified Postgres rows: 3 questions, 1 answer, 1 eval result, 1 active candidate token, 2 idempotency rows for the candidate session, rate-limit rows, metric counter rows, and 1 AI-generation row for the session.

This script does not send email. Actual invite/debrief email delivery remains a separate SMTP smoke because `/api/invite/send` expects a provider acceptance result before it marks invitations sent.

### Level 3 - AI And QA Explorer

Done when:

- Gemini-backed question generation, answer feedback, hints, strong response, and session debrief run locally.
- `ai_generations` rows are written to Postgres.
- `/qa/ai-quality` reads the smoke DB records.

Repeatable command after the app is running on port `3100` with the env values above and a real `GEMINI_API_KEY`:

```powershell
npm run postgres:smoke:ai
```

Current result as of May 6, 2026:

- `npm run postgres:smoke:ai`: passed against `http://127.0.0.1:3100`.
- Recruiter login succeeded for `fu@rangam.com`.
- Gemini-backed question generation created a successful `question_generation` row.
- Postgres-backed invite batch `e60b2d5f-5658-4770-87db-2fcd9e1a99a0` completed with candidate session `019dfd4c-6a06-7ceb-8706-7dbea5062d10`.
- Candidate link opened through `/s/[token]`.
- Gemini-backed hints, strong response, answer feedback, and session debrief all completed.
- Verified successful `ai_generations` rows for `question_generation`, `hint`, `strong_response`, `answer_feedback`, and `session_debrief`, all with `model_provider = gemini` and `model_name = gemini-2.5-flash`.
- `/qa/ai-quality` returned `200`; `/qa/ai-quality/export?format=json&status=success&limit=100` returned `200` with records.

The Level 2 script can run without `GEMINI_API_KEY`; answer analysis will use the app's local mock fallback and still exercises the Postgres `ai_generations` write path. Level 3 requires a real `GEMINI_API_KEY`; actual email delivery also requires valid `SMTP_*` values.

### Level 4 - Real SMTP Email

Done when:

- `/api/invite/send` sends an initial invite through the configured SMTP provider.
- The provider returns a message id and accepted-recipient response.
- The session row has `invitation_sent_at`.
- Completing a candidate session sends the debrief email through the same SMTP provider.
- The session row has `summary_narrative` and `intake_json.summary_expires_at`, proving the debrief send returned provider acceptance.

Repeatable command after the app is running on port `3100` with the Postgres env values and real SMTP env values:

```powershell
npm run postgres:smoke:email
```

This smoke sends real email. It defaults the recipient to `SMTP_USERNAME` unless `SMOKE_EMAIL_RECIPIENT` is set.

Current result as of May 6, 2026:

- `npm run postgres:smoke:email`: passed against `http://127.0.0.1:3100` with Office365 SMTP env values loaded from local development configuration.
- The intentional smoke recipient was `fusbox@gmail.com`.
- Recruiter login succeeded for `fu@rangam.com`.
- Invite batch `eb13a647-e9cf-48d1-ac84-632c8427491a` completed with candidate session `019dfd58-d217-7f2d-876c-1fa6178a88b8`.
- `/api/invite/send` returned provider message id `<4ebd8382-3e15-bf17-d17e-e02e5d5bf234@coach.rangam.com>`.
- Verified `sessions.invitation_sent_at` was set.
- Candidate session opened, initials submitted, practice started, one answer submitted, answer analysis completed, and session completion generated the debrief.
- Verified `summary_narrative` and `intake_json.summary_expires_at` were persisted after debrief email provider acceptance.
- Verified Postgres metrics included successful `invite_send_total` and `session_completion_total` rows.
- Human receipt confirmation: the invite email arrived for both the candidate recipient and recruiter sender mailbox, and the debrief email arrived for the candidate recipient.

### Level 5 - Browser-Visible Recruiter Flow

Done when:

- A recruiter can log in through `/login`.
- The protected recruiter shell renders the expected role/navigation.
- The recruiter can create a manual invite through the visible multi-step create flow.
- The preview modal renders the correct recipient, sender, subject, and invite content.
- Sending from the preview modal shows the visible delivered state.
- The recruiter dashboard shows the created candidate/session with `Invite Sent`.
- The smoke DB has the new session row and `invitation_sent_at`.

Current result as of May 6, 2026:

- Browser smoke passed against `http://127.0.0.1:3100` with the disposable Postgres DB and Office365 SMTP env values.
- Recruiter login succeeded for `fu@rangam.com` and redirected to `/recruiter/create`.
- The visible create flow used `UI-SMOKE-001`, role `Warehouse Associate`, one behavioral question, and candidate `Browser Smoke` at `fusbox@gmail.com`.
- The preview modal displayed the Office365 sender, candidate recipient, recruiter Cc, and `Practice Interview Invitation: Warehouse Associate`.
- The modal send action returned the visible `Delivered!` state.
- The dashboard showed `Browser Smoke` under `Not Started` and the detailed table with status `Invite Sent`.
- Smoke DB verification found session `019dfd5f-e191-7320-ab8d-836b4c8f0b6d`, status `NOT_STARTED`, target role `Warehouse Associate`, and `invitation_sent_at = 2026-05-06T13:01:00.342Z`.
- The browser pass also found and fixed stale vendor copy in the invite preview footer: `Secure automated delivery via Resend` is now vendor-neutral.
- Non-blocking browser warnings found during the pass were cleaned up where low risk: login password autocomplete metadata and invite-preview logo aspect-ratio styles.

### Level 6 - Browser-Visible Candidate Practice Flow

Done when:

- A candidate invite link opens through `/s/[token]`.
- Initials entry gates access and then resumes the same candidate session.
- The candidate can enter the welcome screen, select readiness, and begin the first question.
- Hints and strong example response render from the app's AI surfaces.
- Text-mode answer submission works when microphone access is unavailable in an automated browser.
- Candidate-only answer feedback renders after each submitted answer.
- Completing the final question renders the browser debrief summary.
- The session row is `COMPLETED`, has all answer/eval rows, and has a persisted `summary_narrative`.
- The debrief screen only claims an email copy when provider acceptance set `summary_expires_at`.

Current result as of May 6, 2026:

- Browser smoke passed against `http://127.0.0.1:3100` with the disposable Postgres DB and a real `GEMINI_API_KEY`.
- Fresh invite batch `15564a3b-9a47-48d6-bff6-f3cf8f44ea18` created candidate session `019dfd69-a227-776c-b2bd-c2a2d084a88c`.
- Candidate link opened at `/s/04d874a0ec5ee869277441c099f6a835`.
- Initials `CB` were accepted, the welcome screen loaded, readiness rating was selected, and practice started.
- Automated Chromium blocked microphone access as expected; the UI showed the microphone warning and the test continued through text mode.
- Hints and the example strong response rendered for question 1.
- All three text answers were submitted successfully; answer feedback rendered for each question.
- The final summary screen rendered the debrief narrative, session survey, close button, and practice-again button.
- Smoke DB verification found session status `COMPLETED`, `current_question_index = 3`, `answer_count = 3`, `eval_count = 3`, `summary_narrative` present, and `summary_expires_at = null`.
- AI-generation verification found successful rows for `answer_feedback` x3, `hint` x3, `strong_response` x1, and `session_debrief` x1.
- The pass exposed and fixed a no-SMTP copy bug: when SMTP env is absent and debrief email is skipped, the summary screen no longer says the report was emailed.
- The pass also corrected candidate-screen Rangam logo dimensions to match the actual image asset and remove the Next image warning.

## Level 7 - Practice Again Chain Smoke

Goal: verify repeat-practice attempts can chain beyond the first retry while all Postgres-backed candidate token and session repositories are pinned to `postgres`.

Repeatable command:

```powershell
npm run postgres:smoke:practice-again
```

Done when:

- A Postgres-backed invite is created through the app route stack.
- Attempt 2 is created from the original invite session using the original candidate token.
- Attempt 2 receives a distinct `x-candidate-token`.
- Attempt 2 can be fetched with its own candidate token and exposes that token as its `inviteToken` for practice-again links.
- Attempt 3 is created from attempt 2 using attempt 2's token.
- Attempt 3 receives a distinct `x-candidate-token`.
- Postgres has active `candidate_tokens` rows for attempts 1, 2, and 3.
- Postgres session rows preserve lineage and encrypted invite-token metadata for repeat attempts.

Current result as of May 6, 2026:

- Route-stack smoke passed against `http://127.0.0.1:3100` with the disposable Postgres DB.
- Fresh invite batch `592def5a-6cad-4468-b379-72eb243ec239` created attempt 1 session `019dfd8d-927f-7846-999f-fdf9fa4e6906`.
- Attempt 2 session `019dfd8d-95e3-7078-9a8d-46d21c9f301b` was created from attempt 1 with its own returned candidate token.
- Attempt 3 session `019dfd8d-9da9-7ace-a533-fab933f1f261` was created from attempt 2 with its own returned candidate token.
- API fetches for attempts 2 and 3 succeeded only with their respective issued tokens and returned matching `inviteToken` values.
- Smoke DB verification found three active candidate-token rows and confirmed attempts 2 and 3 both have encrypted `intake_json.invite_token` metadata.
- The pass fixed the underlying core-app bug by persisting each newly issued session token back onto the session as encrypted invite-token metadata after session start.

## Level 8 - Profile And Settings Smoke

Goal: verify recruiter profile/settings can load and save through app-owned auth and the Postgres-backed `recruiter_profiles` path.

Repeatable command:

```powershell
npm run postgres:smoke:profile-settings
```

Done when:

- A recruiter can log in through `/api/auth/login` with app-owned Postgres auth.
- The protected `/recruiter/settings` page returns `200`.
- `/api/recruiter/profile` returns the current app user and profile.
- `PUT /api/recruiter/profile` persists profile edits through the Postgres profile helper.
- A follow-up profile fetch returns the saved profile.
- The smoke DB `public.recruiter_profiles` row reflects the saved values.
- The script restores the original smoke-user profile after validation so the smoke can be rerun.

Current result as of May 6, 2026:

- Route-stack smoke passed against `http://127.0.0.1:3100` with the disposable Postgres DB.
- Login succeeded for `fu@rangam.com` / user `576627b5-cb54-4f7b-b22b-828ee03ed495`.
- `/recruiter/settings` returned `200`.
- The profile API saved title `Profile Smoke 20260506142506` and timezone `America/New_York`.
- Smoke DB verification confirmed the updated `recruiter_profiles` row.
- The script restored the original profile before exit.

## Level 9 - Invite Resend And Batch Retry Smoke

Goal: verify invite resend and failed-batch retry work through app-owned auth, Postgres-backed repositories, durable idempotency/rate-limit/metrics stores, and real SMTP delivery.

Repeatable command:

```powershell
$env:SMOKE_EMAIL_RECIPIENT = "recipient@example.com"
npm run postgres:smoke:resend-retry
```

For the May 6 local validation, the command was run directly with `--recipient-email fusbox@gmail.com` so the real resend email had an intentional recipient.

Done when:

- A recruiter can log in through `/api/auth/login` with app-owned Postgres auth.
- A Postgres-backed invite can be created for the resend target.
- `POST /api/invite/resend` sends through the SMTP adapter and returns a provider message id.
- The resend updates `sessions.invitation_sent_at`.
- The resend writes success metrics through the Postgres metrics backend.
- A failed, retryable invite batch can be retried through `POST /api/recruiter/invites/[batch_id]/retry`.
- The retry route writes a completed idempotency record through the Postgres idempotency backend.
- The failed parent batch becomes `retry_issued` and points to the child batch.
- The failed parent candidate becomes `retry_issued`, `retryable = false`, and increments `retry_count`.
- The child batch is `completed` and creates a child session/candidate token.

Current result as of May 6, 2026:

- Route-stack smoke passed against `http://127.0.0.1:3100` with the disposable Postgres DB and Office365 SMTP env values.
- Login succeeded for `fu@rangam.com` / user `576627b5-cb54-4f7b-b22b-828ee03ed495`.
- Resend session `019dfdb6-1429-73c3-baa5-3700f62b0c59` returned provider message id `<298058a4-7ef5-25f9-5960-2d4cc55caaeb@coach.rangam.com>`.
- Smoke DB verification confirmed `invitation_sent_at = 2026-05-06T14:34:23.397Z` and one `invite_resend_total{outcome=success}` metric.
- Seeded retry parent batch `930b723c-044f-4f25-a2ff-509d9dfdc1b1` retried into child batch `a1bf46e9-1212-4965-a493-53036dd36aa4`.
- Smoke DB verification confirmed parent status `retry_issued`, child status `completed`, child session `019dfdb6-255e-7aad-b887-62066f285bf5`, and one completed retry idempotency row.

## Level 10 - Recruiter Review Smoke

Goal: verify a recruiter can open a session review page for their own candidate session through app-owned auth and Postgres-backed session storage.

Current product contract:

- Recruiter review currently shows session summary, status, question text, submitted/pending state, and candidate transcripts.
- Recruiter review does not expose the candidate-facing AI coaching feedback. AI feedback is rendered in candidate session surfaces and evaluated in QA/admin surfaces, not on `/recruiter/sessions/[id]`.

Repeatable command:

```powershell
npm run postgres:smoke:recruiter-review
```

Done when:

- A recruiter can log in through `/api/auth/login` with app-owned Postgres auth.
- A Postgres-backed invite/session can be created for that recruiter.
- A candidate answer can be submitted through the candidate token route stack.
- `/recruiter/sessions/[id]` returns `200` for the owning recruiter.
- The review page includes the session title, candidate name, target role, question text, submitted response heading, and transcript.
- The review page does not expose candidate AI feedback pulse labels such as `Content Pulse` or `Delivery Pulse`.
- Postgres contains the owner-scoped session row and submitted answer row.

Current result as of May 6, 2026:

- Route-stack smoke passed against `http://127.0.0.1:3100` with the disposable Postgres DB.
- Login succeeded for `fu@rangam.com` / user `576627b5-cb54-4f7b-b22b-828ee03ed495`.
- Review session `019dfdc4-03c6-7f40-a088-cbe21ba53353` returned `200`.
- The page included candidate `Smoke Review`, role `Warehouse Associate`, the question text, the `Candidate Response` heading, and the submitted transcript excerpt.
- Smoke DB verification confirmed session status `AWAITING_EVAL`, one answer row, and one final answer row.

## Level 11 - Negative Permissions Smoke

Goal: verify the migrated app denies common cross-boundary access attempts while app-owned auth, Postgres-backed repositories, candidate-token auth, rate limits, metrics, and route/page guards are active.

Repeatable command:

```powershell
npm run postgres:smoke:negative-permissions
```

Done when:

- A disposable second recruiter can be provisioned in the smoke DB with only the `recruiter` role.
- The owner recruiter can create two Postgres-backed candidate sessions.
- A candidate session fetch without `x-candidate-token` returns `401`.
- A candidate token issued for one session cannot fetch another session and returns `403`.
- A non-owning recruiter cannot open another recruiter's session review page and receives `404`.
- A non-owning recruiter cannot resend another recruiter's invite and receives `403`.
- A recruiter without admin/QA privileges is redirected away from `/admin/feedback` and `/qa/ai-quality`.
- A recruiter without QA privileges cannot use `/qa/ai-quality/export` and receives `403`.
- Anonymous protected-page access redirects to `/login?next=...`.
- The smoke DB confirms both test sessions belong to the owner and the second user has only the `recruiter` role.

Current result as of May 6, 2026:

- Route-stack smoke passed against `http://127.0.0.1:3100` with the disposable Postgres DB.
- Owner login succeeded for `fu@rangam.com` / user `576627b5-cb54-4f7b-b22b-828ee03ed495`.
- Disposable non-admin/non-QA recruiter `smoke.negative.recruiter+20260506150421@example.com` was provisioned with user id `0cfe91c9-f306-4f6e-83f3-6381e7411865`.
- Candidate session fetch without token returned `401`.
- Candidate session fetch with a token from the other smoke session returned `403`.
- Cross-recruiter session review returned `404`.
- Cross-recruiter invite resend returned `403`.
- Non-admin `/admin/feedback` and non-QA `/qa/ai-quality` page requests redirected to `/recruiter`.
- Non-QA `/qa/ai-quality/export` returned `403`.
- Anonymous `/recruiter` access redirected to `/login?next=%2Frecruiter`.
- Smoke DB verification confirmed two owner-scoped session rows and only the `recruiter` role on the second user.

## Final Handoff Language

If Level 1-11 pass locally, we can say:

> The migration branch is functional against a disposable plain Postgres database using app-owned auth, Postgres-backed repositories, candidate-token access controls, role-gated admin/QA pages, Gemini-backed AI surfaces, real SMTP invite/debrief delivery, and browser-visible recruiter plus candidate flows. Remaining work is target-environment integration: final AWS hosting shape, managed Postgres endpoint and credentials, network/TLS policy, secret store, least-privilege DB user, production URL, and deployment validation.
