# Candidate Fixed-Intent Session Launch

Status: Ratified implementation contract
Last updated: 2026-07-18

## Purpose

A fixed follow-up practice intent is the immutable staging boundary between a candidate choosing one or more questions and entering a new practice session. Starting that intent must create exactly one candidate-owned session even when the candidate double-clicks, opens another tab, loses the response, or retries after an ambiguous network result.

This contract covers `POST /candidate/practice/ready/[intentId]/start`. Direct intent creation, editable next-round draft launch, background work, invited sessions, and final landing-page design remain separate boundaries.

## V1 And V2 Disposition

- **Preserve:** Candidate ownership, explicit parent/attempt lineage, a fresh session for every intentional repractice, and a landing/transition before live practice.
- **Reinterpret:** V1 cloned an entire invited session. V2 consumes one immutable, item-level intent whose source snapshots define the exact follow-up round. The intent id is the idempotency scope for session launch.
- **Retire:** V1 client-effect auto-start and current V2's split session-insert then intent-update sequence.
- **Defer:** Idempotency for creating direct one-question or fixed-set intents, editable queue launch hardening, invited-flow wiring, and final candidate-facing error/loading design.

## Request And Expiry Contract

The route accepts one candidate-owned intent id and no mutable round payload. A separate browser idempotency key would add no identity at this boundary: the immutable intent id already represents one exact launch. A later intentional repractice creates a new intent id.

- A newly created intent remains `ready` for 24 hours.
- The ready landing may be revisited during that window.
- Starting after expiry fails before session mutation and advances the intent to `expired`.
- `cancelled` and `expired` intents cannot be restarted.
- A `consumed` intent replays only the session already attached to that intent.
- Direct-intent creation still needs its own request-level idempotency contract because that action creates the immutable intent id.

Existing V2 intent rows receive `created_at + 24 hours` as their honest expiry boundary. Existing ready rows already beyond that boundary become `expired`; no V1 data compatibility is required.

## Atomic Persistence Boundary

The database function locks and re-reads the candidate-owned intent inside one transaction. For a ready intent it:

1. Verifies lifecycle, expiry, expected immutable intent version, prep-context ownership, and exact source-item/session snapshot mapping.
2. Serializes launch for the candidate plus opaque prep context so two different intents cannot persist the same session-attempt number.
3. Rejects a stale attempt-count snapshot so the route can reload context and retry once.
4. Inserts one normal `candidate_practice_sessions` row.
5. Changes the intent to `consumed`, attaches that session id, and records `consumed_at`.

The insert and consume either both commit or neither commits. A composite foreign key prevents an intent from pointing to another candidate's session. A consumed replay additionally verifies that the attached session declares the same source intent in its immutable follow-up snapshot; an unrelated same-candidate session is not a valid replay.

## Snapshot Invariants

The accepted session continues to use the existing setup, question-plan, and question-wording snapshots. The transaction verifies at minimum:

- candidate and opaque role-profile ownership;
- source intent id in setup, plan, and wording snapshots;
- exact item count and ordered source session/question pointers;
- exact source question text and sequential local slot mapping;
- expected prior session count for the selected prep context.

The source question wording is reused exactly. No question provider runs during follow-up intent launch.

## Outcomes

| Outcome | Meaning | Route behavior |
| --- | --- | --- |
| `created` | Session inserted and intent consumed atomically. | Redirect to the new session with entry transition. |
| `replayed` | Intent was already consumed into its valid owned session. | Redirect to that same session without mutation. |
| `stale_context` | Another session changed attempt numbering before commit. | Reload context and retry once. |
| `not_found` | Candidate does not own the requested intent. | Candidate-safe not-found response. |
| `expired` or `cancelled` | Intent is no longer launchable. | Conflict response; no session. |
| `mismatched` | Intent changed after the landing read. | Conflict response; no session. |
| `consumed_mismatch` | Stored pointer does not identify this intent's valid owned session. | Fail closed; no alternate redirect. |
| `invalid_session` | Proposed immutable snapshots do not match the locked intent. | Fail closed; no session. |

## Acceptance Evidence

- Route tests cover created, concurrent/replayed, response-loss replay, stale-context retry, expired, cancelled, changed, unowned, and consumed-mismatch paths.
- Repository tests prove one typed database-function call and closed outcome parsing.
- Rollback-only SQL smoke proves one session per intent, valid replay, ownership, expiry, mismatch, and atomic rollback behavior.
- Migration applies repeatedly to existing and clean databases.
