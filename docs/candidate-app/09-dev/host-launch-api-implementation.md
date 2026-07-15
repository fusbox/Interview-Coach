**Host launch API - full landing context**

Target: already-logged-in TA/RW Quick Help → signed token → /candidate/launch → IC profile/session cookie → canonical candidate route. Synthesized from WI 2753, July 6 integration chat, V2 auth code, and 2026-07-14 staging discovery.

**Scaffolded**

Token verify + route

**Drafted**

Launch-context SQL

**Blocked**

lookupLaunchContext=null

**Open**

Secret + company deploy

Definition of done (auth/ID slice)

A host-minted staging JWT with candidate_id + job_collection_id verifies on IC, loads CandidateMaster + job context, creates candidate_identities / candidate_launch_sessions, sets ic_candidate_launch_session, and redirects off the token URL. Resume body text, activity taxonomy from WI 2753, and compliance certifications are explicitly out of this landing slice.

**End-to-end flow**

| **Step**                                                        | **Owner**                  | **Status**                                    |
| --------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| Quick Help / Interview Coach button on TA or RW dashboard       | Host (.NET)                | Agreed; not in IC repo                        |
| Mint HS256 JWT (server secret), redirect ?token=                | Host                       | Contract known; need freeze + secret exchange |
| GET /candidate/launch?token=…&next=…                            | IC                         | Route + cookie cleanup landed                 |
| Verify signature, product, exp, issuer                          | IC                         | production-host-launch-verifier.ts            |
| Resolve launch context (CandidateID + JobCollectionID)          | IC ← TA/RW SQL or host API | Draft USP; runtime still returns null         |
| Upsert candidate_profile + identity + launch session (Postgres) | IC                         | Repository + resolver landed                  |
| Set session cookie → /candidate/setup or /candidate/dashboard   | IC                         | Landed when resolveCandidateProfile succeeds  |

**Token contract (freeze with host)**

July 6 agreed claims

Required: candidate_id, email, product, exp

product must be interview-coach (validate only; do not persist)

Alg: HS256 · shared server secret only

Optional IC already reads: job_collection_id, host_domain, source_surface, iss, iat

WI 2753 extras (defer or map)

Source Portal / Destination Portal → workspace + hostDomain/sourceSurface

Host Session ID → not required for first IC session cookie

Activity events Link→Summary → separate analytics rollup

GDPR/SOC2/WCAG checklist → Phase H; do not gate auth landing

IC env: CANDIDATE_HOST_LAUNCH_SECRET, optional CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER (default talentarbor), CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS, DATABASE_URL (IC Postgres). Verifier currently defaults workspace to talentarbor - RW issuer/workspace must be confirmed.

**Platform data (staging truth)**

Landing data readinessTA listing-ready · RW listing open

| **Concern**          | **Source**                      | **Rule**                                                                                                                                 |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate identity   | dbo.CandidateMaster             | CandidateID, Email, FirstName+LastName, CompanyID, CreatedBy. Never Password/Salt/SSN\*.                                                 |
| Candidate ↔ job pair | dbo.CandidateJobCollectionTxn   | CandidateID + JobCollectionID. Skip JobCollectionID=0 (candidate-created).                                                               |
| Listing JD (TA)      | dbo.JobCollection               | ~7.5M rows; join works for real pairs (e.g. 2833899/4257312).                                                                            |
| Listing JD (RW)      | Open                            | Live probe: JobCollection row count 0, 0 join hits. Bridge still has titles. Need host answer: sync, linked catalog, or bridge fallback. |
| Resume for launch    | ResumeParserJSONMaster metadata | Flags + dates only. Never JSONData.                                                                                                      |
| AI consent           | CandidateAIConsent              | hasAIConsent = row exists; latest ConsentDate.                                                                                           |
| IC durable session   | Postgres candidate\_\*          | candidate_identities + candidate_launch_sessions already modeled.                                                                        |

TA vs RW catalog

Connections used for live probes: TalentArbor @ 52.33.112.102 and HealthWorksStag @ 3.85.182.226. Earlier ADS CSV exports for job samples looked identical across TA/RW; treat those as historical exports and use the live join-hit numbers above as current implementation constraints. Respect that ads connections were intended per-DB - resolve RW JobCollection emptiness with the platform team rather than assuming a wrong connection.

**IC code map (replace the null)**

| **Module**                                           | **Role**                                       |
| ---------------------------------------------------- | ---------------------------------------------- |
| host-launch-contract.ts                              | Handoff shape, product, redirect allowlist     |
| production-host-launch-verifier.ts                   | HS256 JWT verify + claim parse                 |
| candidate-launch-context.ts                          | Normalize SQL/API row → CandidateLaunchContext |
| host-launch-orchestrator.ts                          | Composable verify → lookup → session           |
| candidate-launch-session-resolver.ts                 | Identity key → profile → launch session        |
| candidate-launch-session-repository.ts               | Postgres persistence                           |
| production-host-launch-runtime.ts                    | Prod wiring - lookupLaunchContext still null   |
| host-launch-route.ts / app/candidate/launch          | HTTP entry + cookie                            |
| 09-dev/USP_InterviewCoach_GetLaunchContext.draft.sql | SQL draft for host DB                          |

**Implementation sequence**

| **#** | **Work**                                                                                                                     | **Exit criteria**                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1     | Freeze token claims + issuer values for TA and RW with Himanshu's team; exchange staging secret                              | Written claim table + secret in company secret store (not Vercel personal) |
| 2     | Decide RW listing strategy (catalog sync vs bridge JobTitle/Description fallback vs API)                                     | Signed decision; draft USP SELECT branches match decision                  |
| 3     | Column-probe RequirementCollectionTxn + JobPostTxn; finish USP joins or drop to later slice                                  | Proc returns full CandidateLaunchContextRow on TA pair 2833899/4257312     |
| 4     | Add IC mssql (or host HTTP) adapter implementing lookupLaunchContext; wire in production-host-launch-runtime.ts              | Focused tests + staging E2E: valid token → cookie set → redirect           |
| 5     | Hardening: replay/jti if host adds it, RW workspace in verifier, cookie TTL, fail-closed when job listing missing per policy | Documented fail reasons; no raw token logging                              |
| 6     | Company deploy env on interviewcoach.talentarbor.com; host enables Quick Help button against staging IC URL                  | Member click path works without Vercel + VPN laptop                        |

Durable artifacts

docs/…/USP_InterviewCoach_GetLaunchContext.draft.sql

docs/…/staging-launch-context-findings-2026-07-14.md

docs/…/staging-launch-context-discovery.sql

scripts/probe-staging-tables.mjs

scripts/probe-staging-candidate-columns.mjs

scripts/probe-staging-candidate-job-pairs.mjs

Local gitignored TA-/RW-\*.csv discovery exports

Explicitly defer

Resume OCR / cleanedText ingestion

Full WI 2753 activity funnel + analytics ACL

SOC2/GDPR certification paperwork

Production TTS / answer providers

Personal Vercel → private staging SQL

CandidateID 2833899 · JobCollectionID 4257312 · CDL Truck Driver