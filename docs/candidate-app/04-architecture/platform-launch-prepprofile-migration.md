# Platform Launch PrepProfile Migration

Status: Draft reference for future platform integration
Last updated: 2026-07-17

## Purpose

This document captures the intended migration path from manual candidate practice setup to host-platform launched Interview Coach practice.

It is a reference for the future integration pass. It is not an executable database migration and does not finalize the auth, launch-token, or TalentArbor API contract.

## Product Decision

Production host launch supports two entry shapes. A dashboard quick-link establishes trusted candidate identity without inventing a job context. A job-search or job-detail quick-link additionally supplies an owned `job_collection_id` so `/candidate/setup` can prefill trusted job context. Local development keeps the current manual setup behavior.

The expected production entry is:

```text
TalentArbor / RangamWorks dashboard or job listing
-> Interview Coach button
-> interviewcoach.talentarbor.com/candidate/launch?token=...
-> server verifies signed host launch token
-> server resolves or creates candidate profile/identity mapping
-> server resolves candidate identity and optional job/req/JD/resume context
-> app opens the candidate dashboard or stages trusted job context for a prepProfile
```

This means production duplicate prevention should be keyed primarily by trusted platform identifiers, not fuzzy role-title or job-description matching.

The first production lookup implementation is a TalentArbor-only server-side MSSQL adapter. It uses `CandidateMaster` for candidate identity and, only when a signed job id is present, requires an exact `CandidateJobCollectionTxn` ownership row plus canonical `JobCollection` context. It does not make requirement, channel, consent, or resume availability part of launch success. RangamWorks remains fail-closed until its distinct candidate namespace is mapped deliberately.

## Source Context From TalentArbor

The current migration notes identify these likely TalentArbor source tables and fields as relevant. Treat these as integration discovery context until verified with the platform team.

### Job Listing Context

Likely source: `JobCollection`

Relevant fields:

- `JobCollectionID`
- `JobTitle`
- `JobDescription`
- `Client`
- `Source`
- location fields
- active/expired/status fields
- source-system identifiers such as `JVID`, `DEUniqueID`, `OtherJobsUniqueID`

### Requirement Bridge

Likely source: `RequirementCollectionTxn`

Relevant fields:

- `JobCollectionID`
- `RequirementID`
- bridge/link row identifiers

### Requirement Context

Likely sources:

- `RequirementMaster`
- `RequirementDescTxn`

Relevant fields:

- `RequirementID`
- `RequirementCode`
- `RequirementJobDescription`
- `ActualRequirement`
- `ClientJobTitle`
- `ClientID`
- `CompanyID`
- role/program flags where approved for use

### Posting And Channel Context

Likely source: `JobPostTxn`

Relevant fields:

- `JobCollectionID`
- `RequirementID`
- `TalentChannelID`
- `PostDate`
- source/channel linkage

### Resume Context

Likely sources:

- `ResumeParserJSONMaster`
- `CandidateResume`
- `SubmissionResume`

Preferred direction:

1. Use parsed/cleaned resume context from an approved platform read path when present.
2. Store source metadata and hashes in Interview Coach.
3. Do not persist full resume text in Interview Coach unless policy/product explicitly approve retention.

### Consent Context

Likely source:

- `CandidateAIConsent`

Open decision:

- Confirm whether existing AI consent covers Interview Coach practice, or whether Interview Coach needs its own app-local consent event.

## Launch Context Contract

The host button should eventually pass a signed, short-lived launch token rather than raw candidate, JD, or resume data in the URL.

The July 6, 2026 integration transcript clarifies the first expected token direction:

- the token is passed as a query parameter during redirect from the host platform;
- the token should be URL-safe and may be long;
- the token is JWT-like and validated through server-side signature verification;
- the signing secret is shared between the TalentArbor/RangamWorks server side and the Interview Coach server side and must not be exposed to client code;
- the token uses numeric `iat` and `exp`; the IC boundary currently permits at most a two-minute launch lifetime;
- the token includes a product value used only for validation, not persistence; current integration understanding expects `product: "interview-coach"`;
- candidate identity claims are expected to support creating or mapping an Interview Coach candidate profile;
- the current recommended payload also carries `iss`, optional `source_portal`, optional `jti`, and optional `job_collection_id`;
- IC fingerprints every raw token and accepts only one exchange per fingerprint or issuer-scoped `jti`; the raw token is never stored;
- host ratification of the exact issuer/source-portal values, mint-per-click behavior, algorithm, and secret-rotation operation is still pending.

