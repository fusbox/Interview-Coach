# Local Dev Bootstrap

Status: Active cleanroom V2 bootstrap
Last updated: 2026-07-16

## Purpose

This is the current local setup path for the candidate V2 rebuild in this repo.

Older candidate docs and SQL helpers may still describe the V1 `/practice` -> `/session` -> `/summary` app. Treat those as reference material only. Current V2 work uses canonical `/candidate/*` routes, `candidate_practice_sessions` for durable rounds, and normalized answer-attempt/evaluator-run tables for immutable answer history.

## The Commands You Usually Need

### Fresh Local Smoke DB Setup

Use this when the local smoke Postgres container is new, reset, or missing current schema:

```powershell
npm run postgres:smoke:start
npm run db:migrate
npm run db:seed-candidate-dev
npm run db:smoke-candidate-readiness
```

Shortcut:

```powershell
npm run db:setup
npm run db:smoke-candidate-readiness
```

`db:setup` starts the smoke container, applies all current migrations, and seeds deterministic local candidate identities. `db:smoke-candidate-readiness` reruns the current candidate schema and fixture checks.

### After This Branch Changes Practice Persistence Migrations

Use this when you already have the smoke DB running and only need the latest V2 practice-session, practice-intent, or answer-history shape:

```powershell
npm run db:apply-candidate-practice-sessions-schema
npm run db:smoke-candidate-practice-sessions-schema
npm run db:apply-candidate-practice-intents-schema
npm run db:smoke-candidate-practice-intents-schema
npm run db:apply-candidate-answer-attempts-schema
npm run db:smoke-candidate-answer-attempts-schema
npm run db:apply-candidate-prep-context-propagation-schema
npm run db:smoke-candidate-prep-context-propagation-schema
npm run db:apply-candidate-coach-update-artifacts-schema
npm run db:smoke-candidate-coach-update-artifacts-schema
npm run db:apply-candidate-practice-session-status-backfill
npm run db:apply-candidate-next-round-drafts-schema
npm run db:smoke-candidate-next-round-drafts-schema
npm run db:apply-candidate-prep-context-practice-paths-schema
npm run db:smoke-candidate-prep-context-practice-paths-schema
```

`candidate_practice_sessions` remains the durable session boundary, `candidate_practice_intents` is the durable ready-round boundary for one-question or multi-question follow-up selections, `candidate_answer_attempts` plus `candidate_answer_evaluation_runs` preserve immutable submission and evaluator lineage, migration 010 propagates candidate-owned prep-context identity into intents and canonical dashboard/follow-up reads, migration 011 stores only versioned candidate-safe Coach Update artifacts over those source facts, and migration 012 idempotently repairs answered sessions that historical writes left in `planned` status.

### Full Candidate Quality Check

Use this before packaging candidate V2 work:

```powershell
npm run test:candidate
```

When you also need database readiness:

```powershell
npm run db:smoke-candidate-readiness
```

The heavier combined path is:

```powershell
npm run ci:candidate:with-db
```

That runs lint, typecheck, candidate tests, build, DB readiness, and the seeded browser smoke.

## Current DB Script Map

Current candidate V2 local development depends on these scripts:

| Need | Command |
| --- | --- |
| Start disposable local Postgres | `npm run postgres:smoke:start` |
| Apply all current migrations | `npm run db:migrate` |
| Apply only host-launch schema | `npm run db:apply-candidate-host-launch-schema` |
| Apply only V2 practice-session schema | `npm run db:apply-candidate-practice-sessions-schema` |
| Apply only V2 practice-intent schema | `npm run db:apply-candidate-practice-intents-schema` |
| Apply only V2 answer-attempt/evaluator-run schema | `npm run db:apply-candidate-answer-attempts-schema` |
| Apply only V2 prep-context propagation schema | `npm run db:apply-candidate-prep-context-propagation-schema` |
| Apply only V2 Coach Update artifact schema | `npm run db:apply-candidate-coach-update-artifacts-schema` |
| Repair historical answered sessions left `planned` | `npm run db:apply-candidate-practice-session-status-backfill` |
| Apply durable next-round draft schema | `npm run db:apply-candidate-next-round-drafts-schema` |
| Apply intentional same-role/JD practice-path schema | `npm run db:apply-candidate-prep-context-practice-paths-schema` |
| Seed local primary/alternate candidates | `npm run db:seed-candidate-dev` |
| Validate host-launch schema | `npm run db:smoke-candidate-host-launch-schema` |
| Validate V2 practice-session schema | `npm run db:smoke-candidate-practice-sessions-schema` |
| Validate V2 practice-intent schema | `npm run db:smoke-candidate-practice-intents-schema` |
| Validate V2 answer-attempt/evaluator-run schema | `npm run db:smoke-candidate-answer-attempts-schema` |
| Validate V2 prep-context propagation and ownership | `npm run db:smoke-candidate-prep-context-propagation-schema` |
| Validate V2 Coach Update artifact lifecycle and ownership | `npm run db:smoke-candidate-coach-update-artifacts-schema` |
| Validate durable next-round draft launch | `npm run db:smoke-candidate-next-round-drafts-schema` |
| Validate intentional same-role/JD practice paths | `npm run db:smoke-candidate-prep-context-practice-paths-schema` |
| Validate local candidate fixtures | `npm run db:smoke-candidate-dev-seed` |
| Run current candidate DB readiness chain | `npm run db:smoke-candidate-readiness` |

