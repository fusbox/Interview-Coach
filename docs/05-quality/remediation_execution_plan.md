# Remediation Execution Plan (Stepwise)

Date: 2026-03-17  
Source inputs synthesized:
- `docs/05-quality/code_review_request.md`
- `docs/05-quality/comprehensive_code_review.md`

## 0) Objective, Scope, and Exit Criteria

### Phase 1 Execution Status (2026-03-17)
- `P0-1` completed and merged: `/api/invite/send` now enforces recruiter auth, ownership checks, schema validation, rate limiting, and sanitized error responses.
- `P0-2` completed and merged: `/api/recruiter/invites` no longer contains a runtime dev auth bypass and now enforces authenticated invite creation, fixed-window rate limits, `Idempotency-Key` replay support, and regression coverage.
- `1.4` completed and merged: shared API error helpers and candidate-session validation wrappers now normalize error responses to `code`, `message`, `correlationId`, and `retryable`, removing raw `details` and stack leakage from public routes.
- Remaining public compute/session abuse controls are implemented: recruiter-only AI generation is authenticated, candidate assist routes are bound to the magic-link token plus session context, and practice-again token generation now requires the current candidate token for the parent session.
- Gate A scope is now materially complete; remaining next work shifts to Phase 2 concurrency and data-integrity stabilization.
- `2.1` completed and merged: a shared session status transition table now lives in the domain layer, state-transition unit tests are green, and invalid status changes are rejected centrally on the server mutation paths.
- `2.2` completed and merged: session mutations now enforce one in-flight command per session for `start`, `submit`, `next`, and `retry`, with overlapping commands ignored deterministically and optimistic state rolled back on failure.
- `2.3` completed and merged: engagement tracking now uses a database-side atomic increment function instead of read-modify-write JSON merging, eliminating lost updates under concurrent pings.
- `2.4` completed and merged: submit mutations now support `Idempotency-Key` replay semantics, and the candidate client sends deterministic submit keys so duplicate retries do not create duplicate submit side effects.
- `3.1` completed and merged: all remaining mutable routes now use explicit request schemas, so malformed JSON and invalid body shapes fail fast with the standardized `400 INVALID_REQUEST` envelope.
- `3.2` completed and merged: AI/email provider outputs now pass through runtime schema validation, and malformed provider responses fail as typed provider-response errors instead of flowing into domain objects unchecked.
- `3.3` completed and merged: Supabase session mappers now normalize malformed/nullable DB fields into safe domain defaults, drop invalid persisted analysis blobs, and translate DB-only enum/status values before they reach client schemas.
- `4.1` completed and merged: the test pyramid baseline now covers unit, repository/mapper, hook rehydration, recruiter dashboard action shaping, and the earlier API integration/security/concurrency suites as an explicit baseline for subsequent CI gating.
- `4.2` completed and merged: race-condition suites now run with deterministic clock values where applicable, and the new repo-native stability runner completed 20/20 successful iterations for the concurrency-critical hook and repository mapper suites.
- `4.3` completed and merged: GitHub Actions now enforces lint, typecheck, coverage-gated Vitest runs, and the repeated stability suite; lint warnings are merge-blocking, and the current baseline is green at 59.82% statements / 50.87% branches / 64.48% functions / 62.38% lines against the configured minimum thresholds.

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

**Execution Status**
- Completed 2026-03-17.
- Shared helpers added in `src/lib/server/api-errors.ts` and applied across the remaining public-facing API routes.
- Candidate-token-authenticated question routes now inherit envelope handling through `validatedSessionHandler`.
- Regression tests verify malformed requests and unexpected exceptions no longer expose internal details.

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

**Execution Status**
- Completed 2026-03-17.
- Transition table added in `src/lib/domain/session-state-machine.ts`.
- Server-side mutation enforcement added in orchestrator helpers and session mutation routes.
- Unit tests added in `src/lib/domain/session-state-machine.test.ts`.

### Step 2.2 — Introduce Command Mutex / Single-Flight in Session Mutations
- Implement one in-flight command policy per session for submit/next/retry/start.
- Add cancellation/ignore semantics for stale commands.
- Ensure optimistic updates have deterministic rollback or re-fetch reconcile.

**Acceptance Criteria**
- Race-condition tests for submit/next overlap pass repeatedly.
- No duplicate network mutation for repeated user click during lock window.

**Execution Status**
- Completed 2026-03-17.
- `useSessionMutations` now uses an explicit per-session command gate instead of a generic busy flag.
- Overlapping `submit`, `next`, and `retry` attempts are ignored deterministically while the active command remains in flight.
- Existing race tests and new overlap coverage are green in `src/features/session/hooks/useDomainSession.test.tsx`.

### Step 2.3 — Atomic Engagement Tracking
- Replace read-modify-write JSON merge with DB atomic increment strategy.
- Add conflict-safe persistence method (SQL update expression or RPC).

**Acceptance Criteria**
- Concurrent engagement updates do not lose increments.
- Integration test validates final total under parallel calls.

**Execution Status**
- Completed 2026-03-17.
- Database function added in `supabase/migrations/20260317_add_atomic_engagement_increment.sql`.
- Repository `updatePartial` now routes `engagedTimeDelta` through an atomic RPC instead of session JSON read-modify-write.
- Repository regression tests added in `src/lib/server/infrastructure/supabase-session-repository.test.ts`.

### Step 2.4 — Idempotency for Critical Mutations
- Add `Idempotency-Key` support to invite creation and submit flows.
- Persist short-lived key ledger with response replay semantics.

**Acceptance Criteria**
- Duplicate requests with same key return same result.
- No duplicate side effects across retries/timeouts.

