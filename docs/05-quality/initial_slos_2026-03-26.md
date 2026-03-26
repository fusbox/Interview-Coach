# Initial SLO Proposal

Date: 2026-03-26  
Related tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Related metrics plan: [durable_metrics_plan_2026-03-25.md](./durable_metrics_plan_2026-03-25.md)

---

## Purpose

Define the first SLO set for the Interview Coach Recruiter product using the durable metrics now validated in production.

This document is intentionally narrow:

- it focuses on user-relevant reliability objectives
- it maps those objectives to the current metric names in the codebase
- it distinguishes SLOs from supporting operational indicators

---

## SLO Design Principles

1. Start from user journeys, not raw endpoint counts.
2. Keep the first SLO set small enough to operate.
3. Use durable, low-cardinality metrics only.
4. Treat malformed provider output as failure for AI reliability.
5. Keep rate-limit denials and auth denials as supporting indicators, not primary SLOs.

---

## Proposed Initial SLO Set

### SLO 1: Session Start Availability

User promise:

- a candidate with a valid link can start a practice session successfully

SLI:

- numerator:
  - `session_start_total` where `outcome = success`
- denominator:
  - all valid session start attempts

Current metric source:

- `session_start_total`

Target:

- `99.5%` over 30 days

Why this belongs in the first set:

- it is the top of the candidate funnel
- a failure here blocks the entire product experience

Operational notes:

- malformed client requests and unauthorized probes should stay out of the denominator
- rate-limited or server-failed valid attempts should count as failures

---

### SLO 2: In-Session Progress Reliability

User promise:

- once the session has started, the candidate can continue through the interview without losing progress

SLI:

- numerator:
  - successful answer submit mutations, including idempotent replay success
- denominator:
  - all valid answer submit attempts

Current metric source:

- `session_submit_total`

Current metric shape:

- `outcome`
- `analysisIncluded`

Current included outcomes:

- `success`
- `replay_success`
- `invalid_request`
- `request_in_progress`
- `idempotency_mismatch`
- `error`

Suggested target:

- `99.0%` over 30 days

Why this belongs in the first set:

- progress loss is a direct user-impacting failure
- it is more important than most read-only dashboard metrics

---

### SLO 3: AI Assist Reliability

User promise:

- AI-backed candidate assistance returns a usable result when invoked

SLI:

- numerator:
  - `ai_requests_total` where `outcome = success`
  - optionally `mock_fallback` only if product explicitly treats that as acceptable user experience
- denominator:
  - all AI requests:
    - `success`
    - `error`
    - `malformed_response`
    - `mock_fallback` if present

Current metric source:

- `ai_requests_total`

Target:

- `99.0%` over 30 days

Important classification rule:

- `malformed_response` counts as failure
- generic `error` counts as failure
- `mock_fallback` must be explicitly classified by product/engineering policy

Recommended initial policy:

- for production, do not treat `mock_fallback` as success

Why this belongs in the first set:

- AI assistance is a core product capability, not a peripheral enhancement

---

### SLO 4: AI Assist Latency

User promise:

- AI-backed assistance returns within an acceptable experience window

SLI:

- p95 latency for `ai_request_duration_ms`

Current metric source:

- `ai_request_duration_ms`

Initial operation views:

- `analysis`
- `session_summary`
- `strong_response`
- `tips`
- `tts`

Initial target posture:

- track per operation from the durable rollups immediately
- use the first durable history window to confirm thresholds before enforcing a hard release-gate threshold across every operation

Proposed starting objective:

- p95 under `3.5s` for lighter assistance operations where practical
- allow temporary operational tracking-only status for heavier operations like `analysis` and `session_summary` until enough durable history exists

Why this belongs in the first set:

- latency is directly user-visible in this product
- reliability without usable response time is not good enough

---

## Supporting Operational Indicators, Not Primary SLOs

These should remain in dashboards and alerts, but not as top-level product SLOs yet:

- `auth_denials_total`
- `rate_limit_denials_total`
- invite create partial failures as raw counts
- recruiter dashboard read-path behavior

Why:

- they are important, but they describe support, abuse, or operator posture more than a user promise

---

## Metric Mapping Table

| Objective | Metric(s) | Required tags | Status |
|---|---|---|---|
| Session start availability | `session_start_total` | `outcome`, `mode` | Ready |
| In-session progress reliability | `session_submit_total` | `outcome`, `analysisIncluded` | Ready for durable query/dashboard wiring |
| AI assist reliability | `ai_requests_total` | `operation`, `outcome`, optional `provider` | Ready |
| AI assist latency | `ai_request_duration_ms` | `operation`, optional `provider` | Ready |
| Security posture | `auth_denials_total`, `rate_limit_denials_total` | route/scope/actor tags as available | Supporting only |

---

## Alerting Guidance

Page-worthy candidates:

- sustained burn against session start availability
- sustained burn against AI reliability where candidate coaching is materially degraded
- severe session funnel stall

Ticket/Slack-only candidates:

- isolated malformed-response spikes below burn threshold
- early AI latency degradation without matching reliability impact
- auth/rate-limit spikes that do not appear to block legitimate traffic

---

## Release-Gate Guidance

For the current stage of the product:

- `Session Start Availability` and `AI Assist Reliability` should influence release decisions first
- `AI Assist Latency` should initially influence release decisions only when paired with visible user degradation
- `In-Session Progress Reliability` can move toward a hard gate once durable query/dashboard wiring is added and the denominator policy is finalized

---

## Remaining Work To Fully Operationalize These SLOs

1. Create explicit durable queries or dashboard views for the four SLOs above.
2. Finalize the denominator policy for `session_submit_total`, especially whether `invalid_request` and `idempotency_mismatch` remain outside the SLI denominator.
3. Update alert policy thresholds from provisional counts to SLO/burn-oriented guidance where possible.
4. Update the incident runbook to use the new SLO terminology during triage.

Current implementation status:

- the app now has SQL-backed SLO summary functions for the four objectives above
- the recruiter ops metrics route returns `sloSummary` as a thin operational summary surface
- the remaining work is production validation of the new SQL functions plus denominator/threshold policy finalization

---

## Decision Summary

Recommended initial SLO set:

1. Session Start Availability
2. In-Session Progress Reliability
3. AI Assist Reliability
4. AI Assist Latency

This is intentionally small. It covers the core candidate experience without overcommitting to secondary or operator-only signals.
