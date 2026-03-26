# Ops Alert Policy

Date: 2026-03-17

This document defines the current alert rules, routing, and operator intent for the Interview Coach Recruiter operational telemetry exposed by `/api/recruiter/ops/metrics`.

## Routing

| Route | Intended responder | Responsibility |
|---|---|---|
| `engineering-on-call` | Primary engineer on rotation | Immediate triage for live reliability incidents and abuse spikes |
| `backend-primary` | Backend owner / tech lead | Deep remediation, provider coordination, hotfix ownership |
| `product-owner` | Product/ops owner | Business impact assessment, recruiter communication, workflow hold/resume decisions |

## Alert Rules

### 1. Invite Delivery Failures
- Alert ID: `invite_delivery_failures`
- Severity:
  - `warning`: 3+ send failures in the current in-memory window
  - `critical`: 3+ send failures and failure rate >= 30%
- Routes:
  - `backend-primary`
  - `product-owner`

### 2. Authentication or Abuse Spike
- Alert ID: `auth_abuse_spike`
- Severity:
  - `warning`: auth denials >= 10
  - `critical`: rate-limit denials >= 10
- Routes:
  - `engineering-on-call`
  - `backend-primary`

### 3. AI Error Spike
- Alert ID: `ai_error_spike`
- Severity:
  - `warning`: AI errors >= 5
  - `critical`: AI errors >= 5 and aggregate AI error rate >= 20%
- Routes:
  - `engineering-on-call`
  - `backend-primary`

### 4. AI Latency Spike
- Alert ID: `ai_latency_spike`
- Severity:
  - `warning`: highest average AI operation latency >= 4000ms
  - `critical`: highest single-operation max latency >= 8000ms
- Routes:
  - `engineering-on-call`
  - `backend-primary`

### 5. Session Completion Stall
- Alert ID: `session_completion_stall`
- Severity:
  - `critical`: session starts >= 5 and completions == 0
- Routes:
  - `product-owner`
  - `backend-primary`

## Current Limitations

- Production still requires explicit durable-backend enforcement; `METRICS_BACKEND` can currently default to memory unless the deployment contract is tightened.
- Alerting is currently policy-driven and queryable through the ops snapshot endpoint; external paging integration validation is still pending.
- These thresholds are intentionally conservative and should be recalibrated once durable metrics history exists.

## Durable Metrics Transition Note

- A dual-write metrics path is now the chosen direction for `P1-4`.
- The first implementation slice has landed the durable backend abstraction and Supabase rollup migration.
- The recruiter ops metrics route now reads the durable-aware snapshot helper.
- Durable counter and timing rollups have been validated in production.
- Production release should still remain blocked until the deployment contract enforces the durable backend and the alert-to-paging route is validated.
- Thresholds should still be treated as provisional until the minimum SLO set is finalized and enough durable history exists for recalibration.

## SLO Alignment Note

- The current initial SLO proposal is documented in [initial_slos_2026-03-26.md](./initial_slos_2026-03-26.md).
- Until burn-rate style alerting is implemented, the alert rules in this document remain threshold-based operational heuristics rather than full SLO-budget enforcement.
