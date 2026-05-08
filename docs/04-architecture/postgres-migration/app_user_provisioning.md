# App User Provisioning

## Purpose

Use this runbook to create phase-1 app-owned recruiter, admin, or QA users in the Postgres-backed auth tables. This is an operator/developer path, not public self-signup.

## Current Policy

- Recruiter/admin/QA users are provisioned by someone with database credentials.
- Browser self-signup remains paused until the company confirms whether phase 1 allows self-signup or requires admin-provisioned users only.
- Candidate access remains token-link based and is not affected by this runbook.

## Command

Set the database connection through either `DATABASE_URL` or the individual `POSTGRES_*` variables, then run:

```powershell
$env:APP_USER_PASSWORD = "use-a-long-temporary-password"
node scripts/provision-app-user.mjs --email user@rangam.com --roles recruiter,qa --first-name First --last-name Last --timezone America/Chicago
```

Prefer `APP_USER_PASSWORD` over `--password` so the password is not stored in shell history. The command requires a password of at least 12 characters unless `--allow-weak-password` is used for a disposable local user.

Use the direct `node scripts/provision-app-user.mjs ...` command rather than `npm run auth:provision-user -- ...` for reviewer/UAT provisioning. In some Windows/npm shells, the npm wrapper can forward only option values while dropping the flag names, causing the provisioner to fail with `Unexpected positional argument`. The direct `node` command avoids that wrapper ambiguity.

## Roles

Valid roles are:

- `recruiter`: standard recruiter access and profile-backed invite workflows.
- `qa`: `/qa` evaluator tooling.
- `admin`: `/admin` oversight tooling.

For broad internal test users, use `--roles recruiter,admin,qa`.

## What It Writes

The provisioner writes these records in one transaction:

- `app_users`: normalized email, display/profile name fields, status, and optional email verification timestamp.
- `app_user_credentials`: scrypt password hash only; never the raw password.
- `app_user_roles`: exact requested role set.
- `recruiter_profiles`: first name, last name, title, phone, and timezone when `recruiter` is one of the roles.
- `auth_audit_events`: `user_provisioned` audit event with non-secret metadata.

The command is idempotent for the same email. Rerunning it updates profile fields, replaces the role set, and resets the stored password hash.

## Example Users

```powershell
$env:APP_USER_PASSWORD = "temporary-password-for-fu"
node scripts/provision-app-user.mjs --email fu@rangam.com --roles recruiter,admin,qa --first-name Fu --last-name Box --timezone America/Chicago

$env:APP_USER_PASSWORD = "temporary-password-for-kushal"
node scripts/provision-app-user.mjs --email kushal@rangam.com --roles recruiter,qa --first-name Kushal --timezone America/Chicago
```

## Validation

After provisioning:

1. Set `APP_AUTH_BACKEND=postgres` and point the app at the same database.
2. Start the app and sign in at `/login` with the provisioned email/password.
3. Confirm the user can reach the route implied by their roles:
   - recruiter: `/recruiter/create`
   - QA: `/qa/ai-quality`
   - admin: `/admin/feedback`
4. Confirm logout clears the session and protected pages redirect to `/login?next=...`.
