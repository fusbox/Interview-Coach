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

## Active Item

### P1-4: Land Durable Metrics Path and SLO Base Layer

Owner: Platform / ops  
Status: In Progress

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
- define the minimum SLO/dashboard set for:
  - invite create/send
  - candidate session start/completion
  - AI success/error/malformed-response outcomes
  - auth denials and rate-limit denials
- document what remains local-only versus what must become durable for production operations

Completion target:
- metrics survive restart
- ops metrics are no longer tied to one process instance
- the minimum SLO set is documented and sourced from durable data

---

## Ready Queue

### P1-3: Tighten Runtime Schemas

Owner: Backend / AI contracts  
Status: Done

Completed slice:
- removed broad `z.any()` from the critical provider/domain paths
- consolidated high-value recruiter/candidate route request contracts into shared domain schemas
- classified malformed provider output consistently across the main AI/service/route seams

### P2-1: Continue Route-to-Application-Service Extraction

Owner: Backend / architecture  
Status: Ready after P1-4 baseline

First slice:
- use invite flow as the reference extraction pattern
- identify the next route family with enough orchestration weight to justify extraction

---

## Out Of Scope For This Phase Slice

Do not expand the first `P1-4` slice into:
- full observability vendor migration
- tracing rollout across every route
- alert-policy redesign beyond the minimum SLO set
- dashboard/UI redesign unrelated to durable metrics correctness

---

## Exit Criteria For Active Slice

- [x] current in-memory metrics implementation is baselined
- [x] tracker and issue breakdown are updated to reflect the new active item
- [x] bounded durable sink direction is chosen
- [x] first durable backend slice is landed without widening instrumentation churn
- [ ] minimum SLO set is documented against real metric names

---

## Operating Notes

- Keep the tracker as the canonical status source.
- Use this board for active sequencing and immediate next actions.
- Update this board in place while `P1-4` remains the active slice unless the phase shape changes materially.
