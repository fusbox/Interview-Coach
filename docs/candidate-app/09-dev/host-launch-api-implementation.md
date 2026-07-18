# Host Launch API Implementation

Status: Active implementation guide
Last updated: 2026-07-17

## Purpose

This is the execution guide for launching Interview Coach from an authenticated TalentArbor or RangamWorks browser session. Discovery findings are evidence, not automatically ratified product or integration direction.

The first implementation target is TalentArbor. RangamWorks should use the same app-facing adapter contract but remains fail-closed until its candidate identity namespace is confirmed.

## Exchange Contract

The host backend mints a fresh HS256 JWT when the authenticated candidate clicks Interview Coach. The browser redirects to:

```text
https://interviewcoach.talentarbor.com/candidate/launch?token=<signed-jwt>
```

Recommended dashboard token:

```json
{
  "candidate_id": "123456",
  "email": "user@example.com",
  "product": "interview-coach",
  "iss": "talentarbor",
  "source_portal": "talentarbor",
  "iat": 1783962616,
  "exp": 1783962736,
  "jti": "9fd47fd4-82ab-4dd1-aad8-623959bb8b33"
}
```

A job-aware host link may also include:

```json
{
  "job_collection_id": "5551234",
  "source_surface": "TA_JOB_DETAIL"
}
```

Required claims are `candidate_id`, `email`, `product`, `iss`, numeric `iat`, and numeric `exp`. `jti`, `source_portal`, `source_surface`, and `job_collection_id` are supported but job context is not required for a dashboard launch.

Current IC policy:

- algorithm: HS256;
- product: exactly `interview-coach`;
- default maximum launch lifetime: 120 seconds;
- default future-issued tolerance: 30 seconds;
- minimum shared-secret size: 32 bytes;
- raw token and full claim payload: never logged or persisted;
- replay: one accepted exchange per SHA-256 token fingerprint or issuer-scoped `jti`;
- app session: independent server clock, default and maximum seven days.

The host token is signed, not encrypted. Its claims are visible to the browser and intermediaries that receive the URL. It must contain identifiers and routing context only, never resume text, JD text, or other sensitive body content.

## Host Team Responsibilities

1. Mint a new token for each Interview Coach click after proving the host session.
2. Use numeric JWT `iat` and `exp`; set `exp = iat + 120` for the recommended two-minute exchange window.
3. Generate a unique unpredictable `jti` for each token.
4. Sign with HS256 using a random server-only secret of at least 32 bytes.
5. Supply the agreed `iss` and optional `source_portal` values.
6. Redirect the browser to `/candidate/launch?token=...` and do not place candidate context in separate unsigned query parameters.
7. Keep signing secrets in the company secret store and define rotation/overlap/revocation operations with the IC deployment owner.
8. Ensure host, CDN, load-balancer, and observability access logs redact the `token` query value. The application suppresses caching and referrer propagation, but it cannot sanitize logs written before the request reaches it.

## Interview Coach Responsibilities

1. Verify signature, algorithm, issuer, product, source portal, numeric dates, and lifetime before trusting identity.
2. Hash the normalized raw token and reserve its fingerprint exactly once.
3. Resolve the signed candidate id from the trusted host data source.
4. For job-aware launch, prove the candidate owns the requested job-activity row before loading job context.
5. Resolve or create the IC candidate profile and identity mapping.
6. Create one Postgres launch session with an independent expiry and compact context snapshot.
7. For owned job-aware launch, atomically stage canonical role/JD with the launch session; do not put either in the cookie, URL, or compact launch snapshot.
8. Choose the canonical entry route: job-aware -> setup; identity-only with no prep contexts -> setup; identity-only with prep contexts -> dashboard.
9. Set `ic_candidate_launch_session` as `HttpOnly`, `SameSite=Lax`, `Secure` under HTTPS, and scoped to `/candidate`.
10. Redirect to a clean canonical candidate URL with no launch token.
11. Return the exchange redirect with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

If a response is lost after token consumption, the candidate returns to the host and clicks again for a new token. IC does not return the first app session to a replaying token.

## Launch Shapes

### Dashboard Quick-Link

Input: trusted candidate identity, no job id.

Expected result: establish the candidate session, then open the candidate dashboard when prep contexts exist or generic setup when none exist. No job is inferred.

### Job-Aware Link

Input: trusted candidate identity plus `job_collection_id`.

Expected result: establish the candidate session, prove candidate/job ownership, resolve canonical job context, and stage trusted role/JD data for setup. Stage and question count remain candidate choices.

## Current IC Runtime Configuration

