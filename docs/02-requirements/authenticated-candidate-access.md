# Authenticated Candidate Access

Date: 2026-07-27
Status: Current V2 requirements; app-owned candidate accounts are release scope and upstream TalentArbor launch details remain an external acceptance gate

## Purpose

This document defines the authenticated candidate access model for the persisted `/candidate/*` product surfaces.

## User Goal

As a candidate, I want to create or use my Interview Coach account, or launch from a trusted TalentArbor surface, access only my own practice data, and return later without losing setup or session progress.

## Current Priority

The first release has two independent candidate entry modes with the same downstream feature access:

- app-owned candidate registration and login;
- a TalentArbor authenticated quick-link that hands a short-lived signed launch assertion to `https://interviewcoach.talentarbor.com/candidate/launch`.

App-owned accounts are not a fallback implementation of host launch. They establish their own app user, candidate profile, and app session without token verification, MSSQL lookup, host identity mapping, or trusted-host setup staging. Host launch remains a separate entry adapter. Both resolve to the same opaque `candidateProfileId` ownership boundary after authentication.

RangamWorks uses related platform data but remains disabled until its identity namespace and source contract are independently ratified. Development keeps the explicit dev host-launch fixture path for host integration testing and adds deterministic app-account fixtures for account testing.

## Entry Modes

### App-Owned Candidate Account

Canonical public routes are:

- `/candidate/login`;
- `/candidate/register`;
- `/candidate/verify-email`;
- `/candidate/forgot-password`;
- `/candidate/reset-password`.

`/candidate` remains an entry router rather than a product screen. An authenticated candidate is routed to setup when no prep context exists and otherwise to the dashboard. An unauthenticated candidate is routed to `/candidate/login` with a bounded candidate-only return target.

App-owned candidate authentication reuses the shared app-auth primitives already used by recruiter access: scrypt password hashes, generic error messages, lockout controls, hashed revocable server sessions, HttpOnly cookies, email-verification/reset token tables, and metadata-only audit events. Candidate authorization additionally requires:

- an active `app_users` row;
- an explicit `candidate` role;
- an active `candidate_profiles` row bound by `app_user_id`;
- `candidate_profiles.workspace = "interview_coach"`.

The candidate audience uses its own `ic_candidate_app_session` cookie even though its opaque token is persisted in the shared `app_sessions` table. This keeps candidate and recruiter browser sessions independent and prevents one audience login from replacing the other.

Registration creates a new app user and a new app-owned candidate profile atomically. The release registration contract captures first name, last name, email, password, phone number, US ZIP code, contact-channel preferences, required platform-policy acceptance, required responsible-AI acknowledgement, and optional contact authorization. Email plus password remain the credential pair, and verified email remains the activation gate. Candidate-facing input and the server request boundary agree on the formats: email must be syntactically valid and at most 320 characters; phone must be either a ten-digit US number or an international number beginning with `+` and containing 8-15 digits; ZIP must contain exactly five digits and remains a string to retain leading zeroes. Phone is profile and future-integration data only in this release; it is not treated as verified, used for login, or used for recovery.

Personal details are split by authority:

- `app_users` owns credentials-adjacent email and display-name fields;
- the bound app-owned `candidate_profiles` row remains the downstream candidate ownership anchor;
- a candidate-account profile extension owns normalized E.164 phone and postal data;
- current contact-channel choices are mutable state;
- policy acknowledgements and contact-authorization decisions are append-only, versioned receipts.

Required policy acceptance and optional communications authorization are separate decisions. Contact preferences do not themselves prove consent, and selecting no optional contact channel must not prevent account creation. Production registration fails closed until the deployed Terms, Privacy Policy, Cookie Policy, and Responsible AI document versions are explicitly configured; local development may use clearly labeled local versions. Cookie Policy acknowledgement records the document shown during registration; it does not enable optional analytics, advertising, or cross-context tracking.

Registration never searches for or links a host profile by email or phone. The app may treat an existing app-user email as an existing account, but email or phone alone never links candidate data, host identity, or prep history. Future TalentArbor reconciliation will require an explicit external-identity mapping and confirmed linkage process rather than changing the profile origin or copying the Interview Coach password hash.

