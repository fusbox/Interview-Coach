# Comprehensive Production-Readiness Code Review (Phase 1)

Date: 2026-03-25  
Reviewer stance: **Sr Architect/Engineer (production gate)** + **Mentor (Jr growth feedback)**  
Source request reference: `docs/05-quality/code_review_request.md` (the requested `docs/06-project/code_review_request.md` path is not present in this repository).

## Executive Verdict

- **Current release recommendation:** **NO-GO for production**.
- **Current staging recommendation:** **GO for controlled staging** with explicit risk acceptance and a short hardening sprint.
- **Overall grade (mentor lens):** **B-** — strong progress and solid fundamentals, but still notable gaps in operability, distributed-systems readiness, and domain boundary discipline.

---

## 1) Correctness & Edge Cases

### High-risk paths identified

1. **Invite creation is multi-write and non-transactional**: invite creation loops candidate-by-candidate and writes each session independently, which can create partial success states under mid-loop failures (network/db/email coupling risk). (`/api/recruiter/invites`).
2. **Rate-limit correctness is process-local**: rate limiting uses in-memory `Map` buckets, so limits reset across restarts and are not consistent across multiple server instances.
3. **Candidate token auth depends on environment shape**: candidate-token read/write path conditionally falls back to a non-admin Supabase client when service-role key is absent; behavior can drift between dev/staging/prod.
4. **Public-origin derivation trust can drift by environment**: invite link origin can come from env or request URL normalization. Misconfigured base URL can produce incorrect links.

### Hardening strategy

- Introduce a **transactional command** for invite/session creation across all candidate rows (or persist a batch job with resumable status + compensating actions).
- Move rate limiting to **shared backing store** (Redis/Postgres) with deterministic key semantics and TTL.
- Make service-role dependency explicit at startup with fail-fast validation for protected server operations.
- Centralize canonical app origin resolution in one trusted server utility with environment allowlist validation.

---

## 2) Readability & Maintainability

### Observations

- Positive: Domain/server structure and typed contracts are present; test naming is mostly meaningful.
- Risk: Some large UI screens still carry broad orchestration concerns and temporal state transitions in component scope, increasing cognitive load for future contributors.
- Risk: Hardcoded organization defaults are still present in recruiter create flow defaults, reducing portability and increasing hidden business assumptions.

### Refactor suggestions

- Continue decomposition of orchestration-heavy UI screens into explicit command hooks/service facades.
- Replace hardcoded organization defaults with config/profile-driven initialization.
- Consolidate repeated async error/reporting patterns into a shared mutation handler utility.

### PR checklist (maintainability)

- [ ] No new hardcoded business identity values in UI defaults.
- [ ] No multi-step flow logic added without a deterministic state-transition test.
- [ ] No route logic that couples validation, persistence, and provider side effects without structured command boundaries.

---

## 3) Architecture & Boundaries

### Current architecture health

- **Strength:** clear intent for domain, server infrastructure, and feature-oriented UI modules.
- **Gap:** route handlers still perform substantial orchestration that belongs in application services.
- **Gap:** cross-cutting concerns (idempotency, metrics, and error envelopes) are present but not uniformly abstracted behind one command pipeline.

### Recommended module responsibility map

- `domain/*`: state machine invariants and pure rules.
- `application/*`: command/query handlers (idempotency, retries, transactional policy).
- `infrastructure/*`: Supabase/provider adapters only.
- `interfaces/http/*`: auth, request parse/validate, response serialization.
- `features/*`: UX state + rendering only.

### Route extraction targets (concrete scope for "continue route → application-service extraction")

Priority routes to move from handler-heavy orchestration into application services:

1. `POST /api/recruiter/invites`
   - Why: combines auth, schema validation, idempotency, rate limiting, persistence loop, and link construction in one route.
   - Extract to: `application/invites/create-invite-batch.ts` (transaction + partial-failure policy + idempotent response assembly).

2. `POST /api/invite/send` and `POST /api/invite/resend`
   - Why: mixes transport concerns with provider/email orchestration and retry/error-policy logic.
   - Extract to: `application/invites/send-invite-emails.ts` and `application/invites/resend-invite.ts`.

3. `POST /api/session/[session_id]/questions/[question_id]/submit`
   - Why: carries idempotency + candidate auth + domain transition + persistence in a route-level flow.
   - Extract to: `application/session/submit-answer-command.ts` with explicit transition guardrail and response replay behavior.

