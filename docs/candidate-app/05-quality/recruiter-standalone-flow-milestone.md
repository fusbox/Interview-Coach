# Recruiter Standalone Flow Milestone

Status: Conditional pass through Slice 160

## Milestone Contract

This milestone integrates the standalone recruiter and invited-candidate path from app-owned employee login through candidate-facing identity settings, fixed-slot question preparation, atomic invitation creation, explicit delivery or copy fallback, refresh/later-login handoff recovery, clean invite exchange, initials signaling, shared live practice, candidate-only completion summary, immutable whole-session repeat, operational dashboard reads, and the recruiter-owned question-and-answer transcript.

Recruiter host launch, enterprise engagement reporting, account recovery/MFA, admin/QA, bounce/webhook processing, 100-recipient throughput, and asynchronous delivery workers are outside this milestone. Candidate-led practice remains a separate ownership and privacy domain even where both audiences share runtime orchestration. The guarded SMTP harness passed both its unarmed denial and one explicitly authorized credentialed provider/mailbox acceptance run.

## Integrated Invariants

- Recruiter authentication, candidate host launch, and invited-practice access use distinct cookie names and independently resolved principals.
- Middleware cookie presence is only a routing hint. A missing, expired, revoked, or role-invalid app session is rechecked server-side without losing an allowlisted recruiter deep link.
- Production invitation links require an explicit HTTPS `NEXT_PUBLIC_APP_URL`. Development may derive an HTTP or HTTPS origin from the current request.
- Malformed, expired, revoked, foreign, or mismatched invited access never becomes an unhandled route error or crosses recipient/session ownership.
- Creation, question preparation, and delivery replay return the existing durable fact; changed payloads conflict, and indeterminate sends are never automatically duplicated.
- Provider-accepted recipients are suppressed across a fresh action and later recruiter read; provider acceptance is never called mailbox delivery.
- Recruiter dashboard reads expose operational facts only. Session detail independently proves ownership and exposes only ordered invitation questions plus the latest submitted answer per slot.
- Candidate completion summaries and whole-session repeat remain invite-recipient-owned and unavailable through recruiter transcript or dashboard reads.
- Recruiter settings mutate only the authenticated account's normalized candidate-facing display name under a revision fence; account email and broader profile fields are read-only or absent.
- Drafts, superseded retries, candidate coaching, evaluator output, timing/engagement, candidate-led data, provider payloads, and bearer material remain outside recruiter reads.
- Upgrade and fresh database application both produce the complete recruiter and invited-practice schema.

## Verification Plan

- Recruiter authentication and integrated recruiter-invite test suites.
- TypeScript, lint, and optimized production build.
- Repeat migration application against the established disposable database.
- Fresh empty-database migration and required-table probe.
- PostgreSQL smokes for authentication, creation concurrency, accepted question-set lineage, delivery recovery, clean invite access, live answer/evaluator ownership, dashboard projection, and transcript privacy.
- Desktop and mobile browser checks for login/logout, settings conflict, creation, handoff recovery, invited recovery/completion/repeat, dashboard, and transcript, using fixture providers only.
- The guarded one-recipient SMTP verifier must refuse implicit execution and, when explicitly armed, use the production V2 delivery service and read models rather than a legacy email smoke.

## External Evidence Still Required

- Deployed-environment SMTP/network evidence. Local credentialed provider acceptance and mailbox receipt passed; that does not prove deployment secret ownership, egress, or runtime behavior.
- Deployed environment secret ownership, HTTPS origin, logging redaction for `/s/[token]`, telemetry/alerts, and rollback proof.
- Manual accessibility and real deployment-browser coverage.

## Verdict

The standalone recruiter flow passes its local integrated milestone and is suitable for deterministic demonstrations. Authentication, candidate-facing identity settings, fixed-slot question preparation, invitation creation, fixture delivery, reopenable handoff, clean invited entry, initials signaling, shared live practice, candidate-only summary/repeat, dashboard projection, and the employer-safe transcript form one coherent ownership-fenced path.