**Execution Status**
- Completed 2026-03-17.
- Shared idempotency ledger reused for candidate submit flows in `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`.
- Candidate submit requests now send deterministic `Idempotency-Key` headers from `src/features/session/hooks/useSessionMutations.ts`.
- Submit route regression tests verify replay, conflict, and first-write persistence behavior.

---

## Phase 3 (Week 2): Validation and Contract Hardening
Goal: remove undefined behavior and schema drift.

### Step 3.1 — Full Request Validation Coverage
- Add schema parse/guard for every mutable route.
- Fail fast with 400 + structured validation errors.

**Execution Status**
- Completed 2026-03-17.
- Added route-local request schemas to `src/app/api/questions/generate/route.ts`, `src/app/api/tts/route.ts`, `src/app/api/session/[session_id]/questions/[question_id]/analysis/route.ts`, and `src/app/api/session/[session_id]/questions/[question_id]/retry/route.ts`.
- Invalid JSON and malformed payloads now return the sanitized `400 INVALID_REQUEST` envelope instead of implicit parsing behavior.
- Regression tests added for malformed request handling on each remediated route.

### Step 3.2 — Response Validation for External Providers
- Wrap AI/email provider outputs with runtime schema checks.
- Convert provider failures into typed domain errors.

**Execution Status**
- Completed 2026-03-17.
- Added shared provider parsing helpers in `src/lib/server/provider-response.ts` and typed provider failure class in `src/lib/server/provider-errors.ts`.
- Gemini outputs for recruiter question generation, candidate analysis, strong-response generation, tips generation, and session summarization now validate against runtime schemas before entering the domain layer.
- Resend email send results now validate before invite/debrief flows treat the send as a successful provider response.
- Regression tests cover malformed Gemini JSON/schema drift and invalid Resend success payloads.

### Step 3.3 — Repository Mapper Hardening
- Add defensive mappers for nullable DB fields.
- Introduce mapper tests with malformed/partial rows.

**Execution Status**
- Completed 2026-03-17.
- Hardened `src/lib/server/infrastructure/supabase-session-repository.ts` with explicit coercion helpers for timestamps, attempt numbers, candidate intake objects, and optional strings/numbers.
- Session summary/session detail reads now normalize DB-only status values, tolerate malformed intake JSON, and drop invalid persisted `feedback_json` payloads instead of returning domain-invalid session objects.
- Regression tests now cover malformed summary rows, malformed session metadata, invalid persisted analysis, and repeat-practice lineage visibility.

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

**Execution Status**
- Completed 2026-03-17.
- Existing coverage already included domain transition tests, API route/security regressions, provider boundary tests, and session mutation concurrency tests.
- Added `src/features/session/hooks/useSessionQuery.test.tsx` to lock down session rehydration success/failure behavior and local-storage cleanup.
- Added `src/app/(recruiter)/recruiter/actions.test.ts` to cover recruiter dashboard lineage shaping, anonymous-child resolution, sorting, and delete/revalidate behavior.
- Repository mapper tests were expanded during `3.3` and now serve as the mapper/unit baseline for malformed DB rows and lineage visibility.

### Step 4.2 — Flake Reduction and Stability Runs
- Add deterministic mocks for network/clock where applicable.
- Run race-condition suites in repeated mode (e.g., 20x loop).

**Execution Status**
- Completed 2026-03-17.
- Added deterministic `Date.now()` mocking in `src/features/session/hooks/useDomainSession.test.tsx` so submit/analysis overlap tests no longer depend on wall-clock timing.
- Added repo-native repeat runner `scripts/run-stability-suite.mjs` and `npm run test:stability` to execute the high-risk stability suite without relying on unsupported Vitest repeat flags.
- Stability suite result: `20/20` successful iterations for `src/features/session/hooks/useDomainSession.test.tsx` and `src/lib/server/infrastructure/supabase-session-repository.test.ts`.

### Step 4.3 — Enforce CI Quality Gates
- CI must block merges on:
  - lint
  - typecheck
  - unit/integration suites
  - minimum coverage threshold

**Execution Status**
- Completed 2026-03-17.
- Added `.github/workflows/quality-gates.yml` to run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, and `npm run test:stability` on pushes to `main`/`master` and on pull requests.
- `package.json` now makes lint warnings blocking via `next lint --max-warnings 0` and defines the repo-standard `typecheck`, `test:run`, `test:coverage`, `test:stability`, and `ci:quality` scripts.
- `vitest.config.ts` now enforces minimum aggregate coverage thresholds with the V8 provider and emits `text`, `json-summary`, and `lcov` reports.
- Verified current green baseline: `npm run ci:quality` passed, and `npm run test:stability` completed `20/20` successful iterations.

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
2. Completed 2026-03-17: Remove runtime dev auth bypass on `/api/recruiter/invites`, add invite-create rate limits, and add idempotent replay support.
3. Add auth guard to invite/email mutation routes.
4. Add rate limiting middleware for mutation routes.
5. Completed 2026-03-17: Implement standardized API error envelope and correlation IDs across API routes.
6. Completed 2026-03-17: Bind remaining public AI/session routes to recruiter auth or candidate magic-link tokens and add baseline fixed-window throttling.
7. Completed 2026-03-17: Define and codify session state transition table.
8. Completed 2026-03-17: Fix submit/next/retry/start single-flight behavior and add deterministic overlap tests.
9. Completed 2026-03-17: Implement atomic engagement increment strategy.
10. Completed 2026-03-17: Add idempotency key support for submit and related candidate mutations.
11. Completed 2026-03-17: Close the remaining mutable-route request validation gaps with explicit schemas and malformed-payload regression tests.

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
