# Remediation Execution Plan (Stepwise)

Date: 2026-03-17  
Source inputs synthesized:
- `docs/05-quality/code_review_request.md`
- `docs/05-quality/comprehensive_code_review.md`

## 0) Objective, Scope, and Exit Criteria

### Objective
Execute a sequenced remediation program that moves the project from "not production-ready" to "production-capable" with measurable quality gates.

### Scope
Covers all findings in the prior review across:
1. Correctness and race conditions
2. Security/privacy hardening
3. Architecture boundary cleanup
4. Type/runtime validation
5. Performance/UX stability
6. Testing expansion
7. Observability/operability
8. Accessibility and repo hygiene

### Program Exit Criteria (Definition of Done)
- No Critical severity findings remain open.
- Concurrency test suite is green and stable across repeated runs.
- Authentication/authorization and rate limiting are enforced on all mutation endpoints.
- CI enforces lint + typecheck + unit/integration tests.
- Baseline telemetry and operational alerts are active.
- Production readiness review signs off with GO decision.

---

## 1) Workstream Structure and Ownership

## WS-A: Security & Privacy Hardening
**Owner:** Backend Lead  
**Support:** DevOps/SRE, Product Security

## WS-B: Correctness & Concurrency Stabilization
**Owner:** Senior Full-Stack Engineer  
**Support:** QA Engineer

## WS-C: Architecture & Maintainability Refactor
**Owner:** Tech Lead  
**Support:** Frontend + Backend engineers

## WS-D: Testing Maturity
**Owner:** QA/SET Lead  
**Support:** feature developers

## WS-E: Observability & Operations
**Owner:** SRE/Platform Engineer  
**Support:** Backend lead

## WS-F: Accessibility & Documentation Hygiene
**Owner:** Frontend Lead + Engineering Manager  
**Support:** Product/Design

---


## 1.1) Workstream × Phase Mapping (Not 1:1)

Use this matrix to track **ownership lanes (workstreams)** against **time windows (phases)**.

| Workstream | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---|---|---|---|---|---|---|
| **WS-A Security & Privacy** | **Primary:** endpoint inventory, auth/rate limits, error sanitization | Support: idempotency guardrails | Support: validation coverage for mutable routes | Support: security integration tests + CI gates | Support: auth/rate-limit telemetry | Support: docs/security standards updates |
| **WS-B Correctness & Concurrency** | Support: identify P0 race paths | **Primary:** state machine, mutex/single-flight, atomic engagement | Support: mapper/contract correctness hardening | **Primary support:** concurrency regression suites | Support: operational signals for reliability | Support: architectural follow-through in split modules |
| **WS-C Architecture & Maintainability** | Support: risk containment shape | Support: formal transition boundaries | Support: contract/module tightening | Support: testability improvements for refactors | Support: logger standardization consistency | **Primary:** mutation-layer split + boundary cleanup |
| **WS-D Testing Maturity** | Support: add bypass/security regression tests | Support: race-condition deterministic tests | Support: schema/mapper contract tests | **Primary:** pyramid baseline + CI enforcement | Support: alert simulation checks | Support: docs validation by fresh setup |
| **WS-E Observability & Operations** | Support: correlation IDs in error envelope | Support: reliability event definitions | Support: validation failure observability | Support: CI signal reporting | **Primary:** structured logs, metrics, alerts, runbooks | Support: operational docs polish |
| **WS-F Accessibility & Docs Hygiene** | Support: compliance notes in matrix/checklists | Support: UX risk notes from concurrency changes | Support: docs for new contracts | Support: testing/readme alignment | Support: runbook readability and incident docs | **Primary:** a11y sweep + README/env/CONTRIBUTING updates |

Legend:
- **Primary** = owning workstream for that phase deliverables.
- **Support** = contributing workstream with dependent tasks.

## 2) Sequenced Execution Plan (Detailed)

## Phase 1 (Week 1): Production Risk Containment
Goal: eliminate immediate exploit/reliability risks before broader refactor.

### Step 1.1 — Endpoint Security Inventory
- Enumerate all API routes and classify by method + mutability + actor type.
- Produce endpoint matrix: auth required, role required, rate-limit policy, request schema, response schema.
- Mark routes with missing controls as P0.

**Deliverables**
- `docs/05-quality/security_endpoint_matrix.md`
- P0 issue list with owners and deadlines.

**Acceptance Criteria**
- 100% of routes inventoried.
- Every mutating route has explicit authn/authz decision.