Local V2 development now has a dev-only host launch mode that mirrors this redirect pattern with deterministic fixture candidates. It is intentionally HMAC/local-secret based and environment-gated; it is not the production verifier.

Current V2 scaffold:

- [Host launch contract](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.ts)
- [Host launch contract tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.test.ts)
- [Production host launch verifier boundary](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/production-host-launch-verifier.ts)
- [Candidate launch session resolver boundary](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/candidate-launch-session-resolver.ts)
- [Host launch orchestrator boundary](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-orchestrator.ts)
- [TalentArbor launch-context adapter](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/talentarbor-launch-context-adapter.ts)
- [TalentArbor MSSQL runtime](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/talentarbor-mssql-runtime.ts)

The production verifier boundary is deliberately separate from local dev host launch mode. It uses `jose` for server-only HS256 verification, requires standard numeric dates, applies issuer/product/source-portal and lifetime policy, and emits telemetry-safe invalid-token reasons. The app session uses its own configurable lifetime, capped at seven days. The TA adapter is now wired behind the production lookup seam, but `/candidate/launch` remains operationally fail-closed until complete verifier, Postgres, and TA MSSQL configuration are present. Live traffic still requires the host secret exchange, deployment network path, least-privilege DB credentials, and a signed staging validation.

The TA staging DB discovery found no existing single procedure or view that returns an Interview Coach launch context. The first adapter deliberately does not deploy the discovery draft procedure. It issues one of two narrow parameterized reads:

- identity-only: exact `CandidateMaster.CandidateID`;
- job-aware: the same candidate plus exact `CandidateJobCollectionTxn` ownership and canonical TA `JobCollection` context.

Requirement, posting channel, resume, and consent tables are outside the launch-critical read. `CandidateMaster.CreatedBy` is not treated as the authenticated host user id because discovery did not prove that meaning. Resume retrieval remains a separate approved adapter and policy decision.

Expected resolved launch context:

```ts
type CandidateLaunchContext = {
    candidate: {
        candidateId: string;
        userId: string | null;
        companyId: string | null;
        displayName: string | null;
        email: string | null;
    };
    source: {
        sourceSurface: string;
        hostDomain: string | null;
        talentChannelId: string | null;
    };
    job: {
        jobCollectionId: string;
        requirementId: string | null;
        requirementCode: string | null;
        title: string;
        description: string;
        descriptionSource: "JobCollection" | "RequirementMaster" | "RequirementDescTxn" | "HostPayload";
        client: string | null;
        location: string | null;
        isActive: boolean | null;
        isExpired: boolean | null;
        expirationDate: string | null;
    } | null;
};
```

An omitted resume or consent object means the launch adapter did not query those domains; it must not be normalized into a false claim such as "no resume" or "no consent." `cleanedText` is runtime input for coaching and is intentionally outside this launch-context contract. It should not automatically become durable Interview Coach storage.

## Profile And Session Resolution

After token verification and launch-context normalization, the app should resolve the launch into these logical identifiers:

```text
CandidateHostLaunchHandoff
+ CandidateLaunchContext
-> CandidateLaunchIdentityKey
-> candidate_profile_id
-> candidate launch session id
```

`CandidateLaunchIdentityKey` is keyed by:

- launch provider;
- issuer;
- subject;
- host candidate id;
- host user id;
- platform candidate id from the normalized launch context;
- workspace.

This keeps tracing clear when a candidate enters from TalentArbor, RangamWorks, or a future host surface. Email and display name are profile attributes, not primary identity keys.

Current resolver behavior:

- resolve the existing provider/issuer/subject mapping and reject any attempt to relink that signed subject to another platform candidate;
- create or refresh the active candidate profile by canonical auth subject, then require it to agree with any existing identity mapping;
- keep disabled profiles fail-closed rather than reviving them through launch traffic;
- prefer canonical TA database email/display name, then signed-token attributes, for profile attributes;
- refresh the launch identity mapping and `last_seen_at` on every resolved launch;
- treat the launch token as a one-time exchange credential and create the app session with an independent configurable lifetime capped at seven days;
- store only a SHA-256 token fingerprint, optional issuer-scoped `jti`, and launch-token expiry; reject a second exchange without returning the first session;
- store only a small launch-context snapshot with the session boundary: candidate id, nullable job collection id, source surface, and host domain;
- fail closed when token/platform candidate ids disagree, identity/profile mappings conflict, the active profile cannot be resolved, or session creation fails.

This resolver does not fetch resume text and does not create a durable `prepProfile`. Those remain separate integration slices.

Current storage contract:

- `candidate_identities` is superseded by the host-launch migration to allow `talentarbor_launch` and `rangamworks_launch` provider values.
- `candidate_identities` now carries platform trace fields: `host_candidate_id`, `host_user_id`, `platform_candidate_id`, and `workspace`.
- `candidate_launch_sessions` stores the app launch session id, candidate profile id, provider/issuer/subject, platform candidate id, nullable job collection id, source surface, host domain, independent session expiry, launch-token fingerprint/id/expiry metadata, revocation timestamp, and a compact JSON launch-context snapshot.
- `candidate_launch_sessions` does not store full resume text or raw host payloads.
- `candidate_launch_setup_contexts` stores one immutable, candidate-owned role/JD snapshot for an owned job-aware launch. It is keyed to the launch session, bounded by that session's expiry, and contains no resume.
- `candidate_launch_sessions.setup_context_consumed_at` records the terminal setup-consume boundary without turning the launch row into a prep profile.
- host-backed `candidate_role_preparation_profiles` carry source platform, job collection id, optional requirement id, and source launch-session lineage. Their active-path uniqueness is platform job identity, not manual role/JD normalization.
- `candidate-launch-session-repository` is an injected-query adapter for this schema and implements the profile/session repository contract used by the orchestrator.

## Host Launch Orchestration

The orchestration boundary composes the tested pieces without hard-coding production database access:

```text
token
-> verify token
-> normalize CandidateHostLaunchHandoff
-> derive CandidateLaunchContextLookupInput
-> resolve CandidateLaunchContext
-> resolve CandidateLaunchSession
-> return route-compatible CandidateHostLaunchResult
```

The normalized handoff owns `launchContextHint`, currently:

- candidate id;
- job collection id;
- host domain;
- source surface.

Production host tokens may omit target job identity for a dashboard quick-link. That path resolves candidate identity only and does not infer a job. When a job hint is supplied, exact bridge ownership is mandatory; an unowned or malformed job never degrades to identity-only success. If launch context cannot be normalized or profile/session resolution fails, the orchestrator returns a fail-closed launch result and the route does not set the candidate session cookie.

The current production verifier preserves optional `job_collection_id`, `host_domain`, and `source_surface` claims into the normalized token payload. Exact claim names remain pending TA/RW confirmation.

`/candidate/launch` now assembles the production verifier, concrete launch-session repository, and TA-only MSSQL adapter only when verifier, Postgres, and complete bounded TA SQL configuration are valid. MSSQL connections are server-only, pooled, time-bounded, and use `Int` parameters. Diagnostics expose only the operation and a bounded reason, never identifiers, SQL values, credentials, emails, or provider errors. RangamWorks remains fail-closed. Job-aware launch atomically stages the canonical job snapshot with the launch session; resume retrieval remains separate, and no durable prep profile or practice session is created until explicit setup completion.

## PrepProfile Identity

Production `prepProfile` identity should be based on:

```text
candidate identity
+ source surface / company
+ JobCollectionID
+ RequirementID when available
```

This supersedes title-only grouping for production.

Manual dev mode may continue using:

```text
candidate identity
+ normalized target role
+ job-description snapshot/hash
+ created timestamp
```

## Candidate Role Preparation Profile Migration

Current table:

