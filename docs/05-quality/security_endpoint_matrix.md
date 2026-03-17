# Security Endpoint Matrix (Step 1.1 Deliverable)

Date: 2026-03-17  
Scope: `src/app/api/**` routes in the current codebase.

## Methodology
- Inventory source: all route handlers under `src/app/api`.
- Classification dimensions:
  - mutability (read vs write side effects)
  - actor type (anonymous, candidate token, recruiter auth)
  - authentication/authorization enforcement
  - request validation coverage
  - response validation / error-contract hygiene
  - rate-limit coverage (explicit vs missing)
  - risk classification and P0 flag

## Endpoint Inventory Matrix

| Route | Method | Mutable? | Intended Actor | Current AuthN/AuthZ | Request Validation | Response Validation | Rate Limit | Risk | P0 Gap Summary |
|---|---|---:|---|---|---|---|---|---|---|
| `/api/analysis` | POST | Yes | Candidate/App backend | Candidate token bound to `sessionId` in request | Zod `AnalyzeAnswerSchema.safeParse` + `sessionId` requirement | Sanitized error envelope with correlationId | Per-IP fixed-window limits | Medium | Public abuse path remediated; route now requires valid candidate session context. |
| `/api/dev/export-session/[sessionId]` | GET | Read (sensitive export) | Internal demo user | `showDemoTools()` flag only (no identity check) | Param only | Typed payload assembly only | None | High | Sensitive export path gated by env flag, not principal auth. |
| `/api/invite/send` | POST | Yes | Recruiter | Supabase user auth + session ownership check | Strict Zod schema (`InviteSendSchema.safeParse`) | Sanitized error envelope with correlationId | Per-IP + per-user fixed-window limits | Medium | P0 remediated; monitor for distributed rate-limit hardening in infra tier. |
| `/api/questions/generate` | POST | Yes (AI compute) | Recruiter | Recruiter auth via Supabase user session | Minimal `role` presence check only | Sanitized error envelope with correlationId | Per-IP fixed-window limits | Medium | Public abuse path remediated; route remains a validation-hardening candidate for Phase 3. |
| `/api/recruiter/invites` | POST | Yes | Recruiter | Supabase user auth required; invite ownership bound to authenticated recruiter ID | Strict Zod schema (`CreateInviteSchema.safeParse`) | Sanitized error envelope with correlationId | Per-IP + per-user fixed-window limits | Medium | P0 remediated; route now supports `Idempotency-Key` replay via server ledger, with broader distributed hardening tracked in Phase 2. |
| `/api/response/generate` | POST | Yes (AI compute) | Candidate/App | Candidate token bound to `sessionId` in request | Zod `GenerateStrongResponseSchema.safeParse` + `sessionId` requirement | Sanitized error envelope with correlationId | Per-IP fixed-window limits | Medium | Public abuse path remediated; candidate coaching remains scoped to the owning magic-link session. |
| `/api/session/[session_id]/questions/[question_id]/analysis` | POST | Yes | Candidate | Candidate token via `validatedSessionHandler` | No route-local schema (body shape implicit) | Sanitized error envelope with correlationId | None | Medium | Auth present; validation/rate limits missing for heavy compute call. |
| `/api/session/[session_id]/questions/[question_id]/answer` | PUT | Yes | Candidate | Candidate token via `validatedSessionHandler` | Zod `.parse` (`DraftSchema`) | Sanitized error envelope with correlationId | None | Medium | Auth + schema present; no rate limit/idempotency policy. |
| `/api/session/[session_id]/questions/[question_id]/retry` | POST | Yes | Candidate | Candidate token via `validatedSessionHandler` | Optional context schema (route-local parse) | Sanitized error envelope with correlationId | None | Medium | Auth present; retry abuse/race protections not explicit. |
| `/api/session/[session_id]/questions/[question_id]/submit` | POST | Yes | Candidate | Candidate token via `validatedSessionHandler` | Zod `.parse` inline object | Sanitized error envelope with correlationId | None | High | Auth present but no idempotency key; duplicate submit risk remains. |
| `/api/session/[session_id]` | GET | Read | Candidate | Candidate token via `requireCandidateToken` | N/A | Sanitized error envelope with correlationId | None | Low | Auth enforced; rate limiting and broader telemetry remain open. |
| `/api/session/[session_id]` | PATCH | Yes | Candidate | Candidate token via `requireCandidateToken` | Zod `UpdateSessionSchema.safeParse` | Sanitized error envelope with correlationId | None | Medium | Auth + schema present; no rate-limit/idempotency envelope. |
| `/api/session/start` | POST | Yes | Candidate invite flow / practice-again clone | Conditional auth: clone flow requires current candidate token for `parentId`; initial bootstrap remains anonymous | Zod `InitSessionSchema.safeParse` | Sanitized error envelope with correlationId | Per-IP fixed-window limits | Medium | Practice-again token generation is now bound to the current candidate session; anonymous first-session bootstrap remains intentionally rate-limited rather than login-gated. |
| `/api/tips/generate` | POST | Yes (AI compute) | Candidate/App | Candidate token bound to `sessionId` in request | Zod `GenerateTipsSchema.safeParse` + `sessionId` requirement | Sanitized error envelope with correlationId | Per-IP fixed-window limits | Medium | Public abuse path remediated; candidate coaching remains scoped to the owning magic-link session. |
| `/api/tts` | POST | Yes (AI compute) | Candidate/App | Candidate token via header + `x-session-id` binding | Manual `text` presence only + `x-session-id` requirement | Binary success response; sanitized error envelope with correlationId on failure | Per-IP fixed-window limits | Medium | Public abuse path remediated; validation depth remains a later hardening task. |

## Security Coverage Summary

- Total endpoints (method-level rows): **15**
- Endpoints with explicit authentication enforcement: **14/15**
- Endpoints with strong schema validation (Zod parse/safeParse): **10/15**
- Endpoints with explicit rate limiting: **8/15**
- Endpoints flagged P0/Critical: **0**

## P0 Determination Criteria

An endpoint is P0 in this matrix if it combines:
1. mutating side effects, and
2. inadequate authn/authz or known bypass, and
3. high abuse blast radius (email, invitation issuance, or account/session lifecycle impact).

## Immediate Actions Required from Matrix

1. Completed: Lock down `/api/invite/send` with recruiter auth, strict schema, and rate-limit controls.
2. Completed: Remove the `/api/recruiter/invites` development auth bypass and add invite-create throttling plus idempotent replay support.
3. Completed: add baseline throttling and principal binding to the remaining public AI compute endpoints (`analysis`, `questions/generate`, `response/generate`, `tips/generate`, `tts`).
4. Extend idempotency coverage to submit-related candidate mutations and move replay storage to the broader Phase 2.4 platform standard if multi-instance deployment requires it.
