# Working Backlog

Date: 2026-05-08
Status: Active source of truth for candidate work items, mirrored with Azure Boards state and assignment

## Purpose

This is the one mutable working document for candidate app execution.

It is the repo-local source of truth for what needs to be built, why it matters, how it is decomposed, and what is currently sequenced. Azure Boards can mirror this structure, but this file is the canonical item list while candidate work is being assembled in the shared Azure repo.

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
- [Candidate Integration Work Pass Checklist](START-WORK-PASS.md)

## State Key

- `New`: not started
- `Active`: started, in review, blocked, or currently being coordinated
- `Resolved`: completed and awaiting final closure or parent rollup
- `Closed`: completed and closed in Azure Boards
- `Removed`: removed from scope

## Item Field Model

Use these fields when creating Azure work items.

### Epic And Feature Description Fields

- `Outcome`
- `Scope`
- `Non-goals`
- `Acceptance Criteria`
- `Data / Systems Touched`
- `Security / Privacy Notes`
- `Test Evidence Needed`
- `Linked Docs`
- `Open Questions`

### Story Description Fields

- `Outcome`
- `User Value` or `Question`
- `Desired Behavior`
- `Data / Systems Touched`
- `Security / Privacy Notes`
- `Linked Docs`
- `Open Questions`

Use Azure's dedicated `Acceptance Criteria` field for User Stories.

### Task Fields

- `Implementation Step`
- `Parent`
- `Verification`

## Backlog Tree

### EPIC-01 Product Foundation And Governance

Azure Boards: #639 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: The candidate integration has stable documentation, local setup, environment conventions, and quality guardrails before feature depth grows.

Scope: docs governance, local bootstrap, environment contract, repo conventions, baseline accessibility, retention, and decision records.

Non-goals: final candidate auth, final deployment automation, production SSO ownership.

Ground truth:

- [Candidate App Operating Model](01-product/candidate-app-operating-model.md)
- [Current Foundation](04-architecture/current-foundation.md)
- [Decision Records](08-decisions/README.md)
- [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FND-F01 | 640 | Feature | Resolved | Fu Chen <fu@rangam.com> | Repo and docs baseline | Candidate docs, ADRs, package identity, CI scripts, and source assets exist |
| FND-S01 | 656 | Story | Active | Fu Chen <fu@rangam.com> | Align package name and quality scripts | `lint`, `typecheck`, coverage, stability, and build scripts are available |
| FND-T01 | 657 | Task | New | Fu Chen <fu@rangam.com> | Verify local quality command names | Scripts are listed in package docs or local bootstrap |
| FND-S02 | 658 | Story | Active | Fu Chen <fu@rangam.com> | Align public assets with migrated recruiter app | Candidate public assets match the migrated recruiter baseline where intentionally shared |
| FND-S03 | 641 | Story | Resolved | Fu Chen <fu@rangam.com> | Establish ground-truth docs and single working backlog | [README.md](README.md) links current docs and this backlog |
| FND-T04 | 642 | Task | Closed | Fu Chen <fu@rangam.com> | Establish working docs and ground-truth docs | Foundational docs exist and are hyperlinked |
| FND-S04 | 659 | Story | Active | Fu Chen <fu@rangam.com> | Add ADRs and environment contract | [Decision Records](08-decisions/README.md) and `.env.example` exist |
| FND-F02 | 660 | Feature | Active | Fu Chen <fu@rangam.com> | Local developer bootstrap | A developer can run the app, DB setup, seed data, and quality checks locally |
| FND-S05 | 661 | Story | Active | Fu Chen <fu@rangam.com> | Document local bootstrap contract | [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md) defines current and target commands |
| FND-T02 | 662 | Task | New | Fu Chen <fu@rangam.com> | Implement DB setup/migrate/seed commands after DB layer lands | Commands run locally and are documented |
| FND-F03 | 663 | Feature | Active | Fu Chen <fu@rangam.com> | Policy baselines | Retention, accessibility, and threat-model expectations are usable during implementation |
| FND-S06 | 664 | Story | Active | Fu Chen <fu@rangam.com> | Add data retention policy | [Data Retention Policy](06-security/data-retention-policy.md) states processed-resume retention default |
| FND-S07 | 665 | Story | Active | Fu Chen <fu@rangam.com> | Add accessibility baseline | [Accessibility Baseline](05-quality/accessibility-baseline.md) defines primary UI expectations |
| FND-T03 | 666 | Task | New | Fu Chen <fu@rangam.com> | Revisit threat model after auth and resume ingestion are implemented | Threat model reflects actual route and storage behavior |

### EPIC-02 Candidate Public Funnel And Shared Host Routing

Azure Boards: #667 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: The shared host can serve public, recruiter, admin, QA, invite-token, and authenticated candidate routes without collisions.

Scope: public `/`, candidate CTA targets, `/recruiter` alias, route ownership, API namespace rules, middleware boundaries, and recruiter compatibility.

Non-goals: final marketing copy, final SSO implementation, dashboard feature depth.

Ground truth:

- [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [ADR-0006: Shared Host And Azure Branch Integration](08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WEB-F01 | 751 | Feature | Active | Fu Chen <fu@rangam.com> | Shared host route ownership | Confirmed host, route owners, and collision risks are documented |
| WEB-S01 | 644 | Story | Active | Fu Chen <fu@rangam.com> | Document shared host route and candidate login redirect contracts | Shared host and login redirect contracts exist in `docs/candidate-app` |
| WEB-S02 | 649 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Track shared host route ownership | Route ownership questions are tracked for integration-team review |
| WEB-S03 | 752 | Story | Resolved | Fu Chen <fu@rangam.com> | Port public candidate landing page into shared Azure branch | `/` renders the public candidate page in the shared app |
| WEB-S04 | 753 | Story | Resolved | Fu Chen <fu@rangam.com> | Add `/recruiter` create-page alias | `/recruiter` lands on recruiter create while `/recruiter/create` stays compatible |
| WEB-S05 | 754 | Story | Resolved | Fu Chen <fu@rangam.com> | Add shared-host route collision tests | Candidate, recruiter, admin, QA, anonymous, and invite-token contexts resolve correctly |
| WEB-F02 | 668 | Feature | Active | Fu Chen <fu@rangam.com> | Candidate public CTA funnel | Public CTAs send candidates to the correct login entry and intended return target |
| WEB-S06 | 669 | Story | Resolved | Fu Chen <fu@rangam.com> | Update public CTA targets | Start practice and dashboard CTAs route through candidate login-start behavior |
| WEB-S07 | 670 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Confirm candidate CTA return behavior | Integration team confirms parameter/state/callback behavior or fallback |
| WEB-T01 | 671 | Task | Active | Fu Chen <fu@rangam.com> | Validate `LoginWithType/2` parameter behavior in browser | Observed behavior is recorded in the login redirect contract |
| WEB-F03 | 672 | Feature | Active | Fu Chen <fu@rangam.com> | Recruiter/admin/QA route preservation | Existing recruiter/admin/QA relative paths continue to work after candidate routes land |
| WEB-S08 | 673 | Story | Active | Fu Chen <fu@rangam.com> | Preserve recruiter/admin/QA route behavior | `/recruiter/dashboard`, `/recruiter/templates`, `/recruiter/settings`, `/admin/feedback`, and `/qa/ai-quality` remain valid |

### EPIC-03 Candidate Identity And Auth Handoff

Azure Boards: #674 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Protected candidate routes resolve one candidate access context and enforce candidate-owned data access.

Scope: TalentArbor/RangamWorks identity handoff, local dev auth, mock candidate mode, profile identity persistence, ownership checks, and auth observability.

Non-goals: recruiter/admin/QA auth implementation, final corporate identity platform ownership, anonymous guest trials.

Ground truth:

- [Authenticated Candidate Access](02-requirements/authenticated-candidate-access.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [ADR-0003: Dev Auth And Mock Candidate Mode](08-decisions/ADR-0003-dev-auth-and-mock-candidate-mode.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-F01 | 675 | Feature | Active | Fu Chen <fu@rangam.com> | Candidate profile and identity persistence | Candidate profile and external identity records exist in Postgres |
| AUTH-S01 | 676 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate profile and identity schema | Migration defines `candidate_profiles` and `candidate_identities` |
| AUTH-T01 | 677 | Task | Closed | Fu Chen <fu@rangam.com> | Add ownership indexes and constraints | Schema supports candidate-scoped reads efficiently |
| AUTH-F02 | 678 | Feature | Active | Fu Chen <fu@rangam.com> | Candidate access resolver | Feature code consumes `CandidateAccessContext`, not provider-specific cookies or claims |
| AUTH-S02 | 679 | Story | Resolved | Fu Chen <fu@rangam.com> | Define SSO/auth adapter interface | Interface captures issuer, subject, email, workspace, provider, and display name |
| AUTH-S03 | 680 | Story | New | Fu Chen <fu@rangam.com> | Add password-backed dev auth and explicit mock mode | Local protected routes resolve a stable candidate context |
| AUTH-S04 | 681 | Story | New | Fu Chen <fu@rangam.com> | Protect candidate route group | `/practice`, `/dashboard`, `/session/[sessionId]`, and summary/history routes reject missing auth |
| AUTH-S05 | 682 | Story | New | Fu Chen <fu@rangam.com> | Add negative ownership behavior | Cross-candidate access returns forbidden or not found without leaking data |
| AUTH-T02 | 683 | Task | New | Fu Chen <fu@rangam.com> | Add auth-denial logging without secrets | Denials include route, reason, and actor mode only |
| AUTH-F03 | 755 | Feature | Active | Himanshu Sagar <himanshusagar@rangam.com> | TalentArbor login return and identity handoff | Public CTAs can preserve candidate intent through login when integration supports it |
| AUTH-S06 | 648 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Track TalentArbor login return contract | Return-target, identity handoff, and fallback questions are tracked until confirmed |
| AUTH-S07 | 655 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Confirm TalentArbor login return parameter support | Supported parameter, state, allowlist, and fallback behavior are known |
| AUTH-S08 | 756 | Story | New | Fu Chen <fu@rangam.com> | Implement login-start route after contract is known | `/auth/talentarbor/start?next=/practice` and `/dashboard` validate and preserve safe targets |
| AUTH-S09 | 757 | Story | New | Fu Chen <fu@rangam.com> | Implement callback/session resolution boundary | Successful external login resolves a candidate profile and redirects safely |

### EPIC-04 Shared Postgres And Backend Integration

Azure Boards: #684 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate persistence uses the migrated recruiter app's standard Postgres patterns without reintroducing Supabase.

Scope: server-only Postgres config, migrations, repositories, candidate-owned data access, idempotency, rate limits, metrics, and backend selection guardrails.

Non-goals: Supabase runtime fallback, production DB ownership decisions, cross-product candidate identity master-data ownership.

Ground truth:

- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [ADR-0002: Postgres-Only Backend Direction](08-decisions/ADR-0002-postgres-only-backend-direction.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DATA-F01 | 685 | Feature | Active | Fu Chen <fu@rangam.com> | Postgres client and config foundation | Server-only DB client supports `DATABASE_URL` and split `POSTGRES_*` env values |
| DATA-S01 | 686 | Story | Resolved | Fu Chen <fu@rangam.com> | Port Postgres config/client patterns from migrated recruiter app | Config parsing and query wrapper tests pass |
| DATA-T01 | 687 | Task | Closed | Fu Chen <fu@rangam.com> | Add env validation for candidate backend selectors | Invalid production backend values fail clearly |
| DATA-F02 | 688 | Feature | Active | Fu Chen <fu@rangam.com> | Candidate repository layer | Candidate profiles, drafts, sessions, resumes, and dashboard reads use repository boundaries |
| DATA-S02 | 689 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate profile repository | Create/read/update behavior is tested |
| DATA-S03 | 690 | Story | New | Fu Chen <fu@rangam.com> | Add draft/session repository boundaries | Candidate-owned drafts and sessions are persisted through server code |
| DATA-S04 | 691 | Story | New | Fu Chen <fu@rangam.com> | Add metrics/rate-limit/idempotency boundaries | Durable runtime stores are available where needed |
| DATA-F03 | 692 | Feature | Active | Fu Chen <fu@rangam.com> | Migration and seed path | Local and integration environments can apply schema and seed dev candidates |
| DATA-S05 | 693 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate DB migration | Migration applies cleanly on local Postgres |
| DATA-S06 | 694 | Story | New | Fu Chen <fu@rangam.com> | Add dev seed candidates | Seed data supports happy path and ownership tests |

### EPIC-05 Candidate Practice Setup And Drafts

Azure Boards: #695 | State: New | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidates can create, autosave, restore, and submit multiple candidate-owned practice drafts.

Scope: practice setup form, validation, target role/JD/resume text, multiple active drafts, generation transition, and route resume behavior.

Non-goals: final upload/OCR pipeline, dashboard analytics, full session engine.

Ground truth:

- [Practice Setup Scope](02-requirements/practice-setup-scope.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)
- [ADR-0004: Multiple Active Practice Drafts](08-decisions/ADR-0004-multiple-active-practice-drafts.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DRFT-F01 | 696 | Feature | New | Fu Chen <fu@rangam.com> | Practice setup feature slice | Route page delegates UI and behavior to feature code |
| DRFT-S01 | 697 | Story | New | Fu Chen <fu@rangam.com> | Move practice form into `src/features/practice-setup` | Route delegates to feature module |
| DRFT-S02 | 698 | Story | New | Fu Chen <fu@rangam.com> | Add setup validation schema | Target role required; JD and resume optional; invalid payloads rejected |
| DRFT-T01 | 699 | Task | New | Fu Chen <fu@rangam.com> | Add accessible validation messaging | Required-field and server errors are announced/readable |
| DRFT-F02 | 700 | Feature | New | Fu Chen <fu@rangam.com> | Server-backed draft lifecycle | Draft state is persisted and restorable across refresh/device |
| DRFT-S03 | 701 | Story | New | Fu Chen <fu@rangam.com> | Add draft service/repository | Draft create/read/update paths are tested |
| DRFT-S04 | 702 | Story | New | Fu Chen <fu@rangam.com> | Persist pasted resume text as normalized context | Draft stores normalized resume context |
| DRFT-S05 | 703 | Story | New | Fu Chen <fu@rangam.com> | Restore draft after refresh | Browser or route test proves server state restores form |
| DRFT-S06 | 704 | Story | New | Fu Chen <fu@rangam.com> | Submit draft into generation state | Draft status and resume target persist |
| DRFT-F03 | 705 | Feature | New | Fu Chen <fu@rangam.com> | Multiple draft management | Candidate can distinguish and resume more than one active/named draft |
| DRFT-S07 | 706 | Story | New | Fu Chen <fu@rangam.com> | Model draft naming and selection | Candidate can choose drafts by role/title/date |

### EPIC-06 Candidate Session Engine Integration

Azure Boards: #707 | State: New | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate-owned drafts create and resume candidate-owned interview sessions using reusable session engine patterns.

Scope: question snapshots, session entry, answer lifecycle, pause/resume, feedback, retry, summary handoff, and session ownership.

Non-goals: recruiter invite management, recruiter review UI, candidate dashboard analytics.

Ground truth:

- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| SESS-F01 | 708 | Feature | New | Fu Chen <fu@rangam.com> | Session engine port plan | Candidate-safe session files and exclusions are documented |
| SESS-S01 | 709 | Story | New | Fu Chen <fu@rangam.com> | Identify candidate-safe session engine files | Port list references concrete source files from migrated recruiter app |
| SESS-T01 | 710 | Task | New | Fu Chen <fu@rangam.com> | Mark recruiter-only session assumptions | Invite-token-only and recruiter-review assumptions are listed |
| SESS-F02 | 711 | Feature | New | Fu Chen <fu@rangam.com> | Candidate session lifecycle | Draft creates session and session resumes from persisted state |
| SESS-S02 | 712 | Story | New | Fu Chen <fu@rangam.com> | Add candidate session creation service | Draft produces session ID and immutable question snapshot |
| SESS-S03 | 713 | Story | New | Fu Chen <fu@rangam.com> | Render real session state in `/session/[sessionId]` | Page no longer uses static placeholder content |
| SESS-S04 | 714 | Story | New | Fu Chen <fu@rangam.com> | Persist session progress and resume target | Refresh returns to the correct in-session state |
| SESS-S05 | 715 | Story | New | Fu Chen <fu@rangam.com> | Add session mutation tests | Answer submit, retry, next question, pause, and ownership paths are covered |
| SESS-F03 | 716 | Feature | New | Fu Chen <fu@rangam.com> | Candidate feedback and summary | Candidate sees useful coaching without recruiter-facing readiness semantics |
| SESS-S06 | 717 | Story | New | Fu Chen <fu@rangam.com> | Implement candidate summary route | Completed session opens candidate-owned summary/history surface |

### EPIC-07 Resume Ingestion And Candidate Context

Azure Boards: #718 | State: New | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate resume inputs and intake data become safe, normalized practice context without retaining raw files by default.

Scope: pasted text, processed resume artifacts, future upload, future OCR, storage boundary, extraction metadata, and candidate personalization intake.

Non-goals: resume-builder document editing, long-term shared candidate platform ownership, retaining original files by default.

Ground truth:

- [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)
- [Data Retention Policy](06-security/data-retention-policy.md)
- [ADR-0005: Processed Resume Retention By Default](08-decisions/ADR-0005-processed-resume-retention-by-default.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| RES-F01 | 719 | Feature | New | Fu Chen <fu@rangam.com> | Resume text normalization | Pasted text becomes normalized `resumeText` and draft context |
| RES-S01 | 720 | Story | New | Fu Chen <fu@rangam.com> | Add resume normalization helper | Unit tests cover whitespace, empty, long, and unusual text cases |
| RES-S02 | 721 | Story | New | Fu Chen <fu@rangam.com> | Store processed resume artifact only | Processed text/metadata persists without raw file retention by default |
| RES-F02 | 722 | Feature | New | Fu Chen <fu@rangam.com> | Resume upload extraction boundary | Uploaded PDF/DOCX files produce extracted text or recoverable errors |
| RES-S03 | 723 | Story | New | Fu Chen <fu@rangam.com> | Add private file upload boundary | App stores metadata and private storage path only during processing |
| RES-S04 | 724 | Story | New | Fu Chen <fu@rangam.com> | Add PDF/DOCX extraction path | Extracted text flows into normalized context |
| RES-T01 | 725 | Task | New | Fu Chen <fu@rangam.com> | Delete original file after successful extraction by default | Retention policy is enforced and tested |
| RES-F03 | 726 | Feature | New | Fu Chen <fu@rangam.com> | Resume photo/OCR capture | Multi-page image capture produces ordered extracted text |
| RES-S05 | 727 | Story | New | Fu Chen <fu@rangam.com> | Add photo/OCR capture path | Page order is preserved and merged text is normalized |
| RES-F04 | 728 | Feature | New | Fu Chen <fu@rangam.com> | Candidate intake profile | Candidate personalization data can tune practice and coaching |
| RES-S06 | 729 | Story | New | Fu Chen <fu@rangam.com> | Add structured intake fields | Confidence, interview type, timeline, concerns, and practice focus persist |

### EPIC-08 Candidate Dashboard And History

Azure Boards: #730 | State: New | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidates can see and act on their own practice history, active drafts, completed summaries, and next recommended actions.

Scope: dashboard read model, active drafts, recent sessions, resume/review/repeat actions, summary snippets, empty states, and future coaching themes.

Non-goals: recruiter dashboards, cross-candidate analytics, public marketing pages.

Ground truth:

- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DASH-F01 | 731 | Feature | New | Fu Chen <fu@rangam.com> | Dashboard MVP read model | Contract includes active drafts, recent sessions, last activity, and summaries |
| DASH-S01 | 732 | Story | New | Fu Chen <fu@rangam.com> | Define dashboard query contract | Empty, active, completed, failed, and forbidden states are represented |
| DASH-S02 | 733 | Story | New | Fu Chen <fu@rangam.com> | Replace mock dashboard data | Dashboard reads candidate-owned server data |
| DASH-S03 | 734 | Story | New | Fu Chen <fu@rangam.com> | Add resume/review/repeat actions | Actions route to owned session or setup flow |
| DASH-S04 | 735 | Story | New | Fu Chen <fu@rangam.com> | Add dashboard tests | Query and route tests cover empty, active, completed, and forbidden states |
| DASH-F02 | 736 | Feature | New | Fu Chen <fu@rangam.com> | Progress and coaching themes | Candidate sees useful patterns without noisy analytics |
| DASH-S05 | 737 | Story | New | Fu Chen <fu@rangam.com> | Surface next best practice recommendation | Recommendation is grounded in candidate-owned history |

### EPIC-09 Quality, Security, Observability, And Release Readiness

Azure Boards: #738 | State: New | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate integration has meaningful quality gates, security controls, smoke tests, observability, and release readiness before production exposure.

Scope: automated checks, route smoke tests, accessibility checks, threat model, telemetry, incidents, release gates, and recruiter regression confidence.

Non-goals: Azure Boards administration, complete enterprise incident program.

Ground truth:

- [Test Strategy](05-quality/test-strategy.md)
- [Accessibility Baseline](05-quality/accessibility-baseline.md)
- [Candidate App Threat Model](06-security/threat-model.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| QSO-F01 | 739 | Feature | New | Fu Chen <fu@rangam.com> | Smoke and regression testing | Browser smoke covers public, candidate, recruiter, admin, QA, and invite-token routes |
| QSO-S01 | 740 | Story | New | Fu Chen <fu@rangam.com> | Add primary route smoke tests | `/`, `/recruiter`, `/practice`, `/dashboard`, `/admin/feedback`, and `/qa/ai-quality` are covered |
| QSO-S02 | 741 | Story | New | Fu Chen <fu@rangam.com> | Add accessibility checks for primary pages | Automated and manual checks cover landing/practice/session/dashboard/summary |
| QSO-S03 | 742 | Story | New | Fu Chen <fu@rangam.com> | Add recruiter regression checklist for candidate PRs | Candidate PRs identify recruiter route risk and verification |
| QSO-F02 | 743 | Feature | New | Fu Chen <fu@rangam.com> | Observability and incident readiness | App emits useful telemetry without leaking sensitive data |
| QSO-S04 | 744 | Story | New | Fu Chen <fu@rangam.com> | Add observability plan to deployment | Auth denial, draft, generation, extraction, and API errors are observable |
| QSO-S05 | 745 | Story | New | Fu Chen <fu@rangam.com> | Add incident runbook | Runbook covers auth, DB, AI provider, resume extraction, and deployment incidents |
| QSO-F03 | 746 | Feature | New | Fu Chen <fu@rangam.com> | Security and privacy review | Candidate data, redirects, resume ingestion, and ownership checks are reviewed |
| QSO-S06 | 747 | Story | New | Fu Chen <fu@rangam.com> | Review login redirect security | Open redirects, state tampering, and unsafe return targets are mitigated |
| QSO-S07 | 748 | Story | New | Fu Chen <fu@rangam.com> | Review resume data privacy | Retention, logging, and extraction failure paths avoid sensitive-data leaks |

### EPIC-10 Azure DevOps Collaboration And Delivery

Azure Boards: #749 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Azure DevOps gives the team enough shared context, traceability, and review structure to collaborate on candidate integration without creating heavyweight process overhead.

Scope: Fu-Lab planning board, company Azure branch/PR, external planning links, dashboards, queries, code wiki constraints, branch policy, and import patterns.

Non-goals: perfect end-to-end traceability before company project access exists, replacing durable repo docs with wiki-only pages.

Ground truth:

- [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)
- [Candidate Integration Work Pass Checklist](START-WORK-PASS.md)
- [Azure Integration Note](AZURE-INTEGRATION-NOTE.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| OPS-F01 | 643 | Feature | Active | Fu Chen <fu@rangam.com> | Candidate app integration planning control plane | Fu-Lab Feature 643 tracks planning while company repo owns code |
| OPS-S00 | 645 | Story | Closed | Fu Chen <fu@rangam.com> | Create candidate integration context branch in company Azure repo | Historical setup item retained for traceability |
| OPS-S01 | 750 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate integration branch in company Azure repo | `feature/candidate-app-integration` exists from `feature/postgres-integration` |
| OPS-S02 | 650 | Story | Resolved | Fu Chen <fu@rangam.com> | Port candidate docs into company Azure branch | `docs/candidate-app` exists in `feature/candidate-app-integration` |
| OPS-S03 | 651 | Story | Resolved | Fu Chen <fu@rangam.com> | Open candidate integration PR in company Azure repo | Draft PR `!593` targets `feature/postgres-integration` |
| OPS-S04 | 647 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate integration dashboard | Dashboard includes context and active/blocked query widgets |
| OPS-S05 | 652 | Story | Active | Fu Chen <fu@rangam.com> | Define candidate integration PR policy | Target branch, draft convention, external planning link, and reviewer expectations are documented |
| OPS-S06 | 654 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Track candidate docs review for PR `!593` | Review feedback is captured in PR comments or Fu-Lab Boards |
| OPS-S07 | 653 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate integration starter checklist | [START-WORK-PASS.md](START-WORK-PASS.md) exists and is linked from docs hub |
| OPS-F02 | 758 | Feature | Active | Fu Chen <fu@rangam.com> | Azure Boards import and traceability pattern | Work item import files can create correctly linked Azure hierarchy |
| OPS-S08 | 759 | Story | Active | Fu Chen <fu@rangam.com> | Validate CSV import pattern for linked work items | Import CSV creates child story under Feature 643 |
| OPS-S09 | 760 | Story | Active | Fu Chen <fu@rangam.com> | Import canonical backlog hierarchy into Fu-Lab Boards | Import file reflects this working backlog and imports cleanly |
| OPS-S10 | 646 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Publish company code wiki when access allows | `/docs/candidate-app` is published from company Azure project as code wiki |
| OPS-S11 | 761 | Story | New | Himanshu Sagar <himanshusagar@rangam.com> | Add branch policy after reviewers are available | Candidate branch has agreed PR/build requirements |
| OPS-S12 | 762 | Story | New | Fu Chen <fu@rangam.com> | Add candidate integration pipeline | Pipeline runs lint, typecheck, tests, and build |

## Execution Sequence

This sequence is the operational checklist. Every item maps to the backlog tree above.

| Seq | State | Backlog ID | Azure ID | Assigned To | Work | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Active | WEB-S01 | 644 | Fu Chen <fu@rangam.com> | Document shared host route and Azure branch decision | Shared host contract and ADR-0006 exist |
| 2 | Active | OPS-S01 | 750 | Fu Chen <fu@rangam.com> | Create candidate integration branch in company Azure repo | Branch tracks `azure/feature/candidate-app-integration` |
| 3 | Resolved | OPS-S02 | 650 | Fu Chen <fu@rangam.com> | Port candidate docs into company Azure branch | `docs/candidate-app` added and pushed |
| 4 | Resolved | OPS-S03 | 651 | Fu Chen <fu@rangam.com> | Open candidate integration PR | Draft PR `!593` exists |
| 5 | Resolved | OPS-S07 | 653 | Fu Chen <fu@rangam.com> | Add candidate integration starter checklist | Checklist added and pushed |
| 6 | Active | OPS-S05 | 652 | Fu Chen <fu@rangam.com> | Define candidate integration PR policy | Policy captured in work item/PR notes |
| 7 | Active | OPS-S06 | 654 | Himanshu Sagar <himanshusagar@rangam.com> | Track candidate docs review for PR `!593` | Feedback captured and follow-ups created |
| 8 | Active | AUTH-S07 | 655 | Himanshu Sagar <himanshusagar@rangam.com> | Confirm TalentArbor login return parameter support | Integration team confirms parameter/state/fallback behavior |
| 9 | Active | WEB-S07 | 670 | Himanshu Sagar <himanshusagar@rangam.com> | Confirm candidate CTA return behavior | Login return behavior is captured in docs and work item |
| 10 | Active | OPS-S09 | 760 | Fu Chen <fu@rangam.com> | Import canonical backlog hierarchy | CSV import creates expected linked items |
| 11 | Resolved | WEB-S03 | 752 | Fu Chen <fu@rangam.com> | Port public landing page into shared Azure branch | `/` renders candidate public page |
| 12 | Resolved | WEB-S04 | 753 | Fu Chen <fu@rangam.com> | Add `/recruiter` create alias | `/recruiter` lands on recruiter create |
| 13 | Resolved | WEB-S05 | 754 | Fu Chen <fu@rangam.com> | Add shared-host route collision tests | Public CTA, login-start, middleware, and route ownership tests pass |
| 14 | Resolved | DATA-S05 | 693 | Fu Chen <fu@rangam.com> | Add candidate DB migration | Candidate profile/identity migration and smoke validation pass |
| 15 | Resolved | DATA-S02 | 689 | Fu Chen <fu@rangam.com> | Add candidate profile repository | Provider identity lookup and resolve/create tests pass |
| 16 | Resolved | DATA-S01 | 686 | Fu Chen <fu@rangam.com> | Add Postgres config/client | Existing migrated Postgres config/client tests pass |
| 17 | Closed | DATA-T01 | 687 | Fu Chen <fu@rangam.com> | Add candidate backend selector validation | Candidate data backend and auth mode guardrail tests pass |
| 18 | Resolved | AUTH-S01 | 676 | Fu Chen <fu@rangam.com> | Add candidate profile/identity migration | Migration applies locally |
| 19 | Closed | AUTH-T01 | 677 | Fu Chen <fu@rangam.com> | Add ownership indexes and constraints | Candidate profile and identity constraints exist |
| 20 | Resolved | AUTH-S02 | 679 | Fu Chen <fu@rangam.com> | Define SSO/auth adapter interface | Provider-neutral auth handoff tests pass |
| 21 | New | AUTH-S03 | 680 | Fu Chen <fu@rangam.com> | Add dev auth and mock mode | Protected routes resolve local candidate context |
| 22 | New | DRFT-S01 | 697 | Fu Chen <fu@rangam.com> | Extract practice setup feature slice | Route delegates to feature |
| 23 | New | DRFT-S03 | 701 | Fu Chen <fu@rangam.com> | Add server-backed draft lifecycle | Draft repository tests pass |
| 24 | New | SESS-S02 | 712 | Fu Chen <fu@rangam.com> | Add candidate session creation service | Draft creates owned session |
| 25 | New | DASH-S01 | 732 | Fu Chen <fu@rangam.com> | Define dashboard query contract | Empty/active/completed/forbidden states are represented |

## Open Questions

| ID | Status | Question | Decision Needed By |
| --- | --- | --- | --- |
| Q-01 | Answered | Use both password-backed local dev auth and explicit mock candidate mode. | Apply during AUTH-S03 |
| Q-02 | Answered | Multiple active/named drafts are a legitimate use case. | Apply during DRFT-S03 and DRFT-S07 |
| Q-03 | Direction Set | Do not retain original uploaded resume files after normalization/redaction by default; persist processed resume artifact instead. | Revisit before RES-S03 |
| Q-04 | Answered | `interviewcoach.talentarbor.com` is the shared host; `/` is public page, `/recruiter` is recruiter create, candidate routes are top-level siblings. | Apply during WEB-S02, WEB-S03, and AUTH-S06 |
| Q-05 | Open | Does `LoginWithType/2` preserve return URL/callback/state through TalentArbor login? | Before AUTH-S07 |
| Q-06 | Open | What identity handoff protocol will TalentArbor/RangamWorks provide to Interview Coach? | Before AUTH-S08 |

## Drift Check

At the start of each substantial work pass:

1. Read this document.
2. Read only the ground-truth docs linked by the active backlog item.
3. Confirm whether the active sequence still matches the backlog.
4. If sequence and backlog diverge, update both rows in this file.
5. If project direction changed, update the relevant ground-truth doc or create an ADR.

## Update Rule

Do not create a second active checklist or phase plan.

Add backlog items here. Add execution rows here. Link to ground-truth docs here. Use Azure Boards as the team-facing collaboration system, but keep this file as the repo-local source of truth while candidate work is being assembled.
