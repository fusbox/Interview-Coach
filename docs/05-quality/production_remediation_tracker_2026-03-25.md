# Production Remediation Tracker

Date opened: 2026-03-25  
Source review: [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)  
Execution plan: [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)  
Issue breakdown: [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)

---

## Overall Status

- Production release status: `Blocked`
- Controlled staging status: `Allowed with risk acceptance`
- Active phase: `Phase 1 / Execution`
- Last updated by: `Codex`

---

## Severity Dashboard

| Severity | Total | Not Started | In Progress | Blocked | Done |
|----------|-------|-------------|-------------|---------|------|
| P0 | 3 | 0 | 1 | 0 | 2 |
| P1 | 4 | 3 | 0 | 0 | 1 |
| P2 | 2 | 2 | 0 | 0 | 0 |

---

## Work Item Tracker

| ID | Title | Severity | Owner | Sprint | Status | Dependencies | Notes |
|----|-------|----------|-------|--------|--------|--------------|-------|
| P0-1 | Replace process-local rate limiting | P0 | Platform / backend | Sprint 1 | In Progress | backend choice | Supabase/Postgres backend selected; abstraction, async consumers, and migration landed locally |
| P0-2 | Make invite creation deterministic under partial failure | P0 | Backend / application layer | Sprint 2 | Done | P0-3, consistency model decision | Initial-rollout stop point reached: deterministic mixed-result semantics, recruiter-visible failures, and idempotent partial replay |
| P0-3 | Add production fail-fast for auth and required server env | P0 | Platform / backend | Sprint 1 | Done | env inventory | Privileged env/auth seams now use the server env contract; remaining URL-origin cleanup belongs to `P1-1` |
| P1-1 | Centralize canonical app origin resolution | P1 | Backend / platform | Sprint 1 | Done | P0-3 | Shared origin helper, server email adoption, and resend preview alignment landed |
| P1-2 | Remove residual hardcoded business defaults | P1 | Frontend / product engineering | Sprint 3 | Not Started | none | Can proceed in parallel once config policy is agreed |
| P1-3 | Tighten runtime schemas | P1 | Backend / AI contracts | Sprint 3 | Not Started | feedback-chain coordination | Prioritize provider and domain contracts before export/debug surfaces |
| P1-4 | Land durable metrics path and SLO base layer | P1 | Platform / ops | Sprint 4 | Not Started | metrics backend decision | Start design in Sprint 2 even if implementation lands later |
| P2-1 | Continue route-to-application-service extraction | P2 | Backend / architecture | Sprint 3 | Not Started | P0-2 pattern established | Invite flows become the reference implementation |
| P2-2 | Add accessibility automation for critical flows | P2 | Frontend / QA | Sprint 4 | Not Started | stable flow surfaces | Recruiter create and candidate session flows first |

---

## Weekly Review Log

### 2026-03-25

- Tracker created from the 2026-03-25 production-readiness review.
- Recommended owners and sprint targets assigned for planning purposes.
- Production remains blocked on P0 completion.

### 2026-03-25 (Planning Baseline)

- Sprint 1 recommendation:
  - `P0-3` fail-fast env/auth validation
  - `P1-1` canonical app origin helper
  - `P0-1` shared rate-limiter abstraction and backend selection
- Sprint 2 recommendation:
  - `P0-2` invite batch consistency and application command extraction
- Later work should not be allowed to displace unfinished P0 items without explicit risk acceptance.

### 2026-03-25 (Implementation Progress)

- `P0-3` moved to `Done`.
- Landed initial implementation:
  - `src/lib/server/config/server-env.ts`
  - fail-fast env access in `src/lib/supabase/server.ts`
  - removed candidate-token anon fallback in `src/lib/server/auth/candidate-token.ts`
- Expanded env-contract adoption to provider seams:
  - `src/lib/server/services/ai-config.ts`
  - `src/lib/server/services/email-service.ts`
- Expanded env-contract adoption to encrypted-at-rest server utility:
  - `src/lib/server/encryption.ts`
- Added focused tests for server env contract and candidate-token admin-client behavior.
- Added focused tests for production fail-fast behavior in AI, email, and encryption config modules.
- Final privileged-env inventory review completed:
  - remaining raw env reads in server routes are optional URL/origin settings and should be handled under `P1-1`
  - remaining middleware env reads are public Supabase runtime config, not privileged server secrets

### 2026-03-25 (P1-1 Completed)

- `P1-1` moved to `Done`.
- Added shared canonical origin helper:
  - `src/lib/server/url/get-app-origin.ts`
- Added shared configured-origin precedence helper:
  - `src/lib/config/public-app-origin.ts`
- Replaced route-local origin logic in:
  - `src/app/api/recruiter/invites/route.ts`
  - `src/app/api/invite/resend/route.ts`
- Updated server-rendered email assets/links to use the shared origin resolver:
  - `src/lib/server/services/email-service.ts`
- Updated recruiter resend preview to use the same configured-origin precedence:
  - `src/app/(recruiter)/recruiter/components/ResendInviteButton.tsx`
- Added focused helper coverage:
  - `src/lib/server/url/get-app-origin.test.ts`