On ordinary protected `/candidate/*` requests, a present candidate app-session cookie has precedence. If it is invalid, expired, revoked, roleless, disabled, or lacks its exact app-owned profile binding, access fails closed and the request does not fall through to host-session lookup. App-owned candidate requests never invoke host token verification, host MSSQL, host launch context, or host setup staging.

Email verification is required before full candidate-route authorization. Registration, verification resend, password reset, and login responses must avoid user enumeration. Tokens are random, stored only as hashes, expire independently, and are single-use. Delivery uses the app-owned mail boundary; no candidate account is considered verified merely because a provider accepted a message.

Verification links render a read-only confirmation page before consuming the token so automated mail scanners cannot activate an account with a GET request. Consumption is an explicit same-origin mutation. Exact registration replay, an already-used verification link, resend cooldown, provider failure, and concurrent verification attempts must converge without duplicating the account, profile, consent receipts, or active tokens.

Password recovery uses the same explicit-confirmation posture. A forgot-password request always returns the same accepted response, whether or not an eligible candidate account exists. An issued reset credential:

- expires after 30 minutes by default;
- supersedes earlier unused reset credentials for that app user;
- is delivered only to an active, verified, app-owned candidate account;
- is persisted only as a SHA-256 hash;
- is consumed only by an explicit same-origin password-change mutation;
- updates the scrypt password hash, clears login-failure lock state, marks every reset credential used, and revokes every active `app_sessions` row for that user in one transaction.

Reset does not create a new session. The candidate signs in with the new password after reset, and every prior browser or device must authenticate again. This revocation applies only to the app-owned user sessions; it never reads, revokes, or refreshes TalentArbor host-launch sessions. Expired, superseded, malformed, used, and concurrently consumed credentials converge on the same nonrecovering invalid-link result.

Public candidate-account mutations use database-backed bounded rate controls in addition to the per-account password lock and verification/reset issuance cooldowns. Rate-limit bucket keys contain a purpose plus a one-way request-source digest, never a raw email, IP address, token, password, name, phone number, or candidate id. Authentication audit metadata is likewise allowlisted to bounded event, outcome, reason, provider, and session-revocation facts; the dedicated audit IP/user-agent columns remain the only request-source fields. If the rate-control store is unavailable, public authentication mutations fail closed rather than running unbounded.

Candidate logout is an app-account action. It is shown only when the resolved candidate access source is `app_account`, revokes the current app session, clears only `ic_candidate_app_session`, and returns to candidate login. Host-launched candidates are not shown this control because their host session has a separate owner and lifecycle.

Candidate login and logout claim their controls before issuing the mutation and reject duplicate activation while it is in flight. Validation, authorization, or network failure restores the current control and preserves the existing error/retry behavior. Once the server has accepted the session change and document-level navigation has been handed off, the departing screen remains visibly busy and disabled until navigation unmounts it; it must not flash an idle login or logout state after success.

## Protected Candidate Route Boundary

The shared candidate access resolver is the only identity source for candidate-owned product routes. It resolves one of `app_account`, `host_launch`, or the explicit nonproduction `dev_host_launch` fixture to one opaque `candidateProfileId`. It does not resolve invited practice access.

Protected candidate-owned surfaces are:

- `/candidate/setup` and its resume/start mutations;
- `/candidate/dashboard`;
- `/candidate/session/[sessionId]` and its draft, answer, analysis, feedback, progress, audio, transcription, completion, and Coach Update repair mutations;
- `/candidate/practice/ready`, `/candidate/practice/ready/[intentId]`, next-round builder routes, and their creation/start/audio mutations.

Public or separately authorized surfaces are:

- `/candidate/login`, `/candidate/register`, `/candidate/verify-email`, and account lifecycle mutations;
- `/candidate/launch` and `/candidate/dev/launch`;
- `/candidate/invited/*`, which requires its own invitation audience;
- compatibility redirects and global loading/error boundaries.

Protected page requests with missing, stale, or invalid access redirect to `/candidate/login` with a bounded candidate-only return target. Protected route handlers return `401` and never redirect. The app-session cookie has precedence even when a valid host/dev cookie is also present, so an invalid app cookie is an authoritative denial.

