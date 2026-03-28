# Production Execution Plan

Date: 2026-03-26  
Primary review: [comprehensive_code_review_2026-03-26.md](./comprehensive_code_review_2026-03-26.md)  
Related tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Related prior plan: [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)
Deployment validation: [production_deployment_validation_checklist_2026-03-26.md](./production_deployment_validation_checklist_2026-03-26.md)

---

## Current Posture

- Production: `NO-GO`
- Controlled staging: `GO with explicit risk acceptance`

This plan supersedes the earlier remediation-closeout posture for production release decisions.

The 2026-03-25 remediation work remains complete for its original scope, but the 2026-03-26 review raises a stricter production gate:

1. invite-batch durability/reconciliation
2. canonical origin enforcement in production
3. durable metrics enforcement plus paging validation

---

## Goal

Convert the repo from a stale "initial remediation complete" posture into a current, defensible production-release plan.

This plan is intentionally narrow:

- close the remaining true production blockers
- update release-governance docs to match the latest review
- avoid broad architecture churn that does not change release posture

---

## Workstreams

### Workstream 1: Invite Consistency Reopen

Status on 2026-03-27:

- Complete for the current production gate
- deployed happy-path validation passed
- controlled failure-mode validation confirmed no partial persisted state under batch failure
- 2026-03-28 follow-on landed persisted batch reconciliation records and a safe recruiter retry endpoint in app code

Problem:

- the original production-gate closure only proved atomicity and no partial persisted rows
- the review's stronger mitigation also asked for durable batch reconciliation records and retry-safe recovery semantics
- those app-owned recovery semantics are now implemented, but deployment rollout still needs the new tracking migration and retry-endpoint validation

Execution:

1. Use the DB-side batch RPC for all-or-nothing invite persistence.
2. Persist a durable batch record with per-candidate status, retryability, retry count, and parent/child retry lineage.
3. Preserve recruiter-visible explicit per-candidate result reporting and return a durable `batchId`.
4. Expose a recruiter-safe retry endpoint that only retries failed-and-retryable candidates from a prior batch.
5. Cover create and retry behavior with focused command and route tests.

Suggested targets:

- `src/lib/server/application/invites/create-invite-batch.ts`
- `src/lib/server/application/invites/retry-invite-batch.ts`
- `src/lib/server/application/invites/types.ts`
- `src/lib/server/infrastructure/supabase-invite-repository.ts`
- `src/app/api/recruiter/invites/route.ts`
- `src/app/api/recruiter/invites/[batch_id]/retry/route.ts`
- `supabase/migrations/20260328_add_invite_batch_tracking.sql`

Exit criteria:

- no ambiguous partial-write outcome remains
- recovery/retry semantics are explicit and test-covered
- persisted batch state exists for safe follow-up and retry
- release gate can defend invite consistency under failure, not only happy path

### Workstream 2: Canonical Origin Enforcement

Status on 2026-03-27:

- Complete for the current production gate
- deployed validation passed after restoring configured production origin env
- production now operates with a configured trusted origin and without request-host fallback
Problem:

- the intended production contract is trusted configured origin only
- the current helper still returns request-derived origin when `requestUrl` is present and no configured origin exists
- that means production trust still depends on mutable request host input in some paths

Execution:

1. Change origin resolution so production never trusts request-derived origin fallback.
2. Require a configured canonical origin for candidate-facing public URL generation.
   - preferred: `NEXT_PUBLIC_APP_URL`
   - compatible fallback: `NEXT_PUBLIC_BASE_URL`
3. Keep local development ergonomics for request-based localhost normalization outside production.
4. Add focused tests for:
   - missing `NEXT_PUBLIC_APP_URL` in production
   - malformed configured origin
   - request-host fallback rejection in production
   - localhost normalization in non-production

Suggested targets:

- `src/lib/server/url/get-app-origin.ts`
- `src/lib/config/public-app-origin.ts`
- `src/lib/server/url/get-app-origin.test.ts`

Exit criteria:

- production public URL generation is trusted-env-only
- request-derived host fallback is impossible in production
- deployment contract is documented in quality and env docs