- `candidate_role_preparation_profiles`

Current meaning:

- candidate-owned preparation context for one target interview.

Landed host-source additions:

```text
source_platform
source_job_collection_id
source_requirement_id
source_launch_session_id
job_description_hash
```

Still-deferred integration metadata, if later justified:

```text
source_surface
host_domain
company_id
platform_candidate_id
platform_user_id
requirement_code
talent_channel_id
job_title_snapshot
job_description_source
resume_source_type
resume_source_id
resume_source_created_at
resume_content_hash
launch_context_version
```

Current uniqueness:

```text
host-backed active prepProfile:
candidate_profile_id
+ source_platform
+ source_job_collection_id
+ practice_path_number

manual/dev active prepProfile:
candidate_profile_id
+ normalized role
+ normalized JD hash
+ practice_path_number
```

`source_requirement_id` is retained for future richer identity, but TA job-aware V2 identity currently uses candidate + source platform + job collection id. RW remains disabled until its candidate namespace and workspace mapping are ratified.

## Practice Route Behavior

Production:

- `/candidate/setup` requires a valid launch-session identity.
- identity-only launch may create a manual candidate-owned profile without host source fields;
- job-aware launch requires owned, unconsumed, unexpired server staging and locks target role/JD to that canonical snapshot;
- interview stage, question count, and optional resume remain candidate-controlled;
- the server rejects role/JD mutation and a stale tab after staging was consumed;
- staging is consumed in the same database statement that creates the first practice session, or by the explicit existing-path selection;
- missing or invalid launch identity routes to a candidate-safe error or host-return flow.

Development:

- Manual `/candidate/setup` remains available.
- Dev-created profiles should remain clearly scoped to local/dev identity.
- Dev/manual duplicate handling remains the explicit exact-match choice contract; it never fabricates host source identity.

## Dashboard Selector Implications

Current dashboard target switching is title-based and intentionally first-pass.

After this migration:

- Dashboard options should represent `prepProfile` instances.
- Labels should include the role title.
- Secondary labels should include `created_at` or platform job context.
- Same-title/different-req profiles should be distinguishable.
- The selector should not imply that unrelated reqs with the same title are the same preparation track.

Example:

```text
Client Service Coordinator
Started May 31 - Req 12345
```

## Data Retention Direction

Interview Coach should persist practice facts and derived coaching outputs needed for the candidate experience.

Prefer storing:

- source identifiers;
- hashes;
- source timestamps;
- normalized snapshots of job content where approved;
- question/answer/feedback facts;
- telemetry events needed for product quality.

Avoid storing by default:

- full resume files;
- full cleaned resume text;
- raw platform payloads;
- unnecessary host profile data.

## Open Questions

- What is the exact TalentArbor/RangamWorks launch-token query parameter name?
- What JWT algorithm, issuer, audience, product claim value, and shared-secret rotation plan will TalentArbor/RangamWorks use?
- What are the exact payload claim names for email, host user id, host candidate id, TalentArbor id, RangamWorks id, display name, and expiry?
- Are launch tokens single-use/replay-protected or valid until expiry?
- Which service resolves launch token to candidate, job, req, resume, and consent context?
- Which platform identifier is canonical for candidate identity?
- Is `JobCollectionID` always present from job-search launch surfaces?
- Is `RequirementID` always available through the bridge?
- Does existing `CandidateAIConsent` cover Interview Coach?
- What company/tenant boundary should participate in uniqueness constraints?
- Are role/JD snapshots approved for durable Interview Coach storage?
- Is cleaned resume text runtime-only or durably stored with encryption and retention controls?

## Implementation Phases

1. Preserve current dev/manual `/candidate/setup` behavior.
2. Add launch-context types and docs without runtime enforcement.
3. Add nullable platform launch columns to `candidate_role_preparation_profiles`.
4. Add a server-only launch-context resolver boundary.
5. Require launch context in production `/candidate/setup`.
6. Find-or-create `prepProfile` by platform job identity.
7. Upgrade dashboard selector from target-role title to `prepProfile` instance.
8. Add retention and masking safeguards for platform-provided resume context.
