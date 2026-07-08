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

### Host Launch Token

The July 6, 2026 integration discussion clarified the expected production handoff shape:

- TalentArbor/RangamWorks will redirect the candidate to Interview Coach with a token in a query parameter.
- The token is expected to be long and URL-safe.
- The token is expected to be JWT-like and signed with a shared secret stored only on the TalentArbor/RangamWorks server side and the Interview Coach server side.
- Interview Coach must verify the token signature server-side before trusting any claim.
- The token includes expiry.
- The token includes a product claim. Interview Coach should validate that the product is Interview Coach, but it does not need to store the product value.
- The token payload should identify the candidate enough to resolve or create an Interview Coach candidate profile and map that profile to host-side identity such as email, user id, candidate id, TalentArbor id, or RangamWorks id.
- If a host-authenticated candidate is new to Interview Coach, Interview Coach creates the candidate profile/identity mapping after token verification.
- After verification and profile resolution, Interview Coach should establish its own candidate session and redirect to a canonical candidate route without leaving the token-bearing URL in normal navigation.

Current V2 scaffold:

- [Host launch contract](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.ts)
- [Host launch contract tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.test.ts)

The scaffold intentionally injects the token verifier until the exact payload, query parameter name, JWT algorithm, and secret-management contract are confirmed.

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

- `CANDIDATE_AUTH_MODE=dev` for the seeded primary local candidate
- `CANDIDATE_AUTH_MODE=password` with `CANDIDATE_DEV_EMAIL`, optional `CANDIDATE_DEV_SUBJECT`, and optional `CANDIDATE_DEV_DISPLAY_NAME`
- `CANDIDATE_AUTH_MODE=mock` with optional `CANDIDATE_MOCK_EMAIL` and `CANDIDATE_MOCK_DISPLAY_NAME`

These modes are local/test only; production still fails closed through candidate runtime config.

Current route protection:

- [Shared auth middleware](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/auth/middleware.ts)
- [Shared auth middleware tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/auth/middleware.test.ts)

The middleware keeps recruiter/admin/QA auth separate from candidate routes. Candidate protected routes redirect through `/auth/talentarbor/start` when `CANDIDATE_AUTH_MODE=external`, while explicit local `dev`, `mock`, or `password` modes are allowed through for development.

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

- What is the exact token query parameter name?
- Which JWT algorithm will TalentArbor/RangamWorks use?
- What are the exact payload claim names and required/optional fields?
- What are the issuer, audience, and product claim values?
- What expiry duration and clock-skew tolerance should Interview Coach accept?
- Are launch tokens single-use, replay-protected, or valid until expiry?
- Does the launch token include the intended route, or does Interview Coach always default to `/candidate/dashboard` or `/candidate/setup`?
- Does the launch token include job/req/JD/resume context, or will Interview Coach fetch that context separately after identity resolution?
- What is the shared-secret rotation plan?
- Does `LoginWithType/2` support a return URL, callback URL, or signed state parameter?
- Will the shared identity source live inside this app database or a separate candidate platform service?
- Should candidate logout return to TalentArbor, clear only Interview Coach state, or both?
