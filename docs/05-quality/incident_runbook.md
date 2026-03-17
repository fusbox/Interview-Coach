# Incident Runbook

Date: 2026-03-17

Primary data source: `/api/recruiter/ops/metrics`

Use this runbook when one of the current operational alerts is triggered. Each section assumes structured logs and the metrics snapshot endpoint are available.

## 1. Invite Delivery Failures

Alert ID: `invite_delivery_failures`

### Symptoms
- Recruiters report that invite sends fail or stall.
- `dashboard.invites.sendFailures` rises quickly.
- Logs show `INVITE_SEND_FAILED` or provider errors from `EmailService`.

### Immediate actions
1. Open `/api/recruiter/ops/metrics` and confirm `sendFailures`, `sendSuccesses`, and failure rate.
2. Check recent structured logs for `InviteAPI` and `EmailService`.
3. Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are still present in the deployment environment.
4. If failures correlate to provider outage, pause bulk recruiter sends and notify the product owner.

### Likely causes
- Resend outage or invalid API key
- malformed provider response
- invite payload regression

### Mitigation
- Restore/rotate Resend credentials if missing or invalid.
- If provider outage persists, communicate temporary degraded state and retry later.
- Roll back the most recent invite/email change if failures began immediately after deploy.

## 2. Authentication or Abuse Spike

Alert ID: `auth_abuse_spike`

### Symptoms
- `dashboard.security.authDenials` or `dashboard.security.rateLimitDenials` climbs sharply.
- Logs show repeated `RATE_LIMITED`, missing candidate token, or invalid token failures.

### Immediate actions
1. Confirm which routes are driving denials from the metrics snapshot and structured logs.
2. Check if the spike is recruiter-side, candidate-side, or a public endpoint abuse pattern.
3. Review recent deploys affecting auth middleware, candidate token handling, or rate limits.

### Likely causes
- scripted probing of candidate routes
- broken client token propagation
- overly aggressive throttles after a front-end retry regression

### Mitigation
- If abuse is external, keep throttles in place and monitor for spread.
- If the client is misbehaving, hotfix the offending retry loop or header propagation bug.
- If legitimate traffic is being blocked, tune thresholds after confirming the root cause.

## 3. AI Error Spike

Alert ID: `ai_error_spike`

### Symptoms
- `dashboard.ai.errors` rises above baseline.
- One or more AI operations show elevated error counts.
- Logs show provider failures from `analysis`, `question_generation`, `strong_response`, `tips`, `tts`, or `session_summary`.

### Immediate actions
1. Inspect `dashboard.ai.operations` to isolate the failing operation.
2. Check structured logs for provider parsing errors versus upstream request failures.
3. Verify `GEMINI_API_KEY` and provider reachability.

### Likely causes
- Gemini provider outage or latency cascade
- schema drift in provider response
- malformed request payload escaping client validation

### Mitigation
- If only one operation is failing, narrow triage to that route/service pair.
- If failures are platform-wide, switch to existing mock/degraded behavior where available and communicate degraded service status.
- Roll back the latest AI prompt/contract change if errors started immediately after deploy.

## 4. AI Latency Spike

Alert ID: `ai_latency_spike`

### Symptoms
- `dashboard.ai.operations[].avgLatencyMs` or `maxLatencyMs` exceeds threshold.
- Candidate or recruiter flows feel stalled but do not necessarily hard-fail.

### Immediate actions
1. Identify the slowest AI operation from the metrics snapshot.
2. Check whether the latency is isolated to one route or systemic across all AI operations.
3. Review recent prompt size changes, added context, or synchronous chaining in request handlers.

### Likely causes
- provider-side slowdown
- prompt growth or oversized request bodies
- synchronous follow-on work in the route path

### Mitigation
- Reduce request payload size or prompt context if a recent change inflated it.
- Shift non-essential work off the critical path where possible.
- If provider latency is external, communicate degraded performance and monitor for recovery.

## 5. Session Completion Stall

Alert ID: `session_completion_stall`

### Symptoms
- `dashboard.sessions.starts` increases while `dashboard.sessions.completions` remains zero.
- Recruiters report candidates starting but not finishing sessions.

### Immediate actions
1. Verify whether the stall is total or limited to repeat-practice or a specific session state.
2. Check structured logs around `SessionAPI`, submit flows, analysis, and summary generation.
3. Validate that candidate tokens, submit idempotency, and session transitions are still working.

### Likely causes
- broken submit/next flow
- candidate auth/header propagation regression
- AI failure causing session progress to dead-end

### Mitigation
- Reproduce with a fresh magic link and a repeat-practice path.
- If progression is broken, prioritize restoring submit/next continuity even if analysis/debrief is temporarily degraded.
- Roll back recent session mutation or client orchestration changes if necessary.

## Incident Notes Template

- Time detected:
- Alert ID:
- Severity:
- Primary responder:
- User-visible impact:
- Root cause:
- Mitigation applied:
- Follow-up remediation:
