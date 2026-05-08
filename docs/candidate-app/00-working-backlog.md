# Working Backlog

Date: 2026-05-08
Status: Active working document

## Purpose

This is the one mutable working document for day-to-day execution.

It is the repo-local mirror of a product backlog, delivery sequence, decision register, and drift-control surface. The ground-truth docs orient the work; this file tracks what work exists, how it is decomposed, and what is currently being sequenced.

## Ground-Truth Docs

- [Candidate App Operating Model](01-product/candidate-app-operating-model.md)
- [Practice Setup Scope](02-requirements/practice-setup-scope.md)
- [Authenticated Candidate Access](02-requirements/authenticated-candidate-access.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [Design System Foundation](03-design/design-system-foundation.md)
- [Current Foundation](04-architecture/current-foundation.md)
- [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)
- [Test Strategy](05-quality/test-strategy.md)
- [Accessibility Baseline](05-quality/accessibility-baseline.md)
- [Candidate App Threat Model](06-security/threat-model.md)
- [Data Retention Policy](06-security/data-retention-policy.md)
- [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)
- [Decision Records](08-decisions/README.md)
- [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

## Status Key

- `Todo`: not started
- `Doing`: active
- `Blocked`: waiting on decision or dependency
- `Done`: implemented or documented and verified
- `Deferred`: intentionally postponed

## Item Field Model

Use these fields when adding or updating work items.

### Epic Fields

- `Outcome`: the durable product or platform capability.
- `Scope`: what belongs inside this epic.
- `Non-goals`: what should not drift into this epic.
- `Ground truth`: docs that define the contract.
- `Features`: child feature groups.
- `Risks`: quality, security, product, or delivery concerns.

### Feature Fields

- `Outcome`: the concrete capability delivered by the feature.
- `Acceptance evidence`: observable proof that the feature works.
- `Primary tests`: expected unit, integration, route, browser, or manual checks.
- `Trace links`: docs, ADRs, or future Azure Boards work items.

### Story Fields

- `User value`: actor, behavior, and benefit.
- `Acceptance criteria`: testable behavior.
- `BDD example`: Given/When/Then where helpful.
- `Data touched`: tables, APIs, state, or external systems.

### Task Fields

- `Implementation step`: specific code, doc, config, or project action.
- `Verification`: command, review, artifact, or manual check.
- `Parent`: linked story or feature.

## Backlog Tree

### EPIC-01 Product Foundation And Governance

Outcome: The repo has stable foundations for development, documentation, decisions, environment setup, accessibility, retention, and local bootstrap.

Scope: repo setup, docs governance, ADRs, baseline quality/security policies, local developer onboarding.

Non-goals: candidate auth implementation, product feature depth, Azure DevOps practice setup.

Ground truth:

- [Candidate App Operating Model](01-product/candidate-app-operating-model.md)
- [Current Foundation](04-architecture/current-foundation.md)
- [Decision Records](08-decisions/README.md)
- [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| FND-F01 | Feature | Done | Repo baseline | Package identity, CI scripts, assets, and docs are established |
| <a id="backlog-fnd-s01"></a>[FND-S01](#seq-fnd-s01) | Story | Done | Align package name and CI scripts | `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run test:stability` pass |
| <a id="backlog-fnd-s02"></a>[FND-S02](#seq-fnd-s02) | Story | Done | Align public assets with migrated recruiter app | [public](../public) matches [migrated recruiter public](/c:/tmp/Interview-Coach-Recruiter-postgres/public) |
| <a id="backlog-fnd-s03"></a>[FND-S03](#seq-fnd-s03) | Story | Done | Establish ground-truth docs and single working backlog | [docs/README.md](README.md) links the current doc set |
| <a id="backlog-fnd-s04"></a>[FND-S04](#seq-fnd-s04) | Story | Done | Add ADRs and environment contract | [Decision Records](08-decisions/README.md) and [.env.example](../.env.example) exist |
| FND-F02 | Feature | Todo | Local developer experience | New developer can run app, DB setup, migrations, seed data, and quality checks locally |
| <a id="backlog-fnd-s05"></a>[FND-S05](#seq-fnd-s05) | Story | Done | Create local dev bootstrap contract | [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md) defines target commands and env flow |
| FND-T01 | Task | Todo | Implement `db:setup`, `db:migrate`, and `db:seed` scripts after DB layer exists | Scripts run locally and are documented |
| FND-F03 | Feature | Todo | Baseline quality and policy guardrails | Accessibility and retention expectations are documented before feature buildout |
| <a id="backlog-fnd-s06"></a>[FND-S06](#seq-fnd-s06) | Story | Done | Add initial data retention policy | [Data Retention Policy](06-security/data-retention-policy.md) reflects processed-resume retention default |
| <a id="backlog-fnd-s07"></a>[FND-S07](#seq-fnd-s07) | Story | Done | Add accessibility baseline | [Accessibility Baseline](05-quality/accessibility-baseline.md) defines candidate-facing UI expectations |

### EPIC-02 Candidate Identity And Access

Outcome: Protected routes resolve a single candidate context and enforce candidate-owned access.

Scope: profile identity, dev auth, mock candidate mode, SSO adapter boundary, route protection, ownership checks.

Non-goals: final company SSO rollout, recruiter auth, recruiter invite management.

Ground truth:

- [Authenticated Candidate Access](02-requirements/authenticated-candidate-access.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [ADR-0003: Dev Auth And Mock Candidate Mode](08-decisions/ADR-0003-dev-auth-and-mock-candidate-mode.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| AUTH-F01 | Feature | Todo | Candidate profile persistence | Candidate profile and provider identity records exist in Postgres |
| <a id="backlog-auth-s01"></a>[AUTH-S01](#seq-auth-s01) | Story | Todo | Add Postgres client/config adapted from migrated recruiter app | Server-only DB client supports `DATABASE_URL` and tests cover config parsing |
| <a id="backlog-auth-s02"></a>[AUTH-S02](#seq-auth-s02) | Story | Todo | Create candidate profile and identity schema migration | Migration defines `candidate_profiles` and `candidate_identities` |
| AUTH-F02 | Feature | Todo | Candidate access resolver | Feature code consumes `CandidateAccessContext`, not provider-specific details |
| <a id="backlog-auth-s03"></a>[AUTH-S03](#seq-auth-s03) | Story | Todo | Add password-backed dev auth and explicit mock candidate mode | Local protected routes resolve a stable `CandidateAccessContext` |
| <a id="backlog-auth-s04"></a>[AUTH-S04](#seq-auth-s04) | Story | Todo | Protect candidate route group | `/practice`, `/dashboard`, and `/session/[sessionId]` reject missing candidate context |
| AUTH-S05 | Story | Todo | Add negative ownership behavior | Cross-candidate access returns forbidden or not found |
| AUTH-F03 | Feature | Future | SSO readiness | RangamWorks/TalentArbor SSO can plug into the same resolver boundary |
| AUTH-S06 | Story | Todo | Define SSO adapter interface | Interface captures issuer, subject, email, workspace, and provider |
| AUTH-F04 | Feature | Todo | TalentArbor login return flow | Public CTAs can preserve candidate intent through login |
| <a id="backlog-auth-s07"></a>[AUTH-S07](#seq-auth-s07) | Story | Todo | Confirm and implement candidate login return contract | `/auth/talentarbor/start?next=/practice` and `/dashboard` flow safely through `LoginWithType/2` or documented fallback |

BDD example:

```gherkin
Given candidate A is authenticated
And candidate B owns session sess-2
When candidate A opens /session/sess-2
Then the app does not reveal candidate B's session data
```

### EPIC-03 Candidate Practice Setup And Drafts

Outcome: Candidates can create, autosave, restore, and submit multiple candidate-owned practice drafts.

Scope: practice setup form, draft model, multiple active/named drafts, role/JD/resume text input, generation transition.

Non-goals: final resume upload/OCR, dashboard analytics, full session engine.

Ground truth:

- [Practice Setup Scope](02-requirements/practice-setup-scope.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)
- [ADR-0004: Multiple Active Practice Drafts](08-decisions/ADR-0004-multiple-active-practice-drafts.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| DRFT-F01 | Feature | Todo | Practice setup feature slice | Route page delegates setup UI and behavior to feature code |
| <a id="backlog-drft-s01"></a>[DRFT-S01](#seq-drft-s01) | Story | Todo | Move practice form into [src/features/practice-setup](/c:/dev/Interview-Coach-Candidate/src/features/practice-setup) | Route delegates to feature |
| <a id="backlog-drft-s02"></a>[DRFT-S02](#seq-drft-s02) | Story | Todo | Add setup validation schema | Target role required, JD/resume optional, invalid payloads rejected |
| DRFT-F02 | Feature | Todo | Server-backed draft lifecycle | Draft state is persisted and restorable across refresh/device |
| <a id="backlog-drft-s03"></a>[DRFT-S03](#seq-drft-s03) | Story | Todo | Add draft repository and service boundary | Draft create/read/update covered by unit or integration tests |
| DRFT-S04 | Story | Todo | Persist pasted resume text as normalized context | Draft stores `resumeContext.extractedText` |
| <a id="backlog-drft-s05"></a>[DRFT-S05](#seq-drft-s05) | Story | Todo | Restore draft after refresh | Browser or route test proves server state restores form |
| <a id="backlog-drft-s06"></a>[DRFT-S06](#seq-drft-s06) | Story | Todo | Submit draft into generation state | Draft status changes to `generating` and `resumeTargetScreen` changes |
| DRFT-F03 | Feature | Future | Multiple draft management | Candidate can maintain more than one active/named practice draft |
| DRFT-S07 | Story | Todo | Model draft naming and selection | Candidate can distinguish active drafts by role/title/date |

BDD example:

```gherkin
Given an authenticated candidate has entered a target role and pasted resume text
When they refresh /practice
Then the target role and resume text are restored from server state
```

### EPIC-04 Interview Session Engine

Outcome: Candidate-owned drafts create and resume candidate-owned interview sessions using reusable session engine patterns.

Scope: question snapshots, session entry, answer lifecycle, retry, feedback, summary handoff.

Non-goals: recruiter invite management, recruiter review views, candidate dashboard analytics.

Ground truth:

- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| SESS-F01 | Feature | Todo | Session engine port plan | Candidate-safe session files are identified from [C:\tmp\Interview-Coach-Recruiter-postgres](/c:/tmp/Interview-Coach-Recruiter-postgres) |
| SESS-S01 | Story | Todo | Identify candidate-safe session engine files | Port list references concrete files and exclusions |
| SESS-F02 | Feature | Todo | Candidate session lifecycle | Draft creates session and session resumes from persisted state |
| SESS-S02 | Story | Todo | Add candidate session creation service | Draft produces session ID and immutable question snapshot |
| SESS-S03 | Story | Todo | Render real session state in `/session/[sessionId]` | Page no longer uses static placeholder content |
| SESS-S04 | Story | Todo | Persist session progress and resume target | Refresh returns to correct in-session state |
| SESS-S05 | Story | Todo | Add session mutation tests | Answer submit, retry, next question, pause paths covered |
| SESS-F03 | Feature | Future | Candidate feedback and summary | Candidate can review useful coaching without recruiter-facing readiness semantics |

### EPIC-05 Candidate Dashboard And History

Outcome: Candidates can see and act on their own practice history, active drafts, completed summaries, and next recommended actions.

Scope: dashboard read model, recent sessions, active drafts, repeat/review actions, summary snippets, progress patterns.

Non-goals: recruiter dashboards, cross-candidate analytics, public marketing pages.

Ground truth:

- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| DASH-F01 | Feature | Todo | Dashboard MVP read model | Contract includes active drafts, recent sessions, last activity, and summary snippets |
| DASH-S01 | Story | Todo | Define dashboard query contract | Empty, active, completed, and failed states are represented |
| DASH-S02 | Story | Todo | Replace mock dashboard data | Dashboard reads candidate-owned server data |
| DASH-S03 | Story | Todo | Add resume/review/repeat actions | Actions route to owned session or setup flow |
| DASH-S04 | Story | Todo | Add dashboard tests | Query and route tests cover empty, active, completed, and forbidden states |
| DASH-F02 | Feature | Future | Progress and coaching themes | Candidate sees useful patterns without noisy analytics |
| DASH-S05 | Story | Future | Surface next best practice recommendation | Recommendation is grounded in candidate-owned history |

### EPIC-06 Resume And Candidate Context

Outcome: Candidate resume inputs and personalization data become safe, normalized context for practice without retaining raw files by default.

Scope: pasted text, processed resume artifacts, future upload, future OCR, candidate intake profile.

Non-goals: long-term shared candidate platform ownership, resume-builder document editing.

Ground truth:

- [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)
- [Data Retention Policy](06-security/data-retention-policy.md)
- [ADR-0005: Processed Resume Retention By Default](08-decisions/ADR-0005-processed-resume-retention-by-default.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| RES-F01 | Feature | Todo | Resume text normalization | Pasted text becomes normalized `resumeText` and draft snapshot context |
| RES-S01 | Story | Todo | Add resume normalization helper | Unit tests cover whitespace, empty, and long text cases |
| RES-F02 | Feature | Todo | Resume upload storage boundary | Original files are private and deleted by default after successful extraction |
| RES-S02 | Story | Todo | Add file upload storage boundary | App stores metadata and private storage path |
| RES-S03 | Story | Todo | Add PDF/DOCX extraction path | Uploaded file produces extracted text or recoverable error |
| RES-F03 | Feature | Future | Resume photo/OCR capture | Multi-page image capture produces ordered extracted text |
| RES-S04 | Story | Todo | Add photo/OCR capture path | Multi-page image order is preserved and text is merged |
| RES-F04 | Feature | Future | Candidate intake profile | Candidate personalization data can influence coaching tone and setup |

### EPIC-07 Azure DevOps Collaboration And Delivery

Outcome: The real Azure project gives the team enough shared context, traceability, and review structure to understand candidate app work without creating a heavyweight process.

Scope: Azure Boards hierarchy, code wiki from `/docs`, dashboards, branch/PR policy, pipelines, candidate integration branch, and visible integration-team questions.

Non-goals: fully mature enterprise DevOps rollout, perfect e2e traceability before collaborators adopt the process, production deployment ownership.

Ground truth:

- [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| OPS-F01 | Feature | Doing | Azure project collaboration setup | Azure Boards/wiki/dashboard give reviewers and integration team the right context |
| <a id="backlog-ops-s01"></a>[OPS-S01](#seq-ops-s01) | Story | Doing | Create candidate integration branch in existing Azure project | `feature/candidate-app-integration` starts from `feature/postgres-integration` |
| OPS-S02 | Story | Todo | Create Azure Boards hierarchy from this backlog | Epics/features/stories/tasks map to the nested tree without over-fragmenting work |
| OPS-S03 | Story | Todo | Publish `/docs` as code wiki from candidate integration branch | Azure code wiki exposes repo docs without creating a separate wiki-only source of truth |
| OPS-S04 | Story | Todo | Add Azure dashboard | Dashboard shows context links, active work, blocked questions, build status, and PRs |
| OPS-S05 | Story | Todo | Add branch/PR policy | Candidate integration branch requires PR review and build validation once collaborators are active |
| OPS-S06 | Story | Todo | Add Azure pipeline | Pipeline runs lint, typecheck, coverage, and build |
| OPS-F02 | Feature | Future | Deployment-gate rehearsal | Staging-like environment uses approval/check placeholders |

### EPIC-08 Production Quality, Security, And Operations

Outcome: The production app has meaningful quality gates, security controls, smoke tests, and observability.

Scope: automated tests, accessibility checks, threat-model updates, telemetry, incident readiness, release gates.

Non-goals: Azure DevOps practice-only setup.

Ground truth:

- [Test Strategy](05-quality/test-strategy.md)
- [Accessibility Baseline](05-quality/accessibility-baseline.md)
- [Candidate App Threat Model](06-security/threat-model.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| QSO-F01 | Feature | Todo | Smoke and regression testing | Browser smoke covers landing, auth, practice, session, dashboard |
| QSO-S01 | Story | Todo | Add smoke tests when flows exist | Browser smoke covers primary candidate routes |
| QSO-S02 | Story | Todo | Add accessibility checks for primary pages | Automated and manual checks cover landing/practice/session/dashboard/summary |
| QSO-F02 | Feature | Todo | Observability and incident readiness | App emits useful telemetry without leaking sensitive data |
| QSO-S03 | Story | Todo | Add observability plan to deployment | Auth denial, draft, generation, extraction, and API errors are observable |
| QSO-S04 | Story | Future | Add incident runbook for candidate app | Runbook covers auth, DB, AI provider, resume extraction, and deployment incidents |

### EPIC-09 Public Discovery And Deployment Strategy

Outcome: The app can support public discovery, authenticated use, and future company domain decisions without deep rework.

Scope: domain strategy, public funnel, authenticated app entry, SEO/content surface, environment-specific routing.

Non-goals: separate-host strategy, full SEO/content completion, final SSO implementation details.

Ground truth:

- [Candidate App Operating Model](01-product/candidate-app-operating-model.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
- [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)

Features and work items:

| ID | Level | Status | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- |
| WEB-F01 | Feature | Doing | Shared host route contract | Confirmed routes, route owners, and collision risks are documented |
| <a id="backlog-web-s01"></a>[WEB-S01](#seq-web-s01) | Story | Done | Resolve production domain strategy | [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md) and [ADR-0006](08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md) capture the decision |
| WEB-S02 | Story | Todo | Port public candidate landing page into shared Azure branch | `/` renders candidate public page in the shared app |
| WEB-S03 | Story | Todo | Add `/recruiter` create-page alias | `/recruiter` lands on recruiter create while `/recruiter/create` remains compatible |
| WEB-S04 | Story | Todo | Add route collision tests | Candidate, recruiter, admin, QA, anonymous, and invite-token contexts resolve correctly |
| WEB-F02 | Feature | Future | Public candidate funnel | Public pages can drive traffic while protected routes require auth |
| WEB-S05 | Story | Future | Define final public landing content strategy | SEO/discovery goals and conversion path are documented |

## Execution Sequence

This sequence is the operational checklist. Every item links back to a backlog ID above.

For items represented in both sections, click the backlog ID to jump between the backlog row and the execution row.

| Seq | Status | Backlog ID | Work | Verification |
| --- | --- | --- | --- | --- |
| 1 | Done | <a id="seq-fnd-s01"></a>[FND-S01](#backlog-fnd-s01) | Align package scripts and CI baseline | Local quality scripts pass |
| 2 | Done | <a id="seq-fnd-s02"></a>[FND-S02](#backlog-fnd-s02) | Align public assets with migrated recruiter app | Candidate public folder matches source asset list |
| 3 | Done | <a id="seq-fnd-s03"></a>[FND-S03](#backlog-fnd-s03) | Create operating docs and this working backlog | Docs index links working doc and ground-truth docs |
| 4 | Done | <a id="seq-fnd-s04"></a>[FND-S04](#backlog-fnd-s04) | Add ADRs and `.env.example` | ADR folder and env template exist |
| 5 | Done | <a id="seq-fnd-s05"></a>[FND-S05](#backlog-fnd-s05) | Add local dev bootstrap contract | Bootstrap doc exists |
| 6 | Done | <a id="seq-fnd-s06"></a>[FND-S06](#backlog-fnd-s06) | Add data retention policy | Retention doc exists |
| 7 | Done | <a id="seq-fnd-s07"></a>[FND-S07](#backlog-fnd-s07) | Add accessibility baseline | Accessibility doc exists |
| 8 | Done | <a id="seq-web-s01"></a>[WEB-S01](#backlog-web-s01) | Document shared host route and Azure branch decision | Route contract and ADR-0006 exist |
| 9 | Doing | <a id="seq-ops-s01"></a>[OPS-S01](#backlog-ops-s01) | Create candidate integration branch in existing Azure project | Branch exists from `feature/postgres-integration` |
| 10 | Todo | <a id="seq-auth-s07"></a>[AUTH-S07](#backlog-auth-s07) | Confirm TalentArbor login return contract | Integration team confirms return/callback/state behavior |
| 11 | Todo | <a id="seq-auth-s01"></a>[AUTH-S01](#backlog-auth-s01) | Add Postgres config/client | Unit tests for env parsing and server-only query wrapper |
| 12 | Todo | <a id="seq-auth-s02"></a>[AUTH-S02](#backlog-auth-s02) | Add candidate identity/profile migration | Migration applies locally |
| 13 | Todo | <a id="seq-auth-s03"></a>[AUTH-S03](#backlog-auth-s03) | Add dev auth and mock candidate access resolver | Protected route resolves stable local candidate |
| 14 | Todo | <a id="seq-auth-s04"></a>[AUTH-S04](#backlog-auth-s04) | Protect candidate route group | Missing auth redirects or blocks |
| 15 | Todo | <a id="seq-drft-s01"></a>[DRFT-S01](#backlog-drft-s01) | Extract practice setup feature slice | Route delegates to feature |
| 16 | Todo | <a id="seq-drft-s02"></a>[DRFT-S02](#backlog-drft-s02) | Add setup validation | Invalid payloads fail with useful errors |
| 17 | Todo | <a id="seq-drft-s03"></a>[DRFT-S03](#backlog-drft-s03) | Add draft repository/service | Repository tests pass |
| 18 | Todo | <a id="seq-drft-s05"></a>[DRFT-S05](#backlog-drft-s05) | Restore server-backed draft after refresh | Browser or route test passes |
| 19 | Todo | <a id="seq-drft-s06"></a>[DRFT-S06](#backlog-drft-s06) | Submit draft into generating state | Draft status and resume target persist |

## Open Questions

| ID | Status | Question | Decision Needed By |
| --- | --- | --- | --- |
| Q-01 | Answered | Use both password-backed local dev auth and explicit mock candidate mode. | Apply during AUTH-S03 |
| Q-02 | Answered | Multiple active/named drafts are a legitimate use case because candidates may initiate more than one practice session and drop in/out of each. | Apply during DRFT-S03 and DRFT-S07 |
| Q-03 | Direction Set | Do not retain original uploaded resume files after normalization/redaction by default; persist the processed resume artifact instead. | Revisit before RES-S02 |
| Q-04 | Answered | `interviewcoach.talentarbor.com` is the shared host; `/` is public candidate page, `/recruiter` is recruiter create, and candidate protected routes are top-level siblings. | Apply during WEB-S02, WEB-S03, and AUTH-S07 |

## Drift Check

At the start of each substantial work pass:

1. Read this document.
2. Read only the ground-truth docs linked by the active backlog item.
3. Confirm whether the active sequence still matches the backlog.
4. If sequence and backlog diverge, update both rows in this file.
5. If project direction changed, update the relevant ground-truth doc or create an ADR.

## Update Rule

Do not create a second active checklist or phase plan.

Add backlog items here. Add execution rows here. Link to ground-truth docs here. Use Azure Boards as the team-facing collaboration system, but keep this file as the repo-local working mirror while the candidate branch is being assembled.
