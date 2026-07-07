# Candidate Login Redirect Contract

Date: 2026-05-08
Status: Integration contract needed

## Purpose

This document defines the desired behavior for public candidate calls to action that must send a candidate through TalentArbor login and then return them to the selected Interview Coach destination.

## Confirmed External Entry

The candidate login entry point requested by the team is:

```text
https://talentarbor.com/Auth/LoginWithType/2
```

That URL resolves to `https://talentarbor.com/login` and renders the candidate login variant.

For context only, the employer/support provider/talent partner variant currently uses `LoginWithType/3`.

## Desired CTA Behavior

| Public CTA | External login target | Post-login Interview Coach target |
| --- | --- | --- |
| Start practicing | `https://talentarbor.com/Auth/LoginWithType/2` | `https://interviewcoach.talentarbor.com/candidate/setup` |
| Review dashboard | `https://talentarbor.com/Auth/LoginWithType/2` | `https://interviewcoach.talentarbor.com/candidate/dashboard` |

## Preferred App Flow

The candidate app should not hard-code unvalidated external redirect URLs directly into every CTA. Prefer an internal start route:

```text
/auth/talentarbor/start?next=/candidate/setup
/auth/talentarbor/start?next=/candidate/dashboard
```

That route should:

1. Validate `next` against an allowlist of internal candidate routes.
2. Create or sign a short-lived login intent if the integration supports state.
3. Redirect to the TalentArbor candidate login endpoint with the return target in the format the TalentArbor team confirms.
4. Receive or validate the authenticated candidate handoff.
5. Resolve a candidate profile and redirect to the original `next` target.

## Integration Contract Needed

The TalentArbor/RangamWorks integration team needs to confirm:

- whether `LoginWithType/2` accepts a return URL, callback URL, state value, or equivalent parameter
- whether the parameter survives the intermediate redirect to `/login`
- whether the post-login redirect can target `https://interviewcoach.talentarbor.com`
- how the Interview Coach app receives identity after login: OIDC, SAML, signed token, server-to-server session exchange, shared cookie, or another handoff
- whether return URLs are allowlisted by host and path
- what happens when login succeeds but the return target is missing, invalid, expired, or blocked
- whether `/candidate/dashboard` should be the default return target for authenticated candidate launches

## Security Requirements

- Never trust an arbitrary `returnUrl` or `next` query value.
- Allow only internal paths such as `/candidate/setup`, `/candidate/dashboard`, `/candidate/session/[id]`, and `/candidate/summary/[id]`.
- Do not allow protocol-relative, absolute, external, or encoded external destinations.
- Use signed or server-stored state if the external login can round-trip state.
- Expire login intents quickly.
- Do not put secrets, raw resume data, or candidate PII in redirect query strings.
- Log auth failures with non-sensitive reason codes.

## Fallback If Return Targets Are Not Supported

If TalentArbor login cannot preserve a return target yet:

- both public CTAs should route to candidate login
- successful login should default to `/candidate/dashboard`
- the dashboard should prominently offer "Start a new practice" until return-target support exists
- the missing return-target behavior should remain an integration blocker for the smoother `/practice` CTA path

## Local Development Behavior

Local dev auth should simulate the same contract:

```text
/auth/dev/start?next=/candidate/setup
/auth/dev/start?next=/candidate/dashboard
```

The same allowlist and redirect behavior should apply in local mode so route protection and return-after-login are testable before external SSO is available.

## Current Implementation Notes

- `/auth/talentarbor/start` stores only allowlisted candidate paths in the short-lived `ic_candidate_login_next` cookie before redirecting to `LoginWithType/2`.
- `/auth/callback` normalizes the `next` value through the same candidate allowlist before redirecting. Unsafe absolute, protocol-relative, query-bearing, fragment-bearing, API, recruiter, admin, or QA paths fall back to `/candidate/dashboard`.
- The actual external identity handoff remains open until the TalentArbor/RangamWorks team confirms the supported return/state/callback contract.

## Acceptance Criteria

- Public `Start practicing` initiates candidate login and returns an authenticated candidate to `/candidate/setup`.
- Public `Review dashboard` initiates candidate login and returns an authenticated candidate to `/candidate/dashboard`.
- Invalid `next` values fall back to `/candidate/dashboard` or fail safely.
- Authenticated candidates who open `/candidate/setup` or `/candidate/dashboard` directly do not loop back to login.
- Unauthenticated direct access to protected candidate routes preserves the intended target through login when the integration supports it.
