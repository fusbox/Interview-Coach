# Database Access Hardening

Status: Ratified staging baseline; Supabase cutover pending
Last updated: 2026-07-29

## Purpose

This runbook hardens the PostgreSQL execution boundary for the solo-developer Supabase staging deployment while preserving a path to the company release. Interview Coach uses trusted Next.js server processes, direct PostgreSQL connections, app-owned sessions, and ownership-scoped repositories. It does not use Supabase Auth, `supabase-js`, REST, GraphQL, or browser database access.

RLS therefore serves as defense in depth around the database service role. It does not replace candidate/recruiter ownership checks and does not use `auth.uid()`.

## Staging Contract

- Schema migrations run with an operator-only owner connection in `DATABASE_MIGRATION_URL`.
- Vercel and current operator processes connect only as `interview_coach_runtime` through `DATABASE_URL`.
- `interview_coach_runtime` cannot create databases, schemas, roles, or public-schema objects; cannot bypass RLS; and is not an object owner.
- Every current public application table has RLS enabled and one explicit all-row policy scoped only to `interview_coach_runtime`.
- PostgreSQL `PUBLIC` plus Supabase `anon`, `authenticated`, `service_role`, and `authenticator` receive no public-schema table, sequence, or function access.
- Direct function execution is an allowlist derived from current server/worker/maintenance callers. Trigger and constraint functions are not directly executable by the runtime role.
- Every `SECURITY DEFINER` function has a fixed `pg_catalog, public, pg_temp` search path and is not executable by `PUBLIC`.
- Future tables are private by default but still require explicit RLS. Future direct function calls require an explicit runtime grant. The hardening smoke fails if either step is omitted.
- The Supabase Data API is disabled. No application feature depends on it.

This role can currently perform ordinary application DML across all application tables. That is intentionally a staging-sized least-privilege boundary, not the final service decomposition.

## Apply To Supabase Staging

Do not put `DATABASE_MIGRATION_URL` or `DATABASE_RUNTIME_PASSWORD` in Vercel.

1. Take a current Supabase backup or confirm the staging restore point.
2. Set the owner/admin connection only in the operator shell:

```powershell
$env:DATABASE_MIGRATION_URL = "<Supabase owner connection URI>"
```

3. Apply all migrations and verify the catalog contract:

```powershell
npm run db:migrate
npm run db:smoke-database-access-hardening
```

4. Generate a unique password of at least 24 characters, expose it only to the one provisioning process, and provision/rotate the role:

```powershell
$env:DATABASE_RUNTIME_PASSWORD = "<password-manager-generated value>"
npm run db:provision-runtime-role
Remove-Item Env:DATABASE_RUNTIME_PASSWORD
```

The provisioner verifies the new login without printing the password or connection URI. With the Supavisor shared pooler, the application username is `interview_coach_runtime.<project-ref>`; direct connections use `interview_coach_runtime`.

5. Build the runtime URI with that user and password. For Vercel/serverless traffic, Supavisor transaction mode on port `6543` is the default target; session mode on `5432` remains acceptable when a persistent-session constraint is proven. Keep TLS enabled.
6. Replace Vercel `DATABASE_URL` with the runtime URI. Never deploy the owner URI.
7. Pull the Vercel environment snapshot and run:

```powershell
npm run env:check:vercel
```

The check rejects a remote URL whose database user is not `interview_coach_runtime` (with an optional Supavisor project suffix).
8. In the Supabase Dashboard, open the Data API integration settings and turn **Enable Data API** off. This is an operational project setting, not a SQL migration.
9. Redeploy and run the candidate-account, candidate practice, invited practice, recruiter, and QA operator smokes applicable to the deployment.
10. Clear `DATABASE_MIGRATION_URL` from the shell when operator work is complete.

## Rollback

If the runtime cutover breaks an application path:

1. Do not re-enable browser/Data API access.
2. Record the failing route family and database error code without logging credentials or product content.
3. Use the operator connection to inspect the missing table/function grant.
4. Add a reviewed forward migration and extend `032_database_access_hardening_smoke.sql`.
5. Re-run the local disposable database and staging smoke before redeploying.

Temporarily restoring the owner URI to the web application is an emergency rollback only. Treat it as a high-severity privileged-credential exposure window, rotate afterward, and record the exception.

## Company Release Hardening

Before company production, revisit:

- separate web, AI-eval worker, and maintenance roles with table/function grants narrowed to each process;
- a dedicated migration owner and pipeline that is never available to application runtime;
- whether company database policy requires request identity propagated with transaction-local settings and ownership-aware RLS in addition to server authorization;
- network allowlists/private connectivity, credential rotation, query/audit monitoring by role, backup/PITR ownership, and tested restore;
- CA-backed `verify-full` TLS rather than encryption without server identity verification;
- moving privileged helper functions to an unexposed internal schema before any Data API is enabled;
- an explicit decision that the Data API stays disabled. If enabled later, it requires a new API schema, object grants, policy review, and release threat model.

The staging policy that allows the runtime role to reach all application rows must not be described as user-level database isolation.

## Verification

```powershell
npm run test:deployment-env
cmd /c npx vitest run db/migrations/046_database_access_hardening.test.ts
npm run db:smoke-database-access-hardening
npm run typecheck
npm run docs:check
```

References:

- [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: Securing your data](https://supabase.com/docs/guides/database/secure-data)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: PostgreSQL roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Supabase: Connecting to PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
