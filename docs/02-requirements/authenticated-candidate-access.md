# Authenticated Candidate Access

Date: 2026-05-07
Status: Current V2 requirements; upstream TalentArbor launch details remain an external acceptance gate

## Purpose

This document defines the authenticated candidate access model for the persisted `/candidate/*` product surfaces.

## User Goal

As a candidate, I want to launch Interview Coach from a trusted TalentArbor surface, access only my own practice data, and return later without losing setup or session progress.

## Current Priority

The first production-facing target is a TalentArbor authenticated quick-link that hands a short-lived signed launch assertion to `https://interviewcoach.talentarbor.com/candidate/launch`.

RangamWorks uses related platform data but remains disabled until its identity namespace and source contract are independently ratified. Development uses the explicit dev host-launch fixture path; the candidate app does not maintain a second password or mock-auth product.

## Entry Modes

### Host Launch Token

The July 6, 2026 integration discussion clarified the expected production handoff shape:

- TalentArbor/RangamWorks will redirect the candidate to Interview Coach with a token in a query parameter.
- The token is expected to be long and URL-safe.
- The token is expected to be JWT-like and signed with a shared secret stored only on the TalentArbor/RangamWorks server side and the Interview Coach server side.
- Interview Coach must verify the token signature server-side before trusting any claim.
- The token includes standard numeric `iat` and `exp` claims. Interview Coach currently accepts at most a two-minute launch lifetime.
- The token includes a product claim. Current integration understanding expects `product: "interview-coach"`. Interview Coach should validate that the product is Interview Coach, but it does not need to store the product value.
- The token payload should identify the candidate enough to resolve or create an Interview Coach candidate profile and map that profile to host-side identity such as email, user id, candidate id, TalentArbor id, or RangamWorks id.
- If a host-authenticated candidate is new to Interview Coach, Interview Coach creates the candidate profile/identity mapping after token verification.
- After verification and profile resolution, Interview Coach should establish its own candidate session and redirect to a canonical candidate route without leaving the token-bearing URL in normal navigation.
- The launch token is one-time. Interview Coach stores only a SHA-256 fingerprint plus optional issuer-scoped `jti`; a second exchange fails closed and cannot recover the first app session.
- A dashboard quick-link may identify only the candidate. Job-aware launch additionally carries `job_collection_id`, but job context is not an authentication prerequisite.

Current V2 scaffold:

- [Host launch contract](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.ts)
- [Host launch contract tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.test.ts)
- [Production host launch verifier boundary](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/production-host-launch-verifier.ts)
- [Production host launch verifier tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/production-host-launch-verifier.test.ts)
- [Production host launch runtime assembly](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/production-host-launch-runtime.ts)
- [Production host launch runtime tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/production-host-launch-runtime.test.ts)
- [Candidate launch session resolver boundary](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/candidate-launch-session-resolver.ts)
- [Candidate launch session resolver tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/candidate-launch-session-resolver.test.ts)
- [Host launch orchestrator boundary](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-orchestrator.ts)
- [Host launch orchestrator tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-orchestrator.test.ts)

The launch-context boundary remains injected, but the first production adapter is scoped specifically to TalentArbor direct MSSQL reads. RangamWorks remains a separate fail-closed adapter decision because its candidate namespace and catalog ownership are not yet fully ratified.

The exported `/candidate/launch` route now assembles production dependencies only when verifier, Postgres, and complete bounded TA MSSQL configuration are valid. It verifies production host tokens, resolves TA candidate/optional owned-job context, and uses the concrete candidate launch-session repository. RangamWorks and incomplete production configuration remain fail-closed.

Expected production env names:

- `CANDIDATE_HOST_LAUNCH_SECRET`: server-only shared signing secret.
- `CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER`: optional expected issuer, defaulting to `talentarbor` until the host contract is finalized.
- `CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE`: optional trusted workspace/source-portal value, defaulting to `talentarbor`.
- `CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS`: optional non-negative future-issued tolerance, defaulting to 30 seconds.
- `CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS`: optional launch-token ceiling, defaulting to 120 seconds and capped by code at 15 minutes.
- `CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS`: optional Interview Coach session lifetime, defaulting to and capped at seven days.
- `DATABASE_URL`: Interview Coach Postgres database URL used by the candidate launch-session repository.
- `CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER`, `CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE`, `CANDIDATE_HOST_LAUNCH_TA_SQL_USER`, and `CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD`: required server-only TalentArbor MSSQL connection values.
- `CANDIDATE_HOST_LAUNCH_TA_SQL_PORT`: optional port, defaulting to 1433.
- `CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT`: optional boolean, defaulting to `true`.
- `CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE`: optional boolean, defaulting to `false`; staging may require an explicit `true`, but production must not inherit that override silently.
- `CANDIDATE_HOST_LAUNCH_TA_SQL_CONNECT_TIMEOUT_MS`, `CANDIDATE_HOST_LAUNCH_TA_SQL_REQUEST_TIMEOUT_MS`, and `CANDIDATE_HOST_LAUNCH_TA_SQL_POOL_MAX`: optional bounded operational controls.

Current supported algorithm is `HS256`, verified through `jose` and matching the shared-secret direction from the integration transcript. This remains a boundary assumption until TalentArbor/RangamWorks confirms the exact JWT algorithm and secret rotation plan. Missing or invalid security/session configuration fails closed. Token verification returns telemetry-safe reasons such as `malformed_token`, `invalid_signature`, `invalid_product`, `invalid_issuer`, `invalid_source_portal`, `invalid_expiry`, `expired_token`, `issued_in_future`, and `token_lifetime_exceeded`; it must not log raw tokens or claim payloads.

Launch-context resolution is a separate boundary from token verification. TA staging DB discovery did not find a single existing proc/view that returns the full Interview Coach context from `CandidateID + JobCollectionID`. The first adapter therefore uses narrow parameterized reads rather than treating the broader draft `USP_InterviewCoach_GetLaunchContext` as deployed truth:

- identity-only launch selects only approved profile fields from `CandidateMaster` by the signed numeric candidate id;
- job-aware launch must additionally find the exact candidate/job pair in `CandidateJobCollectionTxn` and join that id to canonical TA `JobCollection` title and description;
- an asserted job that is missing, unowned, or missing canonical catalog context fails closed rather than degrading to identity-only launch;
- active/expired status is context, not authorization: candidates may prepare for owned historical job activity;
- duplicate or malformed lookup results fail closed;
- queries never select password, salt, SSN, birthdate, resume body, or unrelated candidate fields;
- the canonical database email and display name are profile attributes after candidate-id ownership is established. Email is never the ownership key.
- `CandidateMaster.CreatedBy` is not treated as a candidate user id without a separately ratified identity mapping.

Requirement, channel, consent, and resume joins are not launch prerequisites. Resume content remains a separate approved retrieval path before AI use.

Profile/session resolution is also a separate boundary. After the host token is verified and launch context is normalized, the app resolves an Interview Coach candidate profile through a traceable identity chain:

```text
host launch handoff
+ normalized launch context
-> launch identity key
-> candidate_profile_id
-> Interview Coach candidate session
```

The launch identity key is provider/issuer/subject plus trusted platform candidate identifiers, not email alone. New candidates can create a profile and upsert the host-launch identity mapping; existing candidates reuse the mapped profile. The resolver fails closed when token identity and launch context disagree, when a profile cannot be resolved or created, or when an app session cannot be created.

The V2 storage contract now has a concrete migration and repository adapter for this boundary:

- `candidate_identities` accepts `talentarbor_launch` and `rangamworks_launch`.
- host-launch identity rows store `host_candidate_id`, `host_user_id`, `platform_candidate_id`, and `workspace`.
- `candidate_launch_sessions` stores the app session id plus provider identity, candidate profile id, platform candidate id, nullable job collection id, source surface, host domain, independent app-session expiry, optional issuer-scoped token id, token expiry, SHA-256 token fingerprint, and compact launch-context JSON.
- unique token-fingerprint and issuer/token-id constraints make the launch exchange one-time without storing the raw token.
- `candidate_launch_setup_contexts` stores the immutable candidate-owned canonical role/JD snapshot for an owned job-aware launch. It is keyed to one launch session, expires with that session, and stores no resume content.
- host-backed prep profiles carry source platform, job collection id, optional requirement id, and source launch-session lineage; manual/dev paths remain keyed by normalized role/JD plus path ordinal.
- the repository adapter takes an injected query client; production `/candidate/launch` assembles that query client from `DATABASE_URL` and composes it with the TA-only host-data adapter.

Host launch orchestration now has a tested injectable boundary:

```text
signed token
-> token verifier
-> normalized host launch handoff
-> launch-context lookup from candidate/job hints
-> normalized launch context
-> candidate profile/session resolver
-> candidate session result for the route cookie
```

The exported production `/candidate/launch` route must remain fail-closed unless verifier/session config, `DATABASE_URL`, and the complete TalentArbor MSSQL configuration are all valid. The orchestration accepts candidate identity without a job hint for a dashboard quick-link. When `jobCollectionId` is present, the TA adapter must prove candidate ownership before returning job context. No production request may use browser-provided role, JD, email, or job text as a lookup substitute.

After exchange, the server chooses the entry route. Job-aware launch always enters `/candidate/setup`; identity-only launch enters setup when no candidate-owned prep contexts exist and otherwise enters `/candidate/dashboard`. Canonical job role/JD is staged in Postgres in the same transaction as the launch session, not in the URL, cookie, or compact session snapshot. Setup renders that context read-only and consumes it atomically with practice-session creation or an explicit existing-path selection. Identity-only setup may create a manual candidate-owned path, but it cannot claim host job identity.

### Candidate Journey Carrying Contract

The verified launch context remains traceable after redirect without exposing host identifiers as user-editable state:

- candidate identity retains provider, issuer, subject, workspace/source portal, and trusted platform candidate identifiers;
- the Interview Coach launch session retains bounded source surface, host domain, platform candidate id, and optional job collection id metadata;
- a host-backed prep profile retains source platform, job collection id, optional requirement id, and the source launch-session id that supplied its immutable role/JD snapshot;
- an identity-only candidate with no prep contexts continues through ordinary setup, while an identity-only returning candidate opens the dashboard;
- a job-aware candidate continues through ordinary setup with role and JD locked to the owned canonical host snapshot, while interview stage, question count, and optional candidate-supplied resume remain candidate choices.

Candidate-entered resume content is not authoritative host resume context. Host resume discovery, selection, labeling, versioning, and snapshot policy remain deferred until the host source-of-truth rule is ratified; no launch or setup path may infer that provenance from browser input.

Production launch responses carry a random bounded request id for diagnostic correlation. Application diagnostics may record that request id plus allowlisted phase, outcome, rejection reason, and canonical entry route only. They must not record the launch URL/token, token fingerprint/id, cookie/session value, candidate or job identifiers, email, role/JD/resume content, or provider response bodies. Browser responses remain generic on rejection; exact verification reasons are available only in server diagnostics.

Local development can exercise the same redirect shape with explicit dev-only host launch mode:

- `CANDIDATE_HOST_LAUNCH_DEV_MODE=true`
- `CANDIDATE_HOST_LAUNCH_DEV_SECRET=<local-only shared secret>`
- `/candidate/dev/launch?candidate=primary&next=/candidate/setup`
- `/candidate/dev/launch?candidate=alternate&next=/candidate/setup`

The dev route is unavailable unless the explicit mode and secret are present and `NODE_ENV` is not production. It mints a local HMAC-signed token shaped around `candidate_id`, `product`, `email`, and `exp`, then redirects through the normal `/candidate/launch` route so URL cleanup and session-cookie behavior stay aligned with production intent.

## Protected Routes

