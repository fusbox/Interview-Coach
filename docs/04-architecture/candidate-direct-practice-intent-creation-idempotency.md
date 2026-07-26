# Candidate Direct Practice Intent Creation Idempotency

Status: Ratified implementation contract
Last updated: 2026-07-18

## Purpose And Boundary

Direct candidate actions such as `Practice this now`, `Finish planned practice`, and a future fixed coach bundle create an immutable `candidate_practice_intents` snapshot before the existing ready landing. One user action must create one ready intent even when the request is submitted concurrently or the response is lost.

This contract covers direct one-question and fixed-set creation through `POST /candidate/practice/ready/intents`. It does not cover editable next-round draft launch, intent-to-session launch, background generation, invited sessions, or final action styling.

## V1 And V2 Disposition

- **Preserve:** Candidate ownership, explicit retry/conflict outcomes, a new practice path for every intentional repractice, and the pre-session ready landing.
- **Reinterpret:** The replay value is an immutable candidate-owned intent pointer, not a stored HTTP response. The exact server-resolved intent snapshot supplies the request fingerprint.
- **Retire:** Intent creation during GET rendering, V1 client-effect practice creation, and client-only duplicate suppression as the durability boundary.
- **Defer:** Editable next-round draft launch, trusted coach-bundle generation, invited-flow wiring, final action UI, and scheduled request-ledger cleanup.

## Request Identity

Every direct creation request supplies an `Idempotency-Key` generated for one user activation. The server validates the key, stores only its SHA-256 hash, and scopes uniqueness to the authenticated candidate.

- A retry of the same candidate-owned key and exact request fingerprint returns the original intent.
- Concurrent requests with that same key serialize at the database boundary and return one intent.
- Reusing the key with changed source, order, item pointers, prep context, or immutable snapshot content returns conflict before mutation.
- A later intentional repractice uses a new action key and creates a new intent even when the selected questions are identical.
- The client retains one exact pending action key in tab-scoped session storage across refresh or an ambiguous network failure. It clears the key only after accepted navigation, and clears then rotates it when the server reports a truthful fingerprint conflict. Immediate in-memory claiming remains a responsiveness aid, not the correctness boundary.

The request fingerprint is a SHA-256 digest of a canonical server-resolved snapshot containing source, opaque prep-context identity, target identity, setup context, ordered item snapshots, and item provenance. Raw job descriptions, resume-derived context, question text, and coaching are not copied into the request ledger.

## Atomic Persistence

`candidate_practice_intent_creation_requests` contains candidate id, key hash, request fingerprint, resulting intent id, and bounded timestamps. One database function acquires a candidate-plus-key transaction advisory lock and then:

1. returns conflict when an unexpired row has a different fingerprint;
2. replays the candidate-owned intent for an exact unexpired match;
3. otherwise inserts one immutable ready intent and its request pointer in the same transaction.

There is no pending or lease state because direct intent creation has no external provider work. If the statement fails, neither the intent nor the request pointer commits, so the same key can retry safely. The request replay window is 24 hours, aligned with ready-intent expiry. Reusing an expired request key may create a new intent, but normal intentional repractice always generates a new key.

The existing ready route remains the sole pre-session landing. A replay may return an intent that has already been consumed; the intent landing and start route recover its already-attached candidate-owned session under the fixed-intent launch contract.

## Ownership And Failure Rules

- Candidate identity comes only from the verified IC app session or development launch fixture.
- Source sessions and questions resolve through candidate-owned server reads before snapshot construction.
- Request uniqueness is candidate-scoped; the same raw key used by another candidate is independent.
- The database request pointer uses candidate-plus-intent ownership, and the later launch boundary revalidates exact source/session snapshots.
- GET `/candidate/practice/ready` may resolve legacy pointer context for a truthful recovery display, but it never creates durable state.
- Malformed key or payload returns `400`, absent identity returns `401`, fingerprint conflict returns `409`, invalid source facts return `422`, and persistence failure returns `503`.

## Acceptance Evidence

- one key plus one exact request returns one intent on first creation and replay;
- changed content under one key conflicts without another request or intent row;
- a failed transaction leaves no claim and succeeds on retry with the same key;
- the same key is isolated across candidates;
- a new key creates a later intentional repractice for identical content;
- one-question and fixed-set producers use the shared POST boundary;
- editable draft launch remains unchanged;
- direct GET rendering performs no creation mutation;
- created intents preserve source, ordered items, setup context, 24-hour expiry, and the existing ready landing.