4. `POST /api/session/[session_id]/questions/[question_id]/analysis`
   - Why: route coordinates AI orchestration, provider parsing, and session update behavior.
   - Extract to: `application/session/generate-analysis-command.ts` with provider abstraction + timeout/retry policy.

5. `POST /api/session/start`
   - Why: start/clone semantics, token issuance, and state initialization are business workflows rather than HTTP concerns.
   - Extract to: `application/session/start-session-command.ts` (new vs clone decisioning, token issuance contract, replay handling).

6. `POST /api/questions/generate` and `POST /api/response/generate`
   - Why: candidate/recruiter-side AI generation policy (prompts, moderation/fallback, telemetry) should be centralized.
   - Extract to: `application/ai/generate-questions.ts` and `application/ai/generate-response-feedback.ts`.

Boundary rule for all extractions:

- Route handlers should only do `auth → validate → call application command → map result to HTTP`.
- All retries, idempotency, transaction semantics, provider fallback, and domain transitions should live in application services.

---

## 4) Type Safety & Runtime Validation

### Observations

- Positive: Zod validation and typed response parsing are used in critical areas.
- Gap: several schemas still carry `z.any()` placeholders, weakening contract guarantees where strong schema narrowing is expected.

### Recommendations

- Replace `z.any()` with constrained schemas for competency/blueprint/rating structures.
- Add strict response-contract tests for APIs that currently permit broad payload variance.
- Raise invalid-provider/malformed-data scenarios into one typed error family to simplify caller behavior.

---

## 5) Security & Privacy

### Focused threat model (top risks)

1. **Distributed-rate-limit bypass risk** due to process-local limiter.
2. **Environment-dependent authorization behavior** in candidate token verification path.
3. **Potential metadata leakage in logs** (operationally useful, but could be over-verbose depending on log shipping and retention policies).

### Mitigations

- Shared distributed throttling store + keyed by recruiter/user/IP tuple.
- Startup contract checks for required auth/service env vars in production.
- Log policy pass for PII minimization and contextual redaction standards (especially for provider payloads and candidate-facing identifiers).

---

## 6) Performance & UX

### Prioritized optimization list

1. **P0:** Replace per-candidate sequential invite writes in-route with batched persistence or asynchronous job orchestration.
2. **P1:** Reduce UI-level orchestration churn in long session screens (move command semantics to hooks/services to reduce re-render trigger surface).
3. **P1:** Add response caching and bounded polling behavior review for session summary/analysis paths.

---

## 7) Testing Strategy

### Current assessment

- Baseline quality is good: lint/typecheck/unit suites pass and coverage appears broad for core server routes.
- Main gap is **failure-mode integration depth**, especially around partial-batch failures and multi-instance behavior.

### Minimum viable next test expansion

- Integration test for partial invite-batch failure + reconciliation behavior.
- Contract tests for canonical origin generation and invalid/missing app URL cases.
- Security tests asserting service-role-required behavior in production mode.
- Load-ish tests for shared throttling semantics once distributed limiter lands.

---

## 8) Observability & Operability

### Readiness assessment

- Positive: in-app metrics collection and ops route exist.
- Gap: metrics are process-memory backed, so dashboards can under-report across restarts/scale-out and do not provide durable history.

### Required upgrades before production

- Ship metrics/events to durable backend (e.g., OTEL + vendor, or DB-backed rollups).
- Define SLOs with alert thresholds tied to paging policy.
- Add correlation between route errors, provider failures, and candidate session impacts.

### Durable metrics implementation (what this should mean in practice)

Target outcome: **metrics survive restarts, horizontal scaling, and deploy rollovers**, and can be queried historically for incident analysis and release gates.

Recommended implementation path (incremental):

1. **Instrumentation standardization**
   - Keep current metric names, but emit through a shared telemetry interface (counter/histogram/gauge/event) instead of direct in-memory mutation only.
   - Attach stable labels: `route`, `operation`, `actorType`, `outcome`, `provider`, `env`, `buildSha`.

2. **Export + storage**
   - Export metrics via OTLP (OpenTelemetry) or a managed agent to a durable backend (Datadog/New Relic/Grafana Cloud/Prometheus+Mimir/CloudWatch).
   - For audit-grade product analytics, also persist key domain events in DB tables (append-only) with retention and partitioning policy.