### Workstream 3: Durable Metrics Enforcement and Paging Validation

Problem:

- durable metrics path exists and has production validation
- production contract still permits `METRICS_BACKEND` to default to memory
- production metrics are validated, but live alert delivery still depends on deployment-managed Teams webhook provisioning

Execution:

1. Make the metrics backend a production fail-fast contract.
2. Reject `METRICS_BACKEND=memory` or unset metrics backend in production.
3. Add contract tests for production backend selection.
4. Validate alert routing through a game-day or equivalent paging exercise.
5. Update alert/runbook/release docs with the validation evidence.
6. Handoff live webhook provisioning and final Teams delivery validation to the deployment team when the product-developer role does not own production alert infrastructure.

Suggested targets:

- `src/lib/server/metrics/backend.ts`
- `src/lib/server/metrics/backend.test.ts`
- `docs/05-quality/ops_alert_policy.md`
- `docs/05-quality/incident_runbook.md`
- `docs/05-quality/release-gate-checklist.md`

Exit criteria:

- production cannot boot into memory-only metrics mode
- durable metrics are both implemented and enforced
- paging path is validated and documented

---

## Sequencing

### Step 1: Governance correction

Update tracker, plan, release gate, alert policy, and env matrix so the repo no longer claims production readiness.

### Step 2: Canonical origin fix

This is the smallest production-trust fix and should land first.

### Step 3: Metrics enforcement

This is a bounded contract change with a clear test surface and direct production impact.

### Step 4: Invite consistency redesign

This is the largest reopened item and should be handled after the trust and operability contracts are corrected, unless implementation discovery shows it is faster to land first.

### Step 5: Re-run production gate

After the three reopened items land:

- rerun the release-gate checklist
- update the tracker decision log
- issue a fresh production recommendation

---

## Deliverables

- updated tracker reflecting reopened production blockers
- updated remediation plan reflecting the latest review posture
- updated release-gate checklist with the current blockers
- updated env and alert policy docs reflecting the production contract
- code/test changes for origin enforcement, metrics enforcement, and invite consistency
- documented paging-validation evidence
- deployment validation checklist for migration rollout, env contract review, smoke checks, and paging exercise

Current completion state:

- `Workstream 1 / P0-R1`: complete
- `Workstream 1` follow-on reconciliation tracking and safe retry: implemented in app code; deployment validation still needed for the new tracking migration and retry endpoint
- `Workstream 2 / P0-R2`: complete
- `Workstream 3 / P0-R3`: in progress, with code-side starter complete and live Teams delivery validation handed off to the deployment team

---

## Review Crosswalk

This section explicitly maps the latest review's action lists to execution tasks in this plan.

### 1. Hardening Strategy

Review items:

- transaction-safe invite batch command
- batch reconciliation records
- production-only canonical origin policy

Mapped execution:

- `Workstream 1` implements the invite consistency model decision and delivery:
  - transaction-safe DB batch write
  - or persisted `batch_id` reconciliation state with per-candidate status
- `Workstream 2` removes production request-host fallback while allowing either `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_BASE_URL` as the trusted configured production origin

### 2. Refactor Suggestions

Review items:

- continue route thinning to `auth -> validate -> command -> map HTTP response`
- replace hardcoded recruiter/org defaults with tenant-config or profile-first initialization
- split send vs resend metrics naming

Mapped execution:

- the highest-value remaining route-thinning example in `PATCH /api/session/[session_id]` and `GET /api/session/[session_id]` has now landed via dedicated application commands; remaining work is follow-on cleanup on neighboring question-mutation and AI helper routes
- carry the recruiter-defaults cleanup as `P1` backlog aligned with the tracker
- metrics-name split work has now landed in the metrics slice so send and resend have distinct operational counters while the delivery-failure alert still aggregates both paths

### 3. Gaps

Review items:

- critical session routes still contain orchestration concerns
- partial-success batch contract coverage needs expansion
- durable metrics/SLO RPC compatibility coverage needs expansion

Mapped execution:

- major session-route extraction is now materially improved with command boundaries on `GET` and `PATCH /api/session/[session_id]`; keep the remaining question-mutation and AI helper route extraction in next-sprint architecture cleanup after release blockers
- add contract and compatibility tests as required outputs of `Workstream 1` and `Workstream 3`

### 4. Recommendations

Review items:

- add contract tests for partial invite-batch response shape
- add strict compatibility tests for durable metrics/SLO RPC payload contracts

Mapped execution:

- `Workstream 1` adds `207` response-shape and deterministic per-candidate status coverage
- `Workstream 3` adds compatibility coverage for metrics rollup and SLO summary RPC payloads

### 5. Mitigations

Review items:

- persist reconciliation-safe invite batch status and expose safe retry endpoint
- enforce production canonical origin env contract at startup
- run recurring log-redaction audit with CI checks on logger callsites

Mapped execution:

- `Workstream 1` now owns and implements persisted batch state and safe retry behavior through tracked batch records and `POST /api/recruiter/invites/[batch_id]/retry`
- `Workstream 2` owns startup-time production origin contract enforcement
- add log-redaction audit and logger-callsite CI checks as a parallel `P1` security/ops follow-on, not a blocker to the three reopened P0 items unless a live leak is discovered

### 6. Prioritized Optimization List

Review items:

- P0 convert invite persistence from sequential writes to transaction/RPC batch operation
- P1 parallelize/queue invite persistence with deterministic ordering
- P1 reduce orchestration in long-lived session UI surfaces

Mapped execution:

- `Workstream 1` implements the P0 invite persistence redesign
- bounded concurrency/queueing remains an optional implementation detail only if needed after the consistency model is chosen
- UI orchestration cleanup remains `P1` backlog after production blockers are closed

### 7. Minimum Viable Next Expansion

Review items:

- integration test for partial invite failure plus retry/reconciliation
- integration test for production startup/env contract failure
- contract test for canonical origin generation
- reliability test for shared multi-instance rate limiting

Mapped execution:

- `Workstream 1` now has focused create/retry command and route coverage; a deeper deployed integration pass should validate the new tracking migration and retry endpoint in the target environment
- `Workstream 2` delivers the canonical-origin contract test
- `Workstream 3` delivers the production metrics-backend contract test
- shared rate-limit reliability test is a release-evidence follow-on that should be added before the final production recommendation is reissued

### 8. Required Upgrades

Review items:

- require durable metrics backend in production
- validate alert-to-paging integration
- add release-gate rule tied to SLO error-budget posture

Mapped execution:

- `Workstream 3` enforces the durable backend contract
- `Workstream 3` also owns the paging-validation exercise
- update the release gate after the first paging validation pass so SLO error-budget posture becomes a formal approval input

### 9. Punch List

Review items:

- keyboard/focus E2E assertions on recruiter create + preview + resend
- regression checks for `aria-live` announcements
- CI accessibility smoke checks for recruiter critical paths

Mapped execution:

- bounded recruiter critical-path accessibility smoke now covers create-preview and resend focus/error/success behavior in CI-facing component tests
- current remediation coverage now includes the latest punch-list slice for recruiter create + preview + resend flows; any deeper browser-level axe/Playwright expansion is follow-on quality uplift rather than an open remediation gap

### 10. Repo Checklist

Review items:

- add explicit production deployment contract doc
- add release gate that blocks prod promotion when P0 checklist items are open

Mapped execution:

- this plan itself plus the updated env matrix and release-gate checklist form the first production deployment contract baseline
- the updated tracker and release gate now keep production blocked until `P0-R3` is complete

---

## Non-Goals

This plan should not expand into:

- broad route-to-application extraction beyond the current critical blockers
- full observability-platform migration
- dashboard redesign
- speculative ATS-scale batch infrastructure unless required by the chosen invite consistency model

---

## Definition of Done

This plan is complete when:

- the docs and tracker no longer claim production readiness prematurely
- origin enforcement is production-safe
- metrics backend enforcement is complete and alert-delivery ownership is explicit
- invite-batch failure handling is reconciliation-safe, with durable batch tracking and retry-safe recovery semantics in app code
- a new release recommendation can be made from current evidence


