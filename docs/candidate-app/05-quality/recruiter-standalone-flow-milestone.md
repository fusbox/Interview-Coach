# Recruiter Standalone Flow Milestone

Status: Conditional pass for Slice 156

## Milestone Contract

This milestone integrates the standalone recruiter and invited-candidate path from app-owned employee login through fixed-slot question preparation, atomic invitation creation, explicit delivery or copy fallback, clean invite exchange, initials signaling, shared live practice, completion, operational dashboard reads, and the recruiter-owned question-and-answer transcript.

Settings, invited debrief, whole-session practice-again, recruiter host launch, enterprise engagement reporting, and credentialed SMTP acceptance are outside this milestone. Candidate-led practice remains a separate ownership and privacy domain even where both audiences share runtime orchestration.

## Integrated Invariants

- Recruiter authentication, candidate host launch, and invited-practice access use distinct cookie names and independently resolved principals.
- Middleware cookie presence is only a routing hint. A missing, expired, revoked, or role-invalid app session is rechecked server-side without losing an allowlisted recruiter deep link.
- Production invitation links require an explicit HTTPS `NEXT_PUBLIC_APP_URL`. Development may derive an HTTP or HTTPS origin from the current request.
- Malformed, expired, revoked, foreign, or mismatched invited access never becomes an unhandled route error or crosses recipient/session ownership.
- Creation, question preparation, and delivery replay return the existing durable fact; changed payloads conflict, and indeterminate sends are never automatically duplicated.
- Recruiter dashboard reads expose operational facts only. Session detail independently proves ownership and exposes only ordered invitation questions plus the latest submitted answer per slot.
- Drafts, superseded retries, candidate coaching, evaluator output, timing/engagement, candidate-led data, provider payloads, and bearer material remain outside recruiter reads.
- Upgrade and fresh database application both produce the complete recruiter and invited-practice schema.

## Verification Plan

- Recruiter authentication and integrated recruiter-invite test suites.
- TypeScript, lint, and optimized production build.
- Repeat migration application against the established disposable database.
- Fresh empty-database migration and required-table probe.
- PostgreSQL smokes for authentication, creation concurrency, accepted question-set lineage, delivery recovery, clean invite access, live answer/evaluator ownership, dashboard projection, and transcript privacy.
- Desktop and mobile browser checks for login, creation, invited recovery/completion, dashboard, and transcript, using fixture providers only.

## External Evidence Still Required

- Approved credentialed SMTP provider acceptance and deployed mailbox evidence.
- Deployed environment secret ownership, HTTPS origin, logging redaction for `/s/[token]`, telemetry/alerts, and rollback proof.
- Manual accessibility and real deployment-browser coverage.

## Verdict

The standalone recruiter flow passes its local integrated milestone and is suitable for continued product work and deterministic demonstrations. Authentication, fixed-slot question preparation, invitation creation, fixture delivery, clean invited entry, initials signaling, shared live practice, completion, dashboard projection, and the employer-safe transcript form one coherent ownership-fenced path.

The verdict is conditional rather than release-ready. Credentialed SMTP, deployed network and logging controls, secret/key rotation, real-environment accessibility/performance, and operational rollback evidence remain external release gates. Recruiter create state also cannot yet reconstruct the terminal invitation handoff after refresh or a later return; that bounded usability gap is the next implementation slice.

## Findings And Corrections

- Centralized invitation-origin resolution. Development may derive the current HTTP(S) origin, while production now requires an explicit HTTPS `NEXT_PUBLIC_APP_URL`.
- Reserved candidate-launch and invited-access cookie names so recruiter authentication cannot silently collide with either identity domain.
- Preserved the exact safe recruiter path and query across stale, expired, or revoked server-side session recovery instead of falling back to the dashboard.
- Treated malformed percent-encoded invite cookies as missing access rather than an unhandled decoding failure.
- Added semantic status-text colors and corrected positive/attention dashboard chips to meet small-text contrast requirements on their soft surfaces.

## Verification Evidence

### Automated And Database

- `npm run test:recruiter-auth`: 7 files, 37 tests passed.
- `npm run test:recruiter-invites`: 38 files, 119 tests passed.
- `npm run typecheck`, `npm run lint`, and `npm run build`: passed; the optimized build completed under Next.js 15.5.20.
- `npm run db:migrate`: passed twice against the established disposable database.
- Fresh migration passed against an empty `interviewcoach_milestone_156` database and produced all required recruiter/invited tables.
- Recruiter authentication, question-set creation/concurrency, invitation delivery, invited access, invited live runtime, dashboard, and transcript PostgreSQL smokes passed.

### Integrated Browser Journey

- Recruiter login preserved an exact protected deep link across stale-cookie recovery.
- Manual fixed-slot question creation produced one invitation aggregate; fixture delivery accepted its recipient and retained copy fallbacks.
- A separate mobile browser context exchanged the bearer link into clean invited access, submitted initials, reached the landing and live session, and recovered the exact first-question draft from the original link in another context.
- Five answers completed through shared fixture coaching; the dashboard then showed `Completed` and `5 of 5 answered`.
- Recruiter transcript detail showed five latest submitted responses and no candidate coaching, evaluator output, engagement time, provider details, or bearer material.
- Login, create, initials, landing, live question, dashboard, and transcript checks found no serious or critical axe violations after the status-token correction. Dashboard and transcript checks found no horizontal overflow at their desktop/mobile target widths.

## Bounded Deferrals

- Credentialed SMTP and deployed mailbox acceptance.
- Production access-log redaction for `/s/[token]`, alert delivery, rollback rehearsal, and secret ownership.
- Invitation encryption key-ring rotation and a final token-lifetime decision.
- Reopenable recruiter invitation handoff, settings, invited debrief, and whole-session practice-again.
- Deployed 100-recipient delivery timing; if synchronous fan-out exceeds the runtime budget, retain the attempt ledger and move execution behind a durable worker/outbox.
