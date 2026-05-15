# Local Dev Bootstrap

Date: 2026-05-07
Status: Working bootstrap contract

## Purpose

This document defines the intended local developer setup path for the candidate app.

The goal is to make local development repeatable before the app has production infrastructure.

## Current Baseline

Current commands:

- `npm install`
- `npm run dev`
- `npm run dev:candidate`
- `npm run lint`
- `npm run typecheck`
- `npm run test:candidate`
- `npm run test:coverage`
- `npm run ci:candidate`
- `npm run build`
- `npm run postgres:smoke:start`
- `npm run db:setup`
- `npm run db:migrate`
- `npm run db:apply-schema`
- `npm run db:apply-candidate-schema`
- `npm run db:apply-candidate-drafts-schema`
- `npm run db:seed`
- `npm run db:seed-candidate-dev`
- `npm run db:smoke-candidate-readiness`
- `npm run db:smoke-candidate-schema`
- `npm run db:smoke-candidate-drafts-schema`
- `npm run db:smoke-candidate-dev-seed`
- `npm run db:smoke-candidate-setup-summary`
- `npm run test:e2e:candidate-seeded`
- `npm run ci:candidate:with-db`

Current development server:

- `http://localhost:3000`

## Target Bootstrap Flow

The current smoke-Postgres bootstrap supports:

```powershell
npm install
npm run db:setup
npm run dev:candidate
```

Use `npm run dev:candidate` when you want to browse candidate UI without routing through the external TalentArbor login. It starts the same Next dev server as `npm run dev`, but defaults local-only candidate auth to the seeded primary candidate.

`db:setup` starts the local smoke Postgres container, applies the shared recruiter schema plus candidate migrations, and seeds deterministic candidate fixtures.

If Docker or the smoke container is already managed separately, run the pieces explicitly:

```powershell
npm run db:migrate
npm run db:seed
```

Current candidate schema smoke flow:

```powershell
npm run postgres:smoke:start
npm run db:migrate
npm run db:seed-candidate-dev
npm run db:smoke-candidate-schema
npm run db:smoke-candidate-drafts-schema
npm run db:smoke-candidate-dev-seed
npm run db:smoke-candidate-setup-summary
```

This applies the recruiter Postgres baseline, applies the candidate identity/profile and practice draft migrations, seeds deterministic primary and alternate dev candidates, and validates candidate profile, provider identity, draft, session, setup-to-summary, saved-feedback, and ownership fixtures inside rollback-only smoke scripts.

The readiness shortcut is:

```powershell
npm run db:smoke-candidate-readiness
```

The full local candidate quality path is:

```powershell
npm run ci:candidate
npm run db:smoke-candidate-readiness
npm run test:e2e:candidate-seeded
```

`npm run ci:candidate:with-db` runs those checks as a single chain when the smoke Postgres container is available.

Seeded candidate identities:

- Primary: `candidate-dev-primary@talentarbor.local`
- Alternate ownership-check candidate: `candidate-dev-alt@talentarbor.local`

For the quickest local UI pass:

```text
CANDIDATE_AUTH_MODE=dev
```

`dev` mode resolves the primary seeded candidate automatically. It is intended for local browser DX and is rejected in production.

For primary password-mode local access:

```text
CANDIDATE_AUTH_MODE=password
CANDIDATE_DEV_EMAIL=candidate-dev-primary@talentarbor.local
CANDIDATE_DEV_ISSUER=interview-coach-local
CANDIDATE_DEV_SUBJECT=candidate-dev-primary@talentarbor.local
CANDIDATE_DEV_DISPLAY_NAME=Dev Candidate Primary
```

## Environment Setup

Copy [.env.example](../../.env.example) to `.env.local` and fill only the values needed for the current slice.

Early development can use:

- `CANDIDATE_AUTH_MODE=dev`
- `CANDIDATE_AUTH_MODE=mock`
- `RATE_LIMIT_BACKEND=memory`
- `METRICS_BACKEND=memory`
- local or smoke Postgres once the database layer exists

Production-like development should use:

- `CANDIDATE_AUTH_MODE=password`
- `DATABASE_URL`
- `APP_AUTH_BACKEND=postgres`
- `CANDIDATE_DATA_BACKEND=postgres`

## Bootstrap Acceptance Criteria

- a new developer can install dependencies and start the app
- local env shape is documented
- database setup, migration, seed, and readiness checks are scripted
- seed data creates primary and alternate dev candidate profiles for happy-path and ownership checks
- local auth can exercise protected candidate routes
- quality scripts pass before implementation work is marked done

## Open Questions

- Should local Postgres run through Docker, native Postgres, Azure-hosted dev DB, or all three?
- Should mock auth be enabled by cookie, env, or a test-only route?
