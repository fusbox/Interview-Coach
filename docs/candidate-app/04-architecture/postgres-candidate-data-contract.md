# Postgres Candidate Data Contract

Date: 2026-05-07
Status: Working architecture contract

## Purpose

This document defines the initial Postgres persistence direction for the candidate-led app.

The candidate app should be implemented directly against the Postgres patterns from [C:\tmp\Interview-Coach-Recruiter-postgres](/c:/tmp/Interview-Coach-Recruiter-postgres), not against the older Supabase-backed recruiter code.

## Source Pattern

Use the migrated recruiter app as the backend pattern source for:

- Postgres config and pooling
- repository interfaces
- server-only query boundaries
- app auth/session storage
- candidate token storage when invite mode is needed
- smoke script structure
- route/service validation patterns

Do not copy recruiter data semantics that do not apply to candidate-owned practice.

## Core Entities

### Candidate Profile

Canonical candidate identity for app access.

Recommended fields:

- `candidate_profile_id`
- `auth_subject`
- `email`
- `display_name`
- `workspace`
- `created_at`
- `updated_at`

### Candidate Identity

Provider binding for SSO, standalone auth, or local dev auth.

Recommended fields:

- `candidate_identity_id`
- `candidate_profile_id`
- `provider`
- `issuer`
- `subject`
- `email`
- `created_at`
- `last_seen_at`

Current migration:

- [Candidate identity schema migration](/c:/tmp/Interview-Coach-Recruiter-postgres/db/migrations/002_candidate_identity_schema.sql)
- [Candidate identity rollback smoke](/c:/tmp/Interview-Coach-Recruiter-postgres/db/validation/002_candidate_identity_schema_smoke.sql)

The initial migration creates `candidate_profiles` and `candidate_identities`, enforces provider/issuer/subject uniqueness, and keeps ownership anchored on `candidate_profile_id`.

### Practice Draft

Server-backed setup state for `/practice`.

Recommended fields:

- `practice_draft_id`
- `candidate_profile_id`
- `status`
- `target_role`
- `job_description`
- `resume_context_json`
- `custom_questions_json`
- `intake_responses_json`
- `question_set_snapshot_id`
- `session_id`
- `resume_target_screen`
- `generation_started_at`
- `generation_finished_at`
- `generation_error`
- `last_activity_at`
- `created_at`
- `updated_at`

### Resume Asset

Reusable resume source artifact or extracted text artifact.

Recommended fields:

- `resume_asset_id`
- `candidate_profile_id`
- `kind`
- `storage_path`
- `file_name`
- `mime_type`
- `size_bytes`
- `extracted_text`
- `metadata_json`
- `created_at`

### Practice Session

Candidate-owned interview session linked to the shared session engine.

Recommended ownership fields:

- `session_source = "self_serve"`
- `candidate_profile_id`
- `workspace`
- `app_module = "interview_coach"`

Invite sessions can preserve token access separately when needed.

## Repository Rules

- Route handlers should not contain raw SQL except for tiny health checks.
- Feature services should depend on repository interfaces.
- Repository implementations should use parameterized SQL through the shared Postgres client.
- Candidate ownership must be enforced in server-side queries.
- Tests should cover permission-denied and not-found cases separately.

Current repository boundary:

- [Candidate profile repository](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-profile-repository.ts)
- [Candidate profile repository tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-profile-repository.test.ts)

The first repository resolves or creates candidate profiles from provider identity handoffs and maps provider identities to a `CandidateProfileAccessRecord` for future auth and route-guard code.

## Migration Rule

Everything Supabase-related must convert to standard Postgres patterns before it is introduced here.

Runtime code should not add:

- `@supabase/*`
- `NEXT_PUBLIC_SUPABASE_*`
- `SUPABASE_SERVICE_ROLE_KEY`
- Supabase Storage assumptions
- RLS-dependent application behavior

## Environment Direction

Preferred DB configuration:

- `DATABASE_URL`

Supported fallback if useful:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_SSL_MODE`

Production should use a least-privilege app user, not an admin or generic `postgres` user.

## Open Questions

- Should `candidate_profiles` be owned by this app during early development, then later migrated to a shared candidate platform?
- Should one candidate have one active practice draft or multiple named drafts?
- Should resume assets be profile-level by default, session-specific by default, or both?
