# Durable Metrics Plan

Date: 2026-03-25  
Primary tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Related review: [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)

---

## Purpose

Define the bounded implementation plan for `P1-4`: make operational metrics durable without forcing a broad instrumentation rewrite.

---

## Current Baseline

Current metrics behavior:

- [metrics.ts](../../src/lib/server/metrics.ts) stores counters and timings in process-local `globalThis` maps.
- [ops metrics route](../../src/app/api/recruiter/ops/metrics/route.ts) returns only the local process snapshot and derived dashboard.
- [alerts.ts](../../src/lib/server/alerts.ts) evaluates alert conditions from that local snapshot.

Current limitations:

- metrics are lost on process restart
- metrics do not aggregate across instances
- deploy rollovers fragment operational history
- ops views are useful for local inspection but not durable incident analysis or release-gate reporting

---

## Decision

Use a **dual-write** metrics path for the first durable implementation.

Recommended shape:

1. Keep the existing in-memory metrics API and local snapshot behavior for dev/test ergonomics.
2. Add a durable Postgres/Supabase-backed sink for staging/production writes.
3. Preserve the current call sites:
   - `incrementMetric`
   - `observeMetric`
   - `recordAuthDenial`
   - `recordRateLimitDenial`
4. Keep the recruiter ops route, but move its durable view to read from persisted rollups instead of one process-local map.

Why this approach:

- bounded implementation surface
- consistent with the repo's existing Postgres/Supabase operational posture
- avoids a premature observability-platform migration
- solves the production-readiness gap identified in the review

---

## Explicit Non-Goals

This first `P1-4` slice should not become:

- a full tracing rollout
- a vendor-wide observability migration
- recruiter-facing analytics redesign
- append-only product event analytics for every domain action

Those may be valid future investments, but they are not required to close the current operability gap.

---

## Implementation Direction

### 1. Keep the current metrics API stable

The rest of the codebase should not need widespread changes.

Target:

- the current instrumentation calls remain valid
- sink selection happens inside the metrics module or behind a small backend abstraction

### 2. Introduce a durable sink abstraction

Planned modules:

- `src/lib/server/metrics/backend.ts`
- `src/lib/server/metrics/types.ts`

Candidate interface:

```ts
type MetricWrite =
  | { kind: "counter"; name: string; value: number; tags: Record<string, string>; recordedAt: string }
  | { kind: "timing"; name: string; durationMs: number; tags: Record<string, string>; recordedAt: string };

interface MetricsBackend {
  writeCounter(name: string, value: number, tags: Record<string, string>): Promise<void>;
  writeTiming(name: string, durationMs: number, tags: Record<string, string>): Promise<void>;
}
```

### 3. Use dual-write by environment

- local/test:
  - in-memory only by default
- staging/production:
  - in-memory + durable Postgres sink

This keeps the existing ops/debug ergonomics while making production metrics durable.

### 4. Persist bounded, low-cardinality metrics only

Required label rules:

- allow:
  - `route`
  - `operation`
  - `actorType`
  - `outcome`
  - `provider`
  - `env`
  - `buildSha`
- do not allow:
  - raw user IDs
  - raw session IDs
  - candidate emails
  - free-form text labels

### 5. Prefer rollups over unbounded raw event storage for the first slice

Recommended initial storage model:

- time-bucketed metric rollups
- dimensions:
  - metric name
  - normalized tags
  - minute or five-minute bucket
- values:
  - counter totals
  - timing count/total/min/max

This is enough for:

- restart-safe dashboards
- release-gate trend checks
- alert evaluation

without introducing unbounded event-table growth on day one.

---

## Minimum SLO Set

The first durable dashboard/SLO set should cover:

1. Session start availability
   - source metric: `session_start_total`
   - dimensions: `outcome`

2. Invite create/send reliability
   - source metrics:
     - `recruiter_invite_create_total`
     - `invite_send_total`
   - dimensions: `outcome`

3. AI reliability
   - source metric: `ai_requests_total`
   - dimensions:
     - `operation`
     - `outcome`
     - `provider`

4. AI latency
   - source metric: `ai_request_duration_ms`
   - dimensions:
     - `operation`
     - `provider`

5. Security posture
   - source metrics:
     - `auth_denials_total`
     - `rate_limit_denials_total`

---

## First Code Slice

1. Add metrics backend abstraction.
2. Add Supabase/Postgres durable backend.
3. Keep in-memory writes for local snapshot compatibility.
4. Add configuration for backend selection.
5. Update ops metrics route to read durable rollups for staging/production.
6. Add tests for:
   - backend selection
   - counter/timing dual-write behavior
   - durable rollup reads
   - ops route durable snapshot behavior

---

## Risks And Guardrails

### Risk: scope creep into full observability migration

Guardrail:

- do not introduce tracing or vendor-specific telemetry in this slice

### Risk: high-cardinality writes

Guardrail:

- normalize and restrict tags before durable writes

### Risk: dual sources of truth becoming inconsistent

Guardrail:

- treat in-memory metrics as dev/local introspection only
- treat durable rollups as the production operational source

### Risk: write amplification on hot paths

Guardrail:

- use bounded rollup writes rather than unbounded raw event rows for all metrics

---

## Exit Criteria

`P1-4` is complete when:

- staging/production metrics survive restart and deploy rollover
- multi-instance writes contribute to one durable operational view
- the recruiter ops metrics view is backed by durable data in production
- the minimum SLO set is documented against actual metric names
- runbook and alert-policy docs are updated to reflect the durable path
