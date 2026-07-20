# Recruiter Invitation Handoff Read Contract

Status: Implemented in Slice 157
Last updated: 2026-07-20

## Purpose

This contract defines the recruiter-owned, reopenable handoff for one durable invitation batch. It preserves the create flow's immediate terminal state while allowing the owning recruiter to return after refresh or a later login and recover recipient-specific copy controls, exact latest delivery state, and only policy-eligible send or retry actions.

The handoff is an operational detail, not a general invitation list and not a candidate-performance surface. It may recover a personal invitation link only inside this separately authorized, private, no-store route. Dashboard and other broad reads continue to carry opaque batch/session ids without bearer material.

## V1 Disposition

| V1 behavior | Disposition | V2 direction |
| --- | --- | --- |
| Recruiters can rediscover invitations from the dashboard | Preserve | Dashboard recipient rows link by opaque batch id to one durable handoff. |
| Recruiters can copy an invitation link and send again | Reinterpret | The handoff reconstructs copy content server-side from the owned active token and allows delivery only when the append-only ledger says it is safe. |
| Invite tokens are returned in broad session summaries | Retire | Bearer ciphertext and recovered links are absent from list and dashboard models. |
| Resend is an unconditional per-session command | Retire | One batch command reuses the existing delivery service, which suppresses accepted, active, unknown-outcome, and terminal-failure recipients. |
| The create-result modal is the only invitation handoff | Reinterpret | Keep the immediate result, then add a durable route that survives refresh and later login without browser-persisted recipient PII. |
| Recruiter profile/signature settings shape the message | Defer | V2 uses the authenticated recruiter's display name and the ratified shared message contract. |

## Route And Ownership

The canonical route is `/recruiter/invitations/[batchId]`.

- Missing app authentication redirects to login with the exact safe return path.
- An authenticated user without recruiter/admin access receives the existing access-denied surface.
- An unknown batch and a foreign-owned batch share one not-found boundary.
- The repository requires the authenticated recruiter id and repeats it across the batch, recipient, session, delivery-attempt, and token ownership joins.
- The page is dynamic and private/no-store. It never relies on `localStorage`, `sessionStorage`, or browser persistence for recipient PII or delivery truth.

The dashboard may expose an opaque `batchId` navigation target. It must not expose token hash, ciphertext, encryption key id, raw token, provider reference, message body, or invite link.

## Allowed Detail Facts

The detail read may contain:

- batch id, target role, interview stage, lifecycle, creation time, and recipient count;
- recipient id, candidate index, name, email, optional requisition reference, and lifecycle;
- the newest invited session id, status, and attempt number;
- the newest delivery attempt id, number, lifecycle, retryability, bounded failure code, and lifecycle timestamps;
- active-token ciphertext, encryption key id, expiry, and revocation time inside the server-only repository/read-model boundary;
- a recovered recipient-specific invite link and approved copy message only after ownership, token activity, expiry, and authenticated decryption all pass.

The detail read excludes candidate answers, drafts, coaching, evaluator facts, prompts, hidden plans, timing/engagement, provider reference ids, raw provider responses, candidate-led records, and recruiter credentials.

## Delivery State Matrix

| Latest durable state | Display meaning | Automatic action |
| --- | --- | --- |
| No attempt | Not emailed through Interview Coach | Send is eligible when the recipient, batch, and token are active. |
| `queued` younger than five minutes | Email queued | No new action. |
| `queued` at least five minutes old | Prior claim expired before provider work | Retry is eligible; the claim function first retires the stale row as retryable and appends a new attempt. |
| `sending` younger than ten minutes | Sending may be in progress | No new action. |
| `sending` at least ten minutes old | Outcome needs review | No automatic retry. The claim function converts it to `outcome_unknown` because the provider may already have accepted it. |
| `provider_accepted` | Email provider accepted the message | Terminal; never resend automatically. This does not prove mailbox delivery. |
| `failed`, retryable | Delivery failed safely before acceptance was established | Retry is eligible. |
| `failed`, not retryable | Delivery could not be retried safely | No automatic action. |
| `outcome_unknown` | Provider acceptance cannot be established | No automatic action. |

The handoff invokes the existing batch delivery command. The browser does not select recipients. The server reloads the aggregate and applies the same recipient-scoped claim policy, so one action can safely send never-attempted recipients and retry eligible failures without resending accepted recipients.

## Token And Copy Boundary

- A link is recoverable only when the batch and recipient are ready, the active token is not revoked or expired, and the configured encryption key authenticates the ciphertext.
- Nonproduction link recovery uses the current request host and port so LAN and alternate-port validation remain usable; production ignores request-host input and requires the configured public HTTPS origin.
- An accepted delivery may outlive link availability. In that case the provider-accepted fact remains visible but copy controls are unavailable.
- Token decryption failure is a key-availability/support condition. The handoff does not reveal the ciphertext and does not present an eligible send action for that recipient.
- The browser receives only the final link/message needed by this authorized detail. Raw token fields never enter serialized props, logs, telemetry, dashboard rows, or API delivery responses.
- Copy actions are browser-local conveniences and never mutate sent state.

## UI Contract

- The create flow keeps its current immediate recipient results and gains a durable **Manage invitations** destination.
- The dashboard keeps its factual progress/transcript actions and adds an **Invitation details** destination by opaque batch id.
- The handoff identifies the role, stage, batch date, and recipient count, then lists each recipient with delivery state, attempt context, candidate practice state, and copy controls when available.
- Exactly one batch action is offered when at least one recipient is policy-eligible: **Send pending invitations** for never-attempted work or **Retry failed delivery** when only retry work remains.
- In-progress, accepted, unknown, terminal, revoked, expired, and key-unavailable states are stated without implying successful mailbox delivery.
- The layout remains operable without horizontal overflow on mobile; link values wrap or scroll inside their own control rather than resizing the page.

## Failure And Recovery

- A failed detail read fails the page; it does not fabricate an empty batch.
- A delivery API failure preserves the durable detail and presents retry guidance only when policy still permits another action.
- After a delivery response, the client applies the returned recipient outcomes for immediate feedback and refreshes the server route so the ledger remains authoritative.
- Refresh, new tab, later login, and direct safe return recover from Postgres, not client state.
- Concurrent tabs may submit different action keys. Recipient-scoped database claims converge, accepted recipients remain suppressed, and active/unknown work is not duplicated.

## Acceptance

- owner-only batch recovery and one not-found boundary for unknown/foreign ids;
- newest session and newest delivery attempt selection per recipient;
- precise stale queued/sending interpretation matching the database claim function;
- active-link recovery and expired/revoked/key-unavailable suppression;
- no bearer or private candidate content in dashboard/list/API delivery responses;
- immediate create result plus durable create/dashboard navigation;
- copy and send/retry controls that survive refresh and later login;
- focused repository/read-model/route/UI tests, responsive checks, and a rolled-back two-recruiter database smoke.

## Deferred

- token regeneration, revocation, and encryption-key rotation UI;
- provider-side lookup or human authorization for `outcome_unknown`;
- bounce/webhook reconciliation and mailbox-delivery claims;
- recruiter settings/signatures, host launch, TalentArbor messaging handback;
- invited debrief, whole-session practice again, and admin/QA surfaces.