Authentication does not replace ownership. Every candidate-owned repository call must include the resolver's `candidateProfileId`; route ids and query parameters are selectors only. An owned profile mismatch returns no resource and performs no mutation. A candidate app cookie, host cookie, recruiter app cookie, and invited-session cookie are not interchangeable.

`/candidate` is an entry router over this boundary:

- no valid access: `/candidate/login`;
- valid access with no active prep context: `/candidate/setup`;
- valid access with one or more active prep contexts: `/candidate/dashboard`.

An authorization or database failure must fail closed rather than being presented as a new-account empty state.

### Host Launch Token

TalentArbor hands off through a short-lived signed JWT. Interview Coach validates that token before any product work, then exchanges it for an app-owned host-launch session cookie.

Canonical entry:

```text
https://interviewcoach.talentarbor.com/candidate/launch?token=<signed-jwt>
```

The `token` query value may optionally include a leading `Bearer ` prefix (flowchart form). Interview Coach strips that prefix before HS256 verification. Unsigned `candidateId` / `requirementId` query parameters are never an authentication path.

Required claims: `candidate_id`, `email`, `product` (`interview-coach`), `iss`, numeric `iat`, numeric `exp`. Optional claims: `jti`, `name` / `display_name`, `source_portal`, `source_surface`, `host_domain`, `job_collection_id`, `requirement_id`, `talent_channel_id`, `client_id`.

Job-aware launch uses TalentArbor job-page branching after the token is verified:

- `talent_channel_id == 0` or only `job_collection_id` → `Usp_SC_GET_JobCollection_ById` (`JobCollection`);
- `talent_channel_id > 0` → `Usp_SC_JobSeeker_Get_JobRequirementDetails` (`RequirementMaster`; requires `client_id`);
- RequirementMaster staging uses a stable IC catalog key `rm:{requirementId}` as `jobCollectionId` because setup staging requires a non-null job collection key, while `requirement_id` stores the real RequirementMaster id.

Ownership key is the signed `candidate_id`, not email alone. After TA `CandidateMaster` lookup, the token email must match the canonical database email (case-insensitive). Mismatch fails closed. Display name prefers TA profile fields, then optional token `name` / `display_name`.

Resume HTML is not a launch authentication prerequisite. When identity is proved, Interview Coach may call `USP_AI_Get_CandidateHTMLResume`, convert HTML to text, scrub through the trusted-host resume processor, and stage an awaiting-review artifact. Empty or failed resume prefetch leaves setup open for paste/upload and must not fail the launch exchange. Resume bodies never appear in the JWT, cookie, URL, or compact launch snapshot.

Other durable rules:

- Interview Coach verifies signature, algorithm, issuer, product, source portal, numeric dates, and lifetime server-side using `CANDIDATE_HOST_LAUNCH_SECRET` before trusting any claim.
- Default maximum launch lifetime remains 120 seconds and is capped at 15 minutes by configuration.
- New host candidates resolve-or-create an Interview Coach profile and identity mapping after verification.
- After exchange, Interview Coach sets `ic_candidate_launch_session` (`HttpOnly`, `SameSite=Lax`, `/candidate`) and redirects to a clean `/candidate/setup` or `/candidate/dashboard` URL with no token.
- The launch token is one-time. Interview Coach stores only a SHA-256 fingerprint plus optional issuer-scoped `jti`; a second exchange fails closed.
- A dashboard quick-link may identify only the candidate. Job context is not an authentication prerequisite.

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

`/` and the candidate login, registration, verification, and password-recovery routes remain public. `/candidate/launch` is the production host exchange entry point, and `/candidate/dev/launch` is an explicit nonproduction-only entry point. Invited-candidate routes use their own invitation access boundary rather than either authenticated candidate session.

These route paths are top-level siblings of recruiter/admin/QA routes on `https://interviewcoach.talentarbor.com`; see [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md).

## Access Resolution Contract

Protected feature code receives an opaque `candidateProfileId` from one shared candidate principal resolver. It must not know whether the principal began with an app-owned account or a host launch, and it must not trust browser-supplied candidate IDs, raw host claims, email addresses, or provider-specific identifiers as ownership evidence.

