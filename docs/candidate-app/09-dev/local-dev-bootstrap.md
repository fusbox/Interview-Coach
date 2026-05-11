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
- `npm run lint`
- `npm run typecheck`
- `npm run test:coverage`
- `npm run build`
- `npm run postgres:smoke:start`
- `npm run db:apply-schema`
- `npm run db:apply-candidate-schema`
- `npm run db:smoke-candidate-schema`

Current development server:

- `http://localhost:3001`

## Target Bootstrap Flow

The eventual local bootstrap should support:

```powershell
npm install
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

The commands can be added incrementally as backend work lands.

Current candidate schema smoke flow:

```powershell
npm run postgres:smoke:start
npm run db:apply-schema
npm run db:apply-candidate-schema
npm run db:smoke-candidate-schema
```

This applies the recruiter Postgres baseline, applies the candidate identity/profile migration, and validates candidate profile plus provider identity constraints inside a rollback-only smoke script.

## Environment Setup

Copy [.env.example](../../.env.example) to `.env.local` and fill only the values needed for the current slice.

Early development can use:

- `DEV_AUTH_MODE=mock`
- `RATE_LIMIT_BACKEND=memory`
- `METRICS_BACKEND=memory`
- local or smoke Postgres once the database layer exists

Production-like development should use:

- `DEV_AUTH_MODE=password`
- `DATABASE_URL`
- `APP_AUTH_BACKEND=postgres`
- `PRACTICE_DRAFT_BACKEND=postgres`

## Bootstrap Acceptance Criteria

- a new developer can install dependencies and start the app
- local env shape is documented
- database setup is scripted once migrations exist
- seed data creates at least one dev candidate profile
- local auth can exercise protected candidate routes
- quality scripts pass before implementation work is marked done

## Open Questions

- Should local Postgres run through Docker, native Postgres, Azure-hosted dev DB, or all three?
- Should seed data include multiple candidate profiles for ownership tests?
- Should mock auth be enabled by cookie, env, or a test-only route?
