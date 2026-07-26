# Candidate Setup Start Idempotency

Status: Ratified implementation contract
Last updated: 2026-07-18

## Purpose

Initial candidate setup crosses an expensive and externally fallible question-wording boundary before it creates a durable practice session. A repeated browser request must not create two prep paths, call the provider twice concurrently, consume trusted host staging twice, or leave the candidate unsure whether the first request succeeded.

This contract covers initial `/candidate/setup` submission only. Fixed follow-up intents, background generation, invited sessions, and resume-question reconciliation remain separate work.

## V1 And V2 Disposition

- **Preserve:** V1's operational vocabulary of acquired, in-progress, replayed, and conflicting requests; candidate ownership; retry after a failed provider call; and returning the already-accepted result after response loss.
- **Reinterpret:** The durable replay value is the candidate-owned practice-session id, not a stored HTTP response body. Setup/JD/resume/question payloads remain in their governed session snapshots and are not copied into an idempotency table.
- **Retire:** V1 candidate setup's unguarded draft-to-generation transition and current V2's ability to call the wording provider again for the same accepted browser attempt.
- **Defer:** Fixed-intent session transaction hardening, background generation, cross-device server-backed setup drafts, and final candidate-facing loading UI.

## Request Contract

The browser sends one `Idempotency-Key` for one exact setup-start attempt. The key:

- is opaque, random, and never contains candidate or setup data;
- remains stable across retries, refresh, and response-loss recovery while the normalized setup and explicit prep-path decision are unchanged;
- rotates when setup fields, trusted/manual entry mode, or the explicit separate-path decision changes;
- is cleared with the setup draft only after accepted session recovery or deliberate existing-path navigation.

The server computes two SHA-256 values:

- `idempotency_key_hash` from the raw key;
- `request_fingerprint` from the canonical setup, entry mode, explicit prep-path decision, and candidate-owned prep-context anchor (including trusted launch/job identity when present).

The raw key and canonical request payload are not persisted in the claim table.

## Persistence And Expiry

`candidate_setup_start_requests` is candidate-owned and unique by candidate plus key hash. It stores lifecycle, request fingerprint, claim generation, lease/expiry timestamps, a terminal session pointer, and bounded error metadata.

The terminal session pointer is constrained with the candidate id, so the database cannot attach another candidate's session even if application ownership checks regress.

- A claim lease is 60 seconds, longer than the bounded synchronous wording request.
- A completed replay pointer remains valid for 24 hours.
- An unexpired key reused with a different request fingerprint is a conflict.
- A failed claim with the same fingerprint is immediately reacquirable with a higher generation.
- A stale pending claim with the same fingerprint is reacquirable with a higher generation.
- Once the 24-hour request window expires, the row may be reused as a new generation.

Expired-row cleanup is an operational retention concern rather than part of synchronous setup. The expiry index supports a later bounded cleanup job; no setup payload or provider content is retained in these rows.

Generation is the completion fence. Only the currently leased generation may create and attach a session. A timed-out or failed older process cannot complete after another generation has taken ownership.

## Lifecycle

1. Verify candidate identity and canonicalize trusted/manual setup input.
2. Claim the candidate plus request key before any prep-context mutation or provider call.
3. On `completed`, load the candidate-owned session and replay it without prep resolution or provider work.
4. On fresh `pending`, return an explicit retryable in-progress response. On fingerprint mismatch, return conflict.
5. On acquired claim, resolve the prep context and call the production wording runtime.
6. Provider or pre-session failure marks only that claim generation failed. The same request can retry.
7. Session insert, current-generation completion, and trusted setup-staging consumption occur in one PostgreSQL statement. If any condition fails, none is accepted.
8. A lost HTTP response is recovered by replaying the session pointer. No second provider call occurs after the session boundary has been accepted.

The browser bridge may remain unclaimed only when durable candidate identity/storage is intentionally unavailable in nonproduction. Production durable setup fails closed if the idempotency seam is unavailable.

## Failure Matrix

| Scenario | Required outcome |
| --- | --- |
| Double click / concurrent duplicate | One acquired claim; the other request reports in progress; one provider call maximum. |
| Response lost after session commit | Retry replays the same candidate-owned session; no provider call. |
| Provider rejection, timeout, or malformed output | No session, no trusted-staging consumption, claim becomes retryable, draft/key remain. |
| Process stops during provider call | Claim remains pending until lease expiry; later same-fingerprint retry advances generation. |
| Old process returns after a newer generation acquired | Atomic session completion fence rejects the old generation. |
| Same key with changed setup/decision | Conflict; no prep mutation, provider call, or session. |
| Explicit separate-path decision | Distinct request signature/fingerprint; accidental duplicate submission still converges on one session. |
| Replay by another candidate | No match because the claim and session lookup are candidate-owned. |

## Acceptance Evidence

- Migration is repeatable on both fresh and existing V2 databases.
- Schema smoke proves acquire, in-flight duplicate, conflict, failed retry generation, fenced stale completion, completed replay, and one trusted-stage consumption.
- Route tests prove provider suppression on replay/in-flight/conflict and retry after provider failure.
- Disposable-DB reconciliation proves exactly one accepted practice session for one setup attempt.