### Step 1.2 — Remove Runtime Dev Bypass Paths
- Remove development-only auth bypass logic from server routes.
- Replace with local mock/stub configuration only available in local development tooling.
- Add test to verify bypass cannot be activated in non-dev env.

**Acceptance Criteria**
- No production code path allows anonymous mutation via dev bypass.
- Regression test fails if bypass reappears.

### Step 1.3 — Protect Invite/Email Mutation Surfaces
- Enforce authenticated recruiter identity.
- Add per-IP and per-user rate limits (burst + sustained).
- Add abuse guardrails: recipient count caps, domain denylist/allowlist policy, request correlation IDs.

**Acceptance Criteria**
- Unauthorized requests return 401/403.
- Rate-limit violation returns 429 consistently.
- Abuse metrics available in logs/dashboard.

### Step 1.4 — Public Error Contract Sanitization
- Replace raw error passthrough with normalized envelope:
  - `code`, `message`, `correlationId`, `retryable`.
- Ensure internal stack traces are never returned to clients.

**Acceptance Criteria**
- All API errors conform to envelope.
- Security review confirms no sensitive details in responses.

---

## Phase 2 (Week 1–2): Concurrency and Data Integrity Fixes
Goal: stabilize high-risk interview session state transitions.

### Step 2.1 — Formalize Session State Machine
- Define allowed status transitions in one domain module.
- Reject illegal transitions centrally.
- Add state-transition unit tests.

**Acceptance Criteria**
- Transition table exists and is enforced on mutation paths.
- 100% transition rules covered by unit tests.

### Step 2.2 — Introduce Command Mutex / Single-Flight in Session Mutations
- Implement one in-flight command policy per session for submit/next/retry/start.
- Add cancellation/ignore semantics for stale commands.
- Ensure optimistic updates have deterministic rollback or re-fetch reconcile.

**Acceptance Criteria**
- Race-condition tests for submit/next overlap pass repeatedly.
- No duplicate network mutation for repeated user click during lock window.

### Step 2.3 — Atomic Engagement Tracking
- Replace read-modify-write JSON merge with DB atomic increment strategy.
- Add conflict-safe persistence method (SQL update expression or RPC).

**Acceptance Criteria**
- Concurrent engagement updates do not lose increments.
- Integration test validates final total under parallel calls.

### Step 2.4 — Idempotency for Critical Mutations
- Add `Idempotency-Key` support to invite creation and submit flows.
- Persist short-lived key ledger with response replay semantics.

**Acceptance Criteria**
- Duplicate requests with same key return same result.
- No duplicate side effects across retries/timeouts.

---

## Phase 3 (Week 2): Validation and Contract Hardening
Goal: remove undefined behavior and schema drift.

### Step 3.1 — Full Request Validation Coverage
- Add schema parse/guard for every mutable route.
- Fail fast with 400 + structured validation errors.

### Step 3.2 — Response Validation for External Providers
- Wrap AI/email provider outputs with runtime schema checks.
- Convert provider failures into typed domain errors.

### Step 3.3 — Repository Mapper Hardening
- Add defensive mappers for nullable DB fields.
- Introduce mapper tests with malformed/partial rows.

**Acceptance Criteria (Phase 3)**
- 100% mutating endpoints have request schema.
- External response parsing failures are handled and observable.

---

## Phase 4 (Week 2–3): Test Strategy Expansion and CI Gating
Goal: establish confidence and prevent regression.

### Step 4.1 — Build Test Pyramid Baseline
- Unit: domain transitions, selectors, mappers.
- Hook/component: session mutation concurrency, create flow state effects.
- API integration: auth, validation, idempotency, error envelope.
- E2E smoke: recruiter invite -> candidate complete -> recruiter review.

### Step 4.2 — Flake Reduction and Stability Runs
- Add deterministic mocks for network/clock where applicable.
- Run race-condition suites in repeated mode (e.g., 20x loop).

### Step 4.3 — Enforce CI Quality Gates
- CI must block merges on:
  - lint
  - typecheck
  - unit/integration suites
  - minimum coverage threshold

**Acceptance Criteria (Phase 4)**
- No failing test files in default CI profile.
- Flake rate below agreed threshold (target <1%).

---

## Phase 5 (Week 3): Observability and Incident Readiness
Goal: make production failures detectable, diagnosable, and actionable.

