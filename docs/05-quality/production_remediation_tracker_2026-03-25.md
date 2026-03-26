# Production Remediation Tracker

Date opened: 2026-03-25  
Source review: [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)  
Execution plan: [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)  
Issue breakdown: [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)

---

## Overall Status

- Production release status: `Remediation gate satisfied for the initial hardening scope`
- Controlled staging status: `Allowed`
- Active phase: `Post-remediation backlog / P2 follow-on work`
- Last updated by: `Codex`

---

## Severity Dashboard

| Severity | Total | Not Started | In Progress | Blocked | Done |
|----------|-------|-------------|-------------|---------|------|
| P0 | 3 | 0 | 0 | 0 | 3 |
| P1 | 4 | 0 | 1 | 0 | 3 |
| P2 | 2 | 2 | 0 | 0 | 0 |

---

## Work Item Tracker

| ID | Title | Severity | Owner | Sprint | Status | Dependencies | Notes |
|----|-------|----------|-------|--------|--------|--------------|-------|
| P0-1 | Replace process-local rate limiting | P0 | Platform / backend | Sprint 1 | Done | backend choice | Supabase/Postgres backend selected; abstraction, async consumers, migration rollout, and deployed recruiter/candidate 429 smoke tests completed |
| P0-2 | Make invite creation deterministic under partial failure | P0 | Backend / application layer | Sprint 2 | Done | P0-3, consistency model decision | Initial-rollout stop point reached: deterministic mixed-result semantics, recruiter-visible failures, and idempotent partial replay |
| P0-3 | Add production fail-fast for auth and required server env | P0 | Platform / backend | Sprint 1 | Done | env inventory | Privileged env/auth seams now use the server env contract; remaining URL-origin cleanup belongs to `P1-1` |
| P1-1 | Centralize canonical app origin resolution | P1 | Backend / platform | Sprint 1 | Done | P0-3 | Shared origin helper, server email adoption, and resend preview alignment landed |
| P1-2 | Remove residual hardcoded business defaults | P1 | Frontend / product engineering | Sprint 3 | Done | none | Recruiter/business fallback policy is now centralized in shared config and consumed by recruiter signature flows |
| P1-3 | Tighten runtime schemas | P1 | Backend / AI contracts | Sprint 3 | Done | feedback-chain coordination | Shared request contracts consolidated, provider malformed-response path typed, and critical route/service seams covered |
| P1-4 | Land durable metrics path and SLO base layer | P1 | Platform / ops | Sprint 4 | Done | metrics backend decision | Durable Supabase rollups and SQL-backed SLO summaries are validated in production; threshold tuning is now ongoing ops work rather than remediation scope |
| P2-1 | Continue route-to-application-service extraction | P2 | Backend / architecture | Sprint 3 | Not Started | P0-2 pattern established | Invite flows become the reference implementation |
| P2-2 | Add accessibility automation for critical flows | P2 | Frontend / QA | Sprint 4 | Not Started | stable flow surfaces | Recruiter create and candidate session flows first |

---

## Weekly Review Log

### 2026-03-25

- Tracker created from the 2026-03-25 production-readiness review.
- Recommended owners and sprint targets assigned for planning purposes.
- Initial production status was blocked on P0 completion.

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

### 2026-03-25 (P0-1 Completed)

- `P0-1` moved to `Done`.
- Confirmed shared rate-limit database path in Supabase production:
  - `public.rate_limit_buckets`
  - `public.consume_rate_limit_bucket(...)`
- Validated deployed recruiter-route throttling:
  - `POST /api/recruiter/invites`
  - observed 10 allowed responses and 1 `429 RATE_LIMITED` response within the configured window
- Validated deployed candidate/public-route throttling:
  - `POST /api/session/start`
  - observed 10 allowed responses and 1 `429 RATE_LIMITED` response within the configured window
- `P0` production blockers are now closed at the code, test, database, and deployed smoke-test level.

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

### 2026-03-25 (Phase 2 Started)

- Active phase moved to the remaining `P1`/`P2` backlog.
- `P1-2` moved to `In Progress`.
- First execution slice:
  - added `src/lib/config/recruiter-defaults.ts`
  - updated `src/lib/recruiter-signature.ts` to consume shared recruiter/business defaults
  - removed recruiter create-flow company fallback literal in `src/app/(recruiter)/recruiter/create/page.tsx`
- Phase 2 active board added:
  - `docs/05-quality/production_remediation_phase2_board_2026-03-25.md`

### 2026-03-25 (P1-2 Completed / P1-3 Started)

