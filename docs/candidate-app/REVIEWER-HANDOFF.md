# Candidate Integration Reviewer Handoff

Date: 2026-05-15
Status: Reviewer quick-start handoff

## Purpose

This is the short path for a reviewer or integration teammate who needs to get the candidate branch running, validate the current work, and understand what is safe to merge.

Use the deeper docs only when a specific route, auth, data, security, or product question comes up.

## Do This First

1. Clone or open the company Azure repo:

   ```powershell
   git clone https://dev.azure.com/RangamDevTeam/Interview_Coach_AI/_git/Interview_Coach_AI
   cd Interview_Coach_AI
   ```

2. Fetch the integration branches:

   ```powershell
   git fetch origin feature/postgres-integration feature/candidate-app-integration
   ```

3. Check out the candidate branch:

   ```powershell
   git switch feature/candidate-app-integration
   git pull --ff-only origin feature/candidate-app-integration
   ```

4. Confirm the PR target before reviewing:

   ```text
   Source: feature/candidate-app-integration
   Target: feature/postgres-integration
   ```

   Do not complete the candidate PR into `main`, `dev-Fu`, or `staging` unless the integration team intentionally retargets the branch after the Postgres baseline is accepted.

## Local Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create `.env.local` for local review:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Use local-only placeholders like these:

   ```text
   DATABASE_URL=postgresql://postgres:interviewcoach-local-smoke-password@127.0.0.1:5434/interviewcoach_smoke
   CANDIDATE_DATA_BACKEND=postgres
   CANDIDATE_AUTH_MODE=dev
   NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3000
   NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
   ENCRYPTION_SECRET=local-review-placeholder-secret-32-chars
   GEMINI_API_KEY=local-review-placeholder
   SMTP_USERNAME=local-review@example.invalid
   SMTP_PASSWORD=local-review-placeholder-password
   ```

3. Start the local smoke Postgres database, apply recruiter plus candidate migrations, and seed candidate fixtures:

   ```powershell
   npm run db:setup
   ```

4. Start the app:

   ```powershell
   npm run dev:candidate
   ```

5. Open:

   ```text
   http://localhost:3000
   ```

## Environment Notes

For local candidate validation, use the seeded candidate identity:

```text
CANDIDATE_AUTH_MODE=dev
```

`dev` mode resolves the primary seeded candidate automatically and bypasses the external TalentArbor login route for local browser review. Use `password` mode only when you need to override the local candidate identity with explicit `CANDIDATE_DEV_*` values.

The smoke setup uses the disposable local Postgres configuration. The placeholder values above are for local compile and smoke validation only. Do not use Fu-Lab mirror pipeline placeholder secrets or local placeholders as production or staging values.

## Automated Validation

Run this first:

```powershell
npm run ci:candidate
```

That runs:

- `npm run lint`
- `npm run typecheck`
- `npm run test:candidate`
- `npm run build`

If the smoke Postgres container is available, also run:

```powershell
npm run db:smoke-candidate-readiness
npm run test:e2e:candidate-seeded
```

Or run the combined local chain:

```powershell
npm run ci:candidate:with-db
```

Expected result: lint, typecheck, candidate tests, build, DB readiness, and seeded setup-to-summary browser smoke pass.

## Manual Validation Pass

After `npm run db:setup` and `npm run dev`, use this quick manual pass.

### Public Candidate Page

Open:

```text
http://localhost:3000/
```

Check:

- TalentArbor logo and candidate landing page render.
- `Start practicing` points to `/auth/talentarbor/start?next=/practice`.
- `Review dashboard` points to `/auth/talentarbor/start?next=/dashboard`.
- No recruiter dashboard data appears on `/`.

### Candidate Protected Routes

Open in an unauthenticated browser:

```text
http://localhost:3000/practice
http://localhost:3000/dashboard
```

Check:

- Both routes redirect through `/auth/talentarbor/start`.
- Unsafe external redirect targets are not accepted.

For local authenticated candidate validation, use `dev` candidate mode from the environment notes, then check:

```text
http://localhost:3000/practice
http://localhost:3000/dashboard
```

Check:

- `/practice` loads the candidate setup form.
- Seeded data can generate a session.
- `/dashboard` shows candidate-owned active/completed practice state.
- `/summary/[sessionId]` shows candidate-owned summary content after a completed session.

### Candidate Setup To Summary

Use `/practice` and walk the seeded happy path:

1. Confirm the target role is restored.
2. Start generating questions.
3. Enter the generated session.
4. Submit an answer.
5. Get coaching.
6. Continue through the questions.
7. Finish the session.
8. Open the summary.

Expected result: the session and summary stay candidate-owned and do not require recruiter invite-token access.

### Recruiter Route Preservation

Open as an unauthenticated user:

```text
http://localhost:3000/recruiter/dashboard
http://localhost:3000/recruiter/templates
http://localhost:3000/recruiter/settings
http://localhost:3000/admin/feedback
http://localhost:3000/qa/ai-quality
```

Check:

- Each route remains protected and redirects to recruiter login.
- `/recruiter` remains the ATS/create landing alias.
- `/recruiter/dashboard` remains the recruiter dashboard route, not the candidate dashboard.

## Merge Map

Current intended stack:

```text
main
  -> dev-Fu
      -> feature/postgres-integration
          -> feature/candidate-app-integration
```

Reviewer order:

1. Validate `feature/postgres-integration` as the migrated recruiter Postgres baseline.
2. Review `feature/candidate-app-integration` as the candidate delta on top of that baseline.
3. Keep the candidate PR in draft until the open blockers below are accepted or explicitly deferred.

## Open Blockers

Do not treat the candidate branch as production-ready until these are answered:

- Does TalentArbor `LoginWithType/2` preserve return URL, callback, state, or equivalent intent?
- What identity handoff will Interview Coach receive after TalentArbor/RangamWorks login?
- Which team owns company Azure branch policy, build validation, staging deploy, and production deploy?
- Which exact host/path deployment flow will be used for `interviewcoach.talentarbor.com`?

## Deep Reference

Use these only when needed:

- [Shared Host Routing Contract](04-architecture/shared-host-routing-contract.md)
- [Candidate Login Redirect Contract](02-requirements/candidate-login-redirect-contract.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [Storage And Resume Ingestion](04-architecture/storage-and-resume-ingestion.md)
- [Recruiter Regression Checklist For Candidate PRs](05-quality/recruiter-regression-checklist.md)
- [Candidate Integration PR Policy](07-ops/candidate-integration-pr-policy.md)
- [Working Backlog](00-working-backlog.md)