3. **Dashboards with release-gate views**
   - Build dashboards for:
     - API reliability by route (`5xx`, `4xx`, latency p95/p99),
     - AI provider reliability (error rate + latency by operation),
     - Candidate funnel health (start → submit → complete conversion),
     - Security posture (auth denials, rate-limit denials).
   - Include deploy markers (`buildSha`) so regressions can be tied to releases.

4. **Retention + cardinality guardrails**
   - Keep low-cardinality labels only (never raw user/session IDs in metric labels).
   - Retain high-resolution data (e.g., 7–14 days) and rolled-up data (e.g., 90+ days).

5. **Runbook linkage**
   - Every critical dashboard panel should link to incident runbook sections and owner/on-call rotation.

### SLO-backed alerting (what this should mean in practice)

Target outcome: alerting is driven by **user-impact objectives**, not ad-hoc thresholds.

Recommended initial SLO set for this product:

1. **Session start availability SLO**
   - SLI: successful `/api/session/start` responses ÷ total valid requests.
   - Target: 99.5% over 30 days.
   - Alerting: multi-window burn-rate alerts (fast + slow), page on-call only when error-budget burn indicates real risk.

2. **Submit reliability SLO**
   - SLI: successful question submit mutations (including idempotent replay success) ÷ total submit attempts.
   - Target: 99.0% over 30 days.
   - Alerting: warn on sustained degradation; page when burn rate exceeds critical threshold.

3. **AI response latency SLO**
   - SLI: p95 latency for AI-backed generation endpoints.
   - Target: p95 < 3.5s (or role-specific baseline) over rolling 7 days.
   - Alerting: ticket-level for mild breach, page-level when p95 and error-rate breach together.

4. **Invite delivery success SLO**
   - SLI: successful invite send operations ÷ send attempts.
   - Target: 99.0% over 30 days.
   - Alerting: page only when sustained failure impacts active recruiters; otherwise route to business-hours queue.

Alert policy model:

- **Page** only on user-impacting, budget-burning incidents.
- **Ticket/Slack** for early degradation, non-urgent trend drift, and capacity planning.
- **Auto-resolve** when signal clears for a stable window.

Operationalization checklist:

- Define SLI query per SLO in telemetry backend.
- Set error-budget policy (freeze releases if budget is exhausted).
- Wire alert routes to on-call schedule and escalation chain.
- Validate alert quality with game days (inject controlled failures).

---

## 9) Accessibility & Polish

### Immediate punch list

- Add explicit keyboard/focus E2E checks for recruiter create + multi-step session flows.
- Expand `aria-live` and error-announcement verification in async transitions.
- Add an accessibility CI check pass (axe/lighthouse or Playwright accessibility assertions).

---

## 10) Documentation & Repo Hygiene

### Professional repo checklist

- [x] Core scripts exist and are runnable (`lint`, `typecheck`, `test:run`).
- [x] Significant route-level tests exist for critical APIs.
- [ ] Add explicit architecture decision records for current app/service boundary split.
- [ ] Add operational readiness runbook section for multi-instance deployment assumptions (rate limits + metrics durability).
- [ ] Add release gate checklist tied to severity levels below.

---

## Severity Board

### P0 (must fix before production)

1. Replace process-local rate limiting with distributed/shared limiter.
2. Move invite creation to transaction-safe command flow with deterministic partial-failure handling.
3. Make production auth dependency contract explicit (service-role/env validation + startup fail-fast).

### P1 (next sprint)

1. Remove residual hardcoded business defaults in recruiter flow.
2. Tighten `z.any()` schema sections.
3. Expand operability with durable metrics and SLO-backed alerting.

### P2 (quality uplift)

1. Continue route → application-service extraction for cleaner boundaries.
2. Add deeper accessibility automation and UX consistency checks.

---

## Mentor Feedback (to a Jr Developer)

You’ve done many things right: typed contracts, meaningful tests, and progressive hardening around idempotency/security. The project now looks like a serious product codebase, not a prototype.

To move from “good project” to “production-grade system,” focus on distributed-systems realities:

- process-local protections are not production protections,
- multi-write flows need transactional semantics,
- observability must survive restarts and scale-out.

If you tackle the P0 list above in one focused sprint, this can be promoted to a much stronger production-candidate posture.
