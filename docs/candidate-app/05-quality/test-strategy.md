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

`e2e/candidate/primary-routes.spec.ts` covers the shared-host route contract for `/`, `/recruiter`, candidate protected routes, and admin/QA protection.

Full DB-backed browser smoke for candidate setup-to-summary still requires a seeded candidate profile/session environment.

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
- candidate PRs reviewed against [Recruiter Regression Checklist For Candidate PRs](recruiter-regression-checklist.md)

## CI Gate Direction

PR gate should eventually run:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test:coverage`
- `npm run build`
- browser smoke tests
- dependency audit or security scan
- migration validation once database migrations exist
- recruiter regression smoke when candidate work touches shared routes, middleware, global CSS, public assets, or session/invite APIs

## Azure Traceability

Tests should link back to Azure Boards work items where practical.

Azure Pipelines supports requirements traceability by associating requirements with tests, bugs, and code changes. This app should use that once the Azure project is staged.

Reference: https://learn.microsoft.com/en-us/azure/devops/pipelines/test/requirements-traceability
