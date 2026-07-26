# Candidate Observability Plan

Date: 2026-07-22
Status: Working implementation plan under the ratified production baseline

## Purpose

This plan defines the candidate-side events, logs, metrics, dashboards, and alert hooks needed before candidate-led Interview Coach is production-facing on the shared host.

The goal is useful operational visibility without leaking candidate resume text, answers, coaching output, or unnecessary identifiers.

The governing field allowlist, initial alert map, environment ownership, rollback sequence, and post-deploy protocol are in [Candidate Production Hardening And Deployment Controls](./production-hardening-and-deployment-controls.md). This file inventories the observability implementation direction; it must not be read as evidence that dashboards or alert delivery are already provisioned.

## Reference Foundation And Current Rebuild State

The pre-cleanroom recruiter app included patterns worth reusing:

- structured logger utilities in `src/lib/logger.ts` and `src/lib/server/server-logger.ts`
- counter and timing helpers in `src/lib/server/metrics.ts`
- durable Postgres metrics backend support through `METRICS_BACKEND=postgres`
- protected recruiter ops metrics route at `/api/recruiter/ops/metrics`
- Teams alert delivery hook controlled by `TEAMS_ALERT_WEBHOOK_URL`
- auth denial and rate-limit metric helpers
- AI request/error/latency metrics on existing generation services

Those helpers and the recruiter metrics route are not present in the clean V2 rebuild and must not be cited as current implementation. Candidate work should reuse their narrow structured-event principles without restoring stale V1 modules wholesale. Current V2 boundaries emit local structured diagnostics directly, and durable resume-ingestion operation metadata lands in Postgres. A neutral durable metrics sink, dashboard, and alert delivery remain release work.

## Event Taxonomy

Use `actorType: candidate` on candidate logs and include an `appName` or tag value of `candidate_app` where existing APIs support it.

| Area | Event / Metric | Why It Matters | Sensitive Data Rule |
| --- | --- | --- | --- |
| Auth | auth denial structured logs and server-side `auth_denials_total` tagged `actorType=candidate`, `actorMode`, `route`, `reason` where the runtime supports metrics | Detect broken SSO handoff, callback issues, or route guard loops | Do not log tokens, provider assertions, full callback payloads, query strings, or return-state values |
| Host launch | request-id-correlated `assembly`, `verification`, and `exchange` outcomes with allowlisted reasons and canonical entry route only | Distinguish deployment configuration, claim rejection, identity/job ownership, replay, and accepted routing without weakening the browser response | Never log launch URL/token, fingerprint/id, cookie/session value, candidate/job identifiers, email, role/JD/resume, or request query |
| Completed-round coaching repair | `candidate_completed_round_coaching_repair` | Diagnose whether a completed round recovered missing evaluator evidence and became eligible for Coach Update | Log only a random request id, bounded outcome, attempted/repaired/pending/retryable/unavailable/invalid-lineage counts, and Coach Update status; never log candidate/session/answer/run ids, answer/question text, provider output, prompts, JD/resume content, or cookie values |
| Coach Update synthesis | `candidate_coach_update_runtime_telemetry_v1` | Diagnose provider/profile behavior and safe terminal outcomes for post-session synthesis | Log only synthesis fingerprint, provider/profile/model/prompt/evaluator versions, safe configuration fingerprint, accepted/failed/rejected outcome, allowlisted error code, retryable boolean, latency, one-attempt count, and optional token counts; never log candidate/session/prep ids, answers, questions, generated coaching, request envelopes, prompts, raw output, provider exception detail, JD/resume content, or credentials |
| Draft lifecycle | draft create/update/submit/generation status counters | Detect stuck drafts and setup friction | Do not log job description, resume text, or intake free text |
| Resume ingestion | `candidate_resume_ingestion` plus the durable ingestion-operation ledger | Confirm admission, replay, extraction/OCR, PII-scrub, persistence, disposal, stale recovery, and publication fencing | Log only source kind, bounded size/page class, safe outcome/failure code, claim generation, HTTP status, and duration/latency class; never source text/bytes, OCR output, removed PII, filename, path/URL, fingerprint, operation/artifact id, or candidate/prep identity. Slice 178 wires the local event and durable operation facts; a deployed sink/dashboard remains open. |
| Voice transcription | `voice_transcription` outcome and duration | Detect permission-independent route/provider failures, stale claims, malformed media, and latency without capturing practice content | Allow only random request id, audience type, safe outcome/error code, provider/profile/configuration identity, generation attempt, latency, and coarse byte/duration buckets; never audio, transcript, audio/output fingerprints, candidate/session/question ids, provider raw output, or credentials |
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
- Are voice transcription failures, stale claims, or latency increasing after voice is enabled?
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
- voice transcription malformed-media, provider-error, stale-claim, or latency spike after a staging baseline exists
- voice transcription diagnostics must retain only safe provider/profile/configuration identity on provider or format failure; audio, transcript, fingerprints, actor/session/question identity, and raw provider details remain prohibited
- AI generation error or malformed-response spike
- durable metrics backend unavailable in production
- recruiter invite create/send smoke failure after candidate branch merge

Thresholds and first-response actions are defined in the production hardening contract. Tune them from staging baselines rather than treating local-development latency as an SLO.

## Logging Rules

- Never log raw resume text, raw extracted text, uploaded file contents, candidate answers, generated coaching, or provider auth payloads.
- Never log raw voice audio, transcript text, audio/output fingerprints, provider transcription output, or media-bearing request bodies.
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
CANDIDATE_HOST_LAUNCH_DEV_MODE=false
```

Local development may explicitly enable the dev host-launch fixture and memory metrics. Production must not expose that route.

## Verification Before Production Pilot

- `npm run build` passes.
- Candidate primary route smoke passes.
- Recruiter route smoke passes for create and manage invites.
- Durable metrics backend is confirmed in production-like runtime.
- One manual Teams alert send is validated after webhook provisioning.
- Resume extraction failure path stores safe reason codes only.
- Host launch tests prove invalid, expired, replayed, wrong-issuer, wrong-product, and wrong-source assertions fail closed and accepted exchange redirects to a clean canonical route.
- Production dependency audit is reviewed. At Slice 175, `npm audit --omit=dev` reports four package entries representing high `brace-expansion` denial of service through the existing Google-auth cleanup chain, one moderate Next-bundled PostCSS advisory, and high `sharp`/libvips advisories through Next. No finding is attributed to Busboy or the pinned document parsers. Resume photos are not decoded by Sharp in the app, but every unresolved production-tree finding still requires a tested upgrade/override or explicit temporary risk acceptance before pilot/release.

## Follow-Up Work

- Consider a neutral `/api/ops/metrics` route once candidate/recruiter metrics are both first-class.
- Add candidate-specific counters around draft mutation, session generation, and resume extraction actions as implementation stabilizes.
- Add voice-transcription counters only with the allowlist in this plan, then verify log/metric redaction with fixture, credentialed failure, and deployed-browser cases before production enablement.
- Wire the mapped candidate events and alerts to the selected deployment sink, then prove delivery in staging.
- Execute the post-deploy smoke in the production hardening contract, including real TA launch exchange and log-redaction evidence.
- Confirm the final TalentArbor issuer/source values and launch-link redaction posture before logging any provider-specific metadata.
