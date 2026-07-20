# Candidate Observability Plan

Date: 2026-07-19
Status: Working implementation plan under the ratified production baseline

## Purpose

This plan defines the candidate-side events, logs, metrics, dashboards, and alert hooks needed before candidate-led Interview Coach is production-facing on the shared host.

The goal is useful operational visibility without leaking candidate resume text, answers, coaching output, or unnecessary identifiers.

The governing field allowlist, initial alert map, environment ownership, rollback sequence, and post-deploy protocol are in [Candidate Production Hardening And Deployment Controls](./production-hardening-and-deployment-controls.md). This file inventories the observability implementation direction; it must not be read as evidence that dashboards or alert delivery are already provisioned.

## Existing Foundation To Reuse

The migrated recruiter app already includes:

- structured logger utilities in `src/lib/logger.ts` and `src/lib/server/server-logger.ts`
- counter and timing helpers in `src/lib/server/metrics.ts`
- durable Postgres metrics backend support through `METRICS_BACKEND=postgres`
- protected recruiter ops metrics route at `/api/recruiter/ops/metrics`
- Teams alert delivery hook controlled by `TEAMS_ALERT_WEBHOOK_URL`
- auth denial and rate-limit metric helpers
- AI request/error/latency metrics on existing generation services

Candidate work should extend those patterns instead of creating a separate observability stack.

Current candidate helper:

- `src/lib/server/candidate/candidate-observability.ts` records candidate route counters as `candidate_route_total`
- route timings are recorded as `candidate_route_duration_ms`
- both helpers add `actorType=candidate` and `appName=candidate_app`
- `withCandidateRouteMetrics` wraps candidate route loaders for `/candidate/dashboard`, `/candidate/setup`, `/candidate/session/[sessionId]`, and `/candidate/summary/[sessionId]`
- `withCandidateMutationBoundary` applies shared rate-limit backend checks to candidate generation, session progress, answer submit, and retry mutations
- current candidate server-action mutations are state-idempotent: repeat calls either set the same target state, return the already-submitted answer, or no-op when retry state is already clear
- candidate protected-route redirects in external auth mode write structured logs with safe fields only: `actorType=candidate`, `actorMode=external`, `route=<path only>`, and `reason=missing_candidate_session`
- helper tests live in `src/lib/server/candidate/candidate-observability.test.ts`

## Event Taxonomy

Use `actorType: candidate` on candidate logs and include an `appName` or tag value of `candidate_app` where existing APIs support it.

| Area | Event / Metric | Why It Matters | Sensitive Data Rule |
| --- | --- | --- | --- |
| Auth | auth denial structured logs and server-side `auth_denials_total` tagged `actorType=candidate`, `actorMode`, `route`, `reason` where the runtime supports metrics | Detect broken SSO handoff, callback issues, or route guard loops | Do not log tokens, provider assertions, full callback payloads, query strings, or return-state values |
| Host launch | request-id-correlated `assembly`, `verification`, and `exchange` outcomes with allowlisted reasons and canonical entry route only | Distinguish deployment configuration, claim rejection, identity/job ownership, replay, and accepted routing without weakening the browser response | Never log launch URL/token, fingerprint/id, cookie/session value, candidate/job identifiers, email, role/JD/resume, or request query |
| Completed-round coaching repair | `candidate_completed_round_coaching_repair` | Diagnose whether a completed round recovered missing evaluator evidence and became eligible for Coach Update | Log only a random request id, bounded outcome, attempted/repaired/pending/retryable/unavailable/invalid-lineage counts, and Coach Update status; never log candidate/session/answer/run ids, answer/question text, provider output, prompts, JD/resume content, or cookie values |
| Coach Update synthesis | `candidate_coach_update_runtime_telemetry_v1` | Diagnose provider/profile behavior and safe terminal outcomes for post-session synthesis | Log only synthesis fingerprint, provider/profile/model/prompt/evaluator versions, safe configuration fingerprint, accepted/failed/rejected outcome, allowlisted error code, retryable boolean, latency, one-attempt count, and optional token counts; never log candidate/session/prep ids, answers, questions, generated coaching, request envelopes, prompts, raw output, provider exception detail, JD/resume content, or credentials |
| Login return | login-start and callback outcomes | Confirm `/candidate/setup` and `/candidate/dashboard` returns work after TalentArbor login | Log allowlisted `next` path only |
| Draft lifecycle | draft create/update/submit/generation status counters | Detect stuck drafts and setup friction | Do not log job description, resume text, or intake free text |
| Resume ingestion | upload accepted, extraction success/failure, retention outcome | Confirm private upload and deletion behavior | Log safe failure code only, never parser output or storage URL |
| Session lifecycle | session created/started/paused/resumed/completed counters | Track whether candidates can get through the core flow | Do not log answers or generated coaching |
| AI generation | request count, failure count, latency by operation | Detect provider or prompt-contract failures | Prompt and response bodies stay out of ordinary logs |
| Dashboard | dashboard load success/error and empty/active/completed counts | Detect ownership or query regressions | Counts only, no titles or snippets in logs |
| Security | rate-limit denials, ownership denials, invalid draft/session access | Spot abuse or broken ownership boundaries | Redact candidate identity where possible |

