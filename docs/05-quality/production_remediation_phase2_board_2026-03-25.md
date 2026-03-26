# Production Remediation Phase 2 Board

Date: 2026-03-25  
Source tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Source issue breakdown: [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)

---

## Phase Goal

Move from P0 hardening into the remaining maintainability and operability backlog without losing execution discipline.

This phase should:
- close the remaining P1 contract cleanup work cleanly
- move into durable metrics and basic operability planning
- set up the architecture cleanup work without reopening completed P0 decisions

---

## Phase Status

Status: Complete

Phase 2 remediation work is complete for the defined scope.

`P1-4` closed with:
- durable Supabase/Postgres rollups validated in production
- submit-outcome instrumentation landed for in-session progress reliability
- SQL-backed SLO summary functions validated in production
- recruiter ops route returning durable summary data via `sloSummary`

Threshold tuning and denominator refinement continue as normal ops policy work and do not keep this remediation phase open.

---

## Completed Active Item

### P1-4: Land Durable Metrics Path and SLO Base Layer

Owner: Platform / ops  
Status: Done

Current execution slice:
- baseline the current metrics path in:
  - `src/lib/server/metrics.ts`
  - `src/app/api/recruiter/ops/metrics/route.ts`
  - `src/lib/server/alerts.ts`
- choose a bounded durable sink strategy that does not force broad route/service churn
- preserve the current instrumentation surface where possible:
  - `incrementMetric`
  - `observeMetric`
  - `recordAuthDenial`
  - `recordRateLimitDenial`
- first code slice landed:
  - metrics backend abstraction
  - optional Supabase durable sink
  - durable rollup migration
  - durable-aware recruiter ops metrics read path
- deployed validation completed:
  - durable counter rollups confirmed in production
  - durable AI timing rollups confirmed in production
- define the minimum SLO/dashboard set for:
  - invite create/send
  - candidate session start/completion
  - AI success/error/malformed-response outcomes
  - auth denials and rate-limit denials
- initial SLO proposal is now documented in:
  - `docs/05-quality/initial_slos_2026-03-26.md`
- submit outcome instrumentation is now landed for the in-session progress SLO:
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
  - metric family: `session_submit_total`
- SQL-backed SLO summary functions are now landed in:
  - `supabase/migrations/20260325_add_metrics_rollups.sql`
- the recruiter ops metrics route now returns `sloSummary` in addition to the raw durable-aware snapshot
- document what remains local-only versus what must become durable for production operations

Completion target:
- metrics survive restart
- ops metrics are no longer tied to one process instance
- the minimum SLO set is documented and sourced from durable data

---

## P2 Active Queue

### P2-1: Continue Route-to-Application-Service Extraction

Owner: Backend / architecture  
Status: Done

Completed slice:
- use invite flow as the reference extraction pattern
- invite send/resend extraction is now landed
- session-start extraction is now landed
- the thin-route/application-service pattern is now established on the highest-value orchestration-heavy entry flows

### P2-2: Add Accessibility Automation For Critical Flows

Owner: Frontend / QA  
Status: Done

Completed slice:
- recruiter preview/send accessibility coverage is now in CI
- candidate landing accessibility coverage is now in CI
- current baseline covers focus, dismissal, alert announcements, and CTA gating behavior on critical recruiter/candidate entry surfaces

---

## Out Of Scope For This Phase Slice

Do not expand the first `P1-4` slice into:
- full observability vendor migration
- tracing rollout across every route
- alert-policy redesign beyond the minimum SLO set
- dashboard/UI redesign unrelated to durable metrics correctness

---

## Exit Criteria For P2 Follow-On Work

- [x] current in-memory metrics implementation is baselined
- [x] tracker and issue breakdown are updated to reflect the new active item
- [x] bounded durable sink direction is chosen
- [x] first durable backend slice is landed without widening instrumentation churn
- [x] durable write/read path is validated in the deployed environment
- [x] minimum SLO set is documented against real metric names
- [x] durable submit success/failure instrumentation is added for in-session progress reliability
- [x] updated metrics rollup migration with SLO summary functions is applied and validated in Supabase
- [ ] invite-family extraction is either closed or cleanly bounded to the next route family
- [x] recruiter preview/send accessibility assertions remain stable in CI
- [x] one bounded candidate-session accessibility slice is added
- [x] thin-route/application-service pattern is established on the main invite/session entry flows

---

## Operating Notes

- Keep the tracker as the canonical status source.
- Use the tracker and issue breakdown for any future P2 or ops-policy follow-on work.
