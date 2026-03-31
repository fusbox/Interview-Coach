# Test Pyramid Strategy

Date: 2026-03-29  
Related tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Related review: [implementation-docs-alignment-review_2026-03-30.md](./implementation-docs-alignment-review_2026-03-30.md)

---

## Purpose

This document describes the current automated test strategy for the repo and the intended long-term balance across unit, integration, and browser E2E coverage.

It is written as a stable strategy and current-state reference, not as a task board.

---

## Current Posture

The repository now has automation at all three layers of the intended pyramid:

- unit / component coverage for business rules, validation, UI behavior, and accessibility
- workflow-level integration coverage for stateful seams and recovery behavior
- browser E2E smoke coverage for the highest-value recruiter and candidate flows

This materially improves confidence over the original Vitest-heavy baseline and closes the minimum viable browser pack defined during remediation.

---

## Recommended Balance

Target weighting:

- `65%` unit / service / component
- `25%` integration
- `10%` browser E2E

Rationale:

- most correctness risk in this repo still lives in business rules and service boundaries
- the highest-severity regressions typically happen at persistence, idempotency, auth, metrics, and recovery seams
- browser E2E is valuable, but should remain intentionally small and stable

---

## Layer 1: Unit And Component Coverage

### Purpose

This layer should remain the broadest, fastest, and most branch-aware layer.

### Current Strengths

The lower layer is now strong across:

- domain and state-machine logic
- route request/response contracts
- application commands for invite, resend, retry, session start/get/update
- metrics backend and alert evaluation
- rate limiting
- logger redaction
- recruiter create-flow step validation
- recruiter settings and templates behavior
- recruiter sessions table search/sort behavior
- recruiter preview/send and resend accessibility behavior
- candidate landing and initials-entry behavior

Representative coverage areas:

- `src/lib/domain/*`
- `src/lib/server/application/invites/*`
- `src/lib/server/application/session/*`
- `src/lib/server/metrics/*`
- `src/lib/server/rate-limit*`
- `src/lib/logger.ts`
- `src/app/(recruiter)/**/components/*.test.tsx`
- `src/features/session/components/*.test.tsx`
- `src/features/session/hooks/*.test.tsx`

### Ongoing Standard

For critical lower-layer modules, maintain:

- one happy path
- one invalid-input path
- one dependency or failure path
- one materially distinct branch or edge case

---

## Layer 2: Integration Coverage

### Purpose

This layer proves that stateful workflows and module boundaries work together with less mocking than the unit layer.

### Current Implemented Integration Scope

#### Invite Lifecycle

Covered:

- successful create
- failed create bookkeeping
- tracked reconciliation state
- safe retry through shared workflow
- parent/child batch lineage
- retry-issued state transitions

Representative suites:

- `src/lib/server/application/invites/invite-batch.integration.test.ts`
- `src/app/api/invite/resend/route.integration.test.ts`

#### Candidate Session Lifecycle

Covered:

- session start
- mark-viewed behavior
- initials capture
- answer persistence
- question advance
- session completion side effects

Representative suite:

- `src/lib/server/application/session/session-lifecycle.integration.test.ts`

#### Metrics And Operability

Covered:

- durable metric writes
- durable snapshot reads
- SLO summary assembly
- dashboard projection
- alert evaluation
- recruiter ops metrics endpoint behavior

Representative suite:

- `src/lib/server/metrics-pipeline.integration.test.ts`

#### Production Contracts

Covered:

- production fail-fast without configured origin
- production acceptance of `NEXT_PUBLIC_BASE_URL` compatibility fallback
- durable metrics availability through the production contract

Representative suite:

- `src/lib/server/production-contract.integration.test.ts`

### Ongoing Standard

For critical stateful workflows, maintain:

- one happy path
- one failure path
- one recovery or idempotency path when the workflow mutates state

---

## Layer 3: Browser E2E Coverage

### Purpose

This layer proves that the application works from a real user perspective in the browser.

### Current Browser Smoke Pack

The planned minimum Playwright pack is now implemented:

#### Recruiter Create Invite

Suite:

- `e2e/recruiter/create-invite.spec.ts`

Validates:

- recruiter create access
- job details and question entry
- candidate entry
- preview step
- preview modal
- send-success state

#### Candidate Practice Flow

Suite:

- `e2e/candidate/practice-session.spec.ts`

Validates:

- invite landing
- readiness selection
- session start
- answer entry and submission
- review step
- completion and summary

#### Recruiter Manage Invites / Resend

Suite:

- `e2e/recruiter/manage-invites.spec.ts`

Validates:

- dashboard search/filter
- session-detail navigation
- resend preview
- resend success from dashboard action

#### Recruiter Failed Batch + Retry Operator Path

Suite:

- `e2e/recruiter/retry-failed-batch.spec.ts`

Validates:

- recruiter-visible failed-batch messaging
- browser-issued retry call to the retry endpoint
- returned retry contract and idempotency header behavior

Note:

- retry is still an operator/API recovery capability, not a recruiter-facing product button

#### Recruiter Auth And Settings

Suite:

- `e2e/recruiter/auth-and-settings.spec.ts`

Validates:

- login screen tab switching
- password visibility behavior
- recruiter sign-in through the E2E seam
- settings load
- settings cancel and save behavior

### E2E Seam Note

The browser pack relies on an intentionally bounded E2E-only seam so local smoke tests can run without live Supabase credentials.

Primary seam module:

- `src/lib/e2e/test-mode.ts`

This seam is for local and CI browser validation only and does not change the production runtime contract.

---

## Current Assessment

### What Is Strong

- lower-layer business-rule coverage
- invite failure and retry behavior
- session lifecycle behavior
- production contract coverage
- recruiter and candidate critical-path browser smoke

### What Is Still Intentionally Thin

- the browser suite remains smoke-oriented rather than exhaustive
- integration coverage focuses on the highest-risk stateful seams, not every route
- most non-critical admin and content-management flows still rely on lower-layer coverage

That balance is appropriate for the current product stage.

---

## Quality Standard By Layer

### Unit / Component

Use this layer to catch:

- request/response drift
- logic regressions
- accessibility regressions on touched shared surfaces

### Integration

Use this layer to catch:

- persistence boundary mismatches
- idempotency and retry regressions
- metrics and alert-pipeline regressions
- auth and environment contract drift

### Browser E2E

Use this layer to catch:

- broken user journeys
- browser wiring issues
- auth/session/cookie issues
- high-value UX regressions that lower layers cannot see

---

## Next Recommended Expansion

The pyramid is now in a healthy baseline state. Future growth should be selective.

Best next additions:

1. broaden browser coverage only when a new user-critical flow lands
2. deepen integration coverage when a workflow introduces new persistence or recovery semantics
3. prefer lower-layer tests over new E2E tests unless the risk is specifically browser- or journey-shaped

Examples of reasonable future additions:

- browser coverage for any future recruiter-facing retry UI
- integration coverage for new outbound notification or workflow orchestration
- browser-level accessibility or axe checks if the team wants a stricter CI bar

---

## Success Criteria

The strategy is working when:

- most regressions are caught below the browser layer
- critical workflows each have lower-layer, integration, and user-journey evidence
- failure and recovery behavior no longer depend on manual validation alone
- the core development team can extend the suite without reconstructing test intent from working notes
