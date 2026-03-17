# P0 Security Issue List (Step 1.1 Deliverable)

Date: 2026-03-17  
Source: `docs/05-quality/security_endpoint_matrix.md`

## P0-1 - Unauthenticated Email Send Surface (`/api/invite/send`)

- **Severity:** P0 / Critical
- **Owner:** Backend Lead (primary), Product Security (review), SRE (rate-limit implementation)
- **Deadline:** 2026-03-20
- **Why P0:** Endpoint can trigger outbound email operations and update invitation state without principal authentication, formal schema validation, or throttling.
- **Current Risk:** Abuse/spam relay, unauthorized invitation state mutation, operational reputation damage.

### Required Remediation Tasks
1. Require authenticated recruiter principal.
2. Enforce recruiter-level authorization for referenced `sessionIds`.
3. Replace manual field checks with strict Zod request schema.
4. Add per-IP + per-user rate limits and burst protection.
5. Add structured audit log fields (`actorId`, `recipientCount`, `correlationId`, `outcome`).
6. Return sanitized error envelope (no internal details).

### Verification / Exit Criteria
- Unauthorized request returns 401/403.
- Invalid schema returns 400 with structured validation payload.
- Rate-limit breach returns 429.
- Integration tests cover auth failure, validation failure, rate-limit hit, success path.

### Status
- **State:** Completed
- **Completed On:** 2026-03-17
- **Evidence:**
  - Authenticated recruiter requirement enforced in route implementation.
  - Recruiter ownership checks added for referenced `sessionIds`.
  - Strict Zod payload validation added.
  - Per-IP and per-user rate limits enforced.
  - Sanitized error envelope (`code`, `message`, `correlationId`, `retryable`) returned.
  - Integration-style route tests added for 401/400/403/429/200 paths.

---

## P0-2 - Recruiter Invite Creation Dev Bypass (`/api/recruiter/invites`)

- **Severity:** P0 / Critical
- **Owner:** Backend Lead (primary), Tech Lead (code review), QA/SET Lead (regression tests)
- **Deadline:** 2026-03-21
- **Why P0:** Runtime path contained a development bypass that substituted a static UUID when authentication was absent in development mode.
- **Current Risk:** Elevated chance of bypass misuse, accidental promotion patterns, and fragile auth guarantees in mutation flow.

### Required Remediation Tasks
1. Remove runtime auth bypass block from route logic.
2. Move any testing shortcuts to non-production mock harnesses only.
3. Add explicit role/ownership authorization checks for invite creation scope.
4. Add idempotency key support for invite creation POST.
5. Add rate limits on invite creation endpoint.
6. Add regression test proving unauthenticated calls are rejected in all runtime environments.

### Verification / Exit Criteria
- No code path allows invite creation without authenticated user context.
- Duplicate retries with same idempotency key do not create duplicate invites.
- Endpoint returns 429 on configured throttle thresholds.
- Regression test fails if bypass logic is reintroduced.

### Status
- **State:** Completed
- **Completed On:** 2026-03-17
- **Evidence:**
  - Runtime auth bypass removed from `POST /api/recruiter/invites`; unauthenticated callers now receive a sanitized `401` in every environment.
  - Invite creation is bound to the authenticated recruiter principal and persisted through the standard recruiter-scoped repository path only.
  - Per-IP and per-user fixed-window rate limits added to the route.
  - `Idempotency-Key` support added with a server-side ledger and replay semantics for duplicate invite-create retries.
  - Recruiter create flow now sends an `Idempotency-Key` header so UI retries and double-submits reuse the same server request identity.
  - Regression and success-path route tests added for 401, 400, 429, replayed 200, and fresh 200 execution paths.

---

## P0 Tracking Cadence

- **Daily status owner sync:** Backend Lead + Product Security
- **Checkpoint date:** 2026-03-19 (midpoint)
- **Completion review:** 2026-03-21
- **Escalation trigger:** Any missed acceptance criterion by deadline or unresolved auth/rate-limit gap.
