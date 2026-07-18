# Test Strategy

Date: 2026-05-07
Status: Working quality strategy

## Purpose

This document defines how the candidate app should build confidence as it moves from scaffold to persisted product.

## Quality Principle

Testing should scale with risk.

The app does not need heavy test machinery before behavior exists, but every persistent, authenticated, AI-assisted, or privacy-sensitive feature needs explicit verification.

## Current Baseline

Current CI scripts validate:

- lint
- typecheck
- coverage command
- production build

Candidate integration now has Vitest coverage for candidate route, auth, persistence, dashboard next-practice guidance, session answer coaching, summary, resume, and quality helper behavior.

`e2e/candidate/primary-routes.spec.ts` covers the shared-host route contract for `/`, `/recruiter`, `/recruiter/dashboard`, candidate protected routes, recruiter/admin/QA protection, and the authenticated recruiter dashboard compatibility path.

`npm run db:smoke-candidate-setup-summary` validates deterministic seeded candidate setup, in-session, completed-summary, and saved-feedback fixtures. `npm run test:e2e:candidate-seeded` then runs the DB-backed browser smoke in password-backed local candidate auth mode, using the primary seeded candidate to move from `/practice` into a generated session and summary. The seeded browser smoke also verifies invite-style session entry, read-question TTS state, voice-mode answer capture/submission through deterministic E2E audio, text-mode fallback submission, analysis, question progression, completion, and summary navigation. The browser smoke owns its temporary Next dev server process group in CI and should shut it down cleanly after Playwright finishes.

The candidate V2 production question-generation and follow-up-launch milestone uses `npm run test:candidate:question-follow-up-milestone` for its four focused contract families and `npm run db:smoke-candidate-question-follow-up-milestone` for migration/readiness plus rolled-back wording reconciliation. Its deterministic manual setup-to-dashboard, direct-intent consumed replay, intentional repractice, and conditional fixed-set cases are defined in [Question Generation And Follow-Up Launch Runbook](./question-generation-and-follow-up-launch-milestone-runbook.md).

The practice setup component/action tests cover the MVP setup contract: edited setup values are saved before generation, lightweight session configuration such as interview type and question count is submitted for generation, structured intake responses are submitted with the draft, and a new draft can be created when no editable draft was restored.

The shared question-generation service tests cover recruiter and candidate use of the same AI provider/schema/capture boundary. Candidate session creation tests verify that required role/job description context, optional resume text, interview type, question count, and role profile linkage flow into generated immutable session snapshots without reintroducing invite-token assumptions.

The candidate role-profile migration and repository tests cover the first role-preparedness persistence anchor: `candidate_role_preparation_profiles`, nullable draft `role_profile_id` attachment for older-row compatibility, create-or-resolve behavior by candidate/normalized role/JD hash, and the rollback-only `db:smoke-candidate-role-profiles-schema` validation.

Prep-context propagation tests cover candidate/profile ownership on durable practice intents, same-title profile isolation, stale or unauthorized selector fallback, precedence over bounded legacy title selection, mixed-context intent rejection, context-scoped follow-up attempts, and canonical dashboard/ready/session/completion navigation. Migration 010 backfills only intents whose full source-item set resolves to one candidate-owned profile; `db:smoke-candidate-prep-context-propagation-schema` validates the composite ownership constraint when the disposable DB is available.

Coach Update artifact tests must cover immutable/replayed completion, candidate and prep-context ownership, accepted evaluator-run eligibility, latest-attempt selection, skipped/unanswered exclusion, same-source-question comparison boundaries, stale input rejection after a generation claim, concurrent/replayed claims, terminal failure and repair, candidate-safe fixture validation, and dashboard refusal to fall back to legacy or partial Coach Update content. The local fixture path must persist the same accepted evaluator-run lineage the artifact consumes so browser validation exercises the production-shaped boundary without pretending the fixture is a production model.

The production Coach Update adapter gate must additionally prove exact provider/profile/key selection, key nonexposure, code-owned system instruction and untrusted data separation, absence of raw current/prior answers and identity from the provider request, provider-compatible structured output, code-owned status/fingerprint hydration, same-order question mapping, one bounded transport call, token/latency metadata only, timeout/rate-limit/4xx/5xx/safety/malformed-output classification, diagnostic-sink isolation, and no provider work for incomplete accepted-evaluator evidence. Fixture and fault modes must remain unavailable in production, and selected but incomplete Google configuration must degrade to unavailable synthesis rather than fail round completion.

Credentialed Coach Update validation follows the [Live Coach Update Validation Runbook](./live-coach-update-validation-runbook.md). Its dedicated command requires explicit CLI, flag, provider, profile, and key controls before transport assembly. The synthetic artifact is privacy-minimized and still requires human language review. A separate disposable-DB pass must prove exact-profile artifact metadata, immutable source lineage, replay without a second call, refreshed dashboard recovery, and durable completion when synthesis is ineligible or unavailable. Stale-source rejection remains a deterministic network-free race test because live validation must not mutate candidate evidence merely to manufacture a late-write race.

