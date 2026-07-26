# Invited Practice Identity And Session Foundation

Status: Landed in Slice 148
Last updated: 2026-07-19

## Purpose

This contract defines the first durable convergence point between recruiter-created invitations and the V2 shared practice runtime. It deliberately separates three principals:

- the authenticated recruiter who owns the invitation;
- the invite-scoped recipient who may enter only the practice attached to one invitation;
- the authenticated candidate-led profile whose private prep contexts and practice remain outside recruiter visibility.

An invited recipient is not an Interview Coach account and is never represented by `candidate_profiles`. The recipient gains session-scoped access through a high-entropy invitation token. Initials may later signal a possible misinvitation, but they are not authentication.

## V1 Inventory And Disposition

| V1 fact or behavior | Disposition | V2 direction |
| --- | --- | --- |
| `invite_batches.created_by`, role/JD, question snapshot, requested/succeeded/failed counts | Reinterpret | Keep one recruiter-owned aggregate and immutable resolved V2 plan/wording snapshots. Creation counts describe persisted recipients; delivery outcomes belong to a later delivery-attempt boundary. |
| `invite_batch_candidates` name, email, requisition id, resume, ordered position, retry state, and session pointer | Reinterpret | Preserve ordered recipient facts and optional requisition/resume context in an invite-scoped recipient plus immutable session setup snapshot. Do not mix persistence failure with email retry state. |
| Recruiter-created legacy `sessions`, `questions`, `answers`, and `eval_results` | Retire | New invited sessions use an invited V2 session envelope and shared V2 runtime/evaluator contracts. No V1 row migration or compatibility read is required. |
| `candidate_tokens` token hash bound to one legacy session | Preserve and harden | Store a token hash for lookup plus authenticated encryption of recoverable token material needed for later copy/resend. Bind every token to exactly one recipient and one invited session; never store plaintext. |
| `recruiter_templates` | Retire | V2 uses one stage-derived fixed-slot question-seeding flow. Legacy template JSON is neither migrated nor accepted as invited-session truth. |
| `api_idempotency_keys` route response cache | Reinterpret | Use a recruiter-scoped invitation-creation request pointer and semantic request fingerprint. Exact replay returns the same aggregate; changed payload under the same live key conflicts. |
| `sessions.invitation_sent_at` and provider return id | Retire | V1 did not retain sufficient per-recipient delivery-attempt evidence. A later append-only delivery table will distinguish queued, provider-accepted, failed, bounced, and retry outcomes. |
| Batch creation followed by a second status-update transaction | Retire | Persist the creation request, batch, every recipient, initial session, and token in one database transaction. An internal write failure leaves no partial aggregate and the same request may be retried. |
| `getTrackedBatch(batchId, actorId)` and session ownership checks before send/resend | Preserve and harden | Every recruiter read or mutation must scope by immutable recruiter id. Admin bypass, if ever allowed, must be explicit rather than implicit. |
| Full-session repractice through `parent_session_id` and `attempt_number` | Preserve | Keep recipient-scoped parent/attempt lineage. A later invited completion flow may create a new exact-session attempt without changing the original snapshot. |

## Durable Model

### Recruiter invitation batch

`recruiter_invitation_batches` is the recruiter-owned creation aggregate. It stores target role, optional JD, interview stage, recipient count, and exact accepted V2 question-plan and question-wording snapshots. It does not store delivery success, candidate engagement, answer facts, or candidate-led profile identity.

### Invite-scoped recipient

`recruiter_invitation_recipients` is one intended person within one batch. It stores the minimum invitation and recruiter-operations identity: ordered position, name, normalized email, optional requisition reference, and timestamps. It is not a reusable global candidate record. The same person invited again receives another recipient id.

Resume text is not a recipient identity field. When present, it is captured in the immutable setup snapshot of the session that consumed it so later runtime guidance is tied to the exact context used for that attempt.

### Invited practice session

`invited_practice_sessions` stores an invited audience session envelope with:

- immutable recipient and recruiter ownership;
- parent session and positive attempt number;
- V2-compatible setup, plan, and wording snapshots;
- planned/in-progress/completed/abandoned lifecycle;
- progress, draft, latest-answer, latest-analysis, feedback-action, and completion JSON boundaries matching the current shared runtime seam.

The table is intentionally distinct from `candidate_practice_sessions`. Candidate-owned repositories continue to require `candidate_profile_id`; invited repositories never synthesize one. Both adapters must project into `session_runtime_facts` and use the same answer/evaluator domain contracts as implementation proceeds.

### Invited access token

`invited_practice_access_tokens` binds one token to one recipient and one invited session through composite foreign keys. The raw bearer token is returned only to trusted server application code. Persistence contains:

- a SHA-256 token hash for lookup;
- AES-256-GCM encrypted token material for later link recovery, copy, and resend;
- an encryption key id for rotation;
- explicit expiry and revocation timestamps.

Regeneration must revoke the prior active token before attaching a replacement. Tokens, ciphertext, candidate content, and invitation URLs must not enter ordinary logs or telemetry.

### Creation request

`recruiter_invitation_creation_requests` is a 24-hour recruiter-scoped idempotency pointer. The application hashes the raw idempotency key and fingerprints the semantic request without generated UUIDs or token material. Database creation serializes on recruiter plus key hash:

- no live row: atomically create the full aggregate and pointer;
- same fingerprint: return `replayed` and the original aggregate;
- different fingerprint: return `conflict` before mutation;
- expired pointer: permit a new intentional aggregate under that key while preserving the old batch.

Generated token material supplied by a losing concurrent request is ignored. Replay loads and decrypts the token material persisted by the winning transaction.

## Invariants

1. Recruiter ownership cannot be reassigned after creation.
2. Every recipient belongs to exactly one recruiter-owned batch.
3. Every invited session belongs to exactly one recipient and the same recruiter.
4. Every token resolves to exactly one recipient/session pair.
5. A first session is attempt 1 with no parent. Later attempts must point to the immediately prior session for the same recipient and recruiter.
6. Exact creation replay returns one aggregate; changed content under the same live key creates nothing.
7. Any recipient, session, token, or request-pointer insertion failure rolls back the entire aggregate.
8. Invited creation writes no `candidate_profiles`, candidate prep contexts, candidate practice sessions, candidate answer attempts, or candidate evaluator runs.
9. Recruiter-owned reads never infer access from session id, email, or token knowledge alone.
10. V1 app data is neither backfilled nor accepted as V2 invited-session truth.

## Slice 148 Boundary

In scope:

- schema, atomic aggregate creation, replay/conflict behavior, token vault, repository ownership reads, token lookup, shared runtime seed projection, and database/contract tests;
- proof of cross-recruiter denial, concurrent replay, rollback/retry, lineage constraints, token binding, and candidate-table isolation.

Out of scope:

- recruiter create UI and route;
- question-provider calls;
- SMTP/provider delivery and delivery-attempt persistence;
- copy-link/copy-message controls;
- initials entry, `/s/[token]`, invited landing, and invited completion UI;
- recruiter dashboard, settings, admin bypass, and answer visibility;
- V1 data migration.

## Downstream Contracts

The authenticated fixed-slot create adapter and append-only delivery lifecycle now sit over this aggregate. The clean link exchange, invite-scoped browser session, immutable initials signal, invited disclosure, landing, and shared transition are defined in [Invited Practice Access And Entry](./invited-practice-access-and-entry.md).

The next boundary is invite-owned typed-answer and evaluator persistence behind the shared live-practice shell. It must preserve recipient/session ownership and immutable V2 answer-attempt meaning without creating candidate profiles or writing through candidate-led ownership repositories.