- `P1-2` moved to `Done`.
- Removed the last recruiter create-flow identity fallback literal by sourcing the default recruiter name from shared config:
  - `src/app/(recruiter)/recruiter/create/page.tsx`
- `P1-3` moved to `In Progress`.
- First schema-tightening slice landed in shared domain and tips contracts:
  - `src/lib/domain/schemas.ts`
  - `src/lib/server/services/tips-service.ts`
- Replaced broad `z.any()` usage in the first pass with permissive structured schemas for:
  - competencies
  - scoring dimensions
  - rating bands
- Tightened the answer-submit route boundary to use the shared analysis schema:
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
- Added focused regression coverage for invalid analysis payload rejection:
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.test.ts`
- Tightened the recruiter template repository boundary by validating persisted template question payloads:
  - `src/lib/server/infrastructure/supabase-template-repository.ts`
- Replaced the duplicated strong-response route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/response/generate/route.ts`
- Added focused route coverage for the shared strong-response request schema:
  - `src/app/api/response/generate/route.test.ts`
- Replaced the duplicated question-generation route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/questions/generate/route.ts`
- Unified the tips request contract by removing service/domain duplication and moving the route onto a shared domain request schema:
  - `src/lib/domain/schemas.ts`
  - `src/lib/server/services/tips-service.ts`
  - `src/app/api/tips/generate/route.ts`
- Added focused route coverage for the shared tips request schema:
  - `src/app/api/tips/generate/route.test.ts`
- Verified the analysis route now uses the shared domain request schema and aligned its focused tests to the current auth path:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/analysis/route.ts`
  - `src/app/api/analysis/route.test.ts`
- Replaced the duplicated invite send and invite resend route request schemas with shared domain schemas:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/invite/send/route.ts`
  - `src/app/api/invite/resend/route.ts`
- Added focused resend-route coverage for the shared invite resend request schema:
  - `src/app/api/invite/resend/route.test.ts`
- Replaced the duplicated question retry and question analysis route request schemas with shared domain schemas:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/retry/route.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/analysis/route.ts`
- Verified focused retry and question-analysis route coverage after the shared-schema consolidation:
  - `src/app/api/session/[session_id]/questions/[question_id]/retry/route.test.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/analysis/route.test.ts`
- Replaced the duplicated TTS route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/tts/route.ts`
- Replaced the duplicated recruiter invite-create route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/recruiter/invites/route.ts`
- Replaced the duplicated answer-submit route request schema with a shared domain schema:
  - `src/lib/domain/schemas.ts`
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
- Enriched the shared provider malformed-response path with explicit error kinds:
  - `src/lib/server/provider-errors.ts`
  - `src/lib/server/provider-response.ts`
- Updated AI-service fallback handling to distinguish malformed provider output from runtime failures in logs and metrics:
  - `src/lib/server/services/ai-service.ts`
- Added focused provider/AI malformed-response coverage:
  - `src/lib/server/services/provider-response.test.ts`
  - `src/lib/server/services/ai-service.test.ts`
- Propagated malformed-response classification through the remaining provider-backed services and question-generation route:
  - `src/lib/server/services/strong-response-service.ts`
  - `src/lib/server/services/tips-service.ts`
  - `src/lib/server/services/email-service.ts`
  - `src/app/api/questions/generate/route.ts`
- Added focused classification coverage for those seams:
  - `src/lib/server/services/strong-response-service.test.ts`
  - `src/lib/server/services/tips-service.test.ts`
  - `src/lib/server/services/email-service.test.ts`
  - `src/app/api/questions/generate/route.provider.test.ts`
- Intentionally kept the draft-save request payload local:
  - `src/app/api/session/[session_id]/questions/[question_id]/answer/route.ts`
  - rationale: it is a one-off route-local persistence DTO rather than a shared contract, so promoting it would add indirection without reducing meaningful drift

### 2026-03-25 (P1-3 Completed / P1-4 Started)

- `P1-3` moved to `Done`.
- Closure rationale:
  - no remaining `z.any()` usage surfaced in `src`
  - critical request-schema drift on live recruiter/candidate routes was consolidated into shared domain schemas
  - malformed provider output is now classified consistently as typed `ProviderResponseError` kinds and tracked as `malformed_response` across the critical AI/service/route seams
  - the remaining local draft-save payload is intentionally route-local and not worth centralizing
