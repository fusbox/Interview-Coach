# Working Backlog

Date: 2026-05-08
Status: Active source of truth for candidate work items, mirrored with Azure Boards state and assignment

## Purpose

This is the one mutable working document for candidate app execution.

It is the repo-local source of truth for what needs to be built, why it matters, how it is decomposed, and what is currently sequenced. Azure Boards can mirror this structure, but this file is the canonical item list while candidate work is being assembled in the shared Azure repo.

## Ground-Truth Docs

- [SPEC](SPEC.md)
- [DATA_CONTRACT](DATA_CONTRACT.md)
- [HANDOFF](HANDOFF.md)
- [Candidate App Operating Model](01-product/candidate-app-operating-model.md)
- [Practice Setup Scope](02-requirements/practice-setup-scope.md)
- [Authenticated Candidate Access](02-requirements/authenticated-candidate-access.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [Design System Foundation](03-design/design-system-foundation.md)
- [Current Foundation](04-architecture/current-foundation.md)
- [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)
- [Candidate Session Engine Port Plan](04-architecture/session-engine-port-plan.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [Platform Launch PrepProfile Migration](04-architecture/platform-launch-prepprofile-migration.md)
- [Interview Preparedness Signal Contract](04-architecture/preparedness-signal-contract.md)
- [Preparedness Signal Map](04-architecture/preparedness-signal-map.md)
- [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)
- [Test Strategy](05-quality/test-strategy.md)
- [Accessibility Baseline](05-quality/accessibility-baseline.md)
- [Candidate App Threat Model](06-security/threat-model.md)
- [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md)
- [Azure DevOps Operating Model](07-ops/azure-devops-operating-model.md)
- [Candidate Integration PR Policy](07-ops/candidate-integration-pr-policy.md)
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

- [SPEC](SPEC.md)
- [DATA_CONTRACT](DATA_CONTRACT.md)
- [HANDOFF](HANDOFF.md)
- [Candidate App Operating Model](01-product/candidate-app-operating-model.md)
- [Current Foundation](04-architecture/current-foundation.md)
- [Decision Records](08-decisions/README.md)
- [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FND-F01 | 640 | Feature | Resolved | Fu Chen <fu@rangam.com> | Repo and docs baseline | Candidate docs, ADRs, package identity, CI scripts, and source assets exist |
| FND-S01 | 656 | Story | Resolved | Fu Chen <fu@rangam.com> | Align package name and quality scripts | `lint`, `typecheck`, coverage, stability, and build scripts are available |
| FND-T01 | 657 | Task | Closed | Fu Chen <fu@rangam.com> | Verify local quality command names | Scripts are listed in package docs or local bootstrap |
| FND-S02 | 658 | Story | Resolved | Fu Chen <fu@rangam.com> | Align public assets with migrated recruiter app | Candidate public assets match the migrated recruiter baseline where intentionally shared |
| FND-S03 | 641 | Story | Resolved | Fu Chen <fu@rangam.com> | Establish ground-truth docs and single working backlog | [README.md](README.md) links current docs and this backlog |
| FND-T04 | 642 | Task | Closed | Fu Chen <fu@rangam.com> | Establish working docs and ground-truth docs | Foundational docs exist and are hyperlinked |
| FND-S04 | 659 | Story | Resolved | Fu Chen <fu@rangam.com> | Add ADRs and environment contract | [Decision Records](08-decisions/README.md) and `.env.example` exist |
| FND-F02 | 660 | Feature | Resolved | Fu Chen <fu@rangam.com> | Local developer bootstrap | A developer can run the app, DB setup, seed data, and quality checks locally |
| FND-S05 | 661 | Story | Resolved | Fu Chen <fu@rangam.com> | Document local bootstrap contract | [Local Dev Bootstrap](09-dev/local-dev-bootstrap.md) defines current and target commands |
| FND-T02 | 662 | Task | Closed | Fu Chen <fu@rangam.com> | Implement DB setup/migrate/seed commands after DB layer lands | `db:setup`, `db:migrate`, `db:seed`, and candidate readiness commands are available and documented |
| FND-F03 | 663 | Feature | Active | Fu Chen <fu@rangam.com> | Policy baselines | Retention, accessibility, and threat-model expectations are usable during implementation |
| FND-S06 | 664 | Story | Resolved | Fu Chen <fu@rangam.com> | Add data retention policy | [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md) states processed-resume retention default |
| FND-S07 | 665 | Story | Active | Fu Chen <fu@rangam.com> | Add accessibility baseline | [Accessibility Baseline](05-quality/accessibility-baseline.md) defines primary UI expectations |
| FND-T03 | 666 | Task | Closed | Fu Chen <fu@rangam.com> | Revisit threat model after auth and resume ingestion are implemented | Threat model reflects actual route, auth-denial, resume, and storage behavior |

### EPIC-02 Candidate Public Funnel And Shared Host Routing

Azure Boards: #667 | State: Resolved | Assigned To: Fu Chen <fu@rangam.com>

Outcome: The shared host can serve public, recruiter, admin, QA, invite-token, and authenticated candidate routes without collisions.

Scope: public `/`, candidate CTA targets, `/recruiter` alias, route ownership, API namespace rules, middleware boundaries, and recruiter compatibility.

Non-goals: final marketing copy, final SSO implementation, dashboard feature depth.

Ground truth:

- [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [ADR-0006: Shared Host And Azure Branch Integration](08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WEB-F01 | 751 | Feature | Resolved | Fu Chen <fu@rangam.com> | Shared host route ownership | Confirmed host, route owners, and collision risks are documented |
| WEB-S03 | 752 | Story | Resolved | Fu Chen <fu@rangam.com> | Port public candidate landing page into shared Azure branch | `/` renders the public candidate page in the shared app |
| WEB-S04 | 753 | Story | Resolved | Fu Chen <fu@rangam.com> | Add `/recruiter` create-page alias | `/recruiter` lands on recruiter create while `/recruiter/create` stays compatible |
| WEB-S05 | 754 | Story | Resolved | Fu Chen <fu@rangam.com> | Add shared-host route collision tests | Candidate, recruiter, admin, QA, anonymous, and invite-token contexts resolve correctly |
| WEB-F02 | 668 | Feature | Resolved | Fu Chen <fu@rangam.com> | Candidate public CTA funnel | Public CTAs send candidates to the correct login entry and intended return target; remaining TalentArbor return behavior questions are tracked as integration tasks |
| WEB-S06 | 669 | Story | Resolved | Fu Chen <fu@rangam.com> | Update public CTA targets | Start practice and dashboard CTAs route through candidate login-start behavior |
| WEB-S07 | 670 | Story | Resolved | Himanshu Sagar <himanshusagar@rangam.com> | Confirm candidate CTA return behavior | Return-behavior tracking is consolidated under the TalentArbor identity handoff work; implementation remains blocked by final contract answers |
| WEB-F03 | 672 | Feature | Resolved | Fu Chen <fu@rangam.com> | Recruiter/admin/QA route preservation | Existing recruiter/admin/QA relative paths continue to work after candidate routes land |
| WEB-S08 | 673 | Story | Resolved | Fu Chen <fu@rangam.com> | Preserve recruiter/admin/QA route behavior | `/recruiter/dashboard` restores the migrated recruiter dashboard while `/recruiter/templates`, `/recruiter/settings`, `/admin/feedback`, and `/qa/ai-quality` remain protected under shared-host routing |

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
| AUTH-F01 | 675 | Feature | Resolved | Fu Chen <fu@rangam.com> | Candidate profile and identity persistence | Candidate profile and external identity records exist in Postgres |
| AUTH-S01 | 676 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate profile and identity schema | Migration defines `candidate_profiles` and `candidate_identities` |
| AUTH-T01 | 677 | Task | Closed | Fu Chen <fu@rangam.com> | Add ownership indexes and constraints | Schema supports candidate-scoped reads efficiently |
| AUTH-F02 | 678 | Feature | Resolved | Fu Chen <fu@rangam.com> | Candidate access resolver | Feature code consumes `CandidateAccessContext`, not provider-specific cookies or claims |
| AUTH-S02 | 679 | Story | Resolved | Fu Chen <fu@rangam.com> | Define SSO/auth adapter interface | Interface captures issuer, subject, email, workspace, provider, and display name |
| AUTH-S03 | 680 | Story | Resolved | Fu Chen <fu@rangam.com> | Add password-backed dev auth and explicit mock mode | Local protected routes resolve a stable candidate context |
| AUTH-S04 | 681 | Story | Resolved | Fu Chen <fu@rangam.com> | Protect candidate route group | `/practice`, `/dashboard`, `/session/[sessionId]`, and summary/history routes reject missing auth |
| AUTH-S05 | 682 | Story | Resolved | Fu Chen <fu@rangam.com> | Add negative ownership behavior | Cross-candidate access returns forbidden or not found without leaking data |
| AUTH-T02 | 683 | Task | Closed | Fu Chen <fu@rangam.com> | Add auth-denial logging without secrets | Denials include route, reason, and actor mode only |
| AUTH-F03 | 755 | Feature | Active | Himanshu Sagar <himanshusagar@rangam.com> | TalentArbor login return and identity handoff | Public CTAs can preserve candidate intent through login when integration supports it |
| AUTH-S06 | 648 | Story | Resolved | Himanshu Sagar <himanshusagar@rangam.com> | Track TalentArbor login return contract | Return-target, identity handoff, and fallback questions are consolidated under AUTH-F03/AUTH-S08/AUTH-S09 until final contract answers are known |
| AUTH-S07 | 655 | Story | Resolved | Himanshu Sagar <himanshusagar@rangam.com> | Confirm TalentArbor login return parameter support | Parameter/state/callback questions are consolidated under AUTH-F03/AUTH-S08/AUTH-S09 until final contract answers are known |
| AUTH-S08 | 756 | Story | New | Fu Chen <fu@rangam.com> | Implement login-start route after contract is known | `/auth/talentarbor/start?next=/practice` and `/dashboard` validate and preserve safe targets |
| AUTH-S09 | 757 | Story | New | Fu Chen <fu@rangam.com> | Implement callback/session resolution boundary | Successful external login resolves a candidate profile and redirects safely |

### EPIC-04 Shared Postgres And Backend Integration

Azure Boards: #684 | State: Resolved | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate persistence uses the migrated recruiter app's standard Postgres patterns without reintroducing Supabase.

Scope: server-only Postgres config, migrations, repositories, candidate-owned data access, idempotency, rate limits, metrics, and backend selection guardrails.

Non-goals: Supabase runtime fallback, production DB ownership decisions, cross-product candidate identity master-data ownership.

Ground truth:

- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [ADR-0002: Postgres-Only Backend Direction](08-decisions/ADR-0002-postgres-only-backend-direction.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DATA-F01 | 685 | Feature | Resolved | Fu Chen <fu@rangam.com> | Postgres client and config foundation | Server-only DB client supports `DATABASE_URL` and split `POSTGRES_*` env values |
| DATA-S01 | 686 | Story | Resolved | Fu Chen <fu@rangam.com> | Port Postgres config/client patterns from migrated recruiter app | Config parsing and query wrapper tests pass |
| DATA-T01 | 687 | Task | Closed | Fu Chen <fu@rangam.com> | Add env validation for candidate backend selectors | Invalid production backend values fail clearly |
| DATA-F02 | 688 | Feature | Resolved | Fu Chen <fu@rangam.com> | Candidate repository layer | Candidate profiles, drafts, sessions, resumes, and dashboard reads use repository boundaries |
| DATA-S02 | 689 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate profile repository | Create/read/update behavior is tested |
| DATA-S03 | 690 | Story | Resolved | Fu Chen <fu@rangam.com> | Add draft/session repository boundaries | Candidate-owned drafts and sessions are persisted through server code |
| DATA-S04 | 691 | Story | Resolved | Fu Chen <fu@rangam.com> | Add metrics/rate-limit/idempotency boundaries | Route metrics and candidate mutation rate-limit/state-idempotency boundaries are tested; expired Postgres idempotency keys can be reacquired for resumed hint generation |
| DATA-F03 | 692 | Feature | Resolved | Fu Chen <fu@rangam.com> | Migration and seed path | Local and integration environments can apply schema and seed dev candidates |
| DATA-S05 | 693 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate DB migration | Migration applies cleanly on local Postgres |
| DATA-S06 | 694 | Story | Resolved | Fu Chen <fu@rangam.com> | Add dev seed candidates | Seed SQL and smoke validation support happy path and ownership tests |

### EPIC-05 Candidate Practice Setup And Drafts

Azure Boards: #695 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidates can create, autosave, restore, and submit multiple candidate-owned practice drafts.

Scope: practice setup form, validation, target role/JD/resume text, multiple active drafts, generation transition, and route resume behavior.

Non-goals: final upload/OCR pipeline, dashboard analytics, full session engine.

Ground truth:

- [Practice Setup Scope](02-requirements/practice-setup-scope.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)
- [ADR-0004: Multiple Active Practice Drafts](08-decisions/ADR-0004-multiple-active-practice-drafts.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DRFT-F01 | 696 | Feature | Resolved | Fu Chen <fu@rangam.com> | Practice setup feature slice | Route page delegates UI and behavior to feature code |
| DRFT-S01 | 697 | Story | Resolved | Fu Chen <fu@rangam.com> | Move practice form into `src/features/practice-setup` | Route delegates to feature module |
| DRFT-S02 | 698 | Story | Resolved | Fu Chen <fu@rangam.com> | Add setup validation schema | Target role and JD required; resume optional; invalid payloads rejected |
| DRFT-T01 | 699 | Task | Closed | Fu Chen <fu@rangam.com> | Add accessible validation messaging | Required-field and server errors are announced/readable |
| DRFT-F02 | 700 | Feature | Resolved | Fu Chen <fu@rangam.com> | Server-backed draft lifecycle | Draft state is persisted and restorable across refresh/device |
| DRFT-S03 | 701 | Story | Resolved | Fu Chen <fu@rangam.com> | Add draft service/repository | Draft create/read/update paths are tested |
| DRFT-S04 | 702 | Story | Resolved | Fu Chen <fu@rangam.com> | Persist pasted resume text as normalized context | Draft stores normalized resume context |
| DRFT-S05 | 703 | Story | Resolved | Fu Chen <fu@rangam.com> | Restore draft after refresh | Browser or route test proves server state restores form |
| DRFT-S06 | 704 | Story | Resolved | Fu Chen <fu@rangam.com> | Submit draft into generation state | Draft status and resume target persist |
| DRFT-F03 | 705 | Feature | Resolved | Fu Chen <fu@rangam.com> | Multiple draft management | Candidate can distinguish and resume more than one active/named draft |
| DRFT-S07 | 706 | Story | Resolved | Fu Chen <fu@rangam.com> | Model draft naming and selection | Candidate can choose editable drafts by role label and last activity date |
| DRFT-S08 | 769 | Story | Resolved | Fu Chen <fu@rangam.com> | Build practice setup UI MVP | `/practice` saves edited setup, resume context, structured intake, and draft selection before routing into session creation |
| DRFT-F04 | 772 | Feature | Active | Fu Chen <fu@rangam.com> | Practice setup UI refinement | Practice setup copy, layout, progressive disclosure, policy notices, and final interaction polish are reviewed as product UI work after the backend/MVP shell is stable |

### EPIC-06 Candidate Session Engine Integration

Azure Boards: #707 | State: Resolved | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate-owned drafts create and resume candidate-owned interview sessions using reusable session engine patterns.

Scope: question snapshots, session entry, answer lifecycle, pause/resume, feedback, retry, summary handoff, and session ownership.

Non-goals: recruiter invite management, recruiter review UI, candidate dashboard analytics.

Ground truth:

- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Practice Session Draft Contract](04-architecture/practice-session-draft-contract.md)
- [Candidate Session Engine Port Plan](04-architecture/session-engine-port-plan.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| SESS-F01 | 708 | Feature | Resolved | Fu Chen <fu@rangam.com> | Session engine port plan | Candidate-safe session files and exclusions are documented |
| SESS-S01 | 709 | Story | Resolved | Fu Chen <fu@rangam.com> | Identify candidate-safe session engine files | Port list references concrete source files from migrated recruiter app |
| SESS-T01 | 710 | Task | Closed | Fu Chen <fu@rangam.com> | Mark recruiter-only session assumptions | Invite-token-only and recruiter-review assumptions are listed |
| SESS-F02 | 711 | Feature | Resolved | Fu Chen <fu@rangam.com> | Candidate session lifecycle | Draft creates session and session resumes from persisted state |
| SESS-S02 | 712 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate session creation service | Draft produces session ID and immutable question snapshot |
| SESS-S03 | 713 | Story | Resolved | Fu Chen <fu@rangam.com> | Render real session state in `/session/[sessionId]` | Page no longer uses static placeholder content |
| SESS-S04 | 714 | Story | Resolved | Fu Chen <fu@rangam.com> | Persist session progress and resume target | Refresh returns to the correct in-session state |
| SESS-S05 | 715 | Story | Resolved | Fu Chen <fu@rangam.com> | Add session mutation tests | Start, next, pause, resume, complete, and ownership paths are covered |
| SESS-F03 | 716 | Feature | Resolved | Fu Chen <fu@rangam.com> | Candidate feedback and summary | Candidate sees useful coaching without recruiter-facing readiness semantics |
| SESS-S06 | 717 | Story | Resolved | Fu Chen <fu@rangam.com> | Implement candidate summary route | Completed session opens candidate-owned summary/history surface |
| SESS-S07 | 764 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate answer and retry mutation surface | Candidate-owned answer submit and retry persist through server actions and Postgres session storage without invite-token dependency |
| SESS-S08 | 765 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate answer coaching action | Candidate-owned submitted answers can generate and display coaching through a candidate ownership boundary |
| SESS-S09 | 770 | Story | Resolved | Fu Chen <fu@rangam.com> | Build live practice session UI MVP | `/session/[sessionId]` reuses recruiter session workspace patterns for prompt, progress, answer, coaching, retry, pause/resume, completion, and hidden engagement debug inspection |
| SESS-F05 | 777 | Feature | Resolved | Fu Chen <fu@rangam.com> | AI-backed candidate question generation | Candidate practice session creation uses the shared question-generation service instead of the mock role-only generator |
| SESS-S10 | 778 | Story | Resolved | Fu Chen <fu@rangam.com> | Wire candidate session creation to shared AI question generation | Candidate setup passes required role/JD context, optional resume text, interview type, and question count into the shared generator; recruiter API behavior remains covered |
| SESS-F04 | 773 | Feature | Active | Fu Chen <fu@rangam.com> | Live session UI refinement | Candidate session flow, feedback presentation, voice/text controls, pause/resume affordances, and policy-adjacent notices are reviewed as product UI work after the shared session engine is stable |
| SESS-S11 | 779 | Story | Resolved | Fu Chen <fu@rangam.com> | Align candidate session entry and active-question controls with invite session | Candidate-owned sessions use an invite-style entry screen before Q1, default to invite-style voice mode, expose Hints/Example panels, support text-mode answer entry with the shared multistep loader, use Exit Session header language, expose read-question playback, prefetch Q1/Qn+1 audio, and keep the hidden engagement/AI context inspector available |
| SESS-S12 | 781 | Story | Resolved | Fu Chen <fu@rangam.com> | Align candidate feedback rendering with invite session | Candidate feedback now opens the shared invite-session feedback drawer after answer analysis, preserves current-turn transcript/audio for answer review, routes final-question completion to the candidate summary, and renders the recruiter-style candidate debrief surface with candidate-owned survey capture |
| SESS-S13 | 786 | Story | Resolved | Fu Chen <fu@rangam.com> | Pass candidate resume context to live coaching calls | Candidate-owned Hints and Example/strong-response calls receive the session resume context when present, matching recruiter-invited session behavior |
| SESS-S14 | 788 | Story | New | Fu Chen <fu@rangam.com> | Add candidate session transition loaders | `/practice` generation-to-session landing and session landing-to-active-question transitions show candidate-appropriate multistep loader states using the existing loader component; later preparedness/coaching content can replace the initial copy |
| SESS-S15 | 789 | Story | New | Fu Chen <fu@rangam.com> | Add Entering Interview Room transition to candidate session | Candidate-owned sessions show an invite-style Entering Interview Room transition before active question entry without regressing Q1 audio readiness, reduced-motion behavior, or resume-aware coaching context |
| SESS-S16 | 790 | Story | New | Fu Chen <fu@rangam.com> | Align candidate finish-session redirect with recruiter flow | Final-question Finish Session navigates immediately to `/summary/[sessionId]`; the summary route owns debrief loading/generation so the session page does not wait on debrief generation before redirect |
| SESS-S17 | 791 | Story | New | Fu Chen <fu@rangam.com> | Add dashboard navigation affordance from candidate session | `/session/[sessionId]` exposes an accessible, candidate-owned path back to `/dashboard` without cluttering the active answer flow or weakening session ownership/auth boundaries |
| SESS-S18 | 793 | Story | New | Fu Chen <fu@rangam.com> | Route completed session URLs to summary or friendly not-found state | Visiting `/session/[sessionId]` for a completed candidate-owned session with an existing/generated debrief routes to `/summary/[sessionId]`; inaccessible, missing, or wrong-owner sessions return a friendly candidate-safe not-found state without leaking session existence |

### EPIC-07 Resume Ingestion And Candidate Context

Azure Boards: #718 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate resume inputs and intake data become safe, normalized practice context without retaining raw files by default.

Scope: pasted text, processed resume artifacts, future upload, future OCR, storage boundary, extraction metadata, and candidate personalization intake.

Non-goals: resume-builder document editing, long-term shared candidate platform ownership, retaining original files by default.

Ground truth:

- [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)
- [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md)
- [ADR-0005: Processed Resume Retention By Default](08-decisions/ADR-0005-processed-resume-retention-by-default.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| RES-F01 | 719 | Feature | Resolved | Fu Chen <fu@rangam.com> | Resume text normalization | Pasted text becomes normalized `resumeText` and draft context |
| RES-S01 | 720 | Story | Resolved | Fu Chen <fu@rangam.com> | Add resume normalization helper | Unit tests cover whitespace, empty, long, and unusual text cases |
| RES-S02 | 721 | Story | Resolved | Fu Chen <fu@rangam.com> | Store processed resume artifact only | Processed text/metadata persists without raw file retention by default |
| RES-F02 | 722 | Feature | Resolved | Fu Chen <fu@rangam.com> | Resume upload extraction boundary | Uploaded PDF/DOCX files produce extracted text or recoverable errors |
| RES-S03 | 723 | Story | Resolved | Fu Chen <fu@rangam.com> | Add private file upload boundary | Pending upload metadata stores only private relative storage paths and processing-only retention |
| RES-S04 | 724 | Story | Resolved | Fu Chen <fu@rangam.com> | Add PDF/DOCX extraction path | Extracted text flows into normalized context through a parser-agnostic service boundary |
| RES-T01 | 725 | Task | Closed | Fu Chen <fu@rangam.com> | Delete original file after successful extraction by default | Successful extraction marks source asset retention as `original_deleted` |
| RES-F03 | 726 | Feature | New | Fu Chen <fu@rangam.com> | Resume photo/OCR capture | Multi-page image capture produces ordered extracted text |
| RES-S05 | 727 | Story | New | Fu Chen <fu@rangam.com> | Add photo/OCR capture path | Page order is preserved and merged text is normalized |
| RES-F04 | 728 | Feature | Resolved | Fu Chen <fu@rangam.com> | Candidate intake profile | Candidate personalization data can tune practice and coaching |
| RES-S06 | 729 | Story | Resolved | Fu Chen <fu@rangam.com> | Add structured intake fields | Confidence, interview type, timeline, concerns, and practice focus persist |

### EPIC-08 Candidate Dashboard And History

Azure Boards: #730 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidates can see and act on their own practice history, active drafts, completed summaries, and next recommended actions.

Scope: dashboard read model, active drafts, recent sessions, resume/review/repeat actions, summary snippets, empty states, and future coaching themes.

Non-goals: recruiter dashboards, cross-candidate analytics, public marketing pages.

Ground truth:

- [Candidate-Driven Implementation Plan](04-architecture/candidate-driven-implementation-plan.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| DASH-F01 | 731 | Feature | Resolved | Fu Chen <fu@rangam.com> | Dashboard MVP read model | Contract includes active drafts, recent sessions, last activity, and summaries |
| DASH-S01 | 732 | Story | Resolved | Fu Chen <fu@rangam.com> | Define dashboard query contract | Empty, active, completed, and missing-auth states are represented |
| DASH-S02 | 733 | Story | Resolved | Fu Chen <fu@rangam.com> | Replace mock dashboard data | Dashboard reads candidate-owned server data |
| DASH-S03 | 734 | Story | Resolved | Fu Chen <fu@rangam.com> | Add resume/review/repeat actions | Actions route to owned session, summary, or setup flow |
| DASH-S04 | 735 | Story | Resolved | Fu Chen <fu@rangam.com> | Add dashboard tests | Query and route tests cover empty, active, completed, and missing-auth states |
| DASH-F02 | 736 | Feature | Resolved | Fu Chen <fu@rangam.com> | Progress and coaching themes | Candidate sees useful patterns without noisy analytics |
| DASH-S05 | 737 | Story | Resolved | Fu Chen <fu@rangam.com> | Surface next best practice recommendation | Recommendation is grounded in candidate-owned history |
| DASH-S06 | 771 | Story | Resolved | Fu Chen <fu@rangam.com> | Build dashboard UI MVP | Dashboard presents next practice step, active practice, completed history, coaching snippets, empty state, and resume/review/repeat affordances in the candidate design system |
| DASH-F03 | 774 | Feature | Active | Fu Chen <fu@rangam.com> | Dashboard UI refinement | Dashboard copy, hierarchy, empty states, history affordances, privacy cues, and final interaction polish are reviewed as product UI work after the read model and MVP shell are stable |
| DASH-T01 | 783 | Task | Closed | Fu Chen <fu@rangam.com> | Tune One Big Upgrade output voice and hidden-state hygiene | One Big Upgrade avoids internal action literals such as `stop_for_now`, avoids over-polished or fabricated language, and keeps Try saying this in candidate-ready voice/readability |
| DASH-S07 | 792 | Story | New | Fu Chen <fu@rangam.com> | Add candidate confidence measurement capture | Landing screen captures pre-session confidence and summary captures post-session confidence as self-reported candidate preparedness data tied to candidate, prep profile when available, session, moment, and timestamp; this remains distinct from `user_feedback`, which is reserved for helpfulness/UX feedback such as "Was this helpful?" |

### EPIC-09 Quality, Security, Observability, And Release Readiness

Azure Boards: #738 | State: Active | Assigned To: Fu Chen <fu@rangam.com>

Outcome: Candidate integration has meaningful quality gates, security controls, smoke tests, observability, and release readiness before production exposure.

Scope: automated checks, route smoke tests, accessibility checks, threat model, telemetry, incidents, release gates, and recruiter regression confidence.

Non-goals: Azure Boards administration, complete enterprise incident program.

Ground truth:

- [Test Strategy](05-quality/test-strategy.md)
- [Accessibility Baseline](05-quality/accessibility-baseline.md)
- [Candidate App Threat Model](06-security/threat-model.md)
- [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md)

| ID | Azure ID | Level | State | Assigned To | Item | Acceptance Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| QSO-F01 | 739 | Feature | Resolved | Fu Chen <fu@rangam.com> | Smoke and regression testing | Browser smoke covers public, candidate, recruiter, admin, QA, and invite-token routes |
| QSO-S01 | 740 | Story | Resolved | Fu Chen <fu@rangam.com> | Add primary route smoke tests | `/`, `/recruiter`, `/practice`, `/dashboard`, `/admin/feedback`, and `/qa/ai-quality` are covered |
| QSO-S02 | 741 | Story | Resolved | Fu Chen <fu@rangam.com> | Add accessibility checks for primary pages | Automated baseline covers landing/practice/session/dashboard/summary; manual checks remain in the accessibility baseline |
| QSO-S03 | 742 | Story | Resolved | Fu Chen <fu@rangam.com> | Add recruiter regression checklist for candidate PRs | Candidate PRs identify recruiter route risk and verification |
| QSO-S08 | 766 | Story | Resolved | Fu Chen <fu@rangam.com> | Add seeded setup-to-summary smoke readiness | DB smoke validates deterministic setup, in-session, summary, and saved-feedback fixtures |
| QSO-S09 | 768 | Story | Resolved | Fu Chen <fu@rangam.com> | Add seeded browser smoke for candidate setup to summary | Browser smoke uses deterministic seeded candidate fixtures to validate setup, session, and summary navigation |
| QSO-F02 | 743 | Feature | Active | Fu Chen <fu@rangam.com> | Observability and incident readiness | App emits useful telemetry without leaking sensitive data |
| QSO-S04 | 744 | Story | Resolved | Fu Chen <fu@rangam.com> | Add observability plan to deployment | Auth denial, draft, generation, extraction, and API errors are observable |
| QSO-S05 | 745 | Story | Resolved | Fu Chen <fu@rangam.com> | Add incident runbook | Runbook covers auth, DB, AI provider, resume extraction, and deployment incidents |
| QSO-F03 | 746 | Feature | Resolved | Fu Chen <fu@rangam.com> | Security and privacy review | Candidate data, redirects, resume ingestion, and ownership checks are reviewed |
| QSO-S06 | 747 | Story | Resolved | Fu Chen <fu@rangam.com> | Review login redirect security | Open redirects, state tampering, and unsafe return targets are mitigated |
| QSO-S07 | 748 | Story | Resolved | Fu Chen <fu@rangam.com> | Review resume data privacy | Retention, logging, and extraction failure paths avoid sensitive-data leaks |
| QSO-F04 | 775 | Feature | Resolved | Fu Chen <fu@rangam.com> | Privacy, cookie, and AI disclosure readiness | App-local notices are implemented and policy/company clarification follow-ups are split to a policy-owner review task |
| QSO-S10 | 776 | Story | Resolved | Fu Chen <fu@rangam.com> | Review Interview Coach privacy, cookie, and AI policy fit | [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md) is reviewed with policy owners; required notice, retention, cookie, AI vendor, and data-visibility follow-ups are confirmed or split into implementation items |
| QSO-T01 | 782 | Task | New | Himanshu Sagar <himanshusagar@rangam.com> | Review policy docs and resolve company-policy clarifications | Policy owner/integration review confirms governing policy, protected-route tags, retention/export/delete posture, company footer, and exact policy links |
| QSO-S11 | 784 | Story | New | Fu Chen <fu@rangam.com> | Vet runtime PII and sensitive-data scrubbing approach | Runtime scrubbing options are reviewed for resume content, JD, answers, transcripts, AI prompts/responses, AI-quality capture, logs, and observability before production exposure |
| QSO-S12 | 785 | Story | New | Fu Chen <fu@rangam.com> | Tighten question-scoped AI generation capture contract | Hint and strong-response AI-generation records persist explicit question source references while older rows remain inspectable through query fallback |
| QSO-S13 | 787 | Story | New | Fu Chen <fu@rangam.com> | Harden AI-quality review surface for sensitive data | `/qa/ai-quality` list, detail, and export views mask or redact resume content, transcripts, prompts, raw outputs, parsed outputs, emails, candidate identity values, and other sensitive payloads while preserving useful evaluation metadata |

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
| OPS-S14 | 643 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Coordinate candidate integration planning control plane | Fu-Lab Boards, repo docs/code wiki, PR review, shared-host confirmation, and branch policy follow-ups stay aligned with the company repo integration path |
| OPS-T04 | 644 | Task | Active | Himanshu Sagar <himanshusagar@rangam.com> | Review shared host route and candidate login redirect contracts | Integration team confirms the shared-host and login redirect docs reflect the intended deployment and handoff behavior |
| OPS-T05 | 649 | Task | Active | Himanshu Sagar <himanshusagar@rangam.com> | Confirm shared host route ownership | Integration team confirms public, candidate, recruiter, admin, QA, invite-token, and API route ownership under `interviewcoach.talentarbor.com` |
| OPS-T06 | 671 | Task | Active | Himanshu Sagar <himanshusagar@rangam.com> | Validate `LoginWithType/2` return behavior with integration team | Observed behavior and supported callback/state/return parameters are recorded in the login redirect contract |
| OPS-S00 | 645 | Story | Closed | Fu Chen <fu@rangam.com> | Create candidate integration context branch in company Azure repo | Historical setup item retained for traceability |
| OPS-S01 | 750 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate integration branch in company Azure repo | `feature/candidate-app-integration` exists from `feature/postgres-integration` |
| OPS-S02 | 650 | Story | Resolved | Fu Chen <fu@rangam.com> | Port candidate docs into company Azure branch | `docs/candidate-app` exists in `feature/candidate-app-integration` |
| OPS-S03 | 651 | Story | Resolved | Fu Chen <fu@rangam.com> | Open candidate integration PR in company Azure repo | Draft PR `!593` targets `feature/postgres-integration` |
| OPS-S04 | 647 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate integration dashboard | Dashboard includes context and active/blocked query widgets |
| OPS-S05 | 652 | Story | Resolved | Fu Chen <fu@rangam.com> | Define candidate integration PR policy | [Candidate Integration PR Policy](07-ops/candidate-integration-pr-policy.md) documents target branch, draft convention, evidence bundle, external planning link, and reviewer expectations |
| OPS-S06 | 654 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Review candidate integration docs and handoff in PR `!593` | Himanshu reviews the candidate docs/handoff package in PR `!593`, confirms it gives the integration team enough context to merge and continue work, and captures approval, comments, or follow-up items in PR comments or Fu-Lab Boards |
| OPS-S07 | 653 | Story | Resolved | Fu Chen <fu@rangam.com> | Create candidate integration starter checklist | [START-WORK-PASS.md](START-WORK-PASS.md) exists and is linked from docs hub |
| OPS-F02 | 758 | Feature | Active | Fu Chen <fu@rangam.com> | Azure Boards import and traceability pattern | Work item import files can create correctly linked Azure hierarchy |
| OPS-S08 | 759 | Story | Resolved | Fu Chen <fu@rangam.com> | Validate CSV import pattern for linked work items | Import CSV creates child story under Feature 643 |
| OPS-S09 | 760 | Story | Resolved | Fu Chen <fu@rangam.com> | Import canonical backlog hierarchy into Fu-Lab Boards | Confirmed import file reflects this working backlog and imports cleanly |
| OPS-S10 | 646 | Story | Active | Himanshu Sagar <himanshusagar@rangam.com> | Publish company code wiki when access allows | `/docs/candidate-app` is published from company Azure project as code wiki after company project permissions/support are available |
| OPS-S11 | 761 | Story | New | Himanshu Sagar <himanshusagar@rangam.com> | Add branch policy after reviewers are available | Candidate branch has agreed reviewer and build requirements after reviewer ownership is known |
| OPS-S12 | 762 | Story | Resolved | Fu Chen <fu@rangam.com> | Add candidate integration pipeline | Pipeline definition runs lint, typecheck, candidate tests, build, and candidate DB smoke readiness |
| OPS-S13 | 767 | Story | Resolved | Fu Chen <fu@rangam.com> | Wire candidate pipeline in Azure project | Fu-Lab pipeline passes without STDIO close warning after rehearsal env and browser-smoke cleanup |

## Execution Sequence

This sequence is the operational checklist. Every item maps to the backlog tree above.

| Seq | State | Backlog ID | Azure ID | Assigned To | Work | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Active | OPS-T04 | 644 | Himanshu Sagar <himanshusagar@rangam.com> | Review shared host route and candidate login redirect contracts | Integration team confirms the shared-host and login redirect docs reflect intended deployment and handoff behavior |
| 2 | Active | OPS-S01 | 750 | Fu Chen <fu@rangam.com> | Create candidate integration branch in company Azure repo | Branch tracks `azure/feature/candidate-app-integration` |
| 3 | Resolved | OPS-S02 | 650 | Fu Chen <fu@rangam.com> | Port candidate docs into company Azure branch | `docs/candidate-app` added and pushed |
| 4 | Resolved | OPS-S03 | 651 | Fu Chen <fu@rangam.com> | Open candidate integration PR | Draft PR `!593` exists |
| 5 | Resolved | OPS-S07 | 653 | Fu Chen <fu@rangam.com> | Add candidate integration starter checklist | Checklist added and pushed |
| 6 | Resolved | OPS-S05 | 652 | Fu Chen <fu@rangam.com> | Define candidate integration PR policy | Policy captured in [Candidate Integration PR Policy](07-ops/candidate-integration-pr-policy.md) |
| 7 | Active | OPS-S06 | 654 | Himanshu Sagar <himanshusagar@rangam.com> | Review candidate integration docs and handoff in PR `!593` | Approval, comments, or follow-ups are captured in PR comments or Fu-Lab Boards |
| 8 | Resolved | AUTH-S07 | 655 | Himanshu Sagar <himanshusagar@rangam.com> | Confirm TalentArbor login return parameter support | Consolidated under AUTH-F03/AUTH-S08/AUTH-S09 until final contract answers are known |
| 9 | Resolved | WEB-S07 | 670 | Himanshu Sagar <himanshusagar@rangam.com> | Confirm candidate CTA return behavior | Consolidated under AUTH-F03/AUTH-S08/AUTH-S09 until final contract answers are known |
| 10 | Resolved | OPS-S09 | 760 | Fu Chen <fu@rangam.com> | Import canonical backlog hierarchy | Confirmed CSV import creates expected linked items |
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
| 21 | Resolved | AUTH-S03 | 680 | Fu Chen <fu@rangam.com> | Add dev auth and mock mode | Local candidate auth handoff resolver tests pass |
| 22 | Resolved | AUTH-S04 | 681 | Fu Chen <fu@rangam.com> | Protect candidate route group | Middleware redirects external-mode candidate protected routes and allows explicit local modes |
| 23 | Resolved | DRFT-S01 | 697 | Fu Chen <fu@rangam.com> | Extract practice setup feature slice | `/practice` delegates to `src/features/practice-setup` and renders first setup form |
| 24 | Resolved | DRFT-S02 | 698 | Fu Chen <fu@rangam.com> | Add setup validation schema | Shared parser trims setup inputs, requires target role, normalizes blank optional text to null, and rejects invalid payloads |
| 25 | Closed | DRFT-T01 | 699 | Fu Chen <fu@rangam.com> | Add accessible validation messaging | Required-field and future server submission errors are announced/readable |
| 26 | Resolved | DRFT-S03 | 701 | Fu Chen <fu@rangam.com> | Add server-backed draft lifecycle | Draft repository tests pass |
| 27 | Resolved | RES-S01 | 720 | Fu Chen <fu@rangam.com> | Add resume normalization helper | Unit tests cover whitespace, empty, long, and unusual text cases |
| 28 | Resolved | DRFT-S04 | 702 | Fu Chen <fu@rangam.com> | Persist pasted resume text as normalized context | Draft stores normalized resume context |
| 29 | Resolved | DRFT-S05 | 703 | Fu Chen <fu@rangam.com> | Restore draft after refresh | Route and form tests prove latest editable draft pre-fills setup form |
| 30 | Resolved | DRFT-S06 | 704 | Fu Chen <fu@rangam.com> | Submit draft into generation state | Draft transition sets `status = generating` and `resumeTargetScreen = practice_generating` |
| 31 | Resolved | SESS-S02 | 712 | Fu Chen <fu@rangam.com> | Add candidate session creation service | Draft creates owned session |
| 32 | Resolved | SESS-S03 | 713 | Fu Chen <fu@rangam.com> | Render real session state in `/session/[sessionId]` | Candidate-owned session route renders persisted role, status, and current question |
| 33 | Resolved | SESS-S04 | 714 | Fu Chen <fu@rangam.com> | Persist session progress and resume target | Start/next actions persist shared session state and draft resume target |
| 34 | Resolved | SESS-S05 | 715 | Fu Chen <fu@rangam.com> | Add session mutation tests | Start, next, pause, resume, complete, and ownership paths are covered |
| 35 | Resolved | SESS-S07 | 764 | Fu Chen <fu@rangam.com> | Add candidate answer and retry mutation surface | Candidate-owned answer/retry persists through server actions without invite token dependency |
| 36 | Resolved | DASH-S01 | 732 | Fu Chen <fu@rangam.com> | Define dashboard query contract | Empty, active, completed, and missing-auth states are represented |
| 37 | Resolved | DASH-S02 | 733 | Fu Chen <fu@rangam.com> | Replace mock dashboard data | `/dashboard` reads candidate-owned server data instead of local mock data |
| 38 | Resolved | DASH-S04 | 735 | Fu Chen <fu@rangam.com> | Add dashboard tests | Loader, feature page, and route tests cover the dashboard MVP |
| 39 | Resolved | DASH-S03 | 734 | Fu Chen <fu@rangam.com> | Add resume/review/repeat actions | Dashboard cards route to owned session, summary, or setup flow |
| 40 | Resolved | SESS-S06 | 717 | Fu Chen <fu@rangam.com> | Implement candidate summary route | Completed dashboard items open a candidate-owned summary route |
| 41 | Resolved | RES-S02 | 721 | Fu Chen <fu@rangam.com> | Store processed resume artifact only | Processed resume artifact persists in draft context with raw-file retention set false |
| 42 | Resolved | AUTH-S05 | 682 | Fu Chen <fu@rangam.com> | Add negative ownership behavior | Candidate draft/session/summary/dashboard misses return not-found style behavior without data leak |
| 43 | Resolved | RES-S03 | 723 | Fu Chen <fu@rangam.com> | Add private file upload boundary | Pending upload metadata stores only private relative storage paths and processing-only retention |
| 44 | Resolved | QSO-S06 | 747 | Fu Chen <fu@rangam.com> | Review login redirect security | Login-start and callback paths use allowlisted candidate return targets |
| 45 | Resolved | RES-S04 | 724 | Fu Chen <fu@rangam.com> | Add PDF/DOCX extraction path | Extracted text flows into normalized processed resume context through a parser-agnostic service |
| 46 | Resolved | QSO-S07 | 748 | Fu Chen <fu@rangam.com> | Review resume data privacy | Extraction errors store safe reason codes only and successful extraction marks original retention deleted |
| 47 | Resolved | RES-S06 | 729 | Fu Chen <fu@rangam.com> | Add structured intake fields | Structured confidence, interview type, timeline, concerns, and focus values persist on candidate-owned drafts |
| 48 | Resolved | DRFT-S07 | 706 | Fu Chen <fu@rangam.com> | Model draft naming and selection | `/practice?draftId=...` restores a selected owned draft and shows editable draft choices by role/date |
| 49 | Resolved | QSO-S01 | 740 | Fu Chen <fu@rangam.com> | Add primary route smoke tests | `/`, `/recruiter`, `/practice`, `/dashboard`, `/admin/feedback`, and `/qa/ai-quality` are covered |
| 50 | Resolved | QSO-S02 | 741 | Fu Chen <fu@rangam.com> | Add accessibility checks for primary pages | Automated baseline covers landing/practice/session/dashboard/summary; manual checks remain in the accessibility baseline |
| 51 | Resolved | QSO-S03 | 742 | Fu Chen <fu@rangam.com> | Add recruiter regression checklist for candidate PRs | Candidate PRs identify recruiter route risk and verification |
| 52 | Resolved | QSO-S04 | 744 | Fu Chen <fu@rangam.com> | Add observability plan to deployment | Auth denial, draft, generation, extraction, and API errors are observable |
| 53 | Resolved | QSO-S05 | 745 | Fu Chen <fu@rangam.com> | Add incident runbook | Runbook covers auth, DB, AI provider, resume extraction, and deployment incidents |
| 54 | Resolved | DATA-S04 | 691 | Fu Chen <fu@rangam.com> | Add metrics/rate-limit/idempotency boundaries | `withCandidateMutationBoundary` rate-limits generation/progress/answer/retry mutations and documents state-idempotent replay behavior |
| 55 | Resolved | DATA-S06 | 694 | Fu Chen <fu@rangam.com> | Add dev seed candidates | `db:seed-candidate-dev` and `db:smoke-candidate-dev-seed` create and validate primary/alternate candidates |
| 56 | Resolved | SESS-S01 | 709 | Fu Chen <fu@rangam.com> | Identify candidate-safe session engine files | Session engine port plan lists shared domain/repository/service files and candidate adapters |
| 57 | Closed | SESS-T01 | 710 | Fu Chen <fu@rangam.com> | Mark recruiter-only session assumptions | Session engine port plan lists invite-token, recruiter ownership, initials-gate, and recruiter-review exclusions |
| 58 | Resolved | SESS-F01 | 708 | Fu Chen <fu@rangam.com> | Session engine port plan | Candidate-safe file inventory and exclusion map are documented |
| 59 | Resolved | SESS-S08 | 765 | Fu Chen <fu@rangam.com> | Add candidate answer coaching action | Candidate-owned submitted answers generate and display coaching through `AIService.analyzeAnswer` without invite-token dependency |
| 60 | Resolved | SESS-F03 | 716 | Fu Chen <fu@rangam.com> | Candidate feedback and summary | Candidate answer coaching and summary surfaces are implemented with candidate ownership checks and without recruiter-facing readiness semantics |
| 61 | Resolved | DASH-S05 | 737 | Fu Chen <fu@rangam.com> | Surface next best practice recommendation | Dashboard next best action is grounded in active session progress or latest completed-session coaching |
| 62 | Resolved | DASH-F02 | 736 | Fu Chen <fu@rangam.com> | Progress and coaching themes | Candidate dashboard shows useful next-practice guidance without noisy analytics |
| 63 | Resolved | QSO-S08 | 766 | Fu Chen <fu@rangam.com> | Add seeded setup-to-summary smoke readiness | `db:smoke-candidate-setup-summary` validates deterministic setup, in-session, completed-summary, and saved-feedback fixtures |
| 64 | Resolved | QSO-F01 | 739 | Fu Chen <fu@rangam.com> | Smoke and regression testing | Seed-backed DB and browser smoke paths now cover deterministic candidate setup-to-summary readiness |
| 65 | Resolved | OPS-S12 | 762 | Fu Chen <fu@rangam.com> | Add candidate integration pipeline | `azure-pipelines.candidate.yml` and `ci:candidate` scripts define lint, typecheck, candidate tests, build, and DB smoke readiness |
| 66 | Resolved | OPS-S13 | 767 | Fu Chen <fu@rangam.com> | Wire candidate pipeline in Azure project | Fu-Lab pipeline passed end to end without STDIO close warning |
| 67 | Resolved | QSO-S09 | 768 | Fu Chen <fu@rangam.com> | Add seeded browser smoke for candidate setup to summary | `test:e2e:candidate-seeded` validates seeded mock candidate navigation from practice setup through generated session completion and summary |
| 68 | New | AUTH-S08 | 756 | Fu Chen <fu@rangam.com> | Implement login-start route after contract is known | Blocked until Q-05/Q-06 identity handoff answers are known |
| 69 | Closed | FND-T01 | 657 | Fu Chen <fu@rangam.com> | Verify local quality command names | Local bootstrap now lists current quality, DB, and seeded browser smoke commands from `package.json` |
| 70 | Closed | FND-T02 | 662 | Fu Chen <fu@rangam.com> | Implement DB setup/migrate/seed commands after DB layer lands | `db:setup` and `db:migrate` now wrap the current smoke Postgres migration/seed path |
| 71 | Resolved | DATA-S03 | 690 | Fu Chen <fu@rangam.com> | Add draft/session repository boundaries | Audit confirmed candidate-owned draft/session persistence boundaries are implemented through repositories/services and covered by tests |
| 72 | Closed | AUTH-T02 | 683 | Fu Chen <fu@rangam.com> | Add auth-denial logging without secrets | Candidate external-mode auth redirects log safe route, reason, actor type, and actor mode fields without logging secrets or query payloads |
| 73 | Closed | FND-T03 | 666 | Fu Chen <fu@rangam.com> | Revisit threat model after auth and resume ingestion are implemented | Threat model now reflects shared host, auth modes, route boundaries, candidate ownership, resume ingestion, storage assumptions, AI risks, logging, CI, and the fact that candidate UI polish is still ahead |
| 74 | Resolved | OPS-S13 | 767 | Fu Chen <fu@rangam.com> | Wire candidate pipeline in Azure project | Passing Fu-Lab pipeline evidence captured; branch policy/build validation can wait until reviewer policy is ready |
| 75 | Resolved | DRFT-S08 | 769 | Fu Chen <fu@rangam.com> | Build practice setup UI MVP | Practice setup now saves role/JD/resume/intake, supports new or restored drafts, and renders the polished MVP setup UI |
| 76 | Resolved | SESS-S09 | 770 | Fu Chen <fu@rangam.com> | Build live practice session UI MVP | Candidate session route now reuses recruiter session workspace patterns with candidate-owned server actions and hidden engagement debug inspection |
| 77 | Resolved | DASH-S06 | 771 | Fu Chen <fu@rangam.com> | Build dashboard UI MVP | Dashboard UI now renders the polished MVP over the existing read model, including next action, active practice, completed history, empty state, and coaching snippets |
| 78 | Resolved | WEB-S08 | 673 | Fu Chen <fu@rangam.com> | Preserve recruiter/admin/QA route behavior | `/recruiter/dashboard` restored as the recruiter dashboard compatibility route; primary route smoke covers recruiter/admin/QA protection |
| 79 | Resolved | OPS-S05 | 652 | Fu Chen <fu@rangam.com> | Define candidate integration PR policy | Refreshed reviewer policy includes implemented candidate UI MVP scope, recruiter regression evidence, branch strategy, and current blockers |
| 80 | Resolved | OPS-S08 | 759 | Fu Chen <fu@rangam.com> | Validate CSV import pattern for linked work items | Import CSV creates child story under Feature 643 |
| 81 | Resolved | QSO-S10 | 776 | Fu Chen <fu@rangam.com> | Review Interview Coach privacy, cookie, and AI policy fit | Policy requirements are consolidated in [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md); remaining company-policy clarifications are split to QSO-T01 |
| 82 | Resolved | FND-F02 | 660 | Fu Chen <fu@rangam.com> | Roll up local developer bootstrap | Child story/task are resolved or closed; package scripts and local bootstrap docs cover app, DB setup, seed, quality checks, and candidate browser review |
| 83 | Resolved | WEB-F01 | 751 | Fu Chen <fu@rangam.com> | Roll up shared host route ownership | Public, recruiter, admin, QA, invite-token, and candidate route ownership is implemented and covered by route tests |
| 84 | Resolved | WEB-F03 | 672 | Fu Chen <fu@rangam.com> | Roll up recruiter/admin/QA route preservation | Recruiter dashboard compatibility and shared-host regression coverage are in place |
| 85 | Resolved | AUTH-F01 | 675 | Fu Chen <fu@rangam.com> | Roll up candidate profile and identity persistence | Candidate profile/identity schema, constraints, indexes, and repository coverage are in place |
| 86 | Resolved | AUTH-F02 | 678 | Fu Chen <fu@rangam.com> | Roll up candidate access resolver | Auth adapter, local dev modes, protected route handling, ownership denial, and safe denial logging are covered |
| 87 | Resolved | DATA-F01 | 685 | Fu Chen <fu@rangam.com> | Roll up Postgres client and config foundation | Server-only Postgres config/client and candidate backend selector guardrails are covered |
| 88 | Resolved | DATA-F02 | 688 | Fu Chen <fu@rangam.com> | Roll up candidate repository layer | Candidate profile, draft, session, resume, dashboard, metrics, rate-limit, and idempotency boundaries are covered |
| 89 | Resolved | DATA-F03 | 692 | Fu Chen <fu@rangam.com> | Roll up migration and seed path | Candidate migrations, dev seed, and smoke validation scripts are present |
| 90 | Resolved | QSO-F02 | 743 | Fu Chen <fu@rangam.com> | Roll up observability and incident readiness | Candidate observability tests, observability plan, and incident runbook are in place |
| 91 | Active | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Track practice setup UI refinement separately | Candidate-owned UI polish remains open while backend/integration scope is complete |
| 92 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Track live session UI refinement separately | Candidate session question, feedback, summary, voice/text, and disclosure parity have landed for the current MVP scope |
| 93 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Track dashboard UI refinement separately | Candidate-owned UI polish remains open while dashboard read-model scope is complete |
| 94 | Resolved | SESS-F05 | 777 | Fu Chen <fu@rangam.com> | Track AI-backed candidate question generation | Shared question-generation service is implemented and used by recruiter API plus candidate session creation; recruiter regression and DB output checks produced expected invite/session/question/AI capture data |
| 95 | Resolved | SESS-S10 | 778 | Fu Chen <fu@rangam.com> | Wire candidate session creation to shared AI question generation | Candidate setup now passes required role/JD context, optional resume text, interview type, and question count into the shared generator; focused tests, candidate suite, typecheck, lint, build, recruiter browser regression, and DB output checks passed |
| 96 | Resolved | SESS-S11 | 779 | Fu Chen <fu@rangam.com> | Align candidate session entry and active-question controls with invite session | Candidate route now matches invite-session entry, default active-question voice surface, Hints/Example panels, text-mode answer entry, text submission loader, exit/read controls, Q1/Qn+1 audio prefetch, and hidden debug inspector expectations |
| 97 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Continue deeper live-session UI parity | Feedback rendering, summary/debrief, and follow-up email parity have landed for the current MVP scope |
| 98 | Resolved | SESS-S12 | 781 | Fu Chen <fu@rangam.com> | Align candidate feedback rendering with invite session | Shared feedback drawer is reused for candidate analysis, current-turn transcript/audio is available in View your answer, final-question completion routes to `/summary/[sessionId]`, candidate sessions now carry candidate identity for personalized debrief/follow-up email eligibility, and the summary page renders the recruiter-style debrief/survey without recruiter visibility copy; seeded browser smoke now covers setup, three answer submissions, feedback drawer exploration, transcript slide-over, finish redirect, and summary rendering |
| 99 | Resolved | DATA-S04 | 691 | Fu Chen <fu@rangam.com> | Fix expired hint idempotency key reuse | Postgres idempotency store now clears expired rows for the same scope/actor/key before reserving, so older resumed session questions can regenerate/replay hints instead of failing behind `/api/tips/generate` |
| 100 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Browser-validate feedback and summary parity | Seeded browser smoke validates practice setup, text answer submission, shared feedback drawer exploration, transcript slide-over, retry/continue/finish transition coverage through finish, `/summary/[sessionId]` routing, and debrief rendering; the smoke runner now blanks SMTP env values so local e2e does not attempt real debrief email delivery |
| 101 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Continue live-session UI parity validation | Manual validation confirmed candidate session question presentation, answer submission, feedback, summary, and email behavior for the current MVP scope |
| 102 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Make candidate summary route render before debrief generation | Candidate completion now skips blocking completion side effects, `/summary/[sessionId]` renders the skeleton immediately, an ownership-checked finalization endpoint generates the debrief/email after load, and the summary title falls back to the candidate profile first name when old sessions lack embedded candidate metadata |
| 103 | Resolved | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Remove redundant General interview type option | `/practice` now presents the null/default interview type as Balanced practice, removes the duplicate General option, and preserves legacy restored `general` values as the balanced default |
| 104 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Confirm candidate finish-session redirect behavior | Current finish flow still uses the expected Next server-action `303` redirect from `/session/[sessionId]`; completion no longer blocks on debrief/email generation, and stale `POST /summary/[sessionId]` server-action errors point to an old dev client/server bundle rather than the current API finalizer path |
| 105 | Resolved | QSO-S09 | 768 | Fu Chen <fu@rangam.com> | Make seeded browser smoke port deterministic | `test:e2e:candidate-seeded` now selects an available local port, passes the matching base URL into Playwright, and avoids false failures when port 3000 is already occupied |
| 106 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Right-align text-mode submit action | Candidate text-mode Submit Answer footer now removes its extra horizontal inset so the action aligns to the same right rail as the textarea and session components above it |
| 107 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Replace candidate summary practice-again CTA | Candidate summary now uses quiet page-navigation actions for Back to Dashboard and Back to Practice Setup, removing the recruiter-style Close this window and loud Practice Again CTA from the candidate debrief |
| 108 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Equalize candidate summary navigation buttons | Back to Dashboard and Back to Practice Setup now share the same quiet nav-button treatment, hover state, border, rest color, and width rhythm instead of mixing secondary and tertiary emphasis styles |
| 109 | Resolved | QSO-S10 | 776 | Fu Chen <fu@rangam.com> | Consolidate privacy, disclosure, consent, and retention docs | Security docs now use a two-doc structure: privacy/disclosures/consent requirements as the policy implementation source of truth, and the threat model as the engineering risk artifact |
| 110 | Resolved | QSO-F04 | 775 | Fu Chen <fu@rangam.com> | Land candidate app-local disclosure and consent UI | Public home, candidate shell pages, practice setup, session entry, voice mode, and summary now include MVP disclosure, acknowledgement, and company-footer placeholder surfaces; policy/company clarification follow-ups are split to QSO-T01 |
| 111 | New | QSO-T01 | 782 | Himanshu Sagar <himanshusagar@rangam.com> | Review policy docs and resolve company-policy clarifications | Review the linked security/policy docs and confirm governing policies, protected-route tags, retention/export/delete posture, company footer, and exact policy links |
| 112 | Active | OPS-S14 | 643 | Himanshu Sagar <himanshusagar@rangam.com> | Coordinate candidate integration planning control plane | Fu-Lab board, repo docs/code wiki, PR review, shared-host confirmation, and branch policy follow-ups stay aligned |
| 113 | Active | OPS-T05 | 649 | Himanshu Sagar <himanshusagar@rangam.com> | Confirm shared host route ownership | Integration team confirms route ownership for public, candidate, recruiter, admin, QA, invite-token, and API paths |
| 114 | Active | OPS-T06 | 671 | Himanshu Sagar <himanshusagar@rangam.com> | Validate `LoginWithType/2` return behavior with integration team | Supported callback/state/return behavior is recorded in the login redirect contract |
| 115 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Start One Big Upgrade coaching signal | Shared answer analysis now asks for a single highest-leverage upgrade and renders it in the feedback flow as support for the existing next-action decision; dashboard use remains a follow-up refinement |
| 116 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Surface One Big Upgrade on dashboard | Dashboard reads the latest persisted oneBigUpgrade from answer feedback, prefers it over older recommendation text for completed-session next steps, labels history snippets distinctly, and keeps recommendation/summary fallback for older sessions |
| 117 | Closed | DASH-T01 | 783 | Fu Chen <fu@rangam.com> | Tune One Big Upgrade output voice and hidden-state hygiene | Analysis prompt now forbids internal next-action literals in candidate-facing One Big Upgrade copy, and a deterministic sanitizer removes leaked action literals before feedback reaches UI/dashboard surfaces |
| 118 | Resolved | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Clarify practice focus setup control | `/practice` keeps the persisted `interviewType` contract but labels it as Practice focus, explains that it changes question emphasis, and uses candidate-facing option labels |
| 119 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Fix dashboard background frame | Dashboard root now extends to the shared candidate shell content edges so the painted background surface is not inset by shell padding |
| 120 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Land dashboard V2 component foundation | Dashboard now uses reusable `NextPracticeFocusCard`, `PracticePathCard`, `ConfidenceTrendCard`, `RecentPracticeList`, and metric components; the disposable spec now tracks done/upcoming component work with a dashboard-specific execution log |
| 121 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Add dashboard exploration component shells | Dashboard now includes reusable `ResumeRoleBridgePreview` and `FocusChipCloud` shells with accessible regions, requirement/evidence states, and selected focus-chip semantics; real resume/JD gap rules and chip interactions are staged as upcoming work |
| 122 | Queued | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Stage advanced setup progressive disclosure | Next practice setup pass should move optional setup controls into a mobile-first progressive disclosure surface instead of lengthening the default setup flow |
| 123 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage dashboard progress metrics | Next dashboard metric pass should convert current stat cards into purpose-built confidence/completion/focus-path visuals without introducing score-like candidate evaluation |
| 124 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage recommendation rules | Upcoming rules pass should replace static dashboard path/focus shells with logic grounded in unfinished work, latest coach signal, confidence movement, resume/JD context, and completed-session history |
| 125 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Land dashboard progress metrics | Dashboard top stats now render through `DashboardProgressMetrics`, a purpose-built practice momentum region with completion and focus-path progress bars that avoid score-like labels |
| 126 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage dashboard interaction rules | Next dashboard pass should define whether focus chips filter history, launch targeted practice, open detail drawers, or combine those behaviors |
| 127 | Queued | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Stage practice advanced setup interaction | Next practice setup pass should decide which optional controls belong in the advanced setup sheet and how the default setup stays short |
| 128 | Active | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Land practice advanced setup disclosure | `/practice` now keeps Practice focus and Question count behind an Advanced setup trigger; closed-panel submissions preserve hidden defaults, and restored draft values appear when the advanced panel opens |
| 129 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage dashboard recommendation rules | Next dashboard pass should replace static path/focus copy with rules that prioritize unfinished sessions, latest coach signal, confidence movement, resume/JD context, and completed-session history |
| 130 | Active | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Replace practice focus select with option buttons | Practice focus and Question count now use stacked single-option button groups with a calmer selected state instead of native selects |
| 131 | Active | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Replace advanced setup sheet with accordion | Advanced setup now expands in-flow like an accordion instead of covering the page; Practice focus and Question count render as selected option-button groups, stack on mobile, sit side by side on larger screens, and keep selections while opened or closed |
| 132 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage dashboard recommendation rules implementation | Next dashboard pass should start converting the static dashboard path/focus shells into deterministic recommendation rules grounded in current session state and latest coach signals |
| 133 | Resolved | QSO-F04 | 775 | Fu Chen <fu@rangam.com> | Redraft candidate disclosure copy | Candidate disclosure/consent copy now uses resume content language, separates setup consent from footer disclosure, states security/access-control posture, and removes redundant dashboard/hiring-decision copy across public, setup, session-entry, voice, and summary surfaces |
| 134 | Active | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Calm selected advanced setup options | Advanced setup option selected states now reuse the softer hover color treatment instead of the aggressive filled-primary style |
| 135 | Active | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Unify session question category chips | Recruiter-invited and candidate-created sessions now share category presentation mapping so legacy `STAR` renders as Behavioral, `PERMA` renders as Culture Fit, and candidate `Behavioral`/`Culture`/`Technical` categories use the same chip and tooltip copy |
| 136 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage dashboard recommendation rules implementation | Next dashboard pass should start converting the static dashboard path/focus shells into deterministic recommendation rules grounded in current session state and latest coach signals |
| 137 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Land dashboard recommendation rules | Dashboard recommended path, resume-to-role preview, and focus chips now use deterministic first-pass rules that prioritize unfinished sessions, latest persisted coaching signals, completed-session fallback, and first-practice onboarding |
| 795 | Resolved | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Clarify practice focus selector effects | `/practice` now asks what interview moment the candidate is preparing for with plain-language stage options, persists `interviewStage`, and uses the deterministic `QuestionPlan` service to shape candidate question category ordering while keeping legacy `interviewType` as fallback |
| 139 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage resume-role bridge rules | Next dashboard pass should define how resume content, JD content, session answers, and coach signals become prepProfile evidence rows without overclaiming extraction accuracy |
| 140 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage focus chip interactions | Next dashboard pass should decide whether focus chips filter history, start targeted practice, open detail drawers, or combine those behaviors |
| 141 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Remove provisional dashboard header copy | Dashboard no longer shows the Back to overview link, provisional welcome title/body, or internal planning copy in Practice Momentum while the top-of-page IA is being reconsidered |
| 142 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Create interview preparedness data inventory | Added a durable working inventory that maps current persisted objects, runtime objects, derived concepts, possible data-driven UI, reuse checks, and likely new interview-preparedness objects without introducing numeric scoring |
| 143 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Decide prepProfile boundary | Next dashboard architecture pass should decide how `candidate_role_preparation_profiles` supports the `prepProfile` domain concept and which existing drafts, sessions, summaries, confidence measurements, and coach signals attach to it |
| 144 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Add interview preparedness architecture visuals | Interview preparedness inventory now embeds the revised dark-theme SVG diagram renderings and keeps the editable Mermaid source in adjacent `.mmd` files so the markdown page no longer renders live Mermaid preview blocks |
| 145 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Harden interview-preparedness reuse and object decisions | Interview preparedness inventory now classifies desired capabilities by reuse path, safe claim, unsupported claim, implementation category, and new-object trigger; likely new objects are split into persist-soon, derived-first, future-only, and probably-unnecessary groups |
| 146 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage prepProfile migration contract | Interview preparedness inventory now defines the `candidate_role_preparation_profiles` table contract, draft/session attachment rules, older-row fallback behavior, and the decision to land confidence measurements in a later slice |
| 147 | Active | DRFT-F04 | 772 | Fu Chen <fu@rangam.com> | Require job description in candidate practice setup | `/practice` now requires job description at the schema, form, and action boundary so candidate-led practice stays anchored to a specific role context; maintained docs now treat JD as required and resume as optional |
| 148 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage prepProfile implementation slice | Added the prep-profile migration, draft `role_profile_id` link, profile create-or-resolve repository boundary, and session intake carry-through; focused tests, candidate suite, typecheck, lint, and role-profile schema smoke passed |
| 149 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Wire dashboard to prepProfile scaffold | Dashboard reads now load `roleProfileId` where available, preserve older-row fallback, and expose one safe profile-backed affordance before confidence, evidence drilldowns, or milestone objects expand |
| 150 | Queued | QSO-S11 | 784 | Fu Chen <fu@rangam.com> | Vet runtime PII scrubbing approach | Evaluate current sanitizer, OpenAI privacy-filter, and alternative runtime redaction layers before AI provider calls and AI-quality or observability persistence |
| 151 | Superseded | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage standalone resume/JD bridge rules | Superseded by the prepProfile evidence-state direction: resume/JD context now feeds preparedness signal evidence refs and wording instead of becoming its own dashboard lane |
| 152 | Resolved | SESS-F04 | 773 | Fu Chen <fu@rangam.com> | Fix candidate session category server boundary | Category presentation mapping now lives in a server-safe module so resumed candidate sessions can render category chips without importing a client component into the server route |
| 153 | Queued | QSO-S12 | 785 | Fu Chen <fu@rangam.com> | Tighten question-scoped AI generation capture contract | Add explicit question source refs to hint and strong-response AI captures, then keep query fallback for older rows |
| 154 | Resolved | SESS-S13 | 786 | Fu Chen <fu@rangam.com> | Pass candidate resume context to live coaching calls | Candidate active-question workspace now receives session resume context and passes it to shared Hints and Example/strong-response hooks; browser validation confirmed candidate-created hints and strong responses now use resume context |
| 155 | Queued | QSO-S13 | 787 | Fu Chen <fu@rangam.com> | Harden AI-quality review surface for sensitive data | Scope and implement masked/redacted `/qa/ai-quality` list, detail, and export behavior for candidate/recruiter AI records |
| 156 | Queued | SESS-S14 | 788 | Fu Chen <fu@rangam.com> | Stage candidate session transition loaders | Add initial multistep loader copy for `/practice` to session landing and session landing to active question; preparedness/coaching content can replace the initial copy later |
| 157 | Queued | SESS-S15 | 789 | Fu Chen <fu@rangam.com> | Stage Entering Interview Room transition | Add the candidate-owned version of the invite-style Entering Interview Room transition before the first active question |
| 158 | Queued | DASH-S07 | 792 | Fu Chen <fu@rangam.com> | Stage confidence measurement capture | Capture pre-session and post-session confidence as preparedness measurements, distinct from helpfulness/user-feedback buttons |
| 159 | Queued | SESS-S16 | 790 | Fu Chen <fu@rangam.com> | Stage immediate finish-session redirect parity | Align candidate final-question Finish Session behavior to recruiter flow so `/summary` renders immediately and owns debrief loading |
| 160 | Queued | SESS-S17 | 791 | Fu Chen <fu@rangam.com> | Stage dashboard navigation from session | Add an accessible path from active candidate sessions back to `/dashboard` without cluttering answer controls |
| 161 | Queued | SESS-S18 | 793 | Fu Chen <fu@rangam.com> | Stage completed-session URL handling | Completed candidate session URLs should route to summary when candidate-owned and summary-capable, while wrong-owner or missing sessions use a friendly candidate-safe not-found state |
| 162 | Superseded | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Resume interview-preparedness dashboard modeling | Superseded by the real prepProfile evidence-state pass, which folds JD, resume context, submitted answers, and coach signals into explainable preparedness signal refs before adding more visual claims |
| 163 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Refine interview-preparedness inventory direction | Inventory and dashboard/practice spec now use `prepProfile` as the domain name, align interview preparedness lanes to existing question generation, hints, strong response, answer feedback, and summary prompts, and regenerate source diagrams from Mermaid |
| 164 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Define first prepProfile data components | Interview preparedness inventory now defines the first derived-first data components for dashboard V2: `PrepProfile`, `InterviewContext`, `PrepSignal`, `PrepEvidenceRef`, `PrepObservation`, `PrepRecommendation`, and `ConfidenceMeasurement`, grounded in existing question generation, feedback, hints/examples, summary, and candidate profile persistence |
| 165 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Define first prepProfile signal derivation rules | Interview preparedness inventory now defines derived-first signal seed sources, pulse mappings, `FeedbackPlan` mappings, evidence-state rules, recommendation priority, and implementation guardrails before adding new dashboard visuals |
| 166 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Scope prepProfile read-model service | Added a pure, tested `prepProfile` read-model service that derives `PrepSignal`, `PrepObservation`, and `PrepRecommendation` from current target interview context, questions, answer analyses, resume-context state, summary text, and active-session state without querying Postgres or adding persistence |
| 167 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Wire dashboard loader to prepProfile read model | Dashboard loader now maps current draft, profile, session, question, answer, and feedback rows into the tested `prepProfile` read-model service and exposes safe derived signal counts, primary signal, and recommendation metadata without requiring historical data migration |
| 168 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Design first prepProfile scaffold UI mapping | Practice Momentum now shows the first visible `prepProfile` scaffold as an Interview Preparedness signal rail with evidence counts, current primary signal, qualitative state, and non-score progress semantics |
| 169 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Scope prepProfile scaffold microinteractions | Added a mobile-first Figma concept brief for the Preparedness Map, Prep Path, and Evidence Drilldown model, including target frames, data mapping, copy direction, and prototype interactions |
| 170 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Review dashboard Figma concept direction | Selected the Preparedness Map plus Practice Next plus Evidence Drilldown model as the dashboard V2 direction and identified copy, token, action, evidence, and empty-state deltas before implementation |
| 171 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Replace dashboard with Preparedness Map concept | Dashboard now uses the mockup-derived Preparedness Map, Practice Next, Recent Activity, empty preview, and skill drilldown surfaces mapped to candidate semantic tokens and primary-blue app-shaped action buttons; drilldowns close on clickaway/tapaway, lane status is presented as the micro-label above the category, and the provisional Target interview subtitle is removed |
| 172 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage real preparedness evidence states | Dashboard Preparedness Map now consumes `prepProfile` read-model signals directly, removes the legacy standalone resume/JD lane, folds resume/JD context into signal evidence refs, preserves weak and strong `feedbackPlan` refs, and exposes read-model signals through the dashboard loader |
| 173 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage dashboard interaction validation | Browser validation should inspect mobile and desktop dashboard states, drilldown open/close behavior, keyboard focus, and visual spacing against the Figma-derived concept before deeper data-model expansion |
| 174 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Define lane progression rules | PrepProfile read model now rolls each Preparedness Map lane from qualitative evidence counts instead of strongest-observation wins: mixed weak/strong evidence lands as clear, unresolved growth evidence remains recommendation-eligible, and docs define the lane progression rules |
| 175 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage lane fill and modal evidence binding | Preparedness Map lanes now use prepProfile `evidenceCounts` for a quiet non-score fill cue, and drilldowns use `sourceRefs` for evidence/context copy while removing the premature targeted-practice CTA |
| 176 | Queued | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stage completed-session dashboard route recovery | Next dashboard flow pass should route completed session links to summary or a friendly candidate-safe not-found state instead of reopening stale completed session screens |
| 177 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Define preparedness signal contract | Added the durable Interview Preparedness Signal Contract with immutable lanes, signal taxonomy, source mappings, qualitative state rules, evidence refs, and progression/regression rules that immediately honor latest clear/strong evidence while preserving weak evidence history |
| 178 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Align prepProfile read model to signal contract | PrepProfile read model now emits immutable contract lane ids, maps structural clarity to Interview Structure, keeps resume/JD context as evidence instead of a lane, and tests latest clear/strong evidence promotion plus repeated weak evidence regression behavior |
| 179 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Map feedbackPlan anchors into preparedness signals | PrepProfile read model now derives low-level signals from `feedbackPlan.primaryAnchor` when no pulse already covers that dimension, so anchor-only answer analysis can feed Answer Substance, Interview Structure, and Communication Delivery with source evidence refs |
| 180 | Resolved | FND-F01 | 640 | Fu Chen <fu@rangam.com> | Consolidate active docs into lightweight context stack | Added `SPEC.md`, `DATA_CONTRACT.md`, `HANDOFF.md`, and ADR-0007 as the active candidate-app context stack while preserving older detailed docs as reference before a release milestone |
| 181 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Scope dashboard to selected target interview | Dashboard loader now chooses one current target interview context, scopes stats/Practice Next/recent sessions away from unrelated roles, and replaces candidate-facing "one focused upgrade" dashboard copy with "biggest lift" language while leaving the stricter multi-profile switcher for a later pass |
| 182 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Add target interview switcher | Dashboard now exposes a first-pass target interview switcher for candidates with multiple role contexts; `?targetRole=` drives the selected context, and the read model filters stats, Practice Next, Preparedness Map evidence, and recent activity to the selected target interview |
| 183 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Capture platform launch prepProfile migration reference | Added the architecture reference for production host-launched `/practice`, platform job/req keyed prepProfile identity, candidate/job/resume/consent launch context, dashboard selector implications, and future schema migration phases |
| 184 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Render fixed preparedness lane scaffold | Dashboard Preparedness Map now renders the five immutable interview-preparedness lanes first and rolls existing `prepProfile` signal evidence into each lane's state, fill cue, and drilldown content instead of exposing raw low-level signals as the visible lane list |
| 185 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Aggregate selected-role dashboard evidence | Dashboard Preparedness Map now rolls up evidence across all scoped selected-target-interview items so older completed sessions can still contribute lane evidence; added the Preparedness Signal Map reference for low-level signal, evidence, lane rollup, and modal tracing |
| 186 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Pivot dashboard contract to score-driven lanes and category cards | Screening Basics question generation now explicitly prioritizes Culture Fit plus screening-only Interest/Background/Availability questions, Signposting is documented under Structure only, and the release dashboard direction now uses score-driven Substance/Structure/Delivery lanes plus Behavioral, Culture/Fit, Technical/Role-Specific, Case/Scenario, and Screening category cards |
| 187 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Land score-driven dashboard read model | PrepProfile read model now switches to hidden numeric score averages when score payloads are present, renders only Answer Substance, Interview Structure, and Communication Delivery as Preparedness Map lanes, and exposes separate question coverage cards for Behavioral, Culture/Fit, Technical/Role-Specific, Case/Scenario, and Screening |
| 188 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Refactor dashboard drilldowns to Q/A evidence cards | Lane drilldowns now replace raw A/B eval preview rows with practiced question and answer transcript/mode cards, tapping a card opens candidate-safe coach-read copy, and question coverage cards use the same modal/card/detail interaction model with category-scoped feedback copy |
| 189 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Polish dashboard drilldown scanability and guidance copy | Lane and category drilldown Q/A cards now cap long transcripts with Show more/less, carry answer submitted timestamps as Practiced, remove redundant guidance labels and lane helper sections, and keep candidate-safe detail copy framed as My Read |
| 190 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Group dashboard drilldown Q/A cards by session | Lane and category drilldowns now group practiced Q/A cards by session, sort sessions newest-first, open the newest session by default, sort answers within each session by submitted time, and use voice/text-specific answer badges |
| 191 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Tighten dashboard category coverage state and ordering | Question coverage cards now recompute merged state from weighted average category scores instead of preserving the strongest historical state, and categories sort by practice need before canonical category order so lower-evidence categories surface first |
| 192 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Migrate biggest-lift coaching signal to coachSignal | Answer feedback now requests and normalizes `coachSignal`, session feedback labels it as "For the biggest lift", dashboard and prepProfile read paths prefer `coachSignal`, and legacy `oneBigUpgrade` remains only as persisted older-row fallback |
| 193 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Polish dashboard empty state | Empty dashboard now uses friendly create-practice copy, muted Preparedness Map preview lanes, muted question coverage preview cards, and a Practice Next-style create-practice surface so the blank state has parity with the populated dashboard |
| 194 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Clarify question coverage practiced/upcoming status | Question coverage cards now distinguish generated category questions as Practiced or Upcoming, preserve card state/color from practiced scored answers only, and keep unanswered questions as coverage context instead of zero-score evidence |
| 195 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Fix dashboard answer modality display | Answer modality now persists through Postgres answer upserts/reads and dashboard evidence falls back to answer-analysis metadata for older rows so voice submissions render as voice-response badges instead of text defaults |
| 196 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Format dashboard My Read coach guidance | My Read detail modals now preserve full coach-read content and format recognized sections into Overall Read, What Stood Out, For the Biggest Lift, and Next Step while removing internal "Coach signals" language from candidate-facing output |
| 197 | Active | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Stabilize dashboard modal width | Lane, category, and nested My Read modals now share the same viewport-constrained width rule across screen sizes to avoid breakpoint-driven width jumps and inconsistent wrapping |
| 794 | Resolved | DASH-F03 | 774 | Fu Chen <fu@rangam.com> | Harden canonical answer modality persistence | Voice modality now carries through candidate server-action submission, shared submit route tests, audio-analysis reconciliation, and migration 005 backfill so `answers.modality` is the canonical source for voice submissions; dashboard `analysis.meta.modality` fallback is compatibility-only |
| 796 | Active | SESS-F05 | 777 | Fu Chen <fu@rangam.com> | Add recruiter interview-detail planning controls | Recruiter `/recruiter/create` now exposes interview stage and question count before question entry, replaces the extra Add Questions step with the AI/manual button group, uses recruiter-specific stage labels, passes stage/count to the shared question-generation boundary, and shows a category distribution confirmation before revealing manual/generated question fields while preserving recruiter-invited feedback behavior |

## Open Questions

| ID | Status | Question | Decision Needed By |
| --- | --- | --- | --- |
| Q-01 | Answered | Use seeded `dev` mode for default local browser review, with password-backed local dev auth and explicit mock candidate mode available for targeted scenarios. | Apply during AUTH-S03 |
| Q-02 | Answered | Multiple active/named drafts are a legitimate use case. | Apply during DRFT-S03 and DRFT-S07 |
| Q-03 | Direction Set | Do not retain original uploaded resume files after normalization/redaction by default; persist processed resume artifact instead. | Revisit before RES-S03 |
| Q-04 | Answered | `interviewcoach.talentarbor.com` is the shared host; `/` is public page, `/recruiter` is recruiter create, candidate routes are top-level siblings. | Apply during WEB-S03, OPS-T05, and OPS-T06 |
| Q-05 | Open | Does `LoginWithType/2` preserve return URL/callback/state through TalentArbor login? | Before AUTH-S08/AUTH-S09 |
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