- Focused regression coverage passed for:
  - origin helper
  - recruiter invite route
  - email service and email config

### 2026-03-25 (P0-1 Started)

- `P0-1` moved to `In Progress`.
- Added shared rate-limit abstraction:
  - `src/lib/server/rate-limit/types.ts`
  - `src/lib/server/rate-limit/backend.ts`
- Refactored limiter selection in:
  - `src/lib/server/rate-limit.ts`
- Selected Supabase/Postgres as the shared backend for production/staging; memory remains local/test only.
- Added Supabase migration and RPC bucket consumer:
  - `supabase/migrations/20260325_add_rate_limit_buckets.sql`
- Updated invite routes and abuse-protection consumers to await async limiter decisions.
- Added focused tests and route regression coverage:
  - `src/lib/server/rate-limit.test.ts`
  - `src/app/api/invite/send/route.test.ts`
  - `src/app/api/recruiter/invites/route.test.ts`
  - `src/app/api/session/start/route.test.ts`
- Remaining `P0-1` work:
  - update ops/runbook docs for backend selection and migration rollout
  - validate migration/application path in deployed environments

### 2026-03-25 (P0-2 Completed)

- `P0-2` moved to `Done`.
- Extracted invite creation into an application command:
  - `src/lib/server/application/invites/create-invite-batch.ts`
  - `src/lib/server/application/invites/types.ts`
- Updated `POST /api/recruiter/invites` to return deterministic mixed-result payloads:
  - `results`
  - `failures`
  - `summary`
- Mixed success/failure invite batches now return `207` instead of an opaque route-level `500`.
- Recruiter create flow now surfaces partial invite creation failures while preserving preview/send for successful candidates.
- Added focused tests:
  - `src/lib/server/application/invites/create-invite-batch.test.ts`
  - `src/app/api/recruiter/invites/route.test.ts`
- Added replay coverage for stored partial-failure results on duplicate idempotency keys.
- `P0-2` is considered complete for the initial rollout at deterministic mixed-result semantics.
- Deferred follow-on concerns:
  - durable batch-job infrastructure
  - all-or-nothing transaction semantics
  - retry-failed-only tooling tied to future ATS integration

### 2026-__-__

- Add status update here.

---

## Decision Log

Use this section to record decisions that change implementation direction during remediation.

| Date | Decision | Impacted Items | Notes |
|------|----------|----------------|-------|
| 2026-03-25 | Initial remediation plan created | All | Derived from 2026-03-25 review |
| 2026-03-25 | Recommended Sprint 1 scope set to env/auth contract, canonical origin, and shared throttling | P0-1, P0-3, P1-1 | Planning baseline only; update when team confirms staffing |
| 2026-03-25 | Candidate-token protected path will use admin Supabase access unconditionally; no anon fallback in production-hardening path | P0-3 | First protected-path hardening step landed locally |
| 2026-03-25 | AI and email provider configuration will degrade only in local/test; production will fail fast on missing keys | P0-3 | Applied to Gemini and Resend config seams |
| 2026-03-25 | `ENCRYPTION_SECRET` joins the production fail-fast env contract; canonical URL cleanup remains a separate `P1-1` concern | P0-3, P1-1 | Closes privileged env/auth scope without mixing in origin policy |
| 2026-03-25 | Canonical public-origin resolution will prefer `NEXT_PUBLIC_APP_URL`, then `NEXT_PUBLIC_BASE_URL`, then request origin for non-production request-scoped flows | P1-1 | Keeps existing behavior compatible while removing route-local divergence |
| 2026-03-25 | Production public-origin resolution will fail fast without configured origin instead of trusting request-host fallback | P1-1 | Covers the untrusted-host concern without adding a separate allowlist system in this slice |
| 2026-03-25 | Shared rate limiting will use Supabase/Postgres in production/staging and memory only in local/test | P0-1 | Avoids adding Redis infrastructure during the initial hardening wave |
| 2026-03-25 | Invite batch creation will surface deterministic mixed results immediately, with deeper transaction/batch-record semantics evaluated as a follow-on within `P0-2` | P0-2 | Improves user-visible correctness before full persistence model redesign |
| 2026-03-25 | `P0-2` closes for the initial rollout at deterministic mixed-result semantics with idempotent partial replay; deeper batch infrastructure is deferred to ATS integration work | P0-2 | Keeps the remediation scope proportional to the rollout and avoids speculative persistence redesign |

---

## Blocker Log

| Date | Blocker | Impacted Items | Owner | Resolution |
|------|---------|----------------|-------|------------|
| 2026-03-25 | None yet logged | - | - | - |

---

## Release Gate

Production remains blocked until all of the following are true:

- [ ] `P0-1` is complete
- [ ] `P0-2` is complete
- [ ] `P0-3` is complete
- [ ] failure-mode tests for invite flow are passing
- [ ] env/auth startup contract is documented in operational docs

---

## Administration Notes

- Update this tracker at least once per week while remediation is active.
- When an item moves to `Done`, also update linked runbooks, ADRs, and quality docs if impacted.
- Do not mark a P0 item done until code, tests, and documentation are all complete.
