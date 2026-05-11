# Authenticated Candidate Access

Date: 2026-05-07
Status: Working requirements

## Purpose

This document defines the candidate access model needed before `/practice`, `/dashboard`, `/session/[sessionId]`, settings, and history routes become real persisted product surfaces.

## User Goal

As a candidate, I want to open the Interview Coach from RangamWorks or a standalone TalentArbor entry point, access my own practice data, and return later without losing setup or session progress.

## Current Priority

The first production-facing target is TalentArbor/RangamWorks authenticated access that can hand a candidate back to `https://interviewcoach.talentarbor.com`.

Standalone direct auth is still needed during development. A separate public `talentarbor.ai` auth mode is no longer the current deployment assumption.

## Entry Modes

### Public TalentArbor Candidate Login

Expected behavior:

- candidate clicks a public CTA on `/`
- app starts candidate login through `https://talentarbor.com/Auth/LoginWithType/2`
- login resolves the candidate variant at `https://talentarbor.com/login`
- successful login redirects back to the selected Interview Coach target, such as `/practice` or `/dashboard`
- app resolves or creates a candidate profile before rendering protected routes

See [Candidate Login Redirect Contract](./candidate-login-redirect-contract.md).

### RangamWorks SSO

Expected behavior:

- candidate enters from RangamWorks or another approved portal in an already authenticated state
- app receives or resolves a trusted identity assertion
- app maps the external identity to a candidate profile
- default candidate landing route is `/dashboard`
- logout or back-navigation behavior aligns with the portal contract

### Standalone Dev Auth

Expected behavior:

- developer can sign in with a local seeded candidate account
- auth uses Postgres-backed sessions
- route ownership checks behave like production
- dev auth does not depend on Supabase

### Mock Candidate Mode

Expected behavior:

- enabled only by explicit local/test environment flags
- resolves to a stable candidate profile
- never ships as a production default
- useful for UI and browser-flow work before SSO is available

## Protected Routes

These routes require candidate access:

- `/practice`
- `/dashboard`
- `/settings`
- `/session/[sessionId]`
- summary/history routes once persisted

`/` remains public.

These route paths are top-level siblings of recruiter/admin/QA routes on `https://interviewcoach.talentarbor.com`; see [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md).

## Access Resolution Contract

Protected routes should resolve one authenticated candidate context:

```ts
type CandidateAccessContext = {
  candidateProfileId: string;
  authSubject: string;
  email: string;
  displayName: string | null;
  workspace: "rangamworks" | "talentarbor" | "local_dev";
  provider: "rangamworks_sso" | "talentarbor_login" | "password" | "dev_mock";
};
```

Feature code should consume this context instead of reading cookies, provider-specific claims, or raw user IDs directly.

Current auth adapter boundary:

- [Candidate auth adapter](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-auth-adapter.ts)
- [Candidate auth adapter tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-auth-adapter.test.ts)
- [Candidate dev auth resolver](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-dev-auth-resolver.ts)
- [Candidate dev auth resolver tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-dev-auth-resolver.test.ts)

Adapters should resolve a provider-neutral `CandidateAuthHandoff` with `provider`, `issuer`, `subject`, `email`, `displayName`, and `workspace`, then pass normalized values into the candidate profile repository.

Local development can now produce the same handoff shape through:

- `CANDIDATE_AUTH_MODE=password` with `CANDIDATE_DEV_EMAIL`, optional `CANDIDATE_DEV_SUBJECT`, and optional `CANDIDATE_DEV_DISPLAY_NAME`
- `CANDIDATE_AUTH_MODE=mock` with optional `CANDIDATE_MOCK_EMAIL` and `CANDIDATE_MOCK_DISPLAY_NAME`

These modes are local/test only; production still fails closed through candidate runtime config.

Current route protection:

- [Shared auth middleware](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/auth/middleware.ts)
- [Shared auth middleware tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/auth/middleware.test.ts)

The middleware keeps recruiter/admin/QA auth separate from candidate routes. Candidate protected routes redirect through `/auth/talentarbor/start` when `CANDIDATE_AUTH_MODE=external`, while explicit local `mock` or `password` modes are allowed through for development.

## Acceptance Criteria

- unauthenticated access to protected routes redirects to the appropriate entry flow
- public CTAs preserve a safe post-login target when the TalentArbor login integration supports it
- authenticated candidates can only access their own drafts, sessions, resume assets, and dashboard history
- session ownership checks use `candidate_profile_id`
- local dev auth can create repeatable test candidates
- mock mode is impossible to enable accidentally in production
- auth denial events are observable without logging secrets or raw resume data

## Non-Goals

- recruiter login
- recruiter invite management
- Supabase auth
- anonymous guest trials
- recruiter/admin/QA auth implementation
- final enterprise SSO implementation details beyond the confirmed redirect/handoff contract

## Open Questions

- What exact protocol will TalentArbor/RangamWorks use to hand identity to Interview Coach after login?
- Does `LoginWithType/2` support a return URL, callback URL, or signed state parameter?
- Will the shared identity source live inside this app database or a separate candidate platform service?
- Should candidate logout return to TalentArbor, clear only Interview Coach state, or both?