These routes require candidate access:

- `/candidate/setup`
- `/candidate/dashboard`
- `/candidate/session/[sessionId]`
- `/candidate/practice/ready`
- `/candidate/practice/ready/[intentId]`

`/` remains public. `/candidate/launch` is the production exchange entry point, and `/candidate/dev/launch` is an explicit nonproduction-only entry point. Invited-candidate routes use their own invitation access boundary rather than the authenticated candidate session.

These route paths are top-level siblings of recruiter/admin/QA routes on `https://interviewcoach.talentarbor.com`; see [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md).

## Access Resolution Contract

Protected feature code receives an opaque `candidateProfileId` from an app-owned candidate launch session. It must not trust browser-supplied candidate IDs, raw host claims, email addresses, or provider-specific identifiers as ownership evidence.

The production sequence is:

1. [Production host launch verifier](../../src/features/candidate-auth-v2/production-host-launch-verifier.ts) validates the short-lived signed launch assertion.
2. [Host launch orchestrator](../../src/features/candidate-auth-v2/host-launch-orchestrator.ts) resolves trusted TalentArbor identity/context and performs the one-time exchange.
3. [Candidate launch session repository](../../src/features/candidate-auth-v2/candidate-launch-session-repository.ts) persists the app-owned session without storing the raw bearer token.
4. [Candidate launch session resolver](../../src/features/candidate-auth-v2/candidate-launch-session-resolver.ts) resolves subsequent protected requests from the HttpOnly app cookie.
5. Feature repositories fence every read and mutation by the resolved `candidateProfileId`.

[Candidate launch context](../../src/features/candidate-auth-v2/candidate-launch-context.ts) keeps host-derived identity and optional job context behind a server-side adapter boundary. [Production host launch runtime](../../src/features/candidate-auth-v2/production-host-launch-runtime.ts) fails closed when required production configuration is absent.

Local and network-device testing use the explicit [dev host launch](../../src/features/candidate-auth-v2/dev-host-launch.ts) path. It mints fixture launch input and resolves into the same app-owned cookie/session shape; it is not a second feature-level auth model and must remain unavailable in production.

[Root middleware](../../src/middleware.ts) owns broad route-audience separation. Candidate, invited-candidate, recruiter, and QA access remain distinct server-side contracts even when they share domain services or UI.

## Acceptance Criteria

- unauthenticated access to protected routes redirects to the appropriate entry flow
- public CTAs preserve a safe post-login target when the TalentArbor login integration supports it
- authenticated candidates can only access their own drafts, sessions, resume assets, and dashboard history
- session ownership checks use `candidate_profile_id`
- local dev host launch can create repeatable test candidates through the production-shaped app-session boundary
- dev host launch is impossible to enable accidentally in production
- auth denial events are observable without logging secrets or raw resume data

## Non-Goals

- recruiter login
- recruiter invite management
- Supabase auth
- anonymous guest trials
- recruiter/admin/QA auth implementation
- final enterprise SSO implementation details beyond the confirmed redirect/handoff contract

## Open Questions

- Will TalentArbor/RangamWorks ratify `HS256`, the `token` query parameter, the current recommended claims, and minting a fresh token per click?
- What are the exact issuer and `source_portal` values, and will `product: "interview-coach"` remain the custom audience discriminator instead of a standard `aud` claim?
- How will the shared signing secret be exchanged, versioned, rotated, and revoked?
- Will the host always emit optional `jti`, even though Interview Coach also enforces one-time exchange through a token fingerprint?
- Does the launch token include the intended route, or does Interview Coach always default to `/candidate/dashboard` or `/candidate/setup`?
- Does the launch token include job/req/JD/resume context, or will Interview Coach fetch that context separately after identity resolution?
- What is the shared-secret rotation plan?
- Does `LoginWithType/2` support a return URL, callback URL, or signed state parameter?
- Will the shared identity source live inside this app database or a separate candidate platform service?
- Should candidate logout return to TalentArbor, clear only Interview Coach state, or both?