The resolver order is:

1. If `ic_candidate_app_session` is present, resolve only the app-owned account path. Invalid app-account access fails closed without host fallback.
2. Otherwise, permit the explicit nonproduction host fixture when enabled.
3. Otherwise, resolve the production host launch-session cookie.

The app-account query requires active app session, user, candidate role, and `interview_coach` profile binding. The host-session query requires an active host launch session whose candidate profile has no `app_user_id`. Host launch profile creation, refresh, and session creation also reject app-bound profiles. These symmetric guards prevent either entry adapter from acquiring the other adapter's profile.

The production host-launch sequence is:

1. [Production host launch verifier](../../src/features/candidate-auth-v2/production-host-launch-verifier.ts) validates the short-lived signed launch assertion.
2. [Host launch orchestrator](../../src/features/candidate-auth-v2/host-launch-orchestrator.ts) resolves trusted TalentArbor identity/context and performs the one-time exchange.
3. [Candidate launch session repository](../../src/features/candidate-auth-v2/candidate-launch-session-repository.ts) persists the host launch session without storing the raw bearer token.
4. [Candidate launch session resolver](../../src/features/candidate-auth-v2/candidate-launch-session-resolver.ts) completes the one-time profile/session exchange.
5. [Candidate route access](../../src/features/candidate-auth-v2/candidate-route-access.ts) resolves subsequent protected requests from the independent candidate app-session or host-session cookie.
6. Feature repositories fence every read and mutation by the resolved `candidateProfileId`.

[Candidate launch context](../../src/features/candidate-auth-v2/candidate-launch-context.ts) keeps host-derived identity and optional job context behind a server-side adapter boundary. [Production host launch runtime](../../src/features/candidate-auth-v2/production-host-launch-runtime.ts) fails closed when required production configuration is absent.

Local and network-device host testing use the explicit [dev host launch](../../src/features/candidate-auth-v2/dev-host-launch.ts) path. It mints fixture launch input and resolves into the host-session shape; it must remain unavailable in production. App-account testing uses separately seeded app users and candidate-profile bindings and must not depend on dev host launch configuration.

[Root middleware](../../src/middleware.ts) owns broad route-audience separation. Candidate, invited-candidate, recruiter, and QA access remain distinct server-side contracts even when they share domain services or UI.

## Acceptance Criteria

- unauthenticated access to protected routes redirects to the appropriate entry flow
- app-owned candidates can register, verify email, log in, log out, recover credentials, and use every candidate-owned setup, session, dashboard, and follow-up feature
- public CTAs preserve a safe candidate-only post-login target
- authenticated candidates can only access their own drafts, sessions, resume assets, and dashboard history
- session ownership checks use `candidate_profile_id`
- app-owned candidate access performs no host-token or host-data operation
- host launch cannot resolve, refresh, or create a launch session against an app-bound candidate profile
- matching email never merges or links host and app-owned profiles
- local dev host launch can create repeatable test candidates through the production-shaped app-session boundary
- local dev app-account fixtures can exercise the app-owned candidate session independently
- password-reset replay fails, reset revokes every prior app-owned session, and the new password can establish a fresh session
- candidate-account rate and audit records contain no raw credential, token, email, phone, name, postal, or candidate identity data
- candidate logout is visible only to app-owned candidates and does not clear recruiter, invited-candidate, or host-launch state
- dev host launch is impossible to enable accidentally in production
- auth denial events are observable without logging secrets or raw resume data

## Non-Goals

- recruiter invite management
- Supabase auth
- anonymous guest trials
- final enterprise SSO implementation details beyond the confirmed redirect/handoff contract
- automatic linking or merging between app-owned and host-launched candidate profiles
- social login, passkeys, or multifactor authentication in the first account slice

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
- What sender identity and final template approval will candidate verification and password-reset email use in each environment?
- What first-release password policy and candidate session lifetime should be ratified after usability and security review?
- Should a later explicit account-linking flow allow a candidate to merge app-owned and TalentArbor histories after reauthentication to both identities?
