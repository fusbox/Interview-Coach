# Platform Launch PrepProfile Migration

Status: Draft reference for future platform integration
Last updated: 2026-06-01

## Purpose

This document captures the intended migration path from manual candidate practice setup to host-platform launched Interview Coach practice.

It is a reference for the future integration pass. It is not an executable database migration and does not finalize the auth, launch-token, or TalentArbor API contract.

## Product Decision

In production, `/candidate/setup` should require a trusted host-platform launch context.

Local development keeps the current manual setup behavior.

The expected production entry is:

```text
TalentArbor / RangamWorks job listing
-> Practice Interview button
-> interviewcoach.talentarbor.com/candidate/launch?token=...
-> server verifies signed host launch token
-> server resolves or creates candidate profile/identity mapping
-> server resolves candidate, job, req, JD, and resume context
-> app finds or creates the candidate prepProfile for that target interview
```

This means production duplicate prevention should be keyed primarily by trusted platform identifiers, not fuzzy role-title or job-description matching.

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
- the token includes expiry;
- the token includes a product value used only for validation, not persistence;
- candidate identity claims are expected to support creating or mapping an Interview Coach candidate profile;
- exact claim names, algorithm, query parameter name, and replay requirements are still pending.

Current V2 scaffold:

- [Host launch contract](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.ts)
- [Host launch contract tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/features/candidate-auth-v2/host-launch-contract.test.ts)

Expected resolved launch context:

```ts
type CandidateLaunchContext = {
    candidate: {
        candidateProfileId?: string;
        platformCandidateId: string;
        platformUserId?: string;
        companyId?: string;
        displayName?: string;
        email?: string;
    };
    source: {
        sourceSurface: "TalentArbor" | "RangamWorks" | "SourceAbled" | "SourceVets" | "Unknown";
        hostDomain: string;
        talentChannelId?: string;
    };
    job: {
        jobCollectionId: string;
        requirementId?: string;
        requirementCode?: string;
        title: string;
        description: string;
        descriptionSource: "JobCollection" | "RequirementMaster" | "RequirementDescTxn" | "HostPayload";
    };
    resume: {
        hasResume: boolean;
        sourceType?: "ResumeParserJSONMaster" | "CandidateResume" | "SubmissionResume";
        sourceId?: string;
        sourceCreatedAt?: string;
        contentHash?: string;
        cleanedText?: string;
    };
    consent: {
        hasAIConsent: boolean;
        consentDate?: string;
    };
    token: {
        issuedAt: string;
        expiresAt: string;
        nonce: string;
    };
};
```

`cleanedText` is runtime input for coaching. It should not automatically become durable Interview Coach storage.

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

Recommended future additions:

```text
source_surface
host_domain
company_id
platform_candidate_id
platform_user_id
job_collection_id
requirement_id
requirement_code
talent_channel_id
job_title_snapshot
job_description_source
job_description_hash
resume_source_type
resume_source_id
resume_source_created_at
resume_content_hash
launch_context_version
```

Recommended uniqueness:

```text
unique active prepProfile:
candidate_profile_id
+ source_surface
+ company_id
+ job_collection_id
+ coalesce(requirement_id, '')
```

Exact constraint design should wait for confirmed platform identifiers and tenant/company semantics.

## Practice Route Behavior

Production:

- `/candidate/setup` without a trusted launch context should not create a manual production profile.
- Missing or invalid launch context should route to a candidate-safe error or login/return flow.
- Resolved launch context should prepopulate or lock target role and JD.
- Resume content should be optional and derived from the platform when available.

Development:

- Manual `/candidate/setup` remains available.
- Dev-created profiles should remain clearly scoped to local/dev identity.
- Duplicate prevention can stay lightweight until the production launch contract lands.

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