`npm run test:candidate:coach-update` is the focused Slice 104 gate. `ci:candidate` runs it after the broader candidate compatibility suite so newly added artifact tests do not depend on manually editing the historical long-form `test:candidate` file list.

`npm run test:candidate:next-round` is the focused Slice 105 gate. It covers draft normalization, ownership-scoped repositories, optimistic mutation conflicts, invalid order/source handling, queue-assembly lineage, idempotent ready/consumed recovery, stale-evidence rejection, and follow-up session snapshot propagation. `db:smoke-candidate-next-round-drafts-schema` runs the real PostgreSQL ownership constraints and atomic snapshot function inside a rollback-only transaction, including duplicate-launch replay and proof that an invalid launch leaves the mutable draft untouched.

Dashboard evidence regressions must cover interrupted rounds as well as completed rounds. A session with two submitted and analyzed questions but no completion must read as zero completed rounds, two answered questions, and two coached answers. A feedback retry creates immutable attempt lineage but must still count as one answered question occurrence in these widgets; only analysis matching the latest submission counts as current coaching evidence. Session and question attempt totals are separate future candidate/recruiter/BI dimensions.

The candidate session component tests cover the recruiter-style session workspace adapted for authenticated candidates: progress header, prompt shell, typed answer submission, saved-answer coaching, retry/continue controls, pause/resume/completed states, and hidden engagement debug inspector access with available AI prompt context.

The candidate dashboard component tests cover the MVP dashboard scan pattern: next practice step, active practice region, completed history region, coaching snippets, empty state, candidate-owned resume/review/repeat links, and the primary-page accessibility baseline.

## Test Layers

### Unit Tests

Use for:

- schema validation
- resume normalization
- state transition helpers
- auth utility functions
- repository row mapping
- prompt input shaping

### Integration Tests

Use for:

- Postgres repositories
- session draft lifecycle
- auth session storage
- candidate ownership checks
- resume asset persistence
- generated question snapshot persistence

### Route Tests

Use for:

- API request validation
- auth denial behavior
- error responses
- mutation success paths
- rate-limit boundaries, state-idempotency, and retry behavior

### Browser Tests

Use for:

- landing to practice setup
- authenticated route guard behavior
- create draft, generate, enter session
- refresh and resume from persisted state
- dashboard resume and review actions
- mobile shell navigation

### Visual Checks

Use screenshots for:

- app shell
- practice setup
- session workspace
- dashboard
- summary

Visual checks should verify layout, obvious overlap issues, and broken image references.

## Spec-Driven Acceptance

For user-facing flows, requirements should include Given/When/Then examples.

Example:

```gherkin
Given an authenticated candidate has a draft in generation_failed status
When they open /practice
Then they see the previous target role and resume context
And they can retry generation without creating an unrelated draft
```

These examples can become Playwright or integration tests when the feature is implemented.

## Coverage Expectations

### Database Milestone Gate

At every candidate migration milestone and before pilot/release, run the complete candidate readiness chain against both:

- a newly created empty disposable database, proving install order and self-contained smoke fixtures; and
- the current long-lived local or staging-shaped upgrade database, proving idempotent migration and compatibility with accumulated V2 development rows.

A pass on only the long-lived database is insufficient because pre-existing rows can accidentally satisfy a smoke assertion. Validation SQL must create any evidence it needs inside its own rollback-only transaction. Disposable databases must be named explicitly, verified before use, and removed after the audit.

Early scaffold:

- coverage command runs
- no minimum threshold

First persisted backend slice:

- unit tests for data mappers and validation
- integration tests for Postgres repositories
- route tests for protected mutations

Before production pilot:

- meaningful coverage threshold
- browser smoke suite
- negative permission tests
- accessibility checks for primary flows
- dependency audit reviewed
- every unresolved production dependency advisory has an owner, disposition, and release trigger; the Slices 125-133 milestone leaves the major-version `nodemailer` high advisory and Next-bundled PostCSS moderate advisory as explicit app-wide release gates
- candidate PRs reviewed against [Recruiter Regression Checklist For Candidate PRs](recruiter-regression-checklist.md)

## CI Gate Direction

PR gate should eventually run:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test:coverage`
- `npm run build`
- browser smoke tests
- `npm run db:smoke-candidate-setup-summary`
- `npm run test:e2e:candidate-seeded`
- dependency audit or security scan
- migration validation once database migrations exist
- `npm run db:smoke-candidate-role-profiles-schema` after candidate role-profile migration changes
- recruiter regression smoke when candidate work touches shared routes, middleware, global CSS, public assets, or session/invite APIs

## Azure Traceability

Tests should link back to Azure Boards work items where practical.

Azure Pipelines supports requirements traceability by associating requirements with tests, bugs, and code changes. This app should use that once the Azure project is staged.

Reference: https://learn.microsoft.com/en-us/azure/devops/pipelines/test/requirements-traceability
