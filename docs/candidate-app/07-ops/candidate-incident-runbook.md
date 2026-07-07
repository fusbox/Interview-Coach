# Candidate Incident Runbook

Date: 2026-05-12
Status: Working runbook

## Purpose

This runbook gives the team a first response path for candidate-led Interview Coach incidents on the shared `interviewcoach.talentarbor.com` host.

Use it when candidate access, setup, resume ingestion, AI generation, dashboard, or deployment behavior fails or appears unsafe.

## First Response

1. Confirm the affected route: `/`, `/candidate/setup`, `/candidate/dashboard`, `/candidate/session/[sessionId]`, `/candidate/summary/[sessionId]`, or `/s/[token]`.
2. Confirm actor path: public candidate, authenticated candidate, recruiter invite-token candidate, recruiter, admin, or QA.
3. Check whether recruiter routes are also affected, especially `/recruiter`, `/recruiter/create`, `/recruiter/settings`, `/admin/feedback`, and `/qa/ai-quality`.
4. Check latest deployment/build status in Azure.
5. Check application logs and the ops metrics dashboard.
6. Capture the first failing request, timestamp, route, environment, and correlation/request id if available.
7. Avoid collecting raw resume text, candidate answers, generated coaching, provider tokens, or uploaded files in incident notes.

## Severity Guide

| Severity | Examples | Initial Response |
| --- | --- | --- |
| High | candidate auth loop, data exposure, recruiter app broken, resume content logged, production deploy unavailable | Stop promotion, notify owner, preserve evidence, consider rollback |
| Medium | practice setup cannot save, dashboard unavailable for candidates, AI generation broadly failing, resume extraction spike | Triage route/API/logs, create bug, decide fix-forward vs rollback |
| Low | isolated copy/layout issue, single candidate draft error, non-blocking telemetry gap | Track as bug or follow-up, keep current release if core flow works |

## Auth And SSO Incidents

Symptoms:

- candidate CTA reaches TalentArbor login but never returns
- `/candidate/setup` or `/candidate/dashboard` redirects repeatedly
- unsafe `next` target is accepted
- candidate route accepts the wrong actor session

Checks:

- Confirm `CANDIDATE_AUTH_MODE=external` in production-like environments.
- Confirm `NEXT_PUBLIC_APP_URL=https://interviewcoach.talentarbor.com`.
- Review candidate login redirect contract and TalentArbor return support.
- Check `auth_denials_total` tagged `actorType=candidate`.
- Verify `/auth/talentarbor/start?next=/candidate/setup` and `/auth/talentarbor/start?next=/candidate/dashboard` only preserve allowlisted internal targets.

Containment:

- Disable or hide affected public CTA if login handoff is broken and candidates cannot proceed.
- Do not broaden the allowlist during an incident without code review.

## Candidate Data Or Ownership Incidents

Symptoms:

- candidate sees another candidate's draft, session, or summary
- candidate route leaks recruiter-owned data
- recruiter invite-token `/s/[token]` flow sees self-serve candidate data

Checks:

- Confirm candidate profile id used by the failing request.
- Check ownership filters in candidate repositories/loaders.
- Re-run negative ownership tests if the failure can be reproduced.
- Confirm shared APIs resolve actor mode explicitly.

Containment:

- Treat any cross-candidate or candidate/recruiter data exposure as high severity.
- Stop promotion and consider disabling the affected route until ownership behavior is corrected.

## Resume Ingestion Incidents

Symptoms:

- extraction failures spike
- original uploaded files remain after successful extraction
- parser errors expose local paths, storage paths, or resume content
- logs include raw resume text or extracted text

Checks:

- Review safe failure code recorded for failed extraction.
- Confirm successful extraction marks original retention as deleted.
- Check storage paths are private relative paths, not public URLs.
- Confirm incident notes do not include raw resume content.

Containment:

- Pause upload entry points if raw files are retained unexpectedly.
- Keep pasted resume flow available only if it still follows processed-artifact retention rules.

## AI Generation Incidents

Symptoms:

- generated questions fail
- answer coaching fails or returns malformed response
- latency spikes
- generated output appears unsafe or unrelated to role/context

Checks:

- Review `ai_requests_total` and `ai_request_duration_ms` by operation.
- Confirm fallback behavior where implemented.
- Check prompt input shaping without copying sensitive candidate text into incident notes.
- Verify provider configuration and quota status.

Containment:

- Prefer graceful failure and retry affordances over exposing provider errors.
- If output safety is in question, disable the affected generation path until reviewed.

## Dashboard Or Session Incidents

Symptoms:

- dashboard fails to load
- active/completed sessions are missing
- resume/review/repeat links point to wrong route
- session progress cannot save

Checks:

- Confirm candidate auth/profile resolution.
- Check draft/session status values and resume target screen.
- Review candidate route metrics for `/candidate/dashboard`, `/candidate/session`, and `/candidate/summary`.
- Re-run dashboard/session route tests for the affected surface.

Containment:

- If dashboard is down but direct session links work, provide a temporary direct route only through authenticated support channels.
- Do not expose raw database identifiers publicly in workaround instructions.

## Database Or Migration Incidents

Symptoms:

- migration fails
- candidate profile/draft/session tables missing or inconsistent
- durable metrics, idempotency, or rate-limit stores unavailable

Checks:

- Confirm latest migration applied in target environment.
- Run schema smoke commands for candidate migrations.
- Check `DATABASE_URL` or split `POSTGRES_*` configuration.
- Confirm production-like `METRICS_BACKEND=postgres`.

Containment:

- Stop deployment if migration failed.
- Roll forward with a reviewed migration fix when possible; rollback only if app/data compatibility is understood.

## Shared Host Deployment Incidents

Symptoms:

- public `/` works but recruiter launch breaks
- recruiter `/recruiter` alias fails
- `/_next/**`, `/api/**`, or public assets behave inconsistently
- candidate branch deploy changes admin/QA access

Checks:

- Use [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md).
- Use [Recruiter Regression Checklist For Candidate PRs](../05-quality/recruiter-regression-checklist.md).
- Run candidate primary route smoke and recruiter create/manage invite smoke.

Containment:

- Candidate fixes must not bypass recruiter/admin/QA guards.
- If shared host route ownership is uncertain, prefer rollback or route-level disablement over ad hoc proxy changes.

## Evidence To Capture

- environment
- route
- actor path
- timestamp with timezone
- browser/device if UI issue
- build/deployment id
- request/correlation id if available
- sanitized error message or safe reason code
- verification command output
- work item or bug link

Do not capture raw resume text, raw answers, generated coaching, auth tokens, provider assertions, or uploaded files unless company incident policy explicitly requires a secure evidence path.

## Escalation Paths

- Product/implementation owner: candidate app owner
- Integration/deployment owner: shared host and TalentArbor handoff owner
- Security/privacy: data exposure, logging, auth, resume retention
- AI provider/configuration: generation failures, quota, malformed provider responses
- Database owner: migration, Postgres access, durable metrics/idempotency/rate-limit store failures

## Closeout Checklist

- Root cause recorded.
- Candidate and recruiter impact recorded separately.
- Fix or rollback recorded.
- Verification evidence attached.
- Work item state updated.
- Follow-up bug/story created for prevention.
- Relevant docs updated if the incident changed the operational contract.
