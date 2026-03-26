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

Problem:

- current invite creation reports deterministic mixed results
- current flow still allows partial writes without durable reconciliation state
- current production posture lacks deterministic replay/recovery semantics after mid-batch persistence failure

Execution:

1. Decide the consistency model:
   - single transaction / DB-side batch RPC
   - or persisted batch record with per-candidate status and retry metadata
2. Implement the chosen model in application and infrastructure layers.
3. Preserve recruiter-visible explicit per-candidate result reporting.
4. Add integration coverage for mid-batch failure, recovery, and duplicate retry behavior.

Suggested targets:

- `src/lib/server/application/invites/create-invite-batch.ts`
- `src/lib/server/application/invites/types.ts`
- `src/lib/server/infrastructure/supabase-invite-repository.ts`
- `src/app/api/recruiter/invites/route.ts`

Exit criteria:

- no ambiguous partial-write outcome remains
- recovery/retry semantics are explicit and test-covered
- release gate can defend invite consistency under failure, not only happy path

### Workstream 2: Canonical Origin Enforcement

Problem:

- the intended production contract is trusted configured origin only
- the current helper still returns request-derived origin when `requestUrl` is present and no configured origin exists
- that means production trust still depends on mutable request host input in some paths

Execution:

1. Change origin resolution so production never trusts request-derived origin fallback.
2. Make `NEXT_PUBLIC_APP_URL` the required production contract for candidate-facing public-origin generation.
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
- alert policy still notes that external paging validation is pending

Execution:

1. Make the metrics backend a production fail-fast contract.
2. Reject `METRICS_BACKEND=memory` or unset metrics backend in production.
3. Add contract tests for production backend selection.
4. Validate alert routing through a game-day or equivalent paging exercise.
5. Update alert/runbook/release docs with the validation evidence.

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
- `Workstream 2` removes production request-host fallback and makes `NEXT_PUBLIC_APP_URL` the trusted production contract

### 2. Refactor Suggestions

Review items:

- continue route thinning to `auth -> validate -> command -> map HTTP response`
- replace hardcoded recruiter/org defaults with tenant-config or profile-first initialization
- split send vs resend metrics naming

Mapped execution:

- keep route-thinning work as follow-on architecture cleanup after the reopened P0 items
- carry the recruiter-defaults cleanup as `P1` backlog aligned with the tracker
- add metrics-name split work into the metrics enforcement slice so send and resend have distinct alert ownership before the next release pass

### 3. Gaps

Review items:

- critical session routes still contain orchestration concerns
- partial-success batch contract coverage needs expansion
- durable metrics/SLO RPC compatibility coverage needs expansion

Mapped execution:

- keep session route extraction in next-sprint architecture cleanup after release blockers
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

- `Workstream 1` owns persisted batch state and safe retry behavior
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

- `Workstream 1` delivers the invite failure/reconciliation integration test
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

- keep this work as `P2` expansion after production blockers close
- current remediation coverage remains the baseline; the next slice should move from component coverage toward E2E and CI smoke coverage

### 10. Repo Checklist

Review items:

- add explicit production deployment contract doc
- add release gate that blocks prod promotion when P0 checklist items are open

Mapped execution:

- this plan itself plus the updated env matrix and release-gate checklist form the first production deployment contract baseline
- the updated tracker and release gate now keep production blocked until `P0-R1`, `P0-R2`, and `P0-R3` are complete

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
- metrics backend enforcement and paging validation are complete
- invite-batch failure handling is reconciliation-safe
- a new release recommendation can be made from current evidence