- `CANDIDATE_HOST_LAUNCH_SECRET`
- `CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER`
- `CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE`
- `CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS`
- `CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS`
- `CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_PORT`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_USER`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_CONNECT_TIMEOUT_MS`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_REQUEST_TIMEOUT_MS`
- `CANDIDATE_HOST_LAUNCH_TA_SQL_POOL_MAX`
- `DATABASE_URL`

Production assembly fails closed when required or bounded values are missing or invalid. SQL port, encryption, certificate trust, timeouts, and pool size have conservative defaults; explicit invalid values disable production assembly rather than falling back silently.

## Landed IC Boundary

| Module | Responsibility |
| --- | --- |
| `host-launch-contract.ts` | Handoff, redirect, token fingerprint, independent session clock |
| `production-host-launch-verifier.ts` | `jose` HS256 verification and claim policy |
| `candidate-launch-context.ts` | Candidate identity plus optional canonical job context normalization; resume and consent are not queried here |
| `host-launch-orchestrator.ts` | Verify -> lookup -> profile/session composition |
| `candidate-launch-session-resolver.ts` | Identity proof, profile reuse/create, replay result |
| `candidate-launch-session-repository.ts` | Postgres identity and one-time launch-session persistence |
| `candidate-setup-entry-context.ts` | Active launch-session resolution, immutable job setup snapshot, and existing-path consume |
| `candidate-setup-prep-context-repository.ts` | Separate manual and host-job prep identity plus candidate-owned duplicate choice |
| `talentarbor-launch-context-adapter.ts` | Exact-row, fail-closed identity and candidate/job ownership adapter |
| `talentarbor-mssql-runtime.ts` | Parameterized TA queries, bounded server-only pool, timeouts, and safe diagnostics |
| `production-host-launch-runtime.ts` | Complete production verifier/Postgres/TA-MSSQL assembly; RW remains disabled |
| `host-launch-route.ts` | Token-bearing HTTP entry, cookie, clean redirect |
| `db/migrations/017_candidate_host_launch_exchange_hardening.sql` | Nullable job context, token fingerprint/id, one-time constraints |
| `db/migrations/018_candidate_host_launch_setup_context.sql` | Immutable launch setup staging, host prep identity, and consume marker |

## Setup Staging And Consumption

- Job-aware launch stores the bounded canonical role/JD snapshot once, in the same Postgres transaction as the launch session. Host edits or deletion after exchange do not rewrite an in-flight candidate setup.
- `/candidate/setup` resolves staging from the active launch cookie and renders role/JD read-only. The browser sends only `setupEntryMode: "trusted_host_job"`; that marker is not trusted data.
- Browser draft keys separate each host platform/job from the candidate's generic manual setup so a resume, stage, or count abandoned for another role cannot bleed into this launch. This is still local-browser preservation, not the deferred cross-device draft contract.
- Setup POST re-resolves the server snapshot and rejects any role/JD mismatch. A second tab that submits after another tab consumed staging receives a conflict rather than creating another host-backed path.
- A new host-backed path is keyed by candidate + source platform + job collection id. A matching path with practice activity opens the existing-path choice instead of silently merging evidence.
- Creating the first session consumes staging atomically with the session insert. Choosing `View in dashboard` consumes staging without creating a prep profile or session. Closing the dialog leaves staging available while the launch session remains active.
- Identity-only production setup uses the authenticated candidate owner but creates only a manual path. It cannot attach host source metadata.

## TalentArbor MSSQL Adapter Contract

The first server-only host-data adapter behind `lookupLaunchContext` must:

- resolve `candidate_id` against `CandidateMaster`;
- permit identity-only rows;
- for `job_collection_id`, prove ownership through `CandidateJobCollectionTxn`;
- use `CandidateJobCollectionTxn` only to prove ownership and TA `JobCollection` as canonical catalog context;
- use parameterized queries, bounded connection pools, strict timeouts, and privacy-safe diagnostics;
- select only approved identity/job columns and return no raw SQL or parameter values in failures;
- reject nonnumeric identifiers before opening a connection;
- fail closed on missing, duplicate, malformed, or unowned rows;
- treat active/expired flags as context rather than ownership gates;
- require complete validated MSSQL configuration before production launch dependencies assemble;
- keep resume retrieval behind a separate port until the authoritative current-resume rule is ratified;
- keep RW fail-closed until its identity mapping is known.

The draft `USP_InterviewCoach_GetLaunchContext` and staging CSVs remain discovery inputs. Do not deploy the draft procedure unchanged: requirement, channel, resume, and consent joins are intentionally outside the launch-critical query.

## Verification

```powershell
npm run test:candidate:host-setup
npx vitest run db/migrations/017_candidate_host_launch_exchange_hardening.test.ts src/features/candidate-auth-v2/*.test.ts src/app/candidate/launch/route.test.ts
npm run typecheck
npm run db:apply-candidate-host-launch-exchange-hardening
npm run db:smoke-candidate-host-launch-exchange-hardening
npm run db:apply-candidate-host-launch-setup-context
npm run db:smoke-candidate-host-launch-setup-context
```

Live staging acceptance is governed by [TalentArbor Host Launch Live Acceptance](./host-launch-live-acceptance.md). The live probe accepts only a host-minted URL through hidden standard input, reports metadata-only HTTP outcomes, and relies on request-id-correlated server diagnostics for rejection reasons. It does not mint or mutate tokens and must use a separate fresh token for each probe or browser run.

## Still Required Before Production

- Host ratification of issuer/source-portal values, mint-per-click behavior, and claim names.
- Shared-secret exchange, rotation, overlap, and emergency revocation procedure.
- One real TA-signed staging token and end-to-end browser validation.
- TA deployment network path and least-privilege MSSQL credentials.
- Authoritative current-resume selection and retention rules.
- RW candidate identity mapping before enabling the RW adapter.
