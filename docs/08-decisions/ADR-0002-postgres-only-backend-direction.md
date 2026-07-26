# ADR-0002: Postgres-Only Backend Direction

Date: 2026-05-07
Status: Accepted

## Context

The recruiter app was migrated away from Supabase to a standard Postgres backend. The candidate app is starting from a light scaffold and should not introduce Supabase dependencies only to remove them later.

## Decision

Implement candidate app persistence directly against Postgres.

Runtime code should not introduce:

- `@supabase/*`
- `NEXT_PUBLIC_SUPABASE_*`
- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase Storage assumptions
- RLS-dependent application behavior

## Consequences

- Backend implementation should adapt patterns from [C:\tmp\Interview-Coach-Recruiter-postgres](/c:/tmp/Interview-Coach-Recruiter-postgres).
- Environment configuration should prefer `DATABASE_URL` while supporting `POSTGRES_*` fallback values.
- Candidate ownership checks must be explicit in server-side code and tests.

