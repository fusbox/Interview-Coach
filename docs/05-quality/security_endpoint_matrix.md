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
  - rate-limit coverage (explicit vs missing)
  - risk classification and P0 flag

## Endpoint Inventory Matrix

| Route | Method | Mutable? | Intended Actor | Current AuthN/AuthZ | Request Validation | Response Validation | Rate Limit | Risk | P0 Gap Summary |
|---|---|---:|---|---|---|---|---|---|---|
| `/api/analysis` | POST | Yes | Candidate/App backend | **None** | Zod `AnalyzeAnswerSchema.safeParse` | None | None | High | Unauthenticated AI-use endpoint + no abuse controls. |
| `/api/dev/export-session/[sessionId]` | GET | Read (sensitive export) | Internal demo user | `showDemoTools()` flag only (no identity check) | Param only | Typed payload assembly only | None | High | Sensitive export path gated by env flag, not principal auth. |
| `/api/invite/send` | POST | Yes | Recruiter | Supabase user auth + session ownership check | Strict Zod schema (`InviteSendSchema.safeParse`) | Sanitized error envelope with correlationId | Per-IP + per-user fixed-window limits | Medium | P0 remediated; monitor for distributed rate-limit hardening in infra tier. |
| `/api/questions/generate` | POST | Yes (AI compute) | Recruiter/Candidate flow | **None** | Minimal `role` presence check only | None | None | High | Public AI endpoint with weak validation and no throttling. |
| `/api/recruiter/invites` | POST | Yes | Recruiter | Supabase `auth.getUser()`; **dev bypass to static UUID in dev** | Zod `.parse` on request | None | None | **Critical** | Mutation has bypass path and no explicit throttling/idempotency. |
| `/api/response/generate` | POST | Yes (AI compute) | Candidate/App | **None** | Zod `GenerateStrongResponseSchema.safeParse` | None | None | High | Public AI endpoint without auth/rate limit. |
| `/api/session/[session_id]/questions/[question_id]/analysis` | POST | Yes | Candidate | Candidate token via `validatedSessionHandler` | No route-local schema (body shape implicit) | None | None | Medium | Auth present; validation/rate limits missing for heavy compute call. |
| `/api/session/[session_id]/questions/[question_id]/answer` | PUT | Yes | Candidate | Candidate token via `validatedSessionHandler` | Zod `.parse` (`DraftSchema`) | None | None | Medium | Auth + schema present; no rate limit/idempotency policy. |
| `/api/session/[session_id]/questions/[question_id]/retry` | POST | Yes | Candidate | Candidate token via `validatedSessionHandler` | Optional context schema (route-local parse) | None | None | Medium | Auth present; retry abuse/race protections not explicit. |
| `/api/session/[session_id]/questions/[question_id]/submit` | POST | Yes | Candidate | Candidate token via `validatedSessionHandler` | Zod `.parse` inline object | None | None | High | Auth present but no idempotency key; duplicate submit risk remains. |
| `/api/session/[session_id]` | GET | Read | Candidate | Candidate token via `requireCandidateToken` | N/A | None | None | Low | Auth enforced; observability/error envelope still inconsistent. |
| `/api/session/[session_id]` | PATCH | Yes | Candidate | Candidate token via `requireCandidateToken` | Zod `UpdateSessionSchema.safeParse` | None | None | Medium | Auth + schema present; no rate-limit/idempotency envelope. |
| `/api/session/start` | POST | Yes | Candidate/Recruiter invite flow | **None** | Zod `InitSessionSchema.safeParse` | None | None | High | Session creation + token issuance available without principal auth/rate limits. |
| `/api/tips/generate` | POST | Yes (AI compute) | Candidate/App | **None** | Zod `GenerateTipsSchema.safeParse` | None | None | High | Public AI endpoint; no auth/rate limiting controls. |
| `/api/tts` | POST | Yes (AI compute) | Candidate/App | **None** | Manual `text` presence only | Binary response only | None | High | Public TTS endpoint with weak validation + verbose error details. |

## Security Coverage Summary

- Total endpoints (method-level rows): **15**
- Endpoints with explicit authentication enforcement: **7/15**
- Endpoints with strong schema validation (Zod parse/safeParse): **10/15**
- Endpoints with explicit rate limiting: **1/15**
- Endpoints flagged P0/Critical: **1**

## P0 Determination Criteria

An endpoint is P0 in this matrix if it combines:
1. mutating side effects, and
2. inadequate authn/authz or known bypass, and
3. high abuse blast radius (email, invitation issuance, or account/session lifecycle impact).

## Immediate Actions Required from Matrix

1. ✅ Completed: Lock down `/api/invite/send` with recruiter auth, strict schema, and rate-limit controls.
2. Remove/replace development bypass logic in `/api/recruiter/invites` runtime path.
3. Add baseline throttling policy to all AI compute endpoints (`analysis`, `questions/generate`, `response/generate`, `tips/generate`, `tts`).
4. Define and apply idempotency policy to invite and submit-related mutations.