### Step 5.1 — Structured Logging Standard
- Standard fields: `timestamp`, `level`, `correlationId`, `route`, `actorType`, `sessionId`, `errorCode`.
- Replace ad-hoc `console.*` in server routes with logger wrapper.

### Step 5.2 — Metrics and Dashboards
- Emit counters/latencies for:
  - invite send success/failure
  - session completion funnel
  - AI call error/latency
  - auth/rate-limit denials

### Step 5.3 — Alert Rules and Runbooks
- Define alert thresholds and on-call routing.
- Add runbook for top 5 incident classes.

**Acceptance Criteria (Phase 5)**
- Dashboard available for core SLIs.
- Alert simulation confirms trigger + routing.

---

## Phase 6 (Week 3–4): Architecture Cleanup, A11y, and Repo Professionalization
Goal: reduce long-term maintenance burden and improve developer onboarding.

### Step 6.1 — Refactor Session Mutation Layer
- Split oversized mutation hook into:
  - lifecycle module
  - answering module
  - navigation module
  - telemetry module
- Keep UI hooks thin; move business rules to application/domain layer.

### Step 6.2 — Accessibility Pass
- Keyboard-only workflow audit for recruiter create and candidate session.
- Add/verify `aria-live` for async errors.
- Validate focus management after async actions and modal transitions.

### Step 6.3 — Documentation and Standards
- Update README status and accurate scripts.
- Add env var matrix and security notes.
- Add CONTRIBUTING.md with commit/PR conventions and checklist.

**Acceptance Criteria (Phase 6)**
- A11y punch-list items closed.
- New contributors can run app + tests from docs without tribal knowledge.

---

## 3) Granular Backlog Template (Per Ticket)

Use this template for each remediation task:

- **Title:** concise, imperative
- **Severity:** Critical/High/Medium/Low
- **Workstream:** WS-A..WS-F
- **Problem Statement:** what risk exists now
- **Scope:** in/out boundaries
- **Implementation Steps:** explicit numbered actions
- **Tests:** unit/integration/e2e additions
- **Telemetry:** logs/metrics/alerts changed
- **Rollback Plan:** how to revert safely
- **Acceptance Criteria:** objective checks
- **Dependencies:** upstream/downstream tasks
- **Owner + Reviewer:** named roles

---

## 4) Tracking, Governance, and Cadence

### Cadence
- Daily 15-min remediation standup.
- Twice-weekly architecture/security checkpoint.
- End-of-week quality gate review.

### Reporting Dashboard (weekly)
- Open critical/high findings count.
- Test pass rate and flake rate.
- Auth/rate-limit coverage % on mutable endpoints.
- Incident/alert count and MTTR trend.

### Governance Gates
- **Gate A (end Week 1):** security containment complete.
- **Gate B (end Week 2):** concurrency + validation stable.
- **Gate C (end Week 3):** CI/observability production baseline ready.
- **Gate D (end Week 4):** final production readiness review and sign-off.

---

## 5) Risk Register for Remediation Program

1. **Refactor introduces new regressions**  
   Mitigation: lock behavior with characterization tests first.

2. **Rate limiting impacts legitimate bulk recruiter workflows**  
   Mitigation: define role-based quotas + graceful backoff messaging.

3. **Telemetry overhead adds noise/cost**  
   Mitigation: sample non-critical events and cap payload sizes.

4. **Timeline pressure skips test depth**  
   Mitigation: make CI gate non-negotiable for Critical/High work.

---

## 6) Immediate Next 10 Actions (Start Tomorrow)

1. Create security endpoint matrix.
2. Remove runtime dev auth bypass.
3. Add auth guard to invite/email mutation routes.
4. Add rate limiting middleware for mutation routes.
5. Implement standardized API error envelope.
6. Define and codify session state transition table.
7. Fix submit/next mutex behavior and add deterministic tests.
8. Implement atomic engagement increment strategy.
9. Add idempotency key support for invite and submit endpoints.
10. Turn CI into required merge gate with lint/typecheck/tests.

---

## 7) Sign-off Checklist (Release Readiness)

- [ ] Critical findings closed.
- [ ] High findings have approved mitigation or completion.
- [ ] No known exploitable auth bypasses.
- [ ] Concurrency/race tests pass reliably.
- [ ] Error responses sanitized and correlated.
- [ ] Dashboards and alerts active.
- [ ] Documentation updated and validated by fresh setup.
- [ ] Final GO decision recorded with approvers.