- `P1-4` moved to `In Progress`.
- Baseline assessment completed for the current metrics path:
  - `src/lib/server/metrics.ts` stores counters/timings in process-local `globalThis` maps
  - `src/app/api/recruiter/ops/metrics/route.ts` exposes that in-memory snapshot and derived dashboard
  - current metrics reset on process restart and cannot aggregate across instances
  - current operations dashboard does not yet provide durable incident-correlation support
- Bounded `P1-4` design note added:
  - `docs/05-quality/durable_metrics_plan_2026-03-25.md`
  - recommendation: dual-write with Postgres/Supabase durable rollups while preserving the current instrumentation surface
- First `P1-4` implementation slice landed:
  - `src/lib/server/metrics/backend.ts`
  - `src/lib/server/metrics/types.ts`
  - `src/lib/server/metrics.ts`
  - `src/app/api/recruiter/ops/metrics/route.ts`
  - `supabase/migrations/20260325_add_metrics_rollups.sql`
- Current slice status:
  - existing metric call sites still write to in-memory state
  - optional Supabase durable sink is now available behind `METRICS_BACKEND=supabase`
  - recruiter ops metrics route now reads the durable-aware snapshot helper
  - focused metrics backend and ops-route tests landed
- Deployed durable-metrics validation completed:
  - metrics rollup migration applied successfully in Supabase production
  - durable counter rollups observed for `session_start_total`
  - durable timing rollups observed for `ai_request_duration_ms` across:
    - `analysis`
    - `session_summary`
    - `strong_response`
    - `tips`
    - `tts`
  - durable write path, read path, and deployed env configuration are now confirmed
- Initial SLO proposal added:
  - `docs/05-quality/initial_slos_2026-03-26.md`
  - proposed first SLO set:
    - session start availability
    - in-session progress reliability
    - AI assist reliability
    - AI assist latency
- Added explicit submit-outcome instrumentation for the in-session progress SLO:
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts`
  - metric family: `session_submit_total`
  - current outcomes:
    - `success`
    - `replay_success`
    - `invalid_request`
    - `request_in_progress`
    - `idempotency_mismatch`
    - `error`
- Added focused submit-route outcome coverage:
  - `src/app/api/session/[session_id]/questions/[question_id]/submit/route.test.ts`
- Added SQL-backed SLO summary functions and ops-route summary payload:
  - `supabase/migrations/20260325_add_metrics_rollups.sql`
  - `src/lib/server/metrics/backend.ts`
  - `src/lib/server/metrics.ts`
  - `src/app/api/recruiter/ops/metrics/route.ts`
- The ops route now returns `sloSummary` in addition to snapshot/dashboard/alerts.

### 2026-03-26 (P1-4 Completed)

- `P1-4` moved to `Done`.
- Applied and validated the updated metrics rollup migration with SQL-backed SLO summary functions in Supabase production.
- Confirmed production summary queries return sensible data for:
  - session start availability
  - in-session progress reliability
  - AI assist reliability
  - AI assist latency
- Confirmed the durable metrics path now covers:
  - counter rollups
  - timing rollups
  - submit-outcome instrumentation
  - SQL-backed SLO summaries
  - recruiter ops summary payloads
- Remaining threshold calibration and denominator tuning is now ongoing operational policy work, not unresolved remediation scope.

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
| 2026-03-25 | `P0-1` closes only after deployed recruiter and candidate routes both return `429 RATE_LIMITED` under load against the shared limiter | P0-1 | Prevents false closure based on local tests or migration-only rollout |
| 2026-03-25 | Invite batch creation will surface deterministic mixed results immediately, with deeper transaction/batch-record semantics evaluated as a follow-on within `P0-2` | P0-2 | Improves user-visible correctness before full persistence model redesign |
| 2026-03-25 | `P0-2` closes for the initial rollout at deterministic mixed-result semantics with idempotent partial replay; deeper batch infrastructure is deferred to ATS integration work | P0-2 | Keeps the remediation scope proportional to the rollout and avoids speculative persistence redesign |

---

## Blocker Log

| Date | Blocker | Impacted Items | Owner | Resolution |
|------|---------|----------------|-------|------------|
| 2026-03-25 | None yet logged | - | - | - |

---

## Release Gate

Initial remediation gate is satisfied when all of the following are true:

- [x] `P0-1` is complete
- [x] `P0-2` is complete
- [x] `P0-3` is complete
- [x] failure-mode tests for invite flow are passing
- [x] env/auth startup contract is documented in operational docs

---

## Administration Notes

- Update this tracker at least once per week while remediation is active.
- When an item moves to `Done`, also update linked runbooks, ADRs, and quality docs if impacted.
- Do not mark a P0 item done until code, tests, and documentation are all complete.
