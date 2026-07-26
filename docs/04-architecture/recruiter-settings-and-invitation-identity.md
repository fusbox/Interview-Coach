# Recruiter Settings And Invitation Identity

Status: Ratified for Slice 159
Last updated: 2026-07-20

## Purpose

This contract defines the smallest useful standalone recruiter settings surface for V2. It lets an authenticated recruiter control the name shown in Interview Coach invitation copy while keeping authentication, employee provisioning, email delivery configuration, and candidate data outside the profile boundary.

## V1 Disposition

| V1 behavior | Disposition | V2 direction |
| --- | --- | --- |
| Recruiter first and last name shape candidate invitation copy | Preserve and simplify | One candidate-facing display name is stored on the authenticated app account and consumed by the shell, copy message, and email delivery paths. |
| Title, phone, and timezone are editable | Retire for now | None has a ratified V2 consumer. Do not present stored-but-ineffective settings as functional. |
| Profile data is duplicated in `recruiter_profiles` | Retire from active V2 runtime | `app_users.display_name` is the sole V2 display-identity source. The legacy table remains schema history until retirement work removes it. |
| Account email appears in settings | Preserve as read-only | Email belongs to account provisioning and authentication, not self-service profile editing. |
| Settings can replay product tours | Retire | V2 has no ratified recruiter tour contract. |

## Identity And Consumer Contract

- `app_users.user_id` remains the recruiter principal and owner key.
- `app_users.display_name` is the editable sender/display identity. It is not a legal-name or verified-identity claim.
- The current shell identity, newly rendered invitation copy, copied invitation messages, and future email-delivery attempts resolve the same current account projection through `getAppUserDisplayName`.
- Provider-accepted email content is historical and is never rewritten after a settings change.
- `first_name` and `last_name` remain provisioning/fallback fields. This settings slice does not mutate them.
- `email` is visible but read-only. Changing email, password, roles, status, or external identity requires separate administrative or account-recovery contracts.

## Read And Write Boundary

The canonical page is `/recruiter/settings`; the mutation is `PUT /api/recruiter/profile`.

- Both require an active app session plus recruiter or admin role.
- Reads and writes repeat the authenticated `user_id` across `app_users` and role checks; caller-supplied user ids are forbidden.
- The request body contains exactly `senderDisplayName` and the current opaque `revision`.
- The display name is Unicode-normalized, whitespace-collapsed, control-free, nonempty, and at most 80 Unicode code points.
- A matching revision updates the account. An exact response-lost replay is treated as unchanged success. A stale competing edit returns conflict and cannot overwrite newer data.
- The successful database statement appends `recruiter_display_name_updated` to `auth_audit_events`. Audit metadata records only the changed field name, not old or new display-name content.
- Responses and pages are private/no-store. Refresh and later login reload the account projection from Postgres.

## UI Contract

- Present one field labeled **Name shown to candidates** and the read-only account email.
- Explain only the immediate consequence: this name is used in invitation messages sent or copied after the change.
- Disable save until valid content differs from the loaded value.
- Preserve entered text on a failed request. Show saving, saved, validation, conflict, and unavailable states without claiming success early.
- Refresh the server route after save so the recruiter shell and subsequent invitation consumers show the same identity.

## Out Of Scope

- SMTP credentials, sender mailbox/from-address control, email signatures, and delivery policy;
- password reset, MFA, role/status administration, and account provisioning;
- host recruiter launch or TalentArbor identity binding;
- title, phone, timezone, notification preferences, templates, tours, and admin policy;
- candidate data, candidate-visible coaching, and recruiter access to additional practice content.

## Acceptance

- owner-fenced server read and revision-fenced update;
- strict normalized validation and exact request shape;
- conflict and response-lost replay behavior;
- metadata-only audit event written atomically with a real change;
- shell, copy-message, and email-delivery paths continue to consume the account display name;
- refresh/later-login recovery from Postgres;
- focused route/repository/UI tests and a rolled-back two-user database smoke.