The V1-style `postgres:smoke:*` product scripts still exist because the repo also contains recruiter and mature shared-session surfaces. Do not use them as the default validation path for the cleanroom candidate V2 rebuild unless a slice explicitly says to compare or validate against V1 behavior.

## Local Dev Host Launch

The current preferred browser path is host-launch-shaped, even in local development.

Add these to `.env.local`:

```text
CANDIDATE_HOST_LAUNCH_DEV_MODE=true
CANDIDATE_HOST_LAUNCH_DEV_SECRET=local-only-shared-secret
```

To browser-validate the current submit -> analysis -> read-only coaching surface without production provider credentials, also add:

```text
CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fixture
```

The fixture provider is accepted only with explicit local dev host-launch mode. If the variable is missing, answer analysis remains fail-closed with provider-not-configured behavior.

Coach Update synthesis also uses its typed deterministic fixture in this explicit local mode. To exercise its production-shaped failure boundary without live credentials, temporarily add:

```text
CANDIDATE_COACH_UPDATE_PROVIDER=fault
CANDIDATE_COACH_UPDATE_FAULT_MODE=provider_5xx
```

Allowlisted fault modes are `timeout`, `rate_limited`, `provider_5xx`, `provider_unavailable`, `misconfigured`, `invalid_json`, `invalid_schema`, `fingerprint_mismatch`, `question_mapping_mismatch`, `unsafe_candidate_language`, and `success`. The controls are read only from server environment, are never accepted through a URL or request payload, and are disabled when `NODE_ENV=production`. A fault must not block round completion or dashboard return; it should create a classified terminal artifact attempt and leave the dashboard in its existing truthful unavailable state. Remove both Coach Update variables to return to the fixture inherited from `CANDIDATE_ANSWER_ANALYSIS_PROVIDER=fixture`.

Then start the app:

```powershell
npm run dev
```

Open the dev launch route:

```text
http://localhost:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
```

Alternate candidate:

```text
http://localhost:3000/candidate/dev/launch?candidate=alternate&next=/candidate/setup
```

Mobile LAN testing uses the same path with your workstation IP:

```text
http://<workstation-lan-ip>:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
```

If Next logs a blocked cross-origin warning for `/_next/*`, add the workstation origin to `allowedDevOrigins` in `next.config` only if the page fails to load or hot reload becomes unusable.

## Dev Server Options

Use `npm run dev` for the current host-launch-shaped flow.

`npm run dev:candidate` still exists as a convenience wrapper. It sets `DATABASE_URL` to the smoke DB and defaults older candidate auth env values, but it is not the primary V2 launch path because it does not exercise the host redirect shape by itself.

## Seeded Local Candidates

The deterministic local candidates are:

| Candidate | Email | Host-launch shortcut |
| --- | --- | --- |
| Primary | `candidate-dev-primary@talentarbor.local` | `candidate=primary` |
| Alternate | `candidate-dev-alt@talentarbor.local` | `candidate=alternate` |

The dev host launch maps deterministic host-style candidate ids to these seeded candidate profiles.

## Troubleshooting

### Setup Submit Returns `503`

Most likely causes:

- smoke DB is not running;
- `.env.local` has `DATABASE_URL` but migrations have not been applied;
- deterministic candidate fixtures are missing;
- a practice persistence migration changed but the local tables were not updated.

Run:

```powershell
npm run postgres:smoke:start
npm run db:migrate
npm run db:seed-candidate-dev
npm run db:smoke-candidate-readiness
```

For a known practice persistence migration delta, the narrower check is:

```powershell
npm run db:apply-candidate-practice-sessions-schema
npm run db:smoke-candidate-practice-sessions-schema
npm run db:apply-candidate-practice-intents-schema
npm run db:smoke-candidate-practice-intents-schema
npm run db:apply-candidate-answer-attempts-schema
npm run db:smoke-candidate-answer-attempts-schema
npm run db:apply-candidate-prep-context-propagation-schema
npm run db:smoke-candidate-prep-context-propagation-schema
npm run db:apply-candidate-coach-update-artifacts-schema
npm run db:smoke-candidate-coach-update-artifacts-schema
npm run db:apply-candidate-practice-session-status-backfill
npm run db:apply-candidate-next-round-drafts-schema
npm run db:smoke-candidate-next-round-drafts-schema
npm run db:apply-candidate-prep-context-practice-paths-schema
npm run db:smoke-candidate-prep-context-practice-paths-schema
```

### Browser Opens The Session But Data Does Not Recover

Check that you entered through `/candidate/dev/launch` and that the `ic_candidate_launch_session` cookie exists. Directly opening `/candidate/setup` can still render the UI, but durable candidate-owned recovery depends on the launch-session identity boundary.

### PowerShell Shows `Terminate batch job (Y/N)?`

That prompt appears when the dev server was started through `cmd /c`, including nested npm scripts. It is normal on Windows. Press `Y` to stop the batch process.

## Reference Archive

Historical V1/interim docs and the old all-in-one local SQL query live under:

- [Reference Archive](../reference-archive/README.md)
- [V1 master query](../reference-archive/sql/master_query.v1.sql)

Use those files when comparing against V1 behavior. Do not treat them as current bootstrap instructions.

## Acceptance Checklist

For current V2 local development:

- smoke Postgres is running;
- `db:migrate` has applied through `014_candidate_prep_context_practice_paths_schema.sql`;
- local candidate dev seed is present;
- `db:smoke-candidate-readiness` passes;
- the app is launched with `npm run dev`;
- browser entry starts at `/candidate/dev/launch?...next=/candidate/setup`;
- candidate route recovery works through the launch-session cookie.