## Minimum Production Dashboard

Before production pilot, the ops view should answer:

- Are candidate auth denials spiking?
- Are `/candidate/setup`, `/candidate/dashboard`, `/candidate/session`, and `/candidate/summary` returning errors?
- Are draft-to-session transitions succeeding?
- Are resume extraction failures increasing?
- Are AI generation failures or latency increasing?
- Are ownership denials occurring unexpectedly?
- Are recruiter invite-token flows still healthy after candidate changes?

Initial dashboard sources:

- `/api/recruiter/ops/metrics` until a neutral `/api/ops/metrics` route is introduced
- Azure App Service or hosting logs
- Azure Pipelines build/test history
- Teams alert channel once configured

## Alert Candidates

Use low-noise alerts first:

- candidate auth denial spike over a short window
- candidate route 5xx spike on `/candidate/setup`, `/candidate/dashboard`, `/candidate/session`, or `/candidate/summary`
- resume extraction failure spike
- AI generation error or malformed-response spike
- durable metrics backend unavailable in production
- recruiter invite create/send smoke failure after candidate branch merge

Thresholds and first-response actions are defined in the production hardening contract. Tune them from staging baselines rather than treating local-development latency as an SLO.

## Logging Rules

- Never log raw resume text, raw extracted text, uploaded file contents, candidate answers, generated coaching, or provider auth payloads.
- Prefer IDs and reason codes over free-form exception messages for candidate-sensitive paths.
- Use route names and operation names instead of full URLs when query strings may contain sensitive data.
- Keep candidate and recruiter actor labels distinct so metrics are not blended accidentally.
- Treat Teams webhook URLs and auth secrets as secrets.

## Deployment Environment Expectations

Production-like environments should set:

```text
METRICS_BACKEND=postgres
TEAMS_ALERT_WEBHOOK_URL=<Teams incoming webhook, when alerting is enabled>
NEXT_PUBLIC_APP_URL=https://interviewcoach.talentarbor.com
CANDIDATE_AUTH_MODE=external
```

Local development can keep memory metrics and `dev`, mock, or password candidate auth modes.

## Verification Before Production Pilot

- `npm run build` passes.
- Candidate primary route smoke passes.
- Recruiter route smoke passes for create and manage invites.
- Durable metrics backend is confirmed in production-like runtime.
- One manual Teams alert send is validated after webhook provisioning.
- Resume extraction failure path stores safe reason codes only.
- Auth redirect tests prove unsafe return targets are rejected.
- Production dependency audit is reviewed. The Slices 125-133 integration milestone removed the Google SDK transitive critical/high findings and upgraded Next.js to `15.5.20`; the remaining `nodemailer` high advisory and Next-bundled PostCSS moderate advisory require an explicit upgrade or risk-acceptance decision before pilot/release.

## Follow-Up Work

- Consider a neutral `/api/ops/metrics` route once candidate/recruiter metrics are both first-class.
- Add candidate-specific counters around draft mutation, session generation, and resume extraction actions as implementation stabilizes.
- Wire the mapped candidate events and alerts to the selected deployment sink, then prove delivery in staging.
- Execute the post-deploy smoke in the production hardening contract, including real TA launch exchange and log-redaction evidence.
- Confirm the final TalentArbor identity handoff fields before logging any provider-specific metadata.
