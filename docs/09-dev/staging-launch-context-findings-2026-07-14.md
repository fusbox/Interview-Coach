# Staging Launch Context Findings

Date: 2026-07-14
Status: Discovery evidence only; not a ratified launch contract or implementation direction.
Implementation canvas: host-launch-api-implementation (Cursor canvases)
Related: [USP_InterviewCoach_GetLaunchContext.draft.sql](./USP_InterviewCoach_GetLaunchContext.draft.sql), [staging-launch-context-discovery.sql](./staging-launch-context-discovery.sql), [rw-job-catalog-ownership-diagnostic.sql](./rw-job-catalog-ownership-diagnostic.sql), [ta-resolve-rw-jobcollection-ids.sql](./ta-resolve-rw-jobcollection-ids.sql)

## Summary

Discovery evaluated a combined **token verification (IC)** + **identity/job launch context (TA/RW SQL or API)** + **IC Postgres session** path. It does not establish that all three are required for every launch. Staging discovery confirmed identity and bridge tables on both DBs. TalentArbor can resolve listing JD from `JobCollection`. HealthWorksStag currently returns **0** `JobCollection` rows on live probe - resolve listing strategy with platform team before treating RW as listing-ready.

## Certainty check (live, 2026-07-14)

Local discovery script (not committed): `scripts/probe-staging-certainty-check.mjs`
Proves env target, `@@SERVERNAME`, and `DB_NAME()` per connection.

| Label | Env IP | SQL `@@SERVERNAME` | `DB_NAME()` | `JobCollection` rows | Bridge-to-JC join hits |
| --- | --- | --- | --- | --- | --- |
| TA | redacted | `RangamMSSIS2023` | `TalentArbor` | **7,515,854** | 14 / 19 |
| RW | redacted | `EHHealthWorksDev` | `HealthWorksStag` | **0** | 0 / 417 |

These are **two different servers and databases**. RW's empty `JobCollection` is real on this login/date, not a mistaken TA reconnect. TA's newest listing ids (e.g. `7786194` PROGRAM ANALYST) match older ADS job-export samples; if an earlier `RW-*.csv` showed the same listing rows, that export did not reflect today's RW `JobCollection` contents (table exists, count is 0).

## RW catalog ownership follow-up (live, 2026-07-17)

The paired RW and TA diagnostics materially strengthen the catalog-ownership hypothesis:

- `HealthWorksStag` has **425** `CandidateJobCollectionTxn` rows, **0** `JobCollection` rows, and **0** `JobCollectionArchive` rows.
- All 50 recent non-candidate-created bridge rows lacked a local catalog match but carried populated job title, description, company, and source snapshots.
- The 50-row sample represented 47 distinct job ids across 8 candidates; its sources were USAJobs and Direct Employer.
- All six sampled RW `JobCollectionID` values resolved to active TalentArbor `JobCollection` rows.
- For those six ids, RW and TA titles and the first 300 description characters matched exactly.
- The RW SQL Server exposes linked servers for the TA staging address, including `RGMDB`, but the SQL-module search returned no visible module definitions referencing the bridge or catalog tables.

**Supported interpretation:** TalentArbor owns the canonical job catalog. RW stores candidate-owned references plus job snapshots in `CandidateJobCollectionTxn` without replicating `JobCollection` locally. The exact write path remains unconfirmed; it may live in application code, inaccessible/encrypted SQL modules, dynamic SQL, or a linked-server integration.

**Direct-SQL implication:** For an RW candidate's recorded job activity, the bridge row is sufficient to prove the candidate-to-job association and provide the historical job context the candidate actually saved. TA `JobCollection` can be used for validation or current-listing enrichment when needed. Any linked-server topology should remain behind a host stored procedure or adapter rather than becoming part of the Interview Coach application contract.

## Where candidate records live

| Table | Role |
| --- | --- |
| `dbo.CandidateMaster` | Primary identity (not `dbo.Candidate`) |
| `dbo.CandidateJobCollectionTxn` | `CandidateID` to `JobCollectionID` bridge |
| `dbo.CandidateJobCollectionStatusTxn` | Status on bridge rows |
| `dbo.CandidateAuthentication` / `LoginTxn` / `TokenTxn` | Host auth history |
| `dbo.CandidatePortal` | Portal mapping |
| `dbo.CandidateAIConsent` | Consent dates |
| `dbo.ResumeParserJSONMaster` | Resume **availability** metadata only |
| `dbo.CandidateRangamworksTxn` | TA-only RW link helper |

Catalog sizes (live): TA **2004** tables; RW **1965** tables.

## CandidateMaster + bridge columns

| Table | Use for IC | Never select |
| --- | --- | --- |
| `CandidateMaster` (48 cols) | `CandidateID`, `Email`, `FirstName`, `LastName`, `CompanyID`, `CreatedBy` | `Password*`, `Salt`, `SSN*` |
| `CandidateJobCollectionTxn` (20 cols) | `CandidateID`, `JobCollectionID`, titles, active/expired flags | N/A for launch row |
| `AICandidateMaster` | Not default identity source | N/A |

## Real pairs + JobCollection join health

| DB | Bridge rows | Join hits | JobCollectionID=0 | JobCollection rows |
| --- | --- | --- | --- | --- |
| TA | 19 | 14 | 5 | ~7.5M |
| RW | 417 | 0 | 87 | 0 |

Exact staging candidate/job pairs remain only in access-controlled local discovery output and are not part of this repository contract.

**RW:** bridge titles exist; listing join does not. Product decision required: catalog sync, cross-db/API read, or bridge `JobTitle`/`Description` fallback.

## Round-1 ADS exports

Queries covered table existence, `JobCollection` columns, recent jobs, resume parser samples, AI consent. Treat exports under `TA-*.csv` / `RW-*.csv` as local-only (gitignored; resume JSON is PII). Prefer live probe scripts when numbers disagree with older CSVs.

## Questions raised for launch API

1. Decide whether identity-only launches need any context lookup beyond verified token claims.
2. If profile enrichment is required, prefer host JWT email and optionally check against `CandidateMaster.Email`.
3. For future job-aware launches, prefer `JobCollection` JD when present; do not return resume `JSONData`.
4. Decide how listing launches handle `JobCollectionID = 0` (`IsJobCreatedByCandidate`).
5. Add requirement/channel joins only when a ratified product use case consumes them.
6. If Interview Coach reads staging SQL directly, company deployment and private connectivity are required; a personal Vercel deployment cannot privately reach staging SQL.

## Local-only probe scripts

The exploratory `probe-staging-*.mjs` scripts and their exports are intentionally not committed. Reusable, data-minimized SQL is preserved in the related query files above.