The verdict is conditional rather than release-ready. Deployed network and logging controls, secret/key rotation, real-environment accessibility/performance, and operational rollback evidence remain external release gates. Fixture acceptance was not substituted for live SMTP evidence: the guarded credentialed run and mailbox receipt both passed.

## Findings And Corrections

- Centralized invitation-origin resolution. Development may derive the current HTTP(S) origin, while production now requires an explicit HTTPS `NEXT_PUBLIC_APP_URL`.
- Reserved candidate-launch and invited-access cookie names so recruiter authentication cannot silently collide with either identity domain.
- Preserved the exact safe recruiter path and query across stale, expired, or revoked server-side session recovery instead of falling back to the dashboard.
- Treated malformed percent-encoded invite cookies as missing access rather than an unhandled decoding failure.
- Added semantic status-text colors and corrected positive/attention dashboard chips to meet small-text contrast requirements on their soft surfaces.
- Reconciled V1 email behavior with V2: retained the isolated Nodemailer seam and explicit provider acceptance, retired BCC personal-link delivery, silent no-credential success, recruiter CC, and mutable sent flags, and kept the V2 per-recipient immutable attempt ledger.
- Added a guarded one-recipient live SMTP verifier that requires an exact real-email acknowledgement and approved recipient, rejects production and unspecified bind origins, uses bounded TLS 1.2 SMTP timeouts, proves fresh handoff/dashboard recovery plus accepted-recipient suppression, emits metadata only, and removes its synthetic aggregate.

## Verification Evidence

### Automated And Database

- `npm run test:recruiter-auth`: 11 files, 55 tests passed.
- `npm run test:recruiter-invites`: 51 files, 179 tests passed.
- Focused live-guard, SMTP-provider, and delivery-service suite: 3 files, 14 tests passed.
- `npm run typecheck`, `npm run lint`, and `npm run build`: passed; the optimized build completed under Next.js 15.5.20.
- `npm run db:migrate`: passed twice against the established disposable database.
- Fresh migration passed against an empty `interviewcoach_milestone_160_20260720` database and produced all 11 required identity, invitation, delivery, invited-session, browser-session, answer, and evaluator tables; the database was then removed.
- Recruiter authentication, question-set creation/concurrency, invitation delivery, invited access, invited live runtime, completion/repeat, dashboard, transcript, handoff, and settings PostgreSQL smokes passed.
- `npm run qa:recruiter:smtp-live` first stopped at its acknowledgement guard before opening the database or provider. An intentionally configured second run returned the expected all-green metadata-only summary, made exactly one accepted provider call, recovered the durable state, suppressed resend, removed the temporary aggregate, and delivered the expected message to the approved mailbox.

### Integrated Browser Journey

- Recruiter login/logout, display-name save, current-name invitation copy, stale-tab conflict, and exact protected deep-link recovery were browser-validated.
- Manual fixed-slot question creation produced one invitation aggregate; fixture delivery accepted its recipient, retained copy fallbacks, and recovered from the invitation handoff after refresh/later navigation.
- A separate mobile browser context exchanged the bearer link into clean invited access, submitted initials, reached the landing and live session, and recovered the exact first-question draft from the original link in another context.
- Five answers completed through shared fixture coaching; candidate-only summary and whole-session practice again recovered from the original link without asking for initials again.
- Recruiter transcript detail showed five latest submitted responses and no candidate coaching, evaluator output, engagement time, provider details, or bearer material.
- Login, create, initials, landing, live question, dashboard, and transcript checks found no serious or critical axe violations after the status-token correction. Dashboard and transcript checks found no horizontal overflow at their desktop/mobile target widths.

## Bounded Deferrals

- Deployed-environment SMTP/network acceptance; use the guarded [SMTP runbook](./recruiter-smtp-live-validation-runbook.md) without treating the local acceptance as deployed evidence.
- Production access-log redaction for `/s/[token]`, alert delivery, rollback rehearsal, and secret ownership.
- Invitation encryption key-ring rotation and a final token-lifetime decision.
- Deployed 100-recipient delivery timing; if synchronous fan-out exceeds the runtime budget, retain the attempt ledger and move execution behind a durable worker/outbox.
